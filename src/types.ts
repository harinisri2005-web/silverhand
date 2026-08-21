export type UserRole = "provider" | "customer";

export interface GeoLocation {
  lat: number;
  lng: number;
  address?: string;
  neighborhood?: string;
  city?: string;
}

export interface User {
  id: string;
  username: string;
  passcode: string; // 4-digit passcode for accessibility
  fullName: string;
  role: UserRole;
  phone?: string;
  preferredLanguage: string;
  location: GeoLocation;
  bio?: string;
  avatarUrl?: string;
  yearsOfExperience?: number;
  specialtySkills?: string[];
  digitalApprenticeWilling?: boolean; // Willing to mentor youth
  heritageStory?: string;
  rating?: number;
  reviewCount?: number;
  createdAt: string;
}

export type ListingCategory =
  | "handmade_goods"
  | "traditional_skills"
  | "home_cooking"
  | "repairs_mending"
  | "barter_request"
  | "gardening_botanicals";

export interface VoiceNote {
  id?: string;
  audioUrl: string;
  durationSeconds: number;
  recordedAt: string;
  transcript?: string;
  language?: string;
}

export interface VideoDemo {
  id?: string;
  videoUrl: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
  recordedAt?: string;
  title?: string;
  description?: string;
}

export interface Listing {
  id: string;
  providerId: string;
  providerName: string;
  providerAvatar?: string;
  providerLanguage?: string;
  title: string;
  titleEnglish?: string;
  description: string;
  descriptionEnglish?: string;
  category: ListingCategory;
  price: number; // in currency units or 0 for pure barter
  isBarter: boolean;
  barterDetails?: string; // what the senior wants in exchange
  digitalApprenticeEligible: boolean; // youth can learn this craft
  heritageNotes?: string; // generational heritage detail
  tags: string[];
  imageUrl: string;
  videoUrl?: string;
  videoThumbnailUrl?: string;
  videoDurationSeconds?: number;
  videoDemo?: VideoDemo;
  voiceNote?: VoiceNote;
  location: GeoLocation;
  distanceKm?: number; // Calculated dynamically from customer
  available: boolean;
  createdAt: string;
  viewsCount?: number;
  likesCount?: number;
  averageRating?: number;
  reviewCount?: number;
}

export type ReviewerRole = "customer" | "recruiter" | "apprentice";

export interface ServiceReview {
  id: string;
  listingId: string;
  listingTitle?: string;
  providerId: string;
  providerName?: string;
  reviewerId: string;
  reviewerName: string;
  reviewerRole: ReviewerRole;
  reviewerOrganization?: string; // e.g. "Heritage Crafts Foundation", "Metro Artisan Recruiter", "Local Silk Guild"
  reviewerAvatar?: string;
  rating: number; // 1 to 5
  craftsmanshipRating?: number; // 1 to 5
  communicationRating?: number; // 1 to 5
  punctualityRating?: number; // 1 to 5
  title: string;
  comment: string;
  verifiedHire: boolean;
  serviceTypeTag?: string;
  helpfulCount: number;
  createdAt: string;
  providerReply?: {
    text: string;
    repliedAt: string;
  };
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  originalText: string;
  translatedText?: string;
  sourceLanguage: string;
  targetLanguage: string;
  voiceNote?: VoiceNote;
  timestamp: string;
  isRead: boolean;
}

export interface Conversation {
  id: string;
  providerId: string;
  providerName: string;
  providerAvatar?: string;
  providerLanguage?: string;
  customerId: string;
  customerName: string;
  customerAvatar?: string;
  customerPhone?: string;
  customerLocation?: GeoLocation;
  customerLanguage?: string;
  listingId?: string;
  listingTitle?: string;
  listingTitleEnglish?: string;
  listingPrice?: number;
  listingImageUrl?: string;
  isBarter?: boolean;
  barterDetails?: string;
  digitalApprenticeEligible?: boolean;
  lastMessage?: string;
  lastMessageTranslated?: string;
  lastMessageTimestamp: string;
  lastSenderId?: string;
  unreadCount: number;
  hasVoiceNote?: boolean;
  status?: "active" | "replied" | "resolved";
}

export interface CustomerSearchIntent {
  category: ListingCategory | "all";
  keywords: string[];
  maxDistanceKm: number;
  isBarter?: boolean;
  requiresApprentice?: boolean;
  summary: string;
  detectedLanguage?: string;
  translatedEnglishQuery?: string;
}

export interface RegisteredShopParticipant {
  artisanId: string;
  artisanName: string;
  artisanAvatar?: string;
  artisanRole?: UserRole;
  artisanPhone?: string;
  artisanLocation?: GeoLocation; // Location where artisan is traveling from
  shopId?: string; // listingId
  shopTitle: string;
  category: string;
  stallNumber?: string; // e.g. "Stall #1", "Stall A-3"
  stallRequirement?: string; // e.g. "Needs table + power outlet"
  status?: "confirmed" | "pending" | "attended";
  preferredLanguage?: string;
  registeredAt: string;
}

export interface MarketplaceEvent {
  id: string;
  title: string;
  description: string;
  bannerUrl: string;
  date: string; // e.g. "Saturday, Aug 22, 2026"
  time: string; // e.g. "10:00 AM - 6:00 PM"
  locationName: string; // e.g. "Heritage Square Artisan Quadrangle"
  location: GeoLocation;
  organizerId: string;
  organizerName: string;
  organizerAvatar?: string;
  stallsCapacity: number;
  registeredShops: RegisteredShopParticipant[];
  attendeesCount: number;
  tags: string[];
  createdAt: string;
}

