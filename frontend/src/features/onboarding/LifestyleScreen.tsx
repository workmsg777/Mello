import { useState } from "react";
import {
  ErrorNotice,
  OnboardingShell,
  PrimaryButton,
} from "../../components/ui";
import { datingApi } from "../../services/dating.service";
import { usePartnerOptions } from "./PartnerOptionChoices";
import { CategoryPicker, categoryInitial } from "./CategoryPicker";
import { useOnboarding } from "./useOnboarding";

const codes = ["DRINKING", "SMOKING", "EXERCISE", "DIET", "PETS"];
export function LifestyleScreen() {
  const { catalog, state, busy, error, run, progress } = useOnboarding();
  const [selected, setSelected] = useState(() =>
    categoryInitial(codes, catalog, state),
  );
  const partnerOptions = usePartnerOptions(catalog, state, [
    "EXERCISE",
    "PETS",
  ]);
  const save = async () => {
    for (const category of catalog.profileOptionCategories.filter((c) =>
      codes.includes(c.code),
    )) {
      await datingApi.profileOptions(category.id, selected[category.id] ?? []);
      if (!state.visibility.some((v) => v.fieldCode === category.code))
        await datingApi.visibility(category.code, "PROFILE");
    }
    await partnerOptions.save();
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
      {partnerOptions.controls}
      <ErrorNotice message={error} />
    </OnboardingShell>
  );
}
