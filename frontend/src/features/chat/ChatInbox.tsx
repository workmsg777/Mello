import Ionicons from "@expo/vector-icons/Ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { ProfilePhoto } from "../../components/ProfilePhoto";
import { getApiErrorMessage } from "../../config/api";
import { colors } from "../../theme";
import type { ChatMessage } from "../../types/chat";
import type { Match } from "../../types/discovery";
import type { ChatState } from "./useChat";

const time = (value: string) =>
  new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
export function ChatInbox({
  matches,
  userId,
  activeId,
  onSelect,
  onPlan,
  chat,
  demo,
}: {
  matches: Match[];
  userId: string;
  activeId: string | null;
  onSelect: (match: Match | null) => void;
  onPlan: (match: Match) => void;
  chat: ChatState;
  demo: boolean;
}) {
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const match = matches.find((item) => item.id === activeId);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clock, setClock] = useState(Date.now());
  const [foreground, setForeground] = useState(
    AppState.currentState === "active",
  );
  const [submitting, setSubmitting] = useState(false);
  const [visibleMessage, setVisibleMessage] = useState<ChatMessage | null>(
    null,
  );
  const onVisibleMessages = useRef(
    ({ viewableItems }: { viewableItems: Array<{ item: ChatMessage }> }) => {
      const visible = viewableItems
        .map((item) => item.item)
        .filter((item) => item.sequence > 0)
        .sort((a, b) => b.sequence - a.sequence);
      setVisibleMessage(visible[0] ?? null);
    },
  ).current;
  const viewability = useRef({ itemVisiblePercentThreshold: 50 }).current;
  const typingAt = useRef(0);
  const readAt = useRef<Record<string, number>>({});
  const draftWrites = useRef<Promise<unknown>>(Promise.resolve());
  const draftKey = `mello.chat.draft.v1.${userId}.${activeId}`;
  const messages = match ? (chat.messages[match.id] ?? []) : [];
  const summary = chat.summaries.find((item) => item.matchId === activeId);
  const latest = visibleMessage?.matchId === activeId ? visibleMessage : null;
  const ordered = [...matches].sort((a, b) => {
    const last = (id: string) =>
      chat.summaries.find((item) => item.matchId === id)?.lastMessage
        ?.createdAt;
    return (
      new Date(last(b.id) ?? b.createdAt).getTime() -
      new Date(last(a.id) ?? a.createdAt).getTime()
    );
  });
  useEffect(() => {
    if (!activeId) return;
    let active = true;
    setError(null);
    setLoading(true);
    setDraft("");
    setVisibleMessage(null);
    void chat
      .loadHistory(activeId)
      .catch((caught) => {
        if (active) setError(getApiErrorMessage(caught));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    void AsyncStorage.getItem(draftKey)
      .then((saved) => {
        if (active && saved) setDraft(saved);
      })
      .catch(() => undefined);
    return () => {
      active = false;
      chat.emitTyping(activeId, false);
    };
  }, [activeId, chat.loadHistory, chat.emitTyping, draftKey]);
  useEffect(() => {
    if (activeId && chat.connection === "connected")
      void chat
        .loadHistory(activeId)
        .catch((caught) => setError(getApiErrorMessage(caught)));
  }, [activeId, chat.connection, chat.loadHistory]);
  useEffect(() => {
    const visibility = () =>
      setForeground(
        AppState.currentState === "active" &&
          (typeof document === "undefined" ||
            document.visibilityState !== "hidden"),
      );
    const subscription = AppState.addEventListener("change", visibility);
    if (typeof document !== "undefined")
      document.addEventListener("visibilitychange", visibility);
    const timer = setInterval(() => {
      setClock(Date.now());
    }, 1500);
    return () => {
      subscription.remove();
      clearInterval(timer);
      if (typeof document !== "undefined")
        document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  useEffect(() => {
    if (
      !activeId ||
      !latest ||
      !foreground ||
      loading ||
      (readAt.current[activeId] ?? 0) >= latest.sequence
    )
      return;
    readAt.current[activeId] = latest.sequence;
    void chat.read(activeId, latest.id).catch(() => {
      readAt.current[activeId] = 0;
    });
  }, [activeId, latest?.sequence, foreground, loading, chat.read, clock]);
  // Foreground catch-up also covers the small commit-to-broadcast failure window.
  useEffect(() => {
    if (!activeId || demo) return;
    const timer = setInterval(() => {
      if (foreground) void chat.loadHistory(activeId).catch(() => undefined);
    }, 15000);
    return () => clearInterval(timer);
  }, [activeId, foreground, demo, chat.loadHistory]);
  const edit = (value: string) => {
    setDraft(value);
    draftWrites.current = draftWrites.current
      .catch(() => undefined)
      .then(() => AsyncStorage.setItem(draftKey, value));
    if (activeId && Date.now() - typingAt.current > 1500) {
      typingAt.current = Date.now();
      chat.emitTyping(activeId, !!value.trim());
    }
  };
  const send = async () => {
    if (!match || !draft.trim() || submitting) return;
    const text = draft;
    setSubmitting(true);
    setError(null);
    try {
      await chat.send(match.id, text);
      edit("");
      chat.emitTyping(match.id, false);
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  };
  const older = async () => {
    if (!match || !chat.cursors[match.id] || loading) return;
    setLoading(true);
    setError(null);
    try {
      await chat.loadHistory(match.id, chat.cursors[match.id]!);
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  };
  const bubble = ({ item }: { item: ChatMessage }) => {
    const mine = item.senderId === userId;
    const seen =
      mine &&
      item.sequence > 0 &&
      item.sequence <= (summary?.peerReadSequence ?? 0);
    return (
      <View style={[s.messageRow, mine && { alignItems: "flex-end" }]}>
        <View style={[s.bubble, mine ? s.mine : s.theirs]}>
          <Text selectable style={[s.messageText, mine && { color: "white" }]}>
            {item.body}
          </Text>
        </View>
        <Text style={s.messageMeta}>
          {time(item.createdAt)}
          {mine
            ? ` · ${item.delivery === "queued" ? "Waiting for connection" : item.delivery === "sending" ? "Sending…" : item.delivery === "failed" ? "Not sent" : seen ? "Read ♥" : "Sent"}`
            : ""}
        </Text>
        {item.delivery === "failed" ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry sending message"
            onPress={() => void chat.retry(item)}
          >
            <Text style={s.retry}>
              {item.error ?? "Couldn’t send"} · Tap to retry
            </Text>
          </Pressable>
        ) : null}
      </View>
    );
  };
  return (
    <View style={[s.layout, { flex: 1, minHeight: 0 }]}>
      {wide || !match ? (
        <View
          style={[
            s.inbox,
            wide
              ? { width: 310, borderRightWidth: 1, flexGrow: 0 }
              : { flex: 1 },
          ]}
        >
          <View style={s.inboxHeading}>
            <Text style={s.inboxTitle}>Your conversations</Text>
            <Text style={s.small}>{matches.length} connections</Text>
          </View>
          <ScrollView contentContainerStyle={{ padding: 12, gap: 6 }}>
            {ordered.map((item) => {
              const info = chat.summaries.find(
                (value) => value.matchId === item.id,
              );
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Chat with ${item.person.profile.displayName}`}
                  key={item.id}
                  onPress={() => onSelect(item)}
                  style={[s.conversation, activeId === item.id && s.selected]}
                >
                  <ProfilePhoto
                    url={item.person.photos[0]?.url}
                    style={s.avatar}
                  />
                  <View style={{ flex: 1, gap: 5 }}>
                    <Text numberOfLines={1} style={s.name}>
                      {item.person.profile.displayName}
                    </Text>
                    <Text numberOfLines={1} style={s.preview}>
                      {info?.lastMessage
                        ? `${info.lastMessage.senderId === userId ? "You: " : ""}${info.lastMessage.body}`
                        : "You matched. Say a little hello ♡"}
                    </Text>
                  </View>
                  {info?.unreadCount ? (
                    <View style={s.badge}>
                      <Text style={s.badgeText}>
                        {info.unreadCount > 99 ? "99+" : info.unreadCount}
                      </Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}
      {wide || match ? (
        <KeyboardAvoidingView
          style={s.thread}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {match ? (
            <>
              <View style={s.threadHeader}>
                {!wide ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Back to conversations"
                    onPress={() => onSelect(null)}
                    style={s.iconButton}
                  >
                    <Ionicons name="arrow-back" size={22} color={colors.plum} />
                  </Pressable>
                ) : null}
                <ProfilePhoto
                  url={match.person.photos[0]?.url}
                  style={s.headerAvatar}
                />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={s.name}>
                    {match.person.profile.displayName}
                  </Text>
                  <Text style={s.small}>
                    {demo
                      ? "Design preview · messages stay on this page"
                      : chat.connection === "connected"
                        ? "A little hello can go a long way"
                        : "Reconnecting · unsent messages stay saved"}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Plan a date with this match"
                  onPress={() => onPlan(match)}
                  style={s.plan}
                >
                  <Ionicons name="cafe-outline" size={17} color={colors.plum} />
                  <Text style={s.planText}>Plan a date</Text>
                </Pressable>
              </View>
              {demo ? (
                <Text style={s.banner}>
                  Interactive preview. These messages are not sent to a real
                  person.
                </Text>
              ) : chat.connection !== "connected" ? (
                <Text style={s.banner}>
                  Connecting to chat… You can write now; messages send when
                  connected.
                </Text>
              ) : null}
              <FlatList
                onViewableItemsChanged={onVisibleMessages}
                viewabilityConfig={viewability}
                style={{ flex: 1 }}
                inverted
                data={[...messages].reverse()}
                keyExtractor={(item) => item.clientMessageId}
                renderItem={bubble}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ padding: 20, flexGrow: 1 }}
                ListEmptyComponent={
                  <View style={s.welcome}>
                    <Text style={s.heart}>♡</Text>
                    <Text style={s.welcomeTitle}>It starts with hello.</Text>
                    <Text style={s.welcomeCopy}>
                      You and {match.person.profile.displayName} liked each
                      other. Ask about something in their profile, or share a
                      little about your day.
                    </Text>
                  </View>
                }
                ListFooterComponent={
                  chat.cursors[match.id] ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => void older()}
                      style={{ padding: 15 }}
                    >
                      <Text style={[s.retry, { textAlign: "center" }]}>
                        {loading ? "Loading…" : "Load earlier messages"}
                      </Text>
                    </Pressable>
                  ) : undefined
                }
              />
              {loading && !messages.length ? (
                <ActivityIndicator color={colors.coral} />
              ) : null}
              <Text style={s.typing}>
                {(chat.typing[match.id] ?? 0) > clock
                  ? `${match.person.profile.displayName} is typing…`
                  : ""}
              </Text>
              {error || chat.error ? (
                <Text accessibilityRole="alert" style={s.error}>
                  {error ?? chat.error}
                </Text>
              ) : null}
              <View style={s.composer}>
                <TextInput
                  accessibilityLabel="Message"
                  placeholder="Say something lovely…"
                  placeholderTextColor={colors.muted}
                  value={draft}
                  onChangeText={edit}
                  multiline
                  maxLength={2000}
                  style={s.input}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Send message"
                  disabled={!draft.trim() || submitting}
                  onPress={() => void send()}
                  style={[
                    s.send,
                    (!draft.trim() || submitting) && { opacity: 0.4 },
                  ]}
                >
                  <Ionicons name="arrow-up" size={24} color="white" />
                </Pressable>
              </View>
              <Text style={s.footer}>
                {draft.length > 1800 ? `${draft.length}/2000 · ` : ""}Be
                curious. Be kind. Be yourself.
              </Text>
            </>
          ) : (
            <View style={s.welcome}>
              <Text style={s.heart}>♡</Text>
              <Text style={s.welcomeTitle}>
                A little spark. A real conversation.
              </Text>
              <Text style={s.welcomeCopy}>
                Choose a connection to start chatting. When you’re ready to
                meet, you can plan a date together here.
              </Text>
            </View>
          )}
        </KeyboardAvoidingView>
      ) : null}
    </View>
  );
}
const s = StyleSheet.create({
  layout: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "white",
  },
  inbox: { borderColor: colors.line, flexShrink: 0, flexGrow: 1 },
  inboxHeading: {
    padding: 22,
    borderBottomWidth: 1,
    borderColor: colors.line,
    gap: 6,
  },
  inboxTitle: { color: colors.plum, fontSize: 17, fontWeight: "700" },
  small: { color: colors.muted, fontSize: 10, lineHeight: 15 },
  conversation: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 16,
  },
  selected: { backgroundColor: colors.cream },
  avatar: { width: 50, height: 58, borderRadius: 16 },
  name: { fontSize: 14, fontWeight: "700", color: colors.ink },
  preview: { color: colors.muted, fontSize: 11, lineHeight: 17 },
  badge: {
    backgroundColor: colors.coral,
    borderRadius: 20,
    minWidth: 22,
    height: 22,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  badgeText: { color: "white", fontSize: 10, fontWeight: "700" },
  thread: { flex: 3, minWidth: 0, backgroundColor: "#FFFCFA" },
  threadHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 16,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderColor: colors.line,
  },
  headerAvatar: { width: 40, height: 44, borderRadius: 14 },
  iconButton: { padding: 4 },
  plan: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 9,
    backgroundColor: colors.cream,
    borderRadius: 12,
  },
  planText: { color: colors.plum, fontSize: 10 },
  banner: {
    color: colors.plum,
    fontSize: 10,
    padding: 10,
    backgroundColor: colors.coralSoft,
    textAlign: "center",
  },
  messageRow: { alignItems: "flex-start", marginBottom: 16 },
  bubble: {
    maxWidth: "85%",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
  },
  mine: { backgroundColor: colors.coral, borderBottomRightRadius: 5 },
  theirs: { backgroundColor: "#F3EBEF", borderBottomLeftRadius: 5 },
  messageText: { fontSize: 14, lineHeight: 21, color: colors.ink },
  messageMeta: {
    fontSize: 9,
    color: colors.muted,
    marginTop: 5,
    marginHorizontal: 4,
  },
  retry: { fontSize: 11, color: colors.coral, paddingVertical: 7 },
  welcome: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    gap: 12,
  },
  heart: { fontSize: 52, color: colors.coral },
  welcomeTitle: {
    fontSize: 24,
    textAlign: "center",
    color: colors.plum,
    fontWeight: "600",
  },
  welcomeCopy: {
    maxWidth: 360,
    fontSize: 13,
    lineHeight: 21,
    textAlign: "center",
    color: colors.muted,
  },
  typing: {
    height: 22,
    paddingHorizontal: 24,
    fontSize: 10,
    color: colors.coral,
  },
  error: {
    color: colors.danger,
    fontSize: 11,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    marginHorizontal: 16,
    padding: 8,
    borderRadius: 23,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: colors.line,
  },
  input: {
    flex: 1,
    maxHeight: 110,
    minHeight: 40,
    padding: 10,
    color: colors.ink,
    fontSize: 14,
  },
  send: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.coral,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    fontSize: 9,
    color: colors.muted,
    textAlign: "center",
    padding: 10,
  },
});
