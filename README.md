# @zjunaidz/rate-limiter

High‑performance, Redis‑backed token bucket rate limiter implemented with a Lua script and a tiny TypeScript API. Ships with a simple core class and optional Hono middleware for ergonomic HTTP rate limiting.

---

## Features

- Token bucket algorithm implemented fully in Redis via Lua
- Single round‑trip `EVALSHA` call per request
- Precise refill based on wall‑clock time (`Date.now()`)
- Simple, framework‑agnostic `RateLimiter` class
- Optional Hono middleware export for HTTP APIs
- TypeScript types and modern ESM build

---

## Installation

```bash
npm install @zjunaidz/rate-limiter ioredis
# or
pnpm add @zjunaidz/rate-limiter ioredis
# or
yarn add @zjunaidz/rate-limiter ioredis
```

Peer dependency:

- TypeScript `^5` (if you are using TypeScript)

You also need access to a Redis instance (e.g. local Redis, Docker, or a managed Redis service).

---

## Core API

### RateLimiter

```ts
import Redis from "ioredis";
import { RateLimiter } from "@zjunaidz/rate-limiter";

const redis = new Redis({
	host: "127.0.0.1",
	port: 6379,
});

const limiter = new RateLimiter({
	redis,
	maxRequests: 100, // bucket size (max tokens)
	windowSizeInSeconds: 60, // refill window
});

await limiter.init(); // load Lua script into Redis

const allowed = await limiter.isAllowed("user:123");
if (!allowed) {
	// deny request, e.g. return 429
}
```

#### Constructor options

```ts
type RateLimiterOptions = {
	redis: Redis;              // ioredis client instance
	maxRequests: number;       // bucket capacity (max tokens)
	windowSizeInSeconds: number; // time window used for refill rate
};
```

- `maxRequests` – Maximum number of requests allowed within a moving window.
- `windowSizeInSeconds` – Controls how fast tokens are refilled. Internally the Lua script calculates a refill rate of `maxRequests / windowSizeInSeconds` tokens per second.

#### Methods

- `async init(): Promise<void>`
	- Loads the Lua token bucket script into Redis using `SCRIPT LOAD` and stores the resulting SHA.
	- **Must be called once before using `isAllowed`**.

- `async isAllowed(key: string): Promise<boolean>`
	- Consumes one token for the given `key` (e.g. user id, IP, API key).
	- Returns `true` if a token was available (request should be allowed), otherwise `false`.
	- Throws an error if `init()` has not been called.

---

## Hono Integration

This package exposes a Hono‑specific helper under the `./hono` sub‑path.

```ts
import { Hono } from "hono";
import Redis from "ioredis";
import { RateLimiter } from "@zjunaidz/rate-limiter";
import { honoRateLimit } from "@zjunaidz/rate-limiter/hono";

const app = new Hono();

const redis = new Redis();

const limiter = new RateLimiter({
	redis,
	maxRequests: 60,
	windowSizeInSeconds: 60,
});

await limiter.init();

app.use(
	"*",
	honoRateLimit(limiter, {
		// derive a key from the request context
		key: (c) => c.req.header("x-api-key") ?? c.req.header("x-forwarded-for") ?? "anonymous",
	})
);

app.get("/", (c) => c.text("Hello, world!"));
```

### honoRateLimit

Signature:

```ts
type HonoRateLimitOptions = {
	key: (c: any) => string;
};

declare function honoRateLimit(
	limiter: RateLimiter,
	opts: HonoRateLimitOptions
): MiddlewareHandler;
```

Behavior:

- Computes a key from the Hono context via `opts.key(c)`.
- Calls `limiter.isAllowed(key)`.
- If not allowed, returns a JSON response `{ error: "Too Many Requests" }` with status `429` and **does not** call `next()`.
- If allowed, continues to the next middleware/handler.

---

## How It Works (Token Bucket)

Internally the rate limiting logic lives entirely inside Redis using a Lua script. For each `key` the script stores:

- `tokens` – current number of tokens remaining in the bucket
- `last_refill` – timestamp (ms) when the bucket was last updated

On each check:

1. The script reads the current bucket values.
2. It computes elapsed time since `last_refill`.
3. It refills tokens based on elapsed seconds and the configured refill rate.
4. It caps tokens at `maxRequests`.
5. If at least one token is available, it decrements the bucket and returns `1` (allowed), otherwise returns `0` (blocked).

Because all of this happens server‑side in Redis, the operation is atomic and requires only one network round‑trip.

---

## Example: Per‑IP Limiting

```ts
import Redis from "ioredis";
import { RateLimiter } from "@zjunaidz/rate-limiter";

const redis = new Redis();

const limiter = new RateLimiter({
	redis,
	maxRequests: 100,
	windowSizeInSeconds: 60,
});

await limiter.init();

async function handleRequest(ip: string) {
	const allowed = await limiter.isAllowed(`ip:${ip}`);

	if (!allowed) {
		return { status: 429, body: "Too Many Requests" };
	}

	return { status: 200, body: "OK" };
}
```

---

## Configuration Tips

- **Short‑burst limiting** – Use a larger `maxRequests` with a larger `windowSizeInSeconds` to allow bursts but still cap average rate.
- **Strict per‑window limiting** – Use a smaller `windowSizeInSeconds` for a tighter cap.
- **Key design** – Include user ids, API keys, or IPs in your keys to scope limits correctly (e.g. `user:123`, `ip:1.2.3.4`).

---

## Requirements

- Node.js runtime compatible with ES2020 modules
- Redis server accessible from your app
- `ioredis` as the Redis client

---

## Development

- Build the package:

	```bash
	npm run build
	```

This compiles TypeScript from `src` into `dist` using `tsup`.

---

## License

MIT
