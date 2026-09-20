import { Redirect, router } from "expo-router";
import { useEffect, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { absoluteMediaUrl } from "../src/config/api";
import { LoadingScreen, PrimaryButton, Screen } from "../src/components/ui";
import { datingApi } from "../src/services/dating.service";
import { useAppDispatch, useAppSelector } from "../src/store";
import { clearDatingData } from "../src/store/datingSlice";
import { signOut } from "../src/store/sessionSlice";
import { colors, radii } from "../src/theme";
import type { ProfilePreview } from "../src/types/dating";

export default function HomeScreen() {
  const dispatch = useAppDispatch();
  const sessionStatus = useAppSelector((state) => state.session.status);
  const [preview, setPreview] = useState<ProfilePreview | null>(null);
  useEffect(() => {
    if (sessionStatus === "authenticated")
      void datingApi.preview().then(setPreview);
  }, [sessionStatus]);
  if (sessionStatus === "anonymous") return <Redirect href="/auth" />;
  if (!preview) return <LoadingScreen />;
  return (
    <Screen>
      <Text style={styles.kicker}>MELLO</Text>
      <Text style={styles.title}>
        Ready when you are, {preview.profile.displayName}.
      </Text>
      <Text style={styles.copy}>
        Discovery is the next product surface. Your persisted dating profile and
        onboarding state are ready.
      </Text>
      {preview.photos[0]?.url ? (
        <Image
          source={{ uri: absoluteMediaUrl(preview.photos[0].url) }}
          style={styles.photo}
        />
      ) : null}
      <View style={styles.actions}>
        <PrimaryButton
          kind="secondary"
          label="Review my public profile"
          onPress={() => router.push("/onboarding/preview")}
        />
        <PrimaryButton
          kind="ghost"
          label="Sign out"
          onPress={() =>
            void dispatch(signOut())
              .unwrap()
              .then(() => {
                dispatch(clearDatingData());
                router.replace("/auth");
              })
          }
        />
      </View>
    </Screen>
  );
}
const styles = StyleSheet.create({
  kicker: {
    color: colors.coral,
    fontWeight: "900",
    letterSpacing: 2,
    marginTop: 20,
  },
  title: {
    color: colors.ink,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "900",
    marginTop: 12,
  },
  copy: { color: colors.muted, lineHeight: 22, marginTop: 10 },
  photo: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: radii.large,
    marginTop: 24,
  },
  actions: { gap: 7, marginTop: 20 },
});
