import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  ChoiceChip,
  ErrorNotice,
  OnboardingShell,
  PrimaryButton,
} from "../../components/ui";
import { datingApi } from "../../services/dating.service";
import { colors } from "../../theme";
import { useOnboarding } from "./useOnboarding";

export function IdentityScreen() {
  const { catalog, state, busy, error, finish, progress } = useOnboarding();
  const categories = catalog.profileOptionCategories.filter((c) =>
    ["GENDER_IDENTITY", "PRONOUN", "SEXUAL_ORIENTATION"].includes(c.code),
  );
  const initial = Object.fromEntries(
    categories.map((c) => [
      c.id,
      state.profileOptions
        .filter((x) => x.categoryId === c.id)
        .map((x) => x.optionId),
    ]),
  );
  const [selected, setSelected] = useState<Record<string, string[]>>(initial);
  const gender = categories.find((c) => c.code === "GENDER_IDENTITY");
  const toggle = (categoryId: string, optionId: string) =>
    setSelected((current) => ({
      ...current,
      [categoryId]: current[categoryId]?.includes(optionId)
        ? current[categoryId].filter((id) => id !== optionId)
        : [...(current[categoryId] ?? []), optionId],
    }));
  const save = async () => {
    for (const category of categories)
      await datingApi.profileOptions(category.id, selected[category.id] ?? []);
    await Promise.all(
      categories
        .filter((c) => c.allowProfileVisibility)
        .map((c) =>
          datingApi.visibility(
            c.code,
            c.isSensitive ? "MATCHING_ONLY" : "PROFILE",
          ),
        ),
    );
  };
  return (
    <OnboardingShell
      title="How do you identify?"
      subtitle="Choose what fits. Sensitive answers default to matching-only."
      progress={progress("IDENTITY")}
      footer={
        <PrimaryButton
          label="Continue"
          loading={busy}
          disabled={!gender || !selected[gender.id]?.length}
          onPress={() =>
            void finish(
              "IDENTITY",
              "/onboarding/match-preferences",
              false,
              save,
            )
          }
        />
      }
    >
      {categories.map((category) => (
        <View key={category.id}>
          <Text style={styles.heading}>{category.name}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {catalog.profileOptions
              .filter((o) => o.categoryId === category.id)
              .map((option) => (
                <ChoiceChip
                  key={option.id}
                  label={option.label}
                  selected={selected[category.id]?.includes(option.id) ?? false}
                  onPress={() => toggle(category.id, option.id)}
                />
              ))}
          </View>
        </View>
      ))}
      <ErrorNotice message={error} />
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  heading: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900",
    marginBottom: 10,
  },
});
