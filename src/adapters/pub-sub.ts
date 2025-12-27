import Redis, { RedisOptions } from 'ioredis'
import { uid } from '../utils.js'

/**
 * Configuration options for EvRedisPubSub
 */
interface EvRedisPubSubOptions<T> {
	/** Redis Pub/Sub channel name */
	subject: string

	/** Redis connection options */
	options: RedisOptions

	/** Optional initial message handler */
	onMessage?: (message: T) => void
}

/**
 * Redis-based Pub/Sub helper for cross-process communication.
 *
 * - Uses separate publisher and subscriber connections
 * - Prevents self-message delivery using instance UID
 * - Typed message payload via generics
 */
export class EvRedisPubSub<T = unknown> {
	#subject: string
	#pub: Redis
	#sub: Redis
	#instanceId: string
	#onMessage?: (message: T) => void

	constructor({ options, subject, onMessage }: EvRedisPubSubOptions<T>) {
		this.#pub = new Redis(options)
		this.#sub = new Redis(options)
		this.#subject = subject
		this.#onMessage = onMessage
		this.#instanceId = uid({ prefix: subject, counter: Math.random() })

		this.init()
	}

	/**
	 * Initializes Redis subscriptions and listeners.
	 */
	private async init() {
		this.#pub.on('error', () => {})
		this.#sub.on('error', () => {})

		await this.#sub.subscribe(this.#subject)

		this.#sub.on('message', (_, raw) => {
			try {
				const data = JSON.parse(raw)

				// Ignore messages from the same instance
				if (data?.uid !== this.#instanceId) {
					this.#onMessage?.(data.msg as T)
				}
			} catch {
				// Ignore malformed payloads
			}
		})
	}

	/**
	 * Publishes a message to the Redis channel.
	 */
	async send(msg: T) {
		await this.#pub.publish(
			this.#subject,
			JSON.stringify({ uid: this.#instanceId, msg })
		)
	}

	/**
	 * Registers or replaces the message handler.
	 */
	onMessage(callback: (msg: T) => void) {
		this.#onMessage = callback
	}

	/**
	 * Gracefully closes Redis connections.
	 */
	async close() {
		await Promise.all([this.#pub.quit(), this.#sub.quit()])
	}
}
