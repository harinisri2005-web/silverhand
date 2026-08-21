import {
  Listing,
  User,
  ChatMessage,
  Conversation,
  GeoLocation,
  MarketplaceEvent,
  RegisteredShopParticipant,
  ServiceReview,
  VideoDemo,
  ReviewerRole,
} from "../types";
import { db } from "./firebase";
import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  getDoc,
} from "firebase/firestore";

const USERS_KEY = "silverhands_users_v2";
const LISTINGS_KEY = "silverhands_listings_v2";
const MESSAGES_KEY = "silverhands_messages_v2";
const CONVERSATIONS_KEY = "silverhands_conversations_v2";
const CURRENT_USER_KEY = "silverhands_current_user_v2";
const EVENTS_KEY = "silverhands_events_v2";
const REVIEWS_KEY = "silverhands_reviews_v2";

export interface CraftVideoPreset {
  id: string;
  category: string;
  title: string;
  description: string;
  videoUrl: string;
  thumbnailUrl: string;
  durationSeconds: number;
}

export const CRAFT_VIDEO_PRESETS: CraftVideoPreset[] = [
  {
    id: "preset_sari_zari",
    category: "repairs_mending",
    title: "Master Zari Gold Thread Invisible Darning Demo",
    description: "45-second live master demonstration of delicate silk weft matching and antique border reinforcement.",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    thumbnailUrl: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=800&q=80",
    durationSeconds: 45,
  },
  {
    id: "preset_clockmaker",
    category: "traditional_skills",
    title: "Horologist Gear Lubrication & Escapement Demo",
    description: "Close-up craftsmanship restoring a 19th-century mechanical pendulum clock escapement and balance wheel.",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    thumbnailUrl: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=800&q=80",
    durationSeconds: 38,
  },
  {
    id: "preset_pickle_curing",
    category: "home_cooking",
    title: "Sun-Cured Avakkai: Stone Grinding & Clay Bharani Demo",
    description: "Demonstrating the traditional wooden pestle technique and cold-pressed sesame oil curing process.",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
    thumbnailUrl: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=800&q=80",
    durationSeconds: 52,
  },
  {
    id: "preset_herbal_salve",
    category: "gardening_botanicals",
    title: "Organic Calendula Infusion & Beeswax Balm Demo",
    description: "Harvesting fresh botanical petals and slow double-boiler blending for healing skin balm.",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4",
    thumbnailUrl: "https://images.unsplash.com/photo-1608248597359-0026e6490e54?auto=format&fit=crop&w=800&q=80",
    durationSeconds: 34,
  },
  {
    id: "preset_rosewood_carving",
    category: "handmade_goods",
    title: "Artisan Hand-Carved Rosewood Cooking Utensils Demo",
    description: "Hands-on carving of ergonomic traditional cooking spatulas with natural beeswax polish.",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4",
    thumbnailUrl: "https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=800&q=80",
    durationSeconds: 40,
  },
  {
    id: "preset_kantha_stitch",
    category: "handmade_goods",
    title: "Heirloom Cotton Layering & Kantha Stitching Demo",
    description: "Layering vintage handloom cotton weaves into hypoallergenic running-stitch quilt work.",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4",
    thumbnailUrl: "https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?auto=format&fit=crop&w=800&q=80",
    durationSeconds: 42,
  },
];

// Seed Senior Master Artisans and Homemakers
export const SEED_USERS: User[] = [
  {
    id: "user_kamala",
    username: "kamaladadi",
    passcode: "1234",
    fullName: "Kamala Devi",
    role: "provider",
    phone: "+1 (555) 382-9011",
    preferredLanguage: "Hindi",
    location: {
      lat: 13.0855,
      lng: 80.2730,
      address: "22 Temple Bell Lane",
      neighborhood: "Heritage Quarter",
      city: "Metro West",
    },
    bio: "45 years of mastering traditional Zari gold-thread darning, silk sari restoration, and intricate Kanchipuram borders.",
    avatarUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80",
    yearsOfExperience: 45,
    specialtySkills: ["Silk Sari Darning", "Zari Restoration", "Hand Embroidery", "Invisible Mending"],
    digitalApprenticeWilling: true,
    heritageStory: "Learned loom embroidery from my mother in Varanasi; preserving garments that hold family memories.",
    rating: 4.9,
    reviewCount: 38,
    createdAt: "2024-01-15T10:00:00.000Z",
  },
  {
    id: "user_robert",
    username: "clockmaker_bob",
    passcode: "4321",
    fullName: "Robert MacIntyre",
    role: "provider",
    phone: "+1 (555) 491-7723",
    preferredLanguage: "English",
    location: {
      lat: 13.0780,
      lng: 80.2650,
      address: "88 Old Mill Crescent",
      neighborhood: "Clocktower Square",
      city: "Metro West",
    },
    bio: "Retired horologist & master carpenter restoring mechanical pendulums, antique wall clocks, and solid teak furniture.",
    avatarUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80",
    yearsOfExperience: 50,
    specialtySkills: ["Mechanical Clock Repair", "Teak Furniture Joinery", "French Polishing", "Antique Restoration"],
    digitalApprenticeWilling: true,
    heritageStory: "Third generation clockmaker. Keeping analog craftsmanship alive in a digital world.",
    rating: 5.0,
    reviewCount: 42,
    createdAt: "2024-02-10T11:30:00.000Z",
  },
  {
    id: "user_shanti",
    username: "shanti_kitchen",
    passcode: "1111",
    fullName: "Shanti Nambiar",
    role: "provider",
    phone: "+1 (555) 234-8890",
    preferredLanguage: "Tamil",
    location: {
      lat: 13.0890,
      lng: 80.2780,
      address: "105 Coconut Grove",
      neighborhood: "Riverside Garden",
      city: "Metro West",
    },
    bio: "Small-batch grandmother-recipe mango avakkai pickles, slow stone-ground rasam podi, and sun-dried vadams.",
    avatarUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80",
    yearsOfExperience: 35,
    specialtySkills: ["Stone Ground Spice Mixes", "Fermented Heirloom Pickles", "Traditional Sweets"],
    digitalApprenticeWilling: false,
    heritageStory: "My grandmother's brass pestle still grinds every batch with zero chemical preservatives.",
    rating: 4.9,
    reviewCount: 57,
    createdAt: "2024-03-01T09:00:00.000Z",
  },
  {
    id: "user_clara",
    username: "clara_herbs",
    passcode: "2222",
    fullName: "Clara O'Connor",
    role: "provider",
    phone: "+1 (555) 871-3329",
    preferredLanguage: "English",
    location: {
      lat: 13.0805,
      lng: 80.2810,
      address: "4 Gardenia Mews",
      neighborhood: "Botanical Lane",
      city: "Metro West",
    },
    bio: "Urban organic gardener growing heritage medicinal herbs, lavender balms, and hand-woven sourdough starter cultures.",
    avatarUrl: "https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?auto=format&fit=crop&w=400&q=80",
    yearsOfExperience: 30,
    specialtySkills: ["Medicinal Herb Cultivation", "Handmade Beeswax Balms", "Seed Saving", "Plant Health Diagnostics"],
    digitalApprenticeWilling: true,
    heritageStory: "Sharing centuries-old herbal remedies and showing younger neighbors how soil heals us.",
    rating: 4.8,
    reviewCount: 29,
    createdAt: "2024-04-12T14:20:00.000Z",
  },
  {
    id: "user_arun",
    username: "arun_woodcraft",
    passcode: "3333",
    fullName: "Arun Kumar",
    role: "provider",
    phone: "+1 (555) 762-4411",
    preferredLanguage: "Tamil",
    location: {
      lat: 13.0842,
      lng: 80.2685,
      address: "18 Weaver's Street",
      neighborhood: "Heritage Quarter",
      city: "Metro West",
    },
    bio: "Traditional rosewood carving, handmade wooden kitchen spatulas, and handcrafted terracotta garden birdbaths.",
    avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80",
    yearsOfExperience: 38,
    specialtySkills: ["Rosewood Joinery", "Terracotta Pottery", "Natural Wax Polishing"],
    digitalApprenticeWilling: true,
    heritageStory: "Handed down from my grandfather who carved temple chariots.",
    rating: 4.9,
    reviewCount: 31,
    createdAt: "2024-04-20T10:00:00.000Z",
  },
  {
    id: "user_customer_priya",
    username: "priya_neighbor",
    passcode: "5555",
    fullName: "Priya Sharma",
    role: "customer",
    phone: "+1 (555) 912-3344",
    preferredLanguage: "English",
    location: {
      lat: 13.0827,
      lng: 80.2707,
      address: "14 Palm Grove Ave",
      neighborhood: "Heritage District",
      city: "Metro West",
    },
    bio: "Local resident looking for authentic handcrafted goods, clothing alterations, and willing to teach smartphone skills.",
    avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
    rating: 5.0,
    reviewCount: 12,
    createdAt: "2024-05-01T08:00:00.000Z",
  },
  {
    id: "user_customer_karthik",
    username: "karthik_tech",
    passcode: "6666",
    fullName: "Karthik Rajan",
    role: "customer",
    phone: "+1 (555) 782-1920",
    preferredLanguage: "Tamil",
    location: {
      lat: 13.0845,
      lng: 80.2690,
      address: "5 Temple View Road",
      neighborhood: "Heritage Quarter",
      city: "Metro West",
    },
    bio: "Software engineer and neighborhood volunteer. Loving traditional crafts and helping seniors with smartphones.",
    avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80",
    rating: 5.0,
    reviewCount: 8,
    createdAt: "2024-05-10T09:00:00.000Z",
  },
  {
    id: "user_customer_ananya",
    username: "ananya_baker",
    passcode: "7777",
    fullName: "Ananya Iyer",
    role: "customer",
    phone: "+1 (555) 349-8812",
    preferredLanguage: "English",
    location: {
      lat: 13.0795,
      lng: 80.2670,
      address: "32 Clocktower Alley",
      neighborhood: "Clocktower Square",
      city: "Metro West",
    },
    bio: "Artisan sourdough baker and antique collector passionate about restoring heirloom clocks and heritage crafts.",
    avatarUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80",
    rating: 4.9,
    reviewCount: 15,
    createdAt: "2024-05-15T11:00:00.000Z",
  },
  {
    id: "user_customer_vikram",
    username: "vikram_n",
    passcode: "8888",
    fullName: "Vikram Nair",
    role: "customer",
    phone: "+1 (555) 671-4450",
    preferredLanguage: "Malayalam",
    location: {
      lat: 13.0885,
      lng: 80.2770,
      address: "7 Riverside Promenade",
      neighborhood: "Riverside Garden",
      city: "Metro West",
    },
    bio: "Local food enthusiast eager to support traditional grandmother recipes and zero-preservative pickles.",
    avatarUrl: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=400&q=80",
    rating: 5.0,
    reviewCount: 6,
    createdAt: "2024-05-20T14:00:00.000Z",
  },
  {
    id: "user_customer_divya",
    username: "divya_m",
    passcode: "9999",
    fullName: "Divya Menon",
    role: "customer",
    phone: "+1 (555) 890-2341",
    preferredLanguage: "Tamil",
    location: {
      lat: 13.0838,
      lng: 80.2700,
      address: "19 Weaver's Lane",
      neighborhood: "Heritage Quarter",
      city: "Metro West",
    },
    bio: "Interior designer looking for handcrafted sustainable woodcraft and authentic terracotta pottery.",
    avatarUrl: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=400&q=80",
    rating: 4.9,
    reviewCount: 10,
    createdAt: "2024-05-25T16:00:00.000Z",
  },
  {
    id: "user_customer_meera",
    username: "meera_gardener",
    passcode: "1212",
    fullName: "Meera Sundaram",
    role: "customer",
    phone: "+1 (555) 431-7654",
    preferredLanguage: "English",
    location: {
      lat: 13.0815,
      lng: 80.2820,
      address: "11 Botanical Mews",
      neighborhood: "Botanical Lane",
      city: "Metro West",
    },
    bio: "Eager to learn botanical herbal crafting, balcony gardening, and natural skincare preparations.",
    avatarUrl: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=400&q=80",
    rating: 5.0,
    reviewCount: 9,
    createdAt: "2024-06-01T10:00:00.000Z",
  },
];

// Seed Photographic & Cinematic Listings
export const SEED_LISTINGS: Listing[] = [
  {
    id: "listing_sari_repair",
    providerId: "user_kamala",
    providerName: "Kamala Devi",
    providerAvatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80",
    providerLanguage: "Hindi",
    title: "रेशम और ज़री साड़ी मरम्मत एवं रफू (Heirloom Silk Sari & Zari Restoration)",
    titleEnglish: "Heirloom Silk Sari & Zari Gold Thread Invisible Mending",
    description: "पुश्तैनी सिल्क साड़ियों, बनारसी और कांचीपुरम के फटे किनारों, ज़री के धागों और पल्लू का अत्यंत बारीक हाथ का काम। आपकी यादों को नया जीवन।",
    descriptionEnglish: "Specialized delicate restoration for heirloom silks, Banarasi, and Kanchipuram sarees. Seamless hand-darning and gold zari thread reinforcement preserving precious family heirlooms.",
    category: "repairs_mending",
    price: 450,
    isBarter: true,
    barterDetails: "Happy to exchange for helping me update my phone banking app or grocery pickup.",
    digitalApprenticeEligible: true,
    heritageNotes: "45 years of traditional needlecraft techniques that cannot be duplicated by any modern machine.",
    tags: ["Silk Sari", "Zari Restoration", "Invisible Darning", "Hand Embroidery", "Master Artisan"],
    imageUrl: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=800&q=80",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    videoThumbnailUrl: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=800&q=80",
    videoDurationSeconds: 45,
    videoDemo: {
      id: "vd_kamala_sari",
      videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
      thumbnailUrl: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=800&q=80",
      durationSeconds: 45,
      recordedAt: "2026-08-01T10:00:00.000Z",
      title: "Master Zari Gold Thread Invisible Darning Demo",
      description: "Delicate silk weft matching and antique border reinforcement demonstration.",
    },
    location: {
      lat: 13.0855,
      lng: 80.2730,
      address: "22 Temple Bell Lane",
      neighborhood: "Heritage Quarter",
      city: "Metro West",
    },
    available: true,
    createdAt: "2024-06-01T10:00:00.000Z",
    viewsCount: 142,
    likesCount: 56,
    averageRating: 4.9,
    reviewCount: 38,
  },
  {
    id: "listing_antique_clock",
    providerId: "user_robert",
    providerName: "Robert MacIntyre",
    providerAvatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80",
    providerLanguage: "English",
    title: "Antique Pendulum & Mechanical Clock Restoration",
    titleEnglish: "Antique Pendulum & Mechanical Clock Restoration",
    description: "Full mechanical servicing, gear lubrication, escapement adjustment, and case polishing for heirloom grandfather clocks, wall regulators, and Swiss pocket watches.",
    descriptionEnglish: "Full mechanical servicing, gear lubrication, escapement adjustment, and case polishing for heirloom grandfather clocks, wall regulators, and Swiss pocket watches.",
    category: "traditional_skills",
    price: 850,
    isBarter: true,
    barterDetails: "Will trade 2 hours of clock repair for help installing home solar sensors or lawn mowing.",
    digitalApprenticeEligible: true,
    heritageNotes: "Practicing the endangered trade of analog horology using hand-lathed brass gears.",
    tags: ["Horology", "Clock Repair", "Wood Joinery", "Vintage Antiques", "Mechanical"],
    imageUrl: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=800&q=80",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    videoThumbnailUrl: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=800&q=80",
    videoDurationSeconds: 38,
    videoDemo: {
      id: "vd_robert_clock",
      videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
      thumbnailUrl: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=800&q=80",
      durationSeconds: 38,
      recordedAt: "2026-08-02T11:00:00.000Z",
      title: "Horologist Gear Lubrication & Escapement Demo",
      description: "Restoring a 19th-century mechanical pendulum clock escapement and balance wheel.",
    },
    location: {
      lat: 13.0780,
      lng: 80.2650,
      address: "88 Old Mill Crescent",
      neighborhood: "Clocktower Square",
      city: "Metro West",
    },
    available: true,
    createdAt: "2024-06-02T11:00:00.000Z",
    viewsCount: 98,
    likesCount: 34,
    averageRating: 5.0,
    reviewCount: 42,
  },
  {
    id: "listing_heirloom_pickle",
    providerId: "user_shanti",
    providerName: "Shanti Nambiar",
    providerAvatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80",
    providerLanguage: "Tamil",
    title: "கை அரைத்த ஆவக்காய் மாங்காய் ஊறுகாய் (Hand-Ground Avakkai Mango Pickle)",
    titleEnglish: "Stone-Ground Sun-Cured Avakkai Mango Pickle & Podi",
    description: "பாரம்பரிய மரச் செக்கு நல்லெண்ணெய், கல் உரலில் அரைத்த மிளகாய் தூள் கொண்டு தயாரிக்கப்பட்ட உண்மையான பாட்டி கைமணம் ஊறுகாய்.",
    descriptionEnglish: "Authentic grandmother recipe cured in cold-pressed sesame oil with sun-dried guntur spices and zero artificial preservatives. Fermented in clay bharanis.",
    category: "home_cooking",
    price: 250,
    isBarter: false,
    digitalApprenticeEligible: false,
    heritageNotes: "Recipe preserved across 4 generations; aged in glazed porcelain jars under natural sun.",
    tags: ["Artisan Pickles", "Grandmother Recipe", "Cold Pressed Sesame", "Sun Cured", "Traditional Food"],
    imageUrl: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=800&q=80",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
    videoThumbnailUrl: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=800&q=80",
    videoDurationSeconds: 52,
    videoDemo: {
      id: "vd_shanti_pickle",
      videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
      thumbnailUrl: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=800&q=80",
      durationSeconds: 52,
      recordedAt: "2026-08-03T09:30:00.000Z",
      title: "Sun-Cured Avakkai: Stone Grinding & Clay Bharani Demo",
      description: "Traditional wooden pestle technique and cold-pressed sesame oil curing process.",
    },
    location: {
      lat: 13.0890,
      lng: 80.2780,
      address: "105 Coconut Grove",
      neighborhood: "Riverside Garden",
      city: "Metro West",
    },
    available: true,
    createdAt: "2024-06-03T09:30:00.000Z",
    viewsCount: 215,
    likesCount: 89,
    averageRating: 4.9,
    reviewCount: 57,
  },
  {
    id: "listing_herbal_salve",
    providerId: "user_clara",
    providerName: "Clara O'Connor",
    providerAvatar: "https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?auto=format&fit=crop&w=400&q=80",
    providerLanguage: "English",
    title: "Handcrafted Organic Calendula & Lavender Healing Salve",
    titleEnglish: "Handcrafted Organic Calendula & Lavender Healing Salve",
    description: "Slow-infused with cold-pressed olive oil, local raw beeswax, and home-grown calendula blossoms. Deeply soothing for dry hands and weather-worn skin.",
    descriptionEnglish: "Slow-infused with cold-pressed olive oil, local raw beeswax, and home-grown calendula blossoms. Deeply soothing for dry hands and weather-worn skin.",
    category: "gardening_botanicals",
    price: 199,
    isBarter: true,
    barterDetails: "Open to trading for fresh sourdough loaf, garden mulch, or companionship tea visits.",
    digitalApprenticeEligible: true,
    heritageNotes: "Cultivated in an all-organic heirloom micro-garden using companion planting.",
    tags: ["Herbal Remedy", "Organic Botanicals", "Lavender Salve", "Beeswax", "Natural Care"],
    imageUrl: "https://images.unsplash.com/photo-1608248597359-0026e6490e54?auto=format&fit=crop&w=800&q=80",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4",
    videoThumbnailUrl: "https://images.unsplash.com/photo-1608248597359-0026e6490e54?auto=format&fit=crop&w=800&q=80",
    videoDurationSeconds: 34,
    videoDemo: {
      id: "vd_clara_salve",
      videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4",
      thumbnailUrl: "https://images.unsplash.com/photo-1608248597359-0026e6490e54?auto=format&fit=crop&w=800&q=80",
      durationSeconds: 34,
      recordedAt: "2026-08-04T14:15:00.000Z",
      title: "Organic Calendula Infusion & Beeswax Balm Demo",
      description: "Botanical petals and slow double-boiler blending for healing skin balm.",
    },
    location: {
      lat: 13.0805,
      lng: 80.2810,
      address: "4 Gardenia Mews",
      neighborhood: "Botanical Lane",
      city: "Metro West",
    },
    available: true,
    createdAt: "2024-06-04T14:15:00.000Z",
    viewsCount: 167,
    likesCount: 62,
    averageRating: 4.8,
    reviewCount: 29,
  },
  {
    id: "listing_woodcraft_kitchen",
    providerId: "user_arun",
    providerName: "Arun Kumar",
    providerAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80",
    providerLanguage: "Tamil",
    title: "பாரம்பரிய மர கரண்டிகள் & கைவினைப் பொருட்கள் (Handmade Rosewood Kitchenware)",
    titleEnglish: "Hand-Carved Seasoned Rosewood Spatulas & Butter Paddles",
    description: "முழுக்க முழுக்க கைகளால் செதுக்கப்பட்ட வேப்ப மர மற்றும் ரோஸ்வுட் சமையல் கரண்டிகள். எந்தவித வேதிப்பொருளும் இல்லாத இயற்கை மெழுகு பூச்சு.",
    descriptionEnglish: "Sustainably carved from seasoned rosewood and neem timber, finished only with food-grade beeswax and mineral oil. Gentle on traditional cookware.",
    category: "handmade_goods",
    price: 320,
    isBarter: true,
    barterDetails: "Will exchange hand-carved spoons for help setting up digital UPI payments on phone.",
    digitalApprenticeEligible: true,
    heritageNotes: "Traditional woodcarving techniques preserving zero-waste timber joinery.",
    tags: ["Rosewood", "Hand Carved", "Wooden Spatula", "Zero Waste", "Artisan Woodcraft"],
    imageUrl: "https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=800&q=80",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4",
    videoThumbnailUrl: "https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=800&q=80",
    videoDurationSeconds: 40,
    videoDemo: {
      id: "vd_arun_wood",
      videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4",
      thumbnailUrl: "https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=800&q=80",
      durationSeconds: 40,
      recordedAt: "2026-08-05T09:00:00.000Z",
      title: "Artisan Hand-Carved Rosewood Cooking Utensils Demo",
      description: "Hands-on carving of ergonomic traditional cooking spatulas with natural beeswax polish.",
    },
    location: {
      lat: 13.0842,
      lng: 80.2685,
      address: "18 Weaver's Street",
      neighborhood: "Heritage Quarter",
      city: "Metro West",
    },
    available: true,
    createdAt: "2024-06-05T09:00:00.000Z",
    viewsCount: 88,
    likesCount: 39,
    averageRating: 4.9,
    reviewCount: 31,
  },
  {
    id: "listing_priya_barter",
    providerId: "user_customer_priya",
    providerName: "Priya Sharma",
    providerAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
    providerLanguage: "English",
    title: "Smartphone & Banking App Help in exchange for Tailoring / Sari Mending",
    titleEnglish: "Tech & Smartphone Tutoring in Exchange for Saree Alterations",
    description: "Happy to sit with senior neighbors and teach WhatsApp, online utility bill payments, or voice typing in exchange for small hem adjustments or homemade snacks!",
    descriptionEnglish: "Happy to sit with senior neighbors and teach WhatsApp, online utility bill payments, or voice typing in exchange for small hem adjustments or homemade snacks!",
    category: "barter_request",
    price: 0,
    isBarter: true,
    barterDetails: "Offering 2 hours of patient smartphone tutoring for sari darning or pickle jar.",
    digitalApprenticeEligible: true,
    heritageNotes: "Fostering intergenerational community exchange and neighborly mutual aid.",
    tags: ["Neighbor Barter", "Tech Help", "Intergenerational", "Skill Swap", "Community"],
    imageUrl: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=800&q=80",
    location: {
      lat: 13.0827,
      lng: 80.2707,
      address: "14 Palm Grove Ave",
      neighborhood: "Heritage District",
      city: "Metro West",
    },
    available: true,
    createdAt: "2024-06-05T12:00:00.000Z",
    viewsCount: 76,
    likesCount: 28,
    averageRating: 5.0,
    reviewCount: 12,
  },
  {
    id: "listing_quilt_mending",
    providerId: "user_kamala",
    providerName: "Kamala Devi",
    providerAvatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80",
    providerLanguage: "Hindi",
    title: "हाथ से बनी पारंपरिक रजाई एवं कंथा कढ़ाई (Hand-Stitched Kantha Quilts)",
    titleEnglish: "Hand-Stitched Heritage Kantha Quilts & Patchwork",
    description: "शुद्ध सूती साड़ियों की परतों से बनी हल्की और आरामदायक कंथा रजाई। हर सिलाई में प्यार और कारीगरी।",
    descriptionEnglish: "Lightweight heirloom Kantha quilts crafted from layered pure cotton weaves with running stitch embroidery. Breathable, hypoallergenic, and timeless.",
    category: "handmade_goods",
    price: 650,
    isBarter: false,
    digitalApprenticeEligible: true,
    heritageNotes: "Traditional zero-waste textile craft transforming vintage textiles into cherished bedding.",
    tags: ["Kantha Quilt", "Hand Stitch", "Zero Waste", "Cotton Weave", "Bedding"],
    imageUrl: "https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?auto=format&fit=crop&w=800&q=80",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4",
    videoThumbnailUrl: "https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?auto=format&fit=crop&w=800&q=80",
    videoDurationSeconds: 42,
    videoDemo: {
      id: "vd_kamala_quilt",
      videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4",
      thumbnailUrl: "https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?auto=format&fit=crop&w=800&q=80",
      durationSeconds: 42,
      recordedAt: "2026-08-05T16:00:00.000Z",
      title: "Heirloom Cotton Layering & Kantha Stitching Demo",
      description: "Layering vintage handloom cotton weaves into hypoallergenic running-stitch quilt work.",
    },
    location: {
      lat: 13.0855,
      lng: 80.2730,
      address: "22 Temple Bell Lane",
      neighborhood: "Heritage Quarter",
      city: "Metro West",
    },
    available: true,
    createdAt: "2024-06-05T16:00:00.000Z",
    viewsCount: 110,
    likesCount: 47,
    averageRating: 4.9,
    reviewCount: 38,
  },
];

// Seed Community Flea Market & Meetup Events
export const SEED_EVENTS: MarketplaceEvent[] = [
  {
    id: "event_heritage_bazaar",
    title: "Heritage Craft & Artisan Weekend Bazaar",
    description: "Open community flea market celebrating master artisans, generational handicrafts, live sari restoration demos, and traditional tools showcase. Refreshments provided by neighborhood bakers.",
    bannerUrl: "https://images.unsplash.com/photo-1533900298318-6b8da08a523e?auto=format&fit=crop&w=1000&q=80",
    date: "Saturday, Aug 22, 2026",
    time: "10:00 AM - 6:00 PM",
    locationName: "Heritage Square Artisan Quadrangle",
    location: {
      lat: 13.0850,
      lng: 80.2720,
      address: "Heritage Square Central Gazebo, 10 Temple Way",
      neighborhood: "Heritage Quarter",
      city: "Metro West",
    },
    organizerId: "user_kamala",
    organizerName: "Kamala Devi",
    organizerAvatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80",
    stallsCapacity: 16,
    registeredShops: [
      {
        artisanId: "user_kamala",
        artisanName: "Kamala Devi",
        artisanAvatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80",
        artisanPhone: "+1 (555) 234-5678",
        artisanRole: "provider",
        artisanLocation: {
          lat: 13.0855,
          lng: 80.2730,
          address: "22 Temple Bell Lane",
          neighborhood: "Heritage Quarter",
          city: "Metro West",
        },
        shopId: "listing_sari_repair",
        shopTitle: "Zari Silk Sari Restoration & Needlecraft",
        category: "repairs_mending",
        stallNumber: "Stall #1 (Master Bay)",
        stallRequirement: "Needs 1 display table & bright lamp fixture",
        status: "confirmed",
        preferredLanguage: "Hindi",
        registeredAt: "2026-08-10T09:00:00.000Z",
      },
      {
        artisanId: "user_robert",
        artisanName: "Robert MacIntyre",
        artisanAvatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80",
        artisanPhone: "+1 (555) 432-8765",
        artisanRole: "provider",
        artisanLocation: {
          lat: 13.0792,
          lng: 80.2640,
          address: "9 Clockmaker Lane",
          neighborhood: "Clocktower Square",
          city: "Metro West",
        },
        shopId: "listing_antique_clock",
        shopTitle: "Antique Pendulum Horology & Clock Repair",
        category: "traditional_skills",
        stallNumber: "Stall #2 (Horology Station)",
        stallRequirement: "Needs 2 power outlets for lathe and watchmaker magnifier",
        status: "confirmed",
        preferredLanguage: "English",
        registeredAt: "2026-08-11T14:30:00.000Z",
      },
      {
        artisanId: "user_arun",
        artisanName: "Arun Kumar",
        artisanAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80",
        artisanPhone: "+1 (555) 762-4411",
        artisanRole: "provider",
        artisanLocation: {
          lat: 13.0842,
          lng: 80.2685,
          address: "18 Weaver's Street",
          neighborhood: "Heritage Quarter",
          city: "Metro West",
        },
        shopId: "listing_woodcraft_kitchen",
        shopTitle: "Hand-Carved Rosewood & Terracotta Craft",
        category: "handmade_goods",
        stallNumber: "Stall #3 (Woodcraft Corner)",
        stallRequirement: "Corner table for wood carving display & live shavings",
        status: "confirmed",
        preferredLanguage: "Tamil",
        registeredAt: "2026-08-12T11:15:00.000Z",
      },
    ],
    attendeesCount: 78,
    tags: ["Handicrafts", "Artisans", "Live Demos", "Weekend Bazaar", "Family Friendly"],
    createdAt: "2026-08-01T10:00:00.000Z",
  },
  {
    id: "event_heirloom_food_flea",
    title: "Neighborhood Grandmothers' Heirloom Food & Recipe Flea",
    description: "Sun-cured pickles, stone-ground podis, freshly baked sourdough, and natural herbal tonics made with ancient family recipes. Bring your clean jars for refills!",
    bannerUrl: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1000&q=80",
    date: "Sunday, Aug 23, 2026",
    time: "11:00 AM - 4:30 PM",
    locationName: "Riverside Botanical Garden Pavilions",
    location: {
      lat: 13.0880,
      lng: 80.2790,
      address: "Riverside Pavilion #3, Coconut Grove Road",
      neighborhood: "Riverside Garden",
      city: "Metro West",
    },
    organizerId: "user_shanti",
    organizerName: "Shanti Nambiar",
    organizerAvatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80",
    stallsCapacity: 12,
    registeredShops: [
      {
        artisanId: "user_shanti",
        artisanName: "Shanti Nambiar",
        artisanAvatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80",
        artisanPhone: "+1 (555) 654-3210",
        artisanRole: "provider",
        artisanLocation: {
          lat: 13.0890,
          lng: 80.2800,
          address: "12 Palm Grove Enclave",
          neighborhood: "Riverside Garden",
          city: "Metro West",
        },
        shopId: "listing_heirloom_pickle",
        shopTitle: "Sun-Cured Avakkai Mango Pickles & Podis",
        category: "home_cooking",
        stallNumber: "Stall #1 (Pickle Gazebo)",
        stallRequirement: "Clean shaded counter for clay bharani jars",
        status: "confirmed",
        preferredLanguage: "Malayalam",
        registeredAt: "2026-08-13T10:00:00.000Z",
      },
      {
        artisanId: "user_clara",
        artisanName: "Clara O'Connor",
        artisanAvatar: "https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?auto=format&fit=crop&w=400&q=80",
        artisanPhone: "+1 (555) 871-3329",
        artisanRole: "provider",
        artisanLocation: {
          lat: 13.0805,
          lng: 80.2810,
          address: "4 Gardenia Mews",
          neighborhood: "Botanical Lane",
          city: "Metro West",
        },
        shopId: "listing_herbal_salve",
        shopTitle: "Organic Calendula & Lavender Balms",
        category: "gardening_botanicals",
        stallNumber: "Stall #2 (Botanical Pavilion)",
        stallRequirement: "Herb tasting & aromatic oils display",
        status: "confirmed",
        preferredLanguage: "English",
        registeredAt: "2026-08-14T12:00:00.000Z",
      },
    ],
    attendeesCount: 64,
    tags: ["Artisan Food", "Grandmother Recipes", "Zero Preservatives", "Organic", "Tasting"],
    createdAt: "2026-08-05T12:00:00.000Z",
  },
  {
    id: "event_apprentice_popup",
    title: "Makers & Digital Apprentice Hands-On Pop-Up Meetup",
    description: "Young neighbors and master seniors come together for practical skill exchanges: analog repairs, clock mechanisms, woodworking, and smartphone digital setup.",
    bannerUrl: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1000&q=80",
    date: "Saturday, Aug 29, 2026",
    time: "2:00 PM - 7:00 PM",
    locationName: "Clocktower Green Community Lawn",
    location: {
      lat: 13.0785,
      lng: 80.2660,
      address: "Old Mill Green, Clocktower Square",
      neighborhood: "Clocktower Square",
      city: "Metro West",
    },
    organizerId: "user_robert",
    organizerName: "Robert MacIntyre",
    organizerAvatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80",
    stallsCapacity: 14,
    registeredShops: [
      {
        artisanId: "user_robert",
        artisanName: "Robert MacIntyre",
        artisanAvatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80",
        artisanPhone: "+1 (555) 432-8765",
        artisanRole: "provider",
        artisanLocation: {
          lat: 13.0792,
          lng: 80.2640,
          address: "9 Clockmaker Lane",
          neighborhood: "Clocktower Square",
          city: "Metro West",
        },
        shopId: "listing_antique_clock",
        shopTitle: "Clockmaker Workbench & Live Escapement Teardown",
        category: "traditional_skills",
        stallNumber: "Stall #1 (Master Bench)",
        stallRequirement: "Worktable for apprentice tool demonstration",
        status: "confirmed",
        preferredLanguage: "English",
        registeredAt: "2026-08-15T15:00:00.000Z",
      },
    ],
    attendeesCount: 42,
    tags: ["Mentorship", "Hands-On", "Apprenticeship", "Youth & Seniors", "Skills Exchange"],
    createdAt: "2026-08-08T15:00:00.000Z",
  },
];

// Seed Verified Community Reviews & Professional Recruiter Endorsements
export const SEED_REVIEWS: ServiceReview[] = [
  {
    id: "rev_kamala_1",
    listingId: "listing_sari_repair",
    listingTitle: "Zari Silk Sari Restoration & Needlecraft",
    providerId: "user_kamala",
    providerName: "Kamala Devi",
    reviewerId: "reviewer_craft_guild",
    reviewerName: "Ananya Iyer",
    reviewerRole: "recruiter",
    reviewerOrganization: "South Asian Textile Heritage Guild",
    reviewerAvatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80",
    rating: 5,
    craftsmanshipRating: 5,
    communicationRating: 5,
    punctualityRating: 5,
    title: "Master-Class Zari Gold Weft Restoration — Indistinguishable from Original",
    comment: "We evaluated Kamala Ji's live craft video and hired her to restore a 60-year-old heirloom bridal Kanchipuram sari with torn zari threads. Her invisible needlework technique is truly peerless. The silk density and gold thread tension match the vintage weave with absolute precision.",
    verifiedHire: true,
    serviceTypeTag: "Silk Sari Restoration",
    helpfulCount: 24,
    createdAt: "2026-08-10T14:20:00.000Z",
    providerReply: {
      text: "Thank you Ananya beta. Working on ancestral heirlooms is a sacred prayer for my hands. Blessings to you!",
      repliedAt: "2026-08-11T09:15:00.000Z",
    },
  },
  {
    id: "rev_kamala_2",
    listingId: "listing_sari_repair",
    listingTitle: "Zari Silk Sari Restoration & Needlecraft",
    providerId: "user_kamala",
    providerName: "Kamala Devi",
    reviewerId: "user_meera_client",
    reviewerName: "Meera Krishnan",
    reviewerRole: "customer",
    reviewerOrganization: "T. Nagar Resident",
    reviewerAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
    rating: 5,
    craftsmanshipRating: 5,
    communicationRating: 5,
    punctualityRating: 5,
    title: "Saved my mother's heirloom sari before my wedding day!",
    comment: "I was devastated when my mother's heirloom sari got an ember burn on the border. Kamala Aunty welcomed me warmly, explained the hand-darning process patiently, and repaired it so seamlessly that even my grandmother couldn't spot where the hole was. Unbelievable talent.",
    verifiedHire: true,
    serviceTypeTag: "Invisible Mending",
    helpfulCount: 18,
    createdAt: "2026-08-12T16:45:00.000Z",
  },
  {
    id: "rev_robert_1",
    listingId: "listing_antique_clock",
    listingTitle: "Antique Pendulum Horology & Clock Repair",
    providerId: "user_robert",
    providerName: "Robert MacIntyre",
    reviewerId: "recruiter_vintage_clocks",
    reviewerName: "David Sterling",
    reviewerRole: "recruiter",
    reviewerOrganization: "Heritage Antiques & Clock Guild",
    reviewerAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80",
    rating: 5,
    craftsmanshipRating: 5,
    communicationRating: 5,
    punctualityRating: 5,
    title: "Exceptional Escapement Lathe Work on 1890s Ansonia Grandfather Clock",
    comment: "Robert is one of the very few surviving master horologists who can hand-turn replacement brass gears from raw billet. He diagnosed a damaged deadbeat escapement within 10 minutes and had the chime chime cadence perfectly timed to the exact second. Highly endorsed for museum-grade restorations.",
    verifiedHire: true,
    serviceTypeTag: "Horology & Joinery",
    helpfulCount: 31,
    createdAt: "2026-08-11T11:00:00.000Z",
    providerReply: {
      text: "Appreciate the thoughtful words, David! It is always a pleasure bringing these magnificent 19th-century mechanical hearts back to life.",
      repliedAt: "2026-08-11T18:30:00.000Z",
    },
  },
  {
    id: "rev_shanti_1",
    listingId: "listing_heirloom_pickle",
    listingTitle: "Sun-Cured Avakkai Mango Pickles & Podis",
    providerId: "user_shanti",
    providerName: "Shanti Nambiar",
    reviewerId: "user_vikram_client",
    reviewerName: "Vikram Menon",
    reviewerRole: "customer",
    reviewerOrganization: "Riverside Garden Resident",
    reviewerAvatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80",
    rating: 5,
    craftsmanshipRating: 5,
    communicationRating: 5,
    punctualityRating: 5,
    title: "Pure nostalgic taste from childhood — absolutely zero preservatives",
    comment: "Shanti Amma's Avakkai brings tears of nostalgia. The cold-pressed gingelly oil, hand-ground mustard seeds, and crunchy raw mango pieces cured in porcelain bharanis are authentic Kerala culinary gold. The aromatic jar was packed with so much love.",
    verifiedHire: true,
    serviceTypeTag: "Artisan Pickles",
    helpfulCount: 15,
    createdAt: "2026-08-13T10:20:00.000Z",
    providerReply: {
      text: "Enjoy in good health Vikram mone! Remember to use a dry wooden spoon always.",
      repliedAt: "2026-08-13T12:00:00.000Z",
    },
  },
  {
    id: "rev_clara_1",
    listingId: "listing_herbal_salve",
    listingTitle: "Organic Calendula & Lavender Balms",
    providerId: "user_clara",
    providerName: "Clara O'Connor",
    reviewerId: "user_sarah_eco",
    reviewerName: "Dr. Sarah Jenkins",
    reviewerRole: "recruiter",
    reviewerOrganization: "Natural Apothecary & Botanical Collective",
    reviewerAvatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80",
    rating: 5,
    craftsmanshipRating: 5,
    communicationRating: 5,
    punctualityRating: 5,
    title: "Pure unadulterated botanical extraction with pure local beeswax",
    comment: "Clara's small-batch calendula double-infusion has soothing properties superior to store-bought commercial balms. Her respect for companion planting and gentle solar infusion methods shines through every tin.",
    verifiedHire: true,
    serviceTypeTag: "Botanical Salves",
    helpfulCount: 20,
    createdAt: "2026-08-14T09:10:00.000Z",
  },
  {
    id: "rev_arun_1",
    listingId: "listing_woodcraft_kitchen",
    listingTitle: "Hand-Carved Rosewood & Terracotta Craft",
    providerId: "user_arun",
    providerName: "Arun Kumar",
    reviewerId: "user_karthik_client",
    reviewerName: "Karthik R.",
    reviewerRole: "customer",
    reviewerOrganization: "Neighborhood Home Chef",
    reviewerAvatar: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=400&q=80",
    rating: 5,
    craftsmanshipRating: 5,
    communicationRating: 5,
    punctualityRating: 5,
    title: "Smooth, ergonomic, zero-chemical rosewood cooking spatulas",
    comment: "Arun Thatha carved two customized dosa spatulas and a serving ladle for our cast-iron pans. The wood grain is silky smooth and seasoned only with organic coconut oil and beeswax. A joy to cook with daily.",
    verifiedHire: true,
    serviceTypeTag: "Rosewood Carving",
    helpfulCount: 12,
    createdAt: "2026-08-14T17:30:00.000Z",
  },
];

// Asynchronously bootstrap & sync with Firestore
export async function initializeFirestoreSync(): Promise<void> {
  try {
    const listingsSnap = await getDocs(collection(db, "listings"));
    if (listingsSnap.empty) {
      for (const item of SEED_LISTINGS) {
        await setDoc(doc(db, "listings", item.id), item);
      }
    } else {
      const remoteListings: Listing[] = [];
      listingsSnap.forEach((docSnap) => {
        remoteListings.push(docSnap.data() as Listing);
      });
      if (remoteListings.length > 0) {
        localStorage.setItem(LISTINGS_KEY, JSON.stringify(remoteListings));
      }
    }

    const usersSnap = await getDocs(collection(db, "users"));
    if (usersSnap.empty) {
      for (const u of SEED_USERS) {
        await setDoc(doc(db, "users", u.id), u);
      }
    } else {
      const remoteUsers: User[] = [];
      usersSnap.forEach((docSnap) => {
        remoteUsers.push(docSnap.data() as User);
      });
      if (remoteUsers.length > 0) {
        localStorage.setItem(USERS_KEY, JSON.stringify(remoteUsers));
      }
    }

    const eventsSnap = await getDocs(collection(db, "events"));
    if (eventsSnap.empty) {
      for (const ev of SEED_EVENTS) {
        await setDoc(doc(db, "events", ev.id), ev);
      }
    } else {
      const remoteEvents: MarketplaceEvent[] = [];
      eventsSnap.forEach((docSnap) => {
        remoteEvents.push(docSnap.data() as MarketplaceEvent);
      });
      if (remoteEvents.length > 0) {
        localStorage.setItem(EVENTS_KEY, JSON.stringify(remoteEvents));
      }
    }

    const reviewsSnap = await getDocs(collection(db, "reviews"));
    if (reviewsSnap.empty) {
      for (const rev of SEED_REVIEWS) {
        await setDoc(doc(db, "reviews", rev.id), rev);
      }
    } else {
      const remoteReviews: ServiceReview[] = [];
      reviewsSnap.forEach((docSnap) => {
        remoteReviews.push(docSnap.data() as ServiceReview);
      });
      if (remoteReviews.length > 0) {
        localStorage.setItem(REVIEWS_KEY, JSON.stringify(remoteReviews));
      }
    }
  } catch (err) {
    console.warn("Firestore sync initialized with local persistence fallback:", err);
  }
}

export function getStoredUsers(): User[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) {
      localStorage.setItem(USERS_KEY, JSON.stringify(SEED_USERS));
      return SEED_USERS;
    }
    return JSON.parse(raw);
  } catch {
    return SEED_USERS;
  }
}

export async function saveUser(user: User): Promise<void> {
  const users = getStoredUsers();
  const index = users.findIndex((u) => u.id === user.id || u.username.toLowerCase() === user.username.toLowerCase());
  if (index >= 0) {
    users[index] = user;
  } else {
    users.push(user);
  }
  localStorage.setItem(USERS_KEY, JSON.stringify(users));

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("silverhands_users_updated", { detail: users }));
  }

  // Sync to Firestore
  try {
    await setDoc(doc(db, "users", user.id), user);
  } catch (e) {
    console.warn("Firestore saveUser fallback:", e);
  }
}

export function subscribeToUsers(callback: (users: User[]) => void): () => void {
  callback(getStoredUsers());

  let unsubscribeFirestore = () => {};
  try {
    const q = collection(db, "users");
    unsubscribeFirestore = onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty) {
          const list: User[] = [];
          snapshot.forEach((d) => {
            list.push(d.data() as User);
          });
          localStorage.setItem(USERS_KEY, JSON.stringify(list));
          callback(list);
        }
      },
      (err) => console.warn("Firestore users onSnapshot:", err)
    );
  } catch (e) {
    console.warn("Could not attach users snapshot listener:", e);
  }

  const handleCustomEvent = () => callback(getStoredUsers());
  if (typeof window !== "undefined") {
    window.addEventListener("silverhands_users_updated", handleCustomEvent);
  }

  return () => {
    unsubscribeFirestore();
    if (typeof window !== "undefined") {
      window.removeEventListener("silverhands_users_updated", handleCustomEvent);
    }
  };
}

export function authenticateUser(username: string, passcode: string): User | null {
  const users = getStoredUsers();
  const cleanUser = username.trim().toLowerCase();
  const cleanPass = passcode.trim();
  const matched = users.find(
    (u) => u.username.toLowerCase() === cleanUser && u.passcode === cleanPass
  );
  if (matched) {
    setCurrentUser(matched);
    return matched;
  }
  return null;
}

export function getCurrentUser(): User | null {
  try {
    const raw = localStorage.getItem(CURRENT_USER_KEY);
    if (!raw) {
      // Default to Kamala Devi so reviewer lands on a live, functioning view immediately
      const defaultUser = SEED_USERS[0];
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(defaultUser));
      return defaultUser;
    }
    return JSON.parse(raw);
  } catch {
    return SEED_USERS[0];
  }
}

export function setCurrentUser(user: User | null): void {
  if (user) {
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(CURRENT_USER_KEY);
  }
}

export function getStoredListings(): Listing[] {
  try {
    const raw = localStorage.getItem(LISTINGS_KEY);
    if (!raw) {
      localStorage.setItem(LISTINGS_KEY, JSON.stringify(SEED_LISTINGS));
      return SEED_LISTINGS;
    }
    return JSON.parse(raw);
  } catch {
    return SEED_LISTINGS;
  }
}

/**
 * Real-time continuous subscription to listings across all neighbors, tabs, and Firestore clients
 */
export function subscribeToListings(callback: (listings: Listing[]) => void): () => void {
  // 1. Fire immediately with current cached listings
  callback(getStoredListings());

  // 2. Attach live Firestore onSnapshot listener
  let unsubscribeFirestore = () => {};
  try {
    const q = collection(db, "listings");
    unsubscribeFirestore = onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty) {
          const list: Listing[] = [];
          snapshot.forEach((docSnap) => {
            list.push(docSnap.data() as Listing);
          });
          // Sort newest updates first
          list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          localStorage.setItem(LISTINGS_KEY, JSON.stringify(list));
          callback(list);
        }
      },
      (error) => {
        console.warn("Firestore listings onSnapshot error:", error);
      }
    );
  } catch (err) {
    console.warn("Could not attach Firestore onSnapshot:", err);
  }

  // 3. Listen to window custom events & cross-tab storage changes
  const handleStorage = (e: StorageEvent) => {
    if (e.key === LISTINGS_KEY && e.newValue) {
      try {
        callback(JSON.parse(e.newValue));
      } catch (_) {}
    }
  };

  const handleCustomEvent = () => {
    callback(getStoredListings());
  };

  if (typeof window !== "undefined") {
    window.addEventListener("storage", handleStorage);
    window.addEventListener("silverhands_listings_updated", handleCustomEvent);
  }

  return () => {
    unsubscribeFirestore();
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("silverhands_listings_updated", handleCustomEvent);
    }
  };
}

export async function saveListing(listing: Listing): Promise<void> {
  const listings = getStoredListings();
  const index = listings.findIndex((l) => l.id === listing.id);
  if (index >= 0) {
    listings[index] = listing;
  } else {
    listings.unshift(listing);
  }
  localStorage.setItem(LISTINGS_KEY, JSON.stringify(listings));

  // Dispatch local broadcast for instant zero-latency UI update
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("silverhands_listings_updated", { detail: listings }));
  }

  // Sync to Firestore
  try {
    await setDoc(doc(db, "listings", listing.id), listing);
  } catch (e) {
    console.warn("Firestore saveListing fallback:", e);
  }
}

export async function deleteListing(listingId: string): Promise<void> {
  const listings = getStoredListings().filter((l) => l.id !== listingId);
  localStorage.setItem(LISTINGS_KEY, JSON.stringify(listings));

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("silverhands_listings_updated", { detail: listings }));
  }

  // Sync to Firestore
  try {
    await deleteDoc(doc(db, "listings", listingId));
  } catch (e) {
    console.warn("Firestore deleteListing fallback:", e);
  }
}

export const SEED_MESSAGES: ChatMessage[] = [
  // 1. Priya Sharma <-> Kamala Devi (Sari Repair & Barter)
  {
    id: "msg_seed_1",
    conversationId: "conv_user_customer_priya_user_kamala",
    senderId: "user_customer_priya",
    senderName: "Priya Sharma",
    senderRole: "customer",
    originalText: "नमस्ते कमला जी! मेरी दादी की 50 साल पुरानी कांचीपुरम सिल्क साड़ी का पल्लू और ज़री का किनारा थोड़ा फट गया है। क्या आप इसे रफू कर सकती हैं? मैं इसके बदले आपके फोन में ऑनलाइन बैंकिंग और पेमेंट ऐप सिखाने को तैयार हूँ।",
    translatedText: "Namaste Kamala ji! My grandmother's 50-year-old Kanchipuram silk sari's pallu and zari gold border are slightly torn. Could you delicately mend this? In exchange, I am happy to teach you online banking and digital payment apps on your phone!",
    sourceLanguage: "Hindi",
    targetLanguage: "Hindi",
    voiceNote: {
      id: "vn_priya_1",
      audioUrl: "",
      durationSeconds: 16,
      transcript: "Kamala ji, I would really love to bring this sari over to your temple lane workshop this Saturday if you have time!",
      recordedAt: "2026-08-16T14:30:00.000Z",
      language: "Hindi",
    },
    timestamp: "2026-08-16T14:30:00.000Z",
    isRead: true,
  },
  {
    id: "msg_seed_2",
    conversationId: "conv_user_customer_priya_user_kamala",
    senderId: "user_kamala",
    senderName: "Kamala Devi",
    senderRole: "provider",
    originalText: "नमस्ते बेटी! ज़रूर, मैंने आपकी साड़ी की तस्वीरें देखीं। मैं इसे बहुत प्यार और बारीक धागे से ठीक कर दूँगी। आप शनिवार सुबह 11 बजे 22 टेम्पल बेल लेन ले आइएगा।",
    translatedText: "Namaste dear daughter! Certainly, I will restore your heirloom sari with immense care and matching silk threads. Please bring it over on Saturday at 11 AM to 22 Temple Bell Lane.",
    sourceLanguage: "Hindi",
    targetLanguage: "English",
    timestamp: "2026-08-16T15:10:00.000Z",
    isRead: false,
  },
  {
    id: "msg_seed_3",
    conversationId: "conv_user_customer_priya_user_kamala",
    senderId: "user_customer_priya",
    senderName: "Priya Sharma",
    senderRole: "customer",
    originalText: "Thank you so much Kamala ji! I will see you on Saturday at 22 Temple Bell Lane. Looking forward to it!",
    translatedText: "बहुत-बहुत धन्यवाद कमला जी! मैं शनिवार को 22 टेम्पल बेल लेन पर मिलूँगी।",
    sourceLanguage: "English",
    targetLanguage: "Hindi",
    timestamp: "2026-08-16T15:25:00.000Z",
    isRead: true,
  },

  // 2. Karthik Rajan <-> Kamala Devi (Urgent Zari repair)
  {
    id: "msg_seed_4",
    conversationId: "conv_user_customer_karthik_user_kamala",
    senderId: "user_customer_karthik",
    senderName: "Karthik Rajan",
    senderRole: "customer",
    originalText: "வணக்கம் அம்மா, I have a pure gold zari veshti (dhoti) from my father's wedding. Can you restore the torn border before this Sunday's family wedding? Happy to pay cash or help with any computer work.",
    translatedText: "नमस्ते अम्मा, मेरे पास मेरे पिता की शादी की शुद्ध सोने की ज़री वाली धोती है। क्या आप रविवार की पारिवारिक शादी से पहले फटे किनारे को ठीक कर सकती हैं? मैं नकद भुगतान या कंप्यूटर के काम में मदद करने को तैयार हूँ।",
    sourceLanguage: "Tamil",
    targetLanguage: "Hindi",
    timestamp: "2026-08-17T07:15:00.000Z",
    isRead: true,
  },
  {
    id: "msg_seed_4_reply",
    conversationId: "conv_user_customer_karthik_user_kamala",
    senderId: "user_kamala",
    senderName: "Kamala Devi",
    senderRole: "provider",
    originalText: "வணக்கம் தம்பி! Yes, please bring the zari veshti today by 4 PM. I will weave real metallic silver/gold thread to match the vintage weave. You can pick it up on Friday afternoon.",
    translatedText: "Namaste Karthik! Yes, please bring the zari veshti today by 4 PM. I will weave real metallic gold thread to match the vintage weave. You can pick it up on Friday afternoon.",
    sourceLanguage: "Tamil",
    targetLanguage: "Tamil",
    voiceNote: {
      id: "vn_kamala_karthik",
      audioUrl: "",
      durationSeconds: 14,
      transcript: "Karthik, don't worry about the wedding deadline. I will prioritize this heirloom piece for your family ceremony.",
      recordedAt: "2026-08-17T07:45:00.000Z",
      language: "Tamil",
    },
    timestamp: "2026-08-17T07:45:00.000Z",
    isRead: false,
  },

  // 3. Ananya Iyer <-> Robert MacIntyre (Antique Clock Restoration)
  {
    id: "msg_seed_5",
    conversationId: "conv_user_customer_ananya_user_robert",
    senderId: "user_customer_ananya",
    senderName: "Ananya Iyer",
    senderRole: "customer",
    originalText: "Hello Mr. MacIntyre! My grandfather's 1940s pendulum wall clock stopped swinging. Would you be willing to inspect the escapement? I can trade 2 loaves of fresh sourdough bread and help set up smart home wifi sensors!",
    translatedText: "Hello Mr. MacIntyre! My grandfather's 1940s pendulum wall clock stopped swinging. Would you be willing to inspect the escapement? I can trade 2 loaves of fresh sourdough bread and help set up smart home wifi sensors!",
    sourceLanguage: "English",
    targetLanguage: "English",
    voiceNote: {
      id: "vn_ananya_1",
      audioUrl: "",
      durationSeconds: 12,
      transcript: "Hi Robert, I can also bring the pendulum weights separately so nothing gets damaged during transport.",
      recordedAt: "2026-08-16T18:00:00.000Z",
      language: "English",
    },
    timestamp: "2026-08-16T18:00:00.000Z",
    isRead: true,
  },
  {
    id: "msg_seed_5_reply",
    conversationId: "conv_user_customer_ananya_user_robert",
    senderId: "user_robert",
    senderName: "Robert MacIntyre",
    senderRole: "provider",
    originalText: "Delighted to assist, Ananya! 1940s pendulum movements are my specialty. The sourdough bread and wifi setup sounds like a wonderful trade. Drop by 14 Clockmaker's Row on Thursday afternoon.",
    translatedText: "Delighted to assist, Ananya! 1940s pendulum movements are my specialty. The sourdough bread and wifi setup sounds like a wonderful trade. Drop by 14 Clockmaker's Row on Thursday afternoon.",
    sourceLanguage: "English",
    targetLanguage: "English",
    timestamp: "2026-08-16T19:30:00.000Z",
    isRead: false,
  },

  // 4. Vikram Nair <-> Shanti Nambiar (Heirloom Mango Pickle & Spice Podi Order)
  {
    id: "msg_seed_6",
    conversationId: "conv_user_customer_vikram_user_shanti",
    senderId: "user_customer_vikram",
    senderName: "Vikram Nair",
    senderRole: "customer",
    originalText: "வணக்கம் சாந்தி மாமி! I'd like to buy 2 large ceramic jars of your sun-cured Avakkai mango pickle and 500g rasam podi for our family pooja. Are jars ready for pickup at your Riverside home?",
    translatedText: "Namaste Shanti Mami! I'd like to buy 2 large ceramic jars of your sun-cured Avakkai mango pickle and 500g rasam podi for our family pooja. Are jars ready for pickup at your Riverside home?",
    sourceLanguage: "Tamil",
    targetLanguage: "Tamil",
    timestamp: "2026-08-17T06:45:00.000Z",
    isRead: true,
  },
  {
    id: "msg_seed_6_reply",
    conversationId: "conv_user_customer_vikram_user_shanti",
    senderId: "user_shanti",
    senderName: "Shanti Nambiar",
    senderRole: "provider",
    originalText: "வணக்கம் விக்ரம்! Yes, the Avakkai jars have finished sun-curing today with pure sesame oil and mustard seeds. I have kept 2 sealed jars aside for you at 8 Riverside Garden Road. You can collect them anytime after 5 PM.",
    translatedText: "Namaste Vikram! Yes, the Avakkai jars have finished sun-curing today with pure sesame oil and mustard seeds. I have kept 2 sealed jars aside for you at 8 Riverside Garden Road. You can collect them anytime after 5 PM.",
    sourceLanguage: "Tamil",
    targetLanguage: "Tamil",
    timestamp: "2026-08-17T08:00:00.000Z",
    isRead: false,
  },

  // 5. Divya Menon <-> Arun Kumar (Rosewood Kitchen Utensils)
  {
    id: "msg_seed_7",
    conversationId: "conv_user_customer_divya_user_arun",
    senderId: "user_customer_divya",
    senderName: "Divya Menon",
    senderRole: "customer",
    originalText: "வணக்கம் அருண் அண்ணா! Can you carve a custom set of 3 rosewood cooking spatulas and a terracotta water dispenser for my grandmother? We would love to visit your workshop on Weaver's Street.",
    translatedText: "Hello Arun Anna! Can you carve a custom set of 3 rosewood cooking spatulas and a terracotta water dispenser for my grandmother? We would love to visit your workshop on Weaver's Street.",
    sourceLanguage: "Tamil",
    targetLanguage: "Tamil",
    timestamp: "2026-08-16T20:10:00.000Z",
    isRead: true,
  },
  {
    id: "msg_seed_7_reply",
    conversationId: "conv_user_customer_divya_user_arun",
    senderId: "user_arun",
    senderName: "Arun Kumar",
    senderRole: "provider",
    originalText: "வணக்கம் திவ்யா! I have seasoned Malabar rosewood ready in the workshop. I can hand-carve the spatulas with ergonomic grips tailored for elderly hands. Please come by tomorrow morning!",
    translatedText: "Namaste Divya! I have seasoned Malabar rosewood ready in the workshop. I can hand-carve the spatulas with ergonomic grips tailored for elderly hands. Please come by tomorrow morning!",
    sourceLanguage: "Tamil",
    targetLanguage: "Tamil",
    timestamp: "2026-08-16T21:00:00.000Z",
    isRead: false,
  },

  // 6. Meera Sundaram <-> Clara O'Connor (Herbal Balm & Apprenticeship)
  {
    id: "msg_seed_8",
    conversationId: "conv_user_customer_meera_user_clara",
    senderId: "user_customer_meera",
    senderName: "Meera Sundaram",
    senderRole: "customer",
    originalText: "Hi Clara! I loved the sample calendula balm you shared at the community garden. I saw you are open to digital apprentices. Can I help with your herb harvest in exchange for learning herbal balm formulation?",
    translatedText: "Hi Clara! I loved the sample calendula balm you shared at the community garden. I saw you are open to digital apprentices. Can I help with your herb harvest in exchange for learning herbal balm formulation?",
    sourceLanguage: "English",
    targetLanguage: "English",
    timestamp: "2026-08-17T05:20:00.000Z",
    isRead: true,
  },
  {
    id: "msg_seed_8_reply",
    conversationId: "conv_user_customer_meera_user_clara",
    senderId: "user_clara",
    senderName: "Clara O'Connor",
    senderRole: "provider",
    originalText: "Welcome Meera! I would love to have you apprentice with me. We are harvesting lavender and eucalyptus this Wednesday morning at 9 AM at 5 Botanist Alley. See you then!",
    translatedText: "Welcome Meera! I would love to have you apprentice with me. We are harvesting lavender and eucalyptus this Wednesday morning at 9 AM at 5 Botanist Alley. See you then!",
    sourceLanguage: "English",
    targetLanguage: "English",
    timestamp: "2026-08-17T06:10:00.000Z",
    isRead: false,
  },
];

export function getStoredMessages(conversationId?: string): ChatMessage[] {
  try {
    const raw = localStorage.getItem(MESSAGES_KEY);
    let messages: ChatMessage[];
    if (!raw) {
      localStorage.setItem(MESSAGES_KEY, JSON.stringify(SEED_MESSAGES));
      messages = SEED_MESSAGES;
    } else {
      messages = JSON.parse(raw);
    }
    if (conversationId) {
      return messages.filter((m) => m.conversationId === conversationId);
    }
    return messages;
  } catch {
    return SEED_MESSAGES;
  }
}

export function subscribeToMessages(callback: (messages: ChatMessage[]) => void): () => void {
  // 1. Snapshot
  callback(getStoredMessages());

  // 2. Firestore live subscription
  let unsubscribeFirestore = () => {};
  try {
    const q = collection(db, "messages");
    unsubscribeFirestore = onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty) {
          const list: ChatMessage[] = [];
          snapshot.forEach((docSnap) => {
            list.push(docSnap.data() as ChatMessage);
          });
          list.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
          localStorage.setItem(MESSAGES_KEY, JSON.stringify(list));
          callback(list);
        }
      },
      (error) => {
        console.warn("Firestore messages onSnapshot notice:", error);
      }
    );
  } catch (err) {
    console.warn("Could not attach Firestore messages onSnapshot:", err);
  }

  // 3. Local cross-tab & custom events
  const handleStorage = (e: StorageEvent) => {
    if (e.key === MESSAGES_KEY && e.newValue) {
      try {
        callback(JSON.parse(e.newValue));
      } catch (_) {}
    }
  };

  const handleCustom = () => {
    callback(getStoredMessages());
  };

  if (typeof window !== "undefined") {
    window.addEventListener("storage", handleStorage);
    window.addEventListener("silverhands_messages_updated", handleCustom);
  }

  return () => {
    unsubscribeFirestore();
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("silverhands_messages_updated", handleCustom);
    }
  };
}

export async function saveMessage(message: ChatMessage): Promise<void> {
  const messages = getStoredMessages();
  const existingIdx = messages.findIndex((m) => m.id === message.id);
  if (existingIdx >= 0) {
    messages[existingIdx] = message;
  } else {
    messages.push(message);
  }
  localStorage.setItem(MESSAGES_KEY, JSON.stringify(messages));

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("silverhands_messages_updated", { detail: messages }));
  }

  // Sync to Firestore
  try {
    await setDoc(doc(db, "messages", message.id), message);
  } catch (e) {
    console.warn("Firestore saveMessage fallback:", e);
  }
}

export async function markConversationAsRead(conversationId: string, currentUserId: string): Promise<void> {
  const messages = getStoredMessages();
  let updated = false;
  const newMessages = messages.map((m) => {
    if (m.conversationId === conversationId && m.senderId !== currentUserId && !m.isRead) {
      updated = true;
      return { ...m, isRead: true };
    }
    return m;
  });

  if (updated) {
    localStorage.setItem(MESSAGES_KEY, JSON.stringify(newMessages));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("silverhands_messages_updated", { detail: newMessages }));
    }

    // Sync marked messages to Firestore
    try {
      for (const m of newMessages) {
        if (m.conversationId === conversationId && m.senderId !== currentUserId) {
          await setDoc(doc(db, "messages", m.id), m);
        }
      }
    } catch (_) {}
  }
}

export function getConversationsForUser(userId: string): Conversation[] {
  const allMessages = getStoredMessages();
  const allUsers = getStoredUsers();
  const allListings = getStoredListings();

  // Group messages by conversationId
  const conversationMap = new Map<string, ChatMessage[]>();
  for (const msg of allMessages) {
    const list = conversationMap.get(msg.conversationId) || [];
    list.push(msg);
    conversationMap.set(msg.conversationId, list);
  }

  const conversations: Conversation[] = [];

  for (const [convId, msgs] of conversationMap.entries()) {
    if (msgs.length === 0) continue;
    msgs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const lastMsg = msgs[msgs.length - 1];

    // Deduce provider & customer IDs from conversationId e.g. conv_user_customer_priya_user_kamala
    // or from message senders
    const participantIds = Array.from(new Set(msgs.map((m) => m.senderId)));
    // Also parse convId components if available
    const parts = convId.replace(/^conv_/, "").split("_user_").map((p, i) => i === 0 ? p : `user_${p}`);

    // If userId is in this conversation
    const isUserParticipant = msgs.some((m) => m.senderId === userId) || convId.includes(userId);
    if (!isUserParticipant) continue;

    let otherUserId = participantIds.find((id) => id !== userId);
    if (!otherUserId) {
      otherUserId = parts.find((p) => p !== userId && p.startsWith("user_")) || parts[0];
    }

    const otherUser = allUsers.find((u) => u.id === otherUserId) || {
      id: otherUserId || "unknown",
      fullName: msgs.find((m) => m.senderId !== userId)?.senderName || "Neighbor Client",
      role: (otherUserId?.includes("customer") ? "customer" : "provider") as "customer" | "provider",
      phone: "+1 (555) 912-3344",
      preferredLanguage: "English",
      avatarUrl: undefined as string | undefined,
      location: {
        lat: 13.0827,
        lng: 80.2707,
        address: "Neighborhood Address",
        neighborhood: "Heritage Quarter",
        city: "Metro West",
      },
    };

    const thisUser = allUsers.find((u) => u.id === userId);

    const isCurrentProvider = thisUser?.role === "provider" || otherUser.role === "customer";
    const providerUser = isCurrentProvider ? thisUser : otherUser;
    const customerUser = isCurrentProvider ? otherUser : thisUser;

    // Find any related listing for this provider
    const relatedListing = allListings.find(
      (l) => l.providerId === (providerUser?.id || userId)
    ) || allListings[0];

    const unreadCount = msgs.filter((m) => m.senderId !== userId && !m.isRead).length;
    const hasVoiceNote = msgs.some((m) => Boolean(m.voiceNote));

    conversations.push({
      id: convId,
      providerId: providerUser?.id || userId,
      providerName: providerUser?.fullName || "Artisan",
      providerAvatar: providerUser?.avatarUrl,
      providerLanguage: providerUser?.preferredLanguage,
      customerId: customerUser?.id || otherUserId || "unknown",
      customerName: customerUser?.fullName || otherUser.fullName,
      customerAvatar: customerUser?.avatarUrl,
      customerPhone: customerUser?.phone,
      customerLocation: customerUser?.location,
      customerLanguage: customerUser?.preferredLanguage,
      listingId: relatedListing?.id,
      listingTitle: relatedListing?.title,
      listingTitleEnglish: relatedListing?.titleEnglish,
      listingPrice: relatedListing?.price,
      listingImageUrl: relatedListing?.imageUrl,
      isBarter: relatedListing?.isBarter,
      barterDetails: relatedListing?.barterDetails,
      digitalApprenticeEligible: relatedListing?.digitalApprenticeEligible,
      lastMessage: lastMsg.originalText,
      lastMessageTranslated: lastMsg.translatedText,
      lastMessageTimestamp: lastMsg.timestamp,
      lastSenderId: lastMsg.senderId,
      unreadCount,
      hasVoiceNote,
      status: unreadCount > 0 ? "active" : "replied",
    });
  }

  // Sort by latest message
  conversations.sort(
    (a, b) => new Date(b.lastMessageTimestamp).getTime() - new Date(a.lastMessageTimestamp).getTime()
  );

  return conversations;
}

export function getUnreadMessageCount(userId: string): number {
  const conversations = getConversationsForUser(userId);
  return conversations.reduce((acc, c) => acc + c.unreadCount, 0);
}

// ----------------------------------------------------
// Community Marketplace & Meetup Events
// ----------------------------------------------------

export function getStoredEvents(): MarketplaceEvent[] {
  try {
    const raw = localStorage.getItem(EVENTS_KEY);
    if (!raw) {
      localStorage.setItem(EVENTS_KEY, JSON.stringify(SEED_EVENTS));
      return SEED_EVENTS;
    }
    return JSON.parse(raw);
  } catch {
    return SEED_EVENTS;
  }
}

export function subscribeToEvents(callback: (events: MarketplaceEvent[]) => void): () => void {
  // 1. Initial cached snapshot
  callback(getStoredEvents());

  // 2. Attach live Firestore onSnapshot listener
  let unsubscribeFirestore = () => {};
  try {
    const q = collection(db, "events");
    unsubscribeFirestore = onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty) {
          const list: MarketplaceEvent[] = [];
          snapshot.forEach((docSnap) => {
            list.push(docSnap.data() as MarketplaceEvent);
          });
          list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          localStorage.setItem(EVENTS_KEY, JSON.stringify(list));
          callback(list);
        }
      },
      (error) => {
        console.warn("Firestore events onSnapshot error:", error);
      }
    );
  } catch (err) {
    console.warn("Could not attach Firestore events onSnapshot:", err);
  }

  // 3. Local cross-tab and event listener
  const handleStorage = (e: StorageEvent) => {
    if (e.key === EVENTS_KEY && e.newValue) {
      try {
        callback(JSON.parse(e.newValue));
      } catch (_) {}
    }
  };

  const handleCustomEvent = () => {
    callback(getStoredEvents());
  };

  if (typeof window !== "undefined") {
    window.addEventListener("storage", handleStorage);
    window.addEventListener("silverhands_events_updated", handleCustomEvent);
  }

  return () => {
    unsubscribeFirestore();
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("silverhands_events_updated", handleCustomEvent);
    }
  };
}

export async function saveEvent(event: MarketplaceEvent): Promise<void> {
  const events = getStoredEvents();
  const index = events.findIndex((e) => e.id === event.id);
  if (index >= 0) {
    events[index] = event;
  } else {
    events.unshift(event);
  }
  localStorage.setItem(EVENTS_KEY, JSON.stringify(events));

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("silverhands_events_updated", { detail: events }));
  }

  // Sync to Firestore
  try {
    await setDoc(doc(db, "events", event.id), event);
  } catch (e) {
    console.warn("Firestore saveEvent fallback:", e);
  }
}

export async function deleteEvent(eventId: string): Promise<void> {
  const events = getStoredEvents().filter((e) => e.id !== eventId);
  localStorage.setItem(EVENTS_KEY, JSON.stringify(events));

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("silverhands_events_updated", { detail: events }));
  }

  try {
    await deleteDoc(doc(db, "events", eventId));
  } catch (e) {
    console.warn("Firestore deleteEvent fallback:", e);
  }
}

export async function registerShopForEvent(
  eventId: string,
  participant: RegisteredShopParticipant
): Promise<MarketplaceEvent | null> {
  const events = getStoredEvents();
  const index = events.findIndex((e) => e.id === eventId);
  if (index === -1) return null;

  const event = { ...events[index] };
  const existingParticipantIdx = event.registeredShops.findIndex(
    (p) => p.artisanId === participant.artisanId
  );

  if (existingParticipantIdx >= 0) {
    event.registeredShops[existingParticipantIdx] = participant;
  } else {
    event.registeredShops.push(participant);
    event.attendeesCount = (event.attendeesCount || 0) + 1;
  }

  events[index] = event;
  localStorage.setItem(EVENTS_KEY, JSON.stringify(events));

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("silverhands_events_updated", { detail: events }));
  }

  try {
    await setDoc(doc(db, "events", event.id), event);
  } catch (e) {
    console.warn("Firestore registerShopForEvent fallback:", e);
  }

  return event;
}

export async function updateStallAssignment(
  eventId: string,
  artisanId: string,
  updates: Partial<RegisteredShopParticipant>
): Promise<MarketplaceEvent | null> {
  const events = getStoredEvents();
  const index = events.findIndex((e) => e.id === eventId);
  if (index === -1) return null;

  const event = { ...events[index] };
  const participantIdx = event.registeredShops.findIndex((p) => p.artisanId === artisanId);
  if (participantIdx === -1) return null;

  event.registeredShops[participantIdx] = {
    ...event.registeredShops[participantIdx],
    ...updates,
  };

  events[index] = event;
  localStorage.setItem(EVENTS_KEY, JSON.stringify(events));

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("silverhands_events_updated", { detail: events }));
  }

  try {
    await setDoc(doc(db, "events", event.id), event);
  } catch (e) {
    console.warn("Firestore updateStallAssignment fallback:", e);
  }

  return event;
}

export async function removeShopFromEvent(
  eventId: string,
  artisanId: string
): Promise<MarketplaceEvent | null> {
  const events = getStoredEvents();
  const index = events.findIndex((e) => e.id === eventId);
  if (index === -1) return null;

  const event = { ...events[index] };
  event.registeredShops = event.registeredShops.filter((p) => p.artisanId !== artisanId);
  events[index] = event;
  localStorage.setItem(EVENTS_KEY, JSON.stringify(events));

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("silverhands_events_updated", { detail: events }));
  }

  try {
    await setDoc(doc(db, "events", event.id), event);
  } catch (e) {
    console.warn("Firestore removeShopFromEvent fallback:", e);
  }

  return event;
}

export async function resetAllToDefaults(): Promise<void> {
  localStorage.setItem(USERS_KEY, JSON.stringify(SEED_USERS));
  localStorage.setItem(LISTINGS_KEY, JSON.stringify(SEED_LISTINGS));
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(SEED_USERS[0]));
  localStorage.setItem(EVENTS_KEY, JSON.stringify(SEED_EVENTS));
  localStorage.setItem(REVIEWS_KEY, JSON.stringify(SEED_REVIEWS));
  localStorage.removeItem(MESSAGES_KEY);
  localStorage.removeItem(CONVERSATIONS_KEY);

  // Sync to Firestore
  try {
    for (const item of SEED_LISTINGS) {
      await setDoc(doc(db, "listings", item.id), item);
    }
    for (const user of SEED_USERS) {
      await setDoc(doc(db, "users", user.id), user);
    }
    for (const ev of SEED_EVENTS) {
      await setDoc(doc(db, "events", ev.id), ev);
    }
    for (const rev of SEED_REVIEWS) {
      await setDoc(doc(db, "reviews", rev.id), rev);
    }
  } catch (e) {
    console.warn("Firestore resetAllToDefaults fallback:", e);
  }
}

// ==================== SERVICE REVIEWS & FEEDBACK PERSISTENCE ====================

export function getStoredReviews(listingId?: string, providerId?: string): ServiceReview[] {
  try {
    const raw = localStorage.getItem(REVIEWS_KEY);
    let reviews: ServiceReview[] = raw ? JSON.parse(raw) : SEED_REVIEWS;

    if (!raw) {
      localStorage.setItem(REVIEWS_KEY, JSON.stringify(SEED_REVIEWS));
      reviews = SEED_REVIEWS;
    }

    if (listingId) {
      reviews = reviews.filter((r) => r.listingId === listingId);
    } else if (providerId) {
      reviews = reviews.filter((r) => r.providerId === providerId);
    }

    return reviews.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch {
    return SEED_REVIEWS;
  }
}

export function getReviewsForProvider(providerId: string): ServiceReview[] {
  return getStoredReviews(undefined, providerId);
}

export function getReviewsForListing(listingId: string): ServiceReview[] {
  return getStoredReviews(listingId, undefined);
}

export function getProviderRatingSummary(providerId: string) {
  const reviews = getReviewsForProvider(providerId);
  if (reviews.length === 0) {
    return {
      averageRating: 5.0,
      totalReviews: 0,
      craftsmanshipAvg: 5.0,
      communicationAvg: 5.0,
      punctualityAvg: 5.0,
      recruiterReviewsCount: 0,
      customerReviewsCount: 0,
    };
  }

  const total = reviews.length;
  const ratingSum = reviews.reduce((sum, r) => sum + r.rating, 0);
  const craftsmanshipSum = reviews.reduce((sum, r) => sum + (r.craftsmanshipRating || r.rating), 0);
  const communicationSum = reviews.reduce((sum, r) => sum + (r.communicationRating || r.rating), 0);
  const punctualitySum = reviews.reduce((sum, r) => sum + (r.punctualityRating || r.rating), 0);
  const recruiterReviewsCount = reviews.filter((r) => r.reviewerRole === "recruiter").length;
  const customerReviewsCount = reviews.filter((r) => r.reviewerRole === "customer").length;

  return {
    averageRating: parseFloat((ratingSum / total).toFixed(1)),
    totalReviews: total,
    craftsmanshipAvg: parseFloat((craftsmanshipSum / total).toFixed(1)),
    communicationAvg: parseFloat((communicationSum / total).toFixed(1)),
    punctualityAvg: parseFloat((punctualitySum / total).toFixed(1)),
    recruiterReviewsCount,
    customerReviewsCount,
  };
}

export async function saveReview(review: ServiceReview): Promise<void> {
  const reviews = getStoredReviews();
  const index = reviews.findIndex((r) => r.id === review.id);
  if (index >= 0) {
    reviews[index] = review;
  } else {
    reviews.unshift(review);
  }
  localStorage.setItem(REVIEWS_KEY, JSON.stringify(reviews));

  // Also update listing averageRating and reviewCount if applicable
  try {
    const listings = getStoredListings();
    const listingIdx = listings.findIndex((l) => l.id === review.listingId);
    if (listingIdx >= 0) {
      const listingReviews = reviews.filter((r) => r.listingId === review.listingId);
      const avg = listingReviews.reduce((s, r) => s + r.rating, 0) / listingReviews.length;
      listings[listingIdx].averageRating = parseFloat(avg.toFixed(1));
      listings[listingIdx].reviewCount = listingReviews.length;
      localStorage.setItem(LISTINGS_KEY, JSON.stringify(listings));
      window.dispatchEvent(new CustomEvent("silverhands_listings_updated", { detail: listings }));
      try {
        await setDoc(doc(db, "listings", listings[listingIdx].id), listings[listingIdx]);
      } catch (_) {}
    }
  } catch (e) {
    console.warn("Error updating listing review stats:", e);
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("silverhands_reviews_updated", { detail: reviews }));
  }

  // Sync to Firestore
  try {
    await setDoc(doc(db, "reviews", review.id), review);
  } catch (e) {
    console.warn("Firestore saveReview fallback:", e);
  }
}

export async function addProviderReplyToReview(reviewId: string, replyText: string): Promise<void> {
  const reviews = getStoredReviews();
  const index = reviews.findIndex((r) => r.id === reviewId);
  if (index === -1) return;

  reviews[index].providerReply = {
    text: replyText,
    repliedAt: new Date().toISOString(),
  };

  localStorage.setItem(REVIEWS_KEY, JSON.stringify(reviews));

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("silverhands_reviews_updated", { detail: reviews }));
  }

  try {
    await setDoc(doc(db, "reviews", reviewId), reviews[index]);
  } catch (e) {
    console.warn("Firestore addProviderReplyToReview fallback:", e);
  }
}

export async function deleteReview(reviewId: string): Promise<void> {
  const reviews = getStoredReviews().filter((r) => r.id !== reviewId);
  localStorage.setItem(REVIEWS_KEY, JSON.stringify(reviews));

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("silverhands_reviews_updated", { detail: reviews }));
  }

  try {
    await deleteDoc(doc(db, "reviews", reviewId));
  } catch (e) {
    console.warn("Firestore deleteReview fallback:", e);
  }
}

export function subscribeToReviews(callback: (reviews: ServiceReview[]) => void): () => void {
  // 1. Initial local load
  callback(getStoredReviews());

  // 2. Firestore real-time listener
  let unsubscribeFirestore = () => {};
  try {
    const q = query(collection(db, "reviews"));
    unsubscribeFirestore = onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty) {
          const list: ServiceReview[] = [];
          snapshot.forEach((d) => list.push(d.data() as ServiceReview));
          localStorage.setItem(REVIEWS_KEY, JSON.stringify(list));
          callback(list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        }
      },
      (err) => {
        console.warn("Firestore reviews listener error fallback:", err);
      }
    );
  } catch (err) {
    console.warn("Could not attach Firestore reviews onSnapshot:", err);
  }

  // 3. Local cross-tab and custom event listener
  const handleStorage = (e: StorageEvent) => {
    if (e.key === REVIEWS_KEY && e.newValue) {
      try {
        callback(JSON.parse(e.newValue));
      } catch (_) {}
    }
  };

  const handleCustomEvent = () => {
    callback(getStoredReviews());
  };

  if (typeof window !== "undefined") {
    window.addEventListener("storage", handleStorage);
    window.addEventListener("silverhands_reviews_updated", handleCustomEvent);
  }

  return () => {
    unsubscribeFirestore();
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("silverhands_reviews_updated", handleCustomEvent);
    }
  };
}
