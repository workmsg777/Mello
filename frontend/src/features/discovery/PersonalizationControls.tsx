import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { datingApi } from "../../services/dating.service";
import { useAppDispatch, useAppSelector } from "../../store";
import { refreshDatingState } from "../../store/datingSlice";
import { getApiErrorMessage } from "../../config/api";
import { colors } from "../../theme";

export function PersonalizationControls({
  onChanged,
}: {
  onChanged: () => Promise<void>;
}) {
  const dispatch = useAppDispatch();
  const { catalog, state } = useAppSelector((store) => store.dating);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const version = catalog?.consent.policyVersion;
  const latestConsent = state?.consents.find(
    (consent) => consent.consentCode === "PERSONALIZED_MATCHING",
  );
  const enabled =
    latestConsent?.policyVersion === version &&
    latestConsent?.status === "GRANTED";
  const toggle = async () => {
    if (!version || busy) return;
    setBusy(true);
    setError(null);
    try {
      await datingApi.consent("PERSONALIZED_MATCHING", version, !enabled);
      await dispatch(refreshDatingState()).unwrap();
      await onChanged();
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  };
  return (
    <View
      style={{
        padding: 14,
        gap: 8,
        borderRadius: 16,
        backgroundColor: "white",
        marginBottom: 14,
      }}
    >
      <Text style={{ color: colors.plum, fontWeight: "600" }}>
        Personalized matching {enabled ? "on" : "off"}
      </Text>
      <Text style={{ color: colors.muted, fontSize: 12 }}>
        Allow my interests, preferences and written answers to be used for
        matching. Alignment percentages appear when both people opt in and
        enough profile information is available. AI may compare my written
        answers when enabled.
      </Text>
      <Pressable
        accessibilityRole="button"
        disabled={busy || !version}
        onPress={() => void toggle()}
      >
        <Text style={{ color: colors.coral, fontWeight: "600" }}>
          {busy
            ? "Saving…"
            : enabled
              ? "Turn personalization off"
              : "Turn personalization on"}
        </Text>
      </Pressable>
      {error && (
        <Text accessibilityRole="alert" style={{ color: colors.coral }}>
          {error}
        </Text>
      )}
    </View>
  );
}
