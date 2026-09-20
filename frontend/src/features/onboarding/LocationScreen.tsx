import { useEffect, useState } from "react";
import { View } from "react-native";
import {
  ChoiceChip,
  ErrorNotice,
  Field,
  OnboardingShell,
  PrimaryButton,
} from "../../components/ui";
import { getApiErrorMessage } from "../../config/api";
import { datingApi } from "../../services/dating.service";
import type { City } from "../../types/dating";
import { useOnboarding } from "./useOnboarding";

export function LocationScreen() {
  const { state, busy, error, setError, finish, progress } = useOnboarding();
  const profile = state.profile!;
  const [search, setSearch] = useState("");
  const [cities, setCities] = useState<City[]>([]);
  const [selected, setSelected] = useState(profile.currentCityId);
  useEffect(() => {
    const timer = setTimeout(() => {
      void datingApi
        .cities(search)
        .then(setCities)
        .catch((e) => setError(getApiErrorMessage(e)));
    }, 250);
    return () => clearTimeout(timer);
  }, [search, setError]);
  const save = () =>
    datingApi.profile({
      displayName: profile.displayName,
      dateOfBirth: profile.dateOfBirth,
      bio: profile.bio,
      heightCm: profile.heightCm,
      jobTitle: profile.jobTitle,
      companyName: profile.companyName,
      schoolName: profile.schoolName,
      currentCityId: selected,
      hometownCityId: profile.hometownCityId,
    });
  return (
    <OnboardingShell
      title="Where are you based?"
      subtitle="We show your city, never your precise location."
      progress={progress("LOCATION")}
      footer={
        <PrimaryButton
          label="Continue"
          disabled={!selected}
          loading={busy}
          onPress={() =>
            void finish("LOCATION", "/onboarding/photos", false, save)
          }
        />
      }
    >
      <Field
        label="Search cities"
        value={search}
        onChangeText={setSearch}
        placeholder="Delhi, Mumbai, Bengaluru…"
      />
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {cities.map((city) => (
          <ChoiceChip
            key={city.id}
            label={`${city.name}${city.stateName ? `, ${city.stateName}` : ""}`}
            selected={selected === city.id}
            onPress={() => setSelected(city.id)}
          />
        ))}
      </View>
      <ErrorNotice message={error} />
    </OnboardingShell>
  );
}
