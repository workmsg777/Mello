import { useState } from "react";
import { View } from "react-native";
import {
  ChoiceChip,
  ErrorNotice,
  OnboardingShell,
  PrimaryButton,
} from "../../components/ui";
import { datingApi } from "../../services/dating.service";
import { useOnboarding } from "./useOnboarding";

export function PersonalityScreen() {
  const { catalog, state, busy, error, finish, progress } = useOnboarding();
  const framework =
    catalog.personalityFrameworks.find((x) => x.code === "MBTI") ??
    catalog.personalityFrameworks[0];
  const current = state.personalityResults.find(
    (x) => x.frameworkId === framework?.id,
  );
  const [typeId, setTypeId] = useState(current?.personalityTypeId ?? "");
  return (
    <OnboardingShell
      title="A personality shorthand."
      subtitle="Optional. Pick your type if you know it—we never infer this without your choice."
      progress={progress("PERSONALITY")}
      footer={
        <View style={{ gap: 4 }}>
          <PrimaryButton
            label="Save and preview"
            disabled={!typeId || !framework}
            loading={busy}
            onPress={() =>
              framework &&
              void finish("PERSONALITY", "/onboarding/preview", false, () =>
                datingApi.personality(framework.id, typeId),
              )
            }
          />
          <PrimaryButton
            kind="ghost"
            label="Skip for now"
            disabled={busy}
            onPress={() =>
              void finish("PERSONALITY", "/onboarding/preview", true)
            }
          />
        </View>
      }
    >
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {catalog.personalityTypes
          .filter((x) => x.frameworkId === framework?.id)
          .map((type) => (
            <ChoiceChip
              key={type.id}
              label={type.code}
              selected={typeId === type.id}
              onPress={() => setTypeId(type.id)}
            />
          ))}
      </View>
      <ErrorNotice message={error} />
    </OnboardingShell>
  );
}
