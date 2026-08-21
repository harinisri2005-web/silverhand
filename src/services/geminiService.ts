import { CustomerSearchIntent, ListingCategory } from "../types";
import { detectLanguageFromText } from "./audioService";

export interface GeneratedListingAIResult {
  title: string;
  titleEnglish: string;
  description: string;
  descriptionEnglish: string;
  category: ListingCategory;
  tags: string[];
  estimatedPrice: number;
  isBarter: boolean;
  barterDetails?: string;
  digitalApprenticeEligible: boolean;
  heritageNotes?: string;
  detectedLanguage?: string;
}

// In-memory client cache
const clientCache = new Map<string, any>();

export async function generateProviderListing(
  input: string,
  language?: string
): Promise<GeneratedListingAIResult> {
  const cacheKey = `gen_listing_${(language || "auto")}_${input.trim()}`;
  if (clientCache.has(cacheKey)) {
    return clientCache.get(cacheKey);
  }

  const indicScriptRegex = /[\u0B80-\u0BFF\u0900-\u097F\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F\u0980-\u09FF\u0A80-\u0AFF]/;

  try {
    const res = await fetch("/api/gemini/generate-listing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input, language }),
    });

    if (!res.ok) {
      throw new Error(`Server returned ${res.status}`);
    }

    const data: GeneratedListingAIResult = await res.json();

    // If English title missing, provide clean fallback without firing extra API calls
    if (!data.titleEnglish || indicScriptRegex.test(data.titleEnglish)) {
      data.titleEnglish = "Traditional Handcrafted Artisan Service";
    }

    if (!data.descriptionEnglish || indicScriptRegex.test(data.descriptionEnglish)) {
      data.descriptionEnglish = "Experienced local artisan offering customized traditional handcrafted services with generational skill and personalized care.";
    }

    clientCache.set(cacheKey, data);
    return data;
  } catch (error) {
    // Fallback translation helper for common crafts
    let fallbackEnglishTitle = "Traditional Master Handcraft & Service";
    let fallbackEnglishDesc = "Experienced local artisan offering customized traditional handcraft services with generational skill and personalized care.";
    let fallbackCategory: ListingCategory = "handmade_goods";

    const lower = input.toLowerCase();
    if (lower.includes("தையல்") || lower.includes("தைப்பது") || lower.includes("துணி") || lower.includes("tailor") || lower.includes("stitch") || lower.includes("सिलाई")) {
      fallbackEnglishTitle = "Expert Custom Tailoring & Garment Stitching";
      fallbackEnglishDesc = "Experienced home tailor offering custom garment stitching, dress alterations, blouse fittings, and careful mending.";
      fallbackCategory = "repairs_mending";
    } else if (lower.includes("சமையல்") || lower.includes("உணவு") || lower.includes("சாப்பாடு") || lower.includes("cook") || lower.includes("food") || lower.includes("खाना")) {
      fallbackEnglishTitle = "Authentic Traditional Home Cooking";
      fallbackEnglishDesc = "Home-cooked heirloom meals, traditional recipes, and authentic regional delicacies made with pure ingredients.";
      fallbackCategory = "home_cooking";
    } else if (lower.includes("ஊறுகாய்") || lower.includes("pickle") || lower.includes("अचार")) {
      fallbackEnglishTitle = "Sun-Dried Traditional Homemade Pickles";
      fallbackEnglishDesc = "Handcrafted artisan pickles made with cold-pressed oils, generational spices, and sun-ripened farm produce.";
      fallbackCategory = "home_cooking";
    }

    const result: GeneratedListingAIResult = {
      title: input.slice(0, 35) || "பாரம்பரிய கைவினை சேவை",
      titleEnglish: fallbackEnglishTitle,
      description: input || "பாரம்பரிய அனுபவம் மற்றும் கைவினை நேர்த்தி.",
      descriptionEnglish: fallbackEnglishDesc,
      category: fallbackCategory,
      tags: ["Heritage", "Artisan", "Handmade", "Skill Swap"],
      estimatedPrice: 300,
      isBarter: input.toLowerCase().includes("barter") || input.toLowerCase().includes("exchange") || input.includes("மாற்று"),
      barterDetails: "Open to grocery pickup or smartphone assistance",
      digitalApprenticeEligible: true,
      heritageNotes: "Generational traditional technique crafted with patience.",
      detectedLanguage: language || "Tamil",
    };

    clientCache.set(cacheKey, result);
    return result;
  }
}

export async function parseCustomerSearchIntent(
  input: string
): Promise<CustomerSearchIntent> {
  const cacheKey = `intent_${input.trim()}`;
  if (clientCache.has(cacheKey)) {
    return clientCache.get(cacheKey);
  }

  try {
    const res = await fetch("/api/gemini/parse-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input }),
    });

    if (!res.ok) {
      throw new Error(`Server returned ${res.status}`);
    }

    const data = await res.json();
    clientCache.set(cacheKey, data);
    return data;
  } catch (error) {
    const fallback: CustomerSearchIntent = {
      category: "all",
      keywords: input.toLowerCase().split(" ").filter((w) => w.length > 2),
      maxDistanceKm: 5,
      isBarter: input.toLowerCase().includes("barter") || input.toLowerCase().includes("trade"),
      requiresApprentice: input.toLowerCase().includes("learn") || input.toLowerCase().includes("apprentice"),
      summary: `Searching for: ${input}`,
    };
    clientCache.set(cacheKey, fallback);
    return fallback;
  }
}

export interface TranslationResult {
  originalText: string;
  translatedText: string;
  detectedLanguage: string;
  targetLanguage: string;
  phoneticGuide?: string;
}

export interface DetectedLanguageResult {
  detectedLanguage: string;
  languageCode: string;
  nativeName: string;
  isTransliterated?: boolean;
}

export async function detectLanguageWithAI(
  text: string
): Promise<DetectedLanguageResult> {
  const trimmed = (text || "").trim();
  if (!trimmed) {
    return {
      detectedLanguage: "English",
      languageCode: "en-IN",
      nativeName: "English (India)",
    };
  }

  // 1. Fast local Unicode & keyword detection (0 latency, 0 API quota used)
  const local = detectLanguageFromText(trimmed);
  if (local && local.confidence >= 0.7) {
    return {
      detectedLanguage: local.name,
      languageCode: local.code,
      nativeName: local.nativeName,
    };
  }

  try {
    const res = await fetch("/api/gemini/detect-language", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: trimmed }),
    });

    if (res.ok) {
      return await res.json();
    }
  } catch (_) {}

  return {
    detectedLanguage: local?.name || "Tamil",
    languageCode: local?.code || "ta-IN",
    nativeName: local?.nativeName || "தமிழ் (Tamil)",
  };
}

export async function translateMessage(
  text: string,
  targetLanguage: string,
  sourceLanguage?: string
): Promise<TranslationResult> {
  try {
    const res = await fetch("/api/gemini/translate-message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, targetLanguage, sourceLanguage }),
    });

    if (!res.ok) {
      throw new Error(`Server returned ${res.status}`);
    }

    return await res.json();
  } catch (error) {
    console.error("Failed to translate message:", error);
    return {
      originalText: text,
      translatedText: text,
      detectedLanguage: sourceLanguage || "Original",
      targetLanguage,
    };
  }
}

export interface TransliterationResult {
  nativeText: string;
  language: string;
  englishMeaning: string;
}

export interface AudioTranscriptionResult {
  transcript: string;
  detectedLanguage: string;
  languageCode: string;
  nativeName: string;
  englishTranslation?: string;
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function transcribeAudioWithAI(
  audioBlob: Blob,
  languageHint?: string
): Promise<AudioTranscriptionResult> {
  try {
    const base64 = await blobToBase64(audioBlob);
    const res = await fetch("/api/gemini/transcribe-audio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        audioData: base64,
        mimeType: audioBlob.type || "audio/webm",
        languageHint,
      }),
    });

    if (!res.ok) {
      throw new Error(`Transcription API error: ${res.status}`);
    }

    return await res.json();
  } catch (error) {
    console.error("Failed to transcribe audio with AI:", error);
    return {
      transcript: "",
      detectedLanguage: languageHint || "English",
      languageCode: "en-IN",
      nativeName: languageHint || "English",
      englishTranslation: "",
    };
  }
}

export async function transliterateToNative(
  text: string,
  targetLanguage: string = "Tamil"
): Promise<TransliterationResult> {
  try {
    const res = await fetch("/api/gemini/transliterate-to-native", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, targetLanguage }),
    });

    if (!res.ok) {
      throw new Error(`Server returned ${res.status}`);
    }

    return await res.json();
  } catch (error) {
    console.error("Failed to transliterate:", error);
    return {
      nativeText: text,
      language: targetLanguage,
      englishMeaning: text,
    };
  }
}

export interface ConversationalInterviewResponse {
  extractedValue?: any;
  fieldKey?: string;
  nextQuestion?: string;
  nextQuestionEnglish?: string;
  nextStep: number;
  isComplete?: boolean;
  completionMessage?: string;
  completionMessageEnglish?: string;
  actionType?: "detect_location" | "none";
  compiledListing?: GeneratedListingAIResult;
}

export async function fetchConversationalInterviewStep(params: {
  step: number;
  userAnswer: string;
  language: string;
  collectedData: Record<string, any>;
}): Promise<ConversationalInterviewResponse> {
  try {
    const res = await fetch("/api/gemini/conversational-interview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      throw new Error(`Conversational interview server returned ${res.status}`);
    }

    return await res.json();
  } catch (err) {
    console.warn("Conversational interview fallback:", err);
    // Local client fallback
    const { step, userAnswer, language, collectedData } = params;
    const preferredLang = language || "Tamil";
    if (step === 1) {
      return {
        extractedValue: userAnswer,
        fieldKey: "name",
        nextQuestion: preferredLang === "Tamil" ? "அருமை! உங்கள் வயது என்ன?" : "Wonderful! What is your age?",
        nextQuestionEnglish: "Wonderful! What is your age?",
        nextStep: 2,
      };
    } else if (step === 2) {
      return {
        extractedValue: userAnswer,
        fieldKey: "age",
        nextQuestion: preferredLang === "Tamil" ? "நீங்கள் செய்யும் பாரம்பரிய கைவினை, தொழில் அல்லது சேவை என்ன?" : "What is your traditional craft, skill, or service?",
        nextQuestionEnglish: "What is your traditional craft, skill, or service?",
        nextStep: 3,
      };
    } else if (step === 3) {
      return {
        extractedValue: userAnswer,
        fieldKey: "skill",
        nextQuestion: preferredLang === "Tamil" ? "இந்த வேலைக்கு உங்கள் கட்டணம் அல்லது சம்பள எதிர்பார்ப்பு என்ன (₹)?" : "What is your expected fee or daily wage in Rupees (₹)?",
        nextQuestionEnglish: "What is your expected fee or daily wage in Rupees (₹)?",
        nextStep: 4,
      };
    } else if (step === 4) {
      return {
        extractedValue: userAnswer,
        fieldKey: "pricing",
        nextQuestion: preferredLang === "Tamil" ? "நீங்கள் தயாரித்த பொருட்களை விற்கிறீர்களா? பொருட்கள் மற்றும் அதன் விவரங்களைச் சொல்லுங்கள்." : "Are you selling physical handcrafted products? Tell us what items you make!",
        nextQuestionEnglish: "Are you selling physical handcrafted products? Tell us what items you make!",
        nextStep: 5,
      };
    } else if (step === 5) {
      return {
        extractedValue: userAnswer,
        fieldKey: "products",
        nextQuestion: preferredLang === "Tamil" ? "கடைசியாக, உங்கள் இருப்பிடத்தை தானாகக் கண்டறிய கீழே உள்ள 'GPS இருப்பிடத்தைக் கண்டறி' பட்டனை அழுத்தவும்." : "Finally, click 'Detect Location (GPS)' below to locate your workshop area!",
        nextQuestionEnglish: "Finally, click 'Detect Location (GPS)' below to locate your workshop area!",
        nextStep: 6,
        actionType: "detect_location",
      };
    } else {
      return {
        extractedValue: userAnswer,
        fieldKey: "location",
        isComplete: true,
        completionMessage: preferredLang === "Tamil" ? "உங்கள் கைவினை அட்டை (Cart) தயாராகிவிட்டது!" : "Your artisan card has been compiled!",
        completionMessageEnglish: "Your artisan card has been compiled!",
        nextStep: 6,
        compiledListing: {
          title: (collectedData.skill || userAnswer || "பாரம்பரிய கைவினை சேவை").slice(0, 40),
          titleEnglish: "Traditional Handcrafted Artisan Service",
          description: `${collectedData.skill || "Artisan service"}. ${collectedData.products ? "Products: " + collectedData.products : ""}`,
          descriptionEnglish: `Experienced senior artisan offering customized handcrafted service with traditional mastery. ${collectedData.products ? "Products: " + collectedData.products : ""}`,
          category: "handmade_goods",
          tags: ["Artisan", "Handmade", "Senior Master", "Verified Elder"],
          estimatedPrice: 350,
          isBarter: true,
          barterDetails: "Open to barter skill swap or grocery pickup",
          digitalApprenticeEligible: true,
          heritageNotes: "Generational traditional technique crafted with patience.",
          detectedLanguage: preferredLang,
        },
      };
    }
  }
}
