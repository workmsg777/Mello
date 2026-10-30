import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { Redirect, router } from "expo-router";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
  type RefObject,
} from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { ProfilePhoto } from "../../components/ProfilePhoto";
import { SafeAreaView } from "react-native-safe-area-context";
import { absoluteMediaUrl, getApiErrorMessage } from "../../config/api";
import { ErrorNotice, Field, PrimaryButton } from "../../components/ui";
import { discoveryApi } from "../../services/discovery.service";
import { useAppDispatch, useAppSelector } from "../../store";
import { clearDatingData } from "../../store/datingSlice";
import { signOut } from "../../store/sessionSlice";
import { colors } from "../../theme";
import type {
  DatePlan,
  DiscoveryCard,
  Match,
  IncomingLike,
  DiscoveryFeed,
  Venue,
  VenueKind,
} from "../../types/discovery";
import { demoMatches, demoProfiles, demoVenues } from "./demo";
import { ChatInbox } from "../chat/ChatInbox";
import { useChat } from "../chat/useChat";
import { LikesInbox } from "./LikesInbox";
import { VenueContent } from "./VenueContent";

type Tab = "discover" | "likes" | "sparks" | "dates" | "profile";
const serif = Platform.select({
  ios: "Georgia",
  android: "serif",
  default: "Georgia, serif",
});
const tabs: { id: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }[] =
  [
    { id: "discover", label: "Discover", icon: "planet-outline" },
    { id: "likes", label: "Liked you", icon: "heart-outline" },
    { id: "sparks", label: "Chats", icon: "chatbubbles-outline" },
    { id: "profile", label: "You", icon: "person-outline" },
  ];
const money = (value: number | null) =>
  value === null
    ? "Ask venue for pricing"
    : `₹${value.toLocaleString("en-IN")} for two`;
const kindLabel = (kind: VenueKind) =>
  ({
    CAFE: "Coffee & conversation",
    RESTAURANT: "Dinner for two",
    ACTIVITY: "A little adventure",
  })[kind];
function PageContent({
  chat,
  scrollRef,
  loading,
  onRefresh,
  children,
}: PropsWithChildren<{
  chat: boolean;
  scrollRef: RefObject<ScrollViewInstance | null>;
  loading: boolean;
  onRefresh: () => void;
}>) {
  if (chat)
    return (
      <View style={[s.content, { flex: 1, minHeight: 0, paddingBottom: 12 }]}>
        {children}
      </View>
    );
  return (
    <ScrollView
      ref={scrollRef}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={onRefresh}
          tintColor={colors.coral}
        />
      }
    >
      {children}
    </ScrollView>
  );
}
function localDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function tomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return localDate(d);
}
function Empty({
  icon,
  title,
  copy,
  action,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  copy: string;
  action?: string;
  onPress?: () => void;
}) {
  return (
    <View style={s.empty}>
      <View style={s.emptyIcon}>
        <Ionicons name={icon} size={32} color={colors.coral} />
      </View>
      <Text style={s.emptyTitle}>{title}</Text>
      <Text style={s.copy}>{copy}</Text>
      {action && onPress ? (
        <PrimaryButton label={action} onPress={onPress} />
      ) : null}
    </View>
  );
}
function PersonCard({
  person,
  onDetails,
  onLike,
  onPass,
  busy,
}: {
  person: DiscoveryCard;
  onDetails: () => void;
  onLike: () => void;
  onPass: () => void;
  busy: boolean;
}) {
  const position = useRef(new Animated.ValueXY()).current;
  const viewport = useWindowDimensions();
  const [photo, setPhoto] = useState(0);
  useEffect(() => {
    position.setValue({ x: 0, y: 0 });
    setPhoto(0);
  }, [person.userId, position]);
  const actions = useRef({ onLike, onPass, busy });
  actions.current = { onLike, onPass, busy };
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        !actions.current.busy &&
        Math.abs(g.dx) > 15 &&
        Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderMove: (_, g) => position.setValue({ x: g.dx, y: 0 }),
      onPanResponderRelease: (_, g) => {
        if (Math.abs(g.dx) > 100)
          g.dx > 0 ? actions.current.onLike() : actions.current.onPass();
        Animated.spring(position, {
          toValue: { x: 0, y: 0 },
          useNativeDriver: true,
          friction: 7,
        }).start();
      },
      onPanResponderTerminate: () =>
        Animated.spring(position, {
          toValue: { x: 0, y: 0 },
          useNativeDriver: true,
        }).start(),
    }),
  ).current;
  const uri = absoluteMediaUrl(person.photos[photo]?.url ?? null);
  return (
    <View style={s.cardWrap}>
      <Animated.View
        {...pan.panHandlers}
        style={[
          s.personCard,
          {
            transform: [
              { translateX: position.x },
              {
                rotate: position.x.interpolate({
                  inputRange: [-250, 0, 250],
                  outputRange: ["-8deg", "0deg", "8deg"],
                }),
              },
            ],
          },
        ]}
      >
        <ProfilePhoto
          url={person.photos[photo]?.url}
          style={[
            s.personImage,
            viewport.width < 900 && {
              height: Math.max(300, Math.min(470, viewport.height - 510)),
            },
          ]}
        >
          {!uri ? (
            <View style={s.noPhoto}>
              <Ionicons name="person-outline" size={80} color={colors.rose} />
            </View>
          ) : null}
          <LinearGradient
            colors={[
              "rgba(27,17,23,0.2)",
              "transparent",
              "rgba(27,17,23,0.88)",
            ]}
            locations={[0, 0.4, 1]}
            style={StyleSheet.absoluteFill}
          />
          <View style={s.cardTop}>
            <View style={s.intentPill}>
              <Ionicons name="flower-outline" size={13} color="white" />
              <Text style={s.intentText}>Here for something real</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={onDetails}
              accessibilityLabel="About this compatibility score"
              style={s.compatibility}
            >
              <Text style={s.percent}>
                {person.compatibility.percentage}
                <Text style={{ fontSize: 15 }}>%</Text>
              </Text>
              <Text style={s.percentLabel}>DEMO MATCH</Text>
            </Pressable>
          </View>
          {person.photos.length > 1 ? (
            <View style={s.photoControls}>
              {person.photos.map((item, i) => (
                <Pressable
                  accessibilityRole="button"
                  key={item.id}
                  onPress={() => setPhoto(i)}
                  accessibilityLabel={`Show photo ${i + 1}`}
                  style={[s.photoDot, i === photo && s.photoDotActive]}
                />
              ))}
            </View>
          ) : null}
          <View style={s.personInfo}>
            <View style={s.row}>
              <Text style={s.personName}>
                {person.profile.displayName},{" "}
                <Text style={{ fontWeight: "400" }}>{person.profile.age}</Text>
              </Text>
              <Pressable
                accessibilityRole="button"
                style={s.infoButton}
                onPress={onDetails}
                accessibilityLabel="View full profile"
              >
                <Ionicons name="arrow-up-outline" size={20} color="white" />
              </Pressable>
            </View>
            <Text style={s.personLocation}>
              <Ionicons name="location-outline" size={14} />{" "}
              {person.profile.currentCity?.name ?? "City not shared"}
              {person.profile.jobTitle ? `  ·  ${person.profile.jobTitle}` : ""}
            </Text>
            <View style={s.tags}>
              {person.interests.slice(0, 3).map((x) => (
                <View key={x.id} style={s.glassTag}>
                  <Text style={s.glassTagText}>{x.name}</Text>
                </View>
              ))}
            </View>
          </View>
        </ProfilePhoto>
        <Animated.View
          pointerEvents="none"
          style={[
            s.swipeStamp,
            {
              opacity: position.x.interpolate({
                inputRange: [0, 70],
                outputRange: [0, 1],
                extrapolate: "clamp",
              }),
            },
          ]}
        >
          <Text style={s.swipeText}>SPARK ♥</Text>
        </Animated.View>
      </Animated.View>
      <View style={s.cardActions}>
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          accessibilityLabel="Pass on this profile"
          onPress={onPass}
          style={({ pressed }) => [s.passButton, pressed && s.pressed]}
        >
          <Ionicons name="close-outline" size={30} color={colors.muted} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          accessibilityLabel="Like this profile"
          onPress={onLike}
          style={({ pressed }) => [s.likeButton, pressed && s.pressed]}
        >
          <LinearGradient
            colors={["#E77D8C", "#CB4568"]}
            style={s.likeGradient}
          >
            {busy ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Ionicons name="heart" size={23} color="white" />
                <Text style={s.likeText}>Send a little spark</Text>
              </>
            )}
          </LinearGradient>
        </Pressable>
      </View>
      <Text style={s.cardHint}>
        A thoughtful hello starts with a little courage.
      </Text>
    </View>
  );
}

export function DiscoveryExperience({ demo = false }: { demo?: boolean }) {
  const dispatch = useAppDispatch();
  const session = useAppSelector((x) => x.session);
  const dating = useAppSelector((x) => x.dating.state);
  const wide = useWindowDimensions().width >= 900;
  const scrollRef = useRef<ScrollViewInstance>(null);
  const [tab, setTab] = useState<Tab>("discover");
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<DiscoveryCard[]>(
    demo
      ? demoProfiles.filter(
          (person) =>
            !demoMatches.some((match) => match.person.userId === person.userId),
        )
      : [],
  );
  const deckRef = useRef(profiles);
  deckRef.current = profiles;
  const feedVersion = useRef(0);
  const feedCycle = useRef<{ shuffleSeed?: string; after?: string }>({});
  const demoPassed = useRef<DiscoveryCard[]>([]);
  const demoLiked = useRef(
    new Set(demoMatches.map((match) => match.person.userId)),
  );
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedMode, setFeedMode] = useState<"FRESH" | "RECYCLED">("FRESH");
  const [matches, setMatches] = useState<Match[]>(demo ? [...demoMatches] : []);
  const [incomingLikes, setIncomingLikes] = useState<IncomingLike[]>(
    demo ? [{ ...demoProfiles[2]!, likedAt: new Date().toISOString() }] : [],
  );
  const [likesTotal, setLikesTotal] = useState(demo ? 1 : 0);
  const [likesNext, setLikesNext] = useState<number | null>(null);
  const [venues, setVenues] = useState<Venue[]>(demo ? [...demoVenues] : []);
  const [city, setCity] = useState(demo ? "Bengaluru" : "Your city");
  const [plans, setPlans] = useState<DatePlan[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(
    demo ? demoMatches[0]! : null,
  );
  const selectedMatchRef = useRef(selectedMatch);
  selectedMatchRef.current = selectedMatch;
  const [kind, setKind] = useState<VenueKind | "ALL">("ALL");
  const [loading, setLoading] = useState(!demo);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [detail, setDetail] = useState<DiscoveryCard | null>(null);
  const [celebration, setCelebration] = useState<Match | null>(null);
  const [venue, setVenue] = useState<Venue | null>(null);
  const [venueSection, setVenueSection] = useState<"content" | "plan">(
    "content",
  );
  const [date, setDate] = useState(tomorrow());
  const [time, setTime] = useState("18:30");
  const [note, setNote] = useState("");
  const userId = demo ? "demo-me" : session.session?.profile.userId;
  const applyFeed = useCallback((feed: DiscoveryFeed) => {
    deckRef.current = feed.profiles;
    setProfiles(feed.profiles);
    setFeedMode(feed.feedMode);
    feedCycle.current =
      feed.shuffleSeed && feed.nextCursor
        ? { shuffleSeed: feed.shuffleSeed, after: feed.nextCursor }
        : {};
  }, []);
  const refillFeed = useCallback(async () => {
    if (demo) {
      const next = demoPassed.current.filter(
        (person) => !demoLiked.current.has(person.userId),
      );
      for (let i = next.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [next[i], next[j]] = [next[j]!, next[i]!];
      }
      deckRef.current = next;
      setProfiles(next);
      setFeedMode("RECYCLED");
      return;
    }
    const request = ++feedVersion.current;
    setFeedLoading(true);
    try {
      const feed = await discoveryApi.feed(feedCycle.current);
      if (request === feedVersion.current) applyFeed(feed);
    } catch (caught) {
      if (request === feedVersion.current) setError(getApiErrorMessage(caught));
    } finally {
      if (request === feedVersion.current) setFeedLoading(false);
    }
  }, [demo, applyFeed]);
  const load = useCallback(async () => {
    if (demo || session.status !== "authenticated") return;
    setLoading(true);
    setError(null);
    const request = ++feedVersion.current;
    try {
      const [feed, sparks, likedYou] = await Promise.all([
        discoveryApi.feed(),
        discoveryApi.matches(),
        discoveryApi.likes(),
      ]);
      if (request === feedVersion.current) {
        applyFeed(feed);
        setFeedLoading(false);
      }
      setMatches(sparks);
      setIncomingLikes(likedYou.profiles);
      setLikesTotal(likedYou.total);
      setLikesNext(likedYou.nextOffset);
      const selection =
        sparks.find((x) => x.id === selectedMatchRef.current?.id) ??
        sparks[0] ??
        null;
      setSelectedMatch(selection);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [demo, session.status, applyFeed]);
  const chat = useChat(userId, demo, () => void load());
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (demo || tab !== "dates") return;
    void discoveryApi
      .venues()
      .then((nearby) => {
        setVenues(nearby.venues);
        setCity(nearby.city ?? "Your city");
      })
      .catch((caught) => setError(getApiErrorMessage(caught)));
  }, [demo, tab]);
  useEffect(() => {
    if (demo || !selectedMatch || tab !== "dates") return;
    let active = true;
    setPlans([]);
    void discoveryApi
      .plans(selectedMatch.id)
      .then((result) => {
        if (active) setPlans(result);
      })
      .catch((e) => {
        if (active) setError(getApiErrorMessage(e));
      });
    return () => {
      active = false;
    };
  }, [demo, selectedMatch?.id, tab]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);
  const respond = async (action: "LIKE" | "PASS", target?: DiscoveryCard) => {
    const person = target ?? profiles[0];
    if (!person || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = demo
        ? {
            matched:
              action === "LIKE" &&
              incomingLikes.some((item) => item.userId === person.userId),
            matchId: `demo-${person.userId}`,
          }
        : await discoveryApi.act(person.userId, action);
      if (Platform.OS !== "web")
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
          () => undefined,
        );
      ++feedVersion.current;
      const remaining = deckRef.current.filter(
        (x) => x.userId !== person.userId,
      );
      deckRef.current = remaining;
      setProfiles(remaining);
      if (demo) {
        if (action === "LIKE") demoLiked.current.add(person.userId);
        else if (
          !demoPassed.current.some((item) => item.userId === person.userId)
        )
          demoPassed.current.push(person);
      }
      if (demo) {
        setIncomingLikes((current) =>
          current.filter((item) => item.userId !== person.userId),
        );
        if (incomingLikes.some((item) => item.userId === person.userId))
          setLikesTotal((total) => Math.max(0, total - 1));
      } else {
        void discoveryApi
          .likes()
          .then((likedYou) => {
            setIncomingLikes(likedYou.profiles);
            setLikesTotal(likedYou.total);
            setLikesNext(likedYou.nextOffset);
          })
          .catch((caught) => setError(getApiErrorMessage(caught)));
      }
      if (result.matched && result.matchId) {
        const spark = {
          id: result.matchId,
          person,
          createdAt: new Date().toISOString(),
        };
        setMatches((current) => [
          spark,
          ...current.filter((x) => x.id !== spark.id),
        ]);
        setCelebration(spark);
        setSelectedMatch(spark);
      } else if (action === "LIKE")
        setNotice("Like sent. You can chat when they like you back.");
      if (!remaining.length) await refillFeed();
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const moreLikes = async () => {
    if (likesNext === null || busy || demo) return;
    setBusy(true);
    setError(null);
    try {
      const page = await discoveryApi.likes(likesNext);
      setIncomingLikes((current) => [
        ...current,
        ...page.profiles.filter(
          (item) =>
            !current.some((existing) => existing.userId === item.userId),
        ),
      ]);
      setLikesTotal(page.total);
      setLikesNext(page.nextOffset);
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  };
  const propose = async () => {
    if (!venue || !selectedMatch) return;
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)
    ) {
      setError("Use YYYY-MM-DD and a 24-hour time, such as 18:30.");
      return;
    }
    const proposed = new Date(`${date}T${time}:00`);
    if (
      Number.isNaN(proposed.getTime()) ||
      localDate(proposed) !== date ||
      proposed.getTime() < Date.now() + 15 * 60000 ||
      proposed.getTime() > Date.now() + 180 * 86400000
    ) {
      setError(
        "Choose a valid time at least 15 minutes ahead and within 180 days.",
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (demo)
        setPlans((current) => [
          {
            id: `demo-plan-${Date.now()}`,
            matchId: selectedMatch.id,
            creatorUserId: userId!,
            proposedAt: proposed.toISOString(),
            note,
            status: "PROPOSED",
            partnerStatus: "PENDING",
            venueName: venue.name,
            city: venue.city,
            address: venue.address,
            kind: venue.kind,
            imageUrl: venue.imageUrl,
            priceForTwoInr: venue.priceForTwoInr,
          },
          ...current,
        ]);
      else {
        await discoveryApi.propose(selectedMatch.id, {
          partnerId: venue.id,
          proposedAt: proposed.toISOString(),
          note,
        });
        setPlans(await discoveryApi.plans(selectedMatch.id));
      }
      setVenue(null);
      setNote("");
      setNotice("Date idea sent. Let the butterflies begin.");
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const changePlan = async (
    plan: DatePlan,
    status: "ACCEPTED" | "DECLINED" | "CANCELLED",
  ) => {
    if (!selectedMatch) return;
    setBusy(true);
    setError(null);
    try {
      if (demo)
        setPlans((current) =>
          current.map((x) => (x.id === plan.id ? { ...x, status } : x)),
        );
      else {
        await discoveryApi.respond(selectedMatch.id, plan.id, status);
        setPlans(await discoveryApi.plans(selectedMatch.id));
      }
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  if (!demo && session.status === "anonymous") return <Redirect href="/auth" />;
  if (!demo && dating && dating.onboarding.progress?.status !== "COMPLETED")
    return <Redirect href="/" />;
  const current = profiles[0];
  const myName = demo ? "Sahil" : (dating?.profile?.displayName ?? "you");
  const myPhoto = demo ? null : dating?.photos.find((x) => x.isPrimary)?.url;
  const selectTab = (value: Tab) => {
    setTab(value);
    setError(null);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };
  const navigation = (
    <View style={[s.navigation, wide && s.navigationWide]}>
      {tabs.map((item) => (
        <Pressable
          key={item.id}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === item.id }}
          onPress={() => selectTab(item.id)}
          style={[s.navItem, tab === item.id && s.navActive]}
        >
          <Ionicons
            name={item.icon}
            size={21}
            color={tab === item.id ? colors.coral : colors.muted}
          />
          <Text
            style={[s.navLabel, tab === item.id && { color: colors.coral }]}
          >
            {item.label}
          </Text>
          {item.id === "likes" && likesTotal > 0 ? (
            <View style={s.navDot} />
          ) : null}
          {item.id === "sparks" &&
          chat.summaries.some((item) => item.unreadCount > 0) ? (
            <View style={s.navDot} />
          ) : null}
        </Pressable>
      ))}
    </View>
  );
  return (
    <SafeAreaView style={s.screen} edges={["top", "left", "right"]}>
      {demo ? (
        <View style={s.demoBanner}>
          <Text style={s.demoText}>
            INTERACTIVE PREVIEW · Sample people & venues
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace("/auth")}
          >
            <Text style={[s.demoText, { textDecorationLine: "underline" }]}>
              Join Mello →
            </Text>
          </Pressable>
        </View>
      ) : null}
      <View style={s.header}>
        <View style={s.brand}>
          <Ionicons name="heart" size={22} color={colors.coral} />
          <Text style={s.wordmark}>
            mello<Text style={{ color: colors.coral }}>.</Text>
          </Text>
        </View>
        {wide ? navigation : null}
        <View style={s.headerRight}>
          <Ionicons name="location-outline" size={15} color={colors.coral} />
          <Text style={s.city}>{city}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => selectTab("profile")}
            accessibilityLabel="Open my profile"
            style={s.avatar}
          >
            {myPhoto ? (
              <Image
                source={{ uri: absoluteMediaUrl(myPhoto) }}
                style={s.avatarImage}
              />
            ) : (
              <Text style={s.avatarText}>{myName[0]?.toUpperCase()}</Text>
            )}
          </Pressable>
        </View>
      </View>
      <PageContent
        chat={tab === "sparks"}
        scrollRef={scrollRef}
        loading={loading}
        onRefresh={() => void load()}
      >
        <View style={[s.main, tab === "sparks" && { flex: 1, minHeight: 0 }]}>
          <View
            style={[
              s.pageIntro,
              !wide && { paddingTop: 24, paddingBottom: 20 },
              tab === "sparks" && { paddingTop: 16, paddingBottom: 16 },
            ]}
          >
            <Text style={s.eyebrow}>
              {tab === "likes"
                ? "A LITTLE INTEREST. YOUR CHOICE."
                : tab === "discover"
                  ? "LESS SCROLLING. MORE FEELING."
                  : tab === "sparks"
                    ? "GOOD CONNECTIONS START HERE"
                    : tab === "dates"
                      ? "TAKE THE SPARK OFFLINE"
                      : "YOUR OWN KIND OF LOVELY"}
            </Text>
            <Text
              style={[
                s.pageTitle,
                !wide && { fontSize: 34, lineHeight: 40 },
                tab === "sparks" && {
                  fontSize: wide ? 30 : 24,
                  lineHeight: wide ? 36 : 29,
                },
              ]}
            >
              {tab === "likes" ? (
                <>
                  Someone noticed{" "}
                  <Text style={s.italic}>your kind of lovely.</Text>
                </>
              ) : tab === "discover" ? (
                <>
                  A little spark. <Text style={s.italic}>Something real.</Text>
                </>
              ) : tab === "sparks" ? (
                <>
                  A little hello.{" "}
                  <Text style={s.italic}>A real connection.</Text>
                </>
              ) : tab === "dates" ? (
                <>
                  Good company.{" "}
                  <Text style={s.italic}>Great little plans.</Text>
                </>
              ) : (
                <>
                  Lovely to see <Text style={s.italic}>{myName}.</Text>
                </>
              )}
            </Text>
            <Text style={s.pageSubtitle}>
              {tab === "likes"
                ? "See who liked you. Choose who you’d like to know."
                : tab === "discover"
                  ? "Meet someone who makes the everyday feel a little extraordinary."
                  : tab === "sparks"
                    ? "You liked each other. Start a conversation and see where it goes."
                    : tab === "dates"
                      ? "From first coffees to playful adventures, find your kind of date."
                      : "A thoughtful profile is the beginning of a beautiful connection."}
            </Text>
          </View>
          {notice ? (
            <View style={s.toast}>
              <Ionicons name="heart" color={colors.coral} size={16} />
              <Text style={s.toastText}>{notice}</Text>
            </View>
          ) : null}
          {!venue ? <ErrorNotice message={error} /> : null}
          {loading ? (
            <View style={s.empty}>
              <ActivityIndicator size="large" color={colors.coral} />
              <Text style={s.copy}>Finding a little possibility…</Text>
            </View>
          ) : null}
          {!loading && error ? (
            <PrimaryButton
              kind="ghost"
              label="Refresh and try again"
              onPress={() => void load()}
            />
          ) : null}
          {!loading && tab === "discover" ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => selectTab("dates")}
              style={s.browseVenues}
            >
              <Ionicons name="cafe-outline" size={22} color={colors.plum} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={s.browseTitle}>Browse cafés & menus</Text>
                <Text style={s.copy}>
                  Food photos, packages, plans & events nearby
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={20} color={colors.plum} />
            </Pressable>
          ) : null}
          {!loading && tab === "discover" ? (
            <View style={[s.discoveryLayout, wide && s.discoveryWide]}>
              <View style={s.feedColumn}>
                <View style={s.sectionRow}>
                  <View style={s.row}>
                    <View style={s.liveDot} />
                    <Text style={s.sectionLabel}>
                      {feedMode === "RECYCLED"
                        ? "Another chance to find a spark"
                        : "A little possibility, just for you"}
                    </Text>
                  </View>
                  <Text style={s.smallCaps}>
                    {feedMode === "RECYCLED" ? "RESHUFFLED" : "FOR YOU"}
                  </Text>
                </View>
                {current ? (
                  <PersonCard
                    person={current}
                    onDetails={() => setDetail(current)}
                    onLike={() => void respond("LIKE")}
                    onPass={() => void respond("PASS")}
                    busy={busy}
                  />
                ) : feedLoading ? (
                  <View style={s.empty}>
                    <ActivityIndicator color={colors.coral} />
                    <Text style={s.copy}>
                      Finding your next little possibility…
                    </Text>
                  </View>
                ) : (
                  <Empty
                    icon="moon-outline"
                    title="A little pause, not the end."
                    copy="No eligible profiles left to show. People you've already liked stay out of this feed."
                    action={
                      demo
                        ? "Shuffle available sample profiles"
                        : "Check for new people"
                    }
                    onPress={() => (demo ? void refillFeed() : void load())}
                  />
                )}
              </View>
              <View style={s.aside}>
                <View style={s.noteCard}>
                  <View style={s.noteIcon}>
                    <Ionicons
                      name="sparkles-outline"
                      size={24}
                      color={colors.coral}
                    />
                  </View>
                  <Text style={s.noteKicker}>A LITTLE MELLO REMINDER</Text>
                  <Text style={s.noteTitle}>
                    You don’t need a perfect line.
                    <Text style={s.italic}> Just a real one.</Text>
                  </Text>
                  <Text style={s.copy}>
                    Lead with curiosity. Notice the little things. The best
                    connections feel like being yourself.
                  </Text>
                  <View style={s.noteDivider} />
                  <Text style={s.scoreNote}>
                    Compatibility percentages are a visual preview. Your real
                    connection is yours to discover.
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => selectTab("sparks")}
                  style={s.dateTeaser}
                >
                  <View>
                    <Text style={s.noteKicker}>IT STARTS WITH HELLO</Text>
                    <Text style={s.teaserTitle}>
                      Your next favourite conversation.
                    </Text>
                    <Text style={s.teaserCopy}>Open your conversations →</Text>
                  </View>
                  <Ionicons
                    name="chatbubbles-outline"
                    size={35}
                    color={colors.coral}
                  />
                </Pressable>
                <View style={s.footnote}>
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={15}
                    color={colors.muted}
                  />
                  <Text style={s.footnoteText}>
                    Go at your pace. Meet in a public place.
                  </Text>
                </View>
              </View>
            </View>
          ) : null}
          {!loading && tab === "likes" ? (
            <LikesInbox
              people={incomingLikes}
              total={likesTotal}
              busy={busy}
              more={likesNext !== null}
              onMore={() => void moreLikes()}
              onRespond={(person, action) => void respond(action, person)}
              onDetails={setDetail}
              onDiscover={() => selectTab("discover")}
            />
          ) : null}
          {!loading && tab === "sparks" ? (
            matches.length ? (
              <ChatInbox
                matches={matches}
                userId={userId ?? ""}
                activeId={activeChatId}
                demo={demo}
                chat={chat}
                onSelect={(match) => {
                  setActiveChatId(match?.id ?? null);
                  if (match) setSelectedMatch(match);
                }}
                onPlan={(match) => {
                  setSelectedMatch(match);
                  selectTab("dates");
                }}
              />
            ) : (
              <Empty
                icon="chatbubbles-outline"
                title="Your next hello is out there."
                copy="Discover people and send a spark. When you both like each other, your conversation starts here."
                action="Discover people"
                onPress={() => selectTab("discover")}
              />
            )
          ) : null}
          {!loading && tab === "dates" ? (
            <>
              <PrimaryButton
                label={
                  selectedMatch ? "Back to conversation" : "Back to Discover"
                }
                kind="ghost"
                onPress={() => {
                  setActiveChatId(selectedMatch?.id ?? null);
                  selectTab(selectedMatch ? "sparks" : "discover");
                }}
              />
              {matches.length ? (
                <View style={s.planningFor}>
                  <Text style={s.sectionLabel}>A little plan with</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {matches.map((match) => (
                      <Pressable
                        accessibilityRole="button"
                        key={match.id}
                        onPress={() => {
                          setSelectedMatch(match);
                          setError(null);
                        }}
                        style={[
                          s.matchChip,
                          selectedMatch?.id === match.id && s.matchChipActive,
                        ]}
                      >
                        <Text
                          style={[
                            s.matchChipText,
                            selectedMatch?.id === match.id && {
                              color: colors.coral,
                            },
                          ]}
                        >
                          {match.person.profile.displayName} ♥
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              ) : (
                <View style={s.softNotice}>
                  <Ionicons
                    name="heart-outline"
                    size={20}
                    color={colors.coral}
                  />
                  <Text style={s.softNoticeText}>
                    Browse for inspiration. Once you match, you can invite your
                    person.
                  </Text>
                </View>
              )}
              {selectedMatch &&
              plans.some((x) => x.matchId === selectedMatch.id) ? (
                <View style={s.plansSection}>
                  <Text style={s.sectionHeading}>Your little plans</Text>
                  {plans
                    .filter((x) => x.matchId === selectedMatch.id)
                    .map((plan) => (
                      <View key={plan.id} style={s.planCard}>
                        <View style={s.sectionRow}>
                          <Text style={s.planTitle}>{plan.venueName}</Text>
                          <Text style={s.planStatus}>
                            {plan.status === "ACCEPTED"
                              ? plan.partnerStatus === "CONFIRMED"
                                ? "♥ Venue confirmed"
                                : plan.partnerStatus === "DECLINED"
                                  ? "Venue unavailable"
                                  : "Awaiting venue"
                              : plan.status === "PROPOSED"
                                ? "Invitation sent"
                                : plan.status.toLowerCase()}
                          </Text>
                        </View>
                        <Text style={s.copy}>
                          {new Date(plan.proposedAt).toLocaleString([], {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}{" "}
                          · {plan.city}
                        </Text>
                        {plan.note ? (
                          <Text style={s.planNote}>“{plan.note}”</Text>
                        ) : null}
                        {plan.status === "PROPOSED" &&
                        plan.creatorUserId !== userId ? (
                          <View style={s.inlineActions}>
                            <PrimaryButton
                              label="I’d love to"
                              loading={busy}
                              onPress={() => void changePlan(plan, "ACCEPTED")}
                            />
                            <PrimaryButton
                              label="Maybe another time"
                              kind="ghost"
                              disabled={busy}
                              onPress={() => void changePlan(plan, "DECLINED")}
                            />
                          </View>
                        ) : null}
                        {plan.status === "PROPOSED" ||
                        plan.status === "ACCEPTED" ? (
                          <PrimaryButton
                            label="Cancel this plan"
                            kind="ghost"
                            disabled={busy}
                            onPress={() => void changePlan(plan, "CANCELLED")}
                          />
                        ) : null}
                      </View>
                    ))}
                </View>
              ) : null}
              <View style={s.sectionRow}>
                <Text style={s.sectionHeading}>Lovely spots in {city}</Text>
                <Text style={s.smallCaps}>CURATED FOR TWO</Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.filterRow}
              >
                {(["ALL", "CAFE", "RESTAURANT", "ACTIVITY"] as const).map(
                  (value) => (
                    <Pressable
                      accessibilityRole="button"
                      key={value}
                      onPress={() => setKind(value)}
                      style={[s.filter, kind === value && s.filterActive]}
                    >
                      <Text
                        style={[
                          s.filterText,
                          kind === value && { color: "white" },
                        ]}
                      >
                        {
                          {
                            ALL: "All little plans",
                            CAFE: "☕ Coffee dates",
                            RESTAURANT: "Dinner for two",
                            ACTIVITY: "✦ Fun together",
                          }[value]
                        }
                      </Text>
                    </Pressable>
                  ),
                )}
              </ScrollView>
              <View style={s.venueGrid}>
                {venues
                  .filter((x) => kind === "ALL" || x.kind === kind)
                  .map((item) => (
                    <Pressable
                      accessibilityRole="button"
                      key={item.id}
                      onPress={() => {
                        setVenue(item);
                        setVenueSection("content");
                        setError(null);
                      }}
                      style={[s.venueCard, wide && { width: "31.8%" }]}
                    >
                      <ProfilePhoto url={item.imageUrl} style={s.venuePhoto}>
                        <View style={s.venueKind}>
                          <Text style={s.venueKindText}>
                            {kindLabel(item.kind)}
                          </Text>
                        </View>
                      </ProfilePhoto>
                      <View style={s.venueBody}>
                        <View style={s.sectionRow}>
                          <Text style={s.venueName}>{item.name}</Text>
                          <Ionicons
                            name="arrow-up-outline"
                            size={18}
                            color={colors.coral}
                          />
                        </View>
                        <Text style={s.venueHeadline}>{item.headline}</Text>
                        <Text style={s.venueMeta}>
                          {item.city}
                          {item.distanceKm !== null
                            ? ` · ~${item.distanceKm} km from city centre`
                            : ""}
                        </Text>
                        <View style={s.venueBottom}>
                          <Text style={s.venuePrice}>
                            {money(item.priceForTwoInr)}
                          </Text>
                          <Text style={s.venueMeta}>
                            {item.durationMinutes} min
                          </Text>
                        </View>
                      </View>
                    </Pressable>
                  ))}
              </View>
              {!venues.some((x) => kind === "ALL" || x.kind === kind) ? (
                <Empty
                  icon="cafe-outline"
                  title="Lovely places are on their way."
                  copy="We’re inviting cafés, restaurants and activity spaces in your city. Published partner listings will appear here."
                />
              ) : null}
              <Text style={s.cardHint}>
                Distances are approximate, measured from your selected city’s
                centre. Invitations become reservations only after venue
                confirmation.
              </Text>
            </>
          ) : null}
          {!loading && tab === "profile" ? (
            <View style={s.profilePanel}>
              <View style={s.profileMonogram}>
                {myPhoto ? (
                  <Image
                    source={{ uri: absoluteMediaUrl(myPhoto) }}
                    style={s.profilePortrait}
                  />
                ) : (
                  <Ionicons
                    name="flower-outline"
                    size={50}
                    color={colors.coral}
                  />
                )}
              </View>
              <Text style={s.profileName}>{myName}</Text>
              <Text style={s.copy}>
                A little more you. A little more possibility.
              </Text>
              {demo ? (
                <PrimaryButton
                  label="Create your real profile"
                  onPress={() => router.replace("/auth")}
                />
              ) : (
                <>
                  <PrimaryButton
                    label="View my public profile"
                    onPress={() => router.push("/onboarding/preview")}
                  />
                  <PrimaryButton
                    label="Edit my profile & preferences"
                    kind="secondary"
                    onPress={() => router.push("/onboarding/basic-profile")}
                  />
                  <PrimaryButton
                    label="Sign out"
                    kind="ghost"
                    loading={busy}
                    onPress={() => {
                      setBusy(true);
                      void dispatch(signOut())
                        .unwrap()
                        .then(() => {
                          dispatch(clearDatingData());
                          router.replace("/auth");
                        })
                        .catch((e) => {
                          setError(getApiErrorMessage(e));
                          setBusy(false);
                        });
                    }}
                  />
                </>
              )}
              <View style={s.softNotice}>
                <Text style={s.softNoticeText}>
                  Only the details you choose to share appear on your public
                  profile. Your birthday and private preferences stay private.
                </Text>
              </View>
            </View>
          ) : null}
        </View>
      </PageContent>
      {!wide ? navigation : null}
      <Modal
        visible={!!detail}
        animationType="slide"
        transparent
        onRequestClose={() => setDetail(null)}
      >
        <View style={s.modalBackdrop}>
          <View style={s.sheet}>
            <ScrollView contentContainerStyle={s.sheetContent}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setDetail(null)}
                accessibilityLabel="Close profile"
                style={s.close}
              >
                <Ionicons name="close" size={23} color={colors.ink} />
              </Pressable>
              {detail ? (
                <>
                  <Text style={s.eyebrow}>A LITTLE MORE ABOUT</Text>
                  <Text style={s.sheetTitle}>
                    {detail.profile.displayName}, {detail.profile.age}
                  </Text>
                  <View style={s.scoreBox}>
                    <Ionicons name="sparkles" size={24} color={colors.coral} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.scoreTitle}>
                        {detail.compatibility.percentage}% demo compatibility
                      </Text>
                      <Text style={s.copy}>
                        A preview of how compatibility will look. This score is
                        illustrative; our matching algorithm is still to come.
                      </Text>
                    </View>
                  </View>
                  <Text style={s.bio}>
                    {detail.profile.bio || "A little mystery, for now."}
                  </Text>
                  <View style={s.tags}>
                    {detail.interests.map((x) => (
                      <View key={x.id} style={s.lightTag}>
                        <Text style={s.matchChipText}>{x.name}</Text>
                      </View>
                    ))}
                  </View>
                  {detail.profileOptions.map((x) => (
                    <View
                      key={`${x.categoryCode}-${x.optionCode}`}
                      style={s.profileField}
                    >
                      <Text style={s.smallCaps}>{x.categoryName}</Text>
                      <Text style={s.bio}>{x.label}</Text>
                    </View>
                  ))}
                  {detail.prompts.map((x) => (
                    <View key={x.promptId} style={s.prompt}>
                      <Text style={s.noteKicker}>{x.promptText}</Text>
                      <Text style={s.promptAnswer}>{x.answerText}</Text>
                    </View>
                  ))}
                </>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
      <Modal
        visible={!!celebration}
        animationType="fade"
        transparent
        onRequestClose={() => setCelebration(null)}
      >
        <View style={s.celebrationBackdrop}>
          <View style={s.celebrationCard}>
            <View style={s.celebrationHearts}>
              <Ionicons name="heart" size={76} color={colors.coral} />
              <Text style={s.floatingSpark}>✦</Text>
            </View>
            <Text style={s.eyebrow}>A LITTLE MUTUAL MAGIC</Text>
            <Text style={s.celebrationTitle}>
              The feeling’s <Text style={s.italic}>mutual.</Text>
            </Text>
            <Text style={s.celebrationCopy}>
              You and {celebration?.person.profile.displayName} sent each other
              a spark. This could be the start of something lovely.
            </Text>
            <PrimaryButton
              label="Say hello"
              onPress={() => {
                setActiveChatId(celebration?.id ?? null);
                setCelebration(null);
                selectTab("sparks");
              }}
            />
            <PrimaryButton
              kind="ghost"
              label="Keep discovering"
              onPress={() => setCelebration(null)}
            />
          </View>
        </View>
      </Modal>
      <Modal
        visible={!!venue}
        animationType="slide"
        transparent
        onRequestClose={() => {
          if (!busy) setVenue(null);
        }}
      >
        <View style={s.modalBackdrop}>
          <View style={s.sheet}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={s.sheetContent}
            >
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={() => setVenue(null)}
                accessibilityLabel="Close venue"
                style={s.close}
              >
                <Ionicons name="close" size={23} color={colors.ink} />
              </Pressable>
              {venue ? (
                <>
                  <Text style={s.eyebrow}>{kindLabel(venue.kind)}</Text>
                  <Text style={s.sheetTitle}>{venue.name}</Text>
                  {venue.imageUrl ? (
                    <Image
                      source={{ uri: venue.imageUrl }}
                      style={s.sheetPhoto}
                    />
                  ) : null}
                  <Text style={s.bio}>
                    {venue.description || venue.headline}
                  </Text>
                  <Text style={s.copy}>
                    {venue.address}, {venue.city} ·{" "}
                    {money(venue.priceForTwoInr)}
                  </Text>
                  <View style={s.tags}>
                    {venue.tags.map((tag) => (
                      <View style={s.lightTag} key={tag}>
                        <Text style={s.matchChipText}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={s.sheetDivider} />
                  <View style={s.venueTabs}>
                    {(["content", "plan"] as const).map((section) => (
                      <Pressable
                        key={section}
                        accessibilityRole="button"
                        accessibilityState={{
                          selected: venueSection === section,
                        }}
                        onPress={() => setVenueSection(section)}
                        style={[
                          s.venueTab,
                          venueSection === section && s.venueTabActive,
                        ]}
                      >
                        <Text style={s.browseTitle}>
                          {section === "content"
                            ? "Menu & experiences"
                            : "Plan a date"}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  {venueSection === "content" ? (
                    <VenueContent partnerId={venue.id} demo={demo} />
                  ) : null}
                  {venueSection === "plan" ? (
                    selectedMatch ? (
                      <>
                        <Text style={s.copy}>
                          Invite {selectedMatch.person.profile.displayName}.
                          Choose a date and time in your local time zone.
                        </Text>
                        <Field
                          label="Date · YYYY-MM-DD"
                          value={date}
                          onChangeText={setDate}
                          placeholder="2026-10-28"
                          maxLength={10}
                        />
                        <Field
                          label="Time · 24-hour, HH:mm"
                          value={time}
                          onChangeText={setTime}
                          placeholder="18:30"
                          maxLength={5}
                        />
                        <Field
                          label="A little note (optional)"
                          value={note}
                          onChangeText={setNote}
                          placeholder="Coffee and a walk afterwards?"
                          multiline
                          maxLength={500}
                        />
                        <ErrorNotice message={error} />
                        <PrimaryButton
                          label={`Invite ${selectedMatch.person.profile.displayName}`}
                          loading={busy}
                          onPress={() => void propose()}
                        />
                        <Text style={s.cardHint}>
                          First, your person accepts. Then the venue confirms
                          availability. No payment is collected here.
                        </Text>
                      </>
                    ) : (
                      <>
                        <Text style={s.copy}>
                          A date starts with a connection. Match with someone to
                          send an invitation.
                        </Text>
                        <PrimaryButton
                          label="Find your spark"
                          onPress={() => {
                            setVenue(null);
                            selectTab("discover");
                          }}
                        />
                      </>
                    )
                  ) : null}
                </>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  header: {
    minHeight: 83,
    paddingHorizontal: 25,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: "#FFFCFA",
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 8 },
  wordmark: {
    fontSize: 36,
    letterSpacing: -2,
    color: colors.ink,
    fontWeight: "800",
  },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 5 },
  city: {
    fontSize: 12,
    color: colors.inkSoft,
    fontWeight: "600",
    maxWidth: 130,
  },
  avatar: {
    width: 38,
    height: 38,
    backgroundColor: colors.coralSoft,
    borderRadius: 20,
    marginLeft: 10,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "white",
  },
  avatarImage: { width: 38, height: 38 },
  avatarText: { color: colors.coral, fontWeight: "800" },
  content: { paddingHorizontal: 22, paddingBottom: 45 },
  main: { maxWidth: 1100, width: "100%", alignSelf: "center" },
  pageIntro: { paddingTop: 34, paddingBottom: 28 },
  browseVenues: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 17,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 20,
    backgroundColor: "#FFFCFA",
    marginBottom: 24,
  },
  browseTitle: { fontSize: 13, color: colors.plum, fontWeight: "700" },
  venueTabs: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  venueTab: {
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.line,
  },
  venueTabActive: {
    backgroundColor: colors.coralSoft,
    borderColor: colors.rose,
  },
  eyebrow: {
    color: colors.coral,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2,
    marginBottom: 12,
  },
  pageTitle: {
    fontFamily: serif,
    fontSize: 37,
    lineHeight: 46,
    letterSpacing: -1.5,
    color: colors.ink,
  },
  italic: { fontStyle: "italic", color: colors.coral },
  pageSubtitle: {
    fontSize: 13,
    lineHeight: 21,
    color: colors.muted,
    marginTop: 10,
    maxWidth: 600,
  },
  navigation: {
    flexDirection: "row",
    paddingTop: 9,
    paddingBottom: Platform.OS === "ios" ? 25 : 12,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: "#FFFCFA",
    justifyContent: "space-around",
  },
  navigationWide: {
    borderTopWidth: 0,
    paddingBottom: 6,
    paddingTop: 6,
    gap: 8,
  },
  navItem: {
    alignItems: "center",
    paddingVertical: 9,
    paddingHorizontal: 13,
    borderRadius: 20,
    gap: 5,
  },
  navActive: { backgroundColor: colors.coralSoft },
  navLabel: { fontSize: 10, fontWeight: "700", color: colors.muted },
  navDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.coral,
    position: "absolute",
    right: 14,
    top: 8,
  },
  discoveryLayout: { gap: 26 },
  discoveryWide: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "center",
  },
  feedColumn: { flex: 1, maxWidth: 510, width: "100%", alignSelf: "center" },
  aside: {
    flex: 1,
    maxWidth: 400,
    width: "100%",
    gap: 18,
    alignSelf: "center",
  },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  liveDot: {
    width: 6,
    height: 6,
    backgroundColor: colors.coral,
    borderRadius: 4,
  },
  sectionLabel: { fontSize: 12, color: colors.inkSoft, fontWeight: "600" },
  smallCaps: {
    fontSize: 8,
    letterSpacing: 1.2,
    fontWeight: "800",
    color: colors.muted,
  },
  cardWrap: { marginTop: 16 },
  personCard: {
    borderRadius: 28,
    backgroundColor: colors.plum,
    overflow: "hidden",
    shadowColor: "#633747",
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  personImage: { width: "100%", height: 470, justifyContent: "space-between" },
  noPhoto: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.plum,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    padding: 18,
  },
  intentPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 20,
    backgroundColor: "#FFFFFF28",
    borderWidth: 1,
    borderColor: "#FFFFFF40",
    paddingHorizontal: 10,
    paddingVertical: 8,
    maxWidth: "65%",
  },
  intentText: { color: "white", fontSize: 9, fontWeight: "600" },
  compatibility: {
    width: 78,
    height: 78,
    borderRadius: 40,
    backgroundColor: "#FFF9F6F5",
    alignItems: "center",
    justifyContent: "center",
    borderColor: "#F2BECA",
    borderWidth: 3,
  },
  percent: {
    color: colors.coral,
    fontSize: 27,
    fontWeight: "800",
    letterSpacing: -1,
  },
  percentLabel: {
    color: colors.plum,
    fontSize: 6.5,
    fontWeight: "800",
    letterSpacing: 0.7,
    marginTop: 2,
  },
  personInfo: { padding: 23, gap: 10 },
  personName: {
    color: "white",
    fontSize: 34,
    fontWeight: "700",
    flex: 1,
    letterSpacing: -0.9,
  },
  infoButton: {
    width: 35,
    height: 35,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#FFFFFF75",
    alignItems: "center",
    justifyContent: "center",
  },
  personLocation: { color: "#FFF3F2", fontSize: 11, lineHeight: 18 },
  tags: { flexDirection: "row", gap: 7, flexWrap: "wrap", marginTop: 4 },
  glassTag: {
    borderRadius: 15,
    backgroundColor: "#FFFFFF25",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "#FFFFFF40",
  },
  glassTagText: { fontSize: 10, color: "white" },
  photoControls: {
    position: "absolute",
    top: 110,
    left: 20,
    right: 20,
    flexDirection: "row",
    gap: 6,
  },
  photoDot: {
    flex: 1,
    height: 12,
    backgroundColor: "#FFFFFF40",
    borderRadius: 10,
  },
  photoDotActive: { backgroundColor: "white" },
  cardActions: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 14,
    marginTop: 20,
    alignItems: "center",
  },
  passButton: {
    height: 57,
    width: 65,
    borderRadius: 30,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  likeButton: {
    borderRadius: 30,
    overflow: "hidden",
    flex: 1,
    maxWidth: 300,
    shadowColor: colors.coral,
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 3,
  },
  likeGradient: {
    minHeight: 57,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  likeText: { color: "white", fontWeight: "700", fontSize: 13 },
  cardHint: {
    color: colors.muted,
    textAlign: "center",
    fontSize: 10,
    lineHeight: 17,
    marginTop: 15,
  },
  noteCard: {
    padding: 30,
    backgroundColor: "#F7EDEB",
    borderRadius: 25,
    gap: 15,
    borderWidth: 1,
    borderColor: "#F0E1E0",
  },
  noteIcon: {
    width: 50,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF8F5",
    borderRadius: 18,
    marginBottom: 6,
  },
  noteKicker: {
    color: colors.coral,
    fontSize: 9,
    letterSpacing: 1.5,
    fontWeight: "700",
  },
  noteTitle: {
    fontFamily: serif,
    fontSize: 30,
    color: colors.ink,
    lineHeight: 38,
  },
  copy: { color: colors.muted, fontSize: 13, lineHeight: 21 },
  noteDivider: { height: 1, backgroundColor: "#E9D6D8", marginVertical: 5 },
  scoreNote: { color: colors.muted, fontSize: 10, lineHeight: 17 },
  dateTeaser: {
    padding: 24,
    backgroundColor: "#F0F1E8",
    borderRadius: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  teaserTitle: {
    color: colors.ink,
    fontFamily: serif,
    fontSize: 21,
    marginTop: 9,
  },
  teaserCopy: { color: colors.muted, fontSize: 11, marginTop: 9 },
  footnote: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  footnoteText: { fontSize: 10, color: colors.muted },
  pressed: { transform: [{ scale: 0.96 }], opacity: 0.85 },
  swipeStamp: {
    position: "absolute",
    left: 25,
    top: 150,
    padding: 12,
    borderWidth: 3,
    borderColor: "#FAD0D8",
    borderRadius: 10,
    transform: [{ rotate: "-15deg" }],
  },
  swipeText: { color: "#FFF1F4", fontWeight: "900", fontSize: 28 },
  empty: {
    paddingVertical: 50,
    paddingHorizontal: 25,
    alignItems: "center",
    gap: 18,
    maxWidth: 480,
    alignSelf: "center",
  },
  emptyIcon: {
    backgroundColor: colors.coralSoft,
    padding: 22,
    borderRadius: 40,
  },
  emptyTitle: {
    fontFamily: serif,
    fontSize: 28,
    color: colors.ink,
    textAlign: "center",
  },
  matchGrid: { flexDirection: "row", flexWrap: "wrap", gap: 20 },
  matchCard: {
    width: "100%",
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: colors.line,
  },
  matchPhoto: { height: 310, justifyContent: "flex-end" },
  matchCaption: { padding: 22 },
  matchName: { color: "white", fontSize: 26, fontWeight: "700" },
  matchCopy: { fontSize: 11, color: "#FDE8ED", marginTop: 8 },
  sparkBadge: {
    position: "absolute",
    top: 15,
    right: 15,
    padding: 10,
    backgroundColor: "#FFF9F6",
    borderRadius: 30,
  },
  matchFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 18,
  },
  matchCta: { fontSize: 12, fontWeight: "700", color: colors.coral },
  planningFor: { gap: 14, marginBottom: 24 },
  matchChip: {
    paddingHorizontal: 17,
    paddingVertical: 12,
    borderRadius: 25,
    borderColor: colors.line,
    borderWidth: 1,
    backgroundColor: "white",
    marginRight: 9,
  },
  matchChipActive: {
    backgroundColor: colors.coralSoft,
    borderColor: colors.rose,
  },
  matchChipText: { fontSize: 12, color: colors.inkSoft },
  softNotice: {
    backgroundColor: colors.coralSoft,
    borderRadius: 18,
    padding: 18,
    flexDirection: "row",
    gap: 10,
    marginBottom: 25,
  },
  softNoticeText: { fontSize: 12, lineHeight: 20, color: colors.plum, flex: 1 },
  filterRow: { gap: 8, paddingVertical: 20 },
  filter: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 12,
    paddingHorizontal: 17,
    backgroundColor: "white",
  },
  filterActive: { backgroundColor: colors.plum, borderColor: colors.plum },
  filterText: { fontSize: 11, fontWeight: "600", color: colors.inkSoft },
  sectionHeading: {
    fontSize: 24,
    fontFamily: serif,
    color: colors.ink,
    flexShrink: 1,
  },
  venueGrid: { flexDirection: "row", flexWrap: "wrap", gap: 20 },
  venueCard: {
    width: "100%",
    backgroundColor: "white",
    borderRadius: 23,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.line,
  },
  venuePhoto: {
    height: 210,
    backgroundColor: "#F0E1E0",
    padding: 15,
    justifyContent: "flex-end",
  },
  venueKind: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#FFFCF8F5",
  },
  venueKindText: { color: colors.plum, fontSize: 10, fontWeight: "700" },
  venueBody: { padding: 20, gap: 9 },
  venueName: {
    fontSize: 21,
    fontFamily: serif,
    color: colors.ink,
    flexShrink: 1,
  },
  venueHeadline: { fontSize: 12, lineHeight: 19, color: colors.inkSoft },
  venueMeta: { fontSize: 10, color: colors.muted, lineHeight: 16 },
  venuePrice: { fontSize: 11, color: colors.plum, fontWeight: "700" },
  venueBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 14,
    marginTop: 3,
  },
  plansSection: { gap: 14, marginBottom: 30 },
  planCard: {
    padding: 20,
    backgroundColor: "white",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 10,
  },
  planTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.ink,
    flexShrink: 1,
  },
  planStatus: {
    fontSize: 10,
    color: colors.coral,
    fontWeight: "700",
    maxWidth: 130,
  },
  planNote: {
    fontFamily: serif,
    fontStyle: "italic",
    color: colors.plum,
    fontSize: 17,
  },
  inlineActions: { gap: 10, marginTop: 8 },
  profilePanel: {
    padding: 25,
    maxWidth: 500,
    width: "100%",
    alignSelf: "center",
    gap: 18,
    backgroundColor: "white",
    borderRadius: 26,
  },
  profileMonogram: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: colors.coralSoft,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    overflow: "hidden",
  },
  profilePortrait: { width: 110, height: 110 },
  profileName: {
    fontFamily: serif,
    fontSize: 34,
    color: colors.ink,
    textAlign: "center",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "#21171D99",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  sheet: {
    width: "100%",
    maxWidth: 560,
    maxHeight: "92%",
    backgroundColor: colors.cream,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: "hidden",
  },
  sheetContent: { padding: 26, paddingBottom: 42, gap: 18 },
  close: {
    alignSelf: "flex-end",
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetTitle: { fontFamily: serif, fontSize: 35, color: colors.ink },
  sheetPhoto: { width: "100%", height: 220, borderRadius: 20 },
  sheetDivider: { height: 1, backgroundColor: colors.line, marginVertical: 8 },
  scoreBox: {
    backgroundColor: colors.coralSoft,
    borderRadius: 20,
    padding: 20,
    flexDirection: "row",
    gap: 15,
  },
  scoreTitle: {
    color: colors.coral,
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 8,
  },
  bio: { color: colors.inkSoft, fontSize: 16, lineHeight: 26 },
  lightTag: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.coralSoft,
  },
  profileField: {
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingVertical: 12,
  },
  prompt: {
    backgroundColor: "#F4EEEA",
    padding: 23,
    borderRadius: 20,
    gap: 12,
  },
  promptAnswer: {
    fontFamily: serif,
    color: colors.plum,
    fontSize: 24,
    lineHeight: 32,
  },
  celebrationBackdrop: {
    flex: 1,
    backgroundColor: "#351F30DD",
    alignItems: "center",
    justifyContent: "center",
    padding: 25,
  },
  celebrationCard: {
    backgroundColor: colors.cream,
    borderRadius: 34,
    padding: 32,
    gap: 20,
    width: "100%",
    maxWidth: 450,
  },
  celebrationHearts: { alignSelf: "center", paddingVertical: 15 },
  floatingSpark: {
    position: "absolute",
    color: colors.coral,
    fontSize: 30,
    top: 0,
    right: -20,
  },
  celebrationTitle: {
    fontFamily: serif,
    fontSize: 45,
    textAlign: "center",
    color: colors.ink,
  },
  celebrationCopy: {
    textAlign: "center",
    fontSize: 14,
    lineHeight: 23,
    color: colors.muted,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: colors.coralSoft,
    borderRadius: 16,
    gap: 10,
    marginBottom: 18,
  },
  toastText: { color: colors.plum, fontSize: 12, flex: 1 },
  demoBanner: {
    backgroundColor: colors.plum,
    paddingHorizontal: 20,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 7,
  },
  demoText: { color: "#FFECF1", fontSize: 9, letterSpacing: 0.4 },
});
