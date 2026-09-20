import { useState } from "react";
import {
  ErrorNotice,
  OnboardingShell,
  PrimaryButton,
} from "../../components/ui";
import { datingApi } from "../../services/dating.service";
import { CategoryPicker, categoryInitial } from "./CategoryPicker";
import { useOnboarding } from "./useOnboarding";

const codes = [
  "RELATIONSHIP_STYLE",
  "RELIGION",
  "EDUCATION_LEVEL",
  "CHILDREN_STATUS",
  "FAMILY_PLAN",
];
export function FamilyScreen() {
  const { catalog, state, busy, error, finish, progress } = useOnboarding();
  const [selected, setSelected] = useState(() =>
    categoryInitial(codes, catalog, state),
  );
  const save = async () => {
    for (const category of catalog.profileOptionCategories.filter((c) =>
      codes.includes(c.code),
    )) {
      await datingApi.profileOptions(category.id, selected[category.id] ?? []);
      await datingApi.visibility(
        category.code,
        category.isSensitive ? "MATCHING_ONLY" : "PROFILE",
      );
    }
  };
  return (
    <OnboardingShell
      title="Relationships, family and beliefs."
      subtitle="Sensitive answers default to matching-only, not public."
      progress={progress("LIFESTYLE")}
      footer={
        <PrimaryButton
          label="Continue"
          loading={busy}
          onPress={() =>
            void finish("LIFESTYLE", "/onboarding/languages", false, save)
          }
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
