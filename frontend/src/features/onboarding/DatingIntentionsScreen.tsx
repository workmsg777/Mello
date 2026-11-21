import { useState } from "react";
import { Text, View } from "react-native";
import {
  ChoiceChip,
  ErrorNotice,
  OnboardingShell,
  PrimaryButton,
} from "../../components/ui";
import {
  datingApi,
  type IntentionSettings,
} from "../../services/dating.service";
import { useOnboarding } from "./useOnboarding";

export function DatingIntentionsScreen() {
  const { catalog, state, busy, error, finish, progress } = useOnboarding();
  const category = catalog.profileOptionCategories.find(
    (c) => c.code === "DATING_INTENTION",
  )!;
  const [ids, setIds] = useState(
    state.profileOptions
      .filter((x) => x.categoryId === category.id)
      .map((x) => x.optionId),
  );
  const saved = state.optionPreferences.filter(
    (p) => p.categoryId === category.id,
  );
  const [visibility, setVisibility] = useState<IntentionSettings["visibility"]>(
    state.visibility.find((v) => v.fieldCode === category.code)?.visibility ??
      "MATCHING_ONLY",
  );
  const [strength, setStrength] = useState<IntentionSettings["strength"]>(
    saved.some((p) => p.isDealbreaker)
      ? "REQUIRE"
      : state.profile?.preferSharedIntention === false
        ? "OPEN"
        : "PREFER",
  );
  const [partnerIds, setPartnerIds] = useState(saved.map((p) => p.optionId));
  const toggle = (id: string) =>
    setIds((current) =>
      current.includes(id)
        ? current.filter((x) => x !== id)
        : current.length < 2
          ? [...current, id]
          : [current[1]!, id],
    );
  return (
    <OnboardingShell
      title="What are you hoping to find?"
      subtitle="Pick up to two. You can change this any time."
      progress={progress("DATING_INTENTIONS")}
      footer={
        <PrimaryButton
          label="Continue"
          disabled={
            !ids.length || (strength === "REQUIRE" && !partnerIds.length)
          }
          loading={busy}
          onPress={() =>
            void finish("DATING_INTENTIONS", "/onboarding/bio", false, () =>
              datingApi.profileOptions(category.id, ids, {
                visibility,
                strength,
                partnerOptionIds: partnerIds,
              }),
            )
          }
        />
      }
    >
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {catalog.profileOptions
          .filter((x) => x.categoryId === category.id)
          .map((option) => (
            <ChoiceChip
              key={option.id}
              label={option.label}
              selected={ids.includes(option.id)}
              onPress={() => toggle(option.id)}
            />
          ))}
      </View>
      <Text>Who can see your goals?</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {(
          [
            ["PROFILE", "Show on profile"],
            ["MATCHING_ONLY", "Matching only"],
            ["PRIVATE", "Keep private"],
          ] as const
        ).map(([v, label]) => (
          <ChoiceChip
            key={v}
            label={label}
            selected={visibility === v}
            onPress={() => setVisibility(v)}
          />
        ))}
      </View>
      <Text>Which goals would you welcome in a partner?</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {(
          [
            ["OPEN", "Any goal"],
            ["PREFER", "Prefer"],
            ["REQUIRE", "Must match"],
          ] as const
        ).map(([v, label]) => (
          <ChoiceChip
            key={v}
            label={label}
            selected={strength === v}
            onPress={() => setStrength(v)}
          />
        ))}
      </View>
      {strength !== "OPEN" && (
        <>
          <Text>
            {strength === "REQUIRE"
              ? "Choose at least one acceptable goal."
              : "Choose acceptable goals, or leave blank to prefer shared goals."}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {catalog.profileOptions
              .filter((o) => o.categoryId === category.id)
              .map((o) => (
                <ChoiceChip
                  key={o.id}
                  label={o.label}
                  selected={partnerIds.includes(o.id)}
                  onPress={() =>
                    setPartnerIds((current) =>
                      current.includes(o.id)
                        ? current.filter((id) => id !== o.id)
                        : [...current, o.id],
                    )
                  }
                />
              ))}
          </View>
        </>
      )}
      <ErrorNotice message={error} />
    </OnboardingShell>
  );
}
