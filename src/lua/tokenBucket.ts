export const tokenBucketLuaConfig = `
  local bucket = redis.call("HMGET", KEYS[1], "tokens", "last_refill")
  local tokens = tonumber(bucket[1])
  local last_refill = tonumber(bucket[2])
  if tokens == nil then
      tokens = tonumber(ARGV[1])
      last_refill = tonumber(ARGV[3])
  end
  -- refil tokens
  local elapsed = (tonumber(ARGV[3]) - last_refill) /1000
  local refil = elapsed * tonumber(ARGV[2])
  tokens = math.min(tokens + refil, tonumber(ARGV[1]))
  -- consume token
  if tokens < 1 then
    redis.call("HMSET", KEYS[1], "tokens", tokens, "last_refill", ARGV[3])
    return 0
  end
  tokens = tokens-1
  redis.call("HMSET", KEYS[1], "tokens", tokens, "last_refill", ARGV[3])
  return 1
`;
