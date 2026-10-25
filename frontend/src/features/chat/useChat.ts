import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import type { Socket } from "socket.io-client";
import { api, getApiErrorMessage } from "../../config/api";
import { chatApi, createChatSocket } from "../../services/chat.service";
import type { ChatMessage, ConversationSummary } from "../../types/chat";

import { mergeMessages, messageId } from "./message-state";

type Reply<T> =
  { ok: true; data: T } | { ok: false; error: string; status: number };
export function useChat(
  userId: string | undefined,
  demo: boolean,
  onMatched: () => void,
) {
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});
  const [summaries, setSummaries] = useState<ConversationSummary[]>([]);
  const [cursors, setCursors] = useState<Record<string, number | null>>({});
  const [typing, setTyping] = useState<Record<string, number>>({});
  const [connection, setConnection] = useState<
    "connecting" | "connected" | "offline"
  >(demo ? "connected" : "connecting");
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const syncedThrough = useRef<Record<string, number>>({});
  const pending = useRef<ChatMessage[]>([]);
  const sending = useRef(new Set<string>());
  const writeQueue = useRef<Promise<unknown>>(Promise.resolve());
  const deliveryQueue = useRef<Promise<unknown>>(Promise.resolve());
  const matchedRef = useRef(onMatched);
  matchedRef.current = onMatched;
  const key = `mello.chat.outbox.v1.${userId}`;
  const mounted = useRef(true);
  const add = useCallback((message: ChatMessage) => {
    setMessages((current) => ({
      ...current,
      [message.matchId]: mergeMessages(current[message.matchId] ?? [], [
        message,
      ]),
    }));
  }, []);
  const persist = useCallback(() => {
    const snapshot = JSON.stringify(pending.current);
    // Serialize writes so late storage operations cannot resurrect acknowledged messages.
    writeQueue.current = writeQueue.current
      .catch(() => undefined)
      .then(() => AsyncStorage.setItem(key, snapshot));
    return writeQueue.current;
  }, [key]);
  const refresh = useCallback(async () => {
    if (demo || !userId) return;
    try {
      const result = await chatApi.conversations();
      if (mounted.current) {
        setSummaries(result);
        setError(null);
      }
    } catch (caught) {
      if (mounted.current) setError(getApiErrorMessage(caught));
    }
  }, [demo, userId]);
  const loadHistory = useCallback(
    async (matchId: string, before?: number) => {
      if (demo) return;
      const history = await chatApi.history(matchId, before);
      if (!mounted.current) return;
      const known = syncedThrough.current[matchId] ?? 0;
      // Backfill missed pages after reconnect instead of keeping only the latest 50 messages.
      if (before === undefined && known > 0) {
        let cursor = history.nextBefore;
        while (cursor && history.messages[0]!.sequence > known + 1) {
          const page = await chatApi.history(matchId, cursor);
          history.messages = [...page.messages, ...history.messages];
          cursor = page.nextBefore;
        }
      }
      if (before === undefined && history.messages.length)
        syncedThrough.current[matchId] =
          history.messages[history.messages.length - 1]!.sequence;
      setMessages((current) => ({
        ...current,
        [matchId]: mergeMessages(current[matchId] ?? [], history.messages),
      }));
      setCursors((current) => ({
        ...current,
        [matchId]:
          before !== undefined || !(matchId in current)
            ? history.nextBefore
            : current[matchId]!,
      }));
      setSummaries((current) =>
        current.map((item) =>
          item.matchId === matchId
            ? {
                ...item,
                peerReadSequence: Math.max(
                  item.peerReadSequence,
                  history.peerReadSequence,
                ),
              }
            : item,
        ),
      );
    },
    [demo],
  );
  const accept = useCallback(
    (message: ChatMessage) => {
      pending.current = pending.current.filter(
        (item) => item.clientMessageId !== message.clientMessageId,
      );
      void persist().catch(() =>
        setError("Couldn’t update locally saved messages."),
      );
      add(message);
    },
    [add, persist],
  );
  const deliver = useCallback(
    async (message: ChatMessage) => {
      const socket = socketRef.current;
      if (!socket?.connected || sending.current.has(message.clientMessageId))
        return;
      sending.current.add(message.clientMessageId);
      add({ ...message, delivery: "sending" });
      try {
        const reply = (await socket.timeout(8000).emitWithAck("chat:send", {
          matchId: message.matchId,
          clientMessageId: message.clientMessageId,
          body: message.body,
        })) as Reply<ChatMessage>;
        if (!reply.ok) throw new Error(reply.error);
        accept(reply.data);
        void refresh();
      } catch (caught) {
        // A timeout may happen after a successful commit. Keep the same client ID on retry.
        if (
          pending.current.some(
            (item) => item.clientMessageId === message.clientMessageId,
          )
        ) {
          const failed: ChatMessage = {
            ...message,
            delivery: socket.connected ? "failed" : "queued",
            error: getApiErrorMessage(caught),
          };
          pending.current = pending.current.map((item) =>
            item.clientMessageId === message.clientMessageId ? failed : item,
          );
          add(failed);
          void persist().catch(() => undefined);
        }
      } finally {
        sending.current.delete(message.clientMessageId);
      }
    },
    [accept, add, persist, refresh],
  );
  const send = useCallback(
    async (matchId: string, body: string) => {
      const message: ChatMessage = {
        id: messageId(Crypto.getRandomValues),
        clientMessageId: messageId(Crypto.getRandomValues),
        matchId,
        senderId: userId ?? "demo-me",
        sequence: 0,
        body: body.trim(),
        createdAt: new Date().toISOString(),
        delivery: "queued",
      };
      if (!message.body || message.body.length > 2000) return;
      if (demo) {
        // Explicit design preview: no fabricated reply from another person.
        add({ ...message, sequence: Date.now(), delivery: undefined });
        return;
      }
      pending.current.push(message);
      try {
        await persist();
      } catch {
        pending.current = pending.current.filter((item) => item !== message);
        throw new Error(
          "Couldn’t save this message on your device. Please retry.",
        );
      }
      add(message);
      deliveryQueue.current = deliveryQueue.current
        .catch(() => undefined)
        .then(() => deliver(message));
    },
    [userId, demo, add, persist, deliver],
  );
  const read = useCallback(
    async (matchId: string, messageId: string) => {
      if (demo) return;
      await chatApi.read(matchId, messageId);
      void refresh();
    },
    [demo, refresh],
  );
  const emitTyping = useCallback((matchId: string, value: boolean) => {
    socketRef.current?.volatile.emit(
      "chat:typing",
      { matchId, typing: value },
      () => undefined,
    );
  }, []);
  useEffect(() => {
    mounted.current = true;
    if (demo || !userId) return;
    let disposed = false,
      refreshingAuth = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const socket = createChatSocket();
    socketRef.current = socket;
    const sync = () => {
      void refresh();
      matchedRef.current();
    };
    const reauthenticate = async () => {
      if (refreshingAuth || disposed) return;
      refreshingAuth = true;
      try {
        await api.get("/auth/me");
        if (!disposed) socket.connect();
      } catch {
        if (!disposed) {
          setConnection("offline");
          retryTimer = setTimeout(() => {
            void reauthenticate();
          }, 5000);
        }
      } finally {
        refreshingAuth = false;
      }
    };
    socket.on("connect", () => {
      setConnection("connected");
      setError(null);
      sync();
      for (const message of pending.current)
        deliveryQueue.current = deliveryQueue.current
          .catch(() => undefined)
          .then(() => deliver(message));
    });
    socket.on("disconnect", (reason) => {
      if (disposed) return;
      setConnection("offline");
      if (reason === "io server disconnect") void reauthenticate();
    });
    socket.on(
      "connect_error",
      (caught: Error & { data?: { status?: number } }) => {
        setConnection("offline");
        if (caught.data?.status === 401) void reauthenticate();
        else if (!socket.active && caught.data?.status !== 403) {
          retryTimer = setTimeout(() => {
            if (!disposed) socket.connect();
          }, 5000);
        } else if (caught.data?.status === 403) setError(caught.message);
      },
    );
    socket.on("chat:message", (message: ChatMessage) => {
      accept(message);
      void refresh();
    });
    socket.on(
      "chat:read",
      (receipt: {
        matchId: string;
        userId: string;
        lastReadSequence: number;
      }) => {
        if (receipt.userId !== userId)
          setSummaries((current) =>
            current.map((item) =>
              item.matchId === receipt.matchId
                ? {
                    ...item,
                    peerReadSequence: Math.max(
                      item.peerReadSequence,
                      receipt.lastReadSequence,
                    ),
                  }
                : item,
            ),
          );
        else void refresh();
      },
    );
    socket.on("chat:typing", (event: { matchId: string; typing: boolean }) => {
      setTyping((current) => ({
        ...current,
        [event.matchId]: event.typing ? Date.now() + 4000 : 0,
      }));
    });
    socket.on("chat:matched", sync);
    socket.on("discovery:liked", sync);
    void (async () => {
      try {
        const saved = JSON.parse(
          (await AsyncStorage.getItem(key)) ?? "[]",
        ) as ChatMessage[];
        if (disposed) return;
        pending.current = Array.isArray(saved)
          ? saved.filter(
              (item) =>
                item.senderId === userId &&
                typeof item.body === "string" &&
                typeof item.clientMessageId === "string",
            )
          : [];
        pending.current.forEach(add);
      } catch {
        if (!disposed)
          setError("Couldn’t restore unsent messages on this device.");
      }
      if (!disposed) {
        void refresh();
        socket.connect();
      }
    })();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        sync();
        if (!socket.connected) socket.connect();
      }
    });
    const timer = setInterval(() => {
      if (AppState.currentState === "active") void refresh();
    }, 20000);
    return () => {
      disposed = true;
      mounted.current = false;
      clearInterval(timer);
      clearTimeout(retryTimer);
      subscription.remove();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [demo, userId, accept, add, deliver, key, refresh]);
  return {
    messages,
    summaries,
    cursors,
    typing,
    connection,
    error,
    refresh,
    loadHistory,
    send,
    read,
    emitTyping,
    retry: deliver,
  };
}
export type ChatState = ReturnType<typeof useChat>;
