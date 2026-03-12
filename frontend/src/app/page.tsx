"use client";

import {
  PipecatClientProvider,
  PipecatClientAudio,
  usePipecatClient,
  useRTVIClientEvent,
  usePipecatClientTransportState,
} from "@pipecat-ai/client-react";
import { RTVIEvent, TransportStateEnum } from "@pipecat-ai/client-js";
import type { TranscriptData, BotOutputData } from "@pipecat-ai/client-js";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient, getToken, getWsUrl } from "@/lib/pipecat";

type TranscriptEntry = {
  id: string;
  role: "user" | "assistant";
  text: string;
  isPartial?: boolean;
};

function SpeakingBlob({
  isSpeaking,
  isUserSpeaking,
  isListening,
  isConnected,
}: {
  isSpeaking: boolean;
  isUserSpeaking: boolean;
  isListening: boolean;
  isConnected: boolean;
}) {
  const active = isSpeaking || isUserSpeaking;
  const size = 320;

  return (
    <div
      style={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        background:
          "linear-gradient(135deg, #C08552 0%, #8C5A3C 40%, #4B2E2B 100%)",
        borderRadius: "60% 40% 30% 70% / 60% 30% 70% 40%",
        animation: active
          ? "blob-speaking 0.6s ease-in-out infinite, blob-pulse-subtle 0.8s ease-in-out infinite"
          : "blob-idle 8s ease-in-out infinite",
        transition: "opacity 0.3s",
        opacity: isConnected ? 1 : 0.5,
        boxShadow: "0 0 60px rgba(192, 133, 82, 0.25)",
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
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const lastUserPartialRef = useRef<string>("");
  const expectNewBotMessageRef = useRef(true);

  useRTVIClientEvent(
    RTVIEvent.BotStartedSpeaking,
    useCallback(() => setIsBotSpeaking(true), [])
  );
  useRTVIClientEvent(
    RTVIEvent.BotStoppedSpeaking,
    useCallback(() => {
      setIsBotSpeaking(false);
      expectNewBotMessageRef.current = true;
    }, [])
  );
  useRTVIClientEvent(
    RTVIEvent.UserStartedSpeaking,
    useCallback(() => setIsUserSpeaking(true), [])
  );
  useRTVIClientEvent(
    RTVIEvent.UserStoppedSpeaking,
    useCallback(() => setIsUserSpeaking(false), [])
  );
  useRTVIClientEvent(
    RTVIEvent.BotReady,
    useCallback(() => setStatus("connected"), [])
  );
  useRTVIClientEvent(
    RTVIEvent.Disconnected,
    useCallback(() => {
      setStatus("idle");
      setIsBotSpeaking(false);
      setIsUserSpeaking(false);
      expectNewBotMessageRef.current = true;
    }, [])
  );

  useRTVIClientEvent(
    RTVIEvent.UserTranscript,
    useCallback((data: TranscriptData) => {
      if (data.final) {
        if (data.text.trim()) {
          setTranscript((prev) => [
            ...prev.filter((e) => !(e.role === "user" && e.isPartial)),
            {
              id: `u-${Date.now()}`,
              role: "user",
              text: data.text.trim(),
              isPartial: false,
            },
          ]);
        }
        lastUserPartialRef.current = "";
      } else {
        lastUserPartialRef.current = data.text;
        setTranscript((prev) => {
          const without = prev.filter((e) => !(e.role === "user" && e.isPartial));
          if (!data.text.trim()) return without;
          return [
            ...without,
            {
              id: "user-partial",
              role: "user",
              text: data.text,
              isPartial: true,
            },
          ];
        });
      }
    }, [])
  );

  useRTVIClientEvent(
    RTVIEvent.BotOutput,
    useCallback((data: BotOutputData) => {
      if (!data.text) return;
      setTranscript((prev) => {
        const last = prev[prev.length - 1];
        const shouldAppend =
          !expectNewBotMessageRef.current &&
          last?.role === "assistant";
        if (shouldAppend) {
          expectNewBotMessageRef.current = false;
          return [
            ...prev.slice(0, -1),
            { ...last, text: last.text + data.text },
          ];
        }
        expectNewBotMessageRef.current = false;
        return [
          ...prev,
          {
            id: `b-${Date.now()}`,
            role: "assistant",
            text: data.text,
            isPartial: false,
          },
        ];
      });
    }, [])
  );


  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

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
        background: "var(--cream)",
      }}
    >
      {/* Minimal header */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 20px",
          paddingTop: "max(12px, env(safe-area-inset-top))",
          borderBottom: "1px solid rgba(75, 46, 43, 0.08)",
        }}
      >
        <button
          type="button"
          onClick={() => window.history.back()}
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            border: "1px solid rgba(75, 46, 43, 0.15)",
            background: "transparent",
            color: "var(--dark)",
            fontSize: 16,
            cursor: "pointer",
          }}
        >
          ←
        </button>
        <span
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: "var(--dark)",
          }}
        >
          ConversaCore
        </span>
        <button
          type="button"
          onClick={isConnected ? disconnect : connect}
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            border: "1px solid rgba(75, 46, 43, 0.15)",
            background: "transparent",
            color: "var(--dark)",
            cursor: "pointer",
            fontSize: 16,
          }}
        >
          ↻
        </button>
      </header>

      {/* Main: blob left, transcript right */}
      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "row",
          overflow: "hidden",
          minHeight: 0,
        }}
      >
        {/* Left: blob */}
        <div
          style={{
            flex: "0 0 auto",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 32,
            minWidth: 200,
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
              isListening={isConnected && !isBotSpeaking && !isUserSpeaking}
              isConnected={isConnected}
            />
          </div>
          <p
            style={{
              marginTop: 16,
              fontSize: 14,
              color: "var(--text-muted)",
              fontWeight: 500,
            }}
          >
            {statusText}
          </p>
          {status === "idle" && (
            <button
              onClick={connect}
              style={{
                marginTop: 12,
                padding: "10px 24px",
                background: "var(--tan)",
                color: "var(--cream)",
                border: "none",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Connect
            </button>
          )}
        </div>

        {/* Right: transcript */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            borderLeft: "1px solid rgba(75, 46, 43, 0.08)",
            minWidth: 0,
          }}
        >
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: 20,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {transcript.length === 0 && (
              <p
                style={{
                  color: "var(--text-muted)",
                  fontSize: 14,
                  margin: 0,
                  fontStyle: "italic",
                }}
              >
                Transcript will appear here as you talk.
              </p>
            )}
            {transcript.map((entry) => (
              <div
                key={entry.id}
                style={{
                  alignSelf: entry.role === "user" ? "flex-end" : "flex-start",
                  maxWidth: "85%",
                  padding: "10px 14px",
                  borderRadius: 12,
                  background:
                    entry.role === "user"
                      ? "var(--brown)"
                      : "rgba(192, 133, 82, 0.15)",
                  color: entry.role === "user" ? "var(--cream)" : "var(--dark)",
                  fontSize: 14,
                  lineHeight: 1.5,
                  opacity: entry.isPartial ? 0.85 : 1,
                }}
              >
                {entry.text}
              </div>
            ))}
            <div ref={transcriptEndRef} />
          </div>

          {/* Bottom controls */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 24,
              padding: 16,
              borderTop: "1px solid rgba(75, 46, 43, 0.08)",
            }}
          >
            <button
              type="button"
              onClick={isConnected ? disconnect : connect}
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                border: "none",
                background: isConnected ? "var(--brown)" : "var(--tan)",
                color: "var(--cream)",
                cursor: "pointer",
                fontSize: 22,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              🎤
            </button>
          </div>
        </div>
      </main>

      {error && (
        <div
          style={{
            padding: "8px 20px",
            background: "rgba(197, 48, 48, 0.1)",
            color: "var(--error)",
            fontSize: 14,
            textAlign: "center",
          }}
        >
          {error}
        </div>
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
          background: "var(--cream)",
          color: "var(--error)",
          padding: 24,
        }}
      >
        <p>{initError}</p>
        <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 8 }}>
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
          background: "var(--cream)",
          color: "var(--text-muted)",
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
