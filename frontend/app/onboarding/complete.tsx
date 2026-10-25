import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Screen, PrimaryButton } from "../../src/components/ui";
import { colors, radii } from "../../src/theme";

export default function CompleteScreen() {
  return (
    <Screen>
      <View style={styles.wrap}>
        <View style={styles.check}>
          <Text style={styles.checkText}>✓</Text>
        </View>
        <Text style={styles.title}>Your profile is live.</Text>
        <Text style={styles.copy}>
          You did the thoughtful part. Now take a breath and discover people at
          your pace.
        </Text>
        <PrimaryButton
          label="Start discovering"
          onPress={() => router.replace("/home")}
        />
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
