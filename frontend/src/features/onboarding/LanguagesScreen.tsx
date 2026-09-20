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

export function LanguagesScreen() {
  const { catalog, state, busy, error, finish, progress } = useOnboarding();
  const [ids, setIds] = useState(state.languages.map((x) => x.languageId));
  const toggle = (id: string) =>
    setIds((x) => (x.includes(id) ? x.filter((v) => v !== id) : [...x, id]));
  return (
    <OnboardingShell
      title="Which languages do you speak?"
      subtitle="The first selected language is marked as your primary language."
      progress={progress("LANGUAGES")}
      footer={
        <View style={{ gap: 4 }}>
          <PrimaryButton
            label="Save and continue"
            disabled={!ids.length}
            loading={busy}
            onPress={() =>
              void finish("LANGUAGES", "/onboarding/values", false, () =>
                datingApi.languages(ids),
              )
            }
          />
          <PrimaryButton
            kind="ghost"
            label="Skip for now"
            disabled={busy}
            onPress={() => void finish("LANGUAGES", "/onboarding/values", true)}
          />
        </View>
      }
    >
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {catalog.languages.map((item) => (
          <ChoiceChip
            key={item.id}
            label={`${item.name}${item.nativeName && item.nativeName !== item.name ? ` · ${item.nativeName}` : ""}`}
            selected={ids.includes(item.id)}
            onPress={() => toggle(item.id)}
          />
        ))}
      </View>
      <ErrorNotice message={error} />
    </OnboardingShell>
  );
}
