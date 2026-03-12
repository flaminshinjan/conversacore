"use client";

import {
  PipecatClientProvider,
  PipecatClientAudio,
  usePipecatClient,
  useRTVIClientEvent,
  usePipecatClientTransportState,
} from "@pipecat-ai/client-react";
import { RTVIEvent, TransportStateEnum } from "@pipecat-ai/client-js";
import { useCallback, useEffect, useState } from "react";
import { createClient, getToken, getWsUrl } from "@/lib/pipecat";

function SpeakingBlob({
  isSpeaking,
  isUserSpeaking,
  isConnected,
}: {
  isSpeaking: boolean;
  isUserSpeaking: boolean;
  isConnected: boolean;
}) {
  const active = isSpeaking || isUserSpeaking;
  const size = 420;

  return (
    <div
      style={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        background: "#8C5A3C",
        borderRadius: "60% 40% 30% 70% / 60% 30% 70% 40%",
        animation: active
          ? "blob-speaking 0.6s ease-in-out infinite, blob-pulse-subtle 0.8s ease-in-out infinite"
          : "blob-idle 8s ease-in-out infinite",
        transition: "opacity 0.3s",
        opacity: isConnected ? 1 : 0.5,
        boxShadow: active
          ? "0 0 80px rgba(140, 90, 60, 0.35)"
          : "0 0 40px rgba(140, 90, 60, 0.2)",
      }}
    />
  );
}

function getStatusText(
  status: "idle" | "connecting" | "connected",
  isBotSpeaking: boolean,
  isUserSpeaking: boolean
): string {
  if (status === "connecting") return "Connecting…";
  if (status !== "connected") return "Tap to connect";
  if (isBotSpeaking) return "Speaking";
  if (isUserSpeaking) return "You're speaking";
  return "I'm Listening";
}

function TalkUI() {
  const pipecat = usePipecatClient();
  const transportState = usePipecatClientTransportState();
  const [status, setStatus] = useState<"idle" | "connecting" | "connected">("idle");
  const [isBotSpeaking, setIsBotSpeaking] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useRTVIClientEvent(RTVIEvent.BotStartedSpeaking, useCallback(() => setIsBotSpeaking(true), []));
  useRTVIClientEvent(RTVIEvent.BotStoppedSpeaking, useCallback(() => setIsBotSpeaking(false), []));
  useRTVIClientEvent(RTVIEvent.UserStartedSpeaking, useCallback(() => setIsUserSpeaking(true), []));
  useRTVIClientEvent(RTVIEvent.UserStoppedSpeaking, useCallback(() => setIsUserSpeaking(false), []));
  useRTVIClientEvent(RTVIEvent.BotReady, useCallback(() => setStatus("connected"), []));
  useRTVIClientEvent(
    RTVIEvent.Disconnected,
    useCallback(() => {
      setStatus("idle");
      setIsBotSpeaking(false);
      setIsUserSpeaking(false);
    }, [])
  );

  useEffect(() => {
    if (
      status === "connecting" &&
      (transportState === TransportStateEnum.READY ||
        transportState === TransportStateEnum.CONNECTED)
    ) {
      setStatus("connected");
    }
    if (
      status === "connected" &&
      (transportState === TransportStateEnum.DISCONNECTED ||
        transportState === TransportStateEnum.ERROR)
    ) {
      setStatus("idle");
    }
  }, [transportState, status]);

  async function connect() {
    if (!pipecat) return;
    setStatus("connecting");
    setError(null);
    try {
      const token = await getToken();
      const wsUrl = getWsUrl(token);
      await pipecat.connect({ wsUrl });
      setStatus("connected");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection failed");
      setStatus("idle");
    }
  }

  function disconnect() {
    pipecat?.disconnect();
    setIsBotSpeaking(false);
    setIsUserSpeaking(false);
    setStatus("idle");
  }

  const statusText = getStatusText(status, isBotSpeaking, isUserSpeaking);
  const isConnected = status === "connected";

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#FDF9F5",
        padding: 24,
        position: "relative",
      }}
    >
      <div
        onClick={status === "idle" ? connect : undefined}
        role={status === "idle" ? "button" : undefined}
        onKeyDown={(e) => status === "idle" && e.key === "Enter" && connect()}
        style={{ cursor: status === "idle" ? "pointer" : "default" }}
      >
        <SpeakingBlob
          isSpeaking={isBotSpeaking}
          isUserSpeaking={isUserSpeaking}
          isConnected={isConnected}
        />
      </div>
      <p
        style={{
          marginTop: 24,
          fontSize: 16,
          color: "#8C5A3C",
          fontWeight: 600,
        }}
      >
        {statusText}
      </p>
      <div style={{ marginTop: 24, display: "flex", gap: 12 }}>
        {status === "idle" && (
          <button
            onClick={connect}
            style={{
              padding: "14px 32px",
              background: "#8C5A3C",
              color: "#fff",
              border: "none",
              borderRadius: 14,
              fontSize: 16,
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 4px 14px rgba(140, 90, 60, 0.25)",
            }}
          >
            Connect
          </button>
        )}
        {isConnected && (
          <button
            onClick={disconnect}
            style={{
              padding: "14px 32px",
              background: "#C53030",
              color: "#fff",
              border: "none",
              borderRadius: 14,
              fontSize: 16,
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 4px 14px rgba(197, 48, 48, 0.25)",
            }}
          >
            End session
          </button>
        )}
      </div>

      <div
        style={{
          position: "absolute",
          top: 24,
          right: 24,
        }}
      >
        <a
          href="/metrics"
          style={{ color: "#8C5A3C", fontSize: 14, fontWeight: 600, textDecoration: "none" }}
        >
          Metrics
        </a>
      </div>

      {error && (
        <p
          style={{
            marginTop: 16,
            padding: "12px 20px",
            background: "#FEE2E2",
            color: "#C53030",
            fontSize: 14,
            borderRadius: 12,
            fontWeight: 500,
          }}
        >
          {error}
        </p>
      )}

      <PipecatClientAudio />
    </div>
  );
}

export default function Page() {
  const [client, setClient] = useState<ReturnType<typeof createClient> | null>(null);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    try {
      setClient(createClient());
      setInitError(null);
    } catch (e) {
      setInitError(e instanceof Error ? e.message : "Failed to initialize");
    }
  }, []);

  if (initError) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#FDF9F5",
          color: "#C53030",
          padding: 24,
        }}
      >
        <p>{initError}</p>
        <p style={{ fontSize: 14, color: "#8C5A3C", marginTop: 8 }}>
          Try refreshing the page.
        </p>
      </div>
    );
  }

  if (!client) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#FDF9F5",
          color: "#8C5A3C",
        }}
      >
        Loading…
      </div>
    );
  }

  return (
    <PipecatClientProvider client={client}>
      <TalkUI />
    </PipecatClientProvider>
  );
}
