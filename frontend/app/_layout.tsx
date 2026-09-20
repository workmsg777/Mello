import { Stack, router } from "expo-router";
import { useEffect } from "react";
import { Provider } from "react-redux";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { registerSessionExpiredHandler } from "../src/config/api";
import { store } from "../src/store";
import { clearDatingData } from "../src/store/datingSlice";
import { bootstrapSession, sessionExpired } from "../src/store/sessionSlice";

function Navigation() {
  useEffect(() => {
    if (store.getState().session.status === "idle")
      void store.dispatch(bootstrapSession());
  }, []);
  useEffect(
    () =>
      registerSessionExpiredHandler(() => {
        store.dispatch(sessionExpired());
        store.dispatch(clearDatingData());
        router.replace("/auth");
      }),
    [],
  );
  return <Stack screenOptions={{ headerShown: false, animation: "fade" }} />;
}

export default function RootLayout() {
  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Navigation />
      </SafeAreaProvider>
    </Provider>
  );
}
