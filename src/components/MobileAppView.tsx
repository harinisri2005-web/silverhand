import React, { useState } from "react";
import {
  Home,
  MapPin,
  PlusCircle,
  MessageSquare,
  User as UserIcon,
  Mic,
  Search,
  Sparkles,
  Compass,
  Repeat,
  GraduationCap,
  Volume2,
  Phone,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Flame,
  ArrowRight,
  Heart,
  CheckCircle2,
  X,
  Store,
  Layers,
  Edit,
} from "lucide-react";
import { User, Listing, GeoLocation, MarketplaceEvent } from "../types";
import { ListingCard } from "./ListingCard";
import { InteractiveMap } from "./InteractiveMap";
import { formatDistance, filterListingsByProximity } from "../services/locationService";
import { ProviderDashboard } from "./ProviderDashboard";
import { AudioPlayerButton } from "./AudioPlayerButton";
import { ClientMessagesPanel } from "./ClientMessagesPanel";
import { startVoiceRecognition, SUPPORTED_SPEECH_LANGUAGES } from "../services/audioService";
import { parseCustomerSearchIntent } from "../services/geminiService";
import { getUnreadMessageCount, subscribeToMessages } from "../services/storageService";

interface MobileAppViewProps {
  currentUser: User | null;
  listings: Listing[];
  userLocation: GeoLocation;
  onContactProvider: (listing: Listing, startWithVoice?: boolean) => void;
  onOpenAuth: () => void;
  onListingCreatedOrUpdated: () => void;
  largeTextMode?: boolean;
  onUpdateUserLocation?: (loc: GeoLocation) => void;
  events?: MarketplaceEvent[];
  onOpenMeetupModal?: () => void;
  onSelectEvent?: (event: MarketplaceEvent) => void;
}

const CATEGORIES = [
  { id: "all", label: "All Crafts", icon: "✨" },
  { id: "repairs_mending", label: "Mending & Zari", icon: "🧵" },
  { id: "traditional_skills", label: "Horology & Clocks", icon: "🕰️" },
  { id: "home_cooking", label: "Artisan Pickles", icon: "🍲" },
  { id: "gardening_botanicals", label: "Herbal Botanicals", icon: "🌿" },
  { id: "handmade_goods", label: "Kantha & Quilts", icon: "🪡" },
];

export const MobileAppView: React.FC<MobileAppViewProps> = ({
  currentUser,
  listings,
  userLocation,
  onContactProvider,
  onOpenAuth,
  onListingCreatedOrUpdated,
  largeTextMode = false,
  onUpdateUserLocation,
  events = [],
  onOpenMeetupModal,
  onSelectEvent,
}) => {
  const [activeTab, setActiveTab] = useState<"feed" | "map" | "create" | "messages" | "profile">("feed");
  const [selectedRadius, setSelectedRadius] = useState<number>(5);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [onlyBarter, setOnlyBarter] = useState(false);
  const [onlyApprentice, setOnlyApprentice] = useState(false);
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [selectedListingForMap, setSelectedListingForMap] = useState<Listing | null>(null);
  const [unreadMessageCount, setUnreadMessageCount] = useState<number>(() =>
    currentUser ? getUnreadMessageCount(currentUser.id) : 0
  );

  React.useEffect(() => {
    if (!currentUser) return;
    const unsub = subscribeToMessages(() => {
      setUnreadMessageCount(getUnreadMessageCount(currentUser.id));
    });
    return unsub;
  }, [currentUser?.id]);

  // Multilingual Speech Recognition for Mobile
  const [speechLanguage, setSpeechLanguage] = useState<string>("auto");
  const [isVoiceListening, setIsVoiceListening] = useState(false);
  const [speechRecognizer, setSpeechRecognizer] = useState<any>(null);
  const [isParsingAI, setIsParsingAI] = useState(false);

  const handleMobileVoiceSearch = () => {
    if (isVoiceListening) {
      if (speechRecognizer) {
        speechRecognizer.stop();
        setSpeechRecognizer(null);
      }
      setIsVoiceListening(false);
    } else {
      setIsVoiceListening(true);
      const recognizer = startVoiceRecognition(
        async (transcript) => {
          setSearchQuery(transcript);
          setIsVoiceListening(false);
          setIsParsingAI(true);
          try {
            const intent = await parseCustomerSearchIntent(transcript);
            if (intent.category && intent.category !== "all") {
              setCategoryFilter(intent.category);
            }
            if (intent.isBarter) setOnlyBarter(true);
            if (intent.requiresApprentice) setOnlyApprentice(true);
            if (intent.maxDistanceKm) setSelectedRadius(intent.maxDistanceKm);
          } catch (e) {
            console.error("AI mobile search failed", e);
          } finally {
            setIsParsingAI(false);
          }
        },
        (err) => {
          console.warn("Mobile speech notice:", err);
          setIsVoiceListening(false);
        },
        speechLanguage
      );
      setSpeechRecognizer(recognizer);
    }
  };

  const proximityListings = filterListingsByProximity(listings, userLocation, selectedRadius);

  const filteredListings = proximityListings.filter((item) => {
    if (categoryFilter !== "all" && item.category !== categoryFilter) return false;
    if (onlyBarter && !item.isBarter) return false;
    if (onlyApprentice && !item.digitalApprenticeEligible) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        (item.title + " " + (item.titleEnglish || "") + " " + item.description).toLowerCase().includes(q) ||
        item.providerName.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  return (
    <div className="w-full min-h-[calc(100vh-80px)] flex justify-center items-start px-0 sm:px-4 py-0 sm:py-6 bg-slate-950/60">
      {/* Mobile Application Canvas - Fluid & Responsive */}
      <div className="w-full max-w-lg bg-slate-950 sm:border-2 sm:border-amber-500/40 sm:rounded-[36px] shadow-2xl overflow-hidden flex flex-col min-h-[840px] text-amber-50 relative">
        
        {/* Native Mobile Status Bar */}
        <div className="bg-slate-950/95 px-5 pt-3 pb-2 flex items-center justify-between text-xs text-slate-400 select-none border-b border-slate-900 sticky top-0 z-30">
          <div className="flex items-center space-x-1.5 font-semibold text-amber-200">
            <span>9:41</span>
          </div>
          <div className="flex items-center space-x-1 bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] text-amber-300 font-medium">Firestore Live</span>
          </div>
          <div className="flex items-center space-x-1.5 text-[11px] text-slate-400">
            <span>5G</span>
            <span>100%</span>
          </div>
        </div>

        {/* Mobile App Header */}
        <div className="bg-slate-900/90 backdrop-blur-md px-4 py-3 border-b border-amber-900/30 flex items-center justify-between sticky top-[33px] z-30">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-slate-950 font-serif font-black text-lg shadow-md border border-amber-300/40">
              SH
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <h1 className="text-base font-bold text-amber-100 font-serif leading-tight">
                  SilverHands
                </h1>
                <span className="text-[10px] px-1.5 py-0.2 bg-amber-500/20 text-amber-300 rounded font-semibold">
                  Mobile
                </span>
              </div>
              <div className="text-[11px] text-amber-300/80 flex items-center space-x-1">
                <MapPin className="w-3 h-3 text-amber-400 flex-shrink-0" />
                <span className="truncate max-w-[150px]">
                  {userLocation.neighborhood || "Heritage Quarter"} • {selectedRadius}km radius
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {currentUser ? (
              <button
                onClick={() => setActiveTab("profile")}
                className="flex items-center space-x-1.5 p-1 rounded-full bg-slate-800 border border-amber-400/50 hover:bg-slate-700"
              >
                <img
                  src={currentUser.avatarUrl}
                  alt={currentUser.fullName}
                  className="w-7 h-7 rounded-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </button>
            ) : (
              <button
                onClick={onOpenAuth}
                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-colors"
              >
                Sign In
              </button>
            )}
          </div>
        </div>

        {/* Mobile Body Content Area */}
        <div className="flex-1 overflow-y-auto pb-24 px-4 pt-4 space-y-4">
          
          {/* TAB 1: FEED / DISCOVER */}
          {activeTab === "feed" && (
            <div className="space-y-4">
              
              {/* Search Bar with Speech Assist & Language Choice */}
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-amber-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={
                      isVoiceListening
                        ? `Listening in ${SUPPORTED_SPEECH_LANGUAGES.find((l) => l.code === speechLanguage)?.name || "selected language"}...`
                        : "Search craft, darning, clocks in any language..."
                    }
                    className={`w-full pl-10 pr-24 py-3 bg-slate-900 border rounded-2xl text-sm text-white placeholder-slate-400 outline-none shadow-inner transition-all ${
                      isVoiceListening
                        ? "border-red-500 bg-red-950/20 text-amber-200"
                        : "border-slate-800 focus:border-amber-500"
                    }`}
                  />
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center space-x-1">
                    <button
                      onClick={handleMobileVoiceSearch}
                      title="Speak in your native language"
                      className={`p-2 rounded-xl transition-all cursor-pointer ${
                        isVoiceListening
                          ? "bg-red-500 text-white animate-pulse shadow-md"
                          : "bg-amber-500/20 text-amber-300 hover:bg-amber-500/30"
                      }`}
                    >
                      <Mic className={`w-3.5 h-3.5 ${isVoiceListening ? "animate-bounce" : ""}`} />
                    </button>
                    <button
                      onClick={() => setShowFiltersModal(!showFiltersModal)}
                      className={`p-2 rounded-xl border ${
                        onlyBarter || onlyApprentice
                          ? "bg-amber-500 text-slate-950 border-amber-400"
                          : "bg-slate-800 text-slate-300 border-slate-700 hover:text-amber-300"
                      }`}
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Multilingual Voice Language Quick Selector */}
                <div className="flex items-center space-x-1.5 overflow-hidden">
                  <span className="text-[10px] text-slate-400 font-semibold flex-shrink-0">Voice Lang:</span>
                  <select
                    value={speechLanguage}
                    onChange={(e) => setSpeechLanguage(e.target.value)}
                    className="bg-slate-900 border border-slate-800 text-[11px] font-bold text-amber-300 rounded-lg px-2 py-1 outline-none cursor-pointer"
                  >
                    {SUPPORTED_SPEECH_LANGUAGES.map((l) => (
                      <option key={l.code} value={l.code} className="bg-slate-900 text-white">
                        {l.nativeName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Clean Proximity Radius Selector - 4-Column Grid (Zero Horizontal Scroll) */}
              <div className="bg-slate-900/90 border border-slate-800 p-2 rounded-2xl">
                <div className="flex items-center justify-between mb-1.5 px-1">
                  <span className="text-[11px] font-bold text-amber-200/80 uppercase tracking-wider">
                    Neighborhood Radius
                  </span>
                  <span className="text-[11px] font-mono text-amber-400 font-bold">
                    Within {selectedRadius} km
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {[1, 3, 5, 10].map((r) => (
                    <button
                      key={r}
                      onClick={() => setSelectedRadius(r)}
                      className={`py-2 rounded-xl text-xs font-bold transition-all text-center cursor-pointer ${
                        selectedRadius === r
                          ? "bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md scale-100 font-mono"
                          : "bg-slate-950 text-slate-300 hover:bg-slate-800 border border-slate-800"
                      }`}
                    >
                      {r} km
                    </button>
                  ))}
                </div>
              </div>

              {/* 2-Column Responsive Category Grid (Zero Horizontal Scroll) */}
              <div>
                <div className="text-[11px] font-bold text-amber-200/80 uppercase tracking-wider mb-2 px-1">
                  Artisan Crafts & Skills
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {CATEGORIES.map((c) => {
                    const isSelected = categoryFilter === c.id;
                    return (
                      <button
                        key={c.id}
                        onClick={() => setCategoryFilter(c.id)}
                        className={`flex items-center space-x-2 p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? "bg-amber-500/20 border-amber-400 text-amber-200 shadow-sm"
                            : "bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700"
                        }`}
                      >
                        <span className="text-lg">{c.icon}</span>
                        <span className="text-xs font-medium truncate leading-tight">
                          {c.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Quick Filter Active Badges */}
              {(onlyBarter || onlyApprentice || searchQuery) && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {searchQuery && (
                    <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs">
                      <span>"{searchQuery}"</span>
                      <button onClick={() => setSearchQuery("")}><X className="w-3 h-3" /></button>
                    </span>
                  )}
                  {onlyBarter && (
                    <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs">
                      <span>Barter Only</span>
                      <button onClick={() => setOnlyBarter(false)}><X className="w-3 h-3" /></button>
                    </span>
                  )}
                  {onlyApprentice && (
                    <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40 text-xs">
                      <span>Digital Apprentice</span>
                      <button onClick={() => setOnlyApprentice(false)}><X className="w-3 h-3" /></button>
                    </span>
                  )}
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setOnlyBarter(false);
                      setOnlyApprentice(false);
                      setCategoryFilter("all");
                    }}
                    className="text-[11px] text-amber-400 hover:underline px-1 font-medium"
                  >
                    Clear all
                  </button>
                </div>
              )}

              {/* Feed Header */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                <h3 className="text-sm font-bold text-amber-100 font-serif">
                  Nearby Artisans ({filteredListings.length})
                </h3>
                <span className="text-[11px] text-slate-400">
                  Sorted by proximity
                </span>
              </div>

              {/* Mobile Listing Cards (Vertical Flow) */}
              <div className="space-y-4">
                {filteredListings.length === 0 ? (
                  <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-3xl space-y-3">
                    <Sparkles className="w-8 h-8 text-amber-400 mx-auto opacity-60" />
                    <h4 className="text-base font-bold text-amber-100">No Listings in this Radius</h4>
                    <p className="text-xs text-slate-400">
                      Try expanding your neighborhood radius to 10 km or clearing category filters.
                    </p>
                    <button
                      onClick={() => {
                        setSelectedRadius(10);
                        setCategoryFilter("all");
                        setSearchQuery("");
                      }}
                      className="px-4 py-2 bg-amber-500 text-slate-950 font-bold rounded-xl text-xs"
                    >
                      Expand to 10km & Reset
                    </button>
                  </div>
                ) : (
                  filteredListings.map((listing) => (
                    <div
                      key={listing.id}
                      className="bg-slate-900 border border-slate-800 hover:border-amber-500/50 rounded-3xl overflow-hidden shadow-lg transition-all text-amber-50 flex flex-col"
                    >
                      {/* Photo Banner with floating badges */}
                      <div className="relative h-48 w-full bg-slate-950 overflow-hidden">
                        <img
                          src={listing.imageUrl}
                          alt={listing.titleEnglish || listing.title}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent" />
                        
                        {/* Distance Badge */}
                        <div className="absolute top-3 left-3 bg-slate-950/90 backdrop-blur-md border border-amber-400/40 text-amber-300 px-3 py-1 rounded-full text-xs font-bold shadow-md flex items-center space-x-1">
                          <MapPin className="w-3.5 h-3.5 text-amber-400" />
                          <span>{formatDistance(listing.distanceKm)}</span>
                        </div>

                        {/* Barter/Price Tag */}
                        <div className="absolute bottom-3 left-3 bg-slate-950/90 backdrop-blur-md border border-amber-500/40 px-3 py-1 rounded-xl">
                          {listing.price > 0 ? (
                            <span className="text-sm font-bold text-amber-300 font-mono">
                              ₹{listing.price.toLocaleString("en-IN")}
                            </span>
                          ) : (
                            <span className="text-xs font-bold text-amber-300">
                              Barter Trade
                            </span>
                          )}
                        </div>

                        {/* Audio Note player right on photo */}
                        <div className="absolute bottom-3 right-3">
                          <AudioPlayerButton
                            voiceNote={listing.voiceNote}
                            fallbackText={listing.description}
                            language={listing.providerLanguage}
                            size="sm"
                            label="Voice Story"
                          />
                        </div>
                      </div>

                      {/* Card Content */}
                      <div className="p-4 space-y-3">
                        {/* Provider Header */}
                        <div className="flex items-center space-x-3">
                          <img
                            src={listing.providerAvatar || listing.imageUrl}
                            alt={listing.providerName}
                            className="w-10 h-10 rounded-full object-cover border border-amber-400 shadow"
                            referrerPolicy="no-referrer"
                          />
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-bold text-amber-100 truncate font-serif">
                              {listing.providerName}
                            </h4>
                            <div className="text-[11px] text-amber-300/80 truncate">
                              {listing.location.neighborhood || "Heritage Quarter"} • {listing.providerLanguage}
                            </div>
                          </div>
                        </div>

                        {/* Title & Description */}
                        <div>
                          <h3 className="text-base font-bold text-amber-100 font-serif leading-snug">
                            {listing.titleEnglish || listing.title}
                          </h3>
                          <p className="text-xs text-slate-300 mt-1 line-clamp-2 leading-relaxed">
                            {listing.descriptionEnglish || listing.description}
                          </p>
                        </div>

                        {/* Special Badges */}
                        <div className="flex flex-wrap gap-1.5">
                          {listing.isBarter && (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-[10px] text-emerald-300 font-medium">
                              <Repeat className="w-3 h-3 text-emerald-400" />
                              <span>Barter Trade Welcome</span>
                            </span>
                          )}
                          {listing.digitalApprenticeEligible && (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg bg-blue-950/60 border border-blue-500/40 text-[10px] text-blue-300 font-medium">
                              <GraduationCap className="w-3 h-3 text-blue-400" />
                              <span>Digital Apprentice</span>
                            </span>
                          )}
                        </div>

                        {/* Action Contact Button Group with Aligned Voice Input and Connect & Message */}
                        <div className="flex items-stretch gap-2 pt-1">
                          <button
                            onClick={() => onContactProvider(listing, false)}
                            className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center space-x-1.5 shadow-md active:scale-98 transition-all cursor-pointer"
                          >
                            <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">Connect & Message</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onContactProvider(listing, true)}
                            className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/40 font-bold text-xs flex items-center justify-center space-x-1 active:scale-98 transition-all cursor-pointer shrink-0"
                            title="Send Voice Message"
                          >
                            <Mic className="w-3.5 h-3.5 shrink-0" />
                            <span className="text-[11px]">Voice</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 2: RADAR MAP */}
          {activeTab === "map" && (
            <div className="h-[680px] flex flex-col space-y-3">
              <div className="bg-slate-900 p-2 rounded-2xl border border-slate-800 flex items-center justify-between">
                <span className="text-xs font-bold text-amber-200">
                  Radar Radius ({selectedRadius}km)
                </span>
                <div className="flex space-x-1">
                  {[1, 3, 5, 10].map((r) => (
                    <button
                      key={r}
                      onClick={() => setSelectedRadius(r)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                        selectedRadius === r
                          ? "bg-amber-500 text-slate-950"
                          : "bg-slate-950 text-slate-300 border border-slate-800"
                      }`}
                    >
                      {r}k
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 rounded-3xl overflow-hidden border border-slate-800">
                <InteractiveMap
                  userLocation={userLocation}
                  listings={filteredListings}
                  selectedListing={selectedListingForMap}
                  onSelectListing={(l) => setSelectedListingForMap(l)}
                  onContactProvider={onContactProvider}
                  radiusKm={selectedRadius}
                  onRadiusChange={setSelectedRadius}
                  onUpdateUserLocation={onUpdateUserLocation}
                  events={events}
                  onSelectEvent={onSelectEvent}
                  onOpenMeetupModal={onOpenMeetupModal}
                />
              </div>
            </div>
          )}

          {/* TAB 3: CREATE / POST ARTISAN CRAFT */}
          {activeTab === "create" && (
            <div className="space-y-4">
              {currentUser ? (
                <ProviderDashboard
                  currentUser={currentUser}
                  listings={listings}
                  onListingCreatedOrUpdated={onListingCreatedOrUpdated}
                  largeTextMode={largeTextMode}
                  onUpdateUserLocation={onUpdateUserLocation}
                  onOpenMeetupModal={onOpenMeetupModal}
                  eventsCount={events.length}
                />
              ) : (
                <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-3xl space-y-4 mt-6">
                  <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mx-auto text-amber-400">
                    <Sparkles className="w-7 h-7" />
                  </div>
                  <h3 className="text-lg font-bold text-amber-100 font-serif">
                    Artisan & Homemaker Portal
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Sign in with your username and 4-digit passcode to record your voice heritage stories, list mending crafts, and connect with neighbors.
                  </p>
                  <button
                    onClick={onOpenAuth}
                    className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-bold rounded-2xl text-sm shadow-lg active:scale-98 transition-all"
                  >
                    Sign In or Create Account
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: CLIENT MESSAGES & INQUIRIES */}
          {activeTab === "messages" && (
            <div className="space-y-4">
              <ClientMessagesPanel
                currentUser={
                  currentUser || {
                    id: "guest",
                    fullName: "Guest Visitor",
                    username: "guest",
                    email: "guest@example.com",
                    phone: "+91 98765 43210",
                    role: "customer",
                    location: {
                      lat: 13.0334,
                      lng: 80.2678,
                      address: "Mylapore Heritage Lane",
                      neighborhood: "Mylapore",
                      city: "Chennai",
                    },
                    preferredLanguage: "English",
                    isElderlyFriendlyMode: true,
                    joinedAt: new Date().toISOString(),
                  }
                }
                isEmbedded={true}
                largeTextMode={largeTextMode}
              />
            </div>
          )}

          {/* TAB 5: PROFILE & SETTINGS */}
          {activeTab === "profile" && (
            <div className="space-y-4">
              {currentUser ? (
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4">
                  <div className="flex items-center space-x-4">
                    <img
                      src={currentUser.avatarUrl}
                      alt={currentUser.fullName}
                      className="w-16 h-16 rounded-2xl object-cover border-2 border-amber-400 shadow-md"
                      referrerPolicy="no-referrer"
                    />
                    <div>
                      <h3 className="text-lg font-bold text-amber-100 font-serif">
                        {currentUser.fullName}
                      </h3>
                      <div className="text-xs text-amber-300 font-mono">
                        @{currentUser.username} • {currentUser.preferredLanguage}
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        Account: <span className="text-amber-400 capitalize font-medium">{currentUser.role}</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 text-xs text-slate-300 space-y-1.5">
                    <div className="flex items-center space-x-1.5">
                      <MapPin className="w-3.5 h-3.5 text-amber-400" />
                      <span>{currentUser.location.address}, {currentUser.location.neighborhood}</span>
                    </div>
                    <div className="text-amber-300">
                      ⭐ {currentUser.rating || 5.0} Community Trust Score ({currentUser.reviewCount || 10} neighbor reviews)
                    </div>
                  </div>

                  <div className="p-3.5 bg-amber-950/40 border border-amber-500/40 rounded-2xl text-xs text-amber-200 flex items-center space-x-2.5">
                    <ShieldCheck className="w-5 h-5 text-amber-400 flex-shrink-0" />
                    <div>
                      <div className="font-bold text-amber-100">Firebase Firestore Connected</div>
                      <div className="text-[11px] text-amber-300/80">
                        Realtime cloud synchronization enabled across web and mobile.
                      </div>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={onOpenAuth}
                      className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-amber-200 rounded-xl text-xs font-bold border border-slate-700 transition-colors"
                    >
                      Switch User Profile
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-3xl space-y-4">
                  <UserIcon className="w-10 h-10 text-amber-400 mx-auto" />
                  <h3 className="text-lg font-bold text-amber-100">Guest Visitor</h3>
                  <p className="text-xs text-slate-400">
                    Sign in to message artisans, save listings, or create your craft profile.
                  </p>
                  <button
                    onClick={onOpenAuth}
                    className="w-full py-3 bg-amber-500 text-slate-950 font-bold rounded-xl text-sm"
                  >
                    Sign In
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Mobile Bottom Dock Navigation Bar - Native App Style */}
        <div className="bg-slate-950/95 backdrop-blur-md border-t border-amber-900/40 px-2 py-2 flex items-center justify-around sticky bottom-0 z-30">
          <button
            onClick={() => setActiveTab("feed")}
            className={`flex flex-col items-center py-1.5 px-2.5 rounded-xl transition-all cursor-pointer ${
              activeTab === "feed"
                ? "text-amber-400 font-bold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Home className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Discover</span>
          </button>

          <button
            onClick={() => setActiveTab("map")}
            className={`flex flex-col items-center py-1.5 px-2.5 rounded-xl transition-all cursor-pointer ${
              activeTab === "map"
                ? "text-amber-400 font-bold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Compass className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Radar</span>
          </button>

          <button
            onClick={() => setActiveTab("create")}
            className="flex flex-col items-center -mt-6 cursor-pointer group"
          >
            <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-amber-500 to-amber-600 group-hover:scale-105 transition-transform flex items-center justify-center text-slate-950 shadow-xl shadow-amber-900/50 border-2 border-amber-300">
              <PlusCircle className="w-6 h-6" />
            </div>
            <span className="text-[10px] text-amber-300 font-bold mt-0.5">Post</span>
          </button>

          <button
            onClick={() => setActiveTab("messages")}
            className={`flex flex-col items-center py-1.5 px-2.5 rounded-xl transition-all cursor-pointer relative ${
              activeTab === "messages"
                ? "text-amber-400 font-bold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <div className="relative">
              <MessageSquare className="w-5 h-5" />
              {unreadMessageCount > 0 && (
                <span className="absolute -top-1.5 -right-2 bg-emerald-500 text-slate-950 text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
                  {unreadMessageCount}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-0.5">Inbox</span>
          </button>

          <button
            onClick={() => setActiveTab("profile")}
            className={`flex flex-col items-center py-1.5 px-2.5 rounded-xl transition-all cursor-pointer ${
              activeTab === "profile"
                ? "text-amber-400 font-bold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <UserIcon className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Profile</span>
          </button>
        </div>

        {/* Filter Sheet Modal */}
        {showFiltersModal && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-40 flex flex-col justify-end">
            <div className="bg-slate-900 border-t-2 border-amber-500 rounded-t-3xl p-5 space-y-4 animate-in slide-in-from-bottom duration-200">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <h3 className="text-base font-bold text-amber-100 font-serif">
                  Filter Artisan Listings
                </h3>
                <button
                  onClick={() => setShowFiltersModal(false)}
                  className="p-1 text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                <label
                  onClick={() => setOnlyBarter(!onlyBarter)}
                  className="flex items-center justify-between p-3 rounded-2xl bg-slate-950 border border-slate-800 cursor-pointer"
                >
                  <div className="flex items-center space-x-2.5">
                    <Repeat className="w-4 h-4 text-emerald-400" />
                    <div>
                      <div className="text-xs font-bold text-amber-100">Barter Trade Exchange</div>
                      <div className="text-[10px] text-slate-400">Open to exchanging services/skills</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={onlyBarter}
                    onChange={() => {}}
                    className="w-4 h-4 accent-amber-500"
                  />
                </label>

                <label
                  onClick={() => setOnlyApprentice(!onlyApprentice)}
                  className="flex items-center justify-between p-3 rounded-2xl bg-slate-950 border border-slate-800 cursor-pointer"
                >
                  <div className="flex items-center space-x-2.5">
                    <GraduationCap className="w-4 h-4 text-blue-400" />
                    <div>
                      <div className="text-xs font-bold text-amber-100">Digital Apprentice Friendly</div>
                      <div className="text-[10px] text-slate-400">Teach youth crafts in exchange for tech help</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={onlyApprentice}
                    onChange={() => {}}
                    className="w-4 h-4 accent-amber-500"
                  />
                </label>
              </div>

              <button
                onClick={() => setShowFiltersModal(false)}
                className="w-full py-3 bg-amber-500 text-slate-950 font-bold rounded-2xl text-xs shadow-md"
              >
                Apply Filters ({filteredListings.length} results)
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
