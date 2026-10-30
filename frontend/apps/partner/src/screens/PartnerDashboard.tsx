import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, getApiErrorMessage } from "../config/api";
import type { StoredSession } from "../types/auth";
import { PartnerTeam } from "./PartnerTeam";
import { PartnerContent } from "./PartnerContent";
import { CitySelect } from "../components/CitySelect";
import type { Permissions } from "../services/partner.service";

type Kind = "CAFE" | "RESTAURANT" | "ACTIVITY";
interface Venue {
  id: string;
  name: string;
  description: string | null;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  latitude: number | null;
  longitude: number | null;
  kind: Kind | null;
  headline: string | null;
  imageUrl: string | null;
  priceForTwoInr: number | null;
  durationMinutes: number | null;
  tags: string[] | null;
  isPublished: boolean;
}
interface DateRequest {
  id: string;
  proposedAt: string;
  status: string;
  partnerStatus: string;
  title: string;
}
const palette = {
  ink: "#203D35",
  green: "#315C4C",
  muted: "#7D8C80",
  cream: "#F7F8F2",
  line: "#DFE5DA",
  soft: "#EAF0E5",
};
function Field({
  label,
  value,
  onChangeText,
  multiline = false,
  keyboardType = "default",
  editable = true,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  multiline?: boolean;
  keyboardType?: "default" | "numeric" | "url";
  editable?: boolean;
}) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        style={[
          s.input,
          multiline && { minHeight: 100, textAlignVertical: "top" },
        ]}
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        keyboardType={keyboardType}
        editable={editable}
        placeholderTextColor={palette.muted}
      />
    </View>
  );
}
export function PartnerDashboard({
  session,
  onSignOut,
}: {
  session: StoredSession;
  onSignOut: () => Promise<void>;
}) {
  const [venue, setVenue] = useState<Venue | null>(null);
  const [requests, setRequests] = useState<DateRequest[]>([]);
  const [permissions, setPermissions] = useState<Permissions>({
    manageTeam: false,
    manageListing: false,
    manageRequests: false,
    manageContent: false,
  });
  const [tab, setTab] = useState<"listing" | "requests" | "team" | "content">(
    "listing",
  );
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState("90");
  const [tags, setTags] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const workspace = await api.get<{
        venue: Venue;
        permissions: Permissions;
      }>("/partner/workspace");
      const value = workspace.data.venue;
      const access = workspace.data.permissions;
      setVenue(value);
      setPermissions(access);
      if (!access.manageListing) setTab("content");
      setRequests(
        access.manageRequests
          ? (await api.get<DateRequest[]>("/partner/requests")).data
          : [],
      );
      setPrice(value.priceForTwoInr?.toString() ?? "");
      setDuration(String(value.durationMinutes ?? 90));
      setTags(value.tags?.join(", ") ?? "");
      setLatitude(value.latitude?.toString() ?? "");
      setLongitude(value.longitude?.toString() ?? "");
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const update = <K extends keyof Venue>(key: K, value: Venue[K]) =>
    setVenue((current) => (current ? { ...current, [key]: value } : current));
  const save = async () => {
    if (!venue) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await api.put<{ venue: Venue }>("/partner/listing", {
        ...venue,
        description: venue.description ?? "",
        kind: venue.kind ?? "CAFE",
        headline: venue.headline ?? "",
        imageUrl: venue.imageUrl?.trim() || null,
        priceForTwoInr: price.trim() ? Number(price) : null,
        durationMinutes: Number(duration),
        tags: tags
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean),
        latitude: latitude.trim() ? Number(latitude) : null,
        longitude: longitude.trim() ? Number(longitude) : null,
      });
      setVenue(response.data.venue);
      setNotice(
        response.data.venue.isPublished
          ? "Your listing is live. A lovely first date could start here."
          : "Draft saved. Publish whenever you’re ready.",
      );
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const respond = async (id: string, status: "CONFIRMED" | "DECLINED") => {
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/partner/requests/${id}`, { status });
      setRequests((await api.get<DateRequest[]>("/partner/requests")).data);
      setNotice(
        status === "CONFIRMED"
          ? "Date confirmed. Time to make it special."
          : "The couple has been notified that this request is unavailable.",
      );
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const pending = requests.filter(
    (x) =>
      x.status === "ACCEPTED" &&
      x.partnerStatus === "PENDING" &&
      new Date(x.proposedAt).getTime() > Date.now(),
  ).length;
  return (
    <SafeAreaView style={s.screen}>
      <View style={s.topbar}>
        <Text style={s.brand}>
          mello<Text style={{ color: "#C67C86" }}>.</Text>
          <Text style={s.partnerLabel}> PARTNER</Text>
        </Text>
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => {
            setBusy(true);
            void onSignOut().catch((e) => {
              setError(getApiErrorMessage(e));
              setBusy(false);
            });
          }}
        >
          <Text style={s.link}>Sign out ↗</Text>
        </Pressable>
      </View>
      <ScrollView
        contentContainerStyle={s.page}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={() => void load()} />
        }
      >
        <Text style={s.eyebrow}>GOOD PLACES. GREAT CONNECTIONS.</Text>
        <Text style={s.title}>
          Make room for{" "}
          <Text style={{ fontStyle: "italic" }}>a little romance.</Text>
        </Text>
        <Text style={s.copy}>
          Welcome, {session.profile.name ?? "partner"}. Give lovely people a
          place to make a memory.
        </Text>
        <View style={s.stats}>
          <View style={s.stat}>
            <Text style={s.statNumber}>
              {venue?.isPublished ? "Live" : "Draft"}
            </Text>
            <Text style={s.statLabel}>YOUR LISTING</Text>
          </View>
          <View style={s.stat}>
            <Text style={s.statNumber}>
              {pending.toString().padStart(2, "0")}
            </Text>
            <Text style={s.statLabel}>AWAITING YOUR REPLY</Text>
          </View>
          <View style={s.stat}>
            <Text style={s.statNumber}>
              {requests
                .filter(
                  (x) =>
                    x.status === "ACCEPTED" && x.partnerStatus === "CONFIRMED",
                )
                .length.toString()
                .padStart(2, "0")}
            </Text>
            <Text style={s.statLabel}>DATES CONFIRMED</Text>
          </View>
        </View>
        <View style={s.tabs}>
          {(
            [
              "content",
              ...(permissions.manageListing ? ["listing" as const] : []),
              ...(permissions.manageRequests ? ["requests" as const] : []),
              ...(permissions.manageTeam ? ["team" as const] : []),
            ] as const
          ).map((value) => (
            <Pressable
              accessibilityRole="button"
              key={value}
              style={[s.tab, tab === value && s.tabActive]}
              onPress={() => {
                setTab(value);
                setNotice(null);
              }}
            >
              <Text style={[s.tabText, tab === value && { color: "white" }]}>
                {value === "content"
                  ? "Menus & experiences"
                  : value === "team"
                    ? "Your team"
                    : value === "listing"
                      ? "Your lovely place"
                      : `Date requests${pending ? ` · ${pending}` : ""}`}
              </Text>
            </Pressable>
          ))}
        </View>
        {error ? (
          <View style={s.error}>
            <Text style={s.errorText}>{error}</Text>
          </View>
        ) : null}
        {notice ? (
          <View style={s.notice}>
            <Text style={s.copy}>{notice}</Text>
          </View>
        ) : null}
        {loading ? (
          <ActivityIndicator size="large" color={palette.green} />
        ) : null}
        {!loading && !venue ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => void load()}
            style={s.button}
          >
            <Text style={s.buttonText}>Try again</Text>
          </Pressable>
        ) : null}
        {!loading && venue && tab === "team" && permissions.manageTeam ? (
          <PartnerTeam />
        ) : null}
        {!loading && venue && tab === "content" && permissions.manageContent ? (
          <PartnerContent />
        ) : null}
        {!loading && venue && tab === "listing" && permissions.manageListing ? (
          <>
            {!permissions.manageListing ? (
              <Text style={s.copy}>
                Your partner admin can edit and publish this listing.
              </Text>
            ) : null}
            <View style={s.card}>
              <Text style={s.sectionTitle}>
                A first impression worth making.
              </Text>
              <Text style={s.copy}>
                This is how your place appears to matched couples in{" "}
                {venue.city}.
              </Text>
              {venue.imageUrl ? (
                <Image source={{ uri: venue.imageUrl }} style={s.cover} />
              ) : (
                <View style={s.coverPlaceholder}>
                  <Text style={s.placeholderText}>
                    A little glimpse of your lovely place.
                  </Text>
                </View>
              )}
              <Field
                label="Venue name"
                value={venue.name}
                onChangeText={(v) => update("name", v)}
              />
              <Text style={s.label}>YOUR KIND OF PLACE</Text>
              <View style={s.kinds}>
                {(["CAFE", "RESTAURANT", "ACTIVITY"] as const).map((kind) => (
                  <Pressable
                    accessibilityRole="button"
                    key={kind}
                    onPress={() => update("kind", kind)}
                    style={[
                      s.kind,
                      (venue.kind ?? "CAFE") === kind && s.kindActive,
                    ]}
                  >
                    <Text style={s.kindText}>
                      {
                        {
                          CAFE: "Café",
                          RESTAURANT: "Restaurant",
                          ACTIVITY: "Fun & activities",
                        }[kind]
                      }
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Field
                label="A charming headline · 5–160 characters"
                value={venue.headline ?? ""}
                onChangeText={(v) => update("headline", v)}
              />
              <Field
                label="Tell your story"
                multiline
                value={venue.description ?? ""}
                onChangeText={(v) => update("description", v)}
              />
              <Field
                label="Cover photo URL · HTTPS"
                keyboardType="url"
                value={venue.imageUrl ?? ""}
                onChangeText={(v) => update("imageUrl", v)}
              />
              <Field
                label="Estimated price for two · INR (optional)"
                keyboardType="numeric"
                value={price}
                onChangeText={setPrice}
              />
              <Field
                label="Experience duration · minutes"
                keyboardType="numeric"
                value={duration}
                onChangeText={setDuration}
              />
              <Field
                label="A few lovely details · up to 6 tags, separated by commas"
                value={tags}
                onChangeText={setTags}
              />
            </View>
            <View style={s.card}>
              <Text style={s.sectionTitle}>Put your place on the map.</Text>
              <Field
                label="Street address"
                value={venue.address}
                onChangeText={(v) => update("address", v)}
              />
              <CitySelect
                value={venue.city}
                disabled={!permissions.manageListing}
                onSelect={(city) =>
                  setVenue((current) =>
                    current
                      ? { ...current, city: city.value, state: city.state }
                      : current,
                  )
                }
              />
              <Field
                label="State · filled automatically"
                value={venue.state}
                editable={false}
                onChangeText={() => undefined}
              />
              <Field
                label="Postal code"
                value={venue.postalCode}
                onChangeText={(v) => update("postalCode", v)}
              />
              <Field
                label="Latitude (optional)"
                value={latitude}
                onChangeText={setLatitude}
              />
              <Field
                label="Longitude (optional)"
                value={longitude}
                onChangeText={setLongitude}
              />
              <Text style={s.copy}>
                Coordinates help guests see an approximate distance from their
                city centre.
              </Text>
            </View>
            <View style={s.publish}>
              <View style={{ flex: 1 }}>
                <Text style={s.publishTitle}>
                  Ready for your first Mello date?
                </Text>
                <Text style={s.copy}>
                  Published listings appear to users in your city.
                </Text>
              </View>
              <Switch
                accessibilityLabel="Publish venue listing"
                disabled={!permissions.manageListing}
                value={venue.isPublished}
                onValueChange={(v) => update("isPublished", v)}
                trackColor={{ true: palette.green }}
              />
            </View>
            <Pressable
              accessibilityRole="button"
              disabled={busy || !permissions.manageListing}
              onPress={() => void save()}
              style={[
                s.button,
                (busy || !permissions.manageListing) && { opacity: 0.5 },
              ]}
            >
              {busy ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={s.buttonText}>
                  Save{" "}
                  {venue.isPublished ? "& publish your place" : "your draft"} →
                </Text>
              )}
            </Pressable>
          </>
        ) : null}
        {!loading && tab === "requests" ? (
          requests.length ? (
            requests.map((item) => (
              <View style={s.card} key={item.id}>
                <View style={s.requestHeader}>
                  <Text style={s.sectionTitle}>A little plan for two.</Text>
                  <Text style={s.badge}>
                    {item.status === "CANCELLED"
                      ? "CANCELLED"
                      : item.partnerStatus}
                  </Text>
                </View>
                <Text style={s.requestDate}>
                  {new Date(item.proposedAt).toLocaleString([], {
                    dateStyle: "full",
                    timeStyle: "short",
                  })}
                </Text>
                <Text style={s.copy}>
                  2 guests · Both people have agreed to this invitation.
                </Text>
                {item.status === "ACCEPTED" &&
                item.partnerStatus === "PENDING" &&
                new Date(item.proposedAt).getTime() > Date.now() ? (
                  <View style={s.requestActions}>
                    <Pressable
                      accessibilityRole="button"
                      disabled={busy}
                      style={s.button}
                      onPress={() => void respond(item.id, "CONFIRMED")}
                    >
                      <Text style={s.buttonText}>We’d love to host them</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      disabled={busy}
                      style={s.secondaryButton}
                      onPress={() => void respond(item.id, "DECLINED")}
                    >
                      <Text style={s.link}>Unavailable this time</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            ))
          ) : (
            <View style={s.empty}>
              <Text style={s.emptyIcon}>♡</Text>
              <Text style={s.sectionTitle}>
                Their next chapter could start here.
              </Text>
              <Text style={s.copy}>
                Once a couple accepts a date at your venue, their request will
                appear here. Confirm availability to complete their plan.
              </Text>
            </View>
          )
        ) : null}
        <Text style={s.footer}>LOVELY PLACES MAKE LOVELY STORIES. ♡</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.cream },
  topbar: {
    height: 78,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FDFEF9",
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
  },
  brand: {
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -1.5,
    color: palette.ink,
  },
  partnerLabel: { fontSize: 9, letterSpacing: 2, color: palette.muted },
  link: { fontSize: 12, fontWeight: "700", color: palette.green },
  page: {
    padding: 24,
    paddingBottom: 45,
    maxWidth: 850,
    width: "100%",
    alignSelf: "center",
    gap: 22,
  },
  eyebrow: {
    fontSize: 9,
    letterSpacing: 1.8,
    color: palette.muted,
    marginTop: 15,
    fontWeight: "800",
  },
  title: {
    fontFamily: Platform.OS === "android" ? "serif" : "Georgia",
    fontSize: 37,
    lineHeight: 45,
    letterSpacing: -1,
    color: palette.ink,
  },
  copy: { fontSize: 12, lineHeight: 21, color: palette.muted },
  stats: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 22,
    backgroundColor: "white",
    paddingVertical: 23,
  },
  stat: { flex: 1, alignItems: "center", gap: 10 },
  statNumber: {
    fontFamily: Platform.OS === "android" ? "serif" : "Georgia",
    fontSize: 29,
    color: palette.green,
  },
  statLabel: {
    fontSize: 7,
    letterSpacing: 0.7,
    fontWeight: "800",
    color: palette.muted,
    textAlign: "center",
  },
  tabs: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 5,
    backgroundColor: palette.soft,
    borderRadius: 30,
    gap: 6,
  },
  tab: {
    flex: 1,
    minWidth: 130,
    borderRadius: 25,
    paddingVertical: 14,
    alignItems: "center",
  },
  tabActive: { backgroundColor: palette.green },
  tabText: { fontSize: 12, fontWeight: "700", color: palette.green },
  card: {
    backgroundColor: "white",
    borderRadius: 23,
    borderWidth: 1,
    borderColor: palette.line,
    padding: 23,
    gap: 19,
  },
  sectionTitle: {
    fontFamily: Platform.OS === "android" ? "serif" : "Georgia",
    fontSize: 24,
    color: palette.ink,
    flexShrink: 1,
  },
  cover: { height: 210, width: "100%", borderRadius: 16 },
  coverPlaceholder: {
    height: 130,
    borderRadius: 16,
    backgroundColor: palette.soft,
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderText: { color: palette.muted, fontSize: 12 },
  field: { gap: 9 },
  label: { fontSize: 11, fontWeight: "700", color: palette.green },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: palette.ink,
    backgroundColor: "#FCFDF9",
  },
  kinds: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  kind: {
    paddingHorizontal: 17,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.line,
  },
  kindActive: { backgroundColor: palette.soft, borderColor: palette.green },
  kindText: { fontSize: 11, color: palette.green },
  publish: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: palette.soft,
    padding: 22,
    borderRadius: 20,
    gap: 15,
  },
  publishTitle: {
    fontSize: 15,
    color: palette.ink,
    fontWeight: "600",
    marginBottom: 8,
  },
  button: {
    minHeight: 53,
    borderRadius: 28,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.green,
  },
  buttonText: { fontSize: 13, color: "white", fontWeight: "700" },
  secondaryButton: {
    minHeight: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  error: { padding: 16, backgroundColor: "#FBE7E8", borderRadius: 13 },
  errorText: { color: "#A5394D", fontSize: 12, lineHeight: 19 },
  notice: { padding: 16, backgroundColor: palette.soft, borderRadius: 13 },
  requestHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  badge: {
    fontSize: 8,
    letterSpacing: 0.8,
    color: palette.green,
    backgroundColor: palette.soft,
    padding: 9,
    borderRadius: 15,
  },
  requestDate: {
    fontSize: 15,
    fontWeight: "600",
    color: palette.green,
    lineHeight: 23,
  },
  requestActions: { gap: 8, marginTop: 7 },
  empty: { padding: 30, alignItems: "center", gap: 22 },
  emptyIcon: { fontSize: 65, color: palette.green },
  footer: {
    fontSize: 8,
    letterSpacing: 1.6,
    color: palette.muted,
    textAlign: "center",
    marginTop: 20,
  },
});
