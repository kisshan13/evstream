import Redis, { RedisOptions } from 'ioredis'
import { EvRedisPubSub } from './pub-sub.js'
import { EvStateAdapter } from '../types.js'
import { uid } from '../utils.js'

/**
 * Redis-based implementation of {@link EvStateAdapter}.
 *
 * This adapter enables distributed state updates using Redis Pub/Sub.
 * It supports:
 * - Channel-based subscriptions
 * - Multiple listeners per channel
 * - Self-message filtering via instance ID
 *
 * Designed to be used by EvState / EvStateManager for
 * cross-process state synchronization.
 */
class EvRedisAdapter implements EvStateAdapter {
	/** Publisher Redis client */
	#pub: Redis

	/** Subscriber Redis client */
	#sub: Redis

	/**
	 * Channel → listeners mapping.
	 * Each channel may have multiple local handlers.
	 */
	#listeners: Map<string, Set<(msg: any) => void>>

	/** Unique identifier for this adapter instance */
	#instanceId: string

	/**
	 * Creates a new Redis state adapter.
	 *
	 * @param options - Optional Redis connection options
	 */
	constructor(options?: RedisOptions) {
		this.#pub = new Redis(options)
		this.#sub = new Redis(options)
		this.#listeners = new Map()
		this.#instanceId = uid({ counter: Math.ceil(Math.random() * 100) })

		this.#sub.on('message', (channel, message) => {
			const handlers = this.#listeners.get(channel)
			if (!handlers) return

			let parsed: any
			try {
				parsed = JSON.parse(message)
			} catch {
				// Ignore malformed payloads
				return
			}

			// Ignore messages published by this instance
			if (parsed?.id === this.#instanceId) return

			handlers.forEach((handler) => handler(parsed?.message))
		})
	}

	/**
	 * Publishes a message to a Redis channel.
	 *
	 * The payload is wrapped with the instance ID to
	 * prevent self-delivery.
	 *
	 * @param channel - Redis channel name
	 * @param message - Message payload
	 */
	async publish(channel: string, message: any): Promise<void> {
		await this.#pub.publish(
			channel,
			JSON.stringify({ id: this.#instanceId, message })
		)
	}

	/**
	 * Subscribes to a Redis channel.
	 *
	 * Multiple listeners can be registered per channel.
	 * The Redis subscription is created only once per channel.
	 *
	 * @param channel - Redis channel name
	 * @param onMessage - Callback invoked on incoming messages
	 */
	async subscribe(
		channel: string,
		onMessage: (message: any) => void
	): Promise<void> {
		if (!this.#listeners.has(channel)) {
			this.#listeners.set(channel, new Set())
			await this.#sub.subscribe(channel)
		}

		this.#listeners.get(channel)!.add(onMessage)
	}

	/**
	 * Unsubscribes from a Redis channel and removes all listeners.
	 *
	 * @param channel - Redis channel name
	 */
	async unsubscribe(channel: string): Promise<void> {
		await this.#sub.unsubscribe(channel)
		this.#listeners.delete(channel)
	}

	/**
	 * Gracefully closes Redis connections.
	 */
	quit() {
		this.#pub.quit()
		this.#sub.quit()
	}
}

export { EvRedisPubSub, EvRedisAdapter }
