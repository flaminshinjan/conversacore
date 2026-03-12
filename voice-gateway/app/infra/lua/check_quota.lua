-- KEYS[1]=quota:user_id:date:stt, KEYS[2]=quota:user_id:date:llm, KEYS[3]=quota:user_id:date:tts
-- ARGV[1]=stt_limit, ARGV[2]=llm_limit, ARGV[3]=tts_limit
-- Returns 1 if under all limits, 0 if any exceeded
local stt = tonumber(redis.call("GET", KEYS[1]) or 0)
local llm = tonumber(redis.call("GET", KEYS[2]) or 0)
local tts = tonumber(redis.call("GET", KEYS[3]) or 0)
local stt_limit = tonumber(ARGV[1])
local llm_limit = tonumber(ARGV[2])
local tts_limit = tonumber(ARGV[3])
if stt >= stt_limit or llm >= llm_limit or tts >= tts_limit then
    return 0
end
return 1
