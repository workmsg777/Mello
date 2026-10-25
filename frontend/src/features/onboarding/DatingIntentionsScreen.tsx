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
          disabled={!ids.length}
          loading={busy}
          onPress={() =>
            void finish("DATING_INTENTIONS", "/onboarding/bio", false, () =>
              datingApi.profileOptions(category.id, ids),
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
      <ErrorNotice message={error} />
    </OnboardingShell>
  );
}
