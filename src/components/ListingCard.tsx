import React, { useState } from "react";
import {
  MapPin,
  Sparkles,
  Heart,
  MessageSquare,
  Mic,
  Repeat,
  GraduationCap,
  Volume2,
  Languages,
  Clock,
  Navigation,
  ExternalLink,
  Edit,
  Play,
  Star,
  Building2,
} from "lucide-react";
import { Listing, User } from "../types";
import { formatDistance } from "../services/locationService";
import { AudioPlayerButton } from "./AudioPlayerButton";
import { VideoPlayerModal } from "./VideoPlayerModal";
import { ServiceReviewsModal } from "./ServiceReviewsModal";
import { useLanguage } from "../context/LanguageContext";

interface ListingCardProps {
  listing: Listing;
  onContactProvider: (listing: Listing, startWithVoice?: boolean) => void;
  onSelectOnMap?: (listing: Listing) => void;
  onEditListing?: (listing: Listing) => void;
  isOwner?: boolean;
  largeTextMode?: boolean;
  currentUser?: User;
  onListingUpdated?: () => void;
}

export const ListingCard: React.FC<ListingCardProps> = ({
  listing,
  onContactProvider,
  onSelectOnMap,
  onEditListing,
  isOwner = false,
  largeTextMode = false,
  currentUser,
  onListingUpdated,
}) => {
  const { t, translateListing, language } = useLanguage();
  const [showOriginalLanguage, setShowOriginalLanguage] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [isReviewsModalOpen, setIsReviewsModalOpen] = useState(false);

  // Get auto-translated listing content based on current global language
  const localized = translateListing(listing);

  const displayTitle = showOriginalLanguage ? listing.title : (localized.title || listing.title);
  const displayDescription = showOriginalLanguage ? listing.description : (localized.description || listing.description);
  const displayHeritage = localized.heritageNotes || listing.heritageNotes;
  const displayBarter = localized.barterDetails || listing.barterDetails;

  const hasTranslation =
    Boolean(listing.titleEnglish && listing.titleEnglish !== listing.title) ||
    Boolean(language !== "en");

  const hasVideo = Boolean(listing.videoUrl || listing.videoDemo?.videoUrl);
  const ratingValue = listing.averageRating || 4.9;
  const reviewTotal = listing.reviewCount || 38;

  // Fallback currentUser for guest reviews
  const activeUser: User = currentUser || {
    id: "user_guest_client",
    username: "guest_client",
    fullName: "Neighborhood Client",
    role: "customer",
    location: listing.location,
    avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
    rating: 5.0,
    reviewCount: 0,
    createdAt: new Date().toISOString(),
  };

  return (
    <>
      <div
        id={`listing-${listing.id}`}
        className="group bg-slate-900/90 border-2 border-amber-900/30 hover:border-amber-500/60 rounded-3xl overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-300 flex flex-col text-amber-50 backdrop-blur-sm"
      >
        {/* Cinematic Photographic Hero Image */}
        <div className="relative h-64 w-full overflow-hidden bg-slate-950">
          <img
            src={listing.imageUrl}
            alt={displayTitle}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 filter brightness-95"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />

          {/* Distance Badge (Proximity Segregation) */}
          <div className="absolute top-4 left-4 bg-slate-950/85 backdrop-blur-md border border-amber-400/40 text-amber-300 px-3.5 py-1.5 rounded-full text-xs font-bold shadow-lg flex items-center space-x-1.5">
            <MapPin className="w-4 h-4 text-amber-400" />
            <span>{formatDistance(listing.distanceKm)} {t("card_distance_away", "away")}</span>
          </div>

          {/* Action badges: Video Play, Like & Edit */}
          <div className="absolute top-4 right-4 flex items-center space-x-2">
            {hasVideo && (
              <button
                onClick={() => setIsVideoModalOpen(true)}
                id={`btn-watch-video-${listing.id}`}
                className="px-3 py-1.5 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg backdrop-blur-md transition-all flex items-center space-x-1.5 cursor-pointer border border-amber-300 animate-pulse"
                title={t("card_craft_demo", "Craft Demo")}
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{t("card_craft_demo", "Craft Demo")} ({listing.videoDurationSeconds || listing.videoDemo?.durationSeconds || 45}s)</span>
              </button>
            )}

            {onEditListing && (
              <button
                onClick={() => onEditListing(listing)}
                className="p-2.5 rounded-full bg-slate-950/80 hover:bg-amber-500 text-amber-300 hover:text-slate-950 backdrop-blur-md transition-all shadow-md border border-amber-500/40 cursor-pointer flex items-center space-x-1"
                title={t("card_edit", "Edit")}
              >
                <Edit className="w-3.5 h-3.5" />
                <span className="text-[11px] font-bold pr-1">{t("card_edit", "Edit")}</span>
              </button>
            )}

            <button
              onClick={() => setIsLiked(!isLiked)}
              className={`p-2.5 rounded-full backdrop-blur-md transition-all shadow-md cursor-pointer ${
                isLiked
                  ? "bg-red-500 text-white"
                  : "bg-slate-950/80 text-slate-300 hover:text-red-400"
              }`}
            >
              <Heart className="w-4 h-4 fill-current" />
            </button>
          </div>

          {/* Price / Barter Tag Floating */}
          <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
            <div className="bg-slate-950/90 backdrop-blur-md border border-amber-500/40 px-4 py-1.5 rounded-2xl">
              {listing.price > 0 ? (
                <div className="flex items-baseline space-x-1">
                  <span className="text-xl font-bold text-amber-300 font-mono">
                    ₹{listing.price.toLocaleString("en-IN")}
                  </span>
                  <span className="text-xs text-slate-400">{t("card_per_service", "/ service or item")}</span>
                </div>
              ) : (
                <span className="text-sm font-bold text-amber-300">{t("card_pure_barter", "Pure Barter Trade")}</span>
              )}
            </div>

            {/* Heritage Voice Note Quick Button on Image */}
            <AudioPlayerButton
              voiceNote={listing.voiceNote}
              fallbackText={listing.description}
              language={listing.providerLanguage}
              size="sm"
              label={t("card_artisan_voice", "Artisan Voice")}
            />
          </div>
        </div>

        {/* Card Content */}
        <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
          {/* Provider Profile snippet & Rating badge */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-3">
              <img
                src={listing.providerAvatar || listing.imageUrl}
                alt={listing.providerName}
                className="w-11 h-11 rounded-full object-cover border-2 border-amber-400/80 shadow-md"
                referrerPolicy="no-referrer"
              />
              <div>
                <h4 className="text-base font-bold text-amber-100 font-serif leading-tight">
                  {listing.providerName}
                </h4>
                <div className="text-xs text-amber-300/80 font-medium">
                  {listing.location.neighborhood || "Local District"} • {listing.providerLanguage || "Multilingual"}
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end space-y-1">
              <button
                onClick={() => setIsReviewsModalOpen(true)}
                id={`btn-open-reviews-${listing.id}`}
                className="flex items-center space-x-1.5 bg-amber-950/60 hover:bg-amber-900/70 border border-amber-500/40 px-2.5 py-1 rounded-xl text-xs text-amber-300 font-bold transition-all cursor-pointer shadow-sm"
                title="View customer feedback and recruiter endorsements"
              >
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                <span>{ratingValue}</span>
                <span className="text-[10px] text-slate-400">({reviewTotal})</span>
              </button>

              {hasTranslation && (
                <button
                  onClick={() => setShowOriginalLanguage(!showOriginalLanguage)}
                  title="Toggle Language"
                  className="flex items-center space-x-1 text-[11px] px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 font-medium cursor-pointer"
                >
                  <Languages className="w-3 h-3" />
                  <span>{showOriginalLanguage ? t("card_toggle_english", "Show English") : t("card_toggle_native", "Show Native")}</span>
                </button>
              )}
            </div>
          </div>

          {/* Listing Title & Description */}
          <div className="space-y-2">
            <h3
              className={`font-bold text-amber-50 font-serif leading-snug ${
                largeTextMode ? "text-2xl" : "text-xl"
              }`}
            >
              {displayTitle}
            </h3>
            <p
              className={`text-slate-300 font-normal leading-relaxed ${
                largeTextMode ? "text-lg" : "text-base"
              }`}
            >
              {displayDescription}
            </p>
          </div>

          {/* Generational Heritage Notes */}
          {displayHeritage && (
            <div className="p-3 bg-amber-950/30 border border-amber-600/30 rounded-2xl flex items-start space-x-2.5">
              <Sparkles className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-200/90 italic leading-relaxed">
                "{displayHeritage}"
              </p>
            </div>
          )}

          {/* Badges: Video Verified, Recruiter Scouted, Digital Apprentice */}
          <div className="flex flex-wrap gap-2 pt-1">
            {hasVideo && (
              <button
                onClick={() => setIsVideoModalOpen(true)}
                className="flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-amber-950/70 hover:bg-amber-900/80 border border-amber-400/50 text-amber-200 text-xs font-bold transition-all cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                <span>{t("card_craft_verified", "Craft Video Verified")}</span>
              </button>
            )}

            <button
              onClick={() => setIsReviewsModalOpen(true)}
              className="flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-blue-950/60 hover:bg-blue-900/70 border border-blue-500/40 text-blue-200 text-xs font-bold transition-all cursor-pointer"
            >
              <Building2 className="w-3.5 h-3.5 text-blue-400" />
              <span>{t("card_recruiter_endorsed", "Recruiter Endorsed")}</span>
            </button>

            {listing.digitalApprenticeEligible && (
              <div className="flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-purple-950/60 border border-purple-500/40 text-purple-200 text-xs font-bold">
                <GraduationCap className="w-4 h-4 text-purple-400" />
                <span>{t("card_youth_apprentice_badge", "Youth Apprentice Welcome")}</span>
              </div>
            )}

            {listing.isBarter && (
              <div className="flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-amber-950/60 border border-amber-500/40 text-amber-200 text-xs font-bold">
                <Repeat className="w-4 h-4 text-amber-400" />
                <span>{t("card_barter_badge", "Barter / Skill Exchange")}</span>
              </div>
            )}
          </div>

          {listing.isBarter && displayBarter && (
            <div className="text-xs text-amber-300/80 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
              <span className="font-semibold text-amber-200">{t("card_trade_for", "Willing to trade for:")} </span>
              {displayBarter}
            </div>
          )}

          {/* Tags */}
          {listing.tags && listing.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {listing.tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="text-[11px] px-2.5 py-0.5 rounded-full bg-slate-800/80 text-slate-300 border border-slate-700"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Card Footer Actions */}
          <div className="pt-4 border-t border-slate-800 space-y-3">
            {/* Context, Reviews & Navigation Row */}
            <div className="flex items-center justify-between gap-2 text-xs">
              <button
                onClick={() => setIsReviewsModalOpen(true)}
                id={`btn-card-feedback-${listing.id}`}
                title="View customer feedback and recruiter endorsements"
                className="flex-1 py-2.5 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-amber-300 font-bold border border-amber-500/30 hover:border-amber-400/60 transition-all flex items-center justify-center space-x-1.5 cursor-pointer shadow-sm"
              >
                <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />
                <span className="truncate">{t("card_reviews", "Reviews")} ({reviewTotal})</span>
              </button>

              {onSelectOnMap && (
                <button
                  onClick={() => onSelectOnMap(listing)}
                  title="Pinpoint on Real Interactive Map"
                  className="py-2.5 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-amber-200 font-bold border border-slate-700 hover:border-amber-400/50 transition-all flex items-center justify-center space-x-1.5 cursor-pointer shrink-0 shadow-sm"
                >
                  <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>{t("card_map_pin", "Map")}</span>
                </button>
              )}

              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${listing.location.lat},${listing.location.lng}&travelmode=walking`}
                target="_blank"
                rel="noopener noreferrer"
                title="Open in Google Maps Walking Navigation (Free)"
                className="py-2.5 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-blue-300 hover:text-blue-200 font-semibold border border-slate-700 hover:border-blue-400/50 transition-all flex items-center justify-center space-x-1 shrink-0 shadow-sm"
              >
                <Navigation className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span className="hidden sm:inline">{t("card_directions", "Directions")}</span>
                <ExternalLink className="w-3 h-3 opacity-60 shrink-0" />
              </a>
            </div>

            {/* Primary Candidate Connect & Voice Message Action Bar */}
            <div className="flex items-center gap-2 pt-1">
              {/* Connect & Message Button */}
              <button
                onClick={() => onContactProvider(listing, false)}
                id={`btn-connect-message-${listing.id}`}
                className="flex-1 h-12 px-3 sm:px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs sm:text-sm shadow-md active:scale-[0.98] transition-all flex items-center justify-center space-x-2 cursor-pointer group"
              >
                <MessageSquare className="w-4 h-4 text-slate-950 shrink-0" />
                <span className="truncate">{t("card_connect_message", "Connect & Message")}</span>
              </button>

              {/* Seamlessly Aligned Voice Input / Voice Inquiry Action */}
              <button
                type="button"
                onClick={() => onContactProvider(listing, true)}
                id={`btn-voice-input-${listing.id}`}
                aria-label="Voice Input Message"
                className="h-12 px-3 sm:px-3.5 rounded-xl bg-slate-800 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/40 hover:border-amber-400 shadow-md active:scale-[0.98] transition-all flex items-center justify-center space-x-1.5 cursor-pointer shrink-0 font-bold text-xs group/voice"
                title="Send Voice Message / Audio Note to this artisan"
              >
                <Mic className="w-4 h-4 text-amber-400 group-hover/voice:text-slate-950 shrink-0" />
                <span className="whitespace-nowrap font-bold">{t("card_voice_input", "Voice Input")}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Video Demonstration Player Modal */}
      <VideoPlayerModal
        isOpen={isVideoModalOpen}
        onClose={() => setIsVideoModalOpen(false)}
        listing={listing}
      />

      {/* Customer & Recruiter Feedback / Reviews Modal */}
      <ServiceReviewsModal
        isOpen={isReviewsModalOpen}
        onClose={() => setIsReviewsModalOpen(false)}
        listing={listing}
        currentUser={activeUser}
        onReviewAdded={onListingUpdated}
      />
    </>
  );
};
