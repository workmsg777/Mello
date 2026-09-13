import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { API_BASE_URL, getApiErrorMessage } from '../config/api';
import {
  logout,
  requestOtp,
  restoreSession,
  verifyOtp,
} from '../services/auth.service';
import type { AuthMode, StoredSession } from '../types/auth';

type AuthStep = 'phone' | 'otp';

const onlyDigits = (value: string, maxLength: number): string =>
  value.replace(/\D/g, '').slice(0, maxLength);

export function DatingAuthScreen() {
  const [mode, setMode] = useState<AuthMode>('signup');
  const [step, setStep] = useState<AuthStep>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [developmentOtp, setDevelopmentOtp] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [session, setSession] = useState<StoredSession | null>(null);
  const otpInput = useRef<TextInput>(null);

  useEffect(() => {
    let active = true;
    void restoreSession().then((storedSession) => {
      if (!active) return;
      setSession(storedSession);
      setRestoring(false);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((current) => Math.max(current - 1, 0));
    }, 1_000);
    return () => clearInterval(timer);
  }, [countdown]);

  const fullPhone = `+91${phone}`;

  const handleRequestOtp = async () => {
    if (phone.length !== 10) {
      setError('Enter a valid 10-digit mobile number.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await requestOtp(fullPhone, mode);
      setDevelopmentOtp(response.developmentOtp ?? null);
      setCountdown(response.retryAfter);
      setStep('otp');
      setTimeout(() => otpInput.current?.focus(), 150);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) {
      setError('Enter the 6-digit OTP.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const authenticatedSession = await verifyOtp(fullPhone, otp, mode);
      setSession(authenticatedSession);
      setOtp('');
      setDevelopmentOtp(null);
    } catch (verifyError) {
      setError(getApiErrorMessage(verifyError));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0 || loading) return;
    setOtp('');
    await handleRequestOtp();
  };

  const changeMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setStep('phone');
    setOtp('');
    setError(null);
    setDevelopmentOtp(null);
    setCountdown(0);
  };

  const handleLogout = async () => {
    if (!session || loading) return;
    setLoading(true);
    try {
      await logout(session);
      setSession(null);
      setStep('phone');
      setPhone('');
    } catch (logoutError) {
      setError(getApiErrorMessage(logoutError));
    } finally {
      setLoading(false);
    }
  };

  if (restoring) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <View style={styles.brandMarkSmall}>
          <Text style={styles.brandHeart}>♥</Text>
        </View>
        <ActivityIndicator color="#f66f61" size="large" />
      </SafeAreaView>
    );
  }

  if (session) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.glowTop} />
        <View style={styles.successContent}>
          <View style={styles.successIcon}>
            <Text style={styles.successIconText}>✓</Text>
          </View>
          <Text style={styles.eyebrow}>WELCOME TO MELLO</Text>
          <Text style={styles.successTitle}>You’re all set.</Text>
          <Text style={styles.successCopy}>
            Your dating profile is ready. The next screen can now become your
            discovery dashboard.
          </Text>

          <View style={styles.accountCard}>
            <View>
              <Text style={styles.accountLabel}>ACCOUNT TYPE</Text>
              <Text style={styles.accountValue}>Dating user</Text>
            </View>
            <View style={styles.activePill}>
              <View style={styles.activeDot} />
              <Text style={styles.activeText}>{session.account.status}</Text>
            </View>
            <View style={styles.divider} />
            <Text style={styles.accountLabel}>ACCOUNT ID</Text>
            <Text numberOfLines={1} style={styles.accountId}>
              {session.account.id}
            </Text>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Pressable
            accessibilityRole="button"
            disabled={loading}
            onPress={handleLogout}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.buttonPressed,
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#f8f4ec" />
            ) : (
              <Text style={styles.secondaryButtonText}>Sign out</Text>
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={styles.brandRow}>
              <View style={styles.brandMark}>
                <Text style={styles.brandHeart}>♥</Text>
              </View>
              <Text style={styles.brandName}>mello</Text>
            </View>
            <View style={styles.accountTypePill}>
              <View style={styles.pillDot} />
              <Text style={styles.accountTypeText}>DATING USER</Text>
            </View>
            <Text style={styles.heroTitle}>
              {step === 'phone' ? 'Find something real.' : 'One last little step.'}
            </Text>
            <Text style={styles.heroCopy}>
              {step === 'phone'
                ? 'A calmer place to meet people who are looking for the same thing.'
                : `We sent a six-digit code to +91 ${phone.slice(0, 5)} ${phone.slice(5)}.`}
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.modeSwitcher}>
              <Pressable
                onPress={() => changeMode('signup')}
                style={[
                  styles.modeButton,
                  mode === 'signup' && styles.modeButtonActive,
                ]}
              >
                <Text
                  style={[
                    styles.modeText,
                    mode === 'signup' && styles.modeTextActive,
                  ]}
                >
                  Create account
                </Text>
              </Pressable>
              <Pressable
                onPress={() => changeMode('login')}
                style={[
                  styles.modeButton,
                  mode === 'login' && styles.modeButtonActive,
                ]}
              >
                <Text
                  style={[
                    styles.modeText,
                    mode === 'login' && styles.modeTextActive,
                  ]}
                >
                  Log in
                </Text>
              </Pressable>
            </View>

            {step === 'phone' ? (
              <>
                <Text style={styles.inputLabel}>Mobile number</Text>
                <View style={styles.phoneInputRow}>
                  <View style={styles.countryCode}>
                    <Text style={styles.flag}>🇮🇳</Text>
                    <Text style={styles.countryCodeText}>+91</Text>
                  </View>
                  <TextInput
                    accessibilityLabel="Mobile number"
                    autoComplete="tel"
                    keyboardType="phone-pad"
                    maxLength={10}
                    onChangeText={(value) => setPhone(onlyDigits(value, 10))}
                    placeholder="98765 43210"
                    placeholderTextColor="#96918a"
                    returnKeyType="done"
                    style={styles.phoneInput}
                    value={phone}
                  />
                </View>
                <Text style={styles.helperText}>
                  We’ll text you a one-time code. Standard SMS rates may apply.
                </Text>

                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                <Pressable
                  accessibilityRole="button"
                  disabled={loading || phone.length !== 10}
                  onPress={handleRequestOtp}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    (loading || phone.length !== 10) && styles.buttonDisabled,
                    pressed && styles.buttonPressed,
                  ]}
                >
                  {loading ? (
                    <ActivityIndicator color="#201d2b" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Send me the code</Text>
                  )}
                </Pressable>
              </>
            ) : (
              <>
                <View style={styles.otpLabelRow}>
                  <Text style={styles.inputLabel}>Verification code</Text>
                  <Pressable
                    onPress={() => {
                      setStep('phone');
                      setOtp('');
                      setError(null);
                    }}
                  >
                    <Text style={styles.editNumber}>Edit number</Text>
                  </Pressable>
                </View>
                <TextInput
                  ref={otpInput}
                  accessibilityLabel="Six-digit verification code"
                  autoComplete="sms-otp"
                  keyboardType="number-pad"
                  maxLength={6}
                  onChangeText={(value) => setOtp(onlyDigits(value, 6))}
                  placeholder="•  •  •  •  •  •"
                  placeholderTextColor="#918c85"
                  style={styles.otpInput}
                  textContentType="oneTimeCode"
                  value={otp}
                />

                {developmentOtp ? (
                  <View style={styles.developmentOtp}>
                    <Text style={styles.developmentOtpLabel}>LOCAL TEST CODE</Text>
                    <Text style={styles.developmentOtpValue}>
                      {developmentOtp}
                    </Text>
                  </View>
                ) : null}

                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                <Pressable
                  accessibilityRole="button"
                  disabled={loading || otp.length !== 6}
                  onPress={handleVerifyOtp}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    (loading || otp.length !== 6) && styles.buttonDisabled,
                    pressed && styles.buttonPressed,
                  ]}
                >
                  {loading ? (
                    <ActivityIndicator color="#201d2b" />
                  ) : (
                    <Text style={styles.primaryButtonText}>
                      {mode === 'signup' ? 'Create my account' : 'Log me in'}
                    </Text>
                  )}
                </Pressable>

                <Pressable
                  disabled={countdown > 0 || loading}
                  onPress={handleResend}
                  style={styles.resendButton}
                >
                  <Text
                    style={[
                      styles.resendText,
                      countdown > 0 && styles.resendTextDisabled,
                    ]}
                  >
                    {countdown > 0
                      ? `Send another code in ${countdown}s`
                      : 'Send another code'}
                  </Text>
                </Pressable>
              </>
            )}
          </View>

          <Text style={styles.terms}>
            By continuing, you agree to Mello’s Terms and Privacy Policy.
          </Text>
          <Text numberOfLines={1} style={styles.apiHint}>
            API: {API_BASE_URL}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: {
    flex: 1,
    backgroundColor: '#201d2b',
  },
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    backgroundColor: '#201d2b',
  },
  glowTop: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    top: -190,
    right: -100,
    backgroundColor: '#6b3342',
    opacity: 0.72,
  },
  glowBottom: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    bottom: -160,
    left: -120,
    backgroundColor: '#3d485c',
    opacity: 0.55,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 24,
  },
  header: {
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    marginBottom: 24,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
  },
  brandMark: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    backgroundColor: '#f66f61',
    transform: [{ rotate: '-4deg' }],
  },
  brandMarkSmall: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f66f61',
  },
  brandHeart: {
    color: '#201d2b',
    fontSize: 22,
    fontWeight: '900',
  },
  brandName: {
    color: '#f8f4ec',
    fontSize: 27,
    fontWeight: '800',
    letterSpacing: -1,
  },
  accountTypePill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 99,
    backgroundColor: 'rgba(248,244,236,0.1)',
    marginBottom: 15,
  },
  pillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 7,
    backgroundColor: '#f2b8a0',
  },
  accountTypeText: {
    color: '#d9d3ca',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  heroTitle: {
    color: '#f8f4ec',
    fontSize: 39,
    lineHeight: 44,
    fontWeight: '800',
    letterSpacing: -1.5,
    marginBottom: 10,
  },
  heroCopy: {
    maxWidth: 350,
    color: '#bbb4b5',
    fontSize: 15,
    lineHeight: 23,
  },
  card: {
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    padding: 20,
    borderRadius: 28,
    backgroundColor: '#f8f4ec',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
  },
  modeSwitcher: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 14,
    marginBottom: 22,
    backgroundColor: '#eae5dc',
  },
  modeButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 11,
  },
  modeButtonActive: {
    backgroundColor: '#ffffff',
    elevation: 2,
  },
  modeText: {
    color: '#837d78',
    fontSize: 13,
    fontWeight: '700',
  },
  modeTextActive: {
    color: '#201d2b',
  },
  inputLabel: {
    color: '#342f39',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 9,
  },
  phoneInputRow: {
    height: 58,
    flexDirection: 'row',
    borderWidth: 1.5,
    borderColor: '#ded8ce',
    borderRadius: 16,
    backgroundColor: '#fffdfa',
    overflow: 'hidden',
  },
  countryCode: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    borderRightWidth: 1,
    borderRightColor: '#e5dfd6',
  },
  flag: {
    fontSize: 18,
    marginRight: 7,
  },
  countryCodeText: {
    color: '#342f39',
    fontSize: 15,
    fontWeight: '700',
  },
  phoneInput: {
    flex: 1,
    color: '#201d2b',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.8,
    paddingHorizontal: 14,
  },
  helperText: {
    color: '#88817a',
    fontSize: 11,
    lineHeight: 17,
    marginTop: 9,
  },
  primaryButton: {
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    marginTop: 20,
    backgroundColor: '#f66f61',
  },
  primaryButtonText: {
    color: '#201d2b',
    fontSize: 15,
    fontWeight: '900',
  },
  secondaryButton: {
    width: '100%',
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(248,244,236,0.25)',
    borderRadius: 17,
    marginTop: 24,
  },
  secondaryButtonText: {
    color: '#f8f4ec',
    fontSize: 15,
    fontWeight: '800',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonPressed: {
    transform: [{ scale: 0.985 }],
  },
  otpLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  editNumber: {
    color: '#ca4f48',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 9,
  },
  otpInput: {
    height: 66,
    color: '#201d2b',
    fontSize: 25,
    fontWeight: '800',
    letterSpacing: 10,
    textAlign: 'center',
    borderWidth: 1.5,
    borderColor: '#ded8ce',
    borderRadius: 16,
    backgroundColor: '#fffdfa',
  },
  developmentOtp: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 12,
    backgroundColor: '#eee8de',
  },
  developmentOtpLabel: {
    color: '#77716b',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  developmentOtpValue: {
    color: '#342f39',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 2,
  },
  resendButton: {
    alignItems: 'center',
    paddingTop: 17,
    paddingBottom: 2,
  },
  resendText: {
    color: '#ca4f48',
    fontSize: 12,
    fontWeight: '800',
  },
  resendTextDisabled: {
    color: '#99928b',
  },
  errorText: {
    color: '#b33131',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 12,
  },
  terms: {
    alignSelf: 'center',
    maxWidth: 320,
    color: '#8e888f',
    fontSize: 10,
    lineHeight: 15,
    textAlign: 'center',
    marginTop: 18,
  },
  apiHint: {
    alignSelf: 'center',
    maxWidth: 360,
    color: '#65616b',
    fontSize: 9,
    marginTop: 7,
  },
  successContent: {
    flex: 1,
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  successIcon: {
    width: 68,
    height: 68,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    backgroundColor: '#f66f61',
    transform: [{ rotate: '-4deg' }],
  },
  successIconText: {
    color: '#201d2b',
    fontSize: 33,
    fontWeight: '900',
  },
  eyebrow: {
    color: '#f2b8a0',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.8,
    marginBottom: 10,
  },
  successTitle: {
    color: '#f8f4ec',
    fontSize: 38,
    fontWeight: '800',
    letterSpacing: -1.2,
  },
  successCopy: {
    maxWidth: 330,
    color: '#bcb5ba',
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 10,
  },
  accountCard: {
    width: '100%',
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(248,244,236,0.12)',
    borderRadius: 20,
    marginTop: 28,
    backgroundColor: 'rgba(248,244,236,0.07)',
  },
  accountLabel: {
    color: '#8f8991',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.3,
  },
  accountValue: {
    color: '#f8f4ec',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 4,
  },
  activePill: {
    position: 'absolute',
    top: 20,
    right: 18,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 99,
    backgroundColor: 'rgba(90,198,142,0.13)',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
    backgroundColor: '#5ac68e',
  },
  activeText: {
    color: '#76d9a8',
    fontSize: 9,
    fontWeight: '900',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(248,244,236,0.1)',
    marginVertical: 16,
  },
  accountId: {
    color: '#bcb5ba',
    fontSize: 12,
    marginTop: 5,
  },
});
