import type Redis from "ioredis";
import { tokenBucketLuaConfig } from "../lua/tokenBucket";
export interface RateLimiterOptions {
  redis: Redis;
  maxRequests: number;
  windowSizeInSeconds: number;
}

export class RateLimiter {
  private redis: Redis;
  private maxRequests: number;
  private windowSizeInSeconds: number;
  private scriptSha?: string;

  constructor(options: RateLimiterOptions) {
    this.redis = options.redis;
    this.maxRequests = options.maxRequests;
    this.windowSizeInSeconds = options.windowSizeInSeconds;
  }
  async init() {
    this.scriptSha = (await this.redis.script("LOAD", tokenBucketLuaConfig)) as
      | string
      | undefined;
  }
  async isAllowed(key: string): Promise<boolean> {
    if (!this.scriptSha) {
      throw new Error(
        "Lua script not loaded. Call init() before using the limiter."
      );
    }
    const now = Date.now();
    const res = await this.redis.evalsha(
      this.scriptSha,
      1,
      `rate:${key}`,
      this.maxRequests,
      this.windowSizeInSeconds,
      now
    );
    return res === 1;
  }
}
