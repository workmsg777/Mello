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

export function ValuesScreen() {
  const { catalog, state, busy, error, finish, progress } = useOnboarding();
  const [mine, setMine] = useState(state.values.map((x) => x.valueId));
  const [partner, setPartner] = useState(
    state.partnerValuePreferences.map((x) => x.valueId),
  );
  const toggle = (id: string, values: string[], set: (v: string[]) => void) =>
    set(values.includes(id) ? values.filter((x) => x !== id) : [...values, id]);
  const save = async () => {
    await datingApi.values(mine);
    await datingApi.partnerValues(partner);
  };
  return (
    <OnboardingShell
      title="What matters most?"
      subtitle="Your values can be different from what you prioritize in a partner."
      progress={progress("VALUES")}
      footer={
        <View style={{ gap: 4 }}>
          <PrimaryButton
            label="Save and continue"
            loading={busy}
            onPress={() =>
              void finish("VALUES", "/onboarding/personality", false, save)
            }
          />
          <PrimaryButton
            kind="ghost"
            label="Skip for now"
            disabled={busy}
            onPress={() =>
              void finish("VALUES", "/onboarding/personality", true)
            }
          />
        </View>
      }
    >
      <Text style={{ color: colors.ink, fontWeight: "900", fontSize: 17 }}>
        Important to me
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {catalog.values.map((v) => (
          <ChoiceChip
            key={v.id}
            label={v.name}
            selected={mine.includes(v.id)}
            onPress={() => toggle(v.id, mine, setMine)}
          />
        ))}
      </View>
      <Text style={{ color: colors.ink, fontWeight: "900", fontSize: 17 }}>
        Important in a partner
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {catalog.values.map((v) => (
          <ChoiceChip
            key={v.id}
            label={v.name}
            selected={partner.includes(v.id)}
            onPress={() => toggle(v.id, partner, setPartner)}
          />
        ))}
      </View>
      <ErrorNotice message={error} />
    </OnboardingShell>
  );
}
