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
export const discoveryApi = {
  async feed(cycle: { shuffleSeed?: string; after?: string } = {}) {
    return (await api.get<DiscoveryFeed>("/discovery/feed", { params: cycle }))
      .data;
  },
  async act(targetId: string, action: "LIKE" | "PASS") {
    return (
      await api.post<{ matched: boolean; matchId: string | null }>(
        "/discovery/actions",
        { targetId, action },
      )
    ).data;
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
