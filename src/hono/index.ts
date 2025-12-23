import type { MiddlewareHandler } from "hono";
import type { RateLimiter } from "..";

type HonoRateLimitOptions = {
  key: (c: any) => string;
};

export const honoRateLimit = (
  limiter: RateLimiter,
  opts: HonoRateLimitOptions
): MiddlewareHandler => {
  return async (c, next) => {
    const key = opts.key(c);

    const allowed = await limiter.isAllowed(key);

    if (!allowed) {
      return c.json({ error: "Too Many Requests" }, 429);
    }

    await next();
  };
};
