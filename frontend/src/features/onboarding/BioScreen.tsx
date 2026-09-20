import { useState } from "react";
import { Text } from "react-native";
import {
  ErrorNotice,
  Field,
  OnboardingShell,
  PrimaryButton,
} from "../../components/ui";
import { datingApi } from "../../services/dating.service";
import { colors } from "../../theme";
import { useOnboarding } from "./useOnboarding";

export function BioScreen() {
  const { state, busy, error, run } = useOnboarding();
  const profile = state.profile!;
  const [bio, setBio] = useState(profile.bio ?? "");
  return (
    <OnboardingShell
      title="Say a little more."
      subtitle="A warm, specific bio gives people an easy way to start a conversation."
      progress={55}
      footer={
        <PrimaryButton
          label="Continue"
          disabled={bio.trim().length < 10}
          loading={busy}
          onPress={() =>
            void run(
              () =>
                datingApi.profile({
                  displayName: profile.displayName,
                  dateOfBirth: profile.dateOfBirth,
                  bio: bio.trim(),
                  heightCm: profile.heightCm,
                  jobTitle: profile.jobTitle,
                  companyName: profile.companyName,
                  schoolName: profile.schoolName,
                  currentCityId: profile.currentCityId,
                  hometownCityId: profile.hometownCityId,
                }),
              "/onboarding/interests",
            )
          }
        />
      }
    >
      <Field
        label="About me"
        value={bio}
        onChangeText={setBio}
        multiline
        maxLength={500}
        placeholder="A Sunday well spent, something you're proud of, or what your friends love about you…"
      />
      <Text style={{ color: colors.muted, textAlign: "right" }}>
        {bio.length}/500
      </Text>
      <ErrorNotice message={error} />
    </OnboardingShell>
  );
}
