import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import {
  SUPPORTED_LANGUAGES,
  LanguageMeta,
  getTranslation,
  LISTING_TRANSLATIONS,
} from "../services/translations";
import { Listing } from "../types";

interface LanguageContextType {
  language: string;
  setLanguage: (lang: string) => void;
  t: (key: string, fallback?: string) => string;
  currentLanguage: LanguageMeta;
  supportedLanguages: LanguageMeta[];
  translateListing: (listing: Listing) => {
    title: string;
    description: string;
    heritageNotes?: string;
    barterDetails?: string;
  };
  translateCategory: (categoryKey: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = "silverhands_preferred_language";

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return saved;
    } catch {
      // Fallback
    }
    return "en";
  });

  const currentLanguage = useMemo(() => {
    const norm = language.toLowerCase().split("-")[0];
    return (
      SUPPORTED_LANGUAGES.find((l) => l.code === norm) ||
      SUPPORTED_LANGUAGES[0]
    );
  }, [language]);

  const setLanguage = (newLang: string) => {
    const norm = newLang.toLowerCase().split("-")[0];
    setLanguageState(norm);
    try {
      localStorage.setItem(STORAGE_KEY, norm);
      document.documentElement.lang = norm;
      document.documentElement.dir = currentLanguage.dir || "ltr";
    } catch (e) {
      console.warn("Could not save language to localStorage", e);
    }
  };

  useEffect(() => {
    document.documentElement.lang = currentLanguage.code;
    document.documentElement.dir = currentLanguage.dir || "ltr";
  }, [currentLanguage]);

  const t = (key: string, fallback?: string): string => {
    return getTranslation(key, language, fallback);
  };

  const translateCategory = (catKey: string): string => {
    const map: Record<string, string> = {
      all: "cat_all",
      repairs_mending: "cat_repairs_mending",
      traditional_skills: "cat_traditional_skills",
      home_cooking: "cat_home_cooking",
      gardening_botanicals: "cat_gardening_botanicals",
      handmade_goods: "cat_handmade_goods",
      barter_request: "cat_barter_request",
    };
    const key = map[catKey];
    if (key) {
      return t(key);
    }
    return catKey;
  };

  const translateListing = (listing: Listing) => {
    const norm = language.toLowerCase().split("-")[0];
    
    // Check if we have pre-defined localized strings for seed listings
    if (LISTING_TRANSLATIONS[listing.id] && LISTING_TRANSLATIONS[listing.id][norm]) {
      const entry = LISTING_TRANSLATIONS[listing.id][norm];
      return {
        title: entry.title,
        description: entry.desc,
        heritageNotes: entry.heritage || listing.heritageNotes,
        barterDetails: entry.barter || listing.barterDetails,
      };
    }

    // If English is selected and English fields exist
    if (norm === "en") {
      return {
        title: listing.titleEnglish || listing.title,
        description: listing.descriptionEnglish || listing.description,
        heritageNotes: listing.heritageNotes,
        barterDetails: listing.barterDetails,
      };
    }

    // Default fallback
    return {
      title: listing.title,
      description: listing.description,
      heritageNotes: listing.heritageNotes,
      barterDetails: listing.barterDetails,
    };
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t,
        currentLanguage,
        supportedLanguages: SUPPORTED_LANGUAGES,
        translateListing,
        translateCategory,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};
