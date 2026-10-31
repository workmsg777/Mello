import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { absoluteMediaUrl, getApiErrorMessage } from "../../config/api";
import { ProfilePhoto } from "../../components/ProfilePhoto";
import { discoveryApi } from "../../services/discovery.service";
import { colors } from "../../theme";
import type { VenueOffering, VenueOfferingKind } from "../../types/discovery";
import { demoVenueOfferings } from "./demo";

const categories: {
  kind: VenueOfferingKind;
  label: string;
  heading: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    kind: "MENU",
    label: "Menu",
    heading: "On the menu",
    icon: "restaurant-outline",
  },
  {
    kind: "PACKAGE",
    label: "Packages",
    heading: "A little something together",
    icon: "gift-outline",
  },
  {
    kind: "PLAN",
    label: "Plans",
    heading: "Ideas from the venue",
    icon: "cafe-outline",
  },
  {
    kind: "EVENT",
    label: "Events",
    heading: "What’s happening here",
    icon: "musical-notes-outline",
  },
];

export function VenueContent({
  partnerId,
  demo,
  refreshKey = 0,
}: {
  partnerId: string;
  demo: boolean;
  refreshKey?: number;
}) {
  const [items, setItems] = useState<VenueOffering[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<VenueOfferingKind | "ALL">("ALL");
  const [gallery, setGallery] = useState<{
    photos: VenueOffering["photos"];
    index: number;
    title: string;
  } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [photoFailed, setPhotoFailed] = useState(false);
  const generation = useRef(0);
  const viewport = useWindowDimensions();
  const load = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true);
    setError(null);
    try {
      const result = demo
        ? demoVenueOfferings
        : await discoveryApi.venueContent(partnerId);
      if (generation.current === request) setItems(result);
    } catch (caught) {
      if (generation.current === request) setError(getApiErrorMessage(caught));
    } finally {
      if (generation.current === request) setLoading(false);
    }
  }, [partnerId, demo, refreshKey]);
  useEffect(() => {
    setFilter("ALL");
    setItems([]);
    setGallery(null);
  }, [partnerId, demo]);
  useEffect(() => {
    void load();
    return () => {
      generation.current++;
    };
  }, [load]);
  const movePhoto = (step: number) => {
    setGallery((current) =>
      current ? { ...current, index: current.index + step } : null,
    );
    setZoom(1);
    setPhotoFailed(false);
  };
  return (
    <View style={s.section}>
      <View style={s.row}>
        <View style={{ flex: 1, gap: 5 }}>
          <Text style={s.heading}>Menu & experiences</Text>
          <Text style={s.copy}>
            See what’s cooking, what’s included and what’s happening.
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Refresh café content"
          onPress={() => void load()}
          disabled={loading}
          style={s.iconButton}
        >
          <Ionicons name="refresh-outline" size={20} color={colors.plum} />
        </Pressable>
      </View>
      {demo ? (
        <Text style={s.demo}>SAMPLE CAFÉ CONTENT · DESIGN PREVIEW</Text>
      ) : null}
      {loading ? (
        <ActivityIndicator color={colors.coral} />
      ) : error ? (
        <View style={s.empty}>
          <Text style={s.copy}>{error}</Text>
          <Pressable accessibilityRole="button" onPress={() => void load()}>
            <Text style={s.link}>Try again</Text>
          </Pressable>
        </View>
      ) : !items.length ? (
        <View style={s.empty}>
          <Ionicons name="restaurant-outline" size={28} color={colors.coral} />
          <Text style={s.title}>A little more is on the way.</Text>
          <Text style={s.copy}>
            This venue hasn’t published a menu or experiences yet. Check back
            soon.
          </Text>
        </View>
      ) : (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.filters}
          >
            {[{ kind: "ALL" as const, label: "All" }, ...categories].map(
              (category) => (
                <Pressable
                  key={category.kind}
                  accessibilityRole="button"
                  accessibilityState={{ selected: filter === category.kind }}
                  onPress={() => setFilter(category.kind)}
                  style={[s.chip, filter === category.kind && s.chipActive]}
                >
                  <Text
                    style={[
                      s.chipText,
                      filter === category.kind && s.chipTextActive,
                    ]}
                  >
                    {category.label} ·{" "}
                    {category.kind === "ALL"
                      ? items.length
                      : items.filter((item) => item.kind === category.kind)
                          .length}
                  </Text>
                </Pressable>
              ),
            )}
          </ScrollView>
          {categories
            .filter((category) => filter === "ALL" || filter === category.kind)
            .map((category) => {
              const offerings = items.filter(
                (item) => item.kind === category.kind,
              );
              if (!offerings.length)
                return filter === "ALL" ? null : (
                  <Text key={category.kind} style={s.copy}>
                    The venue hasn’t published any{" "}
                    {category.label.toLowerCase()} yet.
                  </Text>
                );
              return (
                <View key={category.kind} style={s.group}>
                  <View style={s.row}>
                    <Ionicons
                      name={category.icon}
                      size={20}
                      color={colors.coral}
                    />
                    <Text style={s.groupHeading}>{category.heading}</Text>
                  </View>
                  {offerings.map((item) => (
                    <View key={item.id} style={s.card}>
                      <View style={s.titleRow}>
                        <Text style={[s.title, { flex: 1 }]}>{item.title}</Text>
                        {item.priceInr !== null ? (
                          <Text style={s.price}>
                            ₹{item.priceInr.toLocaleString("en-IN")}
                          </Text>
                        ) : null}
                      </View>
                      {item.description ? (
                        <Text selectable style={s.description}>
                          {item.description}
                        </Text>
                      ) : null}
                      {item.startsAt ? (
                        <View style={s.row}>
                          <Ionicons
                            name="calendar-outline"
                            size={16}
                            color={colors.plum}
                          />
                          <Text style={[s.copy, { flex: 1 }]}>
                            {new Date(item.startsAt).toLocaleString()}
                            {item.endsAt
                              ? ` – ${new Date(item.endsAt).toLocaleString()}`
                              : ""}
                          </Text>
                        </View>
                      ) : null}
                      {item.photos.length ? (
                        <>
                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={s.photos}
                          >
                            {item.photos.map((photo, index) => (
                              <Pressable
                                key={photo.id}
                                accessibilityRole="button"
                                accessibilityLabel={`View ${item.title} photo ${index + 1} full screen`}
                                onPress={() => {
                                  setZoom(1);
                                  setPhotoFailed(false);
                                  setGallery({
                                    photos: item.photos,
                                    index,
                                    title: item.title,
                                  });
                                }}
                              >
                                <ProfilePhoto url={photo.url} style={s.photo} />
                                <View style={s.photoCaption}>
                                  <Ionicons
                                    name="expand-outline"
                                    size={14}
                                    color={colors.plum}
                                  />
                                  <Text style={s.photoLabel}>
                                    Tap to view · {index + 1}/
                                    {item.photos.length}
                                  </Text>
                                </View>
                              </Pressable>
                            ))}
                          </ScrollView>
                          <Text style={s.hint}>
                            Open menu photos to read them in full. Use + to zoom
                            in.
                          </Text>
                        </>
                      ) : null}
                    </View>
                  ))}
                </View>
              );
            })}
          <Text style={s.hint}>
            Details and prices are provided by the venue. Confirm availability
            with the café when planning your visit.
          </Text>
        </>
      )}
      <Modal
        visible={!!gallery}
        animationType="fade"
        onRequestClose={() => setGallery(null)}
      >
        <SafeAreaView style={s.gallery}>
          <View style={s.galleryBar}>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={s.galleryTitle}>
                {gallery?.title}
              </Text>
              <Text style={s.galleryCopy}>
                {(gallery?.index ?? 0) + 1} / {gallery?.photos.length ?? 0}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close photo"
              onPress={() => setGallery(null)}
              style={s.iconButton}
            >
              <Ionicons name="close" size={26} color="white" />
            </Pressable>
          </View>
          <ScrollView
            key={`${gallery?.index}:${zoom}`}
            horizontal
            style={{ flex: 1 }}
            contentContainerStyle={{ width: viewport.width * zoom }}
          >
            <ScrollView
              contentContainerStyle={{
                minHeight: Math.max(200, viewport.height - 180),
                justifyContent: "center",
              }}
            >
              {gallery ? (
                <Image
                  source={{
                    uri: absoluteMediaUrl(gallery.photos[gallery.index]!.url),
                  }}
                  contentFit="contain"
                  style={{
                    width: viewport.width * zoom,
                    height: Math.max(200, viewport.height - 180) * zoom,
                  }}
                  onError={() => setPhotoFailed(true)}
                />
              ) : null}
            </ScrollView>
          </ScrollView>
          {photoFailed ? (
            <Text style={s.galleryCopy}>
              This photo couldn’t load. Close and try opening it again.
            </Text>
          ) : null}
          <View style={[s.galleryBar, { justifyContent: "center" }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous photo"
              disabled={!gallery || gallery.index === 0}
              onPress={() => movePhoto(-1)}
              style={[
                s.iconButton,
                (!gallery || gallery.index === 0) && s.disabled,
              ]}
            >
              <Ionicons name="chevron-back" size={24} color="white" />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Zoom out"
              disabled={zoom <= 1}
              onPress={() => setZoom((value) => Math.max(1, value - 0.5))}
              style={[s.iconButton, zoom <= 1 && s.disabled]}
            >
              <Ionicons name="remove" size={24} color="white" />
            </Pressable>
            <Text style={s.galleryCopy}>{Math.round(zoom * 100)}%</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Zoom in"
              disabled={zoom >= 3}
              onPress={() => setZoom((value) => Math.min(3, value + 0.5))}
              style={[s.iconButton, zoom >= 3 && s.disabled]}
            >
              <Ionicons name="add" size={24} color="white" />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next photo"
              disabled={!gallery || gallery.index >= gallery.photos.length - 1}
              onPress={() => movePhoto(1)}
              style={[
                s.iconButton,
                (!gallery || gallery.index >= gallery.photos.length - 1) &&
                  s.disabled,
              ]}
            >
              <Ionicons name="chevron-forward" size={24} color="white" />
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}
const s = StyleSheet.create({
  section: { gap: 18, paddingVertical: 15 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  heading: { fontSize: 21, color: colors.plum, fontWeight: "600" },
  groupHeading: {
    fontSize: 16,
    color: colors.plum,
    fontWeight: "600",
    flexShrink: 1,
  },
  group: { gap: 12 },
  filters: { gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 24,
    paddingHorizontal: 15,
    paddingVertical: 11,
  },
  chipActive: { backgroundColor: colors.coralSoft, borderColor: colors.rose },
  chipText: { fontSize: 12, color: colors.inkSoft, fontWeight: "600" },
  chipTextActive: { color: colors.plum },
  card: {
    borderWidth: 1,
    borderColor: colors.line,
    padding: 17,
    borderRadius: 18,
    gap: 12,
    backgroundColor: "#FFFCFA",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: 10,
  },
  title: { fontSize: 17, color: colors.ink, fontWeight: "600" },
  copy: { fontSize: 13, lineHeight: 20, color: colors.muted },
  description: { fontSize: 14, lineHeight: 24, color: colors.inkSoft },
  price: { fontSize: 15, color: colors.plum, fontWeight: "700" },
  photos: { gap: 10 },
  photo: { width: 230, height: 210, borderRadius: 14 },
  photoCaption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingTop: 9,
  },
  photoLabel: { color: colors.plum, fontSize: 11, fontWeight: "600" },
  hint: { color: colors.muted, fontSize: 11, lineHeight: 18 },
  demo: {
    fontSize: 10,
    letterSpacing: 1,
    color: colors.coral,
    fontWeight: "700",
  },
  empty: {
    padding: 20,
    borderRadius: 18,
    backgroundColor: colors.cream,
    gap: 10,
  },
  link: { color: colors.coral, fontWeight: "700", paddingVertical: 8 },
  iconButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: { opacity: 0.3 },
  gallery: { flex: 1, backgroundColor: "#21171D" },
  galleryBar: {
    paddingHorizontal: 15,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  galleryTitle: { color: "white", fontSize: 17, fontWeight: "600" },
  galleryCopy: { color: "#E8D8E0", fontSize: 13, textAlign: "center" },
});
