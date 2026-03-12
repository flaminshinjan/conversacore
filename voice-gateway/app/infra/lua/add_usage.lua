-- KEYS[1]=quota:user_id:date:stt, KEYS[2]=quota:user_id:date:llm, KEYS[3]=quota:user_id:date:tts
-- ARGV[1]=stt_delta, ARGV[2]=llm_delta, ARGV[3]=tts_delta, ARGV[4]=ttl_sec
local ttl = tonumber(ARGV[4])
redis.call("INCRBYFLOAT", KEYS[1], ARGV[1])
redis.call("EXPIRE", KEYS[1], ttl)
redis.call("INCRBY", KEYS[2], ARGV[2])
redis.call("EXPIRE", KEYS[2], ttl)
redis.call("INCRBY", KEYS[3], ARGV[3])
redis.call("EXPIRE", KEYS[3], ttl)
return 1
