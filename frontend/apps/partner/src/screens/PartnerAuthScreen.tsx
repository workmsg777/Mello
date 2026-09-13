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
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { API_BASE_URL, getApiErrorMessage } from '../config/api';
import { logout, requestOtp, restoreSession, verifyOtp } from '../services/auth.service';
import type {
  AuthMode,
  PartnerCategory,
  PartnerSignupData,
  StoredSession,
} from '../types/auth';

type AuthStep = 'business' | 'phone' | 'otp';

const categories: Array<{ value: PartnerCategory; label: string }> = [
  { value: 'CAFE', label: 'Cafe' },
  { value: 'HOTEL', label: 'Hotel' },
  { value: 'ACTIVITY', label: 'Activity' },
  { value: 'OTHER', label: 'Other' },
];

const emptyPartner: PartnerSignupData = {
  ownerName: '',
  businessName: '',
  category: 'CAFE',
  description: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  postalCode: '',
  countryCode: 'IN',
  businessEmail: '',
};

const digits = (value: string, maxLength: number) =>
  value.replace(/\D/g, '').slice(0, maxLength);

function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor="#9a9489"
        style={[styles.input, props.multiline && styles.multilineInput]}
        {...props}
      />
    </View>
  );
}

export function PartnerAuthScreen() {
  const [mode, setMode] = useState<AuthMode>('signup');
  const [step, setStep] = useState<AuthStep>('business');
  const [partner, setPartner] = useState<PartnerSignupData>(emptyPartner);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [developmentOtp, setDevelopmentOtp] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [session, setSession] = useState<StoredSession | null>(null);
  const otpInput = useRef<TextInput>(null);

  useEffect(() => {
    let active = true;
    void restoreSession().then((savedSession) => {
      if (!active) return;
      setSession(savedSession);
      setRestoring(false);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(
      () => setCountdown((current) => Math.max(current - 1, 0)),
      1_000,
    );
    return () => clearInterval(timer);
  }, [countdown]);

  const updatePartner = <Key extends keyof PartnerSignupData>(
    key: Key,
    value: PartnerSignupData[Key],
  ) => setPartner((current) => ({ ...current, [key]: value }));

  const validateBusiness = () => {
    if (!partner.ownerName.trim()) return 'Enter the owner name.';
    if (!partner.businessName.trim()) return 'Enter the business name.';
    if (!partner.addressLine1.trim()) return 'Enter the business address.';
    if (!partner.city.trim()) return 'Enter the city.';
    if (!partner.state.trim()) return 'Enter the state.';
    if (!partner.postalCode.trim()) return 'Enter the postal code.';
    if (
      partner.businessEmail &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(partner.businessEmail)
    ) {
      return 'Enter a valid business email.';
    }
    return null;
  };

  const continueToPhone = () => {
    const validationError = validateBusiness();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setStep('phone');
  };

  const handleRequestOtp = async () => {
    if (phone.length !== 10) {
      setError('Enter a valid 10-digit mobile number.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await requestOtp(`+91${phone}`, mode);
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
      setError('Enter the six-digit OTP.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const authenticated = await verifyOtp(
        `+91${phone}`,
        otp,
        mode,
        mode === 'signup' ? partner : undefined,
      );
      setSession(authenticated);
      setOtp('');
      setDevelopmentOtp(null);
    } catch (verifyError) {
      setError(getApiErrorMessage(verifyError));
    } finally {
      setLoading(false);
    }
  };

  const changeMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setStep(nextMode === 'signup' ? 'business' : 'phone');
    setOtp('');
    setError(null);
    setDevelopmentOtp(null);
    setCountdown(0);
  };

  const handleLogout = async () => {
    if (!session || loading) return;
    setLoading(true);
    setError(null);
    try {
      await logout(session);
      setSession(null);
      setStep('phone');
      setMode('login');
      setPhone('');
    } catch (logoutError) {
      setError(getApiErrorMessage(logoutError));
    } finally {
      setLoading(false);
    }
  };

  if (restoring) {
    return (
      <SafeAreaView style={styles.centered}>
        <View style={styles.logo}><Text style={styles.logoText}>P</Text></View>
        <ActivityIndicator color="#315c4c" size="large" />
      </SafeAreaView>
    );
  }

  if (session) {
    const business = session.profile.partner;
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.successWrap}>
          <View style={styles.successIcon}><Text style={styles.successIconText}>OK</Text></View>
          <Text style={styles.kicker}>MELLO PARTNER</Text>
          <Text style={styles.successTitle}>Welcome back.</Text>
          <Text style={styles.successCopy}>
            Your partner workspace is authenticated and ready for its dashboard.
          </Text>
          <View style={styles.profileCard}>
            <Text style={styles.profileLabel}>BUSINESS</Text>
            <Text style={styles.profileName}>{business?.name ?? session.profile.name ?? 'Partner account'}</Text>
            <Text style={styles.profileMeta}>
              {[business?.category, business?.city, business?.state].filter(Boolean).join('  /  ')}
            </Text>
            <View style={styles.profileLine} />
            <View style={styles.profileRow}>
              <Text style={styles.profileLabel}>ROLE</Text>
              <Text style={styles.profileValue}>{session.profile.staffRole ?? 'OWNER'}</Text>
            </View>
            <View style={styles.profileRow}>
              <Text style={styles.profileLabel}>STATUS</Text>
              <Text style={styles.activeValue}>{session.account.status}</Text>
            </View>
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable onPress={handleLogout} style={styles.outlineButton}>
            {loading ? <ActivityIndicator color="#315c4c" /> : <Text style={styles.outlineButtonText}>Sign out</Text>}
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={styles.brandRow}>
              <View style={styles.logo}><Text style={styles.logoText}>P</Text></View>
              <View>
                <Text style={styles.brand}>mello partner</Text>
                <Text style={styles.brandSub}>FOR VENUES & EXPERIENCES</Text>
              </View>
            </View>
            <Text style={styles.title}>
              {step === 'business'
                ? 'Grow with meaningful connections.'
                : step === 'phone'
                  ? mode === 'signup' ? 'Secure your business account.' : 'Welcome back, partner.'
                  : 'Verify your number.'}
            </Text>
            <Text style={styles.subtitle}>
              {step === 'business'
                ? 'Tell us about the place or experience you bring to Mello.'
                : step === 'phone'
                  ? 'We use a one-time code instead of a password.'
                  : `Code sent to +91 ${phone.slice(0, 5)} ${phone.slice(5)}.`}
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.modeTabs}>
              {(['signup', 'login'] as AuthMode[]).map((item) => (
                <Pressable
                  key={item}
                  onPress={() => changeMode(item)}
                  style={[styles.modeTab, mode === item && styles.modeTabActive]}
                >
                  <Text style={[styles.modeText, mode === item && styles.modeTextActive]}>
                    {item === 'signup' ? 'Register business' : 'Partner login'}
                  </Text>
                </Pressable>
              ))}
            </View>

            {step === 'business' ? (
              <>
                <Text style={styles.sectionTitle}>Business details</Text>
                <Field label="Owner name" value={partner.ownerName} onChangeText={(value) => updatePartner('ownerName', value)} placeholder="Your full name" autoCapitalize="words" />
                <Field label="Business name" value={partner.businessName} onChangeText={(value) => updatePartner('businessName', value)} placeholder="Venue or company name" autoCapitalize="words" />
                <Text style={styles.label}>Business category</Text>
                <View style={styles.categoryRow}>
                  {categories.map((category) => (
                    <Pressable
                      key={category.value}
                      onPress={() => updatePartner('category', category.value)}
                      style={[styles.category, partner.category === category.value && styles.categoryActive]}
                    >
                      <Text style={[styles.categoryText, partner.category === category.value && styles.categoryTextActive]}>{category.label}</Text>
                    </Pressable>
                  ))}
                </View>
                <Field label="Address" value={partner.addressLine1} onChangeText={(value) => updatePartner('addressLine1', value)} placeholder="Street and building" autoCapitalize="words" />
                <Field label="Address line 2 (optional)" value={partner.addressLine2} onChangeText={(value) => updatePartner('addressLine2', value)} placeholder="Area or landmark" autoCapitalize="words" />
                <View style={styles.twoColumns}>
                  <View style={styles.column}><Field label="City" value={partner.city} onChangeText={(value) => updatePartner('city', value)} placeholder="City" autoCapitalize="words" /></View>
                  <View style={styles.column}><Field label="State" value={partner.state} onChangeText={(value) => updatePartner('state', value)} placeholder="State" autoCapitalize="words" /></View>
                </View>
                <View style={styles.twoColumns}>
                  <View style={styles.column}><Field label="Postal code" value={partner.postalCode} onChangeText={(value) => updatePartner('postalCode', value)} placeholder="560001" keyboardType="number-pad" /></View>
                  <View style={styles.column}><Field label="Country" value="India" editable={false} /></View>
                </View>
                <Field label="Business email (optional)" value={partner.businessEmail} onChangeText={(value) => updatePartner('businessEmail', value.trim())} placeholder="hello@business.com" keyboardType="email-address" autoCapitalize="none" />
                <Field label="Short description (optional)" value={partner.description} onChangeText={(value) => updatePartner('description', value)} placeholder="What makes your business special?" multiline maxLength={5000} />
                {error ? <Text style={styles.error}>{error}</Text> : null}
                <Pressable onPress={continueToPhone} style={styles.primaryButton}>
                  <Text style={styles.primaryButtonText}>Continue to mobile verification</Text>
                </Pressable>
              </>
            ) : step === 'phone' ? (
              <>
                <View style={styles.stepHeader}>
                  <Text style={styles.sectionTitle}>Mobile verification</Text>
                  {mode === 'signup' ? <Pressable onPress={() => setStep('business')}><Text style={styles.textButton}>Edit details</Text></Pressable> : null}
                </View>
                <Text style={styles.label}>Mobile number</Text>
                <View style={styles.phoneRow}>
                  <View style={styles.prefix}><Text style={styles.prefixText}>+91</Text></View>
                  <TextInput
                    value={phone}
                    onChangeText={(value) => setPhone(digits(value, 10))}
                    placeholder="98765 43210"
                    placeholderTextColor="#9a9489"
                    keyboardType="phone-pad"
                    autoComplete="tel"
                    maxLength={10}
                    style={styles.phoneInput}
                  />
                </View>
                <Text style={styles.helper}>Use the number connected to the business owner account.</Text>
                {error ? <Text style={styles.error}>{error}</Text> : null}
                <Pressable
                  disabled={loading || phone.length !== 10}
                  onPress={handleRequestOtp}
                  style={[styles.primaryButton, (loading || phone.length !== 10) && styles.disabled]}
                >
                  {loading ? <ActivityIndicator color="#fffdf7" /> : <Text style={styles.primaryButtonText}>Send verification code</Text>}
                </Pressable>
              </>
            ) : (
              <>
                <View style={styles.stepHeader}>
                  <Text style={styles.sectionTitle}>Enter OTP</Text>
                  <Pressable onPress={() => { setStep('phone'); setError(null); }}><Text style={styles.textButton}>Edit number</Text></Pressable>
                </View>
                <TextInput
                  ref={otpInput}
                  value={otp}
                  onChangeText={(value) => setOtp(digits(value, 6))}
                  placeholder="-  -  -  -  -  -"
                  placeholderTextColor="#aaa399"
                  keyboardType="number-pad"
                  autoComplete="sms-otp"
                  textContentType="oneTimeCode"
                  maxLength={6}
                  style={styles.otpInput}
                />
                {developmentOtp ? (
                  <View style={styles.testCode}>
                    <Text style={styles.testCodeLabel}>LOCAL TEST CODE</Text>
                    <Text style={styles.testCodeValue}>{developmentOtp}</Text>
                  </View>
                ) : null}
                {error ? <Text style={styles.error}>{error}</Text> : null}
                <Pressable
                  disabled={loading || otp.length !== 6}
                  onPress={handleVerifyOtp}
                  style={[styles.primaryButton, (loading || otp.length !== 6) && styles.disabled]}
                >
                  {loading ? <ActivityIndicator color="#fffdf7" /> : <Text style={styles.primaryButtonText}>{mode === 'signup' ? 'Create partner account' : 'Log in to workspace'}</Text>}
                </Pressable>
                <Pressable disabled={countdown > 0 || loading} onPress={handleRequestOtp} style={styles.resend}>
                  <Text style={[styles.textButton, countdown > 0 && styles.muted]}>
                    {countdown > 0 ? `Send another code in ${countdown}s` : 'Send another code'}
                  </Text>
                </Pressable>
              </>
            )}
          </View>
          <Text numberOfLines={1} style={styles.apiHint}>API: {API_BASE_URL}</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: '#f3eee3' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 22, backgroundColor: '#f3eee3' },
  scroll: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 34 },
  header: { width: '100%', maxWidth: 500, alignSelf: 'center', marginBottom: 22 },
  brandRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 30 },
  logo: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 11, backgroundColor: '#315c4c' },
  logoText: { color: '#fffdf7', fontSize: 22, fontWeight: '900' },
  brand: { color: '#1f3029', fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  brandSub: { color: '#7b766d', fontSize: 8, fontWeight: '800', letterSpacing: 1.2, marginTop: 2 },
  title: { maxWidth: 440, color: '#21372e', fontSize: 35, lineHeight: 41, fontWeight: '800', letterSpacing: -1.2 },
  subtitle: { maxWidth: 400, color: '#6f6b63', fontSize: 14, lineHeight: 21, marginTop: 9 },
  card: { width: '100%', maxWidth: 500, alignSelf: 'center', padding: 19, borderRadius: 24, backgroundColor: '#fffdf7', elevation: 5, shadowColor: '#365044', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.12, shadowRadius: 22 },
  modeTabs: { flexDirection: 'row', padding: 4, borderRadius: 13, marginBottom: 23, backgroundColor: '#eee9de' },
  modeTab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10 },
  modeTabActive: { backgroundColor: '#fffdf7', elevation: 2 },
  modeText: { color: '#817b70', fontSize: 12, fontWeight: '700' },
  modeTextActive: { color: '#315c4c' },
  sectionTitle: { color: '#243a31', fontSize: 18, fontWeight: '900', marginBottom: 16 },
  fieldBlock: { marginBottom: 14 },
  label: { color: '#48554f', fontSize: 11, fontWeight: '800', marginBottom: 7 },
  input: { height: 52, paddingHorizontal: 14, borderWidth: 1.3, borderColor: '#ddd6c9', borderRadius: 13, color: '#25362f', fontSize: 14, backgroundColor: '#fffefa' },
  multilineInput: { height: 88, paddingTop: 13, textAlignVertical: 'top' },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  category: { paddingHorizontal: 13, paddingVertical: 9, borderWidth: 1, borderColor: '#d8d1c4', borderRadius: 99 },
  categoryActive: { borderColor: '#315c4c', backgroundColor: '#315c4c' },
  categoryText: { color: '#716c63', fontSize: 11, fontWeight: '700' },
  categoryTextActive: { color: '#fffdf7' },
  twoColumns: { flexDirection: 'row', gap: 10 },
  column: { flex: 1 },
  stepHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  textButton: { color: '#a55d2b', fontSize: 11, fontWeight: '900' },
  phoneRow: { height: 58, flexDirection: 'row', borderWidth: 1.3, borderColor: '#ddd6c9', borderRadius: 14, overflow: 'hidden', backgroundColor: '#fffefa' },
  prefix: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, borderRightWidth: 1, borderRightColor: '#e4ded2' },
  prefixText: { color: '#315c4c', fontSize: 15, fontWeight: '900' },
  phoneInput: { flex: 1, paddingHorizontal: 14, color: '#25362f', fontSize: 18, fontWeight: '700', letterSpacing: 0.7 },
  helper: { color: '#878177', fontSize: 10, lineHeight: 16, marginTop: 8 },
  otpInput: { height: 68, borderWidth: 1.3, borderColor: '#d8d1c4', borderRadius: 15, color: '#25362f', backgroundColor: '#fffefa', fontSize: 24, fontWeight: '900', letterSpacing: 9, textAlign: 'center' },
  testCode: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 13, paddingVertical: 10, borderRadius: 11, marginTop: 11, backgroundColor: '#e8eee9' },
  testCodeLabel: { color: '#68736e', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  testCodeValue: { color: '#315c4c', fontSize: 16, fontWeight: '900', letterSpacing: 2 },
  primaryButton: { minHeight: 54, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 15, borderRadius: 15, marginTop: 8, backgroundColor: '#315c4c' },
  primaryButtonText: { color: '#fffdf7', fontSize: 13, fontWeight: '900', textAlign: 'center' },
  disabled: { opacity: 0.42 },
  resend: { alignItems: 'center', paddingTop: 17, paddingBottom: 2 },
  muted: { color: '#aaa399' },
  error: { color: '#ae3838', fontSize: 11, lineHeight: 17, marginTop: 10 },
  apiHint: { alignSelf: 'center', maxWidth: 400, color: '#a49e93', fontSize: 9, marginTop: 14 },
  successWrap: { flex: 1, width: '100%', maxWidth: 450, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  successIcon: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 21, backgroundColor: '#315c4c' },
  successIconText: { color: '#fffdf7', fontSize: 16, fontWeight: '900' },
  kicker: { color: '#a55d2b', fontSize: 9, fontWeight: '900', letterSpacing: 1.8 },
  successTitle: { color: '#21372e', fontSize: 36, fontWeight: '900', letterSpacing: -1, marginTop: 9 },
  successCopy: { maxWidth: 330, color: '#716c63', fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 8 },
  profileCard: { width: '100%', padding: 18, borderWidth: 1, borderColor: '#d9d2c5', borderRadius: 19, marginTop: 26, backgroundColor: '#fffdf7' },
  profileLabel: { color: '#8c857a', fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  profileName: { color: '#243a31', fontSize: 20, fontWeight: '900', marginTop: 5 },
  profileMeta: { color: '#777168', fontSize: 11, marginTop: 5 },
  profileLine: { height: 1, backgroundColor: '#ebe5da', marginVertical: 15 },
  profileRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 7 },
  profileValue: { color: '#315c4c', fontSize: 10, fontWeight: '900' },
  activeValue: { color: '#3a8d65', fontSize: 10, fontWeight: '900' },
  outlineButton: { width: '100%', height: 52, alignItems: 'center', justifyContent: 'center', borderWidth: 1.3, borderColor: '#315c4c', borderRadius: 15, marginTop: 20 },
  outlineButtonText: { color: '#315c4c', fontSize: 13, fontWeight: '900' },
});
