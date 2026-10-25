import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  useWindowDimensions,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { requestOtp } from "../src/services/auth.service";
import type { AuthMode } from "../src/types/auth";
import { getApiErrorMessage } from "../src/config/api";
import { ErrorNotice, Field, PrimaryButton } from "../src/components/ui";
import { authenticateOtp } from "../src/store/sessionSlice";
import { useAppDispatch, useAppSelector } from "../src/store";
import { RomanticHero } from "../src/features/auth/RomanticHero";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radii } from "../src/theme";

export default function AuthScreen() {
  const dispatch = useAppDispatch();
  const wide = useWindowDimensions().width >= 900;
  const status = useAppSelector((s) => s.session.status);
  const [mode, setMode] = useState<AuthMode>("signup");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [countdown, setCountdown] = useState(0);
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);
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
      setOtp("");
      setCountdown(result.retryAfter);
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
      <SafeAreaView style={styles.screen}>
        <ScrollView
          contentContainerStyle={styles.page}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.topbar}>
            <View style={styles.brand}>
              <Ionicons name="heart" size={22} color={colors.coral} />
              <Text style={styles.wordmark}>
                mello<Text style={{ color: colors.coral }}>.</Text>
              </Text>
            </View>
            <Text style={styles.topNote}>A LITTLE MORE FEELING.</Text>
          </View>
          <View style={[styles.layout, wide && styles.wide]}>
            <View style={[styles.story, wide && { flex: 1 }]}>
              <Text style={styles.eyebrow}>FOR THE BEAUTIFULLY REAL.</Text>
              <Text style={styles.headline}>
                Less small talk.
                <Text style={styles.romantic}> More butterflies.</Text>
              </Text>
              <RomanticHero />
              <Text style={styles.storyCopy}>
                A thoughtful connection. A favourite little café. A story that
                starts with you.
              </Text>
              <View style={styles.promise}>
                <Ionicons
                  name="flower-outline"
                  size={16}
                  color={colors.coral}
                />
                <Text style={styles.promiseText}>
                  Real people. Little sparks. Lovely possibilities.
                </Text>
              </View>
            </View>
            <View style={[styles.form, wide && { flex: 0.8 }]}>
              <View style={styles.formAccent} />
              <Text style={styles.eyebrow}>
                {step === "phone"
                  ? "YOUR NEXT CHAPTER STARTS HERE"
                  : "ONE LITTLE STEP CLOSER"}
              </Text>
              <Text style={styles.formTitle}>
                {step === "phone"
                  ? "Find your kind of lovely."
                  : "A little hello, verified."}
              </Text>
              <Text style={styles.formCopy}>
                {step === "phone"
                  ? "Come as you are. Something real could be waiting."
                  : `Enter the code sent to +91 ${phone}.`}
              </Text>
              <View style={styles.switcher}>
                <PrimaryButton
                  kind={mode === "signup" ? "primary" : "ghost"}
                  label="Create account"
                  onPress={() => {
                    setMode("signup");
                    setStep("phone");
                    setError(null);
                    setOtp("");
                  }}
                />
                <PrimaryButton
                  kind={mode === "login" ? "primary" : "ghost"}
                  label="Log in"
                  onPress={() => {
                    setMode("login");
                    setStep("phone");
                    setError(null);
                    setOtp("");
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
                    label={
                      mode === "signup" ? "Create my account" : "Log me in"
                    }
                    onPress={() => void verify()}
                    loading={busy}
                    disabled={otp.length !== 6}
                  />
                  <PrimaryButton
                    kind="ghost"
                    label={
                      countdown
                        ? `Resend code in ${countdown}s`
                        : "Send a new code"
                    }
                    disabled={busy || countdown > 0}
                    onPress={() => void send()}
                  />
                  <PrimaryButton
                    kind="ghost"
                    label="Use a different number"
                    onPress={() => setStep("phone")}
                  />
                </>
              )}
              <View style={styles.privacy}>
                <Ionicons
                  name="lock-closed-outline"
                  size={12}
                  color={colors.muted}
                />
                <Text style={styles.privacyText}>
                  Your number stays private. Your story stays yours.
                </Text>
              </View>
              <View style={styles.divider} />
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push("/preview")}
              >
                <Text style={styles.previewLink}>
                  A little curious? Explore a preview{" "}
                  <Ionicons name="arrow-forward" size={13} />
                </Text>
              </Pressable>
            </View>
          </View>
          <Text style={styles.bottomNote}>
            MADE FOR CONNECTIONS THAT FEEL LIKE YOU. ♡
          </Text>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  page: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 30,
    maxWidth: 1250,
    width: "100%",
    alignSelf: "center",
  },
  topbar: {
    height: 90,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: { flexDirection: "row", gap: 8, alignItems: "center" },
  wordmark: {
    fontSize: 38,
    fontWeight: "800",
    letterSpacing: -2,
    color: colors.ink,
  },
  topNote: {
    fontSize: 8,
    letterSpacing: 1.7,
    color: colors.muted,
    fontWeight: "700",
  },
  layout: { gap: 28, justifyContent: "center", flex: 1, paddingVertical: 25 },
  wide: { flexDirection: "row", alignItems: "center", gap: 75 },
  story: { alignItems: "center", maxWidth: 560, alignSelf: "center" },
  eyebrow: {
    fontSize: 9,
    color: colors.coral,
    fontWeight: "800",
    letterSpacing: 1.8,
    marginBottom: 15,
  },
  headline: {
    fontFamily: Platform.OS === "android" ? "serif" : "Georgia",
    fontSize: 46,
    lineHeight: 52,
    letterSpacing: -1.6,
    color: colors.ink,
    textAlign: "center",
    maxWidth: 480,
  },
  romantic: { fontStyle: "italic", color: colors.coral },
  storyCopy: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 23,
    textAlign: "center",
    maxWidth: 330,
  },
  promise: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 22,
  },
  promiseText: { fontSize: 10, color: colors.plum },
  form: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 30,
    padding: 28,
    maxWidth: 470,
    width: "100%",
    alignSelf: "center",
    gap: 16,
    shadowColor: "#A36D7C",
    shadowOpacity: 0.06,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  formAccent: {
    width: 35,
    height: 4,
    borderRadius: 5,
    backgroundColor: colors.rose,
    marginBottom: 7,
  },
  formTitle: {
    fontFamily: Platform.OS === "android" ? "serif" : "Georgia",
    fontSize: 32,
    color: colors.ink,
    lineHeight: 39,
    letterSpacing: -0.7,
  },
  formCopy: {
    fontSize: 13,
    color: colors.muted,
    lineHeight: 21,
    marginBottom: 8,
  },
  privacy: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  privacyText: { fontSize: 9, color: colors.muted },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: 6 },
  previewLink: {
    color: colors.coral,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "600",
  },
  bottomNote: {
    fontSize: 8,
    letterSpacing: 1.4,
    color: colors.muted,
    textAlign: "center",
    marginTop: 35,
  },
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
