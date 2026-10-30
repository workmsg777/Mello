import type { ProfilePreview } from "./dating";
export interface DiscoveryCard extends ProfilePreview {
  userId: string;
  compatibility: { percentage: number; isDemo: boolean; label: string };
}
export interface Match {
  id: string;
  createdAt: string;
  person: DiscoveryCard;
}
export interface IncomingLike extends DiscoveryCard {
  likedAt: string;
}
export interface DiscoveryFeed {
  profiles: DiscoveryCard[];
  nextOffset: number | null;
  feedMode: "FRESH" | "RECYCLED";
  shuffleSeed: string | null;
  nextCursor: string | null;
}
export type VenueKind = "CAFE" | "RESTAURANT" | "ACTIVITY";
export interface Venue {
  id: string;
  name: string;
  description: string | null;
  city: string;
  state: string;
  address: string;
  kind: VenueKind;
  headline: string;
  imageUrl: string | null;
  priceForTwoInr: number | null;
  durationMinutes: number;
  tags: string[];
  distanceKm: number | null;
}
export type VenueOfferingKind = "MENU" | "PLAN" | "PACKAGE" | "EVENT";
export interface VenueOffering {
  id: string;
  kind: VenueOfferingKind;
  title: string;
  description: string;
  priceInr: number | null;
  startsAt: string | null;
  endsAt: string | null;
  photos: { id: string; url: string }[];
}
export interface DatePlan {
  id: string;
  matchId: string;
  creatorUserId: string;
  proposedAt: string;
  note: string;
  status: "PROPOSED" | "ACCEPTED" | "DECLINED" | "CANCELLED";
  partnerStatus: "PENDING" | "CONFIRMED" | "DECLINED";
  venueName: string;
  city: string;
  address: string;
  kind: VenueKind;
  imageUrl: string | null;
  priceForTwoInr: number | null;
}
