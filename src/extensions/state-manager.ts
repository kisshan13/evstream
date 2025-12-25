import type { EvStreamManager } from '../manager.js'
import type { EvRedisAdapter } from '../adapters/redis.js'
import type EvRedisPubSub from '../adapters/pub-sub.js'
import { EvState } from '../state.js'
import { stat } from 'fs'

type SharedState = Map<string, EvState<any>>

type StateMap<S> = {
	[K in keyof S]: EvState<S[K]>
}

interface EvStateManagerOptions {
	manager: EvStreamManager
	adapter?: EvRedisAdapter
	pubsub?: EvRedisPubSub
}

class EvStateManager<S extends Record<string, any>> {
	#states = new Map<keyof S, EvState<any>>()
	#manager: EvStreamManager
	#adapter?: EvRedisAdapter
	#pubsub?: EvRedisPubSub

	constructor({ manager, adapter, pubsub }: EvStateManagerOptions) {
		this.#manager = manager
		this.#adapter = adapter
		this.#pubsub = pubsub

		if (this.#pubsub) {
			this.#pubsub.onMessage(this.pubSubcallback)
		}
	}

	createState<K extends keyof S>(key: K, initialValue: S[K]): EvState<S[K]> {
		if (this.#states.has(key)) {
			return this.#states.get(key)! as EvState<S[K]>
		}

		const state = new EvState<S[K]>({
			channel: String(key),
			initialValue,
			manager: this.#manager,
			adapter: this.#adapter,
		})

		this.#states.set(key, state)

		if (this.#pubsub) {
			this.#pubsub.send({
				type: 'create',
				channel: key,
				initialValue: initialValue,
			})
		}

		return state
	}

	getState<K extends keyof S>(key: K): EvState<S[K]> | undefined {
		return this.#states.get(key) as EvState<S[K]> | undefined
	}

	hasState<K extends keyof S>(key: K): boolean {
		return this.#states.has(key)
	}

	removeState(key: string) {
		this.#states.delete(key)

		if (this.#pubsub) {
			this.#pubsub.send({
				type: 'remove',
				channel: key,
			})
		}
	}

	private pubSubcallback(msg: Object) {}
}
