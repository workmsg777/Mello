import type { PropsWithChildren, ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radii } from "../theme";

export function Screen({
  children,
  scroll = true,
}: PropsWithChildren<{ scroll?: boolean }>) {
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={styles.screenContent}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={styles.screenContent}>{children}</View>
  );
  return <SafeAreaView style={styles.screen}>{body}</SafeAreaView>;
}

export function OnboardingShell({
  title,
  subtitle,
  progress,
  children,
  footer,
}: PropsWithChildren<{
  title: string;
  subtitle?: string;
  progress?: number;
  footer?: ReactNode;
}>) {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: `${Math.min(100, Math.max(3, progress ?? 3))}%` },
          ]}
        />
      </View>
      <ScrollView
        contentContainerStyle={styles.shellContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.kicker}>MELLO PROFILE</Text>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        <View style={styles.body}>{children}</View>
      </ScrollView>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

export function PrimaryButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  kind = "primary",
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  kind?: "primary" | "secondary" | "ghost";
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        kind === "secondary" && styles.buttonSecondary,
        kind === "ghost" && styles.buttonGhost,
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={kind === "primary" ? colors.ink : colors.coral}
        />
      ) : (
        <Text
          style={[
            styles.buttonText,
            kind !== "primary" && styles.buttonTextSecondary,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.muted}
        style={[styles.input, props.multiline && styles.multiline]}
        {...props}
      />
    </View>
  );
}

export function ChoiceChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
        {selected ? "✓  " : ""}
        {label}
      </Text>
    </Pressable>
  );
}

export function ErrorNotice({ message }: { message: string | null }) {
  return message ? (
    <View style={styles.errorBox}>
      <Text style={styles.errorText}>{message}</Text>
    </View>
  ) : null;
}

export function LoadingScreen({
  label = "Loading your Mello profile…",
}: {
  label?: string;
}) {
  return (
    <SafeAreaView style={styles.loading}>
      <View style={styles.logo}>
        <Text style={styles.logoText}>m</Text>
      </View>
      <ActivityIndicator color={colors.coral} size="large" />
      <Text style={styles.loadingText}>{label}</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  screenContent: { flexGrow: 1, padding: 22 },
  progressTrack: { height: 5, backgroundColor: colors.line },
  progressFill: {
    height: 5,
    backgroundColor: colors.coral,
    borderRadius: radii.pill,
  },
  shellContent: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: 30,
    paddingBottom: 30,
  },
  kicker: {
    color: colors.coral,
    fontWeight: "900",
    fontSize: 11,
    letterSpacing: 1.7,
    marginBottom: 10,
  },
  title: {
    color: colors.ink,
    fontSize: 34,
    lineHeight: 39,
    fontWeight: "900",
    letterSpacing: -1.1,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
  },
  body: { marginTop: 26, gap: 14 },
  footer: {
    padding: 16,
    paddingBottom: 12,
    backgroundColor: colors.cream,
    borderTopColor: colors.line,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  button: {
    minHeight: 54,
    borderRadius: radii.medium,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    backgroundColor: colors.coral,
  },
  buttonSecondary: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.coral,
  },
  buttonGhost: { backgroundColor: "transparent" },
  buttonText: { color: colors.ink, fontSize: 15, fontWeight: "900" },
  buttonTextSecondary: { color: colors.coral },
  disabled: { opacity: 0.45 },
  pressed: { transform: [{ scale: 0.985 }] },
  fieldWrap: { gap: 8 },
  label: { color: colors.inkSoft, fontSize: 13, fontWeight: "800" },
  input: {
    minHeight: 54,
    borderRadius: radii.small,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.white,
    color: colors.ink,
    fontSize: 16,
    paddingHorizontal: 15,
  },
  multiline: { minHeight: 120, paddingTop: 14, textAlignVertical: "top" },
  chip: {
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.white,
    paddingVertical: 11,
    paddingHorizontal: 15,
    marginRight: 8,
    marginBottom: 9,
    alignSelf: "flex-start",
  },
  chipSelected: {
    borderColor: colors.coral,
    backgroundColor: colors.coralSoft,
  },
  chipText: { color: colors.inkSoft, fontWeight: "700" },
  chipTextSelected: { color: colors.ink, fontWeight: "900" },
  errorBox: {
    backgroundColor: "#FDE8E8",
    borderRadius: radii.small,
    padding: 12,
  },
  errorText: { color: colors.danger, fontSize: 13, lineHeight: 19 },
  loading: {
    flex: 1,
    backgroundColor: colors.ink,
    justifyContent: "center",
    alignItems: "center",
    gap: 18,
  },
  loadingText: { color: colors.rose, fontSize: 13 },
  logo: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: colors.coral,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: { fontSize: 34, fontWeight: "900", color: colors.ink },
});
