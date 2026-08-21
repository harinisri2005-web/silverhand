import React, { useState, useMemo, useEffect } from "react";
import {
  Search,
  Mic,
  MapPin,
  Sparkles,
  Filter,
  Layers,
  Map as MapIcon,
  Grid,
  Volume2,
  Repeat,
  GraduationCap,
  RotateCcw,
  Loader2,
  CheckCircle,
  Compass,
  Radio,
  ChevronRight,
  MessageSquare,
  Phone,
  ArrowRight,
  Clock,
  ShieldCheck,
  Globe,
  SlidersHorizontal,
  Check,
  Plus,
  Minus,
} from "lucide-react";
import {
  Listing,
  ListingCategory,
  GeoLocation,
  CustomerSearchIntent,
  MarketplaceEvent,
  User,
  Conversation,
} from "../types";
import { filterListingsByProximity, formatDistance } from "../services/locationService";
import { parseCustomerSearchIntent } from "../services/geminiService";
import {
  startVoiceRecognition,
  SUPPORTED_SPEECH_LANGUAGES,
  detectLanguageFromText,
} from "../services/audioService";
import {
  getConversationsForUser,
  subscribeToMessages,
  getUnreadMessageCount,
} from "../services/storageService";
import { ListingCard } from "./ListingCard";
import { InteractiveMap } from "./InteractiveMap";
import { ClientMessagesPanel } from "./ClientMessagesPanel";
import { useLanguage } from "../context/LanguageContext";

interface CustomerHomeProps {
  listings: Listing[];
  userLocation: GeoLocation;
  onContactProvider: (listing: Listing, startWithVoice?: boolean) => void;
  onEditListing?: (listing: Listing) => void;
  currentUserId?: string;
  currentUser?: User | null;
  largeTextMode?: boolean;
  onUpdateUserLocation?: (loc: GeoLocation) => void;
  events?: MarketplaceEvent[];
  onOpenMeetupModal?: () => void;
  onSelectEvent?: (event: MarketplaceEvent) => void;
  onOpenMessages?: () => void;
}

export const CustomerHome: React.FC<CustomerHomeProps> = ({
  listings,
  userLocation,
  onContactProvider,
  onEditListing,
  currentUserId,
  currentUser,
  largeTextMode = false,
  onUpdateUserLocation,
  events = [],
  onOpenMeetupModal,
  onSelectEvent,
  onOpenMessages,
}) => {
  const { language, setLanguage, t, translateCategory, supportedLanguages } = useLanguage();

  const [feedTab, setFeedTab] = useState<"craft_feed" | "artisan_messages">("craft_feed");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [radiusKm, setRadiusKm] = useState<number>(5);
  const [customRadiusInput, setCustomRadiusInput] = useState<string>("");
  const [showCustomRadiusSlider, setShowCustomRadiusSlider] = useState<boolean>(false);
  const [barterOnly, setBarterOnly] = useState<boolean>(false);
  const [apprenticeOnly, setApprenticeOnly] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<"split" | "feed" | "map">("split");
  const [selectedListingForMap, setSelectedListingForMap] = useState<Listing | null>(null);

  // Conversations & Provider Replies State
  const effectiveUserId = currentUser?.id || currentUserId || "user_customer_priya";
  const [conversations, setConversations] = useState<Conversation[]>(() =>
    getConversationsForUser(effectiveUserId)
  );
  const [unreadCount, setUnreadCount] = useState<number>(() =>
    getUnreadMessageCount(effectiveUserId)
  );

  // Multilingual Speech Recognition State
  const [speechLanguage, setSpeechLanguage] = useState<string>("auto");
  const [isVoiceListening, setIsVoiceListening] = useState(false);
  const [isParsingAI, setIsParsingAI] = useState(false);
  const [aiIntentResult, setAiIntentResult] = useState<CustomerSearchIntent | null>(null);
  const [speechRecognizer, setSpeechRecognizer] = useState<any>(null);
  const [autoDetectedLangNotice, setAutoDetectedLangNotice] = useState<string | null>(null);

  // Subscribe to live messages so incoming provider replies immediately update the feed panel
  useEffect(() => {
    const updateConversations = () => {
      const convs = getConversationsForUser(effectiveUserId);
      setConversations(convs);
      setUnreadCount(getUnreadMessageCount(effectiveUserId));
    };

    updateConversations();
    const unsubscribe = subscribeToMessages(() => {
      updateConversations();
    });

    return () => {
      unsubscribe();
    };
  }, [effectiveUserId]);

  const effectiveUser: User = currentUser || {
    id: "user_customer_priya",
    fullName: "Priya Sharma",
    phone: "+1 (555) 912-3344",
    role: "customer",
    preferredLanguage: "English",
    avatarUrl:
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80",
    location: {
      lat: userLocation.lat || 13.0827,
      lng: userLocation.lng || 80.2707,
      address: "Flat 4B, Lotus Apartments, 1st Cross Rd",
      neighborhood: "Heritage Quarter / T. Nagar",
      city: "Metro West",
    },
  };

  // Filter listings by proximity first (Haversine formula), then apply intent/keywords
  const proximityFiltered = useMemo(() => {
    return filterListingsByProximity(listings, userLocation, radiusKm);
  }, [listings, userLocation, radiusKm]);

  const finalFilteredListings = useMemo(() => {
    return proximityFiltered.filter((item) => {
      // Category filter
      if (selectedCategory !== "all" && item.category !== selectedCategory) {
        return false;
      }

      // Barter toggle
      if (barterOnly && !item.isBarter) {
        return false;
      }

      // Apprentice toggle
      if (apprenticeOnly && !item.digitalApprenticeEligible) {
        return false;
      }

      // Keyword / Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = (item.title + " " + (item.titleEnglish || "")).toLowerCase().includes(q);
        const matchesDesc = (item.description + " " + (item.descriptionEnglish || "")).toLowerCase().includes(q);
        const matchesProvider = item.providerName.toLowerCase().includes(q);
        const matchesTags = item.tags.some((t) => t.toLowerCase().includes(q));
        const matchesHeritage = (item.heritageNotes || "").toLowerCase().includes(q);

        if (!matchesTitle && !matchesDesc && !matchesProvider && !matchesTags && !matchesHeritage) {
          return false;
        }
      }

      // Intent match if keywords exist
      if (aiIntentResult?.keywords && aiIntentResult.keywords.length > 0) {
        const fullContent = (
          item.title +
          " " +
          (item.titleEnglish || "") +
          " " +
          item.description +
          " " +
          item.tags.join(" ")
        ).toLowerCase();

        const matchCount = aiIntentResult.keywords.filter((kw) =>
          fullContent.includes(kw.toLowerCase())
        ).length;

        if (matchCount === 0 && searchQuery.length > 0) {
          return false;
        }
      }

      return true;
    });
  }, [proximityFiltered, selectedCategory, barterOnly, apprenticeOnly, searchQuery, aiIntentResult]);

  // Handle Search Intent
  const handleAISearch = async (queryText: string) => {
    if (!queryText.trim()) return;

    // Check language of typed/spoken query and auto-switch if needed
    const detected = detectLanguageFromText(queryText);
    if (detected && detected.code !== speechLanguage) {
      setSpeechLanguage(detected.code);
      // Also switch app language if user spoke/typed in a specific script
      const shortLang = detected.code.split("-")[0];
      if (supportedLanguages.some((l) => l.code === shortLang)) {
        setLanguage(shortLang);
      }
      setAutoDetectedLangNotice(`${t("search_auto_detected", "Automatically switched to")} ${detected.nativeName}`);
      setTimeout(() => setAutoDetectedLangNotice(null), 5000);
    }

    setIsParsingAI(true);
    try {
      const intent = await parseCustomerSearchIntent(queryText);
      setAiIntentResult(intent);

      if (intent.category && intent.category !== "all") {
        setSelectedCategory(intent.category);
      }
      if (intent.isBarter) {
        setBarterOnly(true);
      }
      if (intent.requiresApprentice) {
        setApprenticeOnly(true);
      }
      if (intent.maxDistanceKm && intent.maxDistanceKm > 0) {
        setRadiusKm(intent.maxDistanceKm);
      }
    } catch (e) {
      console.error("Search intent parsing error", e);
    } finally {
      setIsParsingAI(false);
    }
  };

  const handleVoiceSearchToggle = () => {
    if (isVoiceListening) {
      if (speechRecognizer) {
        speechRecognizer.stop();
        setSpeechRecognizer(null);
      }
      setIsVoiceListening(false);
    } else {
      setIsVoiceListening(true);
      setAutoDetectedLangNotice(null);

      const recognizer = startVoiceRecognition(
        (transcript) => {
          setSearchQuery(transcript);
          // Check language immediately
          const det = detectLanguageFromText(transcript);
          if (det) {
            setSpeechLanguage(det.code);
            const shortLang = det.code.split("-")[0];
            if (supportedLanguages.some((l) => l.code === shortLang)) {
              setLanguage(shortLang);
            }
            setAutoDetectedLangNotice(`${t("search_auto_detected", "Automatically switched to")} ${det.nativeName}`);
            setTimeout(() => setAutoDetectedLangNotice(null), 5000);
          }
          handleAISearch(transcript);
          setIsVoiceListening(false);
        },
        (err) => {
          console.warn("Speech recognition notice:", err);
          setIsVoiceListening(false);
        },
        speechLanguage,
        (detected) => {
          if (detected.code !== speechLanguage) {
            setSpeechLanguage(detected.code);
            setAutoDetectedLangNotice(`${t("search_auto_detected", "Automatically switched to")} ${detected.nativeName}`);
            setTimeout(() => setAutoDetectedLangNotice(null), 5000);
          }
        }
      );
      setSpeechRecognizer(recognizer);
    }
  };

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedCategory("all");
    setBarterOnly(false);
    setApprenticeOnly(false);
    setAiIntentResult(null);
    setRadiusKm(5);
  };

  const categoryTabs = [
    { id: "all", label: translateCategory("all") },
    { id: "repairs_mending", label: translateCategory("repairs_mending") },
    { id: "traditional_skills", label: translateCategory("traditional_skills") },
    { id: "home_cooking", label: translateCategory("home_cooking") },
    { id: "gardening_botanicals", label: translateCategory("gardening_botanicals") },
    { id: "handmade_goods", label: translateCategory("handmade_goods") },
    { id: "barter_request", label: translateCategory("barter_request") },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 text-amber-50">
      {/* Primary Section Switcher: Neighbours Craft Feed vs Artisan Messages Panel */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/90 p-2 rounded-3xl border border-amber-500/30 shadow-2xl backdrop-blur-md">
        <div className="flex items-center space-x-2">
          <button
            id="feed-tab-crafts-btn"
            onClick={() => setFeedTab("craft_feed")}
            className={`flex items-center space-x-2 px-5 py-3 rounded-2xl font-bold text-sm sm:text-base transition-all cursor-pointer ${
              feedTab === "craft_feed"
                ? "bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-lg shadow-amber-900/40 font-black"
                : "bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800"
            }`}
          >
            <Compass className="w-5 h-5" />
            <span>{t("feed_tab_crafts", "Neighbours Craft Feed")}</span>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-black ${
                feedTab === "craft_feed"
                  ? "bg-slate-950 text-amber-300"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              {listings.length}
            </span>
          </button>

          <button
            id="feed-tab-messages-btn"
            onClick={() => setFeedTab("artisan_messages")}
            className={`flex items-center space-x-2 px-5 py-3 rounded-2xl font-bold text-sm sm:text-base transition-all cursor-pointer relative ${
              feedTab === "artisan_messages"
                ? "bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-lg shadow-amber-900/40 font-black"
                : "bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800"
            }`}
          >
            <MessageSquare className="w-5 h-5" />
            <span>{t("feed_tab_messages", "Artisan Messages & Inquiries")}</span>
            {unreadCount > 0 ? (
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-black text-xs animate-bounce shadow-sm">
                {unreadCount} {t("unread_reply_new", "New")}
              </span>
            ) : (
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  feedTab === "artisan_messages"
                    ? "bg-slate-950 text-amber-300"
                    : "bg-slate-800 text-slate-400"
                }`}
              >
                {conversations.length}
              </span>
            )}
          </button>
        </div>

        {onOpenMeetupModal && events.length > 0 && (
          <button
            onClick={onOpenMeetupModal}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs sm:text-sm font-bold transition-all cursor-pointer shadow-sm"
          >
            <span>🎪 {t("feed_tab_meetups", "Meetups & Bazaars")} ({events.length})</span>
            <ChevronRight className="w-4 h-4 text-amber-400" />
          </button>
        )}
      </div>

      {/* When Artisan Messages Tab is Selected: Render Dedicated Messages Panel */}
      {feedTab === "artisan_messages" ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-slate-900/95 border border-amber-500/30 px-5 py-3.5 rounded-2xl text-xs sm:text-sm shadow-md">
            <div className="flex items-center space-x-2 text-slate-300">
              <span className="text-amber-400 font-bold">💬 {t("hub_title", "Neighbours Communication Hub")}:</span>
              <span>{t("hub_subtitle", "Direct messages, estimates, and voice notes from senior service providers")}</span>
            </div>
            <button
              onClick={() => setFeedTab("craft_feed")}
              className="text-amber-300 hover:text-amber-200 font-bold flex items-center space-x-1.5 cursor-pointer bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-500/20"
            >
              <span>{t("hub_back_to_feed", "Back to Craft Feed")}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <ClientMessagesPanel
            currentUser={effectiveUser}
            isEmbedded={true}
            largeTextMode={largeTextMode}
            onViewListing={(listingId) => {
              setFeedTab("craft_feed");
              const item = listings.find((l) => l.id === listingId);
              if (item) {
                setSelectedListingForMap(item);
                window.scrollTo({ top: 200, behavior: "smooth" });
              }
            }}
          />
        </div>
      ) : (
        /* Craft Feed Content */
        <>
          {/* Unread Provider Reply Notification Banner */}
          {unreadCount > 0 && conversations.length > 0 && (
            <div className="bg-gradient-to-r from-emerald-950/80 via-slate-900 to-amber-950/70 border-2 border-emerald-500/50 rounded-3xl p-4 sm:p-5 shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fadeIn">
              <div className="flex items-center space-x-3.5">
                <div className="relative">
                  {conversations[0].providerAvatar ? (
                    <img
                      src={conversations[0].providerAvatar}
                      alt={conversations[0].providerName}
                      className="w-12 h-12 rounded-2xl object-cover border-2 border-emerald-400 shadow-md"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-2xl bg-emerald-900/50 border border-emerald-400 flex items-center justify-center text-emerald-300 font-bold text-lg">
                      {conversations[0].providerName.charAt(0)}
                    </div>
                  )}
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-400 border-2 border-slate-950 animate-ping" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[11px] font-black uppercase tracking-wider">
                      {t("unread_reply_title", "Provider Reply Received")}
                    </span>
                    <span className="text-xs text-emerald-300 font-semibold">
                      {conversations[0].providerName} {t("unread_reply_subtitle", "sent a reply")}
                    </span>
                  </div>
                  <p className="text-sm text-slate-200 line-clamp-1 mt-0.5 italic">
                    {conversations[0].hasVoiceNote ? "🎙️ " : ""}
                    "{conversations[0].lastMessage || "I can help with your restoration request!"}"
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2 self-end sm:self-center">
                <button
                  id="open-unread-reply-feed-btn"
                  onClick={() => setFeedTab("artisan_messages")}
                  className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm flex items-center space-x-1.5 shadow-lg shadow-emerald-950/50 cursor-pointer transition-all hover:scale-105"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>{t("unread_reply_btn", "View Messages")} ({unreadCount} {t("unread_reply_new", "New")})</span>
                  <ArrowRight className="w-4 h-4 ml-0.5" />
                </button>
              </div>
            </div>
          )}

          {/* Live Neighborhood Activity & Radar Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-900/90 to-amber-950/40 border border-amber-500/30 rounded-3xl p-4 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 backdrop-blur-md">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                <Radio className="w-5 h-5 text-emerald-400 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center space-x-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                    <span>{t("radar_title", "Live Neighborhood Activity Feed")}</span>
                  </span>
                  <span className="text-slate-400 text-xs">• {t("radar_sync", "Real-time Sync Active")}</span>
                </div>
                <p className="text-xs text-slate-300">
                  {t("radar_showing", "Showing")} <span className="text-amber-300 font-bold">{listings.length} {t("radar_active_neighbors", "active neighbors")}</span>
                </p>
              </div>
            </div>

            {/* Quick Click-to-Pin Neighbor Badges */}
            <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar py-1">
              {listings.slice(0, 4).map((l) => (
                <button
                  key={l.id}
                  onClick={() => {
                    setSelectedListingForMap(l);
                    window.scrollTo({ top: 220, behavior: "smooth" });
                  }}
                  className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200 transition-all shrink-0 cursor-pointer shadow-sm hover:border-amber-400"
                >
                  <img
                    src={l.providerAvatar || l.imageUrl}
                    alt={l.providerName}
                    className="w-5 h-5 rounded-full object-cover border border-amber-400/50"
                    referrerPolicy="no-referrer"
                  />
                  <span className="font-semibold">{l.providerName.split(" ")[0]}</span>
                  <span className="text-[10px] text-amber-300 font-mono">({formatDistance(l.distanceKm)})</span>
                </button>
              ))}
            </div>
          </div>

          {/* High-End Production Search Console */}
          <div className="bg-gradient-to-b from-slate-900 via-slate-900/95 to-slate-950 border-2 border-amber-500/30 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-4 backdrop-blur-md">
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
              {/* Main Input */}
              <div className="relative flex-1">
                <Search className="w-6 h-6 absolute left-4 top-1/2 -translate-y-1/2 text-amber-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAISearch(searchQuery);
                  }}
                  placeholder={t("search_placeholder", 'Search e.g. "Find someone who can fix my silk sari nearby" or in your language...')}
                  className="w-full pl-13 pr-16 py-4 bg-slate-800/90 border-2 border-slate-700/80 focus:border-amber-500 rounded-2xl text-base sm:text-lg text-white placeholder-slate-400 outline-none transition-all shadow-inner font-medium"
                />
                {searchQuery && (
                  <button
                    onClick={resetFilters}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs font-bold bg-slate-700 hover:bg-slate-600 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                  >
                    {t("search_clear", "Clear")}
                  </button>
                )}
              </div>

              {/* Voice Search Button with Language Selection */}
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  id="voice-assistant-mic-btn"
                  onClick={handleVoiceSearchToggle}
                  className={`px-5 py-4 rounded-2xl font-bold text-sm sm:text-base shadow-lg transition-all flex items-center justify-center space-x-2 cursor-pointer ${
                    isVoiceListening
                      ? "bg-red-500 text-white animate-pulse shadow-red-900/50"
                      : "bg-slate-800 hover:bg-slate-700 text-amber-300 border-2 border-amber-500/40 hover:border-amber-400"
                  }`}
                  title={t("search_voice_btn", "Voice Search")}
                >
                  <Mic className={`w-5 h-5 ${isVoiceListening ? "animate-bounce text-white" : "text-amber-400"}`} />
                  <span>
                    {isVoiceListening
                      ? t("search_voice_listening", "Listening...")
                      : t("search_voice_btn", "Voice Search")}
                  </span>
                </button>

                {/* Voice Language Selector Dropdown */}
                <div className="bg-slate-800/90 border border-slate-700 rounded-2xl px-3 py-3.5 flex items-center space-x-1.5 text-xs text-amber-300">
                  <span className="text-[11px] text-slate-400 font-semibold hidden sm:inline">
                    {t("search_lang_label", "Lang:")}
                  </span>
                  <select
                    value={speechLanguage}
                    onChange={(e) => {
                      setSpeechLanguage(e.target.value);
                      const short = e.target.value.split("-")[0];
                      if (supportedLanguages.some((l) => l.code === short)) {
                        setLanguage(short);
                      }
                    }}
                    className="bg-transparent text-amber-300 font-bold outline-none cursor-pointer text-xs"
                  >
                    {SUPPORTED_SPEECH_LANGUAGES.map((lang) => (
                      <option key={lang.code} value={lang.code} className="bg-slate-900 text-white">
                        {lang.nativeName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Search trigger button */}
              <button
                type="button"
                onClick={() => handleAISearch(searchQuery)}
                disabled={isParsingAI || !searchQuery.trim()}
                className="px-7 py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-base shadow-lg shadow-amber-900/30 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer transform hover:scale-102"
              >
                {isParsingAI ? (
                  <Loader2 className="w-5 h-5 animate-spin text-slate-950" />
                ) : (
                  <Search className="w-5 h-5 text-slate-950" />
                )}
                <span>{t("search_btn", "Search")}</span>
              </button>
            </div>

            {/* Auto-detected notification banner */}
            {autoDetectedLangNotice && (
              <div className="p-3 bg-amber-950/80 border-2 border-amber-500/70 rounded-2xl text-amber-200 text-xs flex items-center justify-between space-x-2 animate-fadeIn shadow-lg">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0 animate-pulse" />
                  <span className="font-semibold">{autoDetectedLangNotice}</span>
                </div>
                <button
                  onClick={() => setAutoDetectedLangNotice(null)}
                  className="text-amber-400 hover:text-amber-200 text-[11px] font-bold px-2 py-0.5 cursor-pointer"
                >
                  {t("search_dismiss", "Dismiss")}
                </button>
              </div>
            )}

            {/* Multilingual Voice Preset Chips for Quick 1-Tap Search & Language Switch */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-[11px] text-slate-400 font-semibold mr-1">
                {t("search_voice_language", "Voice language:")}
              </span>
              {[
                { code: "ta", speech: "ta-IN", label: "🇮🇳 தமிழ் (Tamil)" },
                { code: "hi", speech: "hi-IN", label: "🇮🇳 हिन्दी (Hindi)" },
                { code: "te", speech: "te-IN", label: "🇮🇳 తెలుగు (Telugu)" },
                { code: "kn", speech: "kn-IN", label: "🇮🇳 ಕನ್ನಡ (Kannada)" },
                { code: "ml", speech: "ml-IN", label: "🇮🇳 മലയാളം (Malayalam)" },
                { code: "bn", speech: "bn-IN", label: "🇮🇳 বাংলা (Bengali)" },
                { code: "mr", speech: "mr-IN", label: "🇮🇳 मराठी (Marathi)" },
                { code: "es", speech: "es-ES", label: "🇪🇸 Español" },
                { code: "en", speech: "en-IN", label: "🇬🇧 English" },
              ].map((l) => (
                <button
                  key={l.code}
                  onClick={() => {
                    setLanguage(l.code);
                    setSpeechLanguage(l.speech);
                  }}
                  className={`px-3 py-1 rounded-xl text-[11px] font-bold transition-all border cursor-pointer ${
                    language === l.code
                      ? "bg-amber-500 text-slate-950 border-amber-300 font-black shadow-md"
                      : "bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700"
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>

            {/* Search Intent Feedback Badge */}
            {aiIntentResult && (
              <div className="p-3.5 bg-amber-950/50 border border-amber-500/50 rounded-2xl flex items-center justify-between animate-fadeIn text-sm shadow-md">
                <div className="flex items-center space-x-2 text-amber-200">
                  <Compass className="w-5 h-5 text-amber-400 flex-shrink-0" />
                  <span>
                    <strong className="text-amber-300">{t("search_filter_applied", "Filter Applied:")}</strong>{" "}
                    {aiIntentResult.summary}
                  </span>
                </div>
                <button
                  onClick={() => setAiIntentResult(null)}
                  className="text-xs text-amber-400 hover:underline font-bold ml-4 cursor-pointer"
                >
                  {t("search_reset_filter", "Reset Filter")}
                </button>
              </div>
            )}

            {/* Quick Radius & Tag Filters */}
            <div className="space-y-2 pt-3 border-t border-slate-800/80">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Proximity Radius Controls (Presets + Custom Distance Input + Slider Toggle) */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                    <Compass className="w-4 h-4 text-amber-400" />
                    <span>{t("search_proximity_radius", "Proximity Radius:")}</span>
                  </span>

                  {/* Preset Buttons */}
                  <div className="flex items-center space-x-1">
                    {[1, 3, 5, 10, 20].map((r) => (
                      <button
                        key={r}
                        onClick={() => {
                          setRadiusKm(r);
                          setCustomRadiusInput("");
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                          radiusKm === r
                            ? "bg-amber-500 text-slate-950 shadow-md font-mono scale-105"
                            : "bg-slate-800 text-slate-300 hover:text-white border border-slate-700 hover:bg-slate-700"
                        }`}
                      >
                        {r} {t("common_km", "km")}
                      </button>
                    ))}
                  </div>

                  {/* Custom Distance Enter Option right near existing options */}
                  <div className="flex items-center space-x-1 bg-slate-900/95 p-1 pl-2.5 rounded-xl border border-slate-700/80 focus-within:border-amber-400 transition-all shadow-inner">
                    <span className="text-[11px] text-slate-400 font-semibold whitespace-nowrap hidden sm:inline">
                      {t("search_custom_radius", "Custom")}:
                    </span>
                    <div className="relative flex items-center">
                      <input
                        id="custom-proximity-distance-input"
                        type="number"
                        min="0.5"
                        max="500"
                        step="any"
                        value={customRadiusInput}
                        onChange={(e) => setCustomRadiusInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            const val = parseFloat(customRadiusInput);
                            if (!isNaN(val) && val > 0) {
                              const cleanVal = Math.min(500, Math.max(0.5, Math.round(val * 10) / 10));
                              setRadiusKm(cleanVal);
                            }
                          }
                        }}
                        placeholder={![1, 3, 5, 10, 20].includes(radiusKm) ? String(radiusKm) : t("search_enter_distance_placeholder", "e.g. 15")}
                        className={`w-16 sm:w-20 px-2 py-1 bg-slate-950 text-amber-200 text-xs font-mono font-bold rounded-lg border outline-none text-center transition-all ${
                          ![1, 3, 5, 10, 20].includes(radiusKm) && radiusKm > 0
                            ? "border-amber-400 text-amber-300 ring-1 ring-amber-400/40 bg-amber-950/40"
                            : "border-slate-700 focus:border-amber-400"
                        }`}
                        title={t("search_enter_distance", "Enter km distance")}
                      />
                      <span className="text-[11px] text-slate-400 font-mono font-bold ml-1.5 mr-1">
                        {t("common_km", "km")}
                      </span>
                    </div>

                    {/* Apply / Set Button */}
                    <button
                      type="button"
                      id="btn-apply-custom-distance"
                      onClick={() => {
                        const val = parseFloat(customRadiusInput);
                        if (!isNaN(val) && val > 0) {
                          const cleanVal = Math.min(500, Math.max(0.5, Math.round(val * 10) / 10));
                          setRadiusKm(cleanVal);
                        }
                      }}
                      disabled={!customRadiusInput || isNaN(parseFloat(customRadiusInput)) || parseFloat(customRadiusInput) <= 0}
                      className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-black text-xs transition-all flex items-center space-x-1 cursor-pointer disabled:cursor-not-allowed shadow-sm"
                      title={t("search_apply", "Set Radius")}
                    >
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span className="text-[11px] font-black hidden sm:inline">{t("search_apply", "Set")}</span>
                    </button>

                    {/* Toggle Range Slider */}
                    <button
                      type="button"
                      id="btn-toggle-proximity-slider"
                      onClick={() => setShowCustomRadiusSlider(!showCustomRadiusSlider)}
                      className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                        showCustomRadiusSlider
                          ? "bg-amber-500/20 text-amber-300 border-amber-400"
                          : "bg-slate-800 text-slate-400 hover:text-slate-200 border-slate-700 hover:bg-slate-700"
                      }`}
                      title={t("search_radius_slider", "Radius Slider")}
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Active indicator when non-preset custom value is applied */}
                  {![1, 3, 5, 10, 20].includes(radiusKm) && (
                    <span className="px-2.5 py-1 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-400/50 text-xs font-mono font-bold flex items-center space-x-1 animate-fadeIn">
                      <span>✨ {radiusKm} {t("common_km", "km")} {t("radar_title", "").includes("செயலில்") ? "செயலில்" : "active"}</span>
                    </span>
                  )}
                </div>

                {/* Barter & Apprentice quick toggles */}
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setBarterOnly(!barterOnly)}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      barterOnly
                        ? "bg-amber-500/30 text-amber-200 border-amber-400 shadow-md"
                        : "bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200"
                    }`}
                  >
                    <Repeat className="w-3.5 h-3.5 text-amber-400" />
                    <span>{t("search_barter_friendly", "Barter Friendly")}</span>
                  </button>

                  <button
                    onClick={() => setApprenticeOnly(!apprenticeOnly)}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      apprenticeOnly
                        ? "bg-purple-500/30 text-purple-200 border-purple-400 shadow-md"
                        : "bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200"
                    }`}
                  >
                    <GraduationCap className="w-3.5 h-3.5 text-purple-400" />
                    <span>{t("search_youth_apprentice", "Youth Apprenticeship")}</span>
                  </button>
                </div>

                {/* Layout View Mode Switcher on Desktop */}
                <div className="hidden lg:flex items-center bg-slate-800/90 p-1 rounded-xl border border-slate-700">
                  <button
                    onClick={() => setViewMode("split")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      viewMode === "split"
                        ? "bg-amber-500 text-slate-950 font-black shadow"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {t("search_view_split", "Split Map & Feed")}
                  </button>
                  <button
                    onClick={() => setViewMode("feed")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      viewMode === "feed"
                        ? "bg-amber-500 text-slate-950 font-black shadow"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {t("search_view_feed", "Feed Only")}
                  </button>
                  <button
                    onClick={() => setViewMode("map")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      viewMode === "map"
                        ? "bg-amber-500 text-slate-950 font-black shadow"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {t("search_view_map", "Radar Map")}
                  </button>
                </div>
              </div>

              {/* Dynamic Proximity Radius Slider & Quick Expand Controls */}
              {showCustomRadiusSlider && (
                <div className="w-full p-3.5 bg-slate-950/95 border-2 border-amber-500/40 rounded-2xl animate-fadeIn flex flex-col md:flex-row items-center justify-between gap-3 shadow-xl">
                  <div className="flex items-center space-x-2 text-xs text-amber-300 font-bold shrink-0">
                    <Compass className="w-4 h-4 text-amber-400" />
                    <span>{t("search_expand_distance", "Expand Radius")}:</span>
                    <span className="px-2.5 py-0.5 rounded-lg bg-amber-500 text-slate-950 font-mono font-black text-xs shadow-sm">
                      {radiusKm} {t("common_km", "km")}
                    </span>
                  </div>

                  <div className="flex-1 w-full flex items-center space-x-3 max-w-md">
                    <span className="text-[10px] text-slate-400 font-mono">0.5km</span>
                    <input
                      id="proximity-radius-range-slider"
                      type="range"
                      min="0.5"
                      max="100"
                      step="0.5"
                      value={radiusKm}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setRadiusKm(val);
                        setCustomRadiusInput(String(val));
                      }}
                      className="w-full accent-amber-500 cursor-pointer h-2 bg-slate-800 rounded-lg appearance-none"
                    />
                    <span className="text-[10px] text-slate-400 font-mono">100km+</span>
                  </div>

                  <div className="flex items-center space-x-1.5 flex-wrap">
                    <button
                      onClick={() => {
                        const next = Math.max(0.5, Math.round((radiusKm - 1) * 10) / 10);
                        setRadiusKm(next);
                        setCustomRadiusInput(String(next));
                      }}
                      className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700 cursor-pointer transition-colors"
                      title="Decrease 1 km"
                    >
                      -1 km
                    </button>
                    <button
                      onClick={() => {
                        const next = Math.round((radiusKm + 1) * 10) / 10;
                        setRadiusKm(next);
                        setCustomRadiusInput(String(next));
                      }}
                      className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700 cursor-pointer transition-colors"
                      title="Increase 1 km"
                    >
                      +1 km
                    </button>
                    <button
                      onClick={() => {
                        const next = Math.round((radiusKm + 5) * 10) / 10;
                        setRadiusKm(next);
                        setCustomRadiusInput(String(next));
                      }}
                      className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-bold border border-slate-700 cursor-pointer transition-colors"
                      title="Expand 5 km"
                    >
                      +5 km
                    </button>
                    <button
                      onClick={() => {
                        const next = Math.round((radiusKm + 20) * 10) / 10;
                        setRadiusKm(next);
                        setCustomRadiusInput(String(next));
                      }}
                      className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold border border-amber-500/40 cursor-pointer transition-colors"
                      title="Expand 20 km"
                    >
                      +20 km
                    </button>
                    <button
                      onClick={() => {
                        const next = Math.round((radiusKm + 50) * 10) / 10;
                        setRadiusKm(next);
                        setCustomRadiusInput(String(next));
                      }}
                      className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-black shadow-md cursor-pointer transition-transform hover:scale-105"
                      title="Expand 50 km"
                    >
                      +50 km
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Category Pills - Clean Flex Wrap for No Horizontal Scrolling */}
          <div className="flex flex-wrap items-center gap-2">
            {categoryTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedCategory(tab.id)}
                className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all border cursor-pointer shadow-sm ${
                  selectedCategory === tab.id
                    ? "bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 border-amber-300 shadow-lg shadow-amber-900/20 font-black scale-102"
                    : "bg-slate-900/90 text-slate-300 border-slate-800 hover:bg-slate-800 hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Result Status Header */}
          <div className="flex items-center justify-between text-sm text-slate-400 px-1">
            <div>
              {t("results_showing", "Showing")}{" "}
              <span className="text-amber-300 font-bold">{finalFilteredListings.length}</span>{" "}
              {t("results_artisans_within", "senior artisans & homemade goods within")}{" "}
              <span className="text-amber-300 font-bold font-mono">{radiusKm} {t("common_km", "km")}</span>
            </div>
            {(searchQuery || selectedCategory !== "all" || barterOnly || apprenticeOnly) && (
              <button
                onClick={resetFilters}
                className="flex items-center space-x-1.5 text-xs text-amber-400 hover:underline font-bold cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{t("search_reset_all", "Reset all filters")}</span>
              </button>
            )}
          </div>

          {/* Main Responsive Layout: Split or Single View */}
          {viewMode === "split" ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left Column: Interactive Map */}
              <div className="lg:col-span-5 lg:sticky lg:top-24 space-y-4">
                <InteractiveMap
                  userLocation={userLocation}
                  listings={finalFilteredListings}
                  selectedListing={selectedListingForMap}
                  onSelectListing={(l) => setSelectedListingForMap(l)}
                  onContactProvider={onContactProvider}
                  radiusKm={radiusKm}
                  onRadiusChange={setRadiusKm}
                  onUpdateUserLocation={onUpdateUserLocation}
                  events={events}
                  onSelectEvent={onSelectEvent}
                  onOpenMeetupModal={onOpenMeetupModal}
                />
              </div>

              {/* Right Column: Listing Cards Feed */}
              <div className="lg:col-span-7 space-y-6">
                {/* Upcoming Marketplace Meetups Highlight Card */}
                {events.length > 0 && onOpenMeetupModal && (
                  <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-950/60 via-slate-900 to-amber-950/40 border-2 border-amber-500/40 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xl backdrop-blur-md">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-2xl shrink-0 shadow-inner">
                        🎪
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-black uppercase tracking-wider text-amber-400">
                            {t("meetup_spotlight_title", "Community Meetup & Bazaar")}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                            {events[0].registeredShops.length}/{events[0].stallsCapacity} {t("meetup_stalls_booked", "STALLS BOOKED")}
                          </span>
                        </div>
                        <h4 className="text-sm sm:text-base font-bold text-white font-serif">
                          {events[0].title}
                        </h4>
                        <p className="text-xs text-slate-300">
                          📍 {events[0].locationName || events[0].location.neighborhood} • ⏰ {events[0].date} ({events[0].time})
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => (onSelectEvent ? onSelectEvent(events[0]) : onOpenMeetupModal())}
                      className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs shadow-lg shadow-amber-950/50 flex items-center space-x-1.5 whitespace-nowrap cursor-pointer transition-all hover:scale-105 self-end sm:self-center"
                    >
                      <span>{t("meetup_register_view", "Register Shop / View")}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-950" />
                    </button>
                  </div>
                )}

                {finalFilteredListings.length === 0 ? (
                  <div className="p-12 text-center bg-slate-900/60 border-2 border-dashed border-slate-800 rounded-3xl space-y-4">
                    <Compass className="w-12 h-12 text-amber-400 mx-auto opacity-70 animate-spin-slow" />
                    <h3 className="text-xl font-bold text-amber-100 font-serif">
                      {t("results_empty_title", "No artisans found within")} {radiusKm} {t("common_km", "km")}
                    </h3>
                    <p className="text-slate-400 max-w-md mx-auto text-sm">
                      {t("results_empty_subtitle", "Try expanding your proximity radar or searching for a different craft category.")}
                    </p>
                    <button
                      onClick={() => {
                        const next = radiusKm < 10 ? 10 : radiusKm < 25 ? 25 : radiusKm + 25;
                        setRadiusKm(next);
                        setCustomRadiusInput(String(next));
                      }}
                      className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm shadow-md transition-transform hover:scale-105 cursor-pointer"
                    >
                      {t("results_expand_radar", "Expand Radar")} (+{radiusKm < 10 ? 10 - radiusKm : 15} km)
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {finalFilteredListings.map((listing) => (
                      <ListingCard
                        key={listing.id}
                        listing={listing}
                        currentUser={effectiveUser}
                        onContactProvider={onContactProvider}
                        onEditListing={onEditListing}
                        isOwner={currentUserId === listing.providerId}
                        onSelectOnMap={(l) => {
                          setSelectedListingForMap(l);
                          window.scrollTo({ top: 150, behavior: "smooth" });
                        }}
                        largeTextMode={largeTextMode}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : viewMode === "feed" ? (
            /* Feed Only Mode (3-column responsive grid) */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {finalFilteredListings.map((listing) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  currentUser={effectiveUser}
                  onContactProvider={onContactProvider}
                  onEditListing={onEditListing}
                  isOwner={currentUserId === listing.providerId}
                  largeTextMode={largeTextMode}
                />
              ))}
            </div>
          ) : (
            /* Map Only Mode */
            <div className="w-full">
              <InteractiveMap
                userLocation={userLocation}
                listings={finalFilteredListings}
                selectedListing={selectedListingForMap}
                onSelectListing={(l) => setSelectedListingForMap(l)}
                onContactProvider={onContactProvider}
                radiusKm={radiusKm}
                onRadiusChange={setRadiusKm}
                onUpdateUserLocation={onUpdateUserLocation}
                events={events}
                onSelectEvent={onSelectEvent}
                onOpenMeetupModal={onOpenMeetupModal}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
};
