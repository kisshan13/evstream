import Redis, { RedisOptions } from 'ioredis'

import { EvStateAdapter } from '../types.js'

export class EvRedisAdapter implements EvStateAdapter {
	#pub: Redis
	#sub: Redis
	#listeners: Map<string, Set<(msg: any) => void>>

	constructor(options?: RedisOptions) {
		this.#pub = new Redis(options)
		this.#sub = new Redis(options)
		this.#listeners = new Map()

		this.#sub.on('message', (channel, message) => {
			const handlers = this.#listeners.get(channel)
			if (handlers) {
				let parsed: any
				try {
					parsed = JSON.parse(message)
				} catch {
					return
				}
				handlers.forEach((handler) => handler(parsed))
			}
		})
	}

	async publish(channel: string, message: any): Promise<void> {
		await this.#pub.publish(channel, JSON.stringify(message))
	}

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

	async unsubscribe(channel: string): Promise<void> {
		await this.#sub.unsubscribe(channel)
		this.#listeners.delete(channel)
	}

	quit() {
		this.#pub.quit()
		this.#sub.quit()
	}
}
