import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  PlusCircle,
  Mic,
  Languages,
  Tag,
  Repeat,
  GraduationCap,
  Volume2,
  Trash2,
  Edit,
  Eye,
  CheckCircle,
  Clock,
  HeartHandshake,
  DollarSign,
  Image as ImageIcon,
  Loader2,
  AlertCircle,
  MapPin,
  Compass,
  Navigation,
  LocateFixed,
  Building2,
  X,
  MessageSquare,
  Play,
  Video,
  Film,
  Star,
  Award,
  ShieldCheck,
  HelpCircle,
  ChevronRight,
  ThumbsUp,
  Upload,
  HardDrive,
  FileVideo,
  Camera,
} from "lucide-react";
import { Listing, ListingCategory, User, VoiceNote, GeoLocation, VideoDemo, ServiceReview } from "../types";
import { generateProviderListing, transliterateToNative, translateMessage } from "../services/geminiService";
import { AudioVoiceRecorder } from "./AudioVoiceRecorder";
import { AudioPlayerButton } from "./AudioPlayerButton";
import { ClientMessagesPanel } from "./ClientMessagesPanel";
import { VideoRecorderModal } from "./VideoRecorderModal";
import { VideoPlayerModal } from "./VideoPlayerModal";
import { ServiceReviewsModal } from "./ServiceReviewsModal";
import { ConversationalListingAssistant } from "./ConversationalListingAssistant";
import { processLocalVideoFile } from "../utils/videoUtils";
import {
  saveListing,
  deleteListing,
  saveUser,
  setCurrentUser,
  getUnreadMessageCount,
  subscribeToMessages,
  CRAFT_VIDEO_PRESETS,
  getStoredReviews,
  getProviderRatingSummary,
  addProviderReplyToReview,
} from "../services/storageService";
import {
  getDetailedSystemLocation,
  POPULAR_NEIGHBORHOOD_PRESETS,
} from "../services/locationService";
import {
  getLanguageCode,
  detectLanguageFromText,
  SUPPORTED_SPEECH_LANGUAGES,
  LiveVoiceTranscriber,
} from "../services/audioService";

interface ProviderDashboardProps {
  currentUser: User;
  listings: Listing[];
  onListingCreatedOrUpdated: () => void;
  largeTextMode?: boolean;
  onUpdateUserLocation?: (location: GeoLocation) => void;
  onUpdateCurrentUser?: (user: User) => void;
  onOpenMeetupModal?: () => void;
  eventsCount?: number;
}

export const ProviderDashboard: React.FC<ProviderDashboardProps> = ({
  currentUser,
  listings,
  onListingCreatedOrUpdated,
  largeTextMode = false,
  onUpdateUserLocation,
  onUpdateCurrentUser,
  onOpenMeetupModal,
  eventsCount = 0,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [creationMode, setCreationMode] = useState<"choice" | "manual" | "conversational">("choice");
  const [editingListingId, setEditingListingId] = useState<string | null>(null);
  const [rawInput, setRawInput] = useState("");
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [voiceNote, setVoiceNote] = useState<VoiceNote | null>(null);

  // Artisan Studio / Workshop Location State
  const [artisanLocation, setArtisanLocation] = useState<GeoLocation>(currentUser.location);
  const [listingLocation, setListingLocation] = useState<GeoLocation>(currentUser.location);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [locationPromptDismissed, setLocationPromptDismissed] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);

  // Multilingual Curation & Transliteration State (English, Tamil, Hindi, etc.)
  const [curationLanguage, setCurationLanguage] = useState<string>(
    currentUser.preferredLanguage || "English"
  );
  const [isTransliterating, setIsTransliterating] = useState(false);
  const [isTextareaMicActive, setIsTextareaMicActive] = useState(false);
  const textareaTranscriberRef = useRef<LiveVoiceTranscriber>(new LiveVoiceTranscriber());

  // Cleanup speech transcriber on unmount
  useEffect(() => {
    return () => {
      textareaTranscriberRef.current.abort();
    };
  }, []);

  // Location Editor Form State
  const [customAddress, setCustomAddress] = useState(currentUser.location.address || "");
  const [customNeighborhood, setCustomNeighborhood] = useState(currentUser.location.neighborhood || "");
  const [customCity, setCustomCity] = useState(currentUser.location.city || "Metro West");
  const [customLat, setCustomLat] = useState<number>(currentUser.location.lat);
  const [customLng, setCustomLng] = useState<number>(currentUser.location.lng);

  // Form Fields (prefilled or edited after AI curation)
  const [title, setTitle] = useState("");
  const [titleEnglish, setTitleEnglish] = useState("");
  const [description, setDescription] = useState("");
  const [descriptionEnglish, setDescriptionEnglish] = useState("");
  const [isTranslatingTitle, setIsTranslatingTitle] = useState(false);
  const [isTranslatingDesc, setIsTranslatingDesc] = useState(false);
  const [category, setCategory] = useState<ListingCategory>("handmade_goods");
  const [price, setPrice] = useState<number>(350);
  const [isBarter, setIsBarter] = useState<boolean>(true);
  const [barterDetails, setBarterDetails] = useState<string>("");
  const [digitalApprenticeEligible, setDigitalApprenticeEligible] = useState<boolean>(true);
  const [heritageNotes, setHeritageNotes] = useState<string>("");
  const [tagsInput, setTagsInput] = useState<string>("");
  const [imageUrl, setImageUrl] = useState<string>(
    "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=800&q=80"
  );
  const [videoDemo, setVideoDemo] = useState<VideoDemo | null>(null);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [videoModalTab, setVideoModalTab] = useState<"preset" | "camera" | "upload">("upload");
  const [showVideoRequirementPrompt, setShowVideoRequirementPrompt] = useState(false);
  const [isProcessingDirectVideo, setIsProcessingDirectVideo] = useState(false);
  const [isDraggingListingVideo, setIsDraggingListingVideo] = useState(false);
  const directVideoInputRef = useRef<HTMLInputElement | null>(null);
  const promptVideoInputRef = useRef<HTMLInputElement | null>(null);
  const [activeVideoModalListing, setActiveVideoModalListing] = useState<Listing | null>(null);
  const [activeReviewsListing, setActiveReviewsListing] = useState<Listing | null>(null);

  // Direct device video processing handler
  const handleDirectDeviceVideo = async (file: File) => {
    if (!file || !file.type.startsWith("video/")) {
      setToastMessage("⚠️ Please select a valid video file (.mp4, .webm, .mov, etc.)");
      setTimeout(() => setToastMessage(null), 4000);
      return;
    }
    setIsProcessingDirectVideo(true);
    try {
      const processed = await processLocalVideoFile(file);
      const newVideoDemo: VideoDemo = {
        id: `vd_${Date.now()}`,
        videoUrl: processed.videoUrl,
        thumbnailUrl: processed.thumbnailUrl,
        durationSeconds: processed.durationSeconds,
        title: `${currentUser.fullName}'s ${processed.fileName} Demonstration`,
        description: `Hands-on craftsmanship demonstration for ${title || "artisan service"}`,
        recordedAt: new Date().toISOString(),
      };
      setVideoDemo(newVideoDemo);
      setToastMessage(`🎬 Video attached from device: ${processed.fileName} (${processed.durationSeconds}s)!`);
      setTimeout(() => setToastMessage(null), 4500);
    } catch (err) {
      console.warn("Direct video processing error:", err);
      const fallbackUrl = URL.createObjectURL(file);
      setVideoDemo({
        id: `vd_${Date.now()}`,
        videoUrl: fallbackUrl,
        thumbnailUrl: imageUrl,
        durationSeconds: 30,
        title: `${currentUser.fullName}'s Craft Demonstration`,
        description: `Craft demonstration for ${title || "artisan service"}`,
        recordedAt: new Date().toISOString(),
      });
      setToastMessage("🎬 Video attached from device!");
      setTimeout(() => setToastMessage(null), 4000);
    } finally {
      setIsProcessingDirectVideo(false);
    }
  };

  // Reviews & Recruiter Feedback state
  const [reviewsList, setReviewsList] = useState<ServiceReview[]>(() => getStoredReviews());
  const [replyTextMap, setReplyTextMap] = useState<Record<string, string>>({});
  const [replyingToReviewId, setReplyingToReviewId] = useState<string | null>(null);
  const [activeReviewFilter, setActiveReviewFilter] = useState<"all" | "recruiter" | "customer">("all");

  const [aiSuccessBadge, setAiSuccessBadge] = useState<string | null>(null);
  const [listingToDelete, setListingToDelete] = useState<Listing | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Dashboard Active Tab & Unread Inquiries Notification
  const [activeDashboardTab, setActiveDashboardTab] = useState<"listings" | "messages" | "reviews">("listings");
  const [unreadMessageCount, setUnreadMessageCount] = useState<number>(() =>
    getUnreadMessageCount(currentUser.id)
  );

  useEffect(() => {
    const unsub = subscribeToMessages(() => {
      setUnreadMessageCount(getUnreadMessageCount(currentUser.id));
    });
    return unsub;
  }, [currentUser.id]);

  useEffect(() => {
    const updateReviews = () => {
      setReviewsList(getStoredReviews());
    };
    window.addEventListener("silverhands_reviews_updated", updateReviews);
    return () => {
      window.removeEventListener("silverhands_reviews_updated", updateReviews);
    };
  }, []);

  const providerListings = listings.filter((l) => l.providerId === currentUser.id);
  const providerReviews = reviewsList.filter((r) => r.providerId === currentUser.id);
  const providerRatingSummary = getProviderRatingSummary(currentUser.id);

  // Keep local location state synced if currentUser changes
  useEffect(() => {
    if (currentUser.location) {
      setArtisanLocation(currentUser.location);
      setCustomAddress(currentUser.location.address || "");
      setCustomNeighborhood(currentUser.location.neighborhood || "");
      setCustomCity(currentUser.location.city || "Metro West");
      setCustomLat(currentUser.location.lat);
      setCustomLng(currentUser.location.lng);
    }
  }, [currentUser]);

  // Handle GPS location detection for the Artisan's studio
  const handleDetectArtisanGps = async () => {
    setIsDetectingLocation(true);
    try {
      const result = await getDetailedSystemLocation();
      if (result.isGpsAccurate) {
        const newLocation: GeoLocation = result.location;
        setArtisanLocation(newLocation);
        setListingLocation(newLocation);
        setCustomAddress(newLocation.address);
        setCustomNeighborhood(newLocation.neighborhood);
        setCustomCity(newLocation.city);
        setCustomLat(newLocation.lat);
        setCustomLng(newLocation.lng);

        // Update current user profile in storage and Firebase
        const updatedUser: User = {
          ...currentUser,
          location: newLocation,
        };
        await saveUser(updatedUser);
        setCurrentUser(updatedUser);
        if (onUpdateCurrentUser) onUpdateCurrentUser(updatedUser);
        if (onUpdateUserLocation) onUpdateUserLocation(newLocation);

        setToastMessage(`📍 GPS Location verified: ${newLocation.neighborhood}, ${newLocation.city}!`);
        setTimeout(() => setToastMessage(null), 5000);
      } else {
        setToastMessage(result.error || "Could not retrieve GPS location.");
        setTimeout(() => setToastMessage(null), 5000);
      }
    } catch (err) {
      console.warn("GPS Detection Error:", err);
      setToastMessage("Location request failed. Please set your workshop address manually.");
      setTimeout(() => setToastMessage(null), 5000);
    } finally {
      setIsDetectingLocation(false);
    }
  };

  // Handle GPS detection specifically for a listing being created/edited
  const handleDetectListingGps = async () => {
    setIsDetectingLocation(true);
    try {
      const result = await getDetailedSystemLocation();
      if (result.isGpsAccurate) {
        setListingLocation(result.location);
        setToastMessage(`📍 Listing location updated: ${result.location.neighborhood}!`);
        setTimeout(() => setToastMessage(null), 4000);
      } else {
        setToastMessage(result.error || "Could not detect GPS coordinates.");
        setTimeout(() => setToastMessage(null), 4000);
      }
    } catch (err) {
      console.warn(err);
    } finally {
      setIsDetectingLocation(false);
    }
  };

  // Save manual workshop location updates
  const handleSaveWorkshopLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    const newLocation: GeoLocation = {
      lat: Number(customLat) || artisanLocation.lat,
      lng: Number(customLng) || artisanLocation.lng,
      address: customAddress.trim() || "Artisan Workshop Studio",
      neighborhood: customNeighborhood.trim() || "Heritage Quarter",
      city: customCity.trim() || "Metro West",
    };

    setArtisanLocation(newLocation);
    setListingLocation(newLocation);

    const updatedUser: User = {
      ...currentUser,
      location: newLocation,
    };
    await saveUser(updatedUser);
    setCurrentUser(updatedUser);
    if (onUpdateCurrentUser) onUpdateCurrentUser(updatedUser);
    if (onUpdateUserLocation) onUpdateUserLocation(newLocation);

    setShowLocationModal(false);
    setToastMessage(`✨ Workshop location set to ${newLocation.neighborhood}, ${newLocation.city}!`);
    setTimeout(() => setToastMessage(null), 5000);
  };

  // Real-Time Robust Speech Recognition for Text Area with AI Audio transcription fallback
  const toggleTextareaSpeech = async () => {
    if (isTextareaMicActive) {
      setIsTextareaMicActive(false);
      const result = await textareaTranscriberRef.current.stop();
      if (result.transcript) {
        setRawInput(result.transcript);
        const detected = detectLanguageFromText(result.transcript);
        if (detected && detected.name !== curationLanguage) {
          setCurationLanguage(detected.name);
          setToastMessage(`✨ Automatically detected & switched to ${detected.name} (${detected.nativeName})!`);
          setTimeout(() => setToastMessage(null), 3500);
        }
      }
      return;
    }

    setIsTextareaMicActive(true);
    setToastMessage(`🎙️ Listening... Speak naturally in Tamil, Hindi, English, etc.!`);
    setTimeout(() => setToastMessage(null), 3000);

    await textareaTranscriberRef.current.start({
      language: "auto",
      onTranscriptUpdate: (text, isFinal) => {
        if (text) {
          setRawInput(text);
          const detected = detectLanguageFromText(text);
          if (detected && detected.name !== curationLanguage) {
            setCurationLanguage(detected.name);
          }
        }
        if (isFinal) {
          setIsTextareaMicActive(false);
        }
      },
      onLanguageDetected: (detected) => {
        if (detected && detected.name !== curationLanguage) {
          setCurationLanguage(detected.name);
          setToastMessage(`✨ Automatically detected & switched to ${detected.name} (${detected.nativeName})!`);
          setTimeout(() => setToastMessage(null), 3500);
        }
      },
      onStateChange: (active) => {
        setIsTextareaMicActive(active);
      },
      onError: (e) => {
        console.warn("Textarea speech recognition notice:", e);
      },
    });
  };

  // Convert Romanized / Phonetic Spoken Text (Tanglish, Hinglish, etc.) into clean native script
  const handleTransliterateToNative = async () => {
    if (!rawInput.trim()) return;
    setIsTransliterating(true);
    try {
      const result = await transliterateToNative(rawInput, curationLanguage);
      if (result && result.nativeText) {
        setRawInput(result.nativeText);
        setToastMessage(`✨ Converted to ${result.language || curationLanguage} script!`);
        setTimeout(() => setToastMessage(null), 4000);
      }
    } catch (err) {
      console.error("Transliteration failed:", err);
    } finally {
      setIsTransliterating(false);
    }
  };

  // Translate Native Title to Fluent English
  const handleTranslateTitleToEnglish = async () => {
    const textToTranslate = title.trim() || rawInput.trim();
    if (!textToTranslate) return;
    setIsTranslatingTitle(true);
    try {
      const res = await translateMessage(textToTranslate, "English", curationLanguage);
      if (res?.translatedText) {
        setTitleEnglish(res.translatedText);
        setToastMessage("✨ Title translated to English!");
        setTimeout(() => setToastMessage(null), 3500);
      }
    } catch (err) {
      console.error("Title translation failed:", err);
    } finally {
      setIsTranslatingTitle(false);
    }
  };

  // Translate Native Description to Fluent English
  const handleTranslateDescToEnglish = async () => {
    const textToTranslate = description.trim() || rawInput.trim();
    if (!textToTranslate) return;
    setIsTranslatingDesc(true);
    try {
      const res = await translateMessage(textToTranslate, "English", curationLanguage);
      if (res?.translatedText) {
        setDescriptionEnglish(res.translatedText);
        setToastMessage("✨ Description translated to English!");
        setTimeout(() => setToastMessage(null), 3500);
      }
    } catch (err) {
      console.error("Description translation failed:", err);
    } finally {
      setIsTranslatingDesc(false);
    }
  };

  const handleAICurate = async () => {
    if (!rawInput.trim()) return;

    setIsGeneratingAI(true);
    setAiSuccessBadge(null);

    try {
      const result = await generateProviderListing(rawInput, curationLanguage || currentUser.preferredLanguage);

      setTitle(result.title);
      setTitleEnglish(result.titleEnglish);
      setDescription(result.description);
      setDescriptionEnglish(result.descriptionEnglish);
      setCategory(result.category);
      setPrice(result.estimatedPrice || 350);
      setIsBarter(result.isBarter);
      setBarterDetails(result.barterDetails || "Willing to exchange for tech help or local transport");
      setDigitalApprenticeEligible(result.digitalApprenticeEligible);
      setHeritageNotes(result.heritageNotes || "");
      setTagsInput(result.tags.join(", "));

      // Pick contextual photo placeholder based on category
      const photoMap: Record<string, string> = {
        repairs_mending:
          "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=800&q=80",
        traditional_skills:
          "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=800&q=80",
        home_cooking:
          "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=800&q=80",
        gardening_botanicals:
          "https://images.unsplash.com/photo-1608248597359-0026e6490e54?auto=format&fit=crop&w=800&q=80",
        handmade_goods:
          "https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?auto=format&fit=crop&w=800&q=80",
      };
      setImageUrl(photoMap[result.category] || photoMap.handmade_goods);

      setAiSuccessBadge(
        `Gemini AI formatted your listing in ${result.detectedLanguage || curationLanguage} & translated to English!`
      );
    } catch (e: any) {
      console.error(e);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleEditListing = (listing: Listing) => {
    setEditingListingId(listing.id);
    setTitle(listing.title);
    setTitleEnglish(listing.titleEnglish || listing.title);
    setDescription(listing.description);
    setDescriptionEnglish(listing.descriptionEnglish || listing.description);
    setCategory(listing.category);
    setPrice(listing.price);
    setIsBarter(listing.isBarter);
    setBarterDetails(listing.barterDetails || "");
    setDigitalApprenticeEligible(listing.digitalApprenticeEligible);
    setHeritageNotes(listing.heritageNotes || "");
    setTagsInput(listing.tags?.join(", ") || "");
    setImageUrl(listing.imageUrl);
    setVoiceNote(listing.voiceNote || null);
    setVideoDemo(
      listing.videoDemo ||
        (listing.videoUrl
          ? {
              videoUrl: listing.videoUrl,
              title: listing.title,
              durationSeconds: listing.videoDurationSeconds || 24,
              thumbnailUrl: listing.videoThumbnailUrl || listing.imageUrl,
              verifiedSeniorCraft: true,
              recordedAt: new Date().toISOString(),
            }
          : null)
    );
    setListingLocation(listing.location || artisanLocation);
    setRawInput(listing.description || listing.title);
    setAiSuccessBadge(null);
    setCreationMode("manual");
    setIsCreating(true);

    window.scrollTo({ top: 120, behavior: "smooth" });
  };

  const handleSaveListing = (e?: React.FormEvent, bypassVideoCheck = false) => {
    if (e) e.preventDefault();

    if (!title.trim() && !rawInput.trim()) return;

    // If an elder candidate is posting a new service and hasn't added a video, ask them to post a video first
    if (!videoDemo && !bypassVideoCheck && !editingListingId) {
      setShowVideoRequirementPrompt(true);
      return;
    }

    const existingListing = editingListingId
      ? listings.find((l) => l.id === editingListingId)
      : null;

    // Use selected videoDemo or fallback to category preset if available
    const categoryPreset = CRAFT_VIDEO_PRESETS.find((p) => p.category === category) || CRAFT_VIDEO_PRESETS[0];
    const finalVideoDemo =
      videoDemo ||
      existingListing?.videoDemo ||
      categoryPreset;

    const updatedListing: Listing = {
      id: editingListingId || `listing_${Date.now()}`,
      providerId: currentUser.id,
      providerName: currentUser.fullName,
      providerAvatar: currentUser.avatarUrl,
      providerLanguage: currentUser.preferredLanguage,
      title: title.trim() || rawInput.slice(0, 40),
      titleEnglish: titleEnglish.trim() || title.trim() || rawInput.slice(0, 40),
      description: description.trim() || rawInput,
      descriptionEnglish: descriptionEnglish.trim() || description.trim() || rawInput,
      category,
      price: Number(price) || 0,
      isBarter,
      barterDetails: isBarter ? barterDetails : undefined,
      digitalApprenticeEligible,
      heritageNotes: heritageNotes.trim() || undefined,
      tags: tagsInput
        ? tagsInput.split(",").map((t) => t.trim())
        : ["Artisan", "Handmade", "Verified Video"],
      imageUrl,
      voiceNote: voiceNote || existingListing?.voiceNote || undefined,
      videoUrl: finalVideoDemo?.videoUrl,
      videoDemo: finalVideoDemo,
      videoDurationSeconds: finalVideoDemo?.durationSeconds,
      videoThumbnailUrl: finalVideoDemo?.thumbnailUrl || imageUrl,
      averageRating: existingListing?.averageRating || 5.0,
      reviewCount: existingListing?.reviewCount || 0,
      location: listingLocation || existingListing?.location || artisanLocation,
      available: existingListing ? existingListing.available : true,
      createdAt: existingListing?.createdAt || new Date().toISOString(),
      viewsCount: existingListing?.viewsCount || 1,
      likesCount: existingListing?.likesCount || 0,
    };

    saveListing(updatedListing);
    onListingCreatedOrUpdated();
    setIsCreating(false);
    setShowVideoRequirementPrompt(false);
    const wasEditing = Boolean(editingListingId);
    resetForm();
    setToastMessage(
      wasEditing
        ? "✨ Service details & master craft video updated successfully!"
        : "🎉 Verified craft listing published with demonstration video to the neighborhood feed!"
    );
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleSelectPresetAndPublish = (preset: VideoDemo) => {
    setVideoDemo(preset);
    setShowVideoRequirementPrompt(false);
    // Submit with the selected video preset
    setTimeout(() => {
      handleSaveListing(undefined, true);
    }, 100);
  };

  const handleSaveProviderReply = (reviewId: string) => {
    const text = (replyTextMap[reviewId] || "").trim();
    if (!text) return;

    addProviderReplyToReview(reviewId, text);
    setReviewsList(getStoredReviews());
    setReplyTextMap((prev) => ({ ...prev, [reviewId]: "" }));
    setReplyingToReviewId(null);
    setToastMessage("✨ Heartfelt response sent to customer/recruiter!");
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleRequestDelete = (listing: Listing) => {
    setListingToDelete(listing);
  };

  const handleConfirmDelete = () => {
    if (!listingToDelete) return;
    deleteListing(listingToDelete.id);
    onListingCreatedOrUpdated();
    const deletedTitle = listingToDelete.titleEnglish || listingToDelete.title;
    setListingToDelete(null);
    setToastMessage(`"${deletedTitle}" was deleted successfully.`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const resetForm = () => {
    setEditingListingId(null);
    setRawInput("");
    setTitle("");
    setTitleEnglish("");
    setDescription("");
    setDescriptionEnglish("");
    setVoiceNote(null);
    setVideoDemo(null);
    setAiSuccessBadge(null);
    setCategory("handmade_goods");
    setPrice(350);
    setIsBarter(true);
    setBarterDetails("");
    setDigitalApprenticeEligible(true);
    setHeritageNotes("");
    setTagsInput("");
    setListingLocation(artisanLocation);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 text-amber-50">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-amber-950/90 via-slate-900 to-slate-900 border-2 border-amber-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center space-x-5">
          <img
            src={currentUser.avatarUrl}
            alt={currentUser.fullName}
            className="w-20 h-20 rounded-2xl object-cover border-2 border-amber-400 shadow-lg"
            referrerPolicy="no-referrer"
          />
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-400/40 px-3 py-1 rounded-full uppercase tracking-wider">
                Senior Master Artisan
              </span>
              <span className="text-xs text-slate-400 font-mono">
                Native: {currentUser.preferredLanguage}
              </span>
            </div>
            <h1 className="text-3xl font-bold text-amber-100 font-serif mt-1">
              Namaste, {currentUser.fullName}
            </h1>
            <p className="text-base text-amber-200/80 mt-1 max-w-xl">
              Share your handmade goods, heirloom recipes, and master mending skills with your neighborhood.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <button
            onClick={() => setActiveDashboardTab("messages")}
            id="provider-open-messages-tab-btn"
            className={`px-5 py-3.5 rounded-2xl border font-bold text-sm shadow-lg transition-all flex items-center justify-center space-x-2.5 cursor-pointer ${
              activeDashboardTab === "messages"
                ? "bg-amber-500 text-slate-950 border-amber-400 shadow-amber-900/50"
                : "bg-slate-900/90 hover:bg-slate-800 text-amber-200 border-amber-500/40"
            }`}
          >
            <MessageSquare className="w-5 h-5 text-amber-400" />
            <span>Client Messages</span>
            {unreadMessageCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-bold text-xs animate-pulse">
                {unreadMessageCount} New
              </span>
            )}
          </button>

          {onOpenMeetupModal && (
            <button
              onClick={onOpenMeetupModal}
              id="provider-open-meetups-btn"
              className="px-5 py-3.5 rounded-2xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-200 font-bold text-sm shadow-lg transition-all flex items-center justify-center space-x-2 cursor-pointer"
            >
              <span className="text-xl">🎪</span>
              <span>Meetups & Bazaars ({eventsCount})</span>
            </button>
          )}

          <button
            onClick={() => {
              setActiveDashboardTab("listings");
              setIsCreating(true);
              setCreationMode("choice");
              resetForm();
            }}
            id="create-new-listing-btn"
            className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-base sm:text-lg shadow-xl shadow-amber-900/40 transition-all flex items-center justify-center space-x-3 cursor-pointer"
          >
            <PlusCircle className="w-5 h-5 sm:w-6 sm:h-6" />
            <span>Add New Heritage Listing</span>
          </button>
        </div>
      </div>

      {/* Unread Inquiries Notification Alert Banner */}
      {unreadMessageCount > 0 && activeDashboardTab !== "messages" && (
        <div className="bg-gradient-to-r from-amber-950/80 via-slate-900 to-emerald-950/80 border-2 border-emerald-500/50 rounded-3xl p-4 sm:p-5 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-slideDown">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center text-emerald-400 flex-shrink-0 animate-bounce">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 px-2.5 py-0.5 rounded-full">
                  New Client Inquiries
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {unreadMessageCount} Unread Message{unreadMessageCount > 1 ? "s" : ""}
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-amber-100 mt-0.5">
                Neighbors are inquiring about your crafts, repairs, and barter exchanges!
              </h3>
            </div>
          </div>

          <button
            type="button"
            id="view-unread-messages-alert-btn"
            onClick={() => setActiveDashboardTab("messages")}
            className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm shadow-md flex items-center space-x-2 transition-all cursor-pointer flex-shrink-0"
          >
            <span>Open Client Messages Panel</span>
            <span className="text-xs bg-slate-950 text-emerald-300 px-2 py-0.5 rounded-full font-bold">
              {unreadMessageCount}
            </span>
          </button>
        </div>
      )}

      {/* Dashboard Section Switcher Tabs */}
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-800 pb-4">
        <button
          onClick={() => setActiveDashboardTab("listings")}
          id="provider-listings-tab-btn"
          className={`px-5 py-3 rounded-2xl font-bold text-sm sm:text-base transition-all flex items-center space-x-2.5 cursor-pointer ${
            activeDashboardTab === "listings"
              ? "bg-amber-500 text-slate-950 shadow-lg shadow-amber-900/40"
              : "bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800"
          }`}
        >
          <span>🧵 My Craft Listings ({providerListings.length})</span>
        </button>

        <button
          onClick={() => setActiveDashboardTab("messages")}
          id="provider-messages-tab-btn"
          className={`px-5 py-3 rounded-2xl font-bold text-sm sm:text-base transition-all flex items-center space-x-2.5 cursor-pointer ${
            activeDashboardTab === "messages"
              ? "bg-amber-500 text-slate-950 shadow-lg shadow-amber-900/40"
              : "bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800"
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Client Messages</span>
          {unreadMessageCount > 0 && (
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                activeDashboardTab === "messages"
                  ? "bg-slate-950 text-amber-300"
                  : "bg-emerald-500 text-slate-950 animate-pulse"
              }`}
            >
              {unreadMessageCount} New
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveDashboardTab("reviews")}
          id="provider-reviews-tab-btn"
          className={`px-5 py-3 rounded-2xl font-bold text-sm sm:text-base transition-all flex items-center space-x-2.5 cursor-pointer ${
            activeDashboardTab === "reviews"
              ? "bg-amber-500 text-slate-950 shadow-lg shadow-amber-900/40"
              : "bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800"
          }`}
        >
          <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
          <span>Customer & Recruiter Reviews ({providerReviews.length})</span>
          {providerRatingSummary.totalReviews > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-400/20 text-amber-300 border border-amber-400/40">
              ★ {providerRatingSummary.averageRating.toFixed(1)}
            </span>
          )}
        </button>
      </div>

      {/* Render Client Messages Panel if tab active */}
      {activeDashboardTab === "messages" && (
        <ClientMessagesPanel
          currentUser={currentUser}
          isEmbedded={true}
          largeTextMode={largeTextMode}
        />
      )}

      {/* Render Reviews & Recruiter Feedback Panel if tab active */}
      {activeDashboardTab === "reviews" && (
        <div className="space-y-6 animate-fadeIn">
          {/* Reputation Summary Card */}
          <div className="p-6 sm:p-8 bg-gradient-to-r from-amber-950/70 via-slate-900 to-amber-950/50 border-2 border-amber-500/40 rounded-3xl shadow-xl">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
              <div className="md:col-span-1 text-center md:text-left border-b md:border-b-0 md:border-r border-slate-800 pb-6 md:pb-0 md:pr-6">
                <div className="text-4xl sm:text-5xl font-black text-amber-300 font-mono flex items-center justify-center md:justify-start space-x-2">
                  <span>{providerRatingSummary.averageRating.toFixed(1)}</span>
                  <Star className="w-8 h-8 fill-amber-400 text-amber-400" />
                </div>
                <p className="text-xs font-bold uppercase tracking-wider text-amber-200/80 mt-1">
                  Overall Master Rating
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Based on {providerRatingSummary.totalReviews} verified community reviews
                </p>
              </div>

              <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 text-center">
                  <div className="text-xs font-bold text-amber-200">Craftsmanship</div>
                  <div className="text-2xl font-black text-amber-400 font-mono mt-1">
                    {providerRatingSummary.craftsmanshipAvg.toFixed(1)} ★
                  </div>
                  <div className="text-[11px] text-slate-400">Handwork & Technique</div>
                </div>

                <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 text-center">
                  <div className="text-xs font-bold text-amber-200">Communication</div>
                  <div className="text-2xl font-black text-amber-400 font-mono mt-1">
                    {providerRatingSummary.communicationAvg.toFixed(1)} ★
                  </div>
                  <div className="text-[11px] text-slate-400">Patience & Politeness</div>
                </div>

                <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 text-center">
                  <div className="text-xs font-bold text-amber-200">Punctuality</div>
                  <div className="text-2xl font-black text-amber-400 font-mono mt-1">
                    {providerRatingSummary.punctualityAvg.toFixed(1)} ★
                  </div>
                  <div className="text-[11px] text-slate-400">Timely Delivery</div>
                </div>
              </div>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <span className="text-xs text-slate-400 font-semibold">Filter feedback:</span>
              <button
                onClick={() => setActiveReviewFilter("all")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeReviewFilter === "all"
                    ? "bg-amber-500 text-slate-950 shadow-sm"
                    : "bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800"
                }`}
              >
                All Feedback ({providerReviews.length})
              </button>
              <button
                onClick={() => setActiveReviewFilter("recruiter")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1 cursor-pointer ${
                  activeReviewFilter === "recruiter"
                    ? "bg-purple-500 text-white shadow-sm"
                    : "bg-slate-900 text-purple-300 border border-purple-900/40 hover:bg-slate-800"
                }`}
              >
                <Award className="w-3.5 h-3.5" />
                <span>
                  Recruiter Endorsements ({providerReviews.filter((r) => r.reviewerRole === "recruiter").length})
                </span>
              </button>
              <button
                onClick={() => setActiveReviewFilter("customer")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1 cursor-pointer ${
                  activeReviewFilter === "customer"
                    ? "bg-emerald-500 text-slate-950 shadow-sm"
                    : "bg-slate-900 text-emerald-300 border border-emerald-900/40 hover:bg-slate-800"
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>
                  Customer Reviews ({providerReviews.filter((r) => r.reviewerRole === "customer").length})
                </span>
              </button>
            </div>
          </div>

          {/* Reviews List */}
          {providerReviews.length === 0 ? (
            <div className="p-12 text-center bg-slate-900/60 border-2 border-dashed border-slate-800 rounded-3xl space-y-3">
              <Star className="w-10 h-10 text-amber-400 mx-auto opacity-60" />
              <h4 className="text-lg font-bold text-amber-100">No reviews received yet</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Once customers or community recruiters hire your craft services, their reviews and verified endorsements will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {providerReviews
                .filter((r) => {
                  if (activeReviewFilter === "recruiter") return r.reviewerRole === "recruiter";
                  if (activeReviewFilter === "customer") return r.reviewerRole === "customer";
                  return true;
                })
                .map((review) => (
                  <div
                    key={review.id}
                    className="p-5 bg-slate-900 border-2 border-slate-800 hover:border-amber-500/40 rounded-3xl space-y-4 transition-all shadow-md"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                      <div className="flex items-center space-x-3">
                        <img
                          src={review.reviewerAvatar}
                          alt={review.reviewerName}
                          className="w-10 h-10 rounded-2xl object-cover border border-amber-400/40"
                          referrerPolicy="no-referrer"
                        />
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-bold text-white">{review.reviewerName}</span>
                            {review.reviewerRole === "recruiter" ? (
                              <span className="px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-400/40 text-purple-300 text-[10px] font-bold flex items-center space-x-1">
                                <Award className="w-3 h-3" />
                                <span>Recruiter / Guild Verifier</span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[10px] font-bold flex items-center space-x-1">
                                <ShieldCheck className="w-3 h-3" />
                                <span>Verified Customer</span>
                              </span>
                            )}
                          </div>
                          {review.reviewerOrganization && (
                            <p className="text-[11px] text-purple-300/80 font-medium">
                              🏢 {review.reviewerOrganization}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center space-x-3">
                        <div className="flex items-center space-x-1 bg-amber-500/20 px-2.5 py-1 rounded-xl border border-amber-400/30">
                          <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                          <span className="text-sm font-black text-amber-300 font-mono">{review.rating}</span>
                        </div>
                        <span className="text-[11px] text-slate-400">
                          {new Date(review.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {/* Review Ratings Breakdown */}
                    <div className="grid grid-cols-3 gap-2 py-1">
                      <div className="bg-slate-950/70 p-2 rounded-xl text-center border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">Craft</span>
                        <span className="text-xs font-bold text-amber-300">
                          {review.craftsmanshipRating || review.rating} ★
                        </span>
                      </div>
                      <div className="bg-slate-950/70 p-2 rounded-xl text-center border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">Communication</span>
                        <span className="text-xs font-bold text-amber-300">
                          {review.communicationRating || review.rating} ★
                        </span>
                      </div>
                      <div className="bg-slate-950/70 p-2 rounded-xl text-center border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">Punctuality</span>
                        <span className="text-xs font-bold text-amber-300">
                          {review.punctualityRating || review.rating} ★
                        </span>
                      </div>
                    </div>

                    <p className="text-sm text-slate-200 leading-relaxed italic bg-slate-950/40 p-3 rounded-2xl border border-slate-800/60">
                      "{review.comment}"
                    </p>

                    {/* Provider Reply Box or Display */}
                    {review.providerReply ? (
                      <div className="p-3.5 bg-amber-950/30 border border-amber-500/30 rounded-2xl text-xs space-y-1">
                        <div className="flex items-center justify-between text-amber-300 font-bold">
                          <span>Your Response:</span>
                          <span className="text-[10px] text-slate-400 font-normal">
                            {review.providerReplyAt
                              ? new Date(review.providerReplyAt).toLocaleDateString()
                              : "Recently"}
                          </span>
                        </div>
                        <p className="text-amber-100">{review.providerReply}</p>
                      </div>
                    ) : (
                      <div className="pt-2 border-t border-slate-800">
                        {replyingToReviewId === review.id ? (
                          <div className="space-y-2">
                            <textarea
                              rows={2}
                              value={replyTextMap[review.id] || ""}
                              onChange={(e) =>
                                setReplyTextMap({ ...replyTextMap, [review.id]: e.target.value })
                              }
                              placeholder="Write a heartfelt thank you or reply..."
                              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-xl text-xs text-white outline-none resize-none"
                            />
                            <div className="flex items-center justify-end space-x-2">
                              <button
                                type="button"
                                onClick={() => setReplyingToReviewId(null)}
                                className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveProviderReply(review.id)}
                                className="px-4 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md cursor-pointer"
                              >
                                Post Reply
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setReplyingToReviewId(review.id)}
                            className="text-xs font-bold text-amber-300 hover:text-amber-200 flex items-center space-x-1.5 cursor-pointer"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>Reply to {review.reviewerName}</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* If listings tab active, render Location and Listings */}
      {activeDashboardTab === "listings" && (
        <>

      {/* Artisan Studio Location Service Status & Permissions Bar */}
      <div className="bg-slate-900/90 border-2 border-amber-500/40 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-400 flex-shrink-0 mt-0.5">
              <MapPin className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-400/40 px-2.5 py-0.5 rounded-full flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Artisan Studio Location Service</span>
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  GPS: {artisanLocation.lat.toFixed(4)}° N, {artisanLocation.lng.toFixed(4)}° E
                </span>
              </div>
              <h2 className="text-xl font-bold text-amber-100 font-serif">
                {artisanLocation.address}, {artisanLocation.neighborhood} • {artisanLocation.city}
              </h2>
              <p className="text-xs text-slate-300 max-w-2xl">
                Broadcasting your craft services to nearby neighbors within 1–10 km radius. Neighbors searching for sari darning, tailoring, or pickles find you based on this location.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            <button
              type="button"
              id="detect-artisan-gps-btn"
              onClick={handleDetectArtisanGps}
              disabled={isDetectingLocation}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md flex items-center justify-center space-x-2 transition-all cursor-pointer disabled:opacity-50"
              title="Detect device GPS coordinates"
            >
              {isDetectingLocation ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                  <span>Detecting GPS...</span>
                </>
              ) : (
                <>
                  <LocateFixed className="w-4 h-4 text-slate-950" />
                  <span>Detect Live GPS Location</span>
                </>
              )}
            </button>

            <button
              type="button"
              id="edit-workshop-location-btn"
              onClick={() => {
                setCustomAddress(artisanLocation.address);
                setCustomNeighborhood(artisanLocation.neighborhood);
                setCustomCity(artisanLocation.city);
                setCustomLat(artisanLocation.lat);
                setCustomLng(artisanLocation.lng);
                setShowLocationModal(true);
              }}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-200 border border-slate-700 font-bold text-xs flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
            >
              <Edit className="w-4 h-4" />
              <span>Change Address / Locality</span>
            </button>
          </div>
        </div>

        {/* Informative Location Prompt Banner if using default district */}
        {!locationPromptDismissed && (
          <div className="pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-200/90 bg-amber-950/30 -mx-5 -mb-5 sm:-mx-6 sm:-mb-6 p-4 rounded-b-3xl border-t border-amber-500/20">
            <div className="flex items-center space-x-2">
              <Compass className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span>
                <strong>Accurate Location Match:</strong> When customers filter by "Within 1 km" or "Within 5 km", having your exact workshop coordinates ensures you appear first.
              </span>
            </div>
            <div className="flex items-center space-x-2 flex-shrink-0">
              <button
                type="button"
                onClick={handleDetectArtisanGps}
                className="text-xs font-bold text-amber-300 hover:text-amber-100 underline flex items-center space-x-1"
              >
                <span>Request GPS Access</span>
              </button>
              <span className="text-slate-600">•</span>
              <button
                type="button"
                onClick={() => setLocationPromptDismissed(true)}
                className="text-xs text-slate-400 hover:text-slate-200"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
      </div>

      {/* AI Listing Creator Modal / Form / Conversational Assistant */}
      {isCreating && (
        !editingListingId && creationMode === "choice" ? (
          <div className="bg-slate-900 border-2 border-amber-500/70 rounded-3xl p-6 sm:p-10 shadow-2xl animate-fadeIn space-y-8 text-amber-50">
            <div className="flex items-center justify-between border-b border-slate-800 pb-5">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-400/40 px-3 py-1 rounded-full">
                  Artisan Onboarding & Listing Creator
                </span>
                <h2 className="text-2xl sm:text-3xl font-bold text-amber-100 font-serif mt-2">
                  Choose How You Would Like to Create Your Listing
                </h2>
                <p className="text-sm text-slate-300 mt-1 max-w-2xl">
                  Select between manual entry for direct control or a guided voice & text conversational assistant for uneducated/elder artisans.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="text-slate-400 hover:text-white font-bold text-sm px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 transition-all cursor-pointer"
              >
                ✕ Cancel
              </button>
            </div>

            {/* Two Big Option Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
              {/* Option 1: Manual Form for Educated Persons */}
              <div className="bg-slate-950/90 border-2 border-slate-800 hover:border-amber-500/60 rounded-3xl p-6 sm:p-8 flex flex-col justify-between space-y-6 transition-all hover:shadow-2xl group">
                <div className="space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-400 flex items-center justify-center text-amber-400 text-2xl group-hover:scale-105 transition-transform">
                    ✍️
                  </div>
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 border border-amber-400/30 px-2.5 py-0.5 rounded-full">
                      Option 1: Manual Form Entry
                    </span>
                    <h3 className="text-xl sm:text-2xl font-bold text-amber-100 font-serif mt-2">
                      Enter Details Manually
                    </h3>
                    <p className="text-xs font-semibold text-emerald-400 mt-0.5">
                      For Educated / Tech-Savvy Artisans
                    </p>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    Fill in granular form fields at your own pace: craft title, bilingual descriptions, price in ₹, barter items, category tags, workshop GPS coordinates, and craft demonstration videos.
                  </p>
                  <ul className="space-y-2 text-xs text-slate-400 pt-2 border-t border-slate-900">
                    <li className="flex items-center space-x-2">
                      <span className="text-emerald-400">✓</span>
                      <span>Full control over every form field, price & barter tag</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <span className="text-emerald-400">✓</span>
                      <span>AI prompt generator & live transliteration helper</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <span className="text-emerald-400">✓</span>
                      <span>Upload video files or record craft demonstrations</span>
                    </li>
                  </ul>
                </div>

                <button
                  type="button"
                  id="select-manual-entry-mode-btn"
                  onClick={() => setCreationMode("manual")}
                  className="w-full py-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-amber-200 border-2 border-amber-500/40 hover:border-amber-400 font-bold text-base shadow-lg transition-all flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <span>Open Manual Form (Option 1)</span>
                  <span>✍️</span>
                </button>
              </div>

              {/* Option 2: Conversational Chatbot for Uneducated Persons */}
              <div className="bg-gradient-to-br from-slate-950 via-amber-950/30 to-slate-950 border-2 border-amber-500 hover:border-amber-400 rounded-3xl p-6 sm:p-8 flex flex-col justify-between space-y-6 transition-all shadow-xl hover:shadow-amber-900/30 group">
                <div className="space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 text-slate-950 flex items-center justify-center text-2xl font-black group-hover:scale-105 transition-transform shadow-lg">
                    🎙️
                  </div>
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-950 bg-amber-400 px-2.5 py-0.5 rounded-full font-black">
                      Option 2: Guided Voice & Chat
                    </span>
                    <h3 className="text-xl sm:text-2xl font-bold text-amber-100 font-serif mt-2">
                      Conversational Chatbot Assistant
                    </h3>
                    <p className="text-xs font-semibold text-amber-300 mt-0.5">
                      For Uneducated / Elder Artisans (Voice & Native Language)
                    </p>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    AI asks questions one-by-one (Name, Age, Skill, Salary/Price, Products, Auto GPS) in your native language (Tamil, Hindi, Telugu, etc.). Talk or type freely—the assistant automatically compiles all answers into a live marketplace cart!
                  </p>
                  <ul className="space-y-2 text-xs text-slate-300 pt-2 border-t border-slate-900/80">
                    <li className="flex items-center space-x-2">
                      <span className="text-amber-400">✓</span>
                      <span>Voice input with speech recognition & text-to-speech</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <span className="text-amber-400">✓</span>
                      <span>Sequential questions + 1-tap Auto-GPS workshop detector</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <span className="text-emerald-400">🛡️</span>
                      <span>Protected user identity & sanitized API proxy shield</span>
                    </li>
                  </ul>
                </div>

                <button
                  type="button"
                  id="select-conversational-mode-btn"
                  onClick={() => setCreationMode("conversational")}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-base shadow-xl shadow-amber-900/40 transition-all flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <span>Start Voice & Chat Assistant (Option 2)</span>
                  <span>🎙️</span>
                </button>
              </div>
            </div>
          </div>
        ) : !editingListingId && creationMode === "conversational" ? (
          <ConversationalListingAssistant
            currentUser={currentUser}
            initialLanguage={curationLanguage}
            onSwitchToManual={() => setCreationMode("manual")}
            onSaveListing={(assembledListing) => {
              saveListing(assembledListing);
              onListingCreatedOrUpdated();
              setIsCreating(false);
              setCreationMode("choice");
              resetForm();
              setToastMessage("🎉 Verified artisan listing published to the neighborhood feed!");
              setTimeout(() => setToastMessage(null), 4500);
            }}
          />
        ) : (
        <div className="bg-slate-900 border-2 border-amber-500 rounded-3xl p-6 sm:p-8 shadow-2xl animate-fadeIn space-y-6">
          {/* Top Switcher Banner if in Manual Mode */}
          {!editingListingId && (
            <div className="bg-amber-950/40 border border-amber-500/30 p-3 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs text-amber-200">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-amber-300">✍️ Mode: Option 1 (Manual Form Entry)</span>
                <span className="text-slate-400 hidden sm:inline">• For educated / self-service artisans</span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setCreationMode("conversational")}
                  className="text-xs font-bold text-amber-400 hover:text-amber-300 underline flex items-center space-x-1 cursor-pointer"
                >
                  <span>🎙️ Switch to Conversational Chatbot (Option 2)</span>
                </button>
                <span className="text-slate-600">|</span>
                <button
                  type="button"
                  onClick={() => setCreationMode("choice")}
                  className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  Change Mode
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400 flex items-center justify-center text-amber-400">
                <Sparkles className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-amber-100 font-serif">
                  {editingListingId
                    ? "Edit Service & Craft Offering"
                    : "Manual Listing Creator (Option 1)"}
                </h2>
                <p className="text-sm text-amber-300/80">
                  {editingListingId
                    ? "Update your rates, photos, barter terms, or refine details with Gemini AI."
                    : `Speak or write naturally in ${currentUser.preferredLanguage}. Gemini will format SEO tags, English translation, and pricing!`}
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsCreating(false)}
              className="text-slate-400 hover:text-white font-bold text-sm px-4 py-2 rounded-xl bg-slate-800"
            >
              Cancel
            </button>
          </div>

          {/* Multilingual Input Language Selection Pills */}
          <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800 space-y-2">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <Languages className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-amber-200">
                  Select Spoken / Listing Language:
                </span>
              </div>
              <span className="text-[11px] text-slate-400">
                Speaking in Tamil automatically creates Tamil script & English translation
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {[
                { name: "auto", native: "✨ Auto-Detect (Auto)", code: "auto" },
                { name: "Tamil", native: "தமிழ் (Tamil)", code: "ta-IN" },
                { name: "Hindi", native: "हिन्दी (Hindi)", code: "hi-IN" },
                { name: "Telugu", native: "తెలుగు (Telugu)", code: "te-IN" },
                { name: "Kannada", native: "ಕನ್ನಡ (Kannada)", code: "kn-IN" },
                { name: "Malayalam", native: "മലയാളം (Malayalam)", code: "ml-IN" },
                { name: "Bengali", native: "বাংলা (Bengali)", code: "bn-IN" },
                { name: "Marathi", native: "मराठी (Marathi)", code: "mr-IN" },
                { name: "English", native: "English", code: "en-IN" },
              ].map((lang) => {
                const isSelected = curationLanguage.toLowerCase() === lang.name.toLowerCase();
                return (
                  <button
                    key={lang.name}
                    type="button"
                    onClick={() => {
                      setCurationLanguage(lang.name);
                      setToastMessage(`Switched curation language to ${lang.native}`);
                      setTimeout(() => setToastMessage(null), 3000);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                      isSelected
                        ? "bg-amber-500 text-slate-950 shadow-md ring-2 ring-amber-400"
                        : "bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700"
                    }`}
                  >
                    <span>{lang.native}</span>
                    {isSelected && <CheckCircle className="w-3 h-3 text-slate-950" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 1: 30s Voice Note & Native Speech Input */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AudioVoiceRecorder
              title={
                curationLanguage === "auto"
                  ? "Record 30s Heritage Story (Multilingual / Auto)"
                  : `Record 30s Voice Story in ${curationLanguage}`
              }
              subtitle={
                curationLanguage === "auto"
                  ? "Speak naturally in English, Tamil, Hindi, or any language; AI recognizes your speech."
                  : `Describe your craft in ${curationLanguage}; AI generates clean transcription and listing.`
              }
              defaultLanguage={curationLanguage}
              onVoiceNoteRecorded={(note) => {
                setVoiceNote(note);
                if (
                  note.transcript &&
                  note.transcript.trim() &&
                  !note.transcript.toLowerCase().includes("voice recording captured")
                ) {
                  setRawInput(note.transcript);
                  const detected = detectLanguageFromText(note.transcript);
                  if (detected && detected.name !== curationLanguage) {
                    setCurationLanguage(detected.name);
                  }
                }
              }}
              onLanguageAutoDetected={(code, name) => {
                setCurationLanguage(name);
                setAiSuccessBadge(`✨ Detected ${name} voice — ready to curate in ${name}!`);
              }}
              onTranscriptCaptured={(transcript) => {
                if (
                  transcript &&
                  transcript.trim() &&
                  !transcript.toLowerCase().includes("voice recording captured")
                ) {
                  setRawInput(transcript);
                  const detected = detectLanguageFromText(transcript);
                  if (detected && detected.name !== curationLanguage) {
                    setCurationLanguage(detected.name);
                  }
                }
              }}
            />

            {/* Native Language Textarea + Speech Mic + Transliterate to Native */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-3xl p-6 flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-base font-semibold text-amber-100 flex items-center space-x-2">
                    <span>Describe what you want to offer or barter:</span>
                  </label>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      {curationLanguage}
                    </span>
                  </div>
                </div>

                <div className="relative">
                  <textarea
                    rows={4}
                    value={rawInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      setRawInput(val);
                      const detected = detectLanguageFromText(val);
                      if (detected && detected.name !== curationLanguage) {
                        setCurationLanguage(detected.name);
                        setToastMessage(`✨ Automatically detected & switched to ${detected.name} (${detected.nativeName})!`);
                        setTimeout(() => setToastMessage(null), 3000);
                      }
                    }}
                    placeholder={
                      curationLanguage === "Tamil"
                        ? "எ.கா. நான் வீட்டில் பாரம்பரிய முறைப்படி சமையல் செய்து தருகிறேன் (I cook authentic home food), அல்லது பழைய புடவை தையல் வேலை..."
                        : curationLanguage === "Hindi"
                        ? "e.g. मैं पुरानी सिल्क साड़ियों की ज़री मरम्मत करती हूँ और बदले में फोन चलाने में मदद चाहती हूँ..."
                        : "e.g. I make traditional spice blends, restore vintage pressure cookers, or teach authentic home recipes..."
                    }
                    className="w-full p-4 pr-12 bg-slate-900 border-2 border-slate-700 focus:border-amber-500 rounded-2xl text-base text-white outline-none resize-none font-sans"
                  />

                  {/* Quick Inline Microphone for Textarea */}
                  <button
                    type="button"
                    onClick={toggleTextareaSpeech}
                    title={`Speak in ${curationLanguage}`}
                    className={`absolute bottom-3 right-3 p-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center ${
                      isTextareaMicActive
                        ? "bg-red-500 text-white animate-pulse shadow-lg ring-2 ring-red-400"
                        : "bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700"
                    }`}
                  >
                    <Mic className="w-5 h-5" />
                  </button>
                </div>

                {/* Transliterate / Fix to Native Script Helper Button */}
                {rawInput.trim() && (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={handleTransliterateToNative}
                        disabled={isTransliterating}
                        className="px-3.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-400/40 text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer disabled:opacity-50"
                      >
                        {isTransliterating ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Converting to {curationLanguage}...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                            <span>
                              {curationLanguage === "Tamil"
                                ? "✨ Convert to தமிழ் (Tamil Script)"
                                : `✨ Convert to ${curationLanguage} Script`}
                            </span>
                          </>
                        )}
                      </button>

                      {curationLanguage !== "Tamil" && (
                        <button
                          type="button"
                          onClick={() => {
                            setCurationLanguage("Tamil");
                            setToastMessage("✨ Switched language to தமிழ் (Tamil)!");
                            setTimeout(() => setToastMessage(null), 3000);
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 text-xs font-medium transition-all cursor-pointer"
                        >
                          🔄 Switch to தமிழ் (Tamil)
                        </button>
                      )}

                      {curationLanguage !== "Hindi" && (
                        <button
                          type="button"
                          onClick={() => {
                            setCurationLanguage("Hindi");
                            setToastMessage("✨ Switched language to हिन्दी (Hindi)!");
                            setTimeout(() => setToastMessage(null), 3000);
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 text-xs font-medium transition-all cursor-pointer"
                        >
                          🔄 Switch to हिन्दी (Hindi)
                        </button>
                      )}
                    </div>

                    <span className="text-[11px] text-slate-400">
                      {curationLanguage === "English"
                        ? "Click 'Curate with Gemini AI' below to craft your full listing"
                        : "Converts spoken sounds to native script"}
                    </span>
                  </div>
                )}
              </div>

              <button
                type="button"
                id="gemini-curate-btn"
                onClick={handleAICurate}
                disabled={isGeneratingAI || !rawInput.trim()}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-lg shadow-lg flex items-center justify-center space-x-2 transition-all disabled:opacity-50 cursor-pointer"
              >
                {isGeneratingAI ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin text-slate-950" />
                    <span>Gemini AI is crafting your {curationLanguage} listing...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-6 h-6" />
                    <span>
                      Curate in {curationLanguage === "Tamil" ? "தமிழ்" : curationLanguage} & Translate to English
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>

          {aiSuccessBadge && (
            <div className="p-4 rounded-2xl bg-emerald-950/50 border border-emerald-500/50 text-emerald-200 text-sm flex items-center space-x-3">
              <CheckCircle className="w-6 h-6 flex-shrink-0 text-emerald-400" />
              <span>{aiSuccessBadge}</span>
            </div>
          )}

          {/* Section 2: Final Listing Details (editable) */}
          <form onSubmit={handleSaveListing} className="space-y-6 pt-4 border-t border-slate-800">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-amber-100 mb-2">
                  Title (Native Language)
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Listing title in your language"
                  className="w-full px-4 py-3 bg-slate-800 border-2 border-slate-700 focus:border-amber-500 rounded-xl text-base text-white outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-amber-100">
                    Title (English Translation)
                  </label>
                  {(title.trim() || rawInput.trim()) && (
                    <button
                      type="button"
                      onClick={handleTranslateTitleToEnglish}
                      disabled={isTranslatingTitle}
                      className="text-[11px] font-bold text-amber-300 hover:text-amber-200 bg-amber-500/20 hover:bg-amber-500/30 px-2 py-0.5 rounded-lg border border-amber-500/30 flex items-center space-x-1 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isTranslatingTitle ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Translating...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3 h-3 text-amber-400" />
                          <span>✨ Auto-Translate Title</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={titleEnglish}
                  onChange={(e) => setTitleEnglish(e.target.value)}
                  placeholder="English title for local buyers"
                  className="w-full px-4 py-3 bg-slate-800 border-2 border-slate-700 focus:border-amber-500 rounded-xl text-base text-white outline-none font-sans"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-amber-100 mb-2">
                  Detailed Description (Native Language)
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800 border-2 border-slate-700 focus:border-amber-500 rounded-xl text-base text-white outline-none resize-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-amber-100">
                    Description (English Version)
                  </label>
                  {(description.trim() || rawInput.trim()) && (
                    <button
                      type="button"
                      onClick={handleTranslateDescToEnglish}
                      disabled={isTranslatingDesc}
                      className="text-[11px] font-bold text-amber-300 hover:text-amber-200 bg-amber-500/20 hover:bg-amber-500/30 px-2 py-0.5 rounded-lg border border-amber-500/30 flex items-center space-x-1 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isTranslatingDesc ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Translating...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3 h-3 text-amber-400" />
                          <span>✨ Auto-Translate Description</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
                <textarea
                  rows={3}
                  value={descriptionEnglish}
                  onChange={(e) => setDescriptionEnglish(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800 border-2 border-slate-700 focus:border-amber-500 rounded-xl text-base text-white outline-none resize-none font-sans"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-semibold text-amber-100 mb-2">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ListingCategory)}
                  className="w-full px-4 py-3 bg-slate-800 border-2 border-slate-700 focus:border-amber-500 rounded-xl text-base text-white outline-none"
                >
                  <option value="repairs_mending">Repairs & Mending (सिलाई / रफू)</option>
                  <option value="handmade_goods">Handmade Goods (हस्तशिल्प)</option>
                  <option value="traditional_skills">Traditional Skills (पारंपरिक ज्ञान)</option>
                  <option value="home_cooking">Home Cooking & Pickles (घरेलू स्वाद)</option>
                  <option value="gardening_botanicals">Gardening & Botanicals (जड़ी-बूटी)</option>
                  <option value="barter_request">Barter Request (अदला-बदली)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-amber-100 mb-2">
                  Estimated Price (₹ INR / भारतीय रुपये)
                </label>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  className="w-full px-4 py-3 bg-slate-800 border-2 border-slate-700 focus:border-amber-500 rounded-xl text-base text-white outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-amber-100 mb-2">
                  Photo Preview URL
                </label>
                <input
                  type="text"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800 border-2 border-slate-700 focus:border-amber-500 rounded-xl text-base text-white outline-none"
                />
              </div>
            </div>

            {/* Special Badges: Barter & Apprentice */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-950/60 p-5 rounded-2xl border border-slate-800">
              <div className="space-y-3">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isBarter}
                    onChange={(e) => setIsBarter(e.target.checked)}
                    className="w-5 h-5 accent-amber-500 rounded"
                  />
                  <span className="font-bold text-amber-100">
                    Open to Barter / Skill Exchange
                  </span>
                </label>
                {isBarter && (
                  <input
                    type="text"
                    value={barterDetails}
                    onChange={(e) => setBarterDetails(e.target.value)}
                    placeholder="e.g. Phone help, grocery pickup, or lawn assistance"
                    className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white outline-none"
                  />
                )}
              </div>

              <div className="space-y-2">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={digitalApprenticeEligible}
                    onChange={(e) => setDigitalApprenticeEligible(e.target.checked)}
                    className="w-5 h-5 accent-purple-500 rounded"
                  />
                  <span className="font-bold text-purple-200">
                    "Digital Apprentice" Tag (Teach Youth in Exchange for Tech Help)
                  </span>
                </label>
                <p className="text-xs text-slate-400 pl-8">
                  Encourages local youth to visit and learn generational skills while helping you navigate digital tasks.
                </p>
              </div>
            </div>

            {/* Section: Craft Workshop & Pickup Location */}
            <div className="bg-slate-950/80 p-5 rounded-2xl border border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div className="flex items-center space-x-2">
                  <MapPin className="w-5 h-5 text-amber-400 flex-shrink-0" />
                  <div>
                    <span className="text-base font-bold text-amber-100">
                      Craft Workshop & Service Location
                    </span>
                    <p className="text-xs text-slate-400">
                      Where customers will visit for fittings, repairs, or order collection.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleDetectListingGps}
                  disabled={isDetectingLocation}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-400/40 text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer disabled:opacity-50"
                >
                  <LocateFixed className="w-3.5 h-3.5" />
                  <span>Use Device GPS</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-1">
                  <label className="block text-xs font-semibold text-amber-200 mb-1.5">
                    Studio / Street Address
                  </label>
                  <input
                    type="text"
                    value={listingLocation.address}
                    onChange={(e) =>
                      setListingLocation({ ...listingLocation, address: e.target.value })
                    }
                    placeholder="e.g. 22 Temple Bell Lane"
                    className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 focus:border-amber-500 rounded-xl text-sm text-white outline-none"
                  />
                </div>

                <div className="sm:col-span-1">
                  <label className="block text-xs font-semibold text-amber-200 mb-1.5">
                    Neighborhood / Locality
                  </label>
                  <input
                    type="text"
                    value={listingLocation.neighborhood}
                    onChange={(e) =>
                      setListingLocation({ ...listingLocation, neighborhood: e.target.value })
                    }
                    placeholder="e.g. Mylapore or Heritage Quarter"
                    className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 focus:border-amber-500 rounded-xl text-sm text-white outline-none"
                  />
                </div>

                <div className="sm:col-span-1">
                  <label className="block text-xs font-semibold text-amber-200 mb-1.5">
                    City / Metro
                  </label>
                  <input
                    type="text"
                    value={listingLocation.city}
                    onChange={(e) =>
                      setListingLocation({ ...listingLocation, city: e.target.value })
                    }
                    placeholder="e.g. Chennai or Bengaluru"
                    className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 focus:border-amber-500 rounded-xl text-sm text-white outline-none"
                  />
                </div>
              </div>

              {/* Quick Neighborhood Preset Chips */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-semibold text-slate-400">
                  Quick Select Neighborhood:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {POPULAR_NEIGHBORHOOD_PRESETS.slice(0, 6).map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() =>
                        setListingLocation({
                          ...listingLocation,
                          neighborhood: preset.name.split(" ")[0],
                          city: preset.city,
                          lat: preset.lat,
                          lng: preset.lng,
                        })
                      }
                      className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] text-amber-200/90 transition-colors"
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Senior Master Craft Video Demonstration Requirement Section */}
            <div className="p-5 bg-gradient-to-r from-amber-950/70 via-slate-900 to-amber-950/40 border-2 border-amber-500/50 rounded-2xl space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-amber-500/30">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-400 flex-shrink-0">
                    <Video className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-base font-bold text-amber-100">
                        Senior Craft Demonstration Video
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-400/40 uppercase">
                        Recommended for Trust
                      </span>
                    </div>
                    <p className="text-xs text-slate-300">
                      Upload from your device, record with camera, or pick a verified demonstration clip.
                    </p>
                  </div>
                </div>

                {/* Direct Upload and Video Studio Action Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={directVideoInputRef}
                    type="file"
                    accept="video/*,.mp4,.webm,.mov,.m4v,.mkv,.avi,.3gp"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleDirectDeviceVideo(file);
                    }}
                    className="hidden"
                    id="provider-direct-video-input"
                  />

                  <button
                    type="button"
                    id="direct-upload-device-video-btn"
                    onClick={() => directVideoInputRef.current?.click()}
                    disabled={isProcessingDirectVideo}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-amber-200 border border-amber-500/40 font-bold text-xs rounded-xl shadow-md flex items-center space-x-1.5 transition-all cursor-pointer disabled:opacity-50"
                    title="Upload video from phone or computer"
                  >
                    {isProcessingDirectVideo ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                        <span>Processing File...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 text-amber-400" />
                        <span>Upload from Device</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    id="record-video-btn"
                    onClick={() => {
                      setVideoModalTab("upload");
                      setShowVideoModal(true);
                    }}
                    className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-md flex items-center space-x-1.5 transition-all cursor-pointer flex-shrink-0"
                  >
                    <Video className="w-4 h-4" />
                    <span>{videoDemo ? "Change / Re-record Video" : "Record / Studio Options"}</span>
                  </button>
                </div>
              </div>

              {videoDemo ? (
                <div className="p-4 bg-slate-950/80 rounded-xl border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fadeIn">
                  <div className="flex items-center space-x-3">
                    <div className="relative w-20 h-14 rounded-lg overflow-hidden border border-amber-400/40 bg-slate-900 flex-shrink-0">
                      <img
                        src={videoDemo.thumbnailUrl || imageUrl}
                        alt="Video thumbnail"
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-slate-950/40 flex items-center justify-center">
                        <Play className="w-5 h-5 fill-white text-white drop-shadow" />
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-bold text-amber-200">{videoDemo.title}</div>
                      <div className="text-xs text-slate-400 flex items-center space-x-2 mt-0.5">
                        <span className="bg-slate-800 px-1.5 py-0.5 rounded text-[10px] text-amber-300 font-mono">
                          {videoDemo.durationSeconds}s duration
                        </span>
                        <span className="text-emerald-400 font-semibold text-[11px] flex items-center space-x-1">
                          <CheckCircle className="w-3 h-3" />
                          <span>Video Attached & Verified</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() =>
                        setActiveVideoModalListing({
                          id: "preview_temp",
                          providerId: currentUser.id,
                          providerName: currentUser.fullName,
                          providerAvatar: currentUser.avatarUrl,
                          providerLanguage: currentUser.preferredLanguage,
                          title: title || "Craft Video Preview",
                          description: description,
                          category,
                          price,
                          tags: [],
                          imageUrl,
                          videoUrl: videoDemo.videoUrl,
                          videoDemo,
                          videoDurationSeconds: videoDemo.durationSeconds,
                          videoThumbnailUrl: videoDemo.thumbnailUrl,
                          location: artisanLocation,
                          isBarter,
                          digitalApprenticeEligible,
                          available: true,
                          createdAt: new Date().toISOString(),
                        })
                      }
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-bold border border-slate-700 flex items-center space-x-1 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Watch Preview</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => directVideoInputRef.current?.click()}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 cursor-pointer"
                      title="Upload a different video from device"
                    >
                      Replace
                    </button>
                    <button
                      type="button"
                      onClick={() => setVideoDemo(null)}
                      className="px-2.5 py-1.5 rounded-lg bg-red-950/50 hover:bg-red-900/60 text-red-300 text-xs font-bold border border-red-900/50 cursor-pointer"
                      title="Remove video"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDraggingListingVideo(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    setIsDraggingListingVideo(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDraggingListingVideo(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleDirectDeviceVideo(file);
                  }}
                  className={`p-3.5 rounded-xl border-2 border-dashed transition-all flex flex-col sm:flex-row items-center justify-between gap-3 text-xs ${
                    isDraggingListingVideo
                      ? "border-amber-400 bg-amber-500/10 text-amber-200"
                      : "border-slate-800 bg-slate-950/60 text-slate-400 hover:border-amber-500/40"
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <Film className="w-4 h-4 text-amber-400/80 flex-shrink-0" />
                    <span>
                      Drag and drop a video file here, or click to upload directly from your device before publishing.
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => directVideoInputRef.current?.click()}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg cursor-pointer shadow"
                    >
                      Upload File
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setVideoModalTab("upload");
                        setShowVideoModal(true);
                      }}
                      className="text-amber-400 hover:text-amber-300 font-bold underline cursor-pointer"
                    >
                      Studio Options
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-amber-100 mb-2">
                Generational Heritage Story (Why this craft matters)
              </label>
              <input
                type="text"
                value={heritageNotes}
                onChange={(e) => setHeritageNotes(e.target.value)}
                placeholder="e.g. Practiced over 40 years; learned from master weavers in Varanasi."
                className="w-full px-4 py-3 bg-slate-800 border-2 border-slate-700 focus:border-amber-500 rounded-xl text-base text-white outline-none"
              />
            </div>

            <button
              type="submit"
              id="publish-listing-btn"
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xl shadow-xl transition-all flex items-center justify-center space-x-2 cursor-pointer"
            >
              <CheckCircle className="w-6 h-6" />
              <span>
                {editingListingId
                  ? "Save & Update Service Details"
                  : "Publish Listing to Neighborhood Feed"}
              </span>
            </button>
          </form>
        </div>
        )
      )}

      {/* Provider's Active Listings Section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-amber-100 font-serif">
              Your Active Listings & Services ({providerListings.length})
            </h2>
            <p className="text-sm text-slate-400">
              Live in your neighborhood's proximity radar
            </p>
          </div>
        </div>

        {providerListings.length === 0 ? (
          <div className="p-12 text-center bg-slate-900/60 border-2 border-dashed border-slate-800 rounded-3xl space-y-4">
            <Sparkles className="w-12 h-12 text-amber-400 mx-auto opacity-70" />
            <h3 className="text-xl font-bold text-amber-100 font-serif">
              No listings published yet
            </h3>
            <p className="text-slate-400 max-w-md mx-auto">
              Tap the button above to record your first 30s voice story or type what you'd like to share with neighbors.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {providerListings.map((listing) => (
              <div
                key={listing.id}
                className="bg-slate-900 border-2 border-amber-900/30 rounded-3xl overflow-hidden shadow-xl flex flex-col justify-between"
              >
                <div className="relative h-48 bg-slate-950">
                  <img
                    src={listing.imageUrl}
                    alt={listing.title}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute top-3 right-3 flex items-center space-x-2">
                    <button
                      id={`edit-listing-${listing.id}`}
                      onClick={() => handleEditListing(listing)}
                      className="p-2.5 rounded-xl bg-slate-950/90 hover:bg-amber-500 text-amber-300 hover:text-slate-950 transition-all shadow-md cursor-pointer border border-amber-500/40 flex items-center space-x-1"
                      title="Edit Service Details"
                    >
                      <Edit className="w-4 h-4" />
                      <span className="text-xs font-bold px-0.5">Edit</span>
                    </button>
                    <button
                      id={`delete-listing-${listing.id}`}
                      onClick={() => handleRequestDelete(listing)}
                      className="p-2.5 rounded-xl bg-slate-950/90 hover:bg-red-600 text-red-300 hover:text-white transition-all shadow-md cursor-pointer border border-red-500/30"
                      title="Delete Listing"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="absolute bottom-3 left-3 bg-slate-950/90 px-3 py-1 rounded-xl text-amber-300 font-bold text-xs border border-amber-500/40 font-mono">
                    ₹{listing.price.toLocaleString("en-IN")} {listing.isBarter && "• Barter Trade"}
                  </div>
                </div>

                <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <h4 className="text-lg font-bold text-amber-100 font-serif line-clamp-1">
                      {listing.titleEnglish || listing.title}
                    </h4>
                    <p className="text-xs text-slate-300 mt-1 line-clamp-2">
                      {listing.descriptionEnglish || listing.description}
                    </p>
                  </div>

                  {listing.voiceNote && (
                    <AudioPlayerButton
                      voiceNote={listing.voiceNote}
                      fallbackText={listing.description}
                      language={listing.providerLanguage}
                      size="sm"
                      label="Your Voice Note"
                    />
                  )}

                  <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center space-x-1">
                      <Eye className="w-3.5 h-3.5 text-amber-400" />
                      <span>{listing.viewsCount || 42} neighborhood views</span>
                    </span>
                    <span className="text-emerald-400 font-semibold">● Active</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </>
      )}

      {/* Accessible Confirmation Modal for Deleting Listing */}
      {listingToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border-2 border-red-500/60 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-6 text-amber-50 animate-scaleUp">
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 rounded-2xl bg-red-500/20 border border-red-500/50 flex items-center justify-center text-red-400 flex-shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-2xl font-bold text-red-100 font-serif">
                  Remove Listing?
                </h3>
                <p className="text-sm text-slate-300">
                  Are you sure you want to remove{" "}
                  <span className="text-amber-300 font-bold">
                    "{listingToDelete.titleEnglish || listingToDelete.title}"
                  </span>{" "}
                  from your neighborhood radar?
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-950/70 rounded-2xl border border-slate-800 text-xs text-slate-400 space-y-1">
              <div>• Neighbors and customers will no longer see this in their search results.</div>
              <div>• You can always create a new listing at any time.</div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setListingToDelete(null)}
                className="px-5 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm transition-all cursor-pointer border border-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-delete-listing-btn"
                onClick={handleConfirmDelete}
                className="px-6 py-3 rounded-2xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold text-sm shadow-lg shadow-red-900/40 transition-all flex items-center space-x-2 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Yes, Delete Listing</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Workshop & Studio Location Settings Modal */}
      {showLocationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border-2 border-amber-500 rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl space-y-6 text-amber-50 animate-scaleUp">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400 flex items-center justify-center text-amber-400">
                  <MapPin className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-amber-100 font-serif">
                    Set Artisan Studio Location
                  </h3>
                  <p className="text-xs text-slate-300">
                    Your location places your crafts in nearby customer searches (1–10 km).
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowLocationModal(false)}
                className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* GPS Auto-Detect Button */}
            <div className="p-4 bg-slate-950/90 rounded-2xl border border-amber-500/30 flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-amber-200 flex items-center space-x-1.5">
                  <LocateFixed className="w-4 h-4 text-amber-400" />
                  <span>Browser Geolocation Service</span>
                </div>
                <div className="text-[11px] text-slate-400">
                  Detect coordinates directly from your device GPS
                </div>
              </div>
              <button
                type="button"
                onClick={handleDetectArtisanGps}
                disabled={isDetectingLocation}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-md flex items-center space-x-1.5 transition-all cursor-pointer disabled:opacity-50 flex-shrink-0"
              >
                {isDetectingLocation ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-950" />
                    <span>Detecting...</span>
                  </>
                ) : (
                  <>
                    <LocateFixed className="w-3.5 h-3.5" />
                    <span>Detect GPS</span>
                  </>
                )}
              </button>
            </div>

            <form onSubmit={handleSaveWorkshopLocation} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-amber-200 mb-1.5">
                  Studio Street Address / Door No.
                </label>
                <input
                  type="text"
                  value={customAddress}
                  onChange={(e) => setCustomAddress(e.target.value)}
                  placeholder="e.g. 22 Temple Bell Lane, 2nd Floor"
                  className="w-full px-4 py-3 bg-slate-800 border-2 border-slate-700 focus:border-amber-500 rounded-xl text-sm text-white outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-amber-200 mb-1.5">
                    Neighborhood / Locality
                  </label>
                  <input
                    type="text"
                    value={customNeighborhood}
                    onChange={(e) => setCustomNeighborhood(e.target.value)}
                    placeholder="e.g. Mylapore or Indiranagar"
                    className="w-full px-4 py-3 bg-slate-800 border-2 border-slate-700 focus:border-amber-500 rounded-xl text-sm text-white outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-amber-200 mb-1.5">
                    City / Metro
                  </label>
                  <input
                    type="text"
                    value={customCity}
                    onChange={(e) => setCustomCity(e.target.value)}
                    placeholder="e.g. Chennai or Bengaluru"
                    className="w-full px-4 py-3 bg-slate-800 border-2 border-slate-700 focus:border-amber-500 rounded-xl text-sm text-white outline-none"
                    required
                  />
                </div>
              </div>

              {/* Quick Preset Chips */}
              <div className="space-y-1.5 pt-1">
                <label className="block text-[11px] font-semibold text-slate-400">
                  Quick Select Indian / Metro Districts:
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                  {POPULAR_NEIGHBORHOOD_PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => {
                        setCustomNeighborhood(preset.name.split(" ")[0]);
                        setCustomCity(preset.city);
                        setCustomLat(preset.lat);
                        setCustomLng(preset.lng);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-amber-200/90 transition-colors"
                    >
                      {preset.name} ({preset.city})
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowLocationModal(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors border border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-md transition-all flex items-center space-x-1.5 cursor-pointer"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Save Workshop Location</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Senior Craft Video Requirement Prompt Modal */}
      {showVideoRequirementPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 border-2 border-amber-500 rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl space-y-6 text-amber-50 animate-scaleUp">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400 flex items-center justify-center text-amber-400 flex-shrink-0">
                  <Film className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-amber-100 font-serif">
                    Attach Master Craft Demonstration Video
                  </h3>
                  <p className="text-xs text-slate-300">
                    Neighborhood customers and recruiters love seeing senior masters at work.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowVideoRequirementPrompt(false)}
                className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-amber-950/40 rounded-2xl border border-amber-500/40 space-y-2">
              <p className="text-sm text-amber-200">
                To build high trust and verify your senior craftsmanship, please attach a short video demonstration (15–60 seconds) showing your hands, technique, or workshop.
              </p>
              <div className="text-xs text-amber-300/80 flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Increases inquiry responses by 4.8x across local neighborhood circles.</span>
              </div>
            </div>

            <div className="space-y-3">
              {/* Option 1: Direct File Upload from Device */}
              <input
                ref={promptVideoInputRef}
                type="file"
                accept="video/*,.mp4,.webm,.mov,.m4v,.mkv,.avi,.3gp"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    await handleDirectDeviceVideo(file);
                    setShowVideoRequirementPrompt(false);
                    // Automatically publish once the video is processed
                    setTimeout(() => {
                      handleSaveListing(undefined, true);
                    }, 200);
                  }
                }}
                className="hidden"
              />

              <button
                type="button"
                id="prompt-upload-device-video-btn"
                onClick={() => promptVideoInputRef.current?.click()}
                disabled={isProcessingDirectVideo}
                className="w-full p-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm shadow-xl flex items-center justify-between transition-all cursor-pointer disabled:opacity-50"
              >
                <div className="flex items-center space-x-3 text-left">
                  <div className="w-9 h-9 rounded-xl bg-slate-950/20 flex items-center justify-center text-slate-950">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-extrabold text-base">Upload Video from Device</div>
                    <div className="text-xs text-slate-900 font-medium">Select .mp4, .mov, or recorded video from phone/laptop</div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5" />
              </button>

              {/* Option 2: Open Video Studio / Camera Recording */}
              <button
                type="button"
                onClick={() => {
                  setShowVideoRequirementPrompt(false);
                  setVideoModalTab("upload");
                  setShowVideoModal(true);
                }}
                className="w-full p-4 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-200 font-bold text-sm flex items-center justify-between transition-all cursor-pointer"
              >
                <div className="flex items-center space-x-3 text-left">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                    <Camera className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-sm text-amber-100">Open Video Studio & Record</div>
                    <div className="text-xs text-slate-400">Use live camera, webcam, or curated presets</div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400" />
              </button>

              {/* Option 3: Quick Preset Selection */}
              {CRAFT_VIDEO_PRESETS.length > 0 && (
                <div className="pt-2">
                  <div className="text-xs font-semibold text-slate-400 mb-2">
                    Or select a verified sample demonstration clip:
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(CRAFT_VIDEO_PRESETS.filter((p) => p.category === category).length > 0
                      ? CRAFT_VIDEO_PRESETS.filter((p) => p.category === category)
                      : CRAFT_VIDEO_PRESETS
                    ).slice(0, 2).map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleSelectPresetAndPublish(preset)}
                        className="p-2.5 rounded-xl bg-slate-950 hover:bg-amber-950/40 border border-slate-800 hover:border-amber-500/40 text-left flex items-center space-x-2.5 transition-all cursor-pointer"
                      >
                        <div className="w-12 h-10 rounded-lg overflow-hidden relative flex-shrink-0 bg-slate-900 border border-amber-500/30">
                          <img
                            src={preset.thumbnailUrl}
                            alt={preset.title}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <Play className="w-3.5 h-3.5 fill-white text-white absolute inset-0 m-auto drop-shadow" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-amber-100 truncate">{preset.title}</div>
                          <div className="text-[10px] text-amber-300/80 font-mono">{preset.durationSeconds}s sample</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Skip Option */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowVideoRequirementPrompt(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Back to Editing
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowVideoRequirementPrompt(false);
                  handleSaveListing(undefined, true);
                }}
                className="text-xs text-amber-400/80 hover:text-amber-300 font-semibold underline cursor-pointer"
              >
                Publish without Video (Text-Only)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Video Recorder / Studio Modal */}
      {showVideoModal && (
        <VideoRecorderModal
          category={category}
          artisanName={currentUser.fullName}
          initialVideo={videoDemo}
          onVideoSelected={(video) => {
            setVideoDemo(video);
            setShowVideoModal(false);
            setToastMessage(`🎬 Video attached: ${video.title}!`);
            setTimeout(() => setToastMessage(null), 3500);
          }}
          onClose={() => setShowVideoModal(false)}
        />
      )}

      {/* Video Player Modal */}
      {activeVideoModalListing && (
        <VideoPlayerModal
          listing={activeVideoModalListing}
          onClose={() => setActiveVideoModalListing(null)}
        />
      )}

      {/* Service Reviews Modal */}
      {activeReviewsListing && (
        <ServiceReviewsModal
          listing={activeReviewsListing}
          onClose={() => setActiveReviewsListing(null)}
        />
      )}

      {/* Floating Success Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md p-4 rounded-2xl bg-slate-900 border-2 border-amber-500 text-amber-100 shadow-2xl flex items-center space-x-3 animate-slideUp">
          <CheckCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
