"use client";

import { useEffect, useState } from "react";

const GATEWAY_URL =
  process.env.NEXT_PUBLIC_GATEWAY_URL || "http://localhost:8000";

interface MetricsData {
  wsConnectionsActive: number;
  sessionDurationCount: number;
  sessionDurationSumSeconds: number;
  concurrencyRejections: number;
  quotaRejections: number;
  sessionTeardowns: number;
  estimatedCostUsd: number;
  durationBuckets: { le: string; count: number }[];
}

function parsePrometheusText(text: string): Partial<MetricsData> {
  const data: Partial<MetricsData> = { durationBuckets: [] };
  const lines = text.split("\n");

  for (const line of lines) {
    if (line.startsWith("#") || !line.trim()) continue;
    const match = line.match(/^(\w+(?:_\w+)*)(?:\{[^}]*\})?\s+([\d.e+-]+)/);
    if (!match) continue;
    const [, name, valueStr] = match;
    const value = parseFloat(valueStr);

    if (name === "ws_connections_active") data.wsConnectionsActive = value;
    if (name === "session_duration_seconds_count") data.sessionDurationCount = value;
    if (name === "session_duration_seconds_sum") data.sessionDurationSumSeconds = value;
    if (name === "concurrency_rejections_total") data.concurrencyRejections = value;
    if (name === "quota_rejections_total") data.quotaRejections = value;
    if (name === "session_teardowns_total" && line.includes('reason="disconnect"'))
      data.sessionTeardowns = value;
    if (name === "estimated_cost_usd_total" && line.includes('provider="session"'))
      data.estimatedCostUsd = value;
    const bucketMatch = line.match(/session_duration_seconds_bucket\{[^}]*le="([^"]+)"\}\s+([\d.]+)/);
    if (bucketMatch) {
      (data.durationBuckets ?? []).push({ le: bucketMatch[1], count: parseFloat(bucketMatch[2]) });
    }
  }
  if (data.durationBuckets?.length)
    data.durationBuckets.sort((a, b) => {
      const va = a.le === "+Inf" ? Infinity : parseFloat(a.le);
      const vb = b.le === "+Inf" ? Infinity : parseFloat(b.le);
      return va - vb;
    });

  return data;
}

function MetricRow({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        padding: "12px 16px",
        background: "#FFF8F0",
        borderRadius: 12,
        border: "1px solid rgba(140, 90, 60, 0.15)",
      }}
    >
      <div>
        <span style={{ color: "#4B2E2B", fontWeight: 600 }}>{label}</span>
        {sub && (
          <span style={{ color: "#8C5A3C", fontSize: 13, marginLeft: 8 }}>
            {sub}
          </span>
        )}
      </div>
      <span style={{ color: "#4B2E2B", fontWeight: 600, fontSize: 18 }}>
        {value}
      </span>
    </div>
  );
}

export default function MetricsPage() {
  const [data, setData] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMetrics() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${GATEWAY_URL}/metrics`);
        if (!res.ok) throw new Error("Failed to fetch metrics");
        const text = await res.text();
        const parsed = parsePrometheusText(text);
        setData({
          wsConnectionsActive: parsed.wsConnectionsActive ?? 0,
          sessionDurationCount: parsed.sessionDurationCount ?? 0,
          sessionDurationSumSeconds: parsed.sessionDurationSumSeconds ?? 0,
          concurrencyRejections: parsed.concurrencyRejections ?? 0,
          quotaRejections: parsed.quotaRejections ?? 0,
          sessionTeardowns: parsed.sessionTeardowns ?? 0,
          estimatedCostUsd: parsed.estimatedCostUsd ?? 0,
          durationBuckets: parsed.durationBuckets ?? [],
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load metrics");
      } finally {
        setLoading(false);
      }
    }
    fetchMetrics();
  }, []);

  if (loading && !data) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#FDF9F5",
          color: "#8C5A3C",
        }}
      >
        Loading metrics…
      </div>
    );
  }

  const avgDuration =
    data && data.sessionDurationCount > 0
      ? (data.sessionDurationSumSeconds / data.sessionDurationCount).toFixed(1)
      : "—";

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "#FDF9F5",
        padding: 24,
      }}
    >
      <a
        href="/"
        style={{
          color: "#8C5A3C",
          textDecoration: "none",
          fontWeight: 600,
          fontSize: 14,
          marginBottom: 24,
          display: "inline-block",
        }}
      >
        ← Back to voice
      </a>

      <h1
        style={{
          color: "#4B2E2B",
          fontSize: 24,
          fontWeight: 700,
          marginBottom: 24,
        }}
      >
        Metrics & cost
      </h1>

      {error && (
        <div
          style={{
            padding: 16,
            background: "#FEE2E2",
            color: "#C53030",
            borderRadius: 12,
            marginBottom: 24,
            fontWeight: 500,
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          maxWidth: 480,
        }}
      >
        <MetricRow
          label="Active connections"
          value={data?.wsConnectionsActive ?? 0}
          sub="WebSocket"
        />
        <MetricRow
          label="Sessions completed"
          value={data?.sessionTeardowns ?? 0}
        />
        <MetricRow
          label="Avg session duration"
          value={`${avgDuration}s`}
        />
        <MetricRow
          label="Concurrency rejections"
          value={data?.concurrencyRejections ?? 0}
          sub="cap exceeded"
        />
        <MetricRow
          label="Quota rejections"
          value={data?.quotaRejections ?? 0}
        />
        <MetricRow
          label="Estimated cost"
          value={`$${(data?.estimatedCostUsd ?? 0).toFixed(4)}`}
          sub="USD total"
        />
      </div>

      {data?.durationBuckets && data.durationBuckets.length > 0 && (() => {
        const buckets = data.durationBuckets;
        const incremental: { label: string; count: number }[] = [];
        let prevCount = 0;
        let prevLe = "0";
        for (let i = 0; i < buckets.length; i++) {
          const c = buckets[i].count;
          const le = buckets[i].le;
          const label =
            le === "+Inf" ? `>${prevLe}s` : prevLe === "0" ? `0–${le}s` : `${prevLe}–${le}s`;
          incremental.push({ label, count: Math.max(0, c - prevCount) });
          prevCount = c;
          prevLe = le === "+Inf" ? prevLe : le;
        }
        const maxCount = Math.max(1, ...incremental.map((x) => x.count));
        return (
          <div style={{ marginTop: 24, maxWidth: 480 }}>
            <h3 style={{ color: "#4B2E2B", fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
              Session duration histogram
            </h3>
            <div
              style={{
                background: "#FFF8F0",
                padding: 20,
                borderRadius: 12,
                border: "1px solid rgba(140, 90, 60, 0.15)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  gap: 8,
                  height: 120,
                }}
              >
                {incremental.map((b, i) => (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <div
                      style={{
                        width: "100%",
                        height: 80,
                        display: "flex",
                        alignItems: "flex-end",
                        justifyContent: "center",
                      }}
                    >
                      <div
                        style={{
                          width: "80%",
                          minHeight: b.count > 0 ? 6 : 0,
                          height: `${Math.max(b.count > 0 ? 6 : 0, (b.count / maxCount) * 80)}px`,
                          background: "#8C5A3C",
                          borderRadius: "4px 4px 0 0",
                          transition: "height 0.3s ease",
                        }}
                        title={`${b.label}: ${b.count}`}
                      />
                    </div>
                    <span style={{ fontSize: 11, color: "#8C5A3C", fontWeight: 600 }}>
                      {b.label}
                    </span>
                    <span style={{ fontSize: 12, color: "#4B2E2B", fontWeight: 600 }}>
                      {b.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      <div style={{ marginTop: 24, display: "flex", gap: 12 }}>
        <a
          href={`${GATEWAY_URL}/metrics`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: "#8C5A3C",
            fontSize: 14,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          View raw Prometheus →
        </a>
      </div>
    </div>
  );
}
