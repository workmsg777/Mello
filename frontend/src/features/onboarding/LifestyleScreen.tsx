import { useState } from "react";
import {
  ErrorNotice,
  OnboardingShell,
  PrimaryButton,
} from "../../components/ui";
import { datingApi } from "../../services/dating.service";
import { CategoryPicker, categoryInitial } from "./CategoryPicker";
import { useOnboarding } from "./useOnboarding";

const codes = ["DRINKING", "SMOKING", "EXERCISE", "DIET", "PETS"];
export function LifestyleScreen() {
  const { catalog, state, busy, error, run, progress } = useOnboarding();
  const [selected, setSelected] = useState(() =>
    categoryInitial(codes, catalog, state),
  );
  const save = async () => {
    for (const category of catalog.profileOptionCategories.filter((c) =>
      codes.includes(c.code),
    )) {
      await datingApi.profileOptions(category.id, selected[category.id] ?? []);
      await datingApi.visibility(category.code, "PROFILE");
    }
  };
  return (
    <OnboardingShell
      title="A glimpse of everyday life."
      subtitle="All optional. Share only what feels useful."
      progress={progress("LIFESTYLE")}
      footer={
        <PrimaryButton
          label="Continue"
          loading={busy}
          onPress={() => void run(save, "/onboarding/family")}
        />
      }
    >
      <CategoryPicker
        codes={codes}
        catalog={catalog}
        state={state}
        onChange={setSelected}
      />
      <ErrorNotice message={error} />
    </OnboardingShell>
  );
}
