import { Image } from "expo-image";
import { useEffect, useState, type PropsWithChildren } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { absoluteMediaUrl, api } from "../config/api";
import { colors } from "../theme";

/** The wrapper owns its size so native image decoding never controls the card's layout. */
export function ProfilePhoto({
  url,
  style,
  children,
  ownerPhotoId,
  accessibilityLabel = "Profile photo",
}: PropsWithChildren<{
  url: string | null | undefined;
  style: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  ownerPhotoId?: string | undefined;
}>) {
  const [ownerUri, setOwnerUri] = useState<string>();
  const uri = ownerPhotoId ? ownerUri : absoluteMediaUrl(url ?? null);
  const [loading, setLoading] = useState(!!uri);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    setLoading(!!uri);
    setFailed(false);
  }, [uri]);
  useEffect(() => {
    if (!ownerPhotoId) return;
    const request = new AbortController();
    let objectUrl: string | undefined;
    setOwnerUri(undefined);
    setLoading(true);
    setFailed(false);
    void api
      .get<Blob>(`/dating/photos/${ownerPhotoId}/file`, {
        responseType: "blob",
        signal: request.signal,
      })
      .then(({ data }) => {
        if (request.signal.aborted) return;
        if (Platform.OS === "web") {
          objectUrl = URL.createObjectURL(data);
          setOwnerUri(objectUrl);
          return;
        }
        return new Promise<void>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result !== "string") {
              reject(new Error("Photo could not be read"));
              return;
            }
            if (!request.signal.aborted) setOwnerUri(reader.result);
            resolve();
          };
          reader.onerror = reject;
          reader.readAsDataURL(data);
        });
      })
      .catch(() => {
        if (request.signal.aborted) return;
        setLoading(false);
        setFailed(true);
      });
    return () => {
      request.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [ownerPhotoId, attempt]);
  return (
    <View style={[styles.frame, style]}>
      {uri ? (
        <Image
          key={`${ownerPhotoId ?? uri}:${attempt}`}
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy={ownerPhotoId || attempt ? "none" : "memory-disk"}
          recyclingKey={ownerPhotoId ?? uri}
          transition={120}
          accessibilityLabel={accessibilityLabel}
          onLoadStart={() => {
            setLoading(true);
            setFailed(false);
          }}
          onLoad={() => {
            setLoading(false);
            setFailed(false);
          }}
          onError={(event) => {
            setLoading(false);
            setFailed(true);
            if (__DEV__ && !ownerPhotoId)
              console.warn("[Mello photo]", uri, event.error);
          }}
        />
      ) : null}
      {children}
      {loading && !failed ? (
        <View pointerEvents="none" style={styles.center}>
          <ActivityIndicator color={colors.coral} />
        </View>
      ) : null}
      {(!uri && !loading) || failed ? (
        <View pointerEvents="box-none" style={styles.center}>
          <Text style={styles.placeholder}>♡</Text>
          {failed ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retry loading photo"
              onPress={() => {
                setLoading(true);
                setFailed(false);
                setAttempt((value) => value + 1);
              }}
              style={styles.retry}
            >
              <Text style={styles.retryText}>
                Photo couldn’t load · tap to retry
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  frame: { overflow: "hidden", backgroundColor: "#F1E4E5" },
  center: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  placeholder: { color: colors.plum, fontSize: 35 },
  retry: {
    padding: 12,
    backgroundColor: "#FFF9F6E8",
    borderRadius: 18,
    margin: 15,
  },
  retryText: {
    fontSize: 11,
    lineHeight: 17,
    textAlign: "center",
    color: colors.plum,
  },
});
