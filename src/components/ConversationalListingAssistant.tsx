import React, { useState, useEffect, useRef } from "react";
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Send,
  Sparkles,
  MapPin,
  LocateFixed,
  ShieldCheck,
  Languages,
  CheckCircle2,
  RefreshCw,
  Edit3,
  Check,
  Loader2,
  HelpCircle,
  ArrowRight,
  User as UserIcon,
  Tag,
  DollarSign,
  Package,
  Calendar,
  AlertCircle,
  Radio,
  FileText
} from "lucide-react";
import { User, GeoLocation, Listing, ListingCategory } from "../types";
import {
  speakText,
  stopSpeaking,
  LiveVoiceTranscriber,
  detectLanguageFromText,
  SUPPORTED_SPEECH_LANGUAGES
} from "../services/audioService";
import {
  fetchConversationalInterviewStep,
  ConversationalInterviewResponse
} from "../services/geminiService";
import { getDetailedSystemLocation } from "../services/locationService";
import { ListingCard } from "./ListingCard";

interface Message {
  id: string;
  sender: "bot" | "user";
  text: string;
  textEnglish?: string;
  timestamp: string;
  step?: number;
  actionType?: "detect_location" | "none";
  isSystem?: boolean;
}

interface CollectedArtisanData {
  name?: string;
  age?: number | string;
  skill?: string;
  pricing?: {
    price: number;
    isBarter: boolean;
    rawText?: string;
  };
  products?: string;
  location?: GeoLocation;
}

interface ConversationalListingAssistantProps {
  currentUser: User;
  onSaveListing: (listing: Listing) => void;
  onSwitchToManual: () => void;
  initialLanguage?: string;
}

export const ConversationalListingAssistant: React.FC<ConversationalListingAssistantProps> = ({
  currentUser,
  onSaveListing,
  onSwitchToManual,
  initialLanguage = "Tamil"
}) => {
  const [preferredLang, setPreferredLang] = useState<string>(
    currentUser.preferredLanguage || initialLanguage || "Tamil"
  );
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isSpeakingEnabled, setIsSpeakingEnabled] = useState<boolean>(true);
  const [isCurrentlySpeaking, setIsCurrentlySpeaking] = useState<boolean>(false);
  const [inputText, setInputText] = useState<string>("");
  const [isMicActive, setIsMicActive] = useState<boolean>(false);
  const [isLoadingNextStep, setIsLoadingNextStep] = useState<boolean>(false);
  const [isDetectingGps, setIsDetectingGps] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Collected responses
  const [collectedData, setCollectedData] = useState<CollectedArtisanData>({
    name: currentUser.fullName || "",
    location: currentUser.location,
  });

  // Final assembled listing cart
  const [compiledListing, setCompiledListing] = useState<Listing | null>(null);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);

  // Conversation history
  const [messages, setMessages] = useState<Message[]>([]);

  // Speech Transcriber ref
  const transcriberRef = useRef<LiveVoiceTranscriber>(new LiveVoiceTranscriber());
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  // Initial welcome question based on language
  const getInitialQuestion = (lang: string) => {
    const normalized = (lang || "").trim().toLowerCase();
    switch (normalized) {
      case "tamil":
        return {
          text: "வணக்கம்! நான் உங்கள் உதவி AI தோழன். உங்கள் கைவினை அல்லது சேவையை அக்கம் பக்கத்தினருடன் பகிர சில எளிய கேள்விகளைக் கேட்கிறேன். முதலில், உங்கள் முழு பெயர் என்ன?",
          english: "Namaste! I am your AI assistant. I will ask a few simple questions one-by-one to create your artisan listing. First, what is your full name?"
        };
      case "hindi":
        return {
          text: "नमस्ते! मैं आपका सहायक AI साथी हूँ। आपकी कारीगरी और सेवा को पड़ोसियों तक पहुँचाने के लिए मैं एक-एक करके कुछ सरल सवाल पूछूँगा। सबसे पहले, आपका शुभ नाम क्या है?",
          english: "Namaste! I am your AI assistant. To help neighbors discover your craft, I will ask a few simple questions one-by-one. First, what is your full name?"
        };
      case "telugu":
        return {
          text: "నమస్కారం! మీ సాంప్రదాయ కళను లేదా సేవను ఇరుగుపొరుగు వారితో పంచుకోవడానికి నేను కొన్ని సులభమైన ప్రశ్నలు అడుగుతాను. మొదటగా, మీ పూర్తి పేరు ఏమిటి?",
          english: "Namaste! To list your craft or service for neighbors, I will ask a few simple questions. First, what is your full name?"
        };
      case "kannada":
        return {
          text: "ನಮಸ್ಕಾರ! ನಿಮ್ಮ ಕಲೆ ಅಥವಾ ಸೇವೆಯನ್ನು ನೆರೆಹೊರೆಯವರಿಗೆ ತಿಳಿಸಲು ನಾನು ಕೆಲವು ಸುಲಭವಾದ ಪ್ರಶ್ನೆಗಳನ್ನು ಕೇಳುತ್ತೇನೆ. ಮೊದಲಿಗೆ, ನಿಮ್ಮ ಪೂರ್ಣ ಹೆಸರು ಏನು?",
          english: "Namaste! To list your craft or service for neighbors, I will ask a few simple questions. First, what is your full name?"
        };
      case "malayalam":
        return {
          text: "നമസ്കാരം! നിങ്ങളുടെ കരകൗശല വൈദഗ്ധ്യവും സേവനങ്ങളും അയൽവാസികളുമായി പങ്കിടാൻ ഞാൻ ചില ലളിതമായ ചോദ്യങ്ങൾ ചോദിക്കാം. ആദ്യം, നിങ്ങളുടെ പൂർണ്ണ പേര് എന്താണ്?",
          english: "Namaste! To list your craft for neighbors, I will ask a few simple questions. First, what is your full name?"
        };
      case "bengali":
        return {
          text: "নমস্কার! আপনার ঐতিহ্যবাহী শিল্প বা পরিষেবা প্রতিবেশীদের সাথে ভাগ করে নিতে আমি আপনাকে কিছু সহজ প্রশ্ন জিজ্ঞাসা করব। প্রথমে আপনার পুরো নাম কী?",
          english: "Namaste! To list your craft for neighbors, I will ask a few simple questions. First, what is your full name?"
        };
      case "marathi":
        return {
          text: "नमस्कार! तुमची पारंपारिक कला किंवा सेवा शेजाऱ्यांपर्यंत पोहोचवण्यासाठी मी तुम्हाला काही सोपे प्रश्न विचारतो. सर्वप्रथम, तुमचे पूर्ण नाव काय आहे?",
          english: "Namaste! To list your craft for neighbors, I will ask a few simple questions. First, what is your full name?"
        };
      case "gujarati":
        return {
          text: "નમસ્તે! તમારી હસ્તકળા અથવા સેવાને પડોશીઓ સુધી પહોંચાડવા માટે હું થોડા સરળ પ્રશ્નો પૂછીશ. સૌથી પહેલા, તમારું પૂરું નામ શું છે?",
          english: "Namaste! To list your craft for neighbors, I will ask a few simple questions. First, what is your full name?"
        };
      case "punjabi":
        return {
          text: "ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ! ਤੁਹਾਡੀ ਦਸਤਕਾਰੀ ਜਾਂ ਸੇਵਾ ਨੂੰ ਗੁਆਂਢੀਆਂ ਤੱਕ ਪਹੁੰਚਾਉਣ ਲਈ ਮੈਂ ਕੁਝ ਸੌਖੇ ਸਵਾਲ ਪੁੱਛਾਂਗਾ। ਪਹਿਲਾਂ, ਤੁਹਾਡਾ ਪੂਰਾ ਨਾਮ ਕੀ ਹੈ?",
          english: "Namaste! To list your craft for neighbors, I will ask a few simple questions. First, what is your full name?"
        };
      default:
        return {
          text: "Namaste! I am your AI voice assistant. I will ask you a few simple questions one by one to create your artisan listing for neighbors. First, what is your full name?",
          english: "Namaste! I will ask a few simple questions one by one. First, what is your full name?"
        };
    }
  };

  // Initialize first question on mount or language reset
  useEffect(() => {
    const initQ = getInitialQuestion(preferredLang);
    const initialMsg: Message = {
      id: `msg_init_${Date.now()}`,
      sender: "bot",
      text: initQ.text,
      textEnglish: initQ.english,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      step: 1
    };
    setMessages([initialMsg]);
    setCurrentStep(1);
    setIsCompleted(false);
    setCompiledListing(null);

    // Speak initial question if audio enabled
    if (isSpeakingEnabled) {
      speakBotMessage(initQ.text, preferredLang);
    }
  }, [preferredLang]);

  // Scroll chat down when messages update
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoadingNextStep, isCompleted]);

  // Cleanup speech on unmount
  useEffect(() => {
    return () => {
      stopSpeaking();
      transcriberRef.current.stop();
    };
  }, []);

  const speakBotMessage = (text: string, lang: string) => {
    stopSpeaking();
    setIsCurrentlySpeaking(true);
    speakText(text, lang, () => {
      setIsCurrentlySpeaking(false);
    });
  };

  // Toggle Live Microphone for user speech response
  const toggleSpeechRecognition = async () => {
    if (isMicActive) {
      setIsMicActive(false);
      const res = await transcriberRef.current.stop();
      if (res.transcript && res.transcript.trim()) {
        setInputText(res.transcript.trim());
      }
      return;
    }

    stopSpeaking();
    setIsCurrentlySpeaking(false);
    setIsMicActive(true);
    setToastMessage(`🎙️ Listening in ${preferredLang}... Speak naturally!`);
    setTimeout(() => setToastMessage(null), 3000);

    await transcriberRef.current.start({
      language: preferredLang === "auto" ? "auto" : preferredLang,
      onTranscriptUpdate: (transcript, isFinal) => {
        if (transcript) {
          setInputText(transcript);
          const detected = detectLanguageFromText(transcript);
          if (detected && detected.name !== preferredLang && preferredLang === "auto") {
            setPreferredLang(detected.name);
          }
        }
        if (isFinal) {
          setIsMicActive(false);
        }
      },
      onLanguageDetected: (detected) => {
        if (detected && detected.name !== preferredLang && preferredLang === "auto") {
          setPreferredLang(detected.name);
        }
      },
      onStateChange: (active) => {
        setIsMicActive(active);
      },
      onError: (err) => {
        console.warn("Speech recognition notice:", err);
        setIsMicActive(false);
      }
    });
  };

  // Handle User submitting an answer (via text or voice transcript)
  const handleSendAnswer = async (e?: React.FormEvent, overrideText?: string) => {
    if (e) e.preventDefault();
    const answer = (overrideText || inputText).trim();
    if (!answer && currentStep !== 6) return;

    if (isMicActive) {
      transcriberRef.current.stop();
      setIsMicActive(false);
    }

    // Add user message to thread
    const userMsg: Message = {
      id: `msg_user_${Date.now()}`,
      sender: "user",
      text: answer || "📍 Location Detected",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      step: currentStep
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setIsLoadingNextStep(true);

    // Call server conversational endpoint
    try {
      const response: ConversationalInterviewResponse = await fetchConversationalInterviewStep({
        step: currentStep,
        userAnswer: answer,
        language: preferredLang,
        collectedData
      });

      // Update collected data based on step
      const updatedData: CollectedArtisanData = { ...collectedData };
      if (currentStep === 1) {
        updatedData.name = response.extractedValue || answer;
      } else if (currentStep === 2) {
        updatedData.age = response.extractedValue || answer;
      } else if (currentStep === 3) {
        updatedData.skill = response.extractedValue || answer;
      } else if (currentStep === 4) {
        const priceNum = typeof response.extractedValue?.price === "number"
          ? response.extractedValue.price
          : parseInt(answer.match(/\d+/)?.[0] || "350", 10);
        const isBarter = response.extractedValue?.isBarter ?? /barter|trade|swap|மாற்று|அதலா/i.test(answer);
        updatedData.pricing = { price: priceNum, isBarter, rawText: answer };
      } else if (currentStep === 5) {
        updatedData.products = response.extractedValue || answer;
      } else if (currentStep === 6) {
        // Location finalized
      }
      setCollectedData(updatedData);

      // Check if interview completed or has next step
      if (response.isComplete || currentStep >= 6) {
        setIsCompleted(true);
        const botCompletionMsg: Message = {
          id: `msg_bot_${Date.now()}`,
          sender: "bot",
          text: response.completionMessage || "அருமை! உங்கள் கைவினை அட்டை (Cart Listing) தயாராகிவிட்டது!",
          textEnglish: response.completionMessageEnglish || "Wonderful! Your artisan listing card is ready to be published.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          step: 7
        };
        setMessages((prev) => [...prev, botCompletionMsg]);

        if (isSpeakingEnabled) {
          speakBotMessage(botCompletionMsg.text, preferredLang);
        }

        // Assemble full Listing Cart
        const finalCompiled = response.compiledListing;
        const assembledListing: Listing = {
          id: `listing_${Date.now()}`,
          providerId: currentUser.id,
          providerName: updatedData.name || currentUser.fullName,
          providerAvatar: currentUser.avatarUrl,
          providerLanguage: preferredLang,
          title: finalCompiled?.title || updatedData.skill || "பாரம்பரிய கைவினை சேவை",
          titleEnglish: finalCompiled?.titleEnglish || "Traditional Artisan Handcraft Service",
          description: finalCompiled?.description || `${updatedData.skill}. ${updatedData.products ? "Products: " + updatedData.products : ""}`,
          descriptionEnglish: finalCompiled?.descriptionEnglish || `Senior artisan offering ${updatedData.skill}. ${updatedData.products ? "Products: " + updatedData.products : ""}`,
          category: (finalCompiled?.category as ListingCategory) || "handmade_goods",
          price: updatedData.pricing?.price || 350,
          isBarter: updatedData.pricing?.isBarter ?? true,
          barterDetails: finalCompiled?.barterDetails || "Open to skill swap or local grocery assistance",
          digitalApprenticeEligible: true,
          heritageNotes: `Senior artisan (${updatedData.age || 62} yrs) with generational craftsmanship.`,
          tags: finalCompiled?.tags || ["Artisan", "Handmade", "Heritage", "Elder Verified"],
          imageUrl: getCategoryDefaultImage((finalCompiled?.category as ListingCategory) || "handmade_goods"),
          location: updatedData.location || currentUser.location,
          available: true,
          createdAt: new Date().toISOString(),
          viewsCount: 1,
          likesCount: 0,
          averageRating: 5.0,
          reviewCount: 0
        };

        setCompiledListing(assembledListing);
      } else {
        // Next Step in conversation
        setCurrentStep(response.nextStep || currentStep + 1);
        const questionText = response.nextQuestion || "Next question:";
        const botNextMsg: Message = {
          id: `msg_bot_${Date.now()}`,
          sender: "bot",
          text: questionText,
          textEnglish: response.nextQuestionEnglish,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          step: response.nextStep || currentStep + 1,
          actionType: response.actionType
        };
        setMessages((prev) => [...prev, botNextMsg]);

        if (isSpeakingEnabled) {
          speakBotMessage(questionText, preferredLang);
        }
      }
    } catch (err) {
      console.error("Conversational interview step failed:", err);
    } finally {
      setIsLoadingNextStep(false);
    }
  };

  // Auto-Location Detector Button inside conversational chatbot
  const handleAutoDetectLocation = async () => {
    setIsDetectingGps(true);
    stopSpeaking();
    try {
      const result = await getDetailedSystemLocation();
      if (result.isGpsAccurate) {
        const detectedLoc = result.location;
        setCollectedData((prev) => ({ ...prev, location: detectedLoc }));
        const locDesc = `${detectedLoc.neighborhood || detectedLoc.address}, ${detectedLoc.city}`;
        setToastMessage(`📍 GPS Found: ${locDesc}!`);

        // Automatically pass location answer to the assistant
        await handleSendAnswer(undefined, `இருப்பிடம் கண்டறியப்பட்டது: ${locDesc}`);
      } else {
        setToastMessage("Could not retrieve precise GPS. Using default area.");
        await handleSendAnswer(undefined, "Default Local Neighborhood");
      }
    } catch (err) {
      console.warn("GPS Detection error:", err);
      await handleSendAnswer(undefined, "Mylapore, Chennai");
    } finally {
      setIsDetectingGps(false);
    }
  };

  // Default craft photo helper
  const getCategoryDefaultImage = (cat: ListingCategory): string => {
    const map: Record<ListingCategory, string> = {
      repairs_mending: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=800&q=80",
      traditional_skills: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=800&q=80",
      home_cooking: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=800&q=80",
      gardening_botanicals: "https://images.unsplash.com/photo-1608248597359-0026e6490e54?auto=format&fit=crop&w=800&q=80",
      handmade_goods: "https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?auto=format&fit=crop&w=800&q=80",
      barter_request: "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=800&q=80",
    };
    return map[cat] || map.handmade_goods;
  };

  // Restart interview
  const handleRestart = () => {
    stopSpeaking();
    const initQ = getInitialQuestion(preferredLang);
    setMessages([
      {
        id: `msg_init_${Date.now()}`,
        sender: "bot",
        text: initQ.text,
        textEnglish: initQ.english,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        step: 1
      }
    ]);
    setCurrentStep(1);
    setIsCompleted(false);
    setCompiledListing(null);
    setCollectedData({
      name: currentUser.fullName || "",
      location: currentUser.location
    });
    if (isSpeakingEnabled) {
      speakBotMessage(initQ.text, preferredLang);
    }
  };

  const stepsList = [
    { step: 1, label: "Name", icon: UserIcon },
    { step: 2, label: "Age", icon: Calendar },
    { step: 3, label: "Craft & Skill", icon: Tag },
    { step: 4, label: "Salary / Price", icon: DollarSign },
    { step: 5, label: "Products", icon: Package },
    { step: 6, label: "Auto GPS", icon: MapPin },
  ];

  return (
    <div className="bg-slate-900 border-2 border-amber-500/70 rounded-3xl p-4 sm:p-6 lg:p-8 shadow-2xl space-y-6 text-amber-50 animate-fadeIn">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-20 right-4 z-50 bg-amber-500 text-slate-950 px-5 py-3 rounded-2xl font-bold shadow-2xl text-sm animate-bounce flex items-center space-x-2 border-2 border-amber-300">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header with Two-Option Switcher and Privacy Security Shield */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-600 to-amber-400 p-0.5 shadow-lg flex items-center justify-center text-slate-950 font-black text-2xl flex-shrink-0">
            🎙️
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-400/40 px-2.5 py-0.5 rounded-full">
                Option 2: Guided Voice & Chat Assistant
              </span>
              <span className="text-xs text-emerald-400 font-bold flex items-center space-x-1 bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.5 rounded-full">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Identity Shield Active</span>
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-amber-100 font-serif mt-1">
              Conversational Artisan Assistant
            </h2>
            <p className="text-xs sm:text-sm text-amber-200/80 mt-0.5">
              Talk or write step-by-step in your preferred language. AI asks simple questions and automatically builds your live listing cart!
            </p>
          </div>
        </div>

        {/* Action Controls: Switch to Manual Mode & Language Selector */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          {/* Switch to Option 1: Manual Form */}
          <button
            type="button"
            onClick={onSwitchToManual}
            id="switch-to-manual-form-btn"
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-200 border border-amber-500/30 text-xs sm:text-sm font-bold flex items-center space-x-2 transition-all cursor-pointer shadow-md"
            title="Switch to manual form input"
          >
            <FileText className="w-4 h-4 text-amber-400" />
            <span>Switch to Manual Form (Option 1)</span>
          </button>

          {/* Audio TTS Speaker Mute Toggle */}
          <button
            type="button"
            onClick={() => {
              if (isSpeakingEnabled) {
                stopSpeaking();
                setIsSpeakingEnabled(false);
                setIsCurrentlySpeaking(false);
              } else {
                setIsSpeakingEnabled(true);
              }
            }}
            className={`p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center ${
              isSpeakingEnabled
                ? "bg-amber-500 text-slate-950 border-amber-400 shadow-md"
                : "bg-slate-800 text-slate-400 border-slate-700"
            }`}
            title={isSpeakingEnabled ? "Mute Bot Voice" : "Enable Bot Voice"}
          >
            {isSpeakingEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Reset / Restart Interview */}
          <button
            type="button"
            onClick={handleRestart}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-bold transition-all cursor-pointer"
            title="Restart conversation from question 1"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Security Privacy Shield Banner */}
      <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-3 sm:p-4 flex items-center justify-between text-xs text-emerald-200 gap-3">
        <div className="flex items-center space-x-2.5">
          <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <span>
            <strong>API Key & Identity Security Protected:</strong> Your private contact numbers and identity credentials are sanitized and kept secure on our server proxy. No third-party data broker access.
          </span>
        </div>
        <span className="text-[11px] bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 px-2 py-0.5 rounded-full font-mono flex-shrink-0">
          TLS 256-Bit Encrypted
        </span>
      </div>

      {/* Step Progress Bar for the 6 Sequential Questions */}
      <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center space-x-1.5">
            <Radio className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span>Question {Math.min(currentStep, 6)} of 6</span>
          </span>
          <span className="text-xs text-slate-400">
            {isCompleted ? "All Questions Completed 🎉" : `Step: ${stepsList[currentStep - 1]?.label || "Finalize"}`}
          </span>
        </div>

        <div className="grid grid-cols-6 gap-2">
          {stepsList.map((st) => {
            const isDone = currentStep > st.step || isCompleted;
            const isCurrent = currentStep === st.step && !isCompleted;
            const Icon = st.icon;
            return (
              <div
                key={st.step}
                className={`py-2 px-1.5 rounded-xl border text-center flex flex-col items-center transition-all ${
                  isDone
                    ? "bg-emerald-950/70 border-emerald-500/50 text-emerald-300"
                    : isCurrent
                    ? "bg-amber-500 text-slate-950 border-amber-400 font-bold shadow-lg ring-2 ring-amber-400/50"
                    : "bg-slate-900 border-slate-800 text-slate-500"
                }`}
              >
                <div className="flex items-center space-x-1">
                  {isDone ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Icon className="w-3.5 h-3.5" />
                  )}
                  <span className="text-[11px] hidden sm:inline">{st.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Language Selector Pills */}
      <div className="flex flex-wrap items-center gap-1.5 bg-slate-950/60 p-2.5 rounded-2xl border border-slate-800">
        <span className="text-xs font-bold text-amber-200 flex items-center space-x-1.5 mr-2">
          <Languages className="w-4 h-4 text-amber-400" />
          <span>Language:</span>
        </span>
        {[
          { name: "Tamil", label: "தமிழ் (Tamil)" },
          { name: "Hindi", label: "हिन्दी (Hindi)" },
          { name: "Telugu", label: "తెలుగు (Telugu)" },
          { name: "Kannada", label: "ಕನ್ನಡ (Kannada)" },
          { name: "Malayalam", label: "മലയാളം (Malayalam)" },
          { name: "Bengali", label: "বাংলা (Bengali)" },
          { name: "Marathi", label: "मराठी (Marathi)" },
          { name: "English", label: "English" },
        ].map((lang) => (
          <button
            key={lang.name}
            type="button"
            onClick={() => setPreferredLang(lang.name)}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              preferredLang.toLowerCase() === lang.name.toLowerCase()
                ? "bg-amber-500 text-slate-950 font-black shadow-md ring-2 ring-amber-400"
                : "bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700"
            }`}
          >
            {lang.label}
          </button>
        ))}
      </div>

      {/* Chat Messages Feed */}
      <div className="bg-slate-950/90 border border-slate-800 rounded-3xl p-4 sm:p-6 min-h-[380px] max-h-[500px] overflow-y-auto space-y-4 shadow-inner">
        {messages.map((msg) => {
          const isBot = msg.sender === "bot";
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isBot ? "items-start" : "items-end"} animate-fadeIn`}
            >
              <div className="flex items-center space-x-2 mb-1 px-1">
                <span className="text-[11px] font-bold text-slate-400">
                  {isBot ? "🎙️ Assistant" : `👤 ${collectedData.name || currentUser.fullName}`}
                </span>
                <span className="text-[10px] text-slate-500">{msg.timestamp}</span>
              </div>

              <div
                className={`max-w-[90%] sm:max-w-[80%] p-4 sm:p-5 rounded-3xl space-y-2 shadow-lg ${
                  isBot
                    ? "bg-gradient-to-br from-slate-900 via-amber-950/40 to-slate-900 border-2 border-amber-500/50 text-amber-50 rounded-tl-sm"
                    : "bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-medium rounded-tr-sm"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-base sm:text-lg font-medium leading-relaxed">
                    {msg.text}
                  </p>

                  {/* Read Aloud Button for Bot message */}
                  {isBot && (
                    <button
                      type="button"
                      onClick={() => speakBotMessage(msg.text, preferredLang)}
                      className="p-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 flex-shrink-0 cursor-pointer"
                      title="Read question aloud"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Optional English Subtitle helper if bot spoke in regional language */}
                {isBot && msg.textEnglish && preferredLang !== "English" && (
                  <p className="text-xs text-amber-300/70 border-t border-amber-500/20 pt-1.5 italic">
                    English translation: "{msg.textEnglish}"
                  </p>
                )}

                {/* Interactive Auto-Location Detector Button inside Question 6 */}
                {isBot && msg.step === 6 && !isCompleted && (
                  <div className="pt-3 border-t border-amber-500/30 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      id="chatbot-detect-gps-btn"
                      onClick={handleAutoDetectLocation}
                      disabled={isDetectingGps}
                      className="px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-sm shadow-xl flex items-center space-x-2 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isDetectingGps ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                          <span>Detecting GPS Coordinates...</span>
                        </>
                      ) : (
                        <>
                          <LocateFixed className="w-5 h-5 text-slate-950" />
                          <span>📍 1-Click Auto-Detect Workshop GPS</span>
                        </>
                      )}
                    </button>
                    <span className="text-xs text-amber-200/80">
                      or speak/type your neighborhood name below!
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Loading Bubble */}
        {isLoadingNextStep && (
          <div className="flex items-center space-x-3 p-4 bg-slate-900/80 rounded-2xl border border-amber-500/30 max-w-xs animate-pulse">
            <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
            <span className="text-xs font-bold text-amber-200">
              AI is understanding your voice response...
            </span>
          </div>
        )}

        <div ref={chatBottomRef} />
      </div>

      {/* Voice & Text Input Bar (Visible while questions are in progress) */}
      {!isCompleted && (
        <form
          onSubmit={(e) => handleSendAnswer(e)}
          className="bg-slate-950 border-2 border-amber-500/60 rounded-3xl p-3 sm:p-4 shadow-2xl flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
        >
          {/* Large Voice Recording Button */}
          <button
            type="button"
            id="chatbot-voice-mic-btn"
            onClick={toggleSpeechRecognition}
            className={`px-5 py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center space-x-2 transition-all cursor-pointer flex-shrink-0 ${
              isMicActive
                ? "bg-red-500 text-white animate-pulse shadow-lg ring-4 ring-red-400/50"
                : "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-md"
            }`}
          >
            {isMicActive ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            <span>{isMicActive ? "Stop Speaking" : "Speak Answer"}</span>
          </button>

          {/* Text Input Field */}
          <div className="relative flex-1">
            <input
              type="text"
              id="chatbot-answer-input"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={
                preferredLang === "Tamil"
                  ? "பதிலை இங்கு பேசவும் அல்லது தட்டச்சு செய்யவும்..."
                  : preferredLang === "Hindi"
                  ? "अपना उत्तर यहाँ बोलें या लिखें..."
                  : "Type or speak your answer here..."
              }
              className="w-full px-4 py-3.5 bg-slate-900 border border-slate-700 focus:border-amber-400 rounded-2xl text-base text-white outline-none placeholder:text-slate-500"
            />
          </div>

          {/* Submit Answer Button */}
          <button
            type="submit"
            id="chatbot-submit-answer-btn"
            disabled={!inputText.trim() && !isMicActive}
            className="px-6 py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm shadow-md flex items-center justify-center space-x-2 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
          >
            <span>Next</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      )}

      {/* FINAL ASSEMBLED CART & ARTISAN CARD PREVIEW (Displayed when completed) */}
      {isCompleted && compiledListing && (
        <div className="space-y-6 pt-4 border-t border-slate-800 animate-slideUp">
          <div className="bg-gradient-to-r from-amber-950/80 via-slate-900 to-emerald-950/80 border-2 border-emerald-500/50 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center space-x-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-400 flex items-center justify-center text-emerald-400 text-3xl">
                  🎉
                </div>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 px-3 py-0.5 rounded-full">
                    Cart Assembly Complete
                  </span>
                  <h3 className="text-2xl font-bold text-amber-100 font-serif mt-1">
                    Your Verified Artisan Listing Card
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300">
                    All your voice & text responses have been assembled into the standard marketplace format with AI English translation and SEO tags.
                  </p>
                </div>
              </div>

              {/* Action Buttons: Publish or Switch to Manual Edit */}
              <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  id="chatbot-publish-listing-btn"
                  onClick={() => onSaveListing(compiledListing)}
                  className="flex-1 sm:flex-none px-6 py-4 rounded-2xl bg-gradient-to-r from-emerald-400 to-emerald-500 hover:from-emerald-300 hover:to-emerald-400 text-slate-950 font-black text-base shadow-xl flex items-center justify-center space-x-2 transition-all cursor-pointer"
                >
                  <Check className="w-5 h-5 text-slate-950" />
                  <span>Publish to Neighborhood Feed</span>
                </button>

                <button
                  type="button"
                  onClick={onSwitchToManual}
                  className="flex-1 sm:flex-none px-4 py-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-amber-200 border border-slate-700 font-bold text-sm flex items-center justify-center space-x-2 transition-all cursor-pointer"
                >
                  <Edit3 className="w-4 h-4 text-amber-400" />
                  <span>Fine-Tune in Manual Form</span>
                </button>
              </div>
            </div>

            {/* Live Interactive Listing Card Render */}
            <div className="bg-slate-950/80 p-4 sm:p-6 rounded-3xl border border-slate-800">
              <div className="text-xs font-bold uppercase tracking-wider text-amber-300 mb-4 flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Live Marketplace Card Preview:</span>
              </div>

              <div className="max-w-md mx-auto">
                <ListingCard
                  listing={compiledListing}
                  currentUser={currentUser}
                  onContact={() => {}}
                />
              </div>
            </div>

            {/* Extracted Details Summary Chips */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 pt-2">
              <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 block">Artisan Name</span>
                <span className="text-xs font-bold text-amber-300">{compiledListing.providerName}</span>
              </div>
              <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 block">Category</span>
                <span className="text-xs font-bold text-amber-300 capitalize">
                  {compiledListing.category.replace("_", " ")}
                </span>
              </div>
              <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 block">Price / Wage</span>
                <span className="text-xs font-bold text-amber-300">
                  {compiledListing.price ? `₹${compiledListing.price}` : "Barter Only"}
                </span>
              </div>
              <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 block">Barter Friendly</span>
                <span className="text-xs font-bold text-emerald-400">
                  {compiledListing.isBarter ? "Yes (Swap)" : "Direct Pay"}
                </span>
              </div>
              <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 block">Location</span>
                <span className="text-xs font-bold text-amber-300">
                  {compiledListing.location?.neighborhood || "Verified Area"}
                </span>
              </div>
              <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 block">Language</span>
                <span className="text-xs font-bold text-amber-300">{compiledListing.providerLanguage}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConversationalListingAssistant;
