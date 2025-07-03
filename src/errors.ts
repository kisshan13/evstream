/**
 * `EvMaxConnectionsError` represents a error which occurs when `maxConnection` reached. Default `maxConnection` is 5000. 
 * 
 * To change connection limit you can set `maxConnection` while initializing `new EvStreamManager();`
 */
export class EvMaxConnectionsError extends Error {
    constructor(connections: number) {
        super()
        this.message = `Max number of connected client reached. Total Connection : ${connections}`
        this.name = `EvMaxConnectionsError`
    }
}

/**
 * `EvMaxListenerError` represents a error which occurs when `maxListeners` reached. Default `maxListeners` is 5000. 
 * 
 * To change listeners limit you can set `maxListeners` while initializing `new EvStreamManager();`
 */
export class EvMaxListenerError extends Error {
    constructor(listeners: number, channel: string) {
        super()
        this.message = `Max number of listeners for the channle ${channel} reached (Listener: ${listeners}).`
        this.name = `EvMaxListenerError`
    }
}
