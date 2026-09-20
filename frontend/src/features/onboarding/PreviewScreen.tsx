import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { absoluteMediaUrl, getApiErrorMessage } from "../../config/api";
import {
  ErrorNotice,
  LoadingScreen,
  OnboardingShell,
  PrimaryButton,
} from "../../components/ui";
import { datingApi } from "../../services/dating.service";
import { colors, radii } from "../../theme";
import type { ProfilePreview } from "../../types/dating";
import { useOnboarding } from "./useOnboarding";

export function PreviewScreen() {
  const { catalog, state, busy, error, setError, run } = useOnboarding();
  const [preview, setPreview] = useState<ProfilePreview | null>(null);
  useEffect(() => {
    void datingApi
      .preview()
      .then(setPreview)
      .catch((e) => setError(getApiErrorMessage(e)));
  }, [setError]);
  if (!preview) return <LoadingScreen label="Building your preview…" />;
  const completed = state.onboarding.progress?.status === "COMPLETED";
  const complete = () =>
    run(
      () => datingApi.complete(catalog.onboardingVersion),
      "/onboarding/complete",
    );
  return (
    <OnboardingShell
      title="This is how you'll appear."
      subtitle="Only profile-visible fields are shown below. Matching-only answers remain private."
      progress={98}
      footer={
        <PrimaryButton
          label={completed ? "Back to home" : "Publish my profile"}
          loading={busy}
          onPress={() =>
            completed ? router.replace("/home") : void complete()
          }
        />
      }
    >
      <View style={styles.card}>
        {preview.photos[0]?.url ? (
          <Image
            source={{ uri: absoluteMediaUrl(preview.photos[0].url) }}
            style={styles.hero}
          />
        ) : null}
        <View style={styles.copy}>
          <Text style={styles.name}>
            {preview.profile.displayName}, {preview.profile.age}
          </Text>
          {preview.profile.currentCity ? (
            <Text style={styles.city}>{preview.profile.currentCity.name}</Text>
          ) : null}
          {preview.profile.bio ? (
            <Text style={styles.bio}>{preview.profile.bio}</Text>
          ) : null}
          <View style={styles.tags}>
            {preview.profileOptions.map((x) => (
              <Text
                key={`${x.categoryCode}-${x.optionCode}`}
                style={styles.tag}
              >
                {x.label}
              </Text>
            ))}
            {preview.interests.map((x) => (
              <Text key={x.id} style={styles.tag}>
                {x.name}
              </Text>
            ))}
          </View>
          {preview.prompts.map((x) => (
            <View key={x.promptId} style={styles.prompt}>
              <Text style={styles.question}>{x.promptText}</Text>
              <Text style={styles.answer}>{x.answerText}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={styles.privacy}>
        <Text style={styles.privacyTitle}>Privacy check</Text>
        <Text style={styles.privacyText}>
          Your date of birth, preferences, consent history, and matching-only
          identity answers are not included in this public response.
        </Text>
      </View>
      <ErrorNotice message={error} />
      {!completed ? (
        <PrimaryButton
          kind="secondary"
          label="Edit my profile"
          onPress={() => router.push("/onboarding/basic-profile")}
        />
      ) : null}
    </OnboardingShell>
  );
}
const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.large,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
  },
  hero: { width: "100%", aspectRatio: 0.85 },
  copy: { padding: 20, gap: 8 },
  name: { color: colors.ink, fontSize: 28, fontWeight: "900" },
  city: { color: colors.muted, fontWeight: "700" },
  bio: { color: colors.inkSoft, lineHeight: 22, marginTop: 7 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 8 },
  tag: {
    backgroundColor: colors.coralSoft,
    color: colors.plum,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    fontWeight: "700",
  },
  prompt: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  question: { color: colors.plum, fontSize: 12, fontWeight: "900" },
  answer: { color: colors.ink, fontSize: 17, lineHeight: 23, marginTop: 5 },
  privacy: {
    backgroundColor: "#E9F4EF",
    padding: 16,
    borderRadius: radii.medium,
  },
  privacyTitle: { color: colors.success, fontWeight: "900" },
  privacyText: { color: colors.inkSoft, lineHeight: 20, marginTop: 5 },
});
