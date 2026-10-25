import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  ErrorNotice,
  Field,
  OnboardingShell,
  PrimaryButton,
} from "../../components/ui";
import { datingApi } from "../../services/dating.service";
import { colors, radii } from "../../theme";
import { useOnboarding } from "./useOnboarding";

export function PromptsScreen() {
  const { catalog, state, busy, error, finish, progress } = useOnboarding();
  const initial = Object.fromEntries(
    state.promptAnswers.map((a) => [a.promptId, a.answerText ?? ""]),
  );
  const [answers, setAnswers] = useState<Record<string, string>>(initial);
  const visible = catalog.prompts.slice(0, catalog.rules.maximumPromptAnswers);
  const save = async () => {
    let order = 0;
    for (const prompt of visible) {
      const answer = answers[prompt.id]?.trim();
      if (answer) await datingApi.promptAnswer(prompt.id, answer, order++);
    }
  };
  return (
    <OnboardingShell
      title="Give them an opening line."
      subtitle="Prompts are optional, but they make starting a real conversation much easier."
      progress={progress("PROMPTS")}
      footer={
        <View style={styles.footer}>
          <PrimaryButton
            label="Save and continue"
            loading={busy}
            onPress={() =>
              void finish("PROMPTS", "/onboarding/lifestyle", false, save)
            }
          />
          <PrimaryButton
            kind="ghost"
            label="Skip for now"
            disabled={busy}
            onPress={() =>
              void finish("PROMPTS", "/onboarding/lifestyle", true)
            }
          />
        </View>
      }
    >
      {visible.map((prompt) => (
        <View key={prompt.id} style={styles.card}>
          <Text style={styles.prompt}>{prompt.promptText}</Text>
          <Field
            label="Your answer"
            value={answers[prompt.id] ?? ""}
            onChangeText={(v) => setAnswers((x) => ({ ...x, [prompt.id]: v }))}
            multiline
            maxLength={prompt.maxAnswerLength}
            placeholder="Be specific and sound like yourself…"
          />
        </View>
      ))}
      <ErrorNotice message={error} />
    </OnboardingShell>
  );
}
const styles = StyleSheet.create({
  footer: { gap: 4 },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.medium,
    padding: 15,
    gap: 10,
  },
  prompt: {
    color: colors.plum,
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 22,
  },
});
