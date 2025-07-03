# `evstream`

A simple, easy, and lightweight Server-Sent Events (SSE) library for Node.js that simplifies managing SSE connections, broadcasting events, and maintaining reactive state. It works out of the box with any backend library that supports native `IncomingMessage` and `ServerResponse` objects for IO.

## Features

- Manage multiple SSE connections with centralized control.
- Broadcast events to channels (event names).
- Built-in support for connection and listener limits.
- Optional token-based authentication per connection.
- Heartbeat support to keep connections alive.
- Reactive state management with automatic broadcasting.

## Installation

```bash
npm install evstream
```

## Usage

We used `express.js` to show you the usage. However you can use the library with any backend library or framework supporting `IncomingMessage` and `ServerResponse` objects for IO. 

### 1. Creating a base SSE Connection

```javascript
import { Evstream } from 'evstream'

app.get("/", (req, res) => {
    const stream = new Evstream(req, res, { heartbeat: 5000 })

    stream.message({ event: "connected", data: { userId: "a-user-id" } })

    setTimeout(() => {
        stream.close();
    }, 5000)
})
```

Client Recieves :
```
event:connected
data:{"userId":"a-user-id"}

event:heartbeat
data:

event:end
data:
```

### 2. Creating a SSE Connection with query based authentication

```javascript
app.get("/", async (req, res) => {
    const stream = new Evstream(req, res, {
        heartbeat: 5000, authentication: {
            method: "query",
            param: "token",
            verify: async (token) => false
        }
    })

    const isAuthenticated = await stream.authenticate();

    if (!isAuthenticated) {
        return;
    }

    stream.message({ event: "connected", data: { userId: "a-user-id" } })

    setTimeout(() => {
        stream.close();
    }, 5000)
})
```

To test this out URL should be `/?token=<auth-token>`.

You'll get the query parameter value one the callback function's parameter passed to `verify` field.
You can either return boolean values or `EvMessage`.

#### Authentication

To authenticate the incoming request there is a built-in support in `evstream`. You can verify the query based token verification which is generally not recommended.

- Options :
  - `method` : Authentication method to use (`"query"`).
  - `param` : Field or parameter in `query` which holds the authentication token.
  - `verify` : A callback function to check the token. If `false` returned req will get close.

`evstream` by default doesn't authenticate the request. You have to call the `authenticate` function from `Evstream` class to verify. If false returned you have to stop processing the request and return immediately.

```javascript
const isAuthenticated = await stream.authenticate()
```


### 3. Creating a stream manager

Using `EvStreamManager` you can broadcast messages, create channels and manage connections in a much better way.

```javascript
const manager = new EvStreamManager();

app.get("/", (req, res) => {
    const stream = manager.createStream(req, res)

    const i = setInterval(() => {
        stream.message({ data: { hello: "hii" } })
    }, 2000)

    stream.message({ data: { why: "hii" }, event: "hello" })

    setTimeout(() => {
        clearTimeout(i);
        stream.close();
    }, 10000)
})
```

### 4. Using Reactive State

Reactive states are data which you can shared across multiple clients within the same server. Whenever the data gets updated each client listening to that data get notified with an SSE message.

- #### Creating a reactive States

  ```javascript
  import { EvState, EvStreamManager } from "evstream"

  const manager = new EvStreamManager();
  const userCount = new EvState({ channel: "user-count", initialValue: 0, manager: manager })
  ```

  To create a reactive value you can use `EvState` class which takes a `channel` which is then listened by the connected client for any update.

  - `channel` : A unique name to which client will listen to for state changes.
  - `initialValue` : Default value for the state.
  - `manager` : Connection manager for the connected clients.

  **Getting the state data**

  ```javascript
  userCount.get();
  ```

  **Updating State data**

  ```javascript
  userCount.set((prev) => prev += 1);
  ```
  This will update the values and send the data to all clients which are listening for the state changes.


- #### Listening for a reactive state
  ```javascript
  import { EvState, EvStreamManager } from "evstream"


  const manager = new EvStreamManager();
  const userCount = new EvState({ channel: "user-count", initialValue: 0, manager: manager })


  app.get("/", (req, res) => {
      const stream = manager.createStream(req, res)
      stream.listen("user-count")
      userCount.set((user) => user + 1);

      const i = setInterval(() => {
          stream.message({ data: { hello: "hii" } })
      }, 2000)

      stream.message({ data: { why: "hii" }, event: "hello" })

      setTimeout(() => {
          clearTimeout(i);
          stream.close((channels) => {

              userCount.set((user) => user - 1)

              console.log(channels)
          });
      }, 10000)
  })
  ```

  This will now listen for a state change in `userCount` variables and push the update to all the connected client listening for that state.

  **See** `channel` **and the value pass to the** `listen()` **must be the same**

### 5. Sending data to a channel

To send data to a channel you can use `send()` method from `EvStreamManager` class.

Example :

```javascript
import { EvStreamManager } from "evstream"

const manager = new EvStreamManager();

manager.send("<channel-name>", {event: "custom-event", data: {"foo": "bar"}})
```

### 6. Listening for channels

To listen for data from any channel you can use `listen()` function from `Evstream` class.

```javascript
client.listen("<channel-name>")
```

## API Reference

## `Evstream`

Manages a Server-Sent Events (SSE) connection. Handles headers, heartbeat intervals, authentication, sending messages, and closing the stream.

### Constructor

```js
new Evstream(req: IncomingMessage, res: ServerResponse, opts?: EvOptions)
```

#### Parameters:

* `req`: `IncomingMessage` – The incoming HTTP request.
* `res`: `ServerResponse` – The HTTP response to write SSE messages to.
* `opts` *(optional)*: `EvOptions` – Optional configuration including heartbeat interval and authentication.

---

### Methods

#### `authenticate(): Promise<boolean | undefined>`

Performs optional token-based authentication if `opts.authentication` is provided.

* If authentication fails, sends an error message and closes the connection.
* Returns `true` if authenticated, `false` if rejected, or `undefined` if no authentication is configured.

---

#### `message(msg: EvMessage): void`

Sends an SSE message to the connected client.

##### Parameters:

* `msg`: `EvMessage` – Object containing `event`, `data`, and optionally `id`.

---

#### `close(): void`

Sends a final `end` event and closes the SSE connection.

---

### Example

```js
const ev = new Evstream(req, res, {
  heartbeat: 30000,
  authentication: {
    param: 'token',
    verify: async (token) => token === 'valid_token'
  }
})

await ev.authenticate()
ev.message({ event: 'message', data: { text: 'Hello world' }, id: '1' })
ev.close()
```

---

## `EvStreamManager`

Manages multiple Server-Sent Events (SSE) client streams. Supports connection tracking, message broadcasting, and channel-based listeners.

### Constructor

```js
new EvStreamManager(opts?: EvManagerOptions)
```

#### Parameters:

* `opts` *(optional)*: `EvManagerOptions`

  * `maxConnection`: Maximum allowed active connections (default: `5000`)
  * `maxListeners`: Maximum listeners per channel (default: `5000`)
  * `id`: Optional prefix for client IDs

---

### Methods

#### `createStream(req: IncomingMessage, res: ServerResponse, opts?: EvOptions): { authenticate, message, close, listen }`

Creates and tracks a new SSE stream.

#### Parameters:

* `req`: `IncomingMessage` – Incoming HTTP request
* `res`: `ServerResponse` – HTTP response for the SSE connection
* `opts` *(optional)*: `EvOptions` – Optional stream config (heartbeat, authentication, etc.)

#### Returns:

An object with methods:

* `authenticate(): Promise<boolean | undefined>` – Authenticates the stream (delegates to `Evstream`)
* `message(msg: EvMessage): void` – Sends a message to the stream
* `close(onClose?: EvOnClose): void` – Closes the stream and cleans up listeners
* `listen(name: string): void` – Subscribes the stream to a named channel

---

#### `send(name: string, msg: EvMessage): void`

Broadcasts a message to all clients listening on the specified `name` (channel).

##### Parameters:

* `name`: `string` – Channel name
* `msg`: `EvMessage` – The message to broadcast

---

### Private Methods

#### `#listen(name: string, id: string): void`

Adds a client (by ID) to a named channel. Throws `EvMaxListenerError` if channel exceeds max listeners.

---

#### `#unlisten(name: string, id: string): void`

Removes a client from a channel. Deletes the channel if no listeners remain.

---

### Example

```js
const manager = new EvStreamManager()

const stream = manager.createStream(req, res)

await stream.authenticate()
stream.listen('news')
stream.message({ event: 'hello', data: 'welcome' })

manager.send('news', { event: 'news', data: 'breaking update' })
```

## `EvState<T>`

Reactive state holder that broadcasts updates to a specified channel via an `EvStreamManager`. Designed for real-time state syncing over Server-Sent Events (SSE).

### Constructor

```ts
new EvState<T>({
  channel,
  initialValue,
  manager,
  key
}: EvStateOptions<T>)
```

#### Parameters:

* `channel`: `string` – The name of the channel to broadcast updates to.
* `initialValue`: `T` – The initial state value.
* `manager`: `EvStreamManager` – The SSE manager instance used for broadcasting.
* `key` *(optional)*: `string` – The key used in the broadcasted data object (default: `'value'`).

---

### Methods

#### `get(): T`

Returns the current value of the state.

---

#### `set(callback: (val: T) => T): void`

Updates the internal state based on a callback function. If the new value is different (deep comparison), it broadcasts the updated value to the channel.

##### Parameters:

* `callback`: `(val: T) => T` – A function that receives the current state and returns the new state.

---

### Example

```ts
const state = new EvState({
  channel: 'counter',
  initialValue: 0,
  manager: evManager,
  key: 'count'
})

state.set(prev => prev + 1)
// Will broadcast: { event: 'counter', data: { count: 1 } }

const current = state.get()
// current === 1
```

---

## `EvMaxConnectionsError`

Represents an error thrown when the number of active SSE connections exceeds the allowed `maxConnection` limit (default: `5000`).

### Constructor

```ts
new EvMaxConnectionsError(connections: number)
```

#### Parameters:

- `connections`: `number` – The current number of active connections when the limit is exceeded.

#### Example

```ts
const manager = new EvStreamManager({ maxConnection: 100 });
if (tooManyConnections) {
  throw new EvMaxConnectionsError(100)
}
```

---

## `EvMaxListenerError`

Represents an error thrown when the number of listeners on a given channel exceeds the allowed `maxListeners` limit (default: `5000`).

### Constructor

```ts
new EvMaxListenerError(listeners: number, channel: string)
```

#### Parameters:

- `listeners`: `number` – The current number of listeners on the channel.
- `channel`: `string` – The name of the channel that exceeded the listener limit.

#### Example

```ts
if (tooManyListenersOnChannel) {
  throw new EvMaxListenerError(5000, 'news')
}
```

---

## Type Definitions

---

### `EvEventsType`

```ts
type EvEventsType = 'data' | 'error' | 'end'
```

Represents built-in event types commonly used in Server-Sent Events.

---

### `EvMessage`

```ts
interface EvMessage {
  event?: string | EvEventsType
  data: string | object
  id?: string
}
```

Represents a message sent to the client via SSE.

- `event` *(optional)*: Name of the event.
- `data`: The payload to send. Can be a string or an object.
- `id` *(optional)*: Event ID for reconnection tracking.

---

### `EvAuthenticationOptions`

```ts
interface EvAuthenticationOptions {
  method: 'query'
  param: string
  verify: (token: string) => Promise<EvMessage> | undefined | null | boolean
}
```

Options for enabling query-based token authentication.

- `method`: Always `'query'`
- `param`: Name of the query parameter containing the token.
- `verify`: Async verification function. Can return:
  - `true` (authenticated)
  - `false` (rejected)
  - `EvMessage` (custom response)
  - `undefined` / `null` (unauthenticated)

---

### `EvOptions`

```ts
interface EvOptions {
  authentication?: EvAuthenticationOptions
  heartbeat?: number
}
```

Optional config for an individual SSE stream.

- `authentication`: Auth configuration (see `EvAuthenticationOptions`)
- `heartbeat`: Interval in milliseconds for sending heartbeat events

---

### `EvManagerOptions`

```ts
interface EvManagerOptions {
  id?: string
  maxConnection?: number
  maxListeners?: number
}
```

Configuration for `EvStreamManager`.

- `id`: Optional prefix for client IDs
- `maxConnection`: Max allowed connections (default: `5000`)
- `maxListeners`: Max listeners per channel (default: `5000`)

---

### `EvStateOptions<T>`

```ts
interface EvStateOptions<T> {
  initialValue: T
  channel: string
  manager: EvStreamManager
  key?: string
}
```

Options for initializing a reactive state with `EvState`.

- `initialValue`: Initial state value
- `channel`: Channel name for broadcasting
- `manager`: Instance of `EvStreamManager`
- `key` *(optional)*: Key for wrapping state in the broadcast (default: `'value'`)

---

### `EvOnClose`

```ts
type EvOnClose = (channels: string[]) => Promise<void>
```

Callback triggered when a client connection is closed. Receives a list of channels the client was subscribed to.

---

## 🤝 Contribution

Contributions are welcome! Whether it's a bug fix, feature request, or improvement to documentation, your help is appreciated.

### How to Contribute:

1. **Fork** the repository.
2. **Create a branch** for your feature or fix:

   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Commit your changes** with a clear message.
4. **Push to your fork**:

   ```bash
   git push origin feature/your-feature-name
   ```
5. **Open a Pull Request** and describe your changes.

### Guidelines:

* Keep your code clean and consistent with the project's existing style.
* Include relevant tests and documentation updates.
* Make sure the project builds and passes all existing checks.

---

## 📄 License

This project is licensed under the **MIT License**.

You are free to use, modify, distribute, and sublicense this software for both personal and commercial use — provided that the original license and copyright notice are included in all copies.

> See the [LICENSE](./LICENSE) file for full details.

---
