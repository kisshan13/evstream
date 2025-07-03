import { IncomingMessage, ServerResponse } from 'http'

import { Evstream } from './stream.js'
import { uid } from './utils.js'
import { EvMaxConnectionsError, EvMaxListenerError } from './errors.js'

import type {
    EvManagerOptions,
    EvMessage,
    EvOnClose,
    EvOptions,
} from './types.js'

/**
 * `EvStreamManager` manages multiple SSE connections.
 * Handles client creation, broadcasting messages, and channel-based listeners.
 *
 * Example :
 *
 * ```javascript
 * const evManager = new EvStreamManager();
 *
 * const stream = evManager.createStream(req, res);
 * ```
 *
 */
export class EvStreamManager {
    #clients: Map<string, Evstream>
    #listeners: Map<string, Set<string>>
    #count: number
    #maxConnections: number
    #maxListeners: number
    #id?: string
    constructor(opts?: EvManagerOptions) {
        this.#clients = new Map()
        this.#listeners = new Map()
        this.#count = 0

        this.#maxConnections = opts?.maxConnection || 5000
        this.#maxListeners = opts?.maxListeners || 5000
        this.#id = opts?.id
    }

    /**
     * Creates a new SSE stream, tracks it, and returns control methods.
     * Enforces max connection limit.
     */
    createStream(req: IncomingMessage, res: ServerResponse, opts?: EvOptions) {
        if (this.#count >= this.#maxConnections) {
            throw new EvMaxConnectionsError(this.#maxConnections)
        }

        const client = new Evstream(req, res, opts)
        const id = uid({ counter: this.#count, prefix: this.#id })
        const channel = []
        let isClosed = false

        this.#count += 1
        this.#clients.set(id, client)

        const close = (onClose?: EvOnClose) => {
            if (isClosed) return

            if (typeof onClose === 'function') {
                onClose(channel)
            }

            isClosed = true
            client.close()
            this.#count -= 1
            channel.forEach(chan => this.#unlisten(chan, id))
            this.#clients.delete(id)
            res.end()
        }

        res.on('close', () => {
            if (!isClosed) {
                close()
            }
        })

        return {
            authenticate: client.authenticate.bind(client),
            message: client.message.bind(client),
            close: close,
            listen: (name: string) => {
                if (isClosed) return
                channel.push(name)
                this.#listen(name, id)
            },
        }
    }

    /**
     * Sends a message to all clients listening to a specific channel.
     */
    send(name: string, msg: EvMessage) {
        const listeners = this.#listeners.get(name)

        for (const [_, id] of listeners.entries()) {
            const client = this.#clients.get(id)

            if (client) {
                client.message({
                    ...msg,
                    data:
                        typeof msg.data === 'string'
                            ? { ch: name, data: msg }
                            : { ch: name, ...msg.data },
                })
            }
        }
    }

    /**
     * Adds a client to a specific channel.
     * Enforces max listeners per channel.
     */
    #listen(name: string, id: string) {
        if (!this.#listeners.has(name)) {
            const size = this.#listeners.get(name)?.size
            if (size >= this.#maxListeners) {
                throw new EvMaxListenerError(size, name)
            }

            this.#listeners.set(name, new Set())
        }

        this.#listeners.get(name)!.add(id)
    }

    /**
     * Removes a client from a specific channel.
     * Deletes the channel if no listeners remain.
     */
    #unlisten(name: string, id: string) {
        const isListenerExists = this.#listeners.get(name)

        if (isListenerExists) {
            isListenerExists.delete(id)

            if (isListenerExists.size === 0) {
                this.#listeners.delete(name)
            }
        }
    }
}
