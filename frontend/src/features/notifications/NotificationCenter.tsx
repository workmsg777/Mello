import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  useNotifications,
  type AppNotification,
  type NotificationPreferences,
} from "./useNotifications";
export function NotificationCenter({
  accountId,
  app,
  onChange,
  onOpen,
}: {
  accountId?: string | undefined;
  app: "USER" | "PARTNER";
  onChange: (item?: AppNotification) => void;
  onOpen: (item: AppNotification) => void;
}) {
  const notifications = useNotifications(accountId, app, onChange, onOpen);
  const [open, setOpen] = useState(false),
    [settings, setSettings] = useState(false),
    [saving, setSaving] = useState(false);
  if (!accountId) return null;
  const openItem = (item: AppNotification) => {
    setOpen(false);
    notifications.open(item);
  };
  const options: [keyof NotificationPreferences, string, string][] = [
    ["messages", "New messages", "A little hello from your matches"],
    ["likes", "New likes", "See who noticed you"],
    ["matches", "Mutual matches", "When the spark goes both ways"],
    [
      "dates",
      "Dates & reservations",
      "Invitations, responses and venue updates",
    ],
    [
      "offers",
      "Nearby offers & events",
      "Published packages and events in your city",
    ],
    [
      "push",
      "Phone push notifications",
      "Updates when your app is in the background",
    ],
  ];
  return (
    <View style={s.anchor}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Notifications, ${notifications.unread} unread`}
        onPress={() => {
          setOpen(true);
          void notifications.refresh();
        }}
        style={s.bell}
      >
        <Text style={{ fontSize: 21 }}>🔔</Text>
        {notifications.unread ? (
          <View style={s.badge}>
            <Text style={s.badgeText}>
              {notifications.unread > 99 ? "99+" : notifications.unread}
            </Text>
          </View>
        ) : null}
      </Pressable>
      {notifications.toast && !open ? (
        <View style={s.toast}>
          <Pressable
            accessibilityRole="button"
            onPress={() => openItem(notifications.toast!)}
            style={{ flex: 1, gap: 5 }}
          >
            <Text style={s.title}>{notifications.toast.title}</Text>
            <Text numberOfLines={2} style={s.copy}>
              {notifications.toast.body}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss notification"
            onPress={notifications.dismissToast}
            style={s.close}
          >
            <Text style={s.link}>×</Text>
          </Pressable>
        </View>
      ) : null}
      <Modal
        visible={open}
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <SafeAreaView style={s.screen}>
          <View style={s.header}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={s.heading}>Your little updates</Text>
              <Text style={s.copy}>
                {notifications.connected
                  ? "Live updates are connected"
                  : "Reconnecting live updates…"}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close notifications"
              style={s.close}
              onPress={() => setOpen(false)}
            >
              <Text style={s.link}>×</Text>
            </Pressable>
          </View>
          <View style={s.tabs}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: !settings }}
              onPress={() => setSettings(false)}
              style={[s.tab, !settings && s.active]}
            >
              <Text style={s.link}>Updates · {notifications.unread}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: settings }}
              onPress={() => setSettings(true)}
              style={[s.tab, settings && s.active]}
            >
              <Text style={s.link}>Preferences</Text>
            </Pressable>
          </View>
          {notifications.error ? (
            <View style={s.error}>
              <Text style={s.copy}>{notifications.error}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => void notifications.refresh()}
              >
                <Text style={s.link}>Retry</Text>
              </Pressable>
            </View>
          ) : null}
          {settings ? (
            <FlatList
              data={options.filter(
                ([key]) => app === "USER" || key === "dates" || key === "push",
              )}
              keyExtractor={([key]) => key}
              contentContainerStyle={s.list}
              ListHeaderComponent={
                <Pressable
                  accessibilityRole="button"
                  disabled={saving}
                  onPress={() => {
                    setSaving(true);
                    void notifications
                      .enablePush()
                      .finally(() => setSaving(false));
                  }}
                  style={s.enable}
                >
                  <Text style={s.enableText}>
                    {saving ? "Setting up…" : "Enable phone notifications"}
                  </Text>
                  <Text style={s.enableHint}>
                    Live in-app updates work without phone push.
                  </Text>
                </Pressable>
              }
              renderItem={({ item: [key, label, hint] }) => (
                <View style={s.setting}>
                  <View style={{ flex: 1, gap: 5 }}>
                    <Text style={s.title}>{label}</Text>
                    <Text style={s.copy}>{hint}</Text>
                  </View>
                  <Switch
                    accessibilityLabel={label}
                    disabled={saving || !notifications.preferences}
                    value={notifications.preferences?.[key] ?? false}
                    onValueChange={(value) => {
                      setSaving(true);
                      void notifications
                        .setPreference(key, value)
                        .finally(() => setSaving(false));
                    }}
                  />
                </View>
              )}
            />
          ) : (
            <>
              <View style={s.actions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void notifications.markAll()}
                >
                  <Text style={s.link}>Mark all read</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void notifications.refresh()}
                >
                  <Text style={s.link}>Sync</Text>
                </Pressable>
              </View>
              <FlatList
                data={notifications.items}
                keyExtractor={(item) => item.id}
                contentContainerStyle={s.list}
                ListEmptyComponent={
                  <View style={s.empty}>
                    <Text style={s.title}>You’re all caught up.</Text>
                    <Text style={s.copy}>
                      Messages, invitations and little updates will appear here.
                    </Text>
                  </View>
                }
                renderItem={({ item }) => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${item.readAt ? "" : "Unread. "}${item.title}. ${item.body}`}
                    onPress={() => openItem(item)}
                    style={[s.card, !item.readAt && s.unread]}
                  >
                    <View style={s.row}>
                      <Text style={s.kind}>{item.category.toUpperCase()}</Text>
                      {!item.readAt ? <View style={s.dot} /> : null}
                    </View>
                    <Text style={s.title}>{item.title}</Text>
                    <Text style={s.body}>{item.body}</Text>
                    <Text style={s.time}>
                      {new Date(item.createdAt).toLocaleString()}
                    </Text>
                  </Pressable>
                )}
                ListFooterComponent={
                  notifications.hasMore ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => void notifications.more()}
                      style={s.more}
                    >
                      {notifications.loading ? (
                        <ActivityIndicator color="#653D52" />
                      ) : (
                        <Text style={s.link}>Earlier updates</Text>
                      )}
                    </Pressable>
                  ) : undefined
                }
              />
            </>
          )}
        </SafeAreaView>
      </Modal>
    </View>
  );
}
const s = StyleSheet.create({
  anchor: { position: "relative", zIndex: 100 },
  bell: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    right: 0,
    top: 0,
    backgroundColor: "#D9506F",
    minWidth: 19,
    height: 19,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: { color: "white", fontSize: 10, fontWeight: "800" },
  toast: {
    position: "absolute",
    top: 52,
    right: 0,
    width: 290,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#F0E3E2",
    borderRadius: 18,
    padding: 15,
    flexDirection: "row",
    gap: 8,
    elevation: 8,
    boxShadow: "0px 6px 22px #33252B22",
  },
  screen: { flex: 1, backgroundColor: "#FFF9F6" },
  header: { flexDirection: "row", alignItems: "center", gap: 10, padding: 22 },
  heading: { fontSize: 23, fontWeight: "700", color: "#653D52" },
  close: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  tabs: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 22,
    paddingBottom: 15,
  },
  tab: {
    borderRadius: 24,
    padding: 13,
    borderWidth: 1,
    borderColor: "#F0E3E2",
  },
  active: { backgroundColor: "#FCE7EB" },
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  list: {
    padding: 20,
    gap: 12,
    maxWidth: 760,
    width: "100%",
    alignSelf: "center",
    paddingBottom: 40,
  },
  card: {
    padding: 18,
    borderRadius: 18,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#F0E3E2",
    gap: 8,
  },
  unread: { backgroundColor: "#FFF1F4", borderColor: "#F3BCC8" },
  title: { fontSize: 15, fontWeight: "700", color: "#33252B" },
  body: { fontSize: 14, lineHeight: 22, color: "#5A424B" },
  copy: { fontSize: 12, lineHeight: 18, color: "#927E83" },
  time: { fontSize: 11, color: "#927E83" },
  kind: { fontSize: 10, letterSpacing: 1, fontWeight: "700", color: "#D9506F" },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#D9506F" },
  link: { color: "#653D52", fontSize: 13, fontWeight: "700" },
  setting: {
    paddingVertical: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#F0E3E2",
  },
  empty: { paddingVertical: 40, gap: 10 },
  more: { alignItems: "center", padding: 18 },
  error: {
    padding: 16,
    marginHorizontal: 20,
    borderRadius: 12,
    backgroundColor: "#FCE7EB",
    gap: 8,
  },
  enable: { padding: 18, borderRadius: 18, backgroundColor: "#653D52", gap: 7 },
  enableText: { color: "white", fontSize: 15, fontWeight: "700" },
  enableHint: { color: "#E8D8E0", fontSize: 12 },
});
