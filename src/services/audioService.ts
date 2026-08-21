import { transcribeAudioWithAI } from "./geminiService";

/**
 * Audio Recording and Speech Synthesis Utilities for SilverHands
 * Supports 30-second Heritage Voice Notes, Auto-Detect & Multilingual Speech Recognition (Hindi, Tamil, Telugu, Spanish, etc.), and TTS
 */

export interface SpeechLanguage {
  code: string;
  name: string;
  nativeName: string;
}

export const SUPPORTED_SPEECH_LANGUAGES: SpeechLanguage[] = [
  { code: "auto", name: "Auto-Detect", nativeName: "✨ Auto-Detect (Auto / किसी भी भाषा में)" },
  { code: "ta-IN", name: "Tamil", nativeName: "தமிழ் (Tamil)" },
  { code: "hi-IN", name: "Hindi", nativeName: "हिन्दी (Hindi)" },
  { code: "te-IN", name: "Telugu", nativeName: "తెలుగు (Telugu)" },
  { code: "kn-IN", name: "Kannada", nativeName: "ಕನ್ನಡ (Kannada)" },
  { code: "ml-IN", name: "Malayalam", nativeName: "മലയാളം (Malayalam)" },
  { code: "bn-IN", name: "Bengali", nativeName: "বাংলা (Bengali)" },
  { code: "mr-IN", name: "Marathi", nativeName: "मराठी (Marathi)" },
  { code: "gu-IN", name: "Gujarati", nativeName: "ગુજરાતી (Gujarati)" },
  { code: "pa-IN", name: "Punjabi", nativeName: "ਪੰਜਾਬੀ (Punjabi)" },
  { code: "or-IN", name: "Odia", nativeName: "ଓଡ଼ିଆ (Odia)" },
  { code: "as-IN", name: "Assamese", nativeName: "অসমীয়া (Assamese)" },
  { code: "ur-IN", name: "Urdu", nativeName: "اردو (Urdu)" },
  { code: "en-IN", name: "English (India)", nativeName: "English (India)" },
  { code: "en-US", name: "English (US)", nativeName: "English (US)" },
  { code: "es-ES", name: "Spanish", nativeName: "Español (Spanish)" },
  { code: "fr-FR", name: "French", nativeName: "Français (French)" },
  { code: "de-DE", name: "German", nativeName: "Deutsch (German)" },
  { code: "ar-SA", name: "Arabic", nativeName: "العربية (Arabic)" },
];

export interface DetectedLanguageInfo {
  code: string;
  name: string;
  nativeName: string;
  confidence: number;
}

// Helper: Check if Devanagari or Tamil text is actually transliterated English phonetics
export function transliteratedDevanagariToEnglish(text: string): string | null {
  const map: Record<string, string> = {
    "हेलो": "Hello",
    "हेल्लो": "Hello",
    "हाय": "Hi",
    "कुक": "cook",
    "कुकिंग": "cooking",
    "कूक": "cook",
    "कूकिंग": "cooking",
    "फूड": "food",
    "होम": "home",
    "आई": "I",
    "एम": "am",
    "आई एम": "I am",
    "माय": "my",
    "नेम": "name",
    "इज": "is",
    "टेलर": "tailor",
    "टेलரிங்": "tailoring",
    "सिलाई": "stitching",
    "सर्विस": "service",
    "रिपेयर": "repair",
    "प्लीज": "please",
    "थैंक यू": "thank you",
    "थैंक्यू": "thank you",
    "सर": "sir",
    "मैडम": "madam",
    "गुड": "good",
    "मॉर्निंग": "morning",
    "वेरी": "very",
    "टीच": "teach",
    "वर्क": "work",
    "जॉब": "job",
    "यस": "yes",
    "नो": "no",
    "ओके": "ok",
    "रेडी": "ready",
    "ஷாப்": "shop",
    "ஹலோ": "Hello",
    "ஹாய்": "Hi",
    "தேங்க்ஸ்": "Thanks",
    "தேங்க் யூ": "Thank you",
    "ப்ளீஸ்": "Please",
    "குக்கிங்": "cooking",
    "குக்": "cook",
    "டெய்லர்": "tailor",
  };

  const words = text.trim().split(/\s+/);
  let englishMatchCount = 0;
  const translatedWords = words.map((w) => {
    const clean = w.replace(/[.,!?;:()]/g, "");
    if (map[clean]) {
      englishMatchCount++;
      return map[clean];
    }
    return w;
  });

  // If more than 50% of the words are English phonetics in Devanagari/Tamil
  if (words.length > 0 && englishMatchCount / words.length >= 0.5) {
    return translatedWords.join(" ");
  }
  return null;
}

/**
 * High-speed linguistic & Unicode script analyzer to automatically detect spoken/transcribed language
 * Instantly identifies Tamil, Hindi, Telugu, Kannada, Malayalam, Bengali, Marathi, Gujarati, Punjabi,
 * Spanish, French, German, Arabic, and English regardless of whether native script or Romanized phonetics are used.
 */
export function detectLanguageFromText(text: string): DetectedLanguageInfo | null {
  if (!text || typeof text !== "string") return null;
  const trimmed = text.trim();
  if (trimmed.length < 2) return null;

  // 0. Check if Devanagari or Tamil text is purely English words transliterated by browser recognizer (e.g. "हेलो हेलो हेलो कुक" -> "Hello hello hello cook")
  const englishTransliteration = transliteratedDevanagariToEnglish(trimmed);
  if (englishTransliteration) {
    return { code: "en-IN", name: "English", nativeName: "English", confidence: 0.98 };
  }

  // 1. Script-based Unicode Analysis (100% precision for native scripts)
  if (/[\u0B80-\u0BFF]/.test(trimmed)) {
    return { code: "ta-IN", name: "Tamil", nativeName: "தமிழ் (Tamil)", confidence: 1.0 };
  }
  if (/[\u0C00-\u0C7F]/.test(trimmed)) {
    return { code: "te-IN", name: "Telugu", nativeName: "తెలుగు (Telugu)", confidence: 1.0 };
  }
  if (/[\u0C80-\u0CFF]/.test(trimmed)) {
    return { code: "kn-IN", name: "Kannada", nativeName: "ಕನ್ನಡ (Kannada)", confidence: 1.0 };
  }
  if (/[\u0D00-\u0D7F]/.test(trimmed)) {
    return { code: "ml-IN", name: "Malayalam", nativeName: "മലയാളം (Malayalam)", confidence: 1.0 };
  }
  if (/[\u0B00-\u0B7F]/.test(trimmed)) {
    return { code: "or-IN", name: "Odia", nativeName: "ଓଡ଼ିଆ (Odia)", confidence: 1.0 };
  }
  if (/[\u0980-\u09FF]/.test(trimmed)) {
    // Check Assamese specific characters ৰ (0x09F0), ৱ (0x09F1)
    if (/[\u09F0\u09F1]/.test(trimmed) || /\b(নমস্কাৰ|আছেনে|ভালে|আপোনাৰ|কৰক|হ'ব)\b/i.test(trimmed)) {
      return { code: "as-IN", name: "Assamese", nativeName: "অসমীয়া (Assamese)", confidence: 1.0 };
    }
    return { code: "bn-IN", name: "Bengali", nativeName: "বাংলা (Bengali)", confidence: 1.0 };
  }
  if (/[\u0A80-\u0AFF]/.test(trimmed)) {
    return { code: "gu-IN", name: "Gujarati", nativeName: "ગુજરાતી (Gujarati)", confidence: 1.0 };
  }
  if (/[\u0A00-\u0A7F]/.test(trimmed)) {
    return { code: "pa-IN", name: "Punjabi", nativeName: "ਪੰਜਾਬੀ (Punjabi)", confidence: 1.0 };
  }
  if (/[\u0600-\u06FF]/.test(trimmed)) {
    if (/\b(السلام|علیکم|آپ|ہیں|شکریہ|ہنر|کاریگر|کام)\b/i.test(trimmed)) {
      return { code: "ur-IN", name: "Urdu", nativeName: "اردو (Urdu)", confidence: 1.0 };
    }
    return { code: "ar-SA", name: "Arabic", nativeName: "العربية (Arabic)", confidence: 1.0 };
  }
  if (/[\u0900-\u097F]/.test(trimmed)) {
    if (/\b(आहे|नाही|कसे|झाले|पाहिजे|भाऊ|ताई|करा|सांगा|नमस्कार)\b/i.test(trimmed)) {
      return { code: "mr-IN", name: "Marathi", nativeName: "मराठी (Marathi)", confidence: 0.95 };
    }
    return { code: "hi-IN", name: "Hindi", nativeName: "हिन्दी (Hindi)", confidence: 1.0 };
  }

  // 2. Transliterated / Phonetic Vocabulary Recognition for Romanized Speech & English
  const lower = trimmed.toLowerCase();
  const words = lower.split(/[\s,.'";:!?\-+/\\()\[\]{}]+/).filter(Boolean);

  const tamilKeywords = [
    "vanakkam", "nan", "naan", "thayal", "thuni", "ennoda", "enna", "saree", "sari",
    "romba", "nalla", "veetula", "kudukka", "pannurom", "seiyya", "solunga", "pudhu",
    "palaya", "velai", "kaithari", "koodai", "pinnal", "thiruppi", "ungalukku", "marundhu",
    "kadai", "kovil", "ungal", "namaskaram", "epdi", "irukinga", "ippo", "andha", "indha",
    "thevai", "seiyanum", "pannanum", "thara", "thaikkanum", "thaika", "thaikiren", "seiven",
    "panren", "kalanjiar", "kalaignar", "sariyanadhu", "tamil", "thamizh", "solreenga",
    "panna", "pannalam", "illai", "aamaam", "seri", "theriyum", "solla", "tharuveengala",
    "kaasu", "panam", "parambariya", "kaippani", "kaippinnal", "ooru", "chennai", "madurai",
    "samay", "samayal", "samaipen", "samaippen", "pain", "saapadu", "saapaadu", "samiti",
    "raja", "oorugai", "kuzhambu", "rasam", "vadai", "idli", "dosa", "veedu", "thangachi",
    "amma", "appa", "paati", "thatha", "thozhil", "kaivannam", "maramathu", "maramath",
    "kavalam", "neenga", "ungaluku", "enaku", "ennaku", "theriyadhu", "koodum", "vanga", "vaanga", "ponga"
  ];

  const hindiKeywords = [
    "namaste", "pranam", "kaise", "karein", "karna", "merko", "mujhe", "sadi", "silai",
    "bunkar", "seekhna", "khana", "achha", "ghar", "banana", "kripya", "badle", "mein",
    "sikhao", "samajh", "bhaiya", "didi", "chahiye", "karenge", "theek", "theekh", "karo",
    "hoga", "hai", "hain", "mera", "meri", "mere", "aap", "aapka", "hum", "hamara",
    "shukriya", "dhanyawad", "bataiye", "batao", "madad", "karoge", "karunga", "karungi",
    "pani", "banao", "seekho", "sikhao", "roti", "sabzi", "achar", "masala", "marammat",
    "sikhna", "seekhna", "kapde", "suvidha", "kaam", "dhandha", "swagat"
  ];

  const teluguKeywords = [
    "namaskaram", "bagunnara", "ela", "unnaru", "chesi", "kavali", "kothaga", "kuttu",
    "panulu", "cheyandi", "meeru", "nenu", "andaru", "baga", "chesta", "dhanyavadalu",
    "undi", "chesukondi", "sahayam", "cheyagalaru", "telugu", "chesanu", "vandatam",
    "annamu", "kura", "kuttadam", "cheyali", "meeku", "naaku"
  ];

  const kannadaKeywords = [
    "namaskara", "hegiddira", "kelsa", "beku", "madoke", "madodu", "nanna", "neevu",
    "dhanyavada", "keli", "ide", "sahaya", "kannada", "oota", "madri", "hosa", "hale"
  ];

  const malayalamKeywords = [
    "namaskaram", "engane", "undu", "cheyyaan", "thayyal", "njan", "entha", "nanni",
    "ariyumo", "aanu", "sahayam", "malayalam", "cheyyan", "bhakshanam", "veetil"
  ];

  const englishKeywords = [
    "i", "am", "we", "you", "they", "he", "she", "it", "my", "our", "your", "his", "her",
    "speak", "cook", "cooking", "repair", "service", "offering", "looking", "want", "help",
    "need", "teach", "lesson", "food", "handmade", "artisan", "heritage", "craft", "wood",
    "pottery", "stitch", "sew", "tailoring", "sari", "saree", "curry", "clean", "phone",
    "barter", "trade", "exchange", "please", "hello", "hi", "good", "morning", "afternoon",
    "evening", "thank", "thanks", "welcome", "cooker", "haiku", "rice", "spice", "taste",
    "tasty", "make", "making", "fix", "fixing", "teach", "teaching", "sell", "selling",
    "buy", "home", "kitchen", "traditional", "experience", "years", "vintage", "clothes",
    "specialist", "custom", "order", "delivery", "pickup", "workshop", "price", "rupees", "free"
  ];

  const countMatches = (list: string[]) =>
    words.filter((w) => list.some((item) => w === item || w.startsWith(item) || item.startsWith(w))).length;

  const tCount = countMatches(tamilKeywords);
  const hCount = countMatches(hindiKeywords);
  const teCount = countMatches(teluguKeywords);
  const knCount = countMatches(kannadaKeywords);
  const mlCount = countMatches(malayalamKeywords);
  const eCount = countMatches(englishKeywords);

  if (tCount > 0 && tCount > Math.max(hCount, teCount, knCount, mlCount, eCount)) {
    return { code: "ta-IN", name: "Tamil", nativeName: "தமிழ் (Tamil)", confidence: 0.95 };
  }
  if (hCount > 0 && hCount > Math.max(tCount, teCount, knCount, mlCount, eCount)) {
    return { code: "hi-IN", name: "Hindi", nativeName: "हिन्दी (Hindi)", confidence: 0.95 };
  }
  if (teCount > 0 && teCount > Math.max(tCount, hCount, knCount, mlCount, eCount)) {
    return { code: "te-IN", name: "Telugu", nativeName: "తెలుగు (Telugu)", confidence: 0.95 };
  }
  if (knCount > 0 && knCount > Math.max(tCount, hCount, teCount, mlCount, eCount)) {
    return { code: "kn-IN", name: "Kannada", nativeName: "ಕನ್ನಡ (Kannada)", confidence: 0.95 };
  }
  if (mlCount > 0 && mlCount > Math.max(tCount, hCount, teCount, knCount, eCount)) {
    return { code: "ml-IN", name: "Malayalam", nativeName: "മലയാളം (Malayalam)", confidence: 0.95 };
  }
  if (eCount > 0 && eCount >= Math.max(tCount, hCount, teCount, knCount, mlCount)) {
    return { code: "en-IN", name: "English", nativeName: "English", confidence: 0.95 };
  }

  // Check European languages
  if (/\b(hola|buenos|dias|gracias|por|favor|amigo|trabajo)\b/i.test(lower)) {
    return { code: "es-ES", name: "Spanish", nativeName: "Español (Spanish)", confidence: 0.85 };
  }
  if (/\b(bonjour|salut|merci|couture|s'il|vous|plait)\b/i.test(lower)) {
    return { code: "fr-FR", name: "French", nativeName: "Français (French)", confidence: 0.85 };
  }
  if (/\b(hallo|guten|tag|danke|bitte)\b/i.test(lower)) {
    return { code: "de-DE", name: "German", nativeName: "Deutsch (German)", confidence: 0.85 };
  }

  // Default Latin / ASCII detection: if text is Roman script and not specifically another language, it is English!
  if (/^[a-zA-Z0-9\s.,'?!/()\-+₹$%&@:;"]+$/.test(trimmed)) {
    return { code: "en-IN", name: "English", nativeName: "English", confidence: 0.9 };
  }

  return null;
}

export function getLanguageCode(lang: string): string {
  if (!lang || lang === "auto") {
    return typeof navigator !== "undefined" && navigator.language ? navigator.language : "en-IN";
  }
  const normalized = lang.trim().toLowerCase();
  
  const map: Record<string, string> = {
    auto: typeof navigator !== "undefined" && navigator.language ? navigator.language : "en-IN",
    tamil: "ta-IN",
    thamizh: "ta-IN",
    tamizh: "ta-IN",
    ta: "ta-IN",
    "ta-in": "ta-IN",
    "ta_in": "ta-IN",
    hindi: "hi-IN",
    hi: "hi-IN",
    "hi-in": "hi-IN",
    "hi_in": "hi-IN",
    telugu: "te-IN",
    te: "te-IN",
    "te-in": "te-IN",
    "te_in": "te-IN",
    kannada: "kn-IN",
    kn: "kn-IN",
    "kn-in": "kn-IN",
    "kn_in": "kn-IN",
    malayalam: "ml-IN",
    ml: "ml-IN",
    "ml-in": "ml-IN",
    "ml_in": "ml-IN",
    bengali: "bn-IN",
    bangla: "bn-IN",
    bn: "bn-IN",
    "bn-in": "bn-IN",
    "bn_in": "bn-IN",
    marathi: "mr-IN",
    mr: "mr-IN",
    "mr-in": "mr-IN",
    "mr_in": "mr-IN",
    gujarati: "gu-IN",
    gu: "gu-IN",
    "gu-in": "gu-IN",
    "gu_in": "gu-IN",
    punjabi: "pa-IN",
    pa: "pa-IN",
    "pa-in": "pa-IN",
    "pa_in": "pa-IN",
    odia: "or-IN",
    oriya: "or-IN",
    or: "or-IN",
    "or-in": "or-IN",
    "or_in": "or-IN",
    assamese: "as-IN",
    as: "as-IN",
    "as-in": "as-IN",
    "as_in": "as-IN",
    urdu: "ur-IN",
    ur: "ur-IN",
    "ur-in": "ur-IN",
    "ur_in": "ur-IN",
    english: "en-IN",
    "english (india)": "en-IN",
    "english (us)": "en-US",
    en: "en-IN",
    "en-in": "en-IN",
    "en-us": "en-US",
    spanish: "es-ES",
    es: "es-ES",
    french: "fr-FR",
    fr: "fr-FR",
    german: "de-DE",
    de: "de-DE",
    arabic: "ar-SA",
    ar: "ar-SA",
  };

  if (map[normalized]) return map[normalized];
  
  // If it's already a BCP-47 tag like "hi-IN" or "ta-IN"
  const matched = SUPPORTED_SPEECH_LANGUAGES.find(
    (l) => l.code.toLowerCase() === normalized || l.name.toLowerCase() === normalized
  );
  return matched ? matched.code : "en-IN";
}

export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private timerInterval: any = null;
  private onDurationUpdate?: (seconds: number) => void;
  private onComplete?: (blobUrl: string, blob: Blob, duration: number) => void;
  private maxDurationSeconds: number = 30;
  private secondsCount: number = 0;

  async startRecording(
    onDurationUpdate: (seconds: number) => void,
    onComplete: (blobUrl: string, blob: Blob, duration: number) => void
  ): Promise<boolean> {
    try {
      this.onDurationUpdate = onDurationUpdate;
      this.onComplete = onComplete;
      this.audioChunks = [];
      this.secondsCount = 0;

      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(this.stream);

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: "audio/webm" });
        const audioUrl = URL.createObjectURL(audioBlob);
        if (this.onComplete) {
          this.onComplete(audioUrl, audioBlob, this.secondsCount);
        }
        this.cleanup();
      };

      this.mediaRecorder.start(250); // slice every 250ms

      this.timerInterval = setInterval(() => {
        this.secondsCount += 1;
        if (this.onDurationUpdate) {
          this.onDurationUpdate(this.secondsCount);
        }
        if (this.secondsCount >= this.maxDurationSeconds) {
          this.stopRecording();
        }
      }, 1000);

      return true;
    } catch (err) {
      console.error("Microphone access failed:", err);
      return false;
    }
  }

  stopRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.stop();
    }
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  cancelRecording(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.stop();
    }
    this.cleanup();
  }

  private cleanup(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
  }
}

/**
 * Text-to-Speech synthesis for senior accessibility in user's native language
 */
export function stopSpeech(): void {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

export function stopSpeaking(): void {
  stopSpeech();
}

export function speakText(
  text: string,
  langInput: string = "Hindi",
  onEnd?: () => void
): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    console.warn("Speech synthesis not supported on this device.");
    if (onEnd) onEnd();
    return;
  }

  // Cancel any active speech cleanly
  try {
    window.speechSynthesis.cancel();
  } catch (e) {
    console.warn("Could not cancel previous speech:", e);
  }

  if (!text || !text.trim()) {
    if (onEnd) onEnd();
    return;
  }

  const targetLangCode = getLanguageCode(langInput);
  const langSubtag = targetLangCode.split("-")[0].toLowerCase();
  const cleanLangName = langInput.toLowerCase();

  // Known native voice indicators for Indian languages
  const indicVoiceKeywords: Record<string, string[]> = {
    ta: ["tamil", "valluvar", "tamizh", "ta-in", "ta_in"],
    hi: ["hindi", "swara", "madhur", "kalpana", "hemant", "hi-in", "hi_in"],
    te: ["telugu", "mohan", "shruti", "te-in", "te_in"],
    kn: ["kannada", "gagan", "sapna", "kn-in", "kn_in"],
    ml: ["malayalam", "midhun", "sobha", "ml-in", "ml_in"],
    bn: ["bengali", "bangla", "bashkar", "tanishaa", "bn-in", "bn_in"],
    mr: ["marathi", "aarohi", "manohar", "mr-in", "mr_in"],
    gu: ["gujarati", "dhwani", "niranjan", "gu-in", "gu_in"],
    pa: ["punjabi", "harpreet", "rajan", "gurmukhi", "pa-in", "pa_in"],
    or: ["odia", "oriya", "or-in", "or_in"],
    as: ["assamese", "as-in", "as_in"],
    ur: ["urdu", "salman", "gul", "ur-in", "ur_in"],
    en: ["india", "neerja", "prabhat", "ravi", "veena", "en-in", "en_in"],
  };

  const playUtterance = () => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.90; // Natural, clear cadence tailored for senior comprehension
    utterance.pitch = 1.0;
    utterance.lang = targetLangCode;

    const voices = window.speechSynthesis.getVoices() || [];
    if (voices.length > 0) {
      // 1. Exact match e.g. "ta-IN", "hi-IN", "te-IN"
      const exactMatch = voices.find(
        (v) => v.lang && v.lang.replace(/_/g, "-").toLowerCase() === targetLangCode.toLowerCase()
      );

      // 2. Subtag prefix match e.g. "ta", "hi", "te"
      const prefixMatch = voices.find(
        (v) => v.lang && v.lang.toLowerCase().startsWith(langSubtag)
      );

      // 3. Keyword/Name match from specific Indian voice mappings
      const targetKeywords = indicVoiceKeywords[langSubtag] || [cleanLangName];
      const keywordMatch = voices.find((v) => {
        const vName = (v.name || "").toLowerCase();
        const vLang = (v.lang || "").toLowerCase();
        return targetKeywords.some((kw) => vName.includes(kw) || vLang.includes(kw));
      });

      // 4. Any Indian English / Indian voice fallback if native regional voice unavailable on OS
      const anyIndianMatch = voices.find(
        (v) => (v.lang && v.lang.toLowerCase().includes("-in")) || (v.name && v.name.toLowerCase().includes("india"))
      );

      const chosenVoice = exactMatch || prefixMatch || keywordMatch || anyIndianMatch;
      if (chosenVoice) {
        utterance.voice = chosenVoice;
      }
    }

    let isCompleted = false;
    let watchdogTimer: any = null;

    const finish = () => {
      if (isCompleted) return;
      isCompleted = true;
      if (watchdogTimer) {
        clearInterval(watchdogTimer);
        watchdogTimer = null;
      }
      if (onEnd) onEnd();
    };

    utterance.onend = finish;
    utterance.onerror = finish;

    // Chromium speech watchdog: Periodically resume if browser pauses during playback
    watchdogTimer = setInterval(() => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        if (window.speechSynthesis.speaking && window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
      }
    }, 4000);

    try {
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn("Speech synthesis speak error:", err);
      finish();
    }
  };

  const existingVoices = window.speechSynthesis.getVoices();
  if (existingVoices && existingVoices.length > 0) {
    playUtterance();
  } else {
    let triggered = false;
    const onVoicesLoaded = () => {
      if (triggered) return;
      triggered = true;
      window.speechSynthesis.onvoiceschanged = null;
      playUtterance();
    };
    window.speechSynthesis.onvoiceschanged = onVoicesLoaded;
    setTimeout(() => {
      if (!triggered) {
        triggered = true;
        playUtterance();
      }
    }, 150);
  }
}

export class LiveVoiceTranscriber {
  private recognition: any = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private isListening: boolean = false;
  private currentTranscript: string = "";
  private language: string = "auto";
  private onTranscriptUpdate?: (transcript: string, isFinal: boolean) => void;
  private onLanguageDetected?: (detected: DetectedLanguageInfo) => void;
  private onError?: (err: any) => void;
  private onStateChange?: (active: boolean) => void;

  constructor() {}

  public get active(): boolean {
    return this.isListening;
  }

  public get transcript(): string {
    return this.currentTranscript;
  }

  public async start(options: {
    language?: string;
    onTranscriptUpdate: (transcript: string, isFinal: boolean) => void;
    onLanguageDetected?: (detected: DetectedLanguageInfo) => void;
    onError?: (err: any) => void;
    onStateChange?: (active: boolean) => void;
  }): Promise<boolean> {
    // 1. Cleanly tear down any active session first
    this.stop();

    this.language = options.language || "auto";
    this.onTranscriptUpdate = options.onTranscriptUpdate;
    this.onLanguageDetected = options.onLanguageDetected;
    this.onError = options.onError;
    this.onStateChange = options.onStateChange;
    this.currentTranscript = "";
    this.audioChunks = [];
    this.isListening = true;

    if (this.onStateChange) this.onStateChange(true);

    // 2. Start MediaRecorder as fallback/audio capturer
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.mediaRecorder = new MediaRecorder(this.stream);
        this.mediaRecorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            this.audioChunks.push(e.data);
          }
        };
        this.mediaRecorder.start(250);
      }
    } catch (err) {
      console.warn("Microphone stream note:", err);
    }

    // 3. Start Browser Web Speech Recognition for instant live words
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        const rec = new SpeechRecognition();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = getLanguageCode(this.language);

        rec.onresult = (event: any) => {
          let full = "";
          for (let i = 0; i < event.results.length; i++) {
            full += event.results[i][0].transcript + " ";
          }
          const cleaned = full.trim();
          const transliteratedEnglish = transliteratedDevanagariToEnglish(cleaned);
          const effectiveText = transliteratedEnglish || cleaned;

          this.currentTranscript = effectiveText;
          if (this.onTranscriptUpdate) {
            this.onTranscriptUpdate(effectiveText, false);
          }

          if (effectiveText.length >= 2) {
            const detected = detectLanguageFromText(effectiveText);
            if (detected) {
              if (rec.lang !== detected.code) {
                try {
                  rec.lang = detected.code;
                } catch (_) {}
              }
              if (this.onLanguageDetected) {
                this.onLanguageDetected(detected);
              }
            }
          }
        };

        rec.onerror = (event: any) => {
          console.warn("LiveVoiceTranscriber SpeechRecognition notice:", event.error);
        };

        rec.onend = () => {
          // If browser speech recognition ended but session is still supposed to be active, auto-restart
          if (this.isListening) {
            try {
              rec.start();
            } catch (_) {}
          }
        };

        rec.start();
        this.recognition = rec;
      } catch (err) {
        console.warn("Web Speech API startup notice:", err);
      }
    }

    return true;
  }

  public async stop(): Promise<{ transcript: string; audioBlob?: Blob }> {
    this.isListening = false;
    if (this.onStateChange) this.onStateChange(false);

    // Stop Web Speech
    if (this.recognition) {
      try {
        this.recognition.onend = null;
        this.recognition.stop();
      } catch (_) {}
      this.recognition = null;
    }

    // Stop MediaRecorder and retrieve audio blob
    let recordedBlob: Blob | undefined;
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      try {
        const finalPromise = new Promise<Blob>((resolve) => {
          if (!this.mediaRecorder) return resolve(new Blob(this.audioChunks, { type: "audio/webm" }));
          this.mediaRecorder.onstop = () => {
            const blob = new Blob(this.audioChunks, { type: "audio/webm" });
            resolve(blob);
          };
          this.mediaRecorder.stop();
        });
        recordedBlob = await finalPromise;
      } catch (_) {
        recordedBlob = new Blob(this.audioChunks, { type: "audio/webm" });
      }
    } else if (this.audioChunks.length > 0) {
      recordedBlob = new Blob(this.audioChunks, { type: "audio/webm" });
    }

    // Clean tracks
    if (this.stream) {
      try {
        this.stream.getTracks().forEach((t) => t.stop());
      } catch (_) {}
      this.stream = null;
    }

    let finalTranscript = this.currentTranscript.trim();

    // Multi-tier Audio AI Auto-Detection to eliminate browser recognizer bias
    if (recordedBlob && recordedBlob.size > 1500) {
      try {
        const aiResult = await transcribeAudioWithAI(recordedBlob, "auto-detect");
        if (aiResult && aiResult.transcript && aiResult.transcript.trim().length > 0) {
          finalTranscript = aiResult.transcript.trim();
          if (this.onTranscriptUpdate) {
            this.onTranscriptUpdate(finalTranscript, true);
          }
          if (aiResult.languageCode && this.onLanguageDetected) {
            this.onLanguageDetected({
              code: aiResult.languageCode,
              name: aiResult.detectedLanguage,
              nativeName: aiResult.nativeName || aiResult.detectedLanguage,
              confidence: 1.0,
            });
          }
        } else if (finalTranscript) {
          const detected = detectLanguageFromText(finalTranscript);
          if (detected && this.onLanguageDetected) {
            this.onLanguageDetected(detected);
          }
          if (this.onTranscriptUpdate) {
            this.onTranscriptUpdate(finalTranscript, true);
          }
        }
      } catch (err) {
        console.warn("AI transcription fallback notice:", err);
        if (finalTranscript) {
          const detected = detectLanguageFromText(finalTranscript);
          if (detected && this.onLanguageDetected) {
            this.onLanguageDetected(detected);
          }
          if (this.onTranscriptUpdate) {
            this.onTranscriptUpdate(finalTranscript, true);
          }
        }
      }
    } else if (finalTranscript) {
      const detected = detectLanguageFromText(finalTranscript);
      if (detected && this.onLanguageDetected) {
        this.onLanguageDetected(detected);
      }
      if (this.onTranscriptUpdate) {
        this.onTranscriptUpdate(finalTranscript, true);
      }
    }

    return {
      transcript: finalTranscript,
      audioBlob: recordedBlob,
    };
  }

  public abort(): void {
    this.isListening = false;
    if (this.onStateChange) this.onStateChange(false);
    if (this.recognition) {
      try {
        this.recognition.onend = null;
        this.recognition.abort();
      } catch (_) {}
      this.recognition = null;
    }
    if (this.stream) {
      try {
        this.stream.getTracks().forEach((t) => t.stop());
      } catch (_) {}
      this.stream = null;
    }
    this.mediaRecorder = null;
    this.audioChunks = [];
  }
}

/**
 * Browser Speech Recognition helper supporting Auto-Detection and all major world & Indic languages
 */
export function startVoiceRecognition(
  onResult: (transcript: string) => void,
  onError?: (err: any) => void,
  language: string = "auto",
  onLanguageDetected?: (detected: DetectedLanguageInfo) => void
): { stop: () => void } | null {
  const SpeechRecognition =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  if (!SpeechRecognition) {
    if (onError) onError("Browser speech recognition not available.");
    return null;
  }

  try {
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    
    // If auto-detect is requested, bind to browser's active locale or multilingual acoustic model
    const resolvedLang = getLanguageCode(language);
    recognition.lang = resolvedLang;

    recognition.onresult = (event: any) => {
      let fullTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        fullTranscript += event.results[i][0].transcript;
      }
      
      // Auto-detect language in real time from spoken words/characters
      if (fullTranscript.trim()) {
        const detected = detectLanguageFromText(fullTranscript);
        if (detected && onLanguageDetected) {
          onLanguageDetected(detected);
        }
      }

      onResult(fullTranscript);
    };

    recognition.onerror = (event: any) => {
      if (onError) onError(event.error);
    };

    recognition.start();

    return {
      stop: () => {
        try {
          recognition.stop();
        } catch (_) {}
      },
    };
  } catch (err) {
    if (onError) onError(err);
    return null;
  }
}

export { LiveVoiceTranscriber as SpeechTranscriber };

