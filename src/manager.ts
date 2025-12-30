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
import type { EvRedisPubSub } from './adapters/pub-sub.js'

/**
 * `EvStreamManager` manages multiple SSE connections.
 * Handles client creation, broadcasting messages, and channel-based listeners.
 */
export class EvStreamManager {
	#clients: Map<string, Evstream>
	#listeners: Map<string, Set<string>>
	#count: number
	#maxConnections: number
	#maxListeners: number
	#pubSub?: EvRedisPubSub
	#id?: string

	constructor(opts?: EvManagerOptions) {
		this.#clients = new Map()
		this.#listeners = new Map()
		this.#count = 0

		this.#maxConnections = opts?.maxConnection || 5000
		this.#maxListeners = opts?.maxListeners || 5000
		this.#id = opts?.id

		this.#pubSub = opts?.pubSub

		if (this.#pubSub) {
			this.#pubSub.onMessage((msg) => this.#onMessage(msg))
		}
	}

	/**
	 * Creates a new SSE stream
	 */
	createStream(req: IncomingMessage, res: ServerResponse, opts?: EvOptions) {
		if (this.#count >= this.#maxConnections) {
			throw new EvMaxConnectionsError(this.#maxConnections)
		}

		const client = new Evstream(req, res, opts)
		const id = uid({ counter: this.#count, prefix: this.#id })
		const channels: string[] = []
		let isClosed = false

		this.#count += 1
		this.#clients.set(id, client)

		const close = (onClose?: EvOnClose) => {
			if (isClosed) return
			isClosed = true

			if (typeof onClose === 'function') {
				onClose(channels)
			}

			res.removeAllListeners('close')
			client.close()

			this.#count -= 1
			channels.forEach((ch) => this.#unlisten(ch, id))
			channels.length = 0
			this.#clients.delete(id)

			if (!res.writableEnded) res.end()
		}

		res.on('close', close)

		return {
			authenticate: client.authenticate.bind(client),
			message: client.message.bind(client),
			close,
			listen: (name: string) => {
				if (isClosed) return
				channels.push(name)
				this.#listen(name, id)
			},
		}
	}

	/**
	 * Send message locally to listeners
	 */
	private sendLocal(name: string, msg: EvMessage) {
		const listeners = this.#listeners.get(name)

		if (!listeners) return msg

		for (const id of listeners) {
			const client = this.#clients.get(id)

			if (!client) {
				continue
			}

			client.message({
				...msg,
				data:
					typeof msg.data === 'string'
						? { ch: name, data: msg }
						: { ch: name, ...msg.data },
			})
		}

		return msg
	}

	/**
	 * Sends message to channel (local + Redis)
	 */
	send(name: string, msg: EvMessage) {
		this.sendLocal(name, msg)

		if (this.#pubSub) {
			this.#pubSub.send({ name, message: msg })
		}
	}

	/**
	 * Subscribe client to channel
	 */
	#listen(name: string, id: string) {
		let listeners = this.#listeners.get(name)

		if (!listeners) {
			listeners = new Set()
			this.#listeners.set(name, listeners)
		}

		if (listeners.size >= this.#maxListeners) {
			throw new EvMaxListenerError(listeners.size, name)
		}

		listeners.add(id)
	}

	/**
	 * Unsubscribe client from channel
	 */
	#unlisten(name: string, id: string) {
		const listeners = this.#listeners.get(name)

		if (!listeners) return

		listeners.delete(id)

		if (listeners.size === 0) {
			this.#listeners.delete(name)
		}
	}

	/**
	 * Redis → process entry
	 */
	#onMessage(msg: Record<string, any>) {
		if (!msg?.name || !msg?.message) {
			return
		}

		this.sendLocal(msg.name, msg.message)
	}
}
