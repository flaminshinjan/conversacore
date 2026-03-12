local user_key = KEYS[1]
local session_key = KEYS[2]
local cap = tonumber(ARGV[1])
local ttl = tonumber(ARGV[2])

local current = redis.call("GET", user_key) or 0
current = tonumber(current)
if current >= cap then
    return 0
end

redis.call("INCR", user_key)
redis.call("EXPIRE", user_key, 86400)
redis.call("SET", session_key, "1", "EX", ttl)
return 1
