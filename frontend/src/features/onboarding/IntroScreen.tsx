import { Link, router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import {
  ErrorNotice,
  OnboardingShell,
  PrimaryButton,
} from "../../components/ui";
import { datingApi } from "../../services/dating.service";
import { colors, radii } from "../../theme";
import { stepByCode } from "../../utils/onboarding";
import { useOnboarding } from "./useOnboarding";

function publishedPolicy(url: string | undefined): url is `https://${string}` {
  return url?.startsWith("https://") === true;
}

export function IntroScreen() {
  const { catalog, state, busy, error, run } = useOnboarding();
  const termsUrl = process.env.EXPO_PUBLIC_MELLO_TERMS_URL?.trim();
  const privacyUrl = process.env.EXPO_PUBLIC_MELLO_PRIVACY_URL?.trim();
  const terms = publishedPolicy(termsUrl)
    ? termsUrl
    : __DEV__
      ? "/terms"
      : null;
  const privacy = publishedPolicy(privacyUrl)
    ? privacyUrl
    : __DEV__
      ? "/privacy"
      : null;
  const begin = () =>
    run(async () => {
      for (const code of catalog.consent.requiredCodes)
        await datingApi.consent(code, catalog.consent.policyVersion);
      const first = stepByCode(catalog, "BASIC_PROFILE");
      await datingApi.start(catalog.onboardingVersion, first.id);
    }, "/onboarding/basic-profile");
  return (
    <OnboardingShell
      title="Let's build a profile that feels like you."
      subtitle="You control what is public. Sensitive answers can stay private or be used only for matching."
      progress={3}
    >
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Before we begin</Text>
        <Text style={styles.cardText}>
          You must be 18 or older. Your exact birthday, consent history and
          precise location are never shown on your public profile.
        </Text>
      </View>
      {terms || privacy ? (
        <View style={styles.links}>
          {terms ? (
            <Link href={terms} style={styles.link}>
              {terms === "/terms" ? "Local test terms" : "Terms of Service"}
            </Link>
          ) : null}
          {privacy ? (
            <Link href={privacy} style={styles.link}>
              {privacy === "/privacy"
                ? "Local test privacy notice"
                : "Privacy Policy"}
            </Link>
          ) : null}
        </View>
      ) : null}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Save as you go</Text>
        <Text style={styles.cardText}>
          Every answer is saved to your account, so you can close the app and
          resume on any device.
        </Text>
      </View>
      <ErrorNotice message={error} />
      <PrimaryButton
        label={
          state.onboarding.progress
            ? "Continue my profile"
            : "I agree — start my profile"
        }
        loading={busy}
        onPress={() =>
          state.onboarding.progress
            ? router.replace("/onboarding/basic-profile")
            : void begin()
        }
      />
    </OnboardingShell>
  );
}
const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    padding: 18,
    borderRadius: radii.medium,
    borderWidth: 1,
    borderColor: colors.line,
  },
  cardTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 7,
  },
  cardText: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  links: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  link: {
    color: colors.plum,
    textDecorationLine: "underline",
    fontWeight: "700",
  },
});
