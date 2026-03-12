# ConversaCore Voice Gateway

Pipecat-compatible voice gateway with FastAPI, Redis, and Prometheus. Targets 5,000+ concurrent calls.

## Project Overview

- **FastAPI** — Auth, admission, routing, metrics
- **Redis** — Concurrency caps and usage quotas (Lua scripts)
- **Pipecat** — STT → LLM → TTS voice pipeline
- **Next.js** — Frontend with WebSocket client

## Quick Start

```bash
cp voice-gateway/.env.example voice-gateway/.env
# Set DEEPGRAM_API_KEY, OPENAI_API_KEY, CARTESIA_API_KEY in voice-gateway/.env
docker compose up --build
```

- Gateway: http://localhost:8000
- Frontend: `cd frontend && npm install && cp .env.example .env.local && npm run dev` → http://localhost:3001
- Metrics: http://localhost:8000/metrics

## API

| Endpoint | Description |
|----------|-------------|
| `POST /token` | Issue JWT |
| `WS /ws/talk?access_token=...` | Voice session |
| `GET /metrics` | Prometheus metrics |
| `GET /health`, `GET /ready` | Health checks |

## Scaling: 5,000+ Concurrent Calls

**Strategy: Gateway vs. Worker node separation.**

| Component | Role | Scaling |
|-----------|------|---------|
| **Gateway** | Stateless; auth, admission, metrics | L4/L7 load balancer; sticky routing by `session_id` |
| **Workers** | Per-session media (STT/LLM/TTS) | Autoscale by active sessions / CPU |
| **Redis** | Quotas, concurrency | Redis Cluster; connection pooling |

Gateway handles WebSocket handshake and admission; workers run the Pipecat pipeline. Provider connection pooling (Deepgram, OpenAI, Cartesia) reduces connect overhead.

## Resilience: Circuit-Breaker for Upstream AI Failures

- **Timeouts** — Strict limits on STT connect, LLM first-token, TTS first-byte
- **Circuit breaker** — After N failures in a window, reject new sessions until cooldown
- **Graceful teardown** — On provider error: close with `server_error` (1011), release Redis slot, no retry loops
- **Monitoring** — `provider_errors_total`, `circuit_open_seconds` in Prometheus

Implementation: wrapper around each Pipecat provider; track failures, open circuit at threshold, reset after cooldown. Place in `app/providers/circuit_breaker.py`.

## Optimization: Hot-Path JWT and Redis

- **JWT** — Single-pass validation, HS256, optional payload cache (short TTL)
- **Redis** — Connection pooling; Lua scripts (`check_quota`, `admit_session`, `add_usage`) for atomic ops and fewer round-trips
- **Admission path** — 1 round-trip for quota + 1 for concurrency; TTL on quota keys for auto-expiry

## Demo
https://drive.google.com/file/d/1W5UCFTM-MovfGGMOLFpABgHcF8jYrABQ/view?usp=sharing

## Configuration

- `CONCURRENCY_CAP_PER_USER` — Max active calls per user (default 2)
- `QUOTA_STT_SECONDS_PER_DAY`, `QUOTA_LLM_TOKENS_PER_DAY`, `QUOTA_TTS_CHARS_PER_DAY` — Daily limits
- Exceeding limits → WebSocket close 4001 `policy_violation`
