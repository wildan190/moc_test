"use client";

import { useEffect, useRef, useState } from "react";

export interface PieSocketMessage {
  event: string;
  data: Record<string, unknown>;
  timestamp?: number;
}

interface UsePieSocketOptions {
  onMessage?: (msg: PieSocketMessage) => void;
  enabled?: boolean;
}

export function usePieSocket({ onMessage, enabled = true }: UsePieSocketOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<PieSocketMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const wsUrl =
    process.env.NEXT_PUBLIC_PIESOCKET_WS_URL ??
    "wss://free.blr2.piesocket.com/v3/1?api_key=F6y6bNEzxhFn3gkxubwElu1KPdFHuRKzICDsfPO9&notify_self=1";

  useEffect(() => {
    if (!enabled) return;

    let isMounted = true;

    const connect = () => {
      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!isMounted) return;
          console.log("[PieSocket] Connected to real-time channel");
          setIsConnected(true);
        };

        ws.onmessage = (event) => {
          if (!isMounted) return;
          try {
            const raw = JSON.parse(event.data);
            // Tangani struktur payload dari PieSocket publish
            let parsedMessage: PieSocketMessage;
            if (raw.event && raw.data) {
              parsedMessage = raw as PieSocketMessage;
            } else if (typeof raw === "string") {
              parsedMessage = JSON.parse(raw);
            } else {
              parsedMessage = { event: "message", data: raw };
            }

            setLastMessage(parsedMessage);
            onMessage?.(parsedMessage);
          } catch {
            // Non-JSON ping/pong or system notice
          }
        };

        ws.onclose = () => {
          if (!isMounted) return;
          setIsConnected(false);
          console.log("[PieSocket] Disconnected. Reconnecting in 3s...");
          reconnectTimeoutRef.current = setTimeout(connect, 3000);
        };

        ws.onerror = (err) => {
          console.debug("[PieSocket] Socket error:", err);
          ws.close();
        };
      } catch (err) {
        console.debug("[PieSocket] Connection instantiation error:", err);
        reconnectTimeoutRef.current = setTimeout(connect, 4000);
      }
    };

    connect();

    return () => {
      isMounted = false;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [wsUrl, enabled]);

  return { isConnected, lastMessage };
}
