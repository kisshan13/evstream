/**
 *
 * This function takes a value which can be string or an object and returns a string for that value. If value cannot be convertable to string then it will return a empty string.
 *
 * @param val Data which needs to be serialize to JSON string format
 * @returns
 */
export function safeJsonParse(val: any) {
	if (typeof val === 'string') {
		return val
	}

	if (typeof val === 'object') {
		try {
			return JSON.stringify(val)
		} catch (error) {
			return ''
		}
	}

	return ''
}

export function uid(opts?: { prefix?: string; counter?: number }) {
	const now = Date.now().toString(36)
	const rand = Math.random().toString(26).substring(2, 10)

	return `${opts?.prefix ? `${opts?.prefix}-` : ''}${now}-${rand}-${opts?.counter}`
}
