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

- `authentication` : You can pass authentication options to verify the incoming request.

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

### 4. Using Reactive Values

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

## API Reference

### `Evstream`

#### Constructor

```ts
new Evstream(req: IncomingMessage, res: ServerResponse, options?: EvstreamOptions)
```

* `req`: Incoming HTTP request.
* `res`: HTTP response to send SSE data.
* `options` (optional):

  * `heartbeat` (number): Interval in ms to send heartbeat events. Default: `0` (no heartbeat).
  * `authentication` (object): Authentication options.

    * `method` (string): `"query"` | `"header"`.
    * `param` (string): Query param or header name for the token.
    * `verify` (function): Async function to verify token. Returns `true` or `false`.

#### Methods

* `message(event: { event?: string; data: any; id?: string }): void`
  Send an SSE message to the client. If `event` is omitted, the message will be sent as a simple data event.

* `close() => void): void`
  Close the SSE connection.

* `authenticate(): Promise<boolean>`
  Runs the authentication verification if options are provided.

---

### `EvStreamManager`

#### Constructor

```ts
new EvStreamManager(options?: ManagerOptions)
```

* `options` (optional): Global options for managing streams, like connection limits.

#### Methods

* `createStream(req: IncomingMessage, res: ServerResponse): Evstream`
  Creates and registers a new SSE stream for the given request and response.

* `broadcast(event: string, data: any): void`
  Sends an event with data to all streams subscribed to that event.

* `broadcastToChannel(channel: string, data: any): void`
  Sends data to all streams listening on a specific channel.

* `closeAll(): void`
  Closes all open SSE connections.

---

### `EvState`

Reactive state manager connected to a specific channel.

#### Constructor

```ts
new EvState<T>({ channel: string; initialValue: T; manager: EvStreamManager })
```

* `channel`: The channel name this state belongs to.
* `initialValue`: The initial value of the reactive state.
* `manager`: Instance of `EvStreamManager` to broadcast state updates.

#### Methods

* `get(): T`
  Returns the current value.

* `set(value: T | ((prev: T) => T)): void`
  Sets a new value. Can accept a new value directly or a callback to update based on previous state.

---

## Advanced Usage

### 1. Limiting Connections and Listeners

```js
const manager = new EvStreamManager({
  maxConnections: 100,
  maxListeners: 10
});
```

This prevents your server from being overwhelmed by limiting simultaneous connections and the number of event subscriptions per connection.

### 2. Query-based Authentication

```js
app.get("/stream", async (req, res) => {
  const stream = new Evstream(req, res, {
    authentication: {
      method: "query",
      param: "token",
      verify: async (token) => {
        // Verify token, e.g., JWT verification
        return token === "my-secret-token";
      }
    }
  });

  const authenticated = await stream.authenticate();

  if (!authenticated) {
    return;
  }

  stream.message({ event: "connected", data: { userId: "header-user" } });
});
```

### 3. Cleaning Up on Client Disconnect

```js
const stream = manager.createStream(req, res);

stream.close();
```

---

## Error Handling

* Always handle the case where authentication fails by closing the connection or returning an HTTP 401.
* Wrap your SSE logic in try-catch to handle unexpected errors gracefully.
* Avoid sending large payloads in SSE messages to prevent buffering issues.
* Use `heartbeat` to keep connections alive and detect dead clients.

