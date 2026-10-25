import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { ProfilePhoto } from "../../components/ProfilePhoto";
import { PrimaryButton } from "../../components/ui";
import { colors } from "../../theme";
import type { DiscoveryCard, IncomingLike } from "../../types/discovery";

export function LikesInbox({
  people,
  total,
  busy,
  more,
  onMore,
  onRespond,
  onDetails,
  onDiscover,
}: {
  people: IncomingLike[];
  total: number;
  busy: boolean;
  more: boolean;
  onMore: () => void;
  onRespond: (person: DiscoveryCard, action: "LIKE" | "PASS") => void;
  onDetails: (person: DiscoveryCard) => void;
  onDiscover: () => void;
}) {
  const wide = useWindowDimensions().width >= 900;
  return (
    <View style={{ gap: 24 }}>
      <View style={s.explanation}>
        <Ionicons name="heart-outline" size={22} color={colors.coral} />
        <Text style={s.explanationText}>
          They liked you. Take a look, and like back if you feel a spark. A
          conversation opens only when you both choose each other.
        </Text>
      </View>
      {people.length ? (
        <>
          <Text style={s.count}>
            {total} {total === 1 ? "person is" : "people are"} hoping to meet
            you
          </Text>
          <View style={s.grid}>
            {people.map((person) => (
              <View
                key={person.userId}
                style={[s.card, wide && { width: "31.8%" }]}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`View ${person.profile.displayName}'s profile`}
                  onPress={() => onDetails(person)}
                >
                  <ProfilePhoto url={person.photos[0]?.url} style={s.photo}>
                    <LinearGradient
                      colors={["transparent", "rgba(35,18,29,0.85)"]}
                      style={StyleSheet.absoluteFill}
                    />
                    <View style={s.liked}>
                      <Ionicons name="heart" size={13} color={colors.coral} />
                      <Text style={s.likedText}>LIKED YOU</Text>
                    </View>
                    <View style={s.caption}>
                      <Text style={s.name}>
                        {person.profile.displayName}, {person.profile.age}
                      </Text>
                      <Text style={s.meta}>
                        {person.profile.currentCity?.name ??
                          "A little possibility"}
                        {person.profile.jobTitle
                          ? ` · ${person.profile.jobTitle}`
                          : ""}
                      </Text>
                    </View>
                  </ProfilePhoto>
                </Pressable>
                <View style={s.body}>
                  <Text numberOfLines={2} style={s.bio}>
                    {person.profile.bio ||
                      "Something lovely could start with a mutual spark."}
                  </Text>
                  <View style={s.actions}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Pass on ${person.profile.displayName}`}
                      disabled={busy}
                      onPress={() => onRespond(person, "PASS")}
                      style={s.pass}
                    >
                      <Ionicons name="close" size={21} color={colors.muted} />
                      <Text style={s.passText}>Pass</Text>
                    </Pressable>
                    <View style={{ flex: 1 }}>
                      <PrimaryButton
                        label="Like back"
                        disabled={busy}
                        onPress={() => onRespond(person, "LIKE")}
                      />
                    </View>
                  </View>
                </View>
              </View>
            ))}
          </View>
          {more ? (
            <PrimaryButton
              label="See more likes"
              kind="ghost"
              loading={busy}
              onPress={onMore}
            />
          ) : null}
        </>
      ) : (
        <View style={s.empty}>
          <Text style={s.heart}>♡</Text>
          <Text style={s.emptyTitle}>A little interest, on its way.</Text>
          <Text style={s.emptyCopy}>
            When someone likes your profile, you’ll see them here. You decide
            who you’d like to get to know.
          </Text>
          <PrimaryButton label="Discover people" onPress={onDiscover} />
        </View>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  explanation: {
    backgroundColor: colors.coralSoft,
    padding: 20,
    borderRadius: 20,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  explanationText: {
    flex: 1,
    color: colors.plum,
    fontSize: 12,
    lineHeight: 20,
  },
  count: { fontSize: 13, fontWeight: "600", color: colors.inkSoft },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 22 },
  card: {
    width: "100%",
    borderRadius: 25,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "white",
    overflow: "hidden",
  },
  photo: { height: 310, justifyContent: "flex-end" },
  liked: {
    position: "absolute",
    left: 16,
    top: 16,
    padding: 9,
    backgroundColor: colors.cream,
    borderRadius: 20,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  likedText: {
    color: colors.coral,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
  },
  caption: { padding: 20, gap: 7 },
  name: { color: "white", fontSize: 24, fontWeight: "700" },
  meta: { color: "#FFE9F0", fontSize: 11, lineHeight: 17 },
  body: { padding: 18, gap: 14 },
  bio: { color: colors.muted, fontSize: 12, lineHeight: 20, minHeight: 40 },
  actions: { flexDirection: "row", alignItems: "center", gap: 12 },
  pass: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    padding: 12,
  },
  passText: { color: colors.muted, fontSize: 12 },
  empty: { alignItems: "center", padding: 35, gap: 15 },
  heart: { fontSize: 58, color: colors.coral },
  emptyTitle: { fontSize: 25, color: colors.plum, textAlign: "center" },
  emptyCopy: {
    maxWidth: 400,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 5,
  },
});
