import Constants from "expo-constants";
import { AppState, Platform } from "react-native";
import { io } from "socket.io-client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, API_BASE_URL, getApiErrorMessage } from "../../config/api";
import { getSession } from "../../services/session.service";

export interface AppNotification {
  id: string;
  kind: string;
  category: string;
  title: string;
  body: string;
  data: {
    matchId?: string;
    planId?: string;
    venueId?: string;
    contentId?: string;
  };
  createdAt: string;
  readAt: string | null;
}
export interface NotificationPreferences {
  messages: boolean;
  dates: boolean;
  matches: boolean;
  likes: boolean;
  offers: boolean;
  push: boolean;
}
interface Page {
  items: AppNotification[];
  unread: number;
  nextCursor: { at: string; id: string } | null;
}
async function registerPush(app: "USER" | "PARTNER", prompt: boolean) {
  if (Platform.OS === "web")
    throw new Error(
      "Live notifications work here. Phone push can be enabled in the installed Android or iOS app.",
    );
  if (Constants.executionEnvironment === "storeClient")
    throw new Error(
      "Live notifications work in Expo Go. Phone push requires a development or standalone app build.",
    );
  const projectId =
    Constants.easConfig?.projectId ??
    Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId)
    throw new Error(
      "Phone push needs this app’s EAS project and push credentials configured in its build.",
    );
  const push = await import("expo-notifications");
  if (Platform.OS === "android")
    await push.setNotificationChannelAsync("mello-updates", {
      name: "Mello updates",
      importance: push.AndroidImportance.HIGH,
    });
  const permission = prompt
    ? await push.requestPermissionsAsync()
    : await push.getPermissionsAsync();
  if (permission.status !== "granted" && !prompt) return false;
  if (permission.status !== "granted")
    throw new Error(
      "Notifications are disabled in your phone settings. Enable them to receive background updates.",
    );
  const native = process.env.EXPO_PUBLIC_PUSH_TRANSPORT === "native";
  const token = native
    ? await push.getDevicePushTokenAsync()
    : await push.getExpoPushTokenAsync({ projectId });
  await api.post("/notifications/devices", {
    app,
    token: String(token.data),
    provider: native ? (Platform.OS === "android" ? "FCM" : "APNS") : "EXPO",
    projectId,
    platform: Platform.OS,
  });
  return true;
}
export function useNotifications(
  accountId: string | undefined,
  app: "USER" | "PARTNER",
  onChange: (item?: AppNotification) => void,
  onOpen: (item: AppNotification) => void,
) {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [cursor, setCursor] = useState<Page["nextCursor"]>(null);
  const [preferences, setPreferences] =
    useState<NotificationPreferences | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<AppNotification | null>(null);
  const changeRef = useRef(onChange),
    openRef = useRef(onOpen);
  changeRef.current = onChange;
  openRef.current = onOpen;
  const sequence = useRef(0),
    seen = useRef(new Set<string>()),
    initialized = useRef(false),
    alive = useRef(true);
  const refresh = useCallback(async () => {
    if (!accountId) return;
    const version = ++sequence.current;
    try {
      const { data } = await api.get<Page>("/notifications");
      if (!alive.current || sequence.current !== version) return;
      const fresh = data.items.filter((item) => !seen.current.has(item.id));
      if (initialized.current && fresh.length) {
        setToast(fresh[0]!);
        for (const category of new Set(fresh.map((item) => item.category)))
          changeRef.current(fresh.find((item) => item.category === category));
      }
      initialized.current = true;
      seen.current = new Set(
        [...data.items.map((item) => item.id), ...seen.current].slice(0, 300),
      );
      setItems(data.items);
      setUnread(data.unread);
      setCursor(data.nextCursor);
      setError(null);
    } catch (caught) {
      if (alive.current && sequence.current === version)
        setError(getApiErrorMessage(caught));
    }
  }, [accountId]);
  useEffect(() => {
    alive.current = true;
    initialized.current = false;
    seen.current.clear();
    setItems([]);
    setUnread(0);
    setToast(null);
    setPreferences(null);
    setError(null);
    if (!accountId) return;
    let disposed = false,
      refreshingAuth = false;
    let debounce: ReturnType<typeof setTimeout> | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const socket = io(
      `${API_BASE_URL.replace(/\/api\/?$/, "")}/notifications`,
      {
        autoConnect: false,
        transports: ["websocket"],
        reconnectionDelay: 1000,
        reconnectionDelayMax: 15000,
        randomizationFactor: 0.5,
        auth: (done) => {
          void getSession()
            .then((session) => done({ token: session?.tokens.accessToken }))
            .catch(() => done({}));
        },
      },
    );
    const schedule = () => {
      if (debounce) return;
      debounce = setTimeout(() => {
        debounce = undefined;
        void refresh();
      }, 120);
    };
    const reauthenticate = async () => {
      if (disposed || refreshingAuth) return;
      refreshingAuth = true;
      try {
        await api.get("/auth/me");
        if (!disposed) socket.connect();
      } catch {
        if (!disposed)
          retry = setTimeout(
            () => void reauthenticate(),
            10000 + Math.random() * 5000,
          );
      } finally {
        refreshingAuth = false;
      }
    };
    socket.on("connect", () => {
      setConnected(true);
      schedule();
    });
    socket.on("notifications:changed", schedule);
    socket.on("disconnect", (reason) => {
      if (!disposed) {
        setConnected(false);
        if (reason === "io server disconnect") void reauthenticate();
      }
    });
    socket.on(
      "connect_error",
      (failure: Error & { data?: { status?: number } }) => {
        if (!disposed) {
          setConnected(false);
          if (failure.data?.status === 401) void reauthenticate();
        }
      },
    );
    socket.connect();
    void refresh();
    void api
      .get<NotificationPreferences>("/notifications/preferences")
      .then(({ data }) => {
        if (!disposed) {
          setPreferences(data);
          if (
            data.push &&
            Platform.OS !== "web" &&
            Constants.executionEnvironment !== "storeClient"
          )
            void registerPush(app, false).catch(() => undefined);
        }
      })
      .catch(() => undefined);
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void refresh();
        changeRef.current();
        if (!socket.connected) socket.connect();
      }
    });
    // Recovery for a lost Redis signal. This is not the primary notification transport.
    const reconcile = setInterval(
      () => {
        if (AppState.currentState === "active") void refresh();
      },
      60000 + Math.random() * 30000,
    );
    let removePush: (() => void) | undefined;
    if (
      Platform.OS !== "web" &&
      Constants.executionEnvironment !== "storeClient"
    ) {
      void import("expo-notifications")
        .then(async (push) => {
          if (disposed) return;
          const open = (id: unknown) => {
            if (typeof id !== "string") return;
            void api
              .get<AppNotification>(`/notifications/${id}`)
              .then(({ data }) => {
                if (!disposed) {
                  void api
                    .post("/notifications/read", { ids: [data.id] })
                    .then(() => refresh())
                    .catch(() => undefined);
                  openRef.current(data);
                }
              })
              .catch(() => undefined);
          };
          // Avoid duplicate OS banners while our in-app toast is visible.
          push.setNotificationHandler({
            handleNotification: async () => ({
              shouldShowBanner: false,
              shouldShowList: false,
              shouldPlaySound: false,
              shouldSetBadge: false,
            }),
          });
          const incoming = push.addNotificationReceivedListener(schedule);
          const tapped = push.addNotificationResponseReceivedListener(
            (response) =>
              open(response.notification.request.content.data?.notificationId),
          );
          const changedToken = push.addPushTokenListener(() => {
            void registerPush(app, false).catch(() => undefined);
          });
          removePush = () => {
            changedToken.remove();
            incoming.remove();
            tapped.remove();
          };
          const last = await push.getLastNotificationResponseAsync();
          if (last) {
            open(last.notification.request.content.data?.notificationId);
            await push.clearLastNotificationResponseAsync();
          }
        })
        .catch(() => undefined);
    }
    return () => {
      disposed = true;
      alive.current = false;
      sequence.current++;
      clearTimeout(debounce);
      clearTimeout(retry);
      clearInterval(reconcile);
      listener.remove();
      removePush?.();
      socket.disconnect();
    };
  }, [accountId, refresh]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 6500);
    return () => clearTimeout(timer);
  }, [toast]);
  const read = async (item: AppNotification) => {
    try {
      await api.post("/notifications/read", { ids: [item.id] });
      setItems((current) =>
        current.map((row) =>
          row.id === item.id
            ? { ...row, readAt: new Date().toISOString() }
            : row,
        ),
      );
      void refresh();
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    }
  };
  return {
    items,
    unread,
    preferences,
    error,
    connected,
    loading,
    toast,
    refresh,
    dismissToast: () => setToast(null),
    open: (item: AppNotification) => {
      void read(item);
      setToast(null);
      openRef.current(item);
    },
    markAll: async () => {
      try {
        await api.post("/notifications/read", {
          before: items[0]?.createdAt ?? new Date().toISOString(),
        });
        await refresh();
      } catch (caught) {
        setError(getApiErrorMessage(caught));
      }
    },
    more: async () => {
      if (!cursor || loading) return;
      setLoading(true);
      const version = sequence.current;
      try {
        const { data } = await api.get<Page>("/notifications", {
          params: cursor,
        });
        if (version === sequence.current) {
          setItems((current) => [
            ...current,
            ...data.items.filter(
              (item) => !current.some((row) => row.id === item.id),
            ),
          ]);
          setCursor(data.nextCursor);
        }
      } catch (caught) {
        setError(getApiErrorMessage(caught));
      } finally {
        setLoading(false);
      }
    },
    hasMore: !!cursor,
    setPreference: async (
      key: keyof NotificationPreferences,
      value: boolean,
    ) => {
      if (!preferences) return;
      try {
        setPreferences(
          (
            await api.put<NotificationPreferences>(
              "/notifications/preferences",
              { ...preferences, [key]: value },
            )
          ).data,
        );
      } catch (caught) {
        setError(getApiErrorMessage(caught));
      }
    },
    enablePush: async () => {
      setError(null);
      try {
        await registerPush(app, true);
        const next =
          preferences ??
          (await api.get<NotificationPreferences>("/notifications/preferences"))
            .data;
        setPreferences(
          (
            await api.put<NotificationPreferences>(
              "/notifications/preferences",
              { ...next, push: true },
            )
          ).data,
        );
      } catch (caught) {
        setError(getApiErrorMessage(caught));
      }
    },
  };
}
