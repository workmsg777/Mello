import type { DiscoveryCard, Match, Venue } from "../../types/discovery";
export const demoProfiles: DiscoveryCard[] = [
  {
    userId: "demo-anya",
    profile: {
      displayName: "Anya",
      age: 25,
      bio: "Collecting little moments, big sunsets, and a very serious list of the best tiramisu in town. Tell me your favourite hidden spot?",
      jobTitle: "Architect & weekend wanderer",
      currentCity: {
        id: "blr",
        name: "Bengaluru",
        stateName: "Karnataka",
        countryCode: "IN",
      },
    },
    photos: [
      {
        id: "a",
        url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1000&auto=format&fit=crop&q=85",
        displayOrder: 0,
        isPrimary: true,
      },
    ],
    profileOptions: [
      {
        categoryCode: "DATING_INTENTION",
        categoryName: "Looking for",
        optionCode: "LONG_TERM",
        label: "A meaningful connection",
      },
    ],
    interests: [
      { id: "1", code: "COFFEE", name: "Coffee dates" },
      { id: "2", code: "TRAVEL", name: "Little adventures" },
      { id: "3", code: "ART", name: "Art & design" },
    ],
    languages: [],
    prompts: [
      {
        promptId: "p",
        promptText: "The way to win me over",
        answerText: "Remember my coffee order. And be kind to the waiter.",
        mediaId: null,
        displayOrder: 0,
      },
    ],
    compatibility: {
      percentage: 94,
      isDemo: true,
      label: "Demo compatibility",
    },
  },
  {
    userId: "demo-rohan",
    profile: {
      displayName: "Rohan",
      age: 27,
      bio: "A good playlist, a long walk, and nowhere in particular to be. I make a pretty great Sunday breakfast, too.",
      jobTitle: "Designer & amateur chef",
      currentCity: {
        id: "blr",
        name: "Bengaluru",
        stateName: "Karnataka",
        countryCode: "IN",
      },
    },
    photos: [
      {
        id: "r",
        url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=1000&auto=format&fit=crop&q=85",
        displayOrder: 0,
        isPrimary: true,
      },
    ],
    profileOptions: [],
    interests: [
      { id: "1", code: "COFFEE", name: "Coffee dates" },
      { id: "4", code: "MUSIC", name: "Live music" },
    ],
    languages: [],
    prompts: [],
    compatibility: {
      percentage: 89,
      isDemo: true,
      label: "Demo compatibility",
    },
  },
  {
    userId: "demo-meera",
    profile: {
      displayName: "Meera",
      age: 24,
      bio: "Pottery-stained hands and a head full of stories. Looking for someone to get delightfully lost in a bookstore with.",
      jobTitle: "Writer & pottery enthusiast",
      currentCity: {
        id: "blr",
        name: "Bengaluru",
        stateName: "Karnataka",
        countryCode: "IN",
      },
    },
    photos: [
      {
        id: "m",
        url: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=1000&auto=format&fit=crop&q=85",
        displayOrder: 0,
        isPrimary: true,
      },
    ],
    profileOptions: [],
    interests: [
      { id: "5", code: "BOOKS", name: "Bookstores" },
      { id: "6", code: "POTTERY", name: "Making things" },
    ],
    languages: [],
    prompts: [],
    compatibility: {
      percentage: 92,
      isDemo: true,
      label: "Demo compatibility",
    },
  },
];
export const demoVenues: Venue[] = [
  {
    id: "demo-cafe",
    name: "The Little Sunday",
    description:
      "Slow mornings, warm croissants, and a quiet corner just for two.",
    city: "Bengaluru",
    state: "Karnataka",
    address: "12, Indiranagar",
    kind: "CAFE",
    headline: "Coffee, conversation & a little chemistry.",
    imageUrl:
      "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=900&auto=format&fit=crop&q=80",
    priceForTwoInr: 800,
    durationMinutes: 90,
    tags: ["Quiet corners", "Great coffee", "Outdoor seating"],
    distanceKm: 2.4,
  },
  {
    id: "demo-art",
    name: "Clay & Co.",
    description:
      "A little messy. A lot of fun. Make something together at a relaxed pottery session.",
    city: "Bengaluru",
    state: "Karnataka",
    address: "8, Koramangala",
    kind: "ACTIVITY",
    headline: "Make memories. And a slightly wonky mug.",
    imageUrl:
      "https://images.unsplash.com/photo-1565193298595-6ba2e2e8d2b1?w=900&auto=format&fit=crop&q=80",
    priceForTwoInr: 1800,
    durationMinutes: 120,
    tags: ["Pottery", "Beginner friendly"],
    distanceKm: 4.1,
  },
  {
    id: "demo-dinner",
    name: "Olive & Ember",
    description:
      "Candlelit tables, seasonal plates, and an evening worth putting your phone away for.",
    city: "Bengaluru",
    state: "Karnataka",
    address: "24, MG Road",
    kind: "RESTAURANT",
    headline: "A table for two. A night to remember.",
    imageUrl:
      "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=900&auto=format&fit=crop&q=80",
    priceForTwoInr: 2400,
    durationMinutes: 120,
    tags: ["Date night", "Candlelight"],
    distanceKm: 3.2,
  },
];
export const demoMatches: Match[] = [
  {
    id: "demo-match",
    createdAt: new Date().toISOString(),
    person: demoProfiles[1]!,
  },
];

export const demoVenueOfferings: import("../../types/discovery").VenueOffering[] =
  [
    {
      id: "demo-menu",
      kind: "MENU",
      title: "Coffee & little bites",
      description:
        "Cappuccino · ₹180\nIced latte · ₹200\nMasala chai · ₹120\nGrilled sandwich · ₹240\nChocolate brownie · ₹190\n\nSample menu for this design preview.",
      priceInr: null,
      startsAt: null,
      endsAt: null,
      photos: [{ id: "demo-coffee-photo", url: demoVenues[0]!.imageUrl! }],
    },
    {
      id: "demo-package",
      kind: "PACKAGE",
      title: "Coffee for two",
      description:
        "Two coffees, a sharing dessert and a cosy corner for your conversation. Sample package for this design preview.",
      priceInr: 650,
      startsAt: null,
      endsAt: null,
      photos: [],
    },
    {
      id: "demo-plan",
      kind: "PLAN",
      title: "An unhurried afternoon",
      description:
        "Start with coffee, share something sweet and take a little walk afterwards. Sample plan for this design preview.",
      priceInr: null,
      startsAt: null,
      endsAt: null,
      photos: [],
    },
    {
      id: "demo-event",
      kind: "EVENT",
      title: "Acoustic evenings",
      description:
        "A little live music, warm drinks and lovely company. Sample event for this design preview.",
      priceInr: 300,
      startsAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      endsAt: null,
      photos: [],
    },
  ];
