import { IncomingMessage, ServerResponse } from 'http'
import { EvMessage, EvOptions } from './types.js'
import { message } from './message.js'

/**
 * Evstream manages a Server-Sent Events (SSE) connection.
 * Sets necessary headers, handles heartbeat, authentication, sending messages, and closing the stream.
 * Example :
 *
 * ```javascript
 * const ev = new Evstream(req, res);
 *
 * ev.message({event: "message", data: {message: "a message"}, id: "event_id_1"})
 * ```
 */
export class Evstream {
    #res: ServerResponse
    #opts?: EvOptions
    #url: URL
    constructor(req: IncomingMessage, res: ServerResponse, opts?: EvOptions) {
        this.#res = res
        this.#opts = opts
        this.#url = new URL(req.url!, `http://${req.headers.host}`)

        this.#res.setHeader('Content-Type', 'text/event-stream')
        this.#res.setHeader('Cache-Control', 'no-cache')
        this.#res.setHeader('Connection', 'keep-alive')
        this.#res.flushHeaders()

        if (opts?.heartbeat) {
            const timeout = setInterval(() => {
                this.#res.write(message({ event: 'heartbeat', data: '' }))
            }, this.#opts.heartbeat)

            this.#res.on('close', () => {
                clearTimeout(timeout)
            })
        }
    }

    /**
     * Handles optional authentication using provided token verification.
     * Sends error message and closes connection if authentication fails.
     */
    async authenticate() {
        if (this.#opts.authentication) {
            const token = this.#url.searchParams.get(
                this.#opts.authentication.param,
            )

            const isAuthenticated =
                await this.#opts.authentication.verify(token)

            if (typeof isAuthenticated === 'boolean') {
                if (!isAuthenticated) {
                    this.message({
                        data: { message: 'authentication failed' },
                        event: 'error',
                    })
                    this.#res.end()
                    return false
                }

                return true
            }

            if (typeof isAuthenticated === 'object') {
                this.message(isAuthenticated)
                return true
            }

            return false
        }
    }

    /**
     * Sends an SSE message to the client.
     * Accepts an `EvMessage` object.
     */
    message(msg: EvMessage) {
        this.#res.write(message(msg))
    }

    /**
     * Sends an "end" event and closes the SSE connection.
     */
    close() {
        this.message({
            event: 'end',
            data: '',
        })

        this.#res.end()
    }
}
