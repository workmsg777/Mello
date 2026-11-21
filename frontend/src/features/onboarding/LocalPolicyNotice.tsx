import { StyleSheet, Text } from "react-native";
import { OnboardingShell, PrimaryButton } from "../../components/ui";
import { router } from "expo-router";
import { colors } from "../../theme";

export function LocalPolicyNotice({
  document,
}: {
  document: "Terms" | "Privacy";
}) {
  const terms = document === "Terms";
  return (
    <OnboardingShell
      title={terms ? "Local test terms" : "Local test privacy notice"}
    >
      <Text style={styles.copy}>
        This notice applies to the local Mello development environment.
      </Text>
      <Text style={styles.copy}>
        {terms
          ? "Use synthetic or consented test profiles and media. Use chats and likes only for the agreed test scenarios. The test environment can be reset."
          : "The development database stores the details you enter, including your phone number, birthday, preferences, and test interactions. Uploaded photos are stored by the local backend and are eligible for public display after approval. Personalized matching is an optional choice."}
      </Text>
      <PrimaryButton
        label="Back to onboarding"
        onPress={() =>
          router.canGoBack() ? router.back() : router.replace("/onboarding")
        }
      />
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  copy: { color: colors.ink, fontSize: 16, lineHeight: 25 },
});
