import { useCallback, useEffect, useRef, useState } from "react";
import { fetchBoard } from "../api";
import type { BoardState } from "../types";

const BASE = "/api";

/**
 * Load the board and keep it in sync with AI/server-side changes via SSE.
 */
export function useBoard() {
  const [board, setBoard] = useState<BoardState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await fetchBoard();
      setBoard(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let source: EventSource | null = null;

    void refresh();

    const connect = () => {
      if (cancelled) return;
      source = new EventSource(`${BASE}/events`);
      source.onopen = () => {
        if (reconnectTimer.current !== null) {
          clearTimeout(reconnectTimer.current);
          reconnectTimer.current = null;
        }
      };
      source.onmessage = () => {
        void refresh();
      };
      source.onerror = () => {
        // EventSource auto-reconnects; also refresh on reconnect.
        void refresh();
        if (reconnectTimer.current === null) {
          reconnectTimer.current = setTimeout(() => {
            reconnectTimer.current = null;
            connect();
          }, 3000);
        }
      };
    };
    connect();

    return () => {
      cancelled = true;
      if (source !== null) source.close();
      if (reconnectTimer.current !== null) clearTimeout(reconnectTimer.current);
    };
  }, [refresh]);

  return { board, loading, error, refresh };
}
