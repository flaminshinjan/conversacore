from prometheus_client import Counter, Gauge, Histogram

ws_connections_active = Gauge("ws_connections_active", "Active WebSocket connections")
session_duration_seconds = Histogram(
    "session_duration_seconds",
    "Session duration in seconds",
    buckets=[1, 5, 10, 30, 60, 120, 300],
)
concurrency_rejections_total = Counter(
    "concurrency_rejections_total",
    "Total rejections due to concurrency cap",
)
quota_rejections_total = Counter(
    "quota_rejections_total",
    "Total rejections due to quota breach",
)
session_teardowns_total = Counter(
    "session_teardowns_total",
    "Total session teardowns",
    ["reason"],
)
estimated_cost_usd_total = Counter(
    "estimated_cost_usd_total",
    "Estimated cost in USD",
    ["provider", "type"],
)
