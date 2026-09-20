import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { requestOtp } from "../src/services/auth.service";
import type { AuthMode } from "../src/types/auth";
import { getApiErrorMessage } from "../src/config/api";
import {
  ErrorNotice,
  Field,
  OnboardingShell,
  PrimaryButton,
} from "../src/components/ui";
import { authenticateOtp } from "../src/store/sessionSlice";
import { useAppDispatch, useAppSelector } from "../src/store";
import { colors, radii } from "../src/theme";

export default function AuthScreen() {
  const dispatch = useAppDispatch();
  const status = useAppSelector((s) => s.session.status);
  const [mode, setMode] = useState<AuthMode>("signup");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [developmentOtp, setDevelopmentOtp] = useState<string | null>(null);
  useEffect(() => {
    if (status === "authenticated") router.replace("/");
  }, [status]);
  const digits = (value: string, max: number) =>
    value.replace(/\D/g, "").slice(0, max);
  const send = async () => {
    if (phone.length !== 10)
      return setError("Enter a valid 10-digit mobile number.");
    setBusy(true);
    setError(null);
    try {
      const result = await requestOtp(`+91${phone}`, mode);
      setDevelopmentOtp(result.developmentOtp ?? null);
      setStep("otp");
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const verify = async () => {
    if (otp.length !== 6) return setError("Enter the six-digit OTP.");
    setBusy(true);
    setError(null);
    try {
      await dispatch(
        authenticateOtp({ phone: `+91${phone}`, otp, mode }),
      ).unwrap();
      router.replace("/");
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <OnboardingShell
        title={
          step === "phone" ? "Find something real." : "Check your messages."
        }
        subtitle={
          step === "phone"
            ? "A calmer place to meet people looking for the same thing."
            : `We sent a code to +91 ${phone}.`
        }
      >
        <View style={styles.switcher}>
          <PrimaryButton
            kind={mode === "signup" ? "primary" : "ghost"}
            label="Create account"
            onPress={() => {
              setMode("signup");
              setStep("phone");
            }}
          />
          <PrimaryButton
            kind={mode === "login" ? "primary" : "ghost"}
            label="Log in"
            onPress={() => {
              setMode("login");
              setStep("phone");
            }}
          />
        </View>
        {step === "phone" ? (
          <>
            <Field
              label="Mobile number (+91)"
              value={phone}
              onChangeText={(v) => setPhone(digits(v, 10))}
              keyboardType="phone-pad"
              placeholder="98765 43210"
            />
            <ErrorNotice message={error} />
            <PrimaryButton
              label="Send me the code"
              onPress={() => void send()}
              loading={busy}
              disabled={phone.length !== 10}
            />
          </>
        ) : (
          <>
            <Field
              label="Six-digit code"
              value={otp}
              onChangeText={(v) => setOtp(digits(v, 6))}
              keyboardType="number-pad"
              placeholder="000000"
              textContentType="oneTimeCode"
            />
            {developmentOtp ? (
              <View style={styles.dev}>
                <Text style={styles.devLabel}>LOCAL TEST CODE</Text>
                <Text style={styles.devCode}>{developmentOtp}</Text>
              </View>
            ) : null}
            <ErrorNotice message={error} />
            <PrimaryButton
              label={mode === "signup" ? "Create my account" : "Log me in"}
              onPress={() => void verify()}
              loading={busy}
              disabled={otp.length !== 6}
            />
            <PrimaryButton
              kind="ghost"
              label="Use a different number"
              onPress={() => setStep("phone")}
            />
          </>
        )}
      </OnboardingShell>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  switcher: {
    flexDirection: "row",
    backgroundColor: colors.white,
    borderRadius: radii.medium,
    padding: 4,
    gap: 4,
  },
  dev: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: colors.coralSoft,
    borderRadius: radii.small,
    padding: 13,
  },
  devLabel: { color: colors.muted, fontSize: 10, fontWeight: "900" },
  devCode: { color: colors.ink, fontWeight: "900", letterSpacing: 2 },
});
