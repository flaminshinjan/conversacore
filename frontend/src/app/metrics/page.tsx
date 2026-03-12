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
}

function parsePrometheusText(text: string): Partial<MetricsData> {
  const data: Partial<MetricsData> = {};
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
  }

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
    </div>
  );
}
