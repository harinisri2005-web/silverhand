import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI, Type } from "@google/genai";

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "silverhands-vercel",
      },
    },
  });
}

function fallbackDetectLanguage(text: string): {
  detectedLanguage: string;
  languageCode: string;
  nativeName: string;
} {
  const trimmed = (text || "").trim();
  if (!trimmed) return { detectedLanguage: "English", languageCode: "en-IN", nativeName: "English" };
  if (/[\u0B80-\u0BFF]/.test(trimmed)) return { detectedLanguage: "Tamil", languageCode: "ta-IN", nativeName: "தமிழ்" };
  if (/[\u0C00-\u0C7F]/.test(trimmed)) return { detectedLanguage: "Telugu", languageCode: "te-IN", nativeName: "తెలుగు" };
  if (/[\u0C80-\u0CFF]/.test(trimmed)) return { detectedLanguage: "Kannada", languageCode: "kn-IN", nativeName: "ಕನ್ನಡ" };
  if (/[\u0D00-\u0D7F]/.test(trimmed)) return { detectedLanguage: "Malayalam", languageCode: "ml-IN", nativeName: "മലയാളം" };
  if (/[\u0980-\u09FF]/.test(trimmed)) return { detectedLanguage: "Bengali", languageCode: "bn-IN", nativeName: "বাংলা" };
  if (/[\u0A80-\u0AFF]/.test(trimmed)) return { detectedLanguage: "Gujarati", languageCode: "gu-IN", nativeName: "ગુજરાતી" };
  if (/[\u0A00-\u0A7F]/.test(trimmed)) return { detectedLanguage: "Punjabi", languageCode: "pa-IN", nativeName: "ਪੰਜਾਬੀ" };
  if (/[\u0900-\u097F]/.test(trimmed)) return { detectedLanguage: "Hindi", languageCode: "hi-IN", nativeName: "हिन्दी" };
  const lower = trimmed.toLowerCase();
  if (/\b(vanakkam|thayal|thuni|samayal|samaipen|pannurom|seiyya|romba|nalla|chennai|madurai)\b/i.test(lower)) {
    return { detectedLanguage: "Tamil", languageCode: "ta-IN", nativeName: "தமிழ்" };
  }
  if (/\b(namaste|pranam|silai|khana|ghar|bhaiya|didi|chahiye|shukriya|dhanyawad|madad)\b/i.test(lower)) {
    return { detectedLanguage: "Hindi", languageCode: "hi-IN", nativeName: "हिन्दी" };
  }
  return { detectedLanguage: "English", languageCode: "en-IN", nativeName: "English" };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const url = req.url || "";
  const ai = getGeminiClient();

  try {
    // 1. Health check
    if (url.includes("/api/health") || url === "/api") {
      return res.status(200).json({
        status: "ok",
        platform: "Vercel Serverless (Free Tier)",
        time: new Date().toISOString(),
      });
    }

    // 1b. Transcribe Audio
    if (url.includes("/api/gemini/transcribe-audio")) {
      const { audioData, mimeType, languageHint } = req.body || {};
      if (!audioData) {
        return res.status(400).json({ error: "Missing 'audioData' (base64 string)" });
      }

      if (!ai) {
        return res.status(200).json({
          transcript: "Voice recording captured.",
          detectedLanguage: languageHint || "English",
          languageCode: "en-IN",
          nativeName: languageHint || "English",
          englishTranslation: "Voice recording captured.",
        });
      }

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

Return JSON with fields: transcript, detectedLanguage, languageCode, nativeName, englishTranslation.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
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

      return res.status(200).json(JSON.parse(response.text || "{}"));
    }

    // 2. Generate Provider Listing
    if (url.includes("/api/gemini/generate-listing")) {
      const { input, language } = req.body || {};
      if (!input) {
        return res.status(400).json({ error: "Missing 'input'" });
      }

      if (!ai) {
        return res.status(200).json({
          title: input.slice(0, 40),
          titleEnglish: "Traditional Handcrafted Artisan Service",
          description: input,
          descriptionEnglish: "Experienced local artisan offering traditional handcrafted services with personalized care and generational skill.",
          category: "handmade_goods",
          tags: ["Artisan", "Handmade", "Local Heritage", "Skill Swap"],
          estimatedPrice: 300,
          isBarter: input.toLowerCase().includes("barter") || input.toLowerCase().includes("exchange"),
          barterDetails: "Open to neighbor skill exchange",
          digitalApprenticeEligible: true,
          heritageNotes: "Generational handcrafted technique.",
          detectedLanguage: language || "English",
        });
      }

      const prompt = `You are an expert artisan business curator for SilverHands, a hyperlocal marketplace empowering senior citizens, homemakers, and traditional master crafters.
Input: """${input}"""
Language Hint: ${language || "auto-detect"}.

STRICT TRANSLATION & LOCALIZATION MANDATES:
1. "title": Output in the NATIVE SCRIPT (e.g. தமிழ் script if Tamil, हिन्दी if Hindi, or English).
2. "titleEnglish": MUST BE 100% IN FLUENT ENGLISH (Latin alphabet characters ONLY). NEVER output Tamil or non-English script in titleEnglish!
3. "description": Output warm detailed description in the NATIVE SCRIPT (தமிழ், हिन्दी, etc.).
4. "descriptionEnglish": MUST BE 100% IN FLUENT ENGLISH (Latin alphabet characters ONLY). NEVER output Tamil or non-English script in descriptionEnglish!
5. "category": One of 'repairs_mending', 'handmade_goods', 'traditional_skills', 'home_cooking', 'gardening_botanicals', 'barter_request'.
6. "tags": Array of 3-6 keywords in English and native script.
7. "estimatedPrice": Number in INR (₹).
8. "isBarter": Boolean.
9. "barterDetails": String.
10. "digitalApprenticeEligible": Boolean.
11. "heritageNotes": String.
12. "detectedLanguage": String.`;

      try {
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
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

        const parsed = JSON.parse(response.text || "{}");
        return res.status(200).json(parsed);
      } catch (_) {
        return res.status(200).json({
          title: input.slice(0, 40),
          titleEnglish: "Traditional Handcrafted Artisan Service",
          description: input,
          descriptionEnglish: "Experienced local artisan offering traditional handcrafted services with personalized care and generational skill.",
          category: "handmade_goods",
          tags: ["Artisan", "Handmade", "Local Heritage", "Skill Swap"],
          estimatedPrice: 300,
          isBarter: input.toLowerCase().includes("barter") || input.toLowerCase().includes("exchange"),
          barterDetails: "Open to neighbor skill exchange",
          digitalApprenticeEligible: true,
          heritageNotes: "Generational handcrafted technique.",
          detectedLanguage: language || "English",
        });
      }
    }

    // 3. Customer Search Intent
    if (url.includes("/api/gemini/parse-intent")) {
      const { input } = req.body || {};
      if (!input) return res.status(400).json({ error: "Missing 'input'" });

      const fallback = {
        category: "all",
        keywords: input.split(" ").filter((w: string) => w.length > 2),
        maxDistanceKm: 5,
        isBarter: false,
        summary: `Looking for: ${input}`,
        detectedLanguage: "English",
      };

      if (!ai) {
        return res.status(200).json(fallback);
      }

      try {
        const prompt = `A customer searched: """${input}""". Extract search category, keywords, maxDistanceKm, isBarter, requiresApprentice, summary.`;
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                category: { type: Type.STRING },
                keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
                maxDistanceKm: { type: Type.NUMBER },
                isBarter: { type: Type.BOOLEAN },
                requiresApprentice: { type: Type.BOOLEAN },
                summary: { type: Type.STRING },
                detectedLanguage: { type: Type.STRING },
                translatedEnglishQuery: { type: Type.STRING },
              },
              required: ["category", "keywords", "summary"],
            },
          },
        });

        return res.status(200).json(JSON.parse(response.text || "{}"));
      } catch (_) {
        return res.status(200).json(fallback);
      }
    }

    // 4. Translate Message
    if (url.includes("/api/gemini/translate-message")) {
      const { text, targetLanguage, sourceLanguage } = req.body || {};
      if (!text || !targetLanguage) return res.status(400).json({ error: "Missing parameters" });

      const fallback = {
        originalText: text,
        translatedText: text,
        detectedLanguage: sourceLanguage || "Original",
        targetLanguage,
      };

      if (!ai) {
        return res.status(200).json(fallback);
      }

      try {
        const prompt = `Translate this message for neighborhood marketplace chat:
Text: """${text}"""
Target Language: ${targetLanguage}`;

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                originalText: { type: Type.STRING },
                translatedText: { type: Type.STRING },
                detectedLanguage: { type: Type.STRING },
                targetLanguage: { type: Type.STRING },
              },
              required: ["originalText", "translatedText", "detectedLanguage"],
            },
          },
        });

        return res.status(200).json(JSON.parse(response.text || "{}"));
      } catch (_) {
        return res.status(200).json(fallback);
      }
    }

    // 5. Detect Language
    if (url.includes("/api/gemini/detect-language")) {
      const { text } = req.body || {};
      const local = fallbackDetectLanguage(text || "");
      if (!text) return res.status(200).json(local);

      if (!ai) {
        return res.status(200).json(local);
      }

      try {
        const prompt = `Identify the language of: """${text}""". Return detectedLanguage, languageCode (e.g. en-IN, ta-IN, hi-IN, te-IN, kn-IN, ml-IN), and nativeName.`;
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                detectedLanguage: { type: Type.STRING },
                languageCode: { type: Type.STRING },
                nativeName: { type: Type.STRING },
              },
              required: ["detectedLanguage", "languageCode", "nativeName"],
            },
          },
        });

        return res.status(200).json(JSON.parse(response.text || "{}"));
      } catch (_) {
        return res.status(200).json(local);
      }
    }

    // 6. Transliterate to Native
    if (url.includes("/api/gemini/transliterate-to-native")) {
      const { text, targetLanguage } = req.body || {};
      if (!text) return res.status(400).json({ error: "Missing text" });

      if (!ai) {
        return res.status(200).json({ nativeText: text, language: targetLanguage || "Tamil", englishMeaning: text });
      }

      try {
        const prompt = `Convert phonetic Romanized speech to native script: """${text}""". Target: ${targetLanguage || "Tamil"}. Return nativeText, language, englishMeaning.`;
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
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

        return res.status(200).json(JSON.parse(response.text || "{}"));
      } catch (_) {
        return res.status(200).json({ nativeText: text, language: targetLanguage || "Tamil", englishMeaning: text });
      }
    }

    return res.status(404).json({ error: "API route not found" });
  } catch (err: any) {
    console.error("Vercel Serverless Error:", err);
    return res.status(500).json({ error: err.message || "Internal Server Error" });
  }
}
