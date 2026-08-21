import React, { useState, useEffect, useRef } from "react";
import {
  MessageSquare,
  Search,
  Phone,
  MapPin,
  Sparkles,
  Mic,
  Send,
  Volume2,
  VolumeX,
  Clock,
  CheckCheck,
  Check,
  Repeat,
  GraduationCap,
  Store,
  ChevronRight,
  Filter,
  X,
  Play,
  Pause,
  AlertCircle,
  HelpCircle,
  ShieldCheck,
  Compass,
  ArrowLeft,
  Share2,
  User as UserIcon,
} from "lucide-react";
import { User, ChatMessage, Conversation, GeoLocation, VoiceNote } from "../types";
import {
  subscribeToMessages,
  saveMessage,
  markConversationAsRead,
  getConversationsForUser,
  getStoredUsers,
} from "../services/storageService";
import {
  translateMessage,
  transliterateToNative,
} from "../services/geminiService";
import {
  speakText,
  stopSpeech,
  startVoiceRecognition,
  detectLanguageFromText,
  SpeechTranscriber,
  SUPPORTED_SPEECH_LANGUAGES,
} from "../services/audioService";
import { calculateDistance, formatDistance } from "../services/locationService";
import { AudioVoiceRecorder } from "./AudioVoiceRecorder";

interface ClientMessagesPanelProps {
  currentUser: User;
  onClose?: () => void;
  initialConversationId?: string;
  isEmbedded?: boolean;
  onViewListing?: (listingId: string) => void;
  largeTextMode?: boolean;
}

export const ClientMessagesPanel: React.FC<ClientMessagesPanelProps> = ({
  currentUser,
  onClose,
  initialConversationId,
  isEmbedded = false,
  onViewListing,
  largeTextMode = false,
}) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(
    initialConversationId || null
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<
    "all" | "unread" | "barter" | "voicenote" | "apprentice"
  >("all");

  // Message input state
  const [replyText, setReplyText] = useState("");
  const [replyLanguage, setReplyLanguage] = useState<string>(
    currentUser.preferredLanguage || "Hindi"
  );
  const [isSending, setIsSending] = useState(false);
  const [isMicActive, setIsMicActive] = useState(false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Audio Playback State
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [isSpeakingThread, setIsSpeakingThread] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const transcriberRef = useRef<SpeechTranscriber>(new SpeechTranscriber());

  // Subscribe to real-time messages & conversations
  useEffect(() => {
    const loadConversations = () => {
      const userConvs = getConversationsForUser(currentUser.id);
      setConversations(userConvs);

      // Auto-select first conversation or initialConversationId
      setSelectedConversationId((prev) => {
        if (prev && userConvs.some((c) => c.id === prev)) {
          return prev;
        }
        if (initialConversationId && userConvs.some((c) => c.id === initialConversationId)) {
          return initialConversationId;
        }
        return userConvs.length > 0 ? userConvs[0].id : null;
      });
    };

    loadConversations();
    const unsub = subscribeToMessages(() => {
      loadConversations();
    });

    return () => {
      unsub();
      stopSpeech();
    };
  }, [currentUser.id, initialConversationId]);

  // When selected conversation changes, load messages & mark as read
  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([]);
      return;
    }

    const loadThreadMessages = (allMsgs: ChatMessage[]) => {
      const filtered = allMsgs.filter((m) => m.conversationId === selectedConversationId);
      filtered.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      setMessages(filtered);
    };

    const convMessages = subscribeToMessages((allMsgs) => {
      loadThreadMessages(allMsgs);
    });

    // Mark conversation as read
    markConversationAsRead(selectedConversationId, currentUser.id);

    return () => {
      convMessages();
    };
  }, [selectedConversationId, currentUser.id]);

  // Scroll to bottom of message thread
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const activeConversation = conversations.find((c) => c.id === selectedConversationId);

  const isMeProvider = currentUser.role === "provider";

  // Filter conversations
  const filteredConversations = conversations.filter((conv) => {
    const otherPartyName = isMeProvider ? conv.customerName : conv.providerName;
    // Search query
    const matchSearch =
      !searchQuery.trim() ||
      otherPartyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.providerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (conv.listingTitle && conv.listingTitle.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (conv.lastMessage && conv.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (conv.lastMessageTranslated && conv.lastMessageTranslated.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchSearch) return false;

    if (activeFilter === "unread") return conv.unreadCount > 0;
    if (activeFilter === "barter") return conv.isBarter;
    if (activeFilter === "voicenote") return conv.hasVoiceNote;
    if (activeFilter === "apprentice") return conv.digitalApprenticeEligible;

    return true;
  });

  // Calculate distance to client/artisan
  const clientDistance =
    currentUser.location && activeConversation?.customerLocation
      ? calculateDistance(
          currentUser.location.lat,
          currentUser.location.lng,
          activeConversation.customerLocation.lat,
          activeConversation.customerLocation.lng
        )
      : null;

  // Handle Send Text Message
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || replyText).trim();
    if (!text || !selectedConversationId) return;

    setIsSending(true);
    try {
      const conv = activeConversation || conversations.find((c) => c.id === selectedConversationId);
      const isSenderProvider = currentUser.role === "provider";
      
      const targetLanguage = conv
        ? isSenderProvider
          ? conv.customerLanguage || "English"
          : conv.providerLanguage || "Hindi"
        : "English";

      // Translate message for dual-language support
      let translatedText = text;
      try {
        if (replyLanguage !== targetLanguage) {
          const transResult = await translateMessage(text, targetLanguage, replyLanguage);
          if (transResult && transResult.translatedText) {
            translatedText = transResult.translatedText;
          }
        }
      } catch (err) {
        console.warn("Translation fallback notice:", err);
      }

      const newMsg: ChatMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        conversationId: selectedConversationId,
        senderId: currentUser.id,
        senderName: currentUser.fullName,
        senderRole: currentUser.role,
        originalText: text,
        translatedText: translatedText !== text ? translatedText : undefined,
        sourceLanguage: replyLanguage,
        targetLanguage: targetLanguage,
        timestamp: new Date().toISOString(),
        isRead: false,
      };

      await saveMessage(newMsg);
      setReplyText("");
      setToastMessage(isSenderProvider ? "✨ Message sent to client!" : "✨ Message sent to artisan!");
      setTimeout(() => setToastMessage(null), 3000);
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setIsSending(false);
    }
  };

  // Handle Voice Note Sent
  const handleSendVoiceNote = async (voiceNote: VoiceNote) => {
    if (!selectedConversationId) return;

    const conv = activeConversation || conversations.find((c) => c.id === selectedConversationId);
    const isSenderProvider = currentUser.role === "provider";

    const targetLanguage = conv
      ? isSenderProvider
        ? conv.customerLanguage || "English"
        : conv.providerLanguage || "Hindi"
      : "English";

    let translatedText = voiceNote.transcript;
    if (voiceNote.transcript && voiceNote.language !== targetLanguage) {
      try {
        const trans = await translateMessage(voiceNote.transcript, targetLanguage, voiceNote.language);
        if (trans && trans.translatedText) {
          translatedText = trans.translatedText;
        }
      } catch (e) {
        console.warn("Voice note translation fallback:", e);
      }
    }

    const newMsg: ChatMessage = {
      id: `msg_vn_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      conversationId: selectedConversationId,
      senderId: currentUser.id,
      senderName: currentUser.fullName,
      senderRole: currentUser.role,
      originalText: voiceNote.transcript || "🎙️ [Voice Note Audio Message]",
      translatedText: translatedText !== voiceNote.transcript ? translatedText : undefined,
      sourceLanguage: voiceNote.language || replyLanguage,
      targetLanguage: targetLanguage,
      voiceNote: voiceNote,
      timestamp: new Date().toISOString(),
      isRead: false,
    };

    await saveMessage(newMsg);
    setShowVoiceRecorder(false);
    setToastMessage(isSenderProvider ? "✨ Voice note sent to client!" : "✨ Voice note sent to artisan!");
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Speech Recognition for input
  const toggleSpeechRecognition = async () => {
    if (isMicActive) {
      setIsMicActive(false);
      const result = await transcriberRef.current.stop();
      if (result.transcript) {
        setReplyText((prev) => (prev ? `${prev} ${result.transcript}` : result.transcript));
      }
      return;
    }

    setIsMicActive(true);
    setToastMessage("🎙️ Speak your message naturally...");
    setTimeout(() => setToastMessage(null), 2500);

    await transcriberRef.current.start({
      language: replyLanguage || "auto",
      onTranscriptUpdate: (text, isFinal) => {
        if (text) {
          setReplyText(text);
          const detected = detectLanguageFromText(text);
          if (detected && detected.name !== replyLanguage) {
            setReplyLanguage(detected.name);
          }
        }
        if (isFinal) setIsMicActive(false);
      },
      onStateChange: (active) => setIsMicActive(active),
      onError: () => setIsMicActive(false),
    });
  };

  // Speak Single Message Aloud
  const handleSpeakMessage = (msg: ChatMessage) => {
    if (playingAudioId === msg.id) {
      stopSpeech();
      setPlayingAudioId(null);
      return;
    }

    setPlayingAudioId(msg.id);
    const textToSpeak =
      currentUser.preferredLanguage === msg.sourceLanguage
        ? msg.originalText
        : msg.translatedText || msg.originalText;

    speakText(textToSpeak, currentUser.preferredLanguage || msg.sourceLanguage, () => {
      setPlayingAudioId(null);
    });
  };

  // Read Entire Conversation Thread Aloud
  const handleSpeakEntireThread = () => {
    if (isSpeakingThread) {
      stopSpeech();
      setIsSpeakingThread(false);
      return;
    }

    if (messages.length === 0) return;

    setIsSpeakingThread(true);
    const combinedSpeech = messages
      .map((m) => {
        const speaker = m.senderId === currentUser.id ? "You" : m.senderName;
        const body =
          currentUser.preferredLanguage === m.sourceLanguage
            ? m.originalText
            : m.translatedText || m.originalText;
        return `${speaker} says: ${body}`;
      })
      .join(". ... ");

    speakText(combinedSpeech, currentUser.preferredLanguage || "English", () => {
      setIsSpeakingThread(false);
    });
  };

  // Senior-Friendly One-Click Quick Replies (Client vs Provider tailored)
  const quickReplies = isMeProvider
    ? [
        {
          label: "✅ Yes, I can do this! Drop it off",
          text: "नमस्ते! हाँ, मैं यह काम खुशी से कर दूँगी। आप इसे किसी भी दिन सुबह 10 से शाम 6 बजे के बीच मेरे वर्कशॉप पर ला सकते हैं।",
        },
        {
          label: "🤝 Agree to Barter Exchange",
          text: "मुझे वस्तु-विनिमय (Barter) स्वीकार है! मैं यह काम कर दूँगा, बदले में आपके स्मार्टफोन/कंप्यूटर ज्ञान से मेरी मदद हो जाएगी।",
        },
        {
          label: "📍 Share Studio Address",
          text: `मेरा वर्कशॉप पता: ${currentUser.location.address}, ${currentUser.location.neighborhood}, ${currentUser.location.city}। कृपया आने से पहले फोन कर लें।`,
        },
        {
          label: "🎪 Meet at Neighborhood Bazaar",
          text: "क्या हम इस शनिवार को होने वाले नेबरहुड आर्टिसन बाज़ार (Bazaar) में मिल सकते हैं? वहाँ मेरा स्टॉल रहेगा।",
        },
        {
          label: "📞 I will call you shortly",
          text: "नमस्ते! मैंने आपका संदेश पढ़ लिया है। मैं 15 मिनट में आपके फोन नंबर पर कॉल करके विस्तार से बात करता हूँ।",
        },
      ]
    : [
        {
          label: "✅ Confirming workshop visit",
          text: "Thank you for the reply! I will bring the item over to your workshop as scheduled.",
        },
        {
          label: "🤝 Agree to barter exchange",
          text: "The barter trade works perfectly for me! Looking forward to helping with technology in exchange for your craft.",
        },
        {
          label: "⏰ What time suits you best?",
          text: "Could you please let me know what time is most convenient to visit your workshop?",
        },
        {
          label: "🎪 Let's meet at the Bazaar",
          text: "I will visit your stall at the upcoming Neighborhood Artisan Bazaar and bring the craft over!",
        },
        {
          label: "📞 Please feel free to call me",
          text: "Thank you! You can reach me on my phone if you have any questions before I arrive.",
        },
      ];

  const totalUnreadCount = conversations.reduce((acc, c) => acc + c.unreadCount, 0);

  return (
    <div
      id="client-messages-panel"
      className={`bg-slate-900 border-2 border-amber-500/40 rounded-3xl overflow-hidden shadow-2xl flex flex-col text-slate-100 ${
        isEmbedded ? "w-full min-h-[700px] my-4" : "w-full h-full max-w-6xl mx-auto"
      } ${largeTextMode ? "text-lg" : "text-sm"}`}
    >
      {/* Header Bar */}
      <div className="bg-slate-950 px-5 sm:px-8 py-5 border-b border-amber-500/30 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400 flex items-center justify-center text-amber-400 shadow-md">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xl sm:text-2xl font-bold font-serif text-amber-100">
                {isMeProvider ? "Received Client Messages & Inquiries" : "Artisan Messages & Craft Inquiries"}
              </h2>
              {totalUnreadCount > 0 && (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-bold text-xs animate-pulse">
                  {totalUnreadCount} New
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-400">
              {isMeProvider
                ? "Direct inquiries, restoration requests, and barter proposals from your local community"
                : "Direct replies, estimates, voice notes, and craft updates from neighborhood senior artisans"}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {onClose && (
            <button
              onClick={onClose}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Close Messages Panel"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Panel Content: 2-Column Responsive Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-[580px] divide-y lg:divide-y-0 lg:divide-x divide-slate-800 overflow-hidden">
        {/* Left Column: Conversations List & Search (4 Cols) */}
        <div className="lg:col-span-5 flex flex-col bg-slate-950/60 overflow-hidden">
          {/* Search & Filter Bar */}
          <div className="p-4 border-b border-slate-800/80 space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isMeProvider ? "Search client, message, or craft..." : "Search artisan, message, or craft..."}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700/80 focus:border-amber-500 rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-500 outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
              {[
                { id: "all", label: isMeProvider ? "All Inquiries" : "All Messages", count: conversations.length },
                {
                  id: "unread",
                  label: "🔴 Unread",
                  count: totalUnreadCount,
                  highlight: totalUnreadCount > 0,
                },
                {
                  id: "barter",
                  label: "🤝 Barter",
                  count: conversations.filter((c) => c.isBarter).length,
                },
                {
                  id: "voicenote",
                  label: "🎙️ Voice Notes",
                  count: conversations.filter((c) => c.hasVoiceNote).length,
                },
                {
                  id: "apprentice",
                  label: "🎓 Apprentice",
                  count: conversations.filter((c) => c.digitalApprenticeEligible).length,
                },
              ].map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setActiveFilter(filter.id as any)}
                  className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer flex items-center space-x-1.5 ${
                    activeFilter === filter.id
                      ? "bg-amber-500 text-slate-950 shadow-md"
                      : "bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800"
                  }`}
                >
                  <span>{filter.label}</span>
                  {filter.count > 0 && (
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                        activeFilter === filter.id
                          ? "bg-slate-950 text-amber-300"
                          : filter.highlight
                          ? "bg-emerald-500 text-slate-950"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {filter.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Conversations Scrollable List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 p-2 space-y-1">
            {filteredConversations.length === 0 ? (
              <div className="p-8 text-center space-y-3">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <div className="text-sm font-bold text-slate-300">
                  {isMeProvider ? "No client inquiries found" : "No artisan messages yet"}
                </div>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  {searchQuery
                    ? `No conversations match "${searchQuery}". Try clearing filters.`
                    : isMeProvider
                    ? "When clients contact you regarding your heritage craft listings, their messages appear here."
                    : "When you contact senior artisans from the Neighbours Feed, their replies and quotes will appear here."}
                </p>
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isSelected = conv.id === selectedConversationId;
                const isUnread = conv.unreadCount > 0;
                const displayName = isMeProvider ? conv.customerName : conv.providerName;
                const displayAvatar = isMeProvider ? conv.customerAvatar : conv.providerAvatar;

                // Format timestamp
                const msgDate = new Date(conv.lastMessageTimestamp);
                const isToday = new Date().toDateString() === msgDate.toDateString();
                const timeString = isToday
                  ? msgDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                  : msgDate.toLocaleDateString([], { month: "short", day: "numeric" });

                return (
                  <button
                    key={conv.id}
                    onClick={() => setSelectedConversationId(conv.id)}
                    className={`w-full p-3.5 rounded-2xl text-left transition-all cursor-pointer flex items-start space-x-3 relative ${
                      isSelected
                        ? "bg-amber-500/15 border-2 border-amber-400/80 shadow-md"
                        : "hover:bg-slate-900/80 border border-transparent"
                    }`}
                  >
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      {displayAvatar ? (
                        <img
                          src={displayAvatar}
                          alt={displayName}
                          className="w-12 h-12 rounded-2xl object-cover border-2 border-amber-500/40"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-400 font-bold">
                          {displayName.charAt(0)}
                        </div>
                      )}
                      {isUnread && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-slate-950 animate-pulse" />
                      )}
                    </div>

                    {/* Meta & Snippet */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1.5 truncate">
                          <span
                            className={`font-bold text-sm truncate ${
                              isSelected ? "text-amber-200" : "text-slate-200"
                            }`}
                          >
                            {displayName}
                          </span>
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                        </div>
                        <span className="text-[11px] text-slate-400 flex-shrink-0 ml-1">
                          {timeString}
                        </span>
                      </div>

                      {/* Location snippet */}
                      {conv.customerLocation && (
                        <div className="flex items-center space-x-1 text-[11px] text-slate-400">
                          <MapPin className="w-3 h-3 text-amber-400 flex-shrink-0" />
                          <span className="truncate">{conv.customerLocation.neighborhood}</span>
                        </div>
                      )}

                      {/* Listing Badge */}
                      {conv.listingTitle && (
                        <div className="text-[11px] px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-800 text-amber-300 font-medium truncate flex items-center space-x-1">
                          <span>🧵</span>
                          <span className="truncate">{conv.listingTitle}</span>
                        </div>
                      )}

                      {/* Message Preview */}
                      <p className="text-xs text-slate-400 line-clamp-1 italic">
                        {conv.hasVoiceNote && "🎙️ Voice Note • "}
                        {conv.lastMessage || (isMeProvider ? "Client started an inquiry" : "Artisan replied")}
                      </p>

                      {/* Badges row */}
                      <div className="flex items-center gap-1 pt-0.5">
                        {conv.isBarter && (
                          <span className="px-1.5 py-0.2 rounded-md bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[10px] font-bold">
                            🤝 Barter Request
                          </span>
                        )}
                        {conv.digitalApprenticeEligible && (
                          <span className="px-1.5 py-0.2 rounded-md bg-sky-500/20 border border-sky-400/40 text-sky-300 text-[10px] font-bold">
                            🎓 Apprentice
                          </span>
                        )}
                        {isUnread && (
                          <span className="ml-auto px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-bold text-[10px]">
                            {conv.unreadCount} new
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Active Conversation Studio (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col bg-slate-900/40 overflow-hidden">
          {activeConversation ? (
            <>
              {/* Other Party & Listing Profile Header */}
              <div className="p-4 sm:p-5 bg-slate-950 border-b border-slate-800/90 space-y-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center space-x-3">
                    {(isMeProvider ? activeConversation.customerAvatar : activeConversation.providerAvatar) ? (
                      <img
                        src={isMeProvider ? activeConversation.customerAvatar : activeConversation.providerAvatar}
                        alt={isMeProvider ? activeConversation.customerName : activeConversation.providerName}
                        className="w-12 h-12 rounded-2xl object-cover border-2 border-amber-400"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-400 font-bold text-lg">
                        {(isMeProvider ? activeConversation.customerName : activeConversation.providerName).charAt(0)}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="text-base sm:text-lg font-bold text-amber-100">
                          {isMeProvider ? activeConversation.customerName : activeConversation.providerName}
                        </h3>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-[10px] font-bold flex items-center space-x-1">
                          <ShieldCheck className="w-3 h-3" />
                          <span>{isMeProvider ? "Verified Neighbor" : "Senior Artisan Master"}</span>
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-0.5">
                        {activeConversation.customerLocation && (
                          <span className="flex items-center space-x-1">
                            <MapPin className="w-3.5 h-3.5 text-amber-400" />
                            <span>
                              {activeConversation.customerLocation.neighborhood}
                              {clientDistance !== null && ` (${formatDistance(clientDistance)})`}
                            </span>
                          </span>
                        )}
                        {activeConversation.customerPhone && (
                          <span className="text-amber-300 font-mono">
                            • {activeConversation.customerPhone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions: Call & Read Aloud */}
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    {activeConversation.customerPhone && (
                      <a
                        href={`tel:${activeConversation.customerPhone}`}
                        id="call-contact-phone-btn"
                        className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center space-x-1.5 shadow-md transition-all cursor-pointer"
                      >
                        <Phone className="w-4 h-4" />
                        <span>{isMeProvider ? "Call Client" : "Call Artisan"}</span>
                      </a>
                    )}

                    <button
                      onClick={handleSpeakEntireThread}
                      className={`flex-1 sm:flex-none px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                        isSpeakingThread
                          ? "bg-amber-500 text-slate-950 border-amber-400 shadow-lg animate-pulse"
                          : "bg-slate-800 hover:bg-slate-700 text-amber-200 border-slate-700"
                      }`}
                      title="Listen to the whole conversation in native audio"
                    >
                      {isSpeakingThread ? (
                        <>
                          <VolumeX className="w-4 h-4" />
                          <span>Stop Audio</span>
                        </>
                      ) : (
                        <>
                          <Volume2 className="w-4 h-4 text-amber-400" />
                          <span>Listen Aloud</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Inquired Listing Mini-Card */}
                {activeConversation.listingTitle && (
                  <div className="p-3 rounded-2xl bg-slate-900 border border-amber-500/30 flex items-center justify-between gap-3">
                    <div className="flex items-center space-x-3 min-w-0">
                      {activeConversation.listingImageUrl && (
                        <img
                          src={activeConversation.listingImageUrl}
                          alt={activeConversation.listingTitle}
                          className="w-12 h-12 rounded-xl object-cover border border-slate-700 flex-shrink-0"
                        />
                      )}
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-amber-200 truncate">
                          Inquiry for: {activeConversation.listingTitle}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center space-x-2">
                          {activeConversation.listingPrice && (
                            <span className="font-bold text-emerald-400">
                              ₹{activeConversation.listingPrice}
                            </span>
                          )}
                          {activeConversation.isBarter && (
                            <span className="text-amber-300">
                              • Barter: {activeConversation.barterDetails || "Skills Exchange"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {activeConversation.listingId && onViewListing && (
                      <button
                        onClick={() => onViewListing(activeConversation.listingId!)}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-bold flex-shrink-0 border border-slate-700"
                      >
                        View Craft
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Message Thread Scroll Area */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                {messages.map((msg) => {
                  const isMe = msg.senderId === currentUser.id;
                  const isPlaying = playingAudioId === msg.id;

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                    >
                      <div className="flex items-end space-x-2 max-w-[88%] sm:max-w-[78%]">
                        {!isMe && (
                          <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] text-amber-400 font-bold flex-shrink-0 mb-1">
                            {msg.senderName.charAt(0)}
                          </div>
                        )}

                        <div
                          className={`p-4 rounded-3xl space-y-2 shadow-lg ${
                            isMe
                              ? "bg-amber-600/90 text-slate-950 rounded-br-none border border-amber-400/50"
                              : "bg-slate-800 text-slate-100 rounded-bl-none border border-slate-700"
                          }`}
                        >
                          {/* Sender name for client */}
                          {!isMe && (
                            <div className="text-[11px] font-bold text-amber-300 flex items-center justify-between">
                              <span>{msg.senderName}</span>
                              <span className="text-[10px] text-slate-400">
                                {msg.sourceLanguage}
                              </span>
                            </div>
                          )}

                          {/* Voice Note Audio Player */}
                          {msg.voiceNote && (
                            <div
                              className={`p-2.5 rounded-2xl flex items-center space-x-3 ${
                                isMe ? "bg-amber-700/60" : "bg-slate-900 border border-slate-700"
                              }`}
                            >
                              <button
                                onClick={() => handleSpeakMessage(msg)}
                                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                  isPlaying
                                    ? "bg-emerald-500 text-slate-950 animate-pulse"
                                    : "bg-amber-500 text-slate-950"
                                }`}
                              >
                                {isPlaying ? (
                                  <Pause className="w-4 h-4" />
                                ) : (
                                  <Play className="w-4 h-4 ml-0.5" />
                                )}
                              </button>
                              <div className="text-xs">
                                <div className="font-bold flex items-center space-x-1">
                                  <span>🎙️ Voice Note</span>
                                  <span className="text-[10px] opacity-80">
                                    ({msg.voiceNote.durationSeconds}s)
                                  </span>
                                </div>
                                {msg.voiceNote.transcript && (
                                  <p className="text-[11px] opacity-90 italic line-clamp-2">
                                    "{msg.voiceNote.transcript}"
                                  </p>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Original Message Text */}
                          <p
                            className={`text-sm leading-relaxed ${
                              isMe ? "font-medium text-slate-950" : "text-slate-100"
                            }`}
                          >
                            {msg.originalText}
                          </p>

                          {/* Translated Message Box */}
                          {msg.translatedText && msg.translatedText !== msg.originalText && (
                            <div
                              className={`pt-2 border-t text-xs space-y-0.5 ${
                                isMe
                                  ? "border-amber-700/50 text-slate-900 bg-amber-500/20 p-2 rounded-xl"
                                  : "border-slate-700 text-amber-200 bg-slate-900/60 p-2 rounded-xl"
                              }`}
                            >
                              <div className="flex items-center space-x-1 text-[10px] font-bold uppercase opacity-75">
                                <Sparkles className="w-3 h-3 text-amber-400" />
                                <span>Translation ({msg.targetLanguage}):</span>
                              </div>
                              <p className="italic">{msg.translatedText}</p>
                            </div>
                          )}

                          {/* Bottom Row: Timestamp & Speak Aloud Button */}
                          <div className="flex items-center justify-between pt-1 text-[10px] opacity-75">
                            <button
                              onClick={() => handleSpeakMessage(msg)}
                              className="hover:underline flex items-center space-x-1 cursor-pointer"
                              title="Listen aloud in native pronunciation"
                            >
                              <Volume2 className="w-3 h-3" />
                              <span>{isPlaying ? "Speaking..." : "Listen"}</span>
                            </button>

                            <div className="flex items-center space-x-1">
                              <span>
                                {new Date(msg.timestamp).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                              {isMe && (
                                <span>
                                  {msg.isRead ? (
                                    <CheckCheck className="w-3.5 h-3.5 text-emerald-950 font-bold" />
                                  ) : (
                                    <Check className="w-3.5 h-3.5 text-slate-800" />
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Senior-Friendly Quick Action Reply Buttons */}
              <div className="px-4 py-2.5 bg-slate-950/80 border-t border-slate-800 overflow-x-auto scrollbar-none flex items-center gap-2">
                <span className="text-[11px] font-bold text-amber-400 flex items-center space-x-1 flex-shrink-0">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Quick Reply:</span>
                </span>
                {quickReplies.map((qr, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(qr.text)}
                    className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs text-amber-200 font-medium whitespace-nowrap transition-all cursor-pointer flex-shrink-0"
                  >
                    {qr.label}
                  </button>
                ))}
              </div>

              {/* Interactive Audio Voice Recorder Modal/Drawer if open */}
              {showVoiceRecorder && (
                <div className="p-4 bg-slate-950 border-t-2 border-amber-500/60 animate-fadeIn">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-amber-200 flex items-center space-x-1.5">
                      <Mic className="w-4 h-4 text-amber-400" />
                      <span>Record 30-Second Voice Message for Client:</span>
                    </span>
                    <button
                      onClick={() => setShowVoiceRecorder(false)}
                      className="text-xs text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                  <AudioVoiceRecorder
                    onVoiceRecorded={handleSendVoiceNote}
                    defaultLanguage={replyLanguage}
                  />
                </div>
              )}

              {/* Reply Input Bar */}
              <div className="p-4 bg-slate-950 border-t border-slate-800 space-y-2">
                {/* Language Picker for Reply */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2">
                    <span className="text-[11px] text-slate-400">Speak or write in:</span>
                    <select
                      value={replyLanguage}
                      onChange={(e) => setReplyLanguage(e.target.value)}
                      className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-amber-200 outline-none"
                    >
                      {SUPPORTED_SPEECH_LANGUAGES.map((lang) => (
                        <option key={lang.name} value={lang.name}>
                          {lang.nativeName} ({lang.name})
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowVoiceRecorder(!showVoiceRecorder)}
                    className="text-xs font-bold text-amber-300 hover:text-amber-100 flex items-center space-x-1"
                  >
                    <Mic className="w-3.5 h-3.5" />
                    <span>{showVoiceRecorder ? "Close Voice Note" : "Attach Voice Note"}</span>
                  </button>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="flex items-center space-x-2"
                >
                  {/* Microphone Speech-To-Text */}
                  <button
                    type="button"
                    onClick={toggleSpeechRecognition}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex-shrink-0 ${
                      isMicActive
                        ? "bg-red-500 text-white border-red-400 animate-pulse shadow-lg"
                        : "bg-slate-900 hover:bg-slate-800 text-amber-400 border-slate-700"
                    }`}
                    title="Live Voice Dictation"
                  >
                    <Mic className="w-5 h-5" />
                  </button>

                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder={`Reply in ${replyLanguage} (Auto-translates for client)...`}
                    className="flex-1 px-4 py-3 bg-slate-900 border-2 border-slate-800 focus:border-amber-500 rounded-2xl text-sm text-slate-100 placeholder-slate-500 outline-none transition-colors"
                  />

                  <button
                    type="submit"
                    disabled={!replyText.trim() || isSending}
                    className="px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm shadow-md flex items-center space-x-1.5 disabled:opacity-40 transition-all cursor-pointer flex-shrink-0"
                  >
                    <Send className="w-4 h-4" />
                    <span>Send</span>
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-slate-800 border-2 border-amber-500/30 flex items-center justify-center text-amber-400">
                <MessageSquare className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-amber-100 font-serif">
                Select a Client Inquiry
              </h3>
              <p className="text-sm text-slate-400 max-w-md">
                Choose a conversation from the left to view customer messages, hear voice notes, review barter proposals, and reply in your native tongue.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Floating Success Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-2xl bg-slate-900 border-2 border-amber-500 text-amber-100 shadow-2xl flex items-center space-x-3 animate-slideUp">
          <Sparkles className="w-5 h-5 text-amber-400 flex-shrink-0" />
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
