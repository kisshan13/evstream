import loadash from 'lodash'

import { EvStreamManager } from './manager.js'
import { EvStateOptions } from './types.js'

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
    constructor({ channel, initialValue, manager, key }: EvStateOptions<T>) {
        this.#value = initialValue
        this.#channel = channel
        this.#manager = manager
        this.#key = key || 'value'
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
        }
    }
}
