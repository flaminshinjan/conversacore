# ConversaCore Voice Gateway

Pipecat-compatible voice gateway with FastAPI, Redis, and Prometheus.

## Architecture

- **FastAPI** — Control plane: auth, admission, routing, metrics
- **Redis** — Distributed concurrency caps and quotas (Lua scripts)
- **SessionManager** — Per-WebSocket session workers (Pipecat pipeline ready)
- **Prometheus/Grafana** — Observability

## Quick Start

```bash
cp voice-gateway/.env.example voice-gateway/.env
docker compose up --build
```

- Gateway: http://localhost:8000
- Metrics: http://localhost:8000/metrics
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3000 (admin/admin)

## Local Development

```bash
cd voice-gateway
uv sync
export REDIS_URL=redis://localhost:6379/0
uv run uvicorn app.main:app --reload --port 8000
```

## API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/token` | POST | Issue JWT |
| `/ws/talk` | WebSocket | Voice session (token via `?access_token=` or `Authorization: Bearer`) |
| `/metrics` | GET | Prometheus metrics |
| `/health` | GET | Liveness |
| `/ready` | GET | Readiness (Redis check) |

## Concurrency & Quotas

- **Concurrency**: Max 2 active calls per user (`CONCURRENCY_CAP_PER_USER`).
- **Usage quotas** (per user per day): STT 30 min, LLM 100k tokens, TTS 250k chars. Exceeding triggers WebSocket close 4001 `policy_violation: quota_exceeded`.

## Environment

Set `DEEPGRAM_API_KEY`, `OPENAI_API_KEY`, and `CARTESIA_API_KEY` in `.env`.

Optional `CARTESIA_VOICE_ID` (default: British Reading Lady).

## Assets

Place WAV files in `voice-gateway/assets/` for the `play_audio` tool (e.g. `ding.wav`). The LLM can call `play_audio(asset_id="ding")` to play them. A sample `ding.wav` is included.

## Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000, click Connect, and speak.

# ConversaCore Voice Gateway — Project Plan

## Executive Summary

A **voice gateway** (not a single bot server) built as:

- **FastAPI** control/gateway layer
- **Pipecat**-compatible session workers for real-time media
- **Redis** distributed coordination plane
- **Prometheus/OpenTelemetry** observability
- **Next.js** frontend with mic, speaker, WebSocket client

Target: 5,000+ concurrent calls, ≤2s E2E first-audible response.

---

## 1. Logical Architecture

```
┌─────────────────────────────────────┐
│        Next.js (Browser / App)      │
│   mic, speaker, WebSocket client    │
└──────────────────┬──────────────────┘
                   │ Bearer JWT + WebSocket
┌──────────────────▼──────────────────┐
│         FastAPI Gateway             │
│  /token | /ws/talk | /metrics       │
│  health | structured logs           │
└──────┬──────────────────┬───────────┘
       │                  │
       │ JWT / quotas     │ Metrics
       ▼                  ▼
┌──────────────┐   ┌──────────────────┐
│    Redis     │   │ Prometheus       │
│ sessions     │   │ Grafana          │
│ quotas       │   └──────────────────┘
│ Lua scripts  │
└──────┬───────┘
       │ session assignment
┌──────▼──────────────────────────────┐
│     SessionManager / Worker Pool    │
└──────┬──────────────────┬───────────┘
       │                  │
┌──────▼──────┐     ┌─────▼──────┐
│ Pipecat     │     │ Pipecat    │  ... N
│ Session 1   │     │ Session 2  │
└─────────────┘     └────────────┘
```

---

## 2. Core Design Principles

### 2.1 Control vs Media Plane

| FastAPI (control)        | Session Workers (media)      |
|--------------------------|-----------------------------|
| Auth                     | STT/LLM/TTS streaming       |
| Admission control        | Tool calls                  |
| Connection lifecycle     | Binary audio push           |
| Frame routing            | Usage tracking              |
| Metrics exposure         | Cost estimation             |
| Teardown coordination    | Pipeline execution          |

### 2.2 One Session = One Isolated Container

Each call: `session_id`, `user_id`, WebSocket ref, inbound/outbound queues, `PipelineTask`, usage counters, timestamps. No shared mutable session state outside Redis.

### 2.3 Redis as Distributed Authority

- Active call count per user
- Quota counters
- Lua scripts for atomic check-and-increment
- Ephemeral session presence

### 2.4 Concurrency Model

- `asyncio` event loop
- `asyncio.create_task` per session
- Bounded queues
- **No blocking `time.sleep()` in event loop** — use `asyncio.sleep()` in isolated workers or a pacing gate

---

## 3. Repository Layout

```
conversacore/
├── voice-gateway/          # FastAPI backend
│   ├── app/
│   │   ├── main.py
│   │   ├── api/
│   │   │   ├── token.py
│   │   │   ├── websocket.py
│   │   │   ├── metrics.py
│   │   │   └── health.py
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   ├── logging.py
│   │   │   ├── auth.py
│   │   │   ├── pricing.py
│   │   │   └── ids.py
│   │   ├── sessions/
│   │   │   ├── manager.py
│   │   │   ├── models.py
│   │   │   ├── lifecycle.py
│   │   │   └── teardown.py
│   │   ├── pipeline/
│   │   │   ├── factory.py
│   │   │   ├── worker.py
│   │   │   ├── transport.py
│   │   │   ├── tools.py
│   │   │   └── pacing.py
│   │   ├── providers/
│   │   │   ├── stt.py
│   │   │   ├── llm.py
│   │   │   ├── tts.py
│   │   │   └── circuit_breaker.py
│   │   ├── infra/
│   │   │   ├── redis_client.py
│   │   │   ├── rate_limit.py
│   │   │   ├── lua/
│   │   │   │   ├── admit_session.lua
│   │   │   │   └── release_session.lua
│   │   │   └── metrics.py
│   │   └── usage/
│   │       ├── tracker.py
│   │       ├── estimator.py
│   │       └── exporters.py
│   ├── tests/
│   ├── Dockerfile
│   ├── pyproject.toml
│   └── .env.example
│
├── frontend/               # Next.js
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   ├── lib/
│   │   └── hooks/
│   ├── package.json
│   └── next.config.js
│
├── docker-compose.yml
├── Makefile
└── README.md
```

---

## 4. API Surface

| Endpoint        | Purpose                                   |
|----------------|-------------------------------------------|
| `POST /token`  | Issue short-lived JWT                     |
| `WS /ws/talk`  | Voice session (token via query or header) |
| `GET /metrics` | Prometheus metrics                        |
| `GET /health`  | Liveness                                  |
| `GET /ready`   | Readiness (Redis, etc.)                   |

---

## 5. WebSocket Auth

- `/token` returns JWT
- `/ws/talk?access_token=...` for browser (no custom headers)
- Server validates same as Bearer
- Non-browser clients can use `Authorization: Bearer <token>`

---

## 6. Redis Limits

### Concurrency

- Max 2 active calls per user
- Keys: `user:{user_id}:active_calls`, `session:{session_id}:lease`
- Lua script for atomic admit

### Quota

- STT: 30 min/day
- LLM: 100k tokens/day
- TTS: 250k chars/day
- Keys: `quota:{user_id}:{yyyy_mm_dd}:stt_seconds`, etc.

### Breach

- Admission: close with code 4001, `policy_violation: concurrency_cap_exceeded`
- Mid-session: graceful message, flush, close 4001

---

## 7. Session Lifecycle

1. Client → `POST /token` → JWT
2. Client → `WS /ws/talk?access_token=...`
3. Gateway validates JWT
4. Lua: concurrency + quota check, reserve slot
5. SessionManager creates session, binds WebSocket → worker
6. Worker bootstraps Pipecat pipeline
7. Audio in → STT → LLM → TTS → out
8. On disconnect: cancel pipeline, flush counters, release Redis slot, teardown logs

---

## 8. Play Audio Tool

- LLM tool: `play_audio(asset_id="ding")`
- Resolve audio from cache/object store
- Push binary frame to client immediately
- No blocking of TTS streaming

---

## 9. Usage & Cost

- Per session: STT seconds, LLM tokens, TTS chars, tool invocations
- Config-driven pricing
- Expose on logs, `/metrics`, teardown summary

---

## 10. Latency Budget (≤2s E2E)

| Step                         | Target     |
|-----------------------------|-----------|
| Client capture/frame        | 100–200 ms|
| WebSocket + queue           | 20–60 ms  |
| STT first partial           | 250–500 ms|
| LLM first token             | 250–500 ms|
| TTS first audio chunk       | 250–500 ms|
| Client playback start       | 50–150 ms |
| **Total**                   | ~0.92–1.9 s|

---

## 11. Observability

- JSON structured logs (ts, level, session_id, user_id, event, latency_ms, cost_usd_estimate)
- Prometheus histograms: session_duration, turn_e2e_latency, stt/llm/tts first-result latency
- Counters: quota_rejections, concurrency_rejections, session_teardowns, estimated_cost_usd
- Teardown logs: duration, usage, cost, reason

---

## 12. Resilience

- Circuit breakers per provider (STT, LLM, TTS)
- Strict timeouts: STT connect, LLM first-token, TTS first-byte, Redis, WebSocket idle
- `try/finally` in session runner for cleanup

---

## 13. Implementation Phases

### Phase 0 — Foundation
- FastAPI skeleton
- Redis client
- JWT issuance/validation
- Structured logging
- `/metrics` stub

### Phase 1 — Admission Control
- `/token`, `/ws/talk`
- Redis Lua concurrency cap
- Session registry
- Clean 4001 on rejection

### Phase 2 — Voice Pipeline
- Per-session worker
- Pipecat pipeline factory (fake providers first)
- Inbound/outbound queues
- Session teardown

### Phase 3 — Tool Calling
- `play_audio` tool
- Binary frame dispatch
- Tool telemetry

### Phase 4 — Usage & Cost
- Usage tracker hooks
- Pricing config
- Turn/session estimators
- `/metrics` export

### Phase 5 — Hardening
- Circuit breakers
- Timeout handling
- Quota enforcement
- Stress test (multiple tabs)

### Phase 6 — Frontend & Integration
- Next.js app
- Token flow
- WebSocket client
- UI for voice

---

## 14. Circuit-Breaker Logic for Upstream AI Failures

To handle STT, LLM, or TTS provider failures gracefully:

- **Timeout handling**: Configure strict timeouts on WebSocket connections to Deepgram, OpenAI, and Cartesia. Fail fast if a provider does not respond.
- **Graceful degradation**: On repeated provider errors, log and close the session with a clear reason (e.g. `server_error`) instead of retrying indefinitely.
- **Implementation path**: Add a thin wrapper or middleware around each Pipecat service that tracks consecutive failures per provider. After a threshold (e.g. 5 failures in 60s), open the circuit and reject new sessions until a cooldown passes. Use `app/providers/circuit_breaker.py` for the logic; wire it into the pipeline factory.
- **Monitoring**: Expose `provider_errors_total` and `circuit_open_seconds` metrics for observability.

---

## 15. JWT and Redis Optimization Techniques

Techniques used to minimize hot-path overhead during JWT and Redis checks:

- **JWT**:
  - Validate signature and expiry in a single pass. Use `HS256` for low CPU; avoid redundant decode.
  - Cache decoded payload by token (short TTL, e.g. 60s) to avoid repeated crypto work for the same token in long sessions.
- **Redis**:
  - Use connection pooling (`redis.asyncio.ConnectionPool`) to avoid per-request connect overhead.
  - Lua scripts (`admit_session`, `check_quota`, `add_usage`) keep quota and concurrency logic atomic and reduce round-trips.
  - Quota keys use daily TTL (`EXPIRE`) so expired keys are auto-cleaned; no extra maintenance tasks.
- **Admission path**: One Redis round-trip for quota check + one for concurrency admit; teardown adds one more for usage. Avoid extra `GET`/`SET` calls on the hot path.

---

## 16. Scaling to 5,000+ Calls

- L4/L7 LB in front of gateway
- Sticky routing by session_id
- Gateway stateless (transient socket ownership)
- Worker autoscaling by active pipeline count / CPU
- Redis cluster
- Provider connection pooling

---

## 17. Build Order (Minimum Vertical Slice)

1. `/token`
2. `/ws/talk`
3. Redis concurrency cap = 2
4. SessionManager + per-session worker
5. Fake STT/LLM/TTS pipeline
6. `play_audio` tool
7. `/metrics`
8. Teardown logs

Then swap fake providers for real Pipecat-integrated ones.

---

## 18. Tech Stack Summary

| Layer     | Technology                    |
|----------|-------------------------------|
| Frontend | Next.js 14+, WebSocket client |
| Gateway  | FastAPI                       |
| Workers  | Pipecat, asyncio              |
| Redis    | Redis 7+                      |
| Observability | Prometheus, Grafana, JSON logs |
| Runtime  | Python 3.11+, uv/poetry       |
| Deploy   | Docker, docker-compose        |

---

## 19. Next Steps

1. Create `voice-gateway/` and `frontend/` directories
2. Implement Phase 0
3. Implement Phase 1
4. Iterate through Phases 2–6
