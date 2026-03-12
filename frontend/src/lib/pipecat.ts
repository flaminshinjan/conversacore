"use client";

import { PipecatClient } from "@pipecat-ai/client-js";
import {
  WebSocketTransport,
  ProtobufFrameSerializer,
} from "@pipecat-ai/websocket-transport";

const GATEWAY_URL =
  process.env.NEXT_PUBLIC_GATEWAY_URL || "http://localhost:8000";

/**
 * WebSocket transport that returns false for isCamEnabled/isSharingScreen
 * without logging errors (WebSocket transport doesn't support camera/screen share).
 */
class VoiceOnlyWebSocketTransport extends WebSocketTransport {
  override get isCamEnabled(): boolean {
    return false;
  }
  override get isSharingScreen(): boolean {
    return false;
  }
}

export async function getToken(): Promise<string> {
  const res = await fetch(`${GATEWAY_URL}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error("Failed to get token");
  const data = await res.json();
  return data.token;
}

export function createClient() {
  const transport = new VoiceOnlyWebSocketTransport({
    serializer: new ProtobufFrameSerializer(),
  });
  return new PipecatClient({
    transport,
    enableMic: true,
  });
}

export function getWsUrl(token: string): string {
  const base = (GATEWAY_URL || "").replace(/^http/, "ws");
  const url = new URL("/ws/talk", base);
  url.searchParams.set("access_token", token);
  return url.toString();
}
