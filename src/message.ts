import { EvMessage } from './types.js'
import { safeJsonParse } from './utils.js'

/**
 *
 * This function convert the data to event stream compatible format.
 *
 * @param msg Message which you want to send to the client.
 */
export function message(msg: EvMessage) {
    const event = `event:${msg.event || 'message'}\n`
    const data = `data:${safeJsonParse(msg.data)}\n`

    if (data === '') {
        return `${msg.id ? `id:${msg.id}\n` : ''}${event}\n`
    }

    return `${msg.id ? `id:${msg.id}\n` : ''}${event}${data}\n`
}
