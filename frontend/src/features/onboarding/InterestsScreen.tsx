import { useState } from "react";
import { Text, View } from "react-native";
import {
  ChoiceChip,
  ErrorNotice,
  OnboardingShell,
  PrimaryButton,
} from "../../components/ui";
import { datingApi } from "../../services/dating.service";
import { colors } from "../../theme";
import { useOnboarding } from "./useOnboarding";

export function InterestsScreen() {
  const { catalog, state, busy, error, finish, progress } = useOnboarding();
  const [ids, setIds] = useState(state.interests.map((x) => x.interestId));
  const toggle = (id: string) =>
    setIds((x) =>
      x.includes(id)
        ? x.filter((v) => v !== id)
        : x.length < catalog.rules.maximumInterests
          ? [...x, id]
          : x,
    );
  return (
    <OnboardingShell
      title="What lights you up?"
      subtitle={`Choose ${catalog.rules.minimumInterests}–${catalog.rules.maximumInterests} interests.`}
      progress={progress("INTERESTS")}
      footer={
        <PrimaryButton
          label="Continue"
          disabled={ids.length < catalog.rules.minimumInterests}
          loading={busy}
          onPress={() =>
            void finish("INTERESTS", "/onboarding/prompts", false, () =>
              datingApi.interests(ids),
            )
          }
        />
      }
    >
      <Text style={{ color: colors.coral, fontWeight: "900" }}>
        {ids.length} selected
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {catalog.interests.map((item) => (
          <ChoiceChip
            key={item.id}
            label={item.name}
            selected={ids.includes(item.id)}
            onPress={() => toggle(item.id)}
          />
        ))}
      </View>
      <ErrorNotice message={error} />
    </OnboardingShell>
  );
}
