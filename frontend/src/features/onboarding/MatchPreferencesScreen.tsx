import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  ChoiceChip,
  ErrorNotice,
  OnboardingShell,
  PrimaryButton,
} from "../../components/ui";
import { datingApi } from "../../services/dating.service";
import { colors, radii } from "../../theme";
import { useOnboarding } from "./useOnboarding";

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepLabel}>{label}</Text>
      <View style={styles.stepRow}>
        <PrimaryButton
          kind="secondary"
          label="−"
          onPress={() => onChange(Math.max(min, value - 1))}
        />
        <Text style={styles.stepValue}>{value}</Text>
        <PrimaryButton
          kind="secondary"
          label="+"
          onPress={() => onChange(Math.min(max, value + 1))}
        />
      </View>
    </View>
  );
}
export function MatchPreferencesScreen() {
  const { catalog, state, busy, error, finish, progress } = useOnboarding();
  const category = catalog.profileOptionCategories.find(
    (c) => c.code === "GENDER_IDENTITY",
  );
  const [ids, setIds] = useState(
    state.optionPreferences
      .filter((x) => x.categoryId === category?.id)
      .map((x) => x.optionId),
  );
  const [minAge, setMinAge] = useState(state.matchPreferences?.minAge ?? 21);
  const [maxAge, setMaxAge] = useState(state.matchPreferences?.maxAge ?? 35);
  const [distance, setDistance] = useState(
    state.matchPreferences?.maxDistanceKm ?? 50,
  );
  const save = async () => {
    if (!category) throw new Error("Gender preference catalog is unavailable");
    await datingApi.optionPreferences(category.id, ids);
    await datingApi.matchPreferences({
      minAge,
      maxAge,
      maxDistanceKm: distance,
      ageIsDealbreaker: false,
      distanceIsDealbreaker: false,
      verifiedProfilesOnly: false,
      preferSameCity: false,
    });
  };
  return (
    <OnboardingShell
      title="Who would you like to meet?"
      subtitle="These preferences are private and only shape discovery."
      progress={progress("DISCOVERY_PREFERENCES")}
      footer={
        <PrimaryButton
          label="Continue"
          disabled={!ids.length || minAge > maxAge}
          loading={busy}
          onPress={() =>
            void finish(
              "DISCOVERY_PREFERENCES",
              "/onboarding/location",
              false,
              save,
            )
          }
        />
      }
    >
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {catalog.profileOptions
          .filter((o) => o.categoryId === category?.id)
          .map((option) => (
            <ChoiceChip
              key={option.id}
              label={option.label}
              selected={ids.includes(option.id)}
              onPress={() =>
                setIds((x) =>
                  x.includes(option.id)
                    ? x.filter((id) => id !== option.id)
                    : [...x, option.id],
                )
              }
            />
          ))}
      </View>
      <Stepper
        label="Minimum age"
        value={minAge}
        min={18}
        max={maxAge}
        onChange={setMinAge}
      />
      <Stepper
        label="Maximum age"
        value={maxAge}
        min={minAge}
        max={80}
        onChange={setMaxAge}
      />
      <Stepper
        label="Distance (km)"
        value={distance}
        min={1}
        max={500}
        onChange={setDistance}
      />
      <ErrorNotice message={error} />
    </OnboardingShell>
  );
}
const styles = StyleSheet.create({
  stepper: {
    backgroundColor: colors.white,
    borderRadius: radii.medium,
    padding: 16,
    gap: 12,
  },
  stepLabel: { color: colors.ink, fontWeight: "800" },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stepValue: { fontSize: 22, color: colors.ink, fontWeight: "900" },
});
