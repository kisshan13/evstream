import type { EvStreamManager } from './manager.js'

// Built-in event types.
export type EvEventsType = 'data' | 'error' | 'end'

// Represents a message sent to the client over SSE.
export interface EvMessage {
    // Optional event name.
    event?: string | EvEventsType
    // Data to send; can be a string or object.
    data: string | object
    // Optional ID of the event.
    id?: string
}

// Options for token-based authentication from query parameters.
export interface EvAuthenticationOptions {
    method: 'query'
    param: string
    verify: (token: string) => Promise<EvMessage> | undefined | null | boolean
}

// Options for configuring a single SSE stream.
export interface EvOptions {
    authentication?: EvAuthenticationOptions
    heartbeat?: number
}

// Configuration options for EvStreamManager.
export interface EvManagerOptions {
    // Unique ID for the manager
    id?: string

    // Max Connection which a manager can handle. If this limit exceeds it throws `EvMaxConnectionsError`
    maxConnection?: number

    // Max Listeners which a listener can broadcast a message to. If this limit exceeds it throw `EvMaxListenerError`
    maxListeners?: number
}

// Options for initializing EvState.
export interface EvStateAdapter {
    publish(channel: string, message: any): Promise<void>
    subscribe(channel: string, onMessage: (message: any) => void): Promise<void>
    unsubscribe(channel: string): Promise<void>
}

export interface EvStateOptions<T> {
    initialValue: T
    channel: string
    manager: EvStreamManager
    key?: string
    adapter?: EvStateAdapter
}

export type EvOnClose = (channels: string[]) => Promise<void>
