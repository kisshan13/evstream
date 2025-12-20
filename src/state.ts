import loadash from 'lodash'

import { EvStreamManager } from './manager.js'
import { EvStateAdapter, EvStateOptions } from './types.js'

const { isEqual } = loadash

type EvSetState<T> = (val: T) => T

/**
 * EvState holds a reactive state and broadcasts updates to a channel using EvStreamManager.
 */
export class EvState<T> {
    #value: T
    #channel: string
    #manager: EvStreamManager
    #key: string
    #adapter?: EvStateAdapter

    constructor({ channel, initialValue, manager, key, adapter }: EvStateOptions<T>) {
        this.#value = initialValue
        this.#channel = channel
        this.#manager = manager
        this.#key = key || 'value'
        this.#adapter = adapter

        if (this.#adapter) {
            this.#adapter.subscribe(this.#channel, (data) => {
                this.#handleRemoteUpdate(data)
            })
        }
    }

    #handleRemoteUpdate(data: any) {
        if (data && typeof data === 'object' && this.#key in data) {
            const newValue = data[this.#key]

            if (!isEqual(newValue, this.#value)) {
                this.#value = newValue
                this.#manager.send(this.#channel, {
                    event: this.#channel,
                    data: {
                        [this.#key]: newValue,
                    },
                })
            }
        }
    }

    /**
     * Returns the current state value.
     */
    get() {
        return this.#value
    }

    /**
     * Updates the state using a callback.
     * Broadcasts the new value if it has changed.
     */
    set(callback: EvSetState<T>) {
        const newValue = callback(this.#value)

        if (!isEqual(newValue, this.#value)) {
            this.#value = newValue
            this.#manager.send(this.#channel, {
                event: this.#channel,
                data: {
                    [this.#key]: newValue,
                },
            })

            if (this.#adapter) {
                this.#adapter.publish(this.#channel, { [this.#key]: newValue })
            }
        }
    }
}
