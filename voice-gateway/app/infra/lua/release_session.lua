local user_key = KEYS[1]
local session_key = KEYS[2]

redis.call("DEL", session_key)
local current = redis.call("DECR", user_key)
if current <= 0 then
    redis.call("DEL", user_key)
end
return 1
