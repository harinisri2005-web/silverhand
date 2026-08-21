import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "25mb" }));

// Lazy initialize Gemini client
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("GEMINI_API_KEY is not set in environment.");
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// Primary recommended model for multimodal & language tasks
const PRIMARY_MODEL = "gemini-2.5-flash";
const FALLBACK_MODEL = "gemini-2.5-flash";

// Simple in-memory response cache to minimize unnecessary duplicate API requests
const geminiResponseCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL_MS = 1000 * 60 * 15; // 15 minutes cache

function cleanJsonResponse(text: string): string {
  if (!text) return "{}";
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }
  return cleaned.trim();
}

async function callGeminiWithResilience(
  ai: GoogleGenAI,
  params: {
    contents: any;
    config?: any;
    cacheKey?: string;
  }
): Promise<any> {
  // Check cache first
  if (params.cacheKey) {
    const cached = geminiResponseCache.get(params.cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }
  }

  let lastError: any = null;

  try {
    const response = await ai.models.generateContent({
      model: PRIMARY_MODEL,
      contents: params.contents,
      config: params.config,
    });

    if (response && response.text) {
      const rawText = cleanJsonResponse(response.text);
      const parsed = JSON.parse(rawText);
      if (params.cacheKey) {
        geminiResponseCache.set(params.cacheKey, { data: parsed, timestamp: Date.now() });
      }
      return parsed;
    }
  } catch (err: any) {
    lastError = err;
    const errMsg = (err?.message || String(err)).toLowerCase();
    const is429 = errMsg.includes("429") || errMsg.includes("resource_exhausted") || errMsg.includes("quota");

    // If quota exhausted (429), fail immediately so local fallback handles it seamlessly without spamming retries
    if (is429) {
      throw err;
    }

    // If transient 503/500, retry once after short delay
    const isTransient = errMsg.includes("503") || errMsg.includes("500") || errMsg.includes("unavailable");
    if (isTransient) {
      try {
        await new Promise((resolve) => setTimeout(resolve, 500));
        const retryResponse = await ai.models.generateContent({
          model: FALLBACK_MODEL,
          contents: params.contents,
          config: params.config,
        });
        if (retryResponse && retryResponse.text) {
          const rawText = cleanJsonResponse(retryResponse.text);
          const parsed = JSON.parse(rawText);
          if (params.cacheKey) {
            geminiResponseCache.set(params.cacheKey, { data: parsed, timestamp: Date.now() });
          }
          return parsed;
        }
      } catch (retryErr) {
        lastError = retryErr;
      }
    }
  }

  throw lastError || new Error("Gemini request failed");
}

// Helper: Local fallback language detector
function fallbackDetectLanguage(text: string): {
  detectedLanguage: string;
  languageCode: string;
  nativeName: string;
  isTransliterated?: boolean;
} {
  const trimmed = (text || "").trim();
  if (!trimmed) return { detectedLanguage: "English", languageCode: "en-IN", nativeName: "English (India)" };
  if (/[\u0B80-\u0BFF]/.test(trimmed)) return { detectedLanguage: "Tamil", languageCode: "ta-IN", nativeName: "தமிழ் (Tamil)" };
  if (/[\u0C00-\u0C7F]/.test(trimmed)) return { detectedLanguage: "Telugu", languageCode: "te-IN", nativeName: "తెలుగు (Telugu)" };
  if (/[\u0C80-\u0CFF]/.test(trimmed)) return { detectedLanguage: "Kannada", languageCode: "kn-IN", nativeName: "ಕನ್ನಡ (Kannada)" };
  if (/[\u0D00-\u0D7F]/.test(trimmed)) return { detectedLanguage: "Malayalam", languageCode: "ml-IN", nativeName: "മലയാളം (Malayalam)" };
  if (/[\u0980-\u09FF]/.test(trimmed)) return { detectedLanguage: "Bengali", languageCode: "bn-IN", nativeName: "বাংলা (Bengali)" };
  if (/[\u0A80-\u0AFF]/.test(trimmed)) return { detectedLanguage: "Gujarati", languageCode: "gu-IN", nativeName: "ગુજરાતી (Gujarati)" };
  if (/[\u0A00-\u0A7F]/.test(trimmed)) return { detectedLanguage: "Punjabi", languageCode: "pa-IN", nativeName: "ਪੰਜਾਬੀ (Punjabi)" };
  if (/[\u0900-\u097F]/.test(trimmed)) {
    if (/\b(आहे|नाही|कसे|झाले|पाहिजे|भाऊ|ताई)\b/i.test(trimmed)) {
      return { detectedLanguage: "Marathi", languageCode: "mr-IN", nativeName: "मराठी (Marathi)" };
    }
    return { detectedLanguage: "Hindi", languageCode: "hi-IN", nativeName: "हिन्दी (Hindi)" };
  }
  const lower = trimmed.toLowerCase();
  if (/\b(vanakkam|thayal|thuni|samayal|samaipen|pannurom|seiyya|romba|nalla|veedu|oorugai|rasam|vadai|chennai|madurai|kaithari|koodai|kaivannam)\b/i.test(lower)) {
    return { detectedLanguage: "Tamil", languageCode: "ta-IN", nativeName: "தமிழ் (Tamil)", isTransliterated: true };
  }
  if (/\b(namaste|pranam|silai|khana|ghar|bhaiya|didi|chahiye|shukriya|dhanyawad|madad|roti|sabzi|achar|masala|kapde|kaam)\b/i.test(lower)) {
    return { detectedLanguage: "Hindi", languageCode: "hi-IN", nativeName: "हिन्दी (Hindi)", isTransliterated: true };
  }
  if (/\b(namaskaram|bagunnara|chesi|kavali|kuttu|panulu|meeru|nenu|telugu)\b/i.test(lower)) {
    return { detectedLanguage: "Telugu", languageCode: "te-IN", nativeName: "తెలుగు (Telugu)", isTransliterated: true };
  }
  return { detectedLanguage: "English", languageCode: "en-IN", nativeName: "English (India)" };
}

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", app: "SilverHands Backend", time: new Date().toISOString() });
});

// Helper: Local fallback intent parser
function fallbackParseIntent(input: string): {
  category: string;
  keywords: string[];
  maxDistanceKm: number;
  isBarter: boolean;
  requiresApprentice: boolean;
  summary: string;
  detectedLanguage: string;
  translatedEnglishQuery: string;
} {
  const lower = input.toLowerCase();
  let category = "all";

  if (
    lower.includes("sari") ||
    lower.includes("saree") ||
    lower.includes("tailor") ||
    lower.includes("stitch") ||
    lower.includes("mend") ||
    lower.includes("repair") ||
    lower.includes("alter") ||
    lower.includes("தையல்") ||
    lower.includes("துணி") ||
    lower.includes("silai")
  ) {
    category = "repairs_mending";
  } else if (
    lower.includes("food") ||
    lower.includes("cook") ||
    lower.includes("pickle") ||
    lower.includes("meal") ||
    lower.includes("sweet") ||
    lower.includes("sambhar") ||
    lower.includes("rasam") ||
    lower.includes("சமையல்") ||
    lower.includes("உணவு") ||
    lower.includes("சாப்பாடு") ||
    lower.includes("ஊறுகாய்") ||
    lower.includes("khana") ||
    lower.includes("achar")
  ) {
    category = "home_cooking";
  } else if (
    lower.includes("clock") ||
    lower.includes("watch") ||
    lower.includes("horology") ||
    lower.includes("vintage") ||
    lower.includes("radio") ||
    lower.includes("gramophone") ||
    lower.includes("traditional")
  ) {
    category = "traditional_skills";
  } else if (
    lower.includes("wood") ||
    lower.includes("pottery") ||
    lower.includes("handwoven") ||
    lower.includes("quilt") ||
    lower.includes("craft") ||
    lower.includes("doll") ||
    lower.includes("kaithari") ||
    lower.includes("bommai")
  ) {
    category = "handmade_goods";
  } else if (
    lower.includes("herb") ||
    lower.includes("balm") ||
    lower.includes("plant") ||
    lower.includes("oil") ||
    lower.includes("organic") ||
    lower.includes("botanical") ||
    lower.includes("mooligai")
  ) {
    category = "gardening_botanicals";
  } else if (
    lower.includes("swap") ||
    lower.includes("trade") ||
    lower.includes("exchange") ||
    lower.includes("barter") ||
    lower.includes("மாற்று")
  ) {
    category = "barter_request";
  }

  // Distance extractor: e.g. "within 10 km" or "3km"
  const distMatch = lower.match(/(\d+)\s*(?:km|k\.m\.|kilometers|kilometer)/);
  const maxDistanceKm = distMatch ? parseFloat(distMatch[1]) : 5.0;

  const isBarter =
    lower.includes("barter") ||
    lower.includes("trade") ||
    lower.includes("swap") ||
    lower.includes("exchange") ||
    lower.includes("மாற்று");

  const requiresApprentice =
    lower.includes("learn") ||
    lower.includes("teach") ||
    lower.includes("apprentice") ||
    lower.includes("katrukkolla") ||
    lower.includes("seekhna");

  const keywords = input
    .toLowerCase()
    .replace(/[^\w\s\u0B80-\u0BFF\u0900-\u097F\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);

  const langInfo = fallbackDetectLanguage(input);

  return {
    category,
    keywords,
    maxDistanceKm,
    isBarter,
    requiresApprentice,
    summary: `Searching neighborhood listings for: ${input}`,
    detectedLanguage: langInfo.detectedLanguage,
    translatedEnglishQuery: input,
  };
}

// AI Multimodal Audio Transcriber
// Transcribes spoken audio chunks (WebM/WAV/MP4) using Gemini multimodal audio model
// Accurately recognizes Tamil, Hindi, Telugu, Kannada, Malayalam, Bengali, Marathi, English, etc.
app.post("/api/gemini/transcribe-audio", async (req, res) => {
  const { audioData, mimeType, languageHint } = req.body || {};
  if (!audioData || typeof audioData !== "string") {
    return res.status(400).json({ error: "Missing or invalid 'audioData' (base64 string)." });
  }

  const ai = getGeminiClient();
  if (!ai) {
    return res.json({
      transcript: "Voice recording captured.",
      detectedLanguage: languageHint || "English",
      languageCode: "en-IN",
      nativeName: languageHint || "English",
      englishTranslation: "Voice recording captured."
    });
  }

  try {
    const base64Clean = audioData.replace(/^data:audio\/[a-z0-9\-+;=]+;base64,/, "");
    const cleanMimeType = (mimeType || "audio/webm").split(";")[0];

    const prompt = `You are an expert multilingual acoustic speech transcriber for SilverHands, a neighborhood marketplace.
Carefully listen to the attached audio recording to determine the TRUE language spoken.

Language Context / Hint: ${languageHint || "auto-detect"}.

CRITICAL LANGUAGE DETECTION & TRANSCRIPTION RULES:
1. Acoustic Detection: Accurately determine if the speaker is speaking English, Hindi, Tamil, Telugu, Kannada, Malayalam, Bengali, etc.
   - If the speaker spoke English (e.g. "Hello hello hello, I cook" or any English phrases even with an Indian accent), detectedLanguage MUST BE "English", languageCode MUST BE "en-IN", nativeName MUST BE "English", and 'transcript' MUST BE in clean English text (e.g. "Hello hello hello I cook delicious home food").
   - If the speaker spoke Tamil, detectedLanguage MUST BE "Tamil", languageCode MUST BE "ta-IN", nativeName MUST BE "தமிழ் (Tamil)", and 'transcript' MUST BE in தமிழ் script.
   - If the speaker spoke Hindi, detectedLanguage MUST BE "Hindi", languageCode MUST BE "hi-IN", nativeName MUST BE "हिन्दी (Hindi)", and 'transcript' MUST BE in हिन्दी Devanagari script.
   - If the speaker spoke Telugu, Kannada, Malayalam, Bengali, Marathi, etc., transcribe in respective native script.
2. 'englishTranslation': MUST ALWAYS BE 100% IN FLUENT ENGLISH (Latin alphabet characters ONLY).
3. If speech is very faint or unclear, transcribe as much as audible. DO NOT return placeholder text like "Voice recording captured".

Return JSON with fields: transcript, detectedLanguage, languageCode, nativeName, englishTranslation.`;

    const parsed = await callGeminiWithResilience(ai, {
      contents: [
        {
          inlineData: {
            mimeType: cleanMimeType,
            data: base64Clean,
          },
        },
        prompt,
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            transcript: { type: Type.STRING },
            detectedLanguage: { type: Type.STRING },
            languageCode: { type: Type.STRING },
            nativeName: { type: Type.STRING },
            englishTranslation: { type: Type.STRING },
          },
          required: ["transcript", "detectedLanguage", "languageCode", "nativeName"],
        },
      },
    });

    return res.json(parsed);
  } catch (error: any) {
    const resolvedLang = languageHint && languageHint !== "auto-detect" ? languageHint : "English";
    return res.status(200).json({
      transcript: "",
      detectedLanguage: resolvedLang,
      languageCode: resolvedLang === "Tamil" ? "ta-IN" : resolvedLang === "Hindi" ? "hi-IN" : "en-IN",
      nativeName: resolvedLang === "Tamil" ? "தமிழ் (Tamil)" : resolvedLang === "Hindi" ? "हिन्दी (Hindi)" : resolvedLang,
      englishTranslation: "",
    });
  }
});

// AI Provider Listing Generator
// Takes native language input or speech transcript and creates a formatted business listing
app.post("/api/gemini/generate-listing", async (req, res) => {
  const { input, language } = req.body || {};
  if (!input || typeof input !== "string") {
    return res.status(400).json({ error: "Missing or invalid 'input' in request body." });
  }

  const ai = getGeminiClient();
  if (!ai) {
    // Fallback graceful formatting if API key not available yet
    const fallbackTitle = input.slice(0, 40);
    return res.json({
      title: fallbackTitle,
      titleEnglish: "Traditional Handcrafted Artisan Service",
      description: input,
      descriptionEnglish: "Experienced local artisan offering traditional handcrafted services with personalized care and generational skill.",
      category: "handmade_goods",
      tags: ["Artisan", "Handmade", "Local Heritage", "Skill Swap"],
      estimatedPrice: 300,
      isBarter: input.toLowerCase().includes("barter") || input.toLowerCase().includes("exchange"),
      barterDetails: "Open to exchanging for phone tutoring or grocery pickup",
      digitalApprenticeEligible: true,
      heritageNotes: "Traditional handcrafted practice passed down over generations.",
      detectedLanguage: language || "English"
    });
  }

  try {
    const prompt = `You are an expert artisan business curator for SilverHands, a hyperlocal marketplace empowering senior citizens, homemakers, and traditional master crafters.
The senior provider provided the following voice note transcript or description of their skill/product:
"""
${input}
"""
Language hint: ${language || "auto-detect"}. 

STRICT TRANSLATION & LOCALIZATION MANDATES:
1. "title": Output in the NATIVE SCRIPT of the craftsperson.
   - If Tamil/Tanglish: write in proper தமிழ் script.
   - If Hindi/Hinglish: write in हिन्दी Devanagari script.
   - If purely English: write in English.

2. "titleEnglish": MUST BE 100% IN FLUENT ENGLISH (Latin alphabet characters ONLY).
   - NEVER output Tamil (தமிழ்) or Hindi or other Indic script in "titleEnglish"!

3. "description": Output a detailed, warm description in the NATIVE SCRIPT (தமிழ், हिन्दी, etc.) highlighting craftsmanship, generational heritage, and quality.

4. "descriptionEnglish": MUST BE 100% IN FLUENT ENGLISH (Latin alphabet characters ONLY).
   - Translate and enrich the native description into an inviting, professional English paragraph.

5. "category": Choose one of: 'repairs_mending', 'handmade_goods', 'traditional_skills', 'home_cooking', 'gardening_botanicals', 'barter_request'.

6. "tags": Array of 3-6 searchable keywords in English and native terms.
7. "estimatedPrice": Suggested price in Indian Rupees (INR / ₹) as a numeric value (e.g. 250, 350, 500, 800).
8. "isBarter": Boolean (true if they mention bartering, exchange, or mutual assistance).
9. "barterDetails": What they might want in exchange (e.g. "Smartphone tutoring or local grocery pickup").
10. "digitalApprenticeEligible": Boolean (whether local youth can learn from them).
11. "heritageNotes": 1-2 sentences on preserving generational craftsmanship.
12. "detectedLanguage": The detected language name (e.g. "Tamil", "Hindi", "Telugu", "Kannada", "English").
`;

    const parsed = await callGeminiWithResilience(ai, {
      contents: prompt,
      cacheKey: `listing_${(language || "auto")}_${input.trim()}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            titleEnglish: { type: Type.STRING },
            description: { type: Type.STRING },
            descriptionEnglish: { type: Type.STRING },
            category: { type: Type.STRING },
            tags: { type: Type.ARRAY, items: { type: Type.STRING } },
            estimatedPrice: { type: Type.NUMBER },
            isBarter: { type: Type.BOOLEAN },
            barterDetails: { type: Type.STRING },
            digitalApprenticeEligible: { type: Type.BOOLEAN },
            heritageNotes: { type: Type.STRING },
            detectedLanguage: { type: Type.STRING },
          },
          required: ["title", "titleEnglish", "description", "descriptionEnglish", "category", "tags"],
        },
      },
    });

    return res.json(parsed);
  } catch (error: any) {
    const lower = (input || "").toLowerCase();
    let fallbackEnglishTitle = "Traditional Master Handcraft & Service";
    let fallbackEnglishDesc = "Experienced local artisan offering customized traditional handcraft services with generational skill and personalized care.";
    let fallbackCategory = "handmade_goods";

    if (lower.includes("தையல்") || lower.includes("தைப்பது") || lower.includes("துணி") || lower.includes("tailor") || lower.includes("stitch") || lower.includes("silai")) {
      fallbackEnglishTitle = "Expert Custom Tailoring & Garment Stitching";
      fallbackEnglishDesc = "Experienced home tailor offering custom garment stitching, dress alterations, blouse fittings, and careful mending.";
      fallbackCategory = "repairs_mending";
    } else if (lower.includes("சமையல்") || lower.includes("உணவு") || lower.includes("சாப்பாடு") || lower.includes("cook") || lower.includes("food") || lower.includes("khana")) {
      fallbackEnglishTitle = "Authentic Traditional Home Cooking";
      fallbackEnglishDesc = "Home-cooked heirloom meals, traditional recipes, and authentic regional delicacies made with pure ingredients.";
      fallbackCategory = "home_cooking";
    } else if (lower.includes("ஊறுகாய்") || lower.includes("pickle") || lower.includes("achar")) {
      fallbackEnglishTitle = "Sun-Dried Traditional Homemade Pickles";
      fallbackEnglishDesc = "Handcrafted artisan pickles made with cold-pressed oils, generational spices, and sun-ripened farm produce.";
      fallbackCategory = "home_cooking";
    }

    return res.status(200).json({
      title: input?.slice(0, 40) || "பாரம்பரிய கைவினை சேவை",
      titleEnglish: fallbackEnglishTitle,
      description: input || "பாரம்பரிய அனுபவம் மற்றும் கைவினை நேர்த்தி.",
      descriptionEnglish: fallbackEnglishDesc,
      category: fallbackCategory,
      tags: ["Heritage", "Artisan", "Handmade", "Skill Swap"],
      estimatedPrice: 300,
      isBarter: true,
      barterDetails: "Open to neighbor skill exchange or grocery run",
      digitalApprenticeEligible: true,
      heritageNotes: "Generational traditional technique crafted with patience.",
      detectedLanguage: language || "Tamil",
    });
  }
});

// PII & Identity Sanitizer: Scrubs sensitive personal credentials before AI processing
function sanitizePII(text: string): string {
  if (!text) return "";
  let sanitized = text;
  // Strip 10-12 digit numbers (Phone numbers, Aadhaar, SSN)
  sanitized = sanitized.replace(/\b(?:\+?\d{1,3}[-.\s]?)?(?:\d{10}|\d{12}|\d{3}[-.\s]\d{3}[-.\s]\d{4})\b/g, "[PROTECTED_CONTACT_INFO]");
  // Strip email addresses
  sanitized = sanitized.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, "[PROTECTED_EMAIL]");
  // Strip card numbers
  sanitized = sanitized.replace(/\b(?:\d{4}[-\s]?){3}\d{4}\b/g, "[PROTECTED_CARD]");
  return sanitized;
}

// Conversational 6-Step Voice Onboarding Interview Assistant
app.post("/api/conversational-interview", async (req, res) => {
  const { currentStep, userSpeechAnswer, preferredLang, collectedData } = req.body;
  const sanitizedAnswer = sanitizePII(userSpeechAnswer || "");
  const ai = getGeminiClient();

  // Local fallback response generator for each step covering all Indian languages
  const getFallbackResponse = () => {
    const lang = (preferredLang || "Tamil").trim().toLowerCase();
    
    // Step 1: Asked Name -> Now asking Age (Step 2)
    if (currentStep === 1) {
      let q = "Wonderful! How old are you? (e.g. 62 years old)";
      if (lang.includes("tamil") || lang === "ta") {
        q = "அருமை! உங்கள் வயது என்ன? (எ.கா. 62 வயது)";
      } else if (lang.includes("hindi") || lang === "hi") {
        q = "बहुत सुंदर! आपकी उम्र क्या है? (जैसे 65 वर्ष)";
      } else if (lang.includes("telugu") || lang === "te") {
        q = "చాలా బాగుంది! మీ వయస్సు ఎంత? (ఉదా. 62 సంవత్సరాలు)";
      } else if (lang.includes("kannada") || lang === "kn") {
        q = "ಉತ್ತಮ! ನಿಮ್ಮ ವಯಸ್ಸು ಎಷ್ಟು? (ಉದಾ. 62 ವರ್ಷ)";
      } else if (lang.includes("malayalam") || lang === "ml") {
        q = "വളരെ നല്ലത്! നിങ്ങളുടെ പ്രായം എത്രയാണ്? (ഉദാ. 62 വയസ്സ്)";
      } else if (lang.includes("bengali") || lang === "bn" || lang.includes("bangla")) {
        q = "চমৎকার! আপনার বয়স কত? (যেমন ৬২ বছর)";
      } else if (lang.includes("marathi") || lang === "mr") {
        q = "छान! तुमचे वय किती आहे? (उदा. ६२ वर्षे)";
      } else if (lang.includes("gujarati") || lang === "gu") {
        q = "સરસ! તમારી ઉંમર કેટલી છે? (દા.ત. 62 વર્ષ)";
      } else if (lang.includes("punjabi") || lang === "pa") {
        q = "ਬਹੁਤ ਵਧੀਆ! ਤੁਹਾਡੀ ਉਮਰ ਕਿੰਨੀ ਹੈ? (ਜਿਵੇਂ 62 ਸਾਲ)";
      } else if (lang.includes("odia") || lang.includes("oriya") || lang === "or") {
        q = "ବହୁତ ଭଲ! ଆପଣଙ୍କ ବୟସ କେତେ? (ଯଥା: ୬୨ ବର୍ଷ)";
      } else if (lang.includes("assamese") || lang === "as") {
        q = "বহুত ভাল! আপোনাৰ বয়স কিমান? (যেনে ৬২ বছৰ)";
      } else if (lang.includes("urdu") || lang === "ur") {
        q = "بہت اچھا! آپ کی عمر کتنی ہے؟ (جیسے 62 سال)";
      }

      return {
        extractedValue: sanitizedAnswer,
        fieldKey: "name",
        nextQuestion: q,
        nextQuestionEnglish: "Wonderful! How old are you? (e.g. 62 years old)",
        nextStep: 2,
      };
    }

    // Step 2: Asked Age -> Now asking Skill/Craft (Step 3)
    if (currentStep === 2) {
      const ageDigits = sanitizedAnswer.match(/\d+/);
      const parsedAge = ageDigits ? parseInt(ageDigits[0], 10) : 60;
      
      let q = "What is your traditional craft, skill, or service? (e.g. Sari tailoring, authentic home cooking, pottery, woodcraft, clock repairs)";
      if (lang.includes("tamil") || lang === "ta") {
        q = "நீங்கள் செய்யும் பாரம்பரிய கைவினை, தொழில் அல்லது சேவை என்ன? (எ.கா. பட்டுப் புடவை தையல், வீட்டு ஊறுகாய் & சமையல், மண்பாண்டம், மரவேலை, கடிகார பழுது)";
      } else if (lang.includes("hindi") || lang === "hi") {
        q = "आप कौन सा पारंपरिक हुनर या काम करते हैं? (जैसे साड़ियों की सिलाई, घर का शुद्ध अचार व खाना, मिट्टी के बर्तन, लकड़ी का काम, घड़ी मरम्मत)";
      } else if (lang.includes("telugu") || lang === "te") {
        q = "మీరు చేసే సాంప్రదాయ కళ, నైపుణ్యం లేదా సేవ ఏమిటి? (ఉదా. చీరల టైలరింగ్, ఇంటి వంటకాలు & పచ్చళ్ళు, చెక్క పని, కుండల తయారీ)";
      } else if (lang.includes("kannada") || lang === "kn") {
        q = "ನೀವು ಮಾಡುವ ಸಾಂಪ್ರದಾಯಿಕ ಕಲೆ, ಕೌಶಲ್ಯ ಅಥವಾ ಸೇವೆ ಯಾವುದು? (ಉದಾ. ಸೀರೆ ಹೊಲಿಗೆ, ಮನೆಯ ಅಡುಗೆ, ಮಡಕೆ ಕೆಲಸ, ಮರಗೆಲಸ, ಗಡಿಯಾರ ದುರಸ್ತಿ)";
      } else if (lang.includes("malayalam") || lang === "ml") {
        q = "നിങ്ങൾ ചെയ്യുന്ന പരമ്പരാഗത കരകൗശലം, വൈദഗ്ദ്ധ്യം അല്ലെങ്കിൽ സേവനം എന്താണ്? (ഉദാ. സാരി തയ്യൽ, നാടൻ പാചകം, മൺപാത്ര നിർമ്മാണം, മരപ്പണി, വാച്ച് റിപ്പയറിംഗ്)";
      } else if (lang.includes("bengali") || lang === "bn" || lang.includes("bangla")) {
        q = "আপনার ঐতিহ্যবাহী কারুশিল্প, দক্ষতা বা পরিষেবা কী? (যেমন শাড়ি সেলাই, খাঁটি ঘরোয়া রান্না, মৃৎশিল্প, কাঠের কাজ, ঘড়ি মেরামত)";
      } else if (lang.includes("marathi") || lang === "mr") {
        q = "तुमची पारंपारिक कला, कौशल्य किंवा सेवा कोणती आहे? (उदा. साडी शिवणकाम, घरगुती जेवण, मातीची भांडी, लाकडी काम, घड्याळ दुरुस्ती)";
      } else if (lang.includes("gujarati") || lang === "gu") {
        q = "તમારી પરંપરાગત કળા, કૌશલ્ય અથવા સેવા કઈ છે? (દા.ત. સાડી સિલાઈ, ઘરની રસોઈ, માટીકામ, લાકડાનું કામ, ઘડિયાળ રિપેરિંગ)";
      } else if (lang.includes("punjabi") || lang === "pa") {
        q = "ਤੁਹਾਡਾ ਰਵਾਇਤੀ ਹੁਨਰ ਜਾਂ ਕੰਮ ਕੀ ਹੈ? (ਜਿਵੇਂ ਸਾੜ੍ਹੀ ਸਿਲਾਈ, ਘਰੇਲੂ ਖਾਣਾ, ਮਿੱਟੀ ਦੇ ਭਾਂਡੇ, ਲੱਕੜ ਦਾ ਕੰਮ, ਘੜੀ ਮੁਰੰਮਤ)";
      } else if (lang.includes("odia") || lang.includes("oriya") || lang === "or") {
        q = "ଆପଣଙ୍କ ପାରମ୍ପରିକ କଳା, ଦକ୍ଷତା ବା ସେବା କ'ଣ? (ଯଥା: ଶାଢ଼ୀ ସିଲେଇ, ଘରୋଇ ରୋଷେଇ, ମାଟିପାତ୍ର, କାଠ କାମ)";
      } else if (lang.includes("assamese") || lang === "as") {
        q = "আপোনাৰ পৰম্পৰাগত শিল্প, দক্ষতা বা সেৱা কি? (যেনে কাপোৰ চিলাই, ঘৰুৱা খাদ্য, মাটিৰ বাচন, কাঠৰ কাম)";
      } else if (lang.includes("urdu") || lang === "ur") {
        q = "آپ کا روایتی ہنر، دستکاری یا خدمت کیا ہے؟ (جیسے ساڑھی سلائی، گھریلو کھانا، مٹی کے برتن، لکڑی کا کام)";
      }

      return {
        extractedValue: parsedAge,
        fieldKey: "age",
        nextQuestion: q,
        nextQuestionEnglish: "What is your traditional craft, skill, or service? (e.g. Sari tailoring, authentic home cooking, pottery, woodcraft, clock repairs)",
        nextStep: 3,
      };
    }

    // Step 3: Asked Skill -> Now asking Pricing / Salary Expectation (Step 4)
    if (currentStep === 3) {
      let q = "What is your expected fee, price per item/day, or are you open to neighbor barter/skill exchange? (e.g. ₹350 per day or ₹200 per repair)";
      if (lang.includes("tamil") || lang === "ta") {
        q = "உங்கள் உழைப்பிற்கான கட்டணம் அல்லது ஒரு பொருளுக்கான விலை என்ன? (எ.கா. நாள் ஒன்றுக்கு ₹350 அல்லது சேவைக்கு ₹200). பண்டமாற்று முறைக்கும் விருப்பமா?";
      } else if (lang.includes("hindi") || lang === "hi") {
        q = "आपके काम या उत्पाद का अपेक्षित मूल्य क्या है? (जैसे ₹350 प्रतिदिन या ₹200 प्रति वस्तु)? क्या आप पड़ोसियों के साथ वस्तु विनिमय (Barter) के लिए भी तैयार हैं?";
      } else if (lang.includes("telugu") || lang === "te") {
        q = "మీ సేవ లేదా వస్తువుకు మీరు ఎంత ధర ఆశిస్తున్నారు? (ఉదా. రోజుకు ₹350 లేదా ఒక పనికి ₹200)?";
      } else if (lang.includes("kannada") || lang === "kn") {
        q = "ನಿಮ್ಮ ಸೇವೆಗೆ ಅಥವಾ ವಸ್ತುವಿಗೆ ನೀವು ನಿಗದಿಪಡಿಸುವ ಬೆಲೆ ಎಷ್ಟು? (ಉದಾ. ದಿನಕ್ಕೆ ₹350 ಅಥವಾ ₹200)?";
      } else if (lang.includes("malayalam") || lang === "ml") {
        q = "നിങ്ങളുടെ സേവനത്തിനോ ഉൽപ്പന്നത്തിനോ നിങ്ങൾ പ്രതീക്ഷിക്കുന്ന നിരക്ക് എത്രയാണ്? (ഉദാ. ദിവസത്തിൽ ₹350 അല്ലെങ്കിൽ ₹200)?";
      } else if (lang.includes("bengali") || lang === "bn" || lang.includes("bangla")) {
        q = "আপনার পরিষেবার পারিশ্রমিক বা পণ্যের দাম কত? (যেমন দিনে ₹350 বা কাজের জন্য ₹200)?";
      } else if (lang.includes("marathi") || lang === "mr") {
        q = "तुमच्या सेवेचे किंवा वस्तूचे अपेक्षित शुल्क किती आहे? (उदा. दररोज ₹350 किंवा कामासाठी ₹200)?";
      } else if (lang.includes("gujarati") || lang === "gu") {
        q = "તમારી સેવા અથવા વસ્તુ માટે તમે કેટલી રકમ અપેક્ષા રાખો છો? (દા.ત. રોજના ₹350 અથવા ₹200)?";
      } else if (lang.includes("punjabi") || lang === "pa") {
        q = "ਤੁਸੀਂ ਆਪਣੇ ਕੰਮ ਜਾਂ ਚੀਜ਼ ਲਈ ਕਿੰਨੀ ਕੀਮਤ ਚਾਹੁੰਦੇ ਹੋ? (ਜਿਵੇਂ ₹350 ਰੋਜ਼ਾਨਾ ਜਾਂ ₹200)?";
      } else if (lang.includes("odia") || lang.includes("oriya") || lang === "or") {
        q = "ଆପଣଙ୍କ କାମ ବା ସାମଗ୍ରୀ ପାଇଁ ମୂଲ୍ୟ କେତେ? (ଯଥା: ଦିନକୁ ₹350 ବା ₹200)?";
      } else if (lang.includes("assamese") || lang === "as") {
        q = "আপোনাৰ কাম বা সামগ্ৰীৰ মূল্য কিমান হ'ব? (যেনে দৈনিক ₹350 বা ₹200)?";
      } else if (lang.includes("urdu") || lang === "ur") {
        q = "آپ کے کام یا چیز کی کتنی اجرت یا قیمت ہے؟ (جیسے ₹350 روزانہ یا ₹200)?";
      }

      return {
        extractedValue: sanitizedAnswer,
        fieldKey: "skill",
        nextQuestion: q,
        nextQuestionEnglish: "What is your expected fee, price per item/day, or are you open to neighbor barter/skill exchange? (e.g. ₹350 per day or ₹200 per repair)",
        nextStep: 4,
      };
    }

    // Step 4: Asked Pricing -> Now asking Physical Products / Materials (Step 5)
    if (currentStep === 4) {
      const priceMatch = sanitizedAnswer.match(/\d+/);
      const parsedPrice = priceMatch ? parseInt(priceMatch[0], 10) : 350;
      const isBarterMentioned = /barter|trade|swap|exchange|மாற்று|பரிமாற்றம்|अदला-बदली|ವಿನಿಮಯ|మార్పిడి|বিনিময়|देवाणघेवाण|ਅਦਲਾ|ବିନିମୟ|تبادلہ/i.test(sanitizedAnswer);
      
      let q = "Are you selling physical handcrafted products (like tailored garments, spice pickles, crafts)? If yes, what items do you make?";
      if (lang.includes("tamil") || lang === "ta") {
        q = "நீங்கள் வாடிக்கையாளர்களுக்கு நேரடியாக தயாரித்த பொருட்களை விற்கிறீர்களா? (எ.கா. தைத்த ஆடைகள், இனிப்புகள், இயற்கை மூலிகை எண்ணெய், கைவினைப் பொருட்கள்). ஆம் எனில், என்னென்ன பொருட்கள் செய்கிறீர்கள்?";
      } else if (lang.includes("hindi") || lang === "hi") {
        q = "क्या आप ग्राहकों को सीधे बने हुए उत्पाद या सामान बेचते हैं? (जैसे सिले हुए कपड़े, शुद्ध मसाले, हस्तशिल्प). यदि हाँ, तो आप कौन-कौन से उत्पाद बनाते हैं?";
      } else if (lang.includes("telugu") || lang === "te") {
        q = "మీరు నేరుగా తయారు చేసిన వస్తువులను అమ్ముతున్నారా? (ఉదా. చేతితో చేసిన వస్తువులు, పచ్చళ్ళు). అవును అయితే మీరు ఏ వస్తువులు చేస్తారు?";
      } else if (lang.includes("kannada") || lang === "kn") {
        q = "ನೀವು ನೇರವಾಗಿ ತಯಾರಿಸಿದ ವಸ್ತುಗಳನ್ನು ಮಾರಾಟ ಮಾಡುತ್ತೀರಾ? ಹೌದಾದರೆ ನೀವು ಯಾವ ವಸ್ತುಗಳನ್ನು ಮಾಡುತ್ತೀರಿ?";
      } else if (lang.includes("malayalam") || lang === "ml") {
        q = "നിങ്ങൾ കൈകൊണ്ട് നിർമ്മിച്ച ഉൽപ്പന്നങ്ങൾ നേരിട്ട് വിൽക്കുന്നുണ്ടോ? ഉവ്വ് എങ്കിൽ, ഏതൊക്കെ ഉൽപ്പന്നങ്ങളാണ് ഉണ്ടാക്കുന്നത്?";
      } else if (lang.includes("bengali") || lang === "bn" || lang.includes("bangla")) {
        q = "আপনি কি হাতে তৈরি জিনিসপত্র সরাসরি বিক্রি করেন? হ্যাঁ হলে, কী কী পণ্য তৈরি করেন?";
      } else if (lang.includes("marathi") || lang === "mr") {
        q = "तुम्ही थेट हाताने बनवलेल्या वस्तू विकता का? होय असल्यास, तुम्ही कोणती उत्पादने बनवता?";
      } else if (lang.includes("gujarati") || lang === "gu") {
        q = "શું તમે ગ્રાહકોને સીધા બનાવેલા ઉત્પાદનો વેચો છો? જો હા, તો તમે કઈ કઈ વસ્તુઓ બનાવો છો?";
      } else if (lang.includes("punjabi") || lang === "pa") {
        q = "ਕੀ ਤੁਸੀਂ ਹੱਥੀਂ ਬਣਾਈਆਂ ਚੀਜ਼ਾਂ ਸਿੱਧੀਆਂ ਵੇਚਦੇ ਹੋ? ਜੇ ਹਾਂ, ਤਾਂ ਕਿਹੜੀਆਂ ਚੀਜ਼ਾਂ ਬਣਾਉਂਦੇ ਹੋ?";
      } else if (lang.includes("odia") || lang.includes("oriya") || lang === "or") {
        q = "ଆପଣ ହାତତିଆରି ସାମଗ୍ରୀ ସିଧାସଳଖ ବିକ୍ରି କରନ୍ତି କି? ଯଦି ହଁ, ତେବେ କ'ଣ କ'ଣ ସାମଗ୍ରୀ ତିଆରି କରନ୍ତି?";
      } else if (lang.includes("assamese") || lang === "as") {
        q = "আপুনি হাতেৰে তৈয়াৰী সামগ্ৰী পোনপটীয়াকৈ বিক্ৰী কৰে নেকি? যদি কৰে, কি কি সামগ্ৰী প্ৰস্তুত কৰে?";
      } else if (lang.includes("urdu") || lang === "ur") {
        q = "کیا آپ گاہکوں کو براہ راست تیار کردہ مصنوعات فروخت کرتے ہیں؟ اگر ہاں تو کون کون سی اشیاء بناتے ہیں؟";
      }

      return {
        extractedValue: { price: parsedPrice, isBarter: isBarterMentioned },
        fieldKey: "pricing",
        nextQuestion: q,
        nextQuestionEnglish: "Are you selling physical handcrafted products or pure services? If products, what items do you make and what materials are used?",
        nextStep: 5,
      };
    }

    // Step 5: Asked Products -> Now asking Auto Location GPS (Step 6)
    if (currentStep === 5) {
      let q = "Finally, let's detect your workshop neighborhood so neighbors nearby can easily find you! Click the 'Detect Location (GPS)' button below or state your neighborhood name.";
      if (lang.includes("tamil") || lang === "ta") {
        q = "கடைசியாக, உங்கள் இருப்பிடத்தை தானாகக் கண்டறிய கீழே உள்ள 'இருப்பிடத்தைக் கண்டறி (GPS)' பட்டனை அழுத்தவும் அல்லது உங்கள் பகுதி பெயரைச் சொல்லுங்கள்.";
      } else if (lang.includes("hindi") || lang === "hi") {
        q = "अंत में, अपने इलाके का पता लगाने के लिए नीचे दिए गए 'ऑटो-लोकेशन (GPS)' बटन को दबाएं या अपने मोहल्ले का नाम बताएं।";
      } else if (lang.includes("telugu") || lang === "te") {
        q = "చివరగా, మీ వర్క్‌షాప్ ప్రాంతాన్ని గుర్తించడానికి క్రింది 'GPS ఆటో-లొకేషన్' బటన్ నొక్కండి లేదా మీ ప్రాంతం పేరు చెప్పండి.";
      } else if (lang.includes("kannada") || lang === "kn") {
        q = "ಕೊನೆಯದಾಗಿ, ನಿಮ್ಮ ಕಾರ್ಯಾಗಾರದ ಸ್ಥಳವನ್ನು ಪತ್ತೆಹಚ್ಚಲು ಕೆಳಗಿನ 'GPS ಆಟೋ-ಲೊಕೇಶನ್' ಬಟನ್ ಕ್ಲಿಕ್ ಮಾಡಿ ಅಥವಾ ನಿಮ್ಮ ಪ್ರದೇಶದ ಹೆಸರನ್ನು ಹೇಳಿ.";
      } else if (lang.includes("malayalam") || lang === "ml") {
        q = "അവസാനമായി, നിങ്ങളുടെ പ്രദേശത്തിന്റെ ലൊക്കേഷൻ കണ്ടെത്താൻ താഴെയുള്ള 'GPS ഓട്ടോ-ഡിറ്റക്ട്' ബട്ടൺ അമർത്തുക അല്ലെങ്കിൽ പ്രദേശത്തിന്റെ പേര് പറയുക.";
      } else if (lang.includes("bengali") || lang === "bn" || lang.includes("bangla")) {
        q = "শেষে, আপনার এলাকার অবস্থান স্বয়ংক্রিয়ভাবে শনাক্ত করতে নীচের 'GPS অবস্থান নির্ণয়' বোতামে চাপ দিন বা এলাকার নাম বলুন।";
      } else if (lang.includes("marathi") || lang === "mr") {
        q = "शेवटी, तुमचा परिसर शोधण्यासाठी खालील 'GPS ऑटो-लोकेशन' बटणावर क्लिक करा किंवा भागाचे नाव सांगा.";
      } else if (lang.includes("gujarati") || lang === "gu") {
        q = "છેલ્લે, તમારા વિસ્તારનું લોકેશન શોધવા માટે નીચે આપેલા 'GPS ઓટો-ડિટેક્ટ' બટન પર ક્લિક કરો અથવા વિસ્તારનું નામ કહો.";
      } else if (lang.includes("punjabi") || lang === "pa") {
        q = "ਅਖੀਰ ਵਿੱਚ, ਆਪਣੇ ਇਲਾਕੇ ਦਾ ਪਤਾ ਲਗਾਉਣ ਲਈ ਹੇਠਾਂ 'GPS ਆਟੋ-ਲੋਕੇਸ਼ਨ' ਬਟਨ ਦਬਾਓ ਜਾਂ ਆਪਣੇ ਇਲਾਕੇ ਦਾ ਨਾਮ ਦੱਸੋ।";
      } else if (lang.includes("odia") || lang.includes("oriya") || lang === "or") {
        q = "ଶେଷରେ, ଆପଣଙ୍କ ଅଞ୍ଚଳ ଚିହ୍ନଟ କରିବାକୁ ତଳେ ଥିବା 'GPS ସ୍ୱୟଂକ୍ରିୟ ଚିହ୍ନଟ' ବଟନ୍ ଦବାନ୍ତୁ ବା ଅଞ୍ଚଳର ନାମ କୁହନ୍ତୁ।";
      } else if (lang.includes("assamese") || lang === "as") {
        q = "শেষত, আপোনাৰ অঞ্চল চিনাক্ত কৰিবলৈ তলৰ 'GPS অৱস্থান নিৰ্ণয়' বুটামত টিপক বা অঞ্চলটোৰ নাম কওক।";
      } else if (lang.includes("urdu") || lang === "ur") {
        q = "آخر میں، اپنے علاقے کا پتہ لگانے کے لیے نیچے 'GPS آٹو لوکیشن' بٹن دبائیں یا اپنے علاقے کا نام بتائیں۔";
      }

      return {
        extractedValue: sanitizedAnswer,
        fieldKey: "products",
        nextQuestion: q,
        nextQuestionEnglish: "Finally, let's detect your workshop neighborhood so nearby neighbors can find you! Click the 'Detect Location (GPS)' button below or state your neighborhood name.",
        nextStep: 6,
        actionType: "detect_location",
      };
    }

    // Step 6: Asked Location -> Compiling Full Artisan Marketplace Cart Card!
    const skillText = collectedData?.skill || sanitizedAnswer;
    const productsText = collectedData?.products || "";
    const isCooking = /cook|food|pickle|sweet|சாப்பாடு|சமையல்|ஊறுகாய்|खाना|अचार|వంట|ಅಡುಗೆ|പാചകം|রান্না|स्वयंपाक|રસોઈ|ਅਚਾਰ|ଆଚାର|ৰন্ধন|کھانا/i.test(skillText + " " + productsText);
    const isRepairs = /tailor|stitch|sari|mend|repair|தையல்|துணி|सिलाई|కుట్లు|ಹೊಲಿಗೆ|തയ്യൽ|সেলাই|शिवणकाम|સિલાઈ|ਸਿਲਾਈ|ସିଲେଇ|চিলাই|سلائی/i.test(skillText + " " + productsText);
    const detectedCategory = isCooking ? "home_cooking" : isRepairs ? "repairs_mending" : "handmade_goods";

    let compMsg = "Wonderful! All your responses have been compiled into your verified Artisan Profile & Marketplace Card!";
    if (lang.includes("tamil") || lang === "ta") {
      compMsg = "மிக்க மகிழ்ச்சி! உங்கள் விவரங்கள் அனைத்தும் பெறப்பட்டு உங்கள் கைவினை அட்டை (Cart Listing) தயாராகிவிட்டது!";
    } else if (lang.includes("hindi") || lang === "hi") {
      compMsg = "बहुत बधाई! आपकी सभी जानकारी प्राप्त हो गई है और आपका कारीगर कार्ड (Cart Listing) तैयार है!";
    } else if (lang.includes("telugu") || lang === "te") {
      compMsg = "అభినందనలు! మీ వివరాలు విజయవంతంగా పూర్తయ్యాయి. మీ ఆర్టిసాన్ కార్డ్ సిద్ధంగా ఉంది!";
    } else if (lang.includes("kannada") || lang === "kn") {
      compMsg = "ಅಭಿನಂದನೆಗಳು! ನಿಮ್ಮ ವಿವರಗಳು ದಾಖಲಾಗಿವೆ ಮತ್ತು ನಿಮ್ಮ ಕುಶಲಕರ್ಮಿ ಕಾರ್ಡ್ ಸಿದ್ಧವಾಗಿದೆ!";
    } else if (lang.includes("malayalam") || lang === "ml") {
      compMsg = "വളരെ സന്തോഷം! നിങ്ങളുടെ വിവരങ്ങൾ പൂർണ്ണമായി ശേഖരിച്ചു, നിങ്ങളുടെ ആർട്ടിസാൻ കാർഡ് തയ്യാറായിക്കഴിഞ്ഞു!";
    } else if (lang.includes("bengali") || lang === "bn" || lang.includes("bangla")) {
      compMsg = "অভিনন্দন! আপনার সমস্ত তথ্য সংগৃহীত হয়েছে এবং আপনার কারিগর কার্ড প্রস্তুত!";
    } else if (lang.includes("marathi") || lang === "mr") {
      compMsg = "अभिनंदन! तुमची सर्व माहिती जमा झाली असून तुमचे कारागीर कार्ड तयार आहे!";
    } else if (lang.includes("gujarati") || lang === "gu") {
      compMsg = "અભિનંદન! તમારી બધી વિગતો નોંધાઈ ગઈ છે અને તમારું કારીગર કાર્ડ તૈયાર છે!";
    } else if (lang.includes("punjabi") || lang === "pa") {
      compMsg = "ਮੁਬਾਰਕਾਂ! ਤੁਹਾਡੀ ਸਾਰੀ ਜਾਣਕਾਰੀ ਦਰਜ ਹੋ ਗਈ ਹੈ ਅਤੇ ਤੁਹਾਡਾ ਕਾਰੀਗਰ ਕਾਰਡ ਤਿਆਰ ਹੈ!";
    } else if (lang.includes("odia") || lang.includes("oriya") || lang === "or") {
      compMsg = "ଅଭିନନ୍ଦନ! ଆପଣଙ୍କ ସମସ୍ତ ତଥ୍ୟ ସଂଗ୍ରହ ହୋଇଛି ଏବଂ ଆପଣଙ୍କ କାରିଗର କାର୍ଡ ପ୍ରସ୍ତୁତ!";
    } else if (lang.includes("assamese") || lang === "as") {
      compMsg = "অভিনন্দন! আপোনাৰ সকলো তথ্য সংগ্ৰহ কৰা হৈছে আৰু আপোনাৰ কাৰিকৰ কাৰ্ড সাজু হৈছে!";
    } else if (lang.includes("urdu") || lang === "ur") {
      compMsg = "مبارک ہو! آپ کی تمام تفصیلات حاصل کر لی گئی ہیں اور آپ کا کاریگر کارڈ تیار ہے!";
    }
    
    return {
      extractedValue: sanitizedAnswer || "Local Neighborhood",
      fieldKey: "location",
      isComplete: true,
      completionMessage: compMsg,
      completionMessageEnglish: "Wonderful! All your responses have been assembled into your Artisan Profile & Marketplace Card!",
      compiledListing: {
        title: skillText.slice(0, 40),
        titleEnglish: isCooking ? "Authentic Traditional Home Cooking & Treats" : isRepairs ? "Expert Custom Tailoring & Garment Mending" : "Traditional Handcrafted Artisan Service",
        description: `${skillText}. ${productsText ? "Products: " + productsText : ""}`,
        descriptionEnglish: `Experienced senior artisan with generational expertise offering ${skillText}. ${productsText ? "Specialized handcrafted items: " + productsText : ""}`,
        category: detectedCategory,
        tags: ["Artisan", "Handmade", "Heritage Craft", "Verified Elder"],
        estimatedPrice: collectedData?.pricing?.price || 350,
        isBarter: collectedData?.pricing?.isBarter || false,
        barterDetails: "Open to skill swap or local grocery assistance",
        digitalApprenticeEligible: true,
        heritageNotes: "Generational traditional master technique crafted with care.",
        detectedLanguage: preferredLang,
      }
    };
  };

  if (!ai) {
    return res.json(getFallbackResponse());
  }

  try {
    const prompt = `You are a warm, respectful multilingual conversational AI assistant for SilverHands, helping senior citizens and uneducated/elder artisans create their marketplace listing.
Language preference: ${preferredLang}.
Current Step: ${currentStep} of 6.
User's Answer (sanitized for PII): """${sanitizedAnswer}"""
Collected Data so far: ${JSON.stringify(collectedData || {})}

STEP WORKFLOW:
Step 1: Asking Name -> Extract artisan's full name, formulate next question asking for their Age in ${preferredLang} and English.
Step 2: Asking Age -> Extract age (number), formulate next question asking for their Master Skill/Craft (e.g. tailoring, cooking, woodwork, pottery, clock repair) in ${preferredLang} and English.
Step 3: Asking Skill -> Extract craft details, formulate next question asking for their Salary expectation/Pricing (Rupees per item/day or barter swap) in ${preferredLang} and English.
Step 4: Asking Salary/Price -> Extract pricing, formulate next question asking whether they sell physical products (what items/materials) or pure services in ${preferredLang} and English.
Step 5: Asking Products -> Extract product details, formulate next question asking to confirm/detect their workshop neighborhood location in ${preferredLang} and English.
Step 6: Confirming Location / Finalizing -> Mark isComplete: true, synthesize all answers into a complete, high-quality marketplace listing object with bilingual title, description, category ('handmade_goods'|'traditional_skills'|'home_cooking'|'repairs_mending'|'gardening_botanicals'|'barter_request'), tags, estimatedPrice, isBarter, barterDetails.

Output JSON matching the schema.`;

    const parsed = await callGeminiWithResilience(ai, {
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            extractedValue: { type: Type.STRING },
            fieldKey: { type: Type.STRING },
            nextQuestion: { type: Type.STRING },
            nextQuestionEnglish: { type: Type.STRING },
            nextStep: { type: Type.INTEGER },
            isComplete: { type: Type.BOOLEAN },
            completionMessage: { type: Type.STRING },
            completionMessageEnglish: { type: Type.STRING },
            actionType: { type: Type.STRING },
            compiledListing: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                titleEnglish: { type: Type.STRING },
                description: { type: Type.STRING },
                descriptionEnglish: { type: Type.STRING },
                category: { type: Type.STRING },
                tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                estimatedPrice: { type: Type.NUMBER },
                isBarter: { type: Type.BOOLEAN },
                barterDetails: { type: Type.STRING },
                digitalApprenticeEligible: { type: Type.BOOLEAN },
                heritageNotes: { type: Type.STRING },
              },
            },
          },
          required: ["nextQuestion", "nextQuestionEnglish"],
        },
      },
    });

    return res.json(parsed);
  } catch (err) {
    return res.json(getFallbackResponse());
  }
});

// Multilingual Real-Time Chat Translation
// Seamlessly bridges senior provider and customer communicating in different languages
app.post("/api/gemini/translate-message", async (req, res) => {
  const { text, targetLanguage, sourceLanguage } = req.body || {};
  if (!text || !targetLanguage) {
    return res.status(400).json({ error: "Missing 'text' or 'targetLanguage'." });
  }

  const trimmed = text.trim();
  const ai = getGeminiClient();
  if (!ai) {
    return res.json({
      originalText: trimmed,
      translatedText: trimmed,
      detectedLanguage: sourceLanguage || "English",
      targetLanguage,
      phoneticGuide: "",
    });
  }

  try {
    const prompt = `Translate the following message for the SilverHands marketplace chat between a senior craftsman and a neighbor.
Source Text: """${trimmed}"""
Source Language Hint: ${sourceLanguage || "Auto-detect"}
Target Language: ${targetLanguage}

Ensure the translation is respectful, warm, and natural for senior-friendly conversation.
Output JSON:
{
  "originalText": "${trimmed}",
  "translatedText": "string",
  "detectedLanguage": "string",
  "targetLanguage": "${targetLanguage}",
  "phoneticGuide": "optional pronunciation helper if translating to regional scripts"
}
`;

    const parsed = await callGeminiWithResilience(ai, {
      contents: prompt,
      cacheKey: `trans_${sourceLanguage || "auto"}_${targetLanguage}_${trimmed}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            originalText: { type: Type.STRING },
            translatedText: { type: Type.STRING },
            detectedLanguage: { type: Type.STRING },
            targetLanguage: { type: Type.STRING },
            phoneticGuide: { type: Type.STRING },
          },
          required: ["originalText", "translatedText", "detectedLanguage"],
        },
      },
    });

    return res.json(parsed);
  } catch (error: any) {
    return res.status(200).json({
      originalText: trimmed,
      translatedText: trimmed,
      detectedLanguage: sourceLanguage || "Original",
      targetLanguage,
      phoneticGuide: "",
    });
  }
});

// Automatic Spoken & Written Language Detection
// Detects language regardless of user selection (e.g., if English was selected but user speaks/types Tamil)
app.post("/api/gemini/detect-language", async (req, res) => {
  const { text } = req.body || {};
  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "Missing 'text' parameter." });
  }

  const trimmed = text.trim();
  if (!trimmed) {
    return res.json({
      detectedLanguage: "English",
      languageCode: "en-IN",
      nativeName: "English",
    });
  }

  // Check deterministic local fallback first
  const localDetected = fallbackDetectLanguage(trimmed);

  const ai = getGeminiClient();
  if (!ai) {
    return res.json(localDetected);
  }

  try {
    const prompt = `Analyze this spoken or written text from an artisan or customer:
"""${trimmed}"""

Identify what language this is, even if written in Roman/English alphabet (transliterated phonetic speech) or native script.
Map it to one of the following codes:
- "ta-IN" (Tamil / தமிழ்)
- "hi-IN" (Hindi / हिन्दी)
- "te-IN" (Telugu / తెలుగు)
- "kn-IN" (Kannada / ಕನ್ನಡ)
- "ml-IN" (Malayalam / മലയാളம்)
- "bn-IN" (Bengali / বাংলা)
- "mr-IN" (Marathi / मराठी)
- "gu-IN" (Gujarati / ગુજરાતી)
- "pa-IN" (Punjabi / ਪੰਜਾਬੀ)
- "en-IN" (English / English (India))
- "es-ES" (Spanish / Español)
- "fr-FR" (French / Français)
- "de-DE" (German / Deutsch)
- "ar-SA" (Arabic / العربية)

Output JSON:
{
  "detectedLanguage": "Tamil" | "Hindi" | "Telugu" | "Kannada" | "Malayalam" | "Bengali" | "Marathi" | "Gujarati" | "Punjabi" | "English" | "Spanish" | "French" | "German" | "Arabic",
  "languageCode": "ta-IN" | "hi-IN" | "te-IN" | "kn-IN" | "ml-IN" | "bn-IN" | "mr-IN" | "gu-IN" | "pa-IN" | "en-IN" | "es-ES" | "fr-FR" | "de-DE" | "ar-SA",
  "nativeName": "string",
  "isTransliterated": boolean
}
`;

    const parsed = await callGeminiWithResilience(ai, {
      contents: prompt,
      cacheKey: `detect_${trimmed}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            detectedLanguage: { type: Type.STRING },
            languageCode: { type: Type.STRING },
            nativeName: { type: Type.STRING },
            isTransliterated: { type: Type.BOOLEAN },
          },
          required: ["detectedLanguage", "languageCode", "nativeName"],
        },
      },
    });

    return res.json(parsed);
  } catch (error: any) {
    return res.status(200).json(localDetected);
  }
});

// Convert Phonetic / Spoken Romanized Indian text (e.g. "Naan Samay pain in Raja Samiti") directly into native script (தமிழ் / हिन्दी / etc.)
app.post("/api/gemini/transliterate-to-native", async (req, res) => {
  const { text, targetLanguage } = req.body || {};
  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "Missing 'text' parameter." });
  }

  const trimmed = text.trim();
  const ai = getGeminiClient();
  if (!ai) {
    return res.json({
      nativeText: trimmed,
      language: targetLanguage || "Tamil",
      englishMeaning: trimmed,
    });
  }

  try {
    const prompt = `You are an expert multilingual linguist specialized in Indian languages (Tamil, Hindi, Telugu, Kannada, Malayalam, Bengali, etc.).
The user spoke or typed the following text, which might be in phonetic Romanized script or mixed speech:
"""
${trimmed}
"""
Target Language Preference: ${targetLanguage || "Tamil (தமிழ்)"}.

Convert this into:
1. "nativeText": The accurate, grammatically clean text in proper native script.
2. "language": Name of the language
3. "englishMeaning": Clear English translation of the spoken message.

Output JSON:
{
  "nativeText": "string",
  "language": "string",
  "englishMeaning": "string"
}
`;

    const parsed = await callGeminiWithResilience(ai, {
      contents: prompt,
      cacheKey: `translit_${targetLanguage || "Tamil"}_${trimmed}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            nativeText: { type: Type.STRING },
            language: { type: Type.STRING },
            englishMeaning: { type: Type.STRING },
          },
          required: ["nativeText", "language", "englishMeaning"],
        },
      },
    });

    return res.json(parsed);
  } catch (error: any) {
    return res.status(200).json({
      nativeText: trimmed,
      language: targetLanguage || "Tamil",
      englishMeaning: trimmed,
    });
  }
});

// Vite Middleware & Static Serving
async function setupServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`SilverHands Full-Stack Server running on http://0.0.0.0:${PORT}`);
  });
}

setupServer();
