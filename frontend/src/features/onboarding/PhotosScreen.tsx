import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { ProfilePhoto } from "../../components/ProfilePhoto";
import {
  ErrorNotice,
  OnboardingShell,
  PrimaryButton,
} from "../../components/ui";
import { datingApi } from "../../services/dating.service";
import { colors, radii } from "../../theme";
import { useOnboarding } from "./useOnboarding";

export function PhotosScreen() {
  const { catalog, state, busy, error, setError, run, finish, progress } =
    useOnboarding();
  const [upload, setUpload] = useState(0);
  const [picking, setPicking] = useState(false);
  const photos = state.photos;
  const pick = async () => {
    if (busy || picking) return;
    setPicking(true);
    setError(null);
    try {
      // Open the browser picker directly from the tap; web needs no library permission.
      if (Platform.OS !== "web") {
        const permission =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          setError("Allow photo library access to add a profile photo.");
          return;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [4, 5],
        quality: 0.85,
      });
      const asset = result.assets?.[0];
      if (!result.canceled && asset)
        await run(() => datingApi.uploadPhoto(asset, setUpload));
    } catch {
      setError("Unable to open the selected photo. Please try again.");
    } finally {
      setUpload(0);
      setPicking(false);
    }
  };
  const move = (index: number, offset: number) => {
    const reordered = [...photos];
    const target = index + offset;
    if (target < 0 || target >= reordered.length) return;
    [reordered[index], reordered[target]] = [
      reordered[target]!,
      reordered[index]!,
    ];
    void run(() =>
      datingApi.reorderPhotos(
        reordered.map((x) => x.id),
        reordered.find((x) => x.isPrimary)?.id ?? reordered[0]!.id,
      ),
    );
  };
  return (
    <OnboardingShell
      title="Add your best photos."
      subtitle={`Choose ${catalog.rules.minimumPhotos}–${catalog.rules.maximumPhotos}. Your first photo is your cover.`}
      progress={progress("PHOTOS")}
      footer={
        <PrimaryButton
          label="Continue"
          disabled={photos.length < catalog.rules.minimumPhotos}
          loading={busy}
          onPress={() => void finish("PHOTOS", "/onboarding/dating-intentions")}
        />
      }
    >
      <View style={styles.grid}>
        {photos.map((photo, index) => (
          <View key={photo.id} style={styles.photoCard}>
            {photo.url ? (
              <ProfilePhoto url={photo.url} style={styles.image} />
            ) : (
              <View style={styles.image} />
            )}
            {photo.isPrimary ? (
              <Text style={styles.primary}>PRIMARY</Text>
            ) : null}
            <View style={styles.actions}>
              <Pressable onPress={() => move(index, -1)}>
                <Text style={styles.action}>←</Text>
              </Pressable>
              <Pressable
                onPress={() =>
                  void run(() =>
                    datingApi.reorderPhotos(
                      photos.map((x) => x.id),
                      photo.id,
                    ),
                  )
                }
              >
                <Text style={styles.action}>★</Text>
              </Pressable>
              <Pressable onPress={() => move(index, 1)}>
                <Text style={styles.action}>→</Text>
              </Pressable>
              <Pressable
                onPress={() => void run(() => datingApi.deletePhoto(photo.id))}
              >
                <Text style={[styles.action, { color: colors.danger }]}>×</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </View>
      {photos.length < catalog.rules.maximumPhotos ? (
        <PrimaryButton
          kind="secondary"
          label={
            upload ? `Uploading ${Math.round(upload * 100)}%` : "+ Add a photo"
          }
          loading={busy || picking}
          onPress={() => void pick()}
        />
      ) : null}
      <ErrorNotice message={error} />
    </OnboardingShell>
  );
}
const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  photoCard: {
    width: "47%",
    backgroundColor: colors.white,
    borderRadius: radii.medium,
    overflow: "hidden",
  },
  image: { width: "100%", aspectRatio: 0.8, backgroundColor: colors.line },
  primary: {
    position: "absolute",
    top: 8,
    left: 8,
    color: colors.white,
    backgroundColor: colors.coral,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.pill,
    fontSize: 9,
    fontWeight: "900",
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 9,
  },
  action: { color: colors.plum, fontWeight: "900", fontSize: 18 },
});
