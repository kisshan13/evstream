import type { EvStreamManager } from '../manager.js'
import type { EvRedisAdapter } from '../adapters/redis.js'
import type { EvRedisPubSub } from '../adapters/pub-sub.js'
import { EvState } from '../state.js'

/**
 * Options for creating an {@link EvStateManager}.
 */
interface EvStateManagerOptions {
	/**
	 * Stream manager responsible for managing client connections
	 * and broadcasting state updates.
	 */
	manager: EvStreamManager

	/**
	 * Optional distributed state adapter (e.g. Redis).
	 * Enables cross-process state propagation.
	 */
	adapter?: EvRedisAdapter

	/**
	 * Optional Pub/Sub instance used to synchronize
	 * state creation and removal across instances.
	 */
	pubsub?: EvRedisPubSub
}

/**
 * Manages a collection of named {@link EvState} instances.
 *
 * Responsibilities:
 * - Create and cache state objects locally
 * - Synchronize state lifecycle (create/remove) across processes
 * - Bridge EvState with stream manager and adapters
 *
 * Internally, all state keys are converted to strings to remain
 * Redis-safe and transport-friendly.
 *
 * @typeParam S - Mapping of state keys to their value types
 */
export class EvStateManager<S extends Record<string, any>> {
	/**
	 * Internal state registry.
	 * Keyed by string channel name.
	 */
	#states = new Map<string, EvState<any>>()

	/** Stream manager used by all states */
	#manager: EvStreamManager

	/** Optional distributed adapter */
	#adapter?: EvRedisAdapter

	/** Optional Pub/Sub synchronizer */
	#pubsub?: EvRedisPubSub

	/**
	 * Creates a new state manager.
	 *
	 * @param options - Initialization options
	 */
	constructor({ manager, adapter, pubsub }: EvStateManagerOptions) {
		this.#manager = manager
		this.#adapter = adapter
		this.#pubsub = pubsub

		this.pubSubCallback = this.pubSubCallback.bind(this)

		if (this.#pubsub) {
			this.#pubsub.onMessage(this.pubSubCallback)
		}
	}

	/**
	 * Creates a state locally without emitting Pub/Sub events.
	 *
	 * @param channel - State channel name
	 * @param initialValue - Initial state value
	 */
	private createLocalState(channel: string, initialValue: any): EvState<any> {
		const state = new EvState({
			channel,
			initialValue,
			manager: this.#manager,
			adapter: this.#adapter,
		})

		this.#states.set(channel, state)
		return state
	}

	/**
	 * Removes a state locally without emitting Pub/Sub events.
	 *
	 * @param channel - State channel name
	 */
	private removeLocalState(channel: string) {
		this.#states.delete(channel)
	}

	/**
	 * Creates or returns an existing state.
	 *
	 * If Pub/Sub is enabled, the creation is broadcast
	 * to other instances.
	 *
	 * @param key - State key
	 * @param initialValue - Initial state value
	 */
	createState<K extends keyof S>(key: K, initialValue: S[K]): EvState<S[K]> {
		const channel = String(key)

		if (this.#states.has(channel)) {
			return this.#states.get(channel)! as EvState<S[K]>
		}

		const state = this.createLocalState(channel, initialValue)

		this.#pubsub?.send({
			type: 'create',
			channel,
			initialValue,
		})

		return state as EvState<S[K]>
	}

	/**
	 * Retrieves an existing state.
	 *
	 * @param key - State key
	 */
	getState<K extends keyof S>(key: K): EvState<S[K]> | undefined {
		return this.#states.get(String(key)) as EvState<S[K]> | undefined
	}

	/**
	 * Checks whether a state exists.
	 *
	 * @param key - State key
	 */
	hasState<K extends keyof S>(key: K): boolean {
		return this.#states.has(String(key))
	}

	/**
	 * Removes a state locally and propagates the removal
	 * to other instances via Pub/Sub.
	 *
	 * @param key - State key
	 */
	removeState<K extends keyof S>(key: K) {
		const channel = String(key)

		this.removeLocalState(channel)

		this.#pubsub?.send({
			type: 'remove',
			channel,
		})
	}

	/**
	 * Handles incoming Pub/Sub lifecycle events.
	 *
	 * @param msg - Pub/Sub message payload
	 */
	private pubSubCallback(msg: any) {
		if (!msg || typeof msg.channel !== 'string') return

		switch (msg.type) {
			case 'create': {
				if (!this.#states.has(msg.channel)) {
					this.createLocalState(msg.channel, msg.initialValue)
				}
				break
			}

			case 'remove': {
				this.removeLocalState(msg.channel)
				break
			}
		}
	}
}
