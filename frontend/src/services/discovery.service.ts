import { api } from "../config/api";
import type {
  DatePlan,
  DiscoveryCard,
  Match,
  IncomingLike,
  DiscoveryFeed,
  Venue,
  VenueKind,
  VenueOffering,
} from "../types/discovery";
export type ReportReason =
  "SPAM" | "IMPERSONATION" | "HARASSMENT" | "OTHER_SAFETY";
export const discoveryApi = {
  async feed(
    cycle: {
      shuffleSeed?: string;
      after?: string;
      feedSessionId?: string;
      cursor?: number;
    } = {},
  ): Promise<DiscoveryFeed> {
    try {
      const feed = (
        await api.get<DiscoveryFeed>("/discovery/feed", { params: cycle })
      ).data;
      return cycle.feedSessionId && !feed.profiles.length ? this.feed() : feed;
    } catch (error) {
      if (
        cycle.feedSessionId &&
        (error as { response?: { status?: number } }).response?.status === 404
      )
        return this.feed();
      throw error;
    }
  },
  async impression(feedSessionId: string, targetId: string) {
    await api.post("/discovery/impressions", {
      feedSessionId,
      targetIds: [targetId],
    });
  },
  async act(targetId: string, action: "LIKE" | "PASS") {
    return (
      await api.post<{ matched: boolean; matchId: string | null }>(
        "/discovery/actions",
        { targetId, action },
      )
    ).data;
  },
  async exclude(targetId: string, reportReason?: ReportReason) {
    await api.put(`/discovery/exclusions/${targetId}`, { reportReason });
  },
  async feedback(matchId: string, worthwhile: boolean) {
    await api.put(`/discovery/matches/${matchId}/feedback`, { worthwhile });
  },
  async matches() {
    return (await api.get<Match[]>("/discovery/matches")).data;
  },
  async likes(offset = 0) {
    return (
      await api.get<{
        profiles: IncomingLike[];
        total: number;
        nextOffset: number | null;
      }>("/discovery/likes", { params: { offset } })
    ).data;
  },
  async venues(kind?: VenueKind) {
    return (
      await api.get<{ city: string | null; venues: Venue[] }>(
        "/discovery/venues",
        { params: { kind } },
      )
    ).data;
  },
  async plans(matchId: string) {
    return (await api.get<DatePlan[]>(`/discovery/matches/${matchId}/plans`))
      .data;
  },
  async venueContent(partnerId: string) {
    return (
      await api.get<VenueOffering[]>(`/discovery/venues/${partnerId}/content`)
    ).data;
  },
  async propose(
    matchId: string,
    input: { partnerId: string; proposedAt: string; note: string },
  ) {
    return (await api.post(`/discovery/matches/${matchId}/plans`, input)).data;
  },
  async respond(
    matchId: string,
    planId: string,
    status: "ACCEPTED" | "DECLINED" | "CANCELLED",
  ) {
    await api.patch(`/discovery/matches/${matchId}/plans/${planId}`, {
      status,
    });
  },
};
