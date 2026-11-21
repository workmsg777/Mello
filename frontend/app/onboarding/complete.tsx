import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Screen, PrimaryButton } from "../../src/components/ui";
import { colors, radii } from "../../src/theme";
import { useAppSelector } from "../../src/store";
import { photoReviewStatus } from "../../src/utils/photo-review";

export default function CompleteScreen() {
  const { state, catalog } = useAppSelector((store) => store.dating);
  const minimum = catalog?.rules.minimumPhotos ?? 3;
  const photos = photoReviewStatus(state, minimum);
  return (
    <Screen>
      <View style={styles.wrap}>
        <View style={styles.check}>
          <Text style={styles.checkText}>✓</Text>
        </View>
        <Text style={styles.title}>
          {photos.ready
            ? "Your profile is live."
            : photos.awaitingReview
              ? "Your photos are awaiting review."
              : "Your profile is saved."}
        </Text>
        <Text style={styles.copy}>
          {photos.ready
            ? "You’re ready to discover people at your pace."
            : `You have ${photos.approved} of ${minimum} approved public photos. Discover opens when you reach ${minimum}.`}
        </Text>
        <PrimaryButton
          label={photos.ready ? "Start discovering" : "View Discover status"}
          onPress={() => router.replace("/home")}
        />
        {!photos.ready && (
          <PrimaryButton
            kind="secondary"
            label="Manage photos"
            onPress={() => router.push("/onboarding/photos")}
          />
        )}
      </View>
    </Screen>
  );
}
const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: "center", gap: 18 },
  check: {
    width: 76,
    height: 76,
    borderRadius: radii.large,
    backgroundColor: colors.coral,
    alignItems: "center",
    justifyContent: "center",
  },
  checkText: { color: colors.ink, fontSize: 38, fontWeight: "900" },
  title: {
    color: colors.ink,
    fontSize: 38,
    fontWeight: "900",
    letterSpacing: -1,
  },
  copy: { color: colors.muted, fontSize: 16, lineHeight: 24, marginBottom: 15 },
});
