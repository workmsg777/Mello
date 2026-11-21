import axios from "axios";
import { Image } from "expo-image";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { API_BASE_URL, getApiErrorMessage } from "../src/config/api";
import {
  ChoiceChip,
  ErrorNotice,
  Field,
  PrimaryButton,
  Screen,
} from "../src/components/ui";
import { colors, radii } from "../src/theme";
import type { AuthTokens, OtpRequestResponse } from "../src/types/auth";

type Photo = {
  id: string;
  uploadedAt: string;
  assessment: { kind: string | null; risk: number | null };
};
type Decision = "APPROVED" | "REJECTED";

// Keep the reviewer session in this tab and separate from the dating session.
const reviewerApi = axios.create({ baseURL: API_BASE_URL, timeout: 20_000 });
const authorization = (accessToken: string) => ({
  Authorization: `Bearer ${accessToken}`,
});
const listPhotos = async (accessToken: string) =>
  (
    await reviewerApi.get<{ photos: Photo[] }>("/photo-review", {
      headers: authorization(accessToken),
    })
  ).data.photos;

export default function PhotoReviewScreen() {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [developmentOtp, setDevelopmentOtp] = useState("");
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selection, setSelection] = useState("");
  const [preview, setPreview] = useState<{ id: string; url: string } | null>(
    null,
  );
  const [loadedPhoto, setLoadedPhoto] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{
    id: string;
    status: Decision;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = photos.find((photo) => photo.id === selection) ?? photos[0];
  const activeId = active?.id;
  const photoUrl = preview?.id === activeId ? preview?.url : undefined;
  const decision =
    confirmation?.id === activeId ? confirmation?.status : undefined;
  const token = tokens?.accessToken;

  useEffect(() => {
    setConfirmation(null);
    setPreview(null);
    setLoadedPhoto(null);
    setPreviewError(null);
    if (!token || !activeId || Platform.OS !== "web") return;
    const request = new AbortController();
    let objectUrl: string | undefined;
    void reviewerApi
      .get<Blob>(`/photo-review/${activeId}/file`, {
        headers: authorization(token),
        responseType: "blob",
        signal: request.signal,
      })
      .then(({ data }) => {
        if (request.signal.aborted) return;
        objectUrl = URL.createObjectURL(data);
        setPreview({ id: activeId, url: objectUrl });
      })
      .catch((caught) => {
        if (!request.signal.aborted)
          setPreviewError(getApiErrorMessage(caught));
      });
    return () => {
      request.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [token, activeId]);

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  };
  const signIn = () =>
    run(async () => {
      if (!codeSent) {
        const { data } = await reviewerApi.post<OtpRequestResponse>(
          "/auth/login/request-otp",
          { phone: `+91${phone}` },
        );
        setCodeSent(true);
        setDevelopmentOtp(__DEV__ ? (data.developmentOtp ?? "") : "");
        return;
      }
      const { data } = await reviewerApi.post<{ tokens: AuthTokens }>(
        "/auth/login/verify",
        {
          phone: `+91${phone}`,
          otp: code,
          device: { platform: "WEB", deviceName: "Mello photo review" },
        },
      );
      try {
        setPhotos(await listPhotos(data.tokens.accessToken));
        setTokens(data.tokens);
        setCode("");
        setDevelopmentOtp("");
      } catch (caught) {
        await reviewerApi
          .post("/auth/logout", { refreshToken: data.tokens.refreshToken })
          .catch(() => undefined);
        throw caught;
      }
    });
  const signOut = () =>
    run(async () => {
      try {
        if (tokens)
          await reviewerApi.post("/auth/logout", {
            refreshToken: tokens.refreshToken,
          });
      } finally {
        setTokens(null);
        setPhotos([]);
        setSelection("");
        setConfirmation(null);
        setCodeSent(false);
      }
    });
  const saveDecision = () =>
    run(async () => {
      if (!activeId || !decision || !token) return;
      try {
        await reviewerApi.patch(
          `/photo-review/${activeId}`,
          { status: decision },
          { headers: authorization(token) },
        );
      } catch (caught) {
        if (axios.isAxiosError(caught) && caught.response?.status === 409) {
          setPhotos(await listPhotos(token));
        }
        throw caught;
      }
      setPhotos((current) => current.filter((photo) => photo.id !== activeId));
      setConfirmation(null);
      setSelection("");
      setPhotos(await listPhotos(token));
    });

  return (
    <Screen>
      <View style={styles.page}>
        <Text accessibilityRole="header" style={styles.title}>
          Photo review
        </Text>
        <ErrorNotice message={error} />
        {Platform.OS !== "web" ? (
          <Text style={styles.copy}>
            Open Photo review in the Mello web app.
          </Text>
        ) : !token ? (
          <View style={styles.panel}>
            <Text style={styles.copy}>
              Sign in with your Mello reviewer account to see pending profile
              photos.
            </Text>
            <Field
              label="Reviewer phone (+91)"
              value={phone}
              onChangeText={(value) =>
                setPhone(value.replace(/\D/g, "").slice(0, 10))
              }
              keyboardType="phone-pad"
              editable={!codeSent && !busy}
            />
            {codeSent && (
              <>
                <Field
                  label="Six-digit code"
                  value={code}
                  onChangeText={(value) =>
                    setCode(value.replace(/\D/g, "").slice(0, 6))
                  }
                  keyboardType="number-pad"
                />
                {developmentOtp ? (
                  <Text style={styles.copy}>
                    Local test code {developmentOtp}
                  </Text>
                ) : null}
              </>
            )}
            <PrimaryButton
              label={codeSent ? "Sign in to review" : "Send sign-in code"}
              loading={busy}
              disabled={codeSent ? code.length !== 6 : phone.length !== 10}
              onPress={() => void signIn()}
            />
            {codeSent && (
              <PrimaryButton
                label="Use another number"
                kind="ghost"
                disabled={busy}
                onPress={() => {
                  setCode("");
                  setDevelopmentOtp("");
                  setCodeSent(false);
                }}
              />
            )}
          </View>
        ) : (
          <>
            <View style={styles.actions}>
              <PrimaryButton
                label="Refresh queue"
                kind="secondary"
                disabled={busy}
                onPress={() =>
                  void run(async () => setPhotos(await listPhotos(token)))
                }
              />
              <PrimaryButton
                label="Sign out"
                kind="ghost"
                disabled={busy}
                onPress={() => void signOut()}
              />
            </View>
            {!active ? (
              <Text style={styles.copy}>No photos are awaiting review.</Text>
            ) : (
              <View style={styles.panel}>
                <Text accessibilityRole="header" style={styles.subtitle}>
                  Next {photos.length} pending{" "}
                  {photos.length === 1 ? "photo" : "photos"}
                </Text>
                <View style={styles.actions}>
                  {photos.map((photo, index) => (
                    <ChoiceChip
                      key={photo.id}
                      label={`Photo ${index + 1}`}
                      selected={photo.id === active.id}
                      onPress={() => {
                        if (!busy) setSelection(photo.id);
                      }}
                    />
                  ))}
                </View>
                {previewError ? (
                  <ErrorNotice message={previewError} />
                ) : photoUrl ? (
                  <Image
                    key={active.id}
                    source={{ uri: photoUrl }}
                    style={styles.preview}
                    cachePolicy="none"
                    contentFit="contain"
                    accessibilityLabel="Pending photo for review"
                    onLoad={() => setLoadedPhoto(photoUrl)}
                    onError={() =>
                      setPreviewError("This photo could not be displayed.")
                    }
                  />
                ) : (
                  <ActivityIndicator color={colors.coral} />
                )}
                <Text style={styles.copy}>
                  Uploaded {new Date(active.uploadedAt).toLocaleString()}
                </Text>
                <Text style={styles.copy}>
                  {active.assessment.risk == null
                    ? "Automated score unavailable"
                    : `Automated explicit-content score ${Math.round(active.assessment.risk * 100)}%`}
                </Text>
                {!decision ? (
                  <View style={styles.actions}>
                    <PrimaryButton
                      label="Approve photo"
                      disabled={
                        !loadedPhoto || loadedPhoto !== photoUrl || busy
                      }
                      onPress={() =>
                        setConfirmation({ id: active.id, status: "APPROVED" })
                      }
                    />
                    <PrimaryButton
                      label="Reject photo"
                      kind="secondary"
                      disabled={busy}
                      onPress={() =>
                        setConfirmation({ id: active.id, status: "REJECTED" })
                      }
                    />
                  </View>
                ) : (
                  <>
                    <Text style={styles.copy}>
                      {decision === "APPROVED"
                        ? "Approval makes the photo eligible for public display."
                        : "The account owner will see that this photo needs replacing."}
                    </Text>
                    <View style={styles.actions}>
                      <PrimaryButton
                        label={
                          decision === "APPROVED"
                            ? "Confirm approval"
                            : "Confirm rejection"
                        }
                        loading={busy}
                        onPress={() => void saveDecision()}
                      />
                      <PrimaryButton
                        label="Cancel"
                        kind="ghost"
                        disabled={busy}
                        onPress={() => setConfirmation(null)}
                      />
                    </View>
                  </>
                )}
              </View>
            )}
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: {
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
    gap: 20,
    paddingBottom: 30,
  },
  title: { fontSize: 32, fontWeight: "900", color: colors.ink },
  subtitle: { fontSize: 20, fontWeight: "800", color: colors.ink },
  copy: { color: colors.inkSoft, lineHeight: 22 },
  panel: {
    backgroundColor: colors.white,
    borderRadius: radii.medium,
    padding: 20,
    gap: 14,
  },
  preview: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 340,
    aspectRatio: 0.85,
    borderRadius: radii.medium,
  },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
