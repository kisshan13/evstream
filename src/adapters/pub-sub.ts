import Redis, { RedisOptions } from 'ioredis'
import { uid } from '../utils.js'

interface EvRedisPubSubOptions {
	subject?: string
	options: RedisOptions
	onMessage?: (message: Object) => void
}

class EvRedisPubSub {
	#options: RedisOptions
	#subject: string
	#pub: Redis
	#sub: Redis
	#instanceId: string
	#onMessage?: (message: Object) => void

	constructor({ options, subject, onMessage }: EvRedisPubSubOptions) {
		this.#pub = new Redis(options)
		this.#sub = new Redis(options)
		this.#onMessage = onMessage
		this.#instanceId = uid({ prefix: subject, counter: Math.random() })
		this.#subject = uid({ prefix: subject, counter: subject?.length || 0 })

		this.init()
	}

	private async init() {
		this.#pub.on('error', (err) => {})

		this.#sub.on('error', (err) => {})

		await this.#sub.subscribe(this.#subject)

		this.#sub.on('message', (_, raw) => {
			try {
				const msg = JSON.parse(raw)
				if (msg?.uid !== this.#instanceId) {
					this.#onMessage(msg?.msg)
				}
			} catch {}
		})
	}

	async send(msg: Object) {
		await this.#pub.publish(
			this.#subject,
			JSON.stringify({ uid: this.#instanceId, msg })
		)
	}

	onMessage(callback: (msg: Object) => void) {
		this.#onMessage = callback
	}
}

export default EvRedisPubSub
