import { useState } from "react";
import { Switch, Text, View } from "react-native";
import {
  ErrorNotice,
  Field,
  OnboardingShell,
  PrimaryButton,
} from "../../components/ui";
import { datingApi } from "../../services/dating.service";
import { useOnboarding } from "./useOnboarding";

export function BasicProfileScreen() {
  const { state, busy, error, finish, progress } = useOnboarding();
  const profile = state.profile;
  const [displayName, setDisplayName] = useState(profile?.displayName ?? "");
  const [dateOfBirth, setDateOfBirth] = useState(profile?.dateOfBirth ?? "");
  const [jobTitle, setJobTitle] = useState(profile?.jobTitle ?? "");
  const savedJobVisibility = state.visibility.find(
    (field) => field.fieldCode === "JOB",
  )?.visibility;
  const [showJobTitle, setShowJobTitle] = useState(
    savedJobVisibility === "PROFILE",
  );
  const [height, setHeight] = useState(profile?.heightCm?.toString() ?? "");
  const valid =
    displayName.trim().length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth);
  return (
    <OnboardingShell
      title="First, the basics."
      subtitle="Use the name you want people to see. Your birthday stays private."
      progress={progress("BASIC_PROFILE")}
      footer={
        <PrimaryButton
          label="Continue"
          disabled={!valid}
          loading={busy}
          onPress={() =>
            void finish(
              "BASIC_PROFILE",
              "/onboarding/identity",
              false,
              async () => {
                await datingApi.profile({
                  displayName: displayName.trim(),
                  dateOfBirth,
                  bio: profile?.bio ?? null,
                  heightCm: height ? Number(height) : null,
                  jobTitle: jobTitle.trim() || null,
                  companyName: profile?.companyName ?? null,
                  schoolName: profile?.schoolName ?? null,
                  currentCityId: profile?.currentCityId ?? null,
                  hometownCityId: profile?.hometownCityId ?? null,
                });
                if (showJobTitle !== (savedJobVisibility === "PROFILE"))
                  await datingApi.visibility(
                    "JOB",
                    showJobTitle ? "PROFILE" : "PRIVATE",
                  );
              },
            )
          }
        />
      }
    >
      <Field
        label="Display name"
        value={displayName}
        onChangeText={setDisplayName}
        placeholder="What should we call you?"
        maxLength={100}
      />
      <Field
        label="Date of birth (YYYY-MM-DD)"
        value={dateOfBirth}
        onChangeText={setDateOfBirth}
        placeholder="1998-05-24"
        keyboardType="numbers-and-punctuation"
        maxLength={10}
      />
      <Field
        label="Job title (optional)"
        value={jobTitle}
        onChangeText={setJobTitle}
        placeholder="Product designer"
        maxLength={150}
      />
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <Text>Show job title on my public profile</Text>
        <Switch
          accessibilityLabel="Show job title on my public profile"
          value={showJobTitle}
          onValueChange={setShowJobTitle}
        />
      </View>
      <Field
        label="Height in cm (optional)"
        value={height}
        onChangeText={(v) => setHeight(v.replace(/\D/g, "").slice(0, 3))}
        placeholder="172"
        keyboardType="number-pad"
      />
      <ErrorNotice message={error} />
    </OnboardingShell>
  );
}
