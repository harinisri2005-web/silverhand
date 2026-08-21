import React, { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  Volume2,
  MapPin,
  User as UserIcon,
  Layers,
  LogOut,
  RotateCcw,
  Store,
  Compass,
  ShieldCheck,
  MessageSquare,
  Globe,
  ChevronDown,
  Check,
} from "lucide-react";
import { User } from "../types";
import { useLanguage } from "../context/LanguageContext";

interface NavbarProps {
  currentUser: User | null;
  activePortal: "provider" | "customer";
  onSwitchPortal: (portal: "provider" | "customer") => void;
  onOpenAuth: () => void;
  onLogout: () => void;
  onResetData: () => void;
  largeTextMode?: boolean;
  onToggleLargeText?: () => void;
  onOpenMeetupModal?: () => void;
  eventsCount?: number;
  onOpenMessages?: () => void;
  unreadMessagesCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  activePortal,
  onSwitchPortal,
  onOpenAuth,
  onLogout,
  onResetData,
  largeTextMode,
  onToggleLargeText,
  onOpenMeetupModal,
  eventsCount = 0,
  onOpenMessages,
  unreadMessagesCount = 0,
}) => {
  const { language, setLanguage, t, supportedLanguages, currentLanguage } = useLanguage();
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);
  const langDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        langDropdownRef.current &&
        !langDropdownRef.current.contains(event.target as Node)
      ) {
        setIsLangDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-amber-900/40 text-amber-50 shadow-xl transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo and Brand */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => onSwitchPortal("customer")}>
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-700 flex items-center justify-center shadow-lg shadow-amber-950/50 border border-amber-300/40 transform hover:scale-105 transition-transform">
              <Sparkles className="w-7 h-7 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <span className="text-2xl font-black tracking-tight text-amber-50 font-serif">
                  {t("brand_name", "SilverHands")}
                </span>
                <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[11px] px-2.5 py-0.5 rounded-full font-bold flex items-center space-x-1.5 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                  <span>{t("nav_firebase_live", "Live Sync")}</span>
                </span>
              </div>
              <p className="text-xs text-amber-200/70 hidden sm:block font-medium">
                {t("brand_subtitle", "Bridging Senior Artisans & Neighborhood Buyers")}
              </p>
            </div>
          </div>

          {/* Portal Switcher (Big accessible pills) */}
          <div className="hidden md:flex items-center bg-slate-950/80 p-1.5 rounded-2xl border border-slate-800 shadow-inner">
            <button
              id="portal-customer-btn"
              onClick={() => onSwitchPortal("customer")}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                activePortal === "customer"
                  ? "bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-900/30 scale-100 font-extrabold"
                  : "text-slate-300 hover:text-white hover:bg-slate-800/80"
              }`}
            >
              <Compass className="w-4 h-4" />
              <span>{t("nav_neighbor_feed", "Neighbor Feed")}</span>
            </button>

            <button
              id="portal-provider-btn"
              onClick={() => onSwitchPortal("provider")}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                activePortal === "provider"
                  ? "bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-900/30 font-extrabold"
                  : "text-slate-300 hover:text-white hover:bg-slate-800/80"
              }`}
            >
              <Store className="w-4 h-4" />
              <span>{t("nav_artisan_portal", "Artisan Portal")}</span>
            </button>

            {onOpenMeetupModal && (
              <button
                id="portal-meetups-btn"
                onClick={onOpenMeetupModal}
                className="flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl text-sm font-bold text-amber-300 hover:text-white hover:bg-amber-500/20 transition-all cursor-pointer border border-amber-500/20 ml-1.5"
                title="Community Flea Markets, Meetups & Bazaars"
              >
                <span>🎪</span>
                <span>{t("nav_meetups_bazaars", "Meetups & Bazaars")}</span>
                {eventsCount > 0 && (
                  <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black flex items-center justify-center">
                    {eventsCount}
                  </span>
                )}
              </button>
            )}

            {onOpenMessages && (
              <button
                id="portal-messages-btn"
                onClick={onOpenMessages}
                className="flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl text-sm font-bold text-amber-300 hover:text-white hover:bg-amber-500/20 transition-all cursor-pointer border border-amber-500/20 ml-1.5"
                title="View Artisan & Client Messages"
              >
                <MessageSquare className="w-4 h-4 text-amber-400" />
                <span>
                  {currentUser?.role === "provider"
                    ? t("nav_client_inquiries", "Client Inquiries")
                    : t("nav_messages", "Messages")}
                </span>
                {unreadMessagesCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-black animate-bounce">
                    {unreadMessagesCount}
                  </span>
                )}
              </button>
            )}
          </div>

          {/* Language Selector + User Actions */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Global Language Selector Dropdown */}
            <div className="relative" ref={langDropdownRef}>
              <button
                id="global-language-selector-btn"
                onClick={() => setIsLangDropdownOpen(!isLangDropdownOpen)}
                className="flex items-center space-x-1.5 bg-slate-800/90 hover:bg-slate-700/90 text-amber-200 border border-amber-500/30 px-3 py-2 rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-all cursor-pointer hover:border-amber-400"
                title={t("nav_choose_language", "Choose Language")}
              >
                <Globe className="w-4 h-4 text-amber-400" />
                <span className="text-base leading-none">{currentLanguage.flag}</span>
                <span className="font-semibold">{currentLanguage.nativeName}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-amber-400/80 transition-transform ${isLangDropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {isLangDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 max-h-96 overflow-y-auto bg-slate-900 border border-amber-500/40 rounded-2xl shadow-2xl p-2 z-50 animate-fadeIn backdrop-blur-xl divide-y divide-slate-800">
                  <div className="px-3 py-2 text-xs font-bold text-amber-400 tracking-wider uppercase">
                    {t("nav_choose_language", "Select Website Language")}
                  </div>
                  <div className="py-1 space-y-0.5">
                    {supportedLanguages.map((lang) => {
                      const isSelected = language.toLowerCase() === lang.code.toLowerCase();
                      return (
                        <button
                          key={lang.code}
                          id={`lang-option-${lang.code}`}
                          onClick={() => {
                            setLanguage(lang.code);
                            setIsLangDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
                            isSelected
                              ? "bg-amber-500 text-slate-950 font-bold shadow"
                              : "text-slate-200 hover:bg-slate-800 hover:text-amber-200"
                          }`}
                        >
                          <div className="flex items-center space-x-2.5">
                            <span className="text-lg">{lang.flag}</span>
                            <div>
                              <div className="font-bold">{lang.nativeName}</div>
                              <div className={`text-[10px] ${isSelected ? "text-slate-900" : "text-slate-400"}`}>
                                {lang.name}
                              </div>
                            </div>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-slate-950 font-black" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* User Profile / Auth */}
            {currentUser ? (
              <div className="flex items-center space-x-2 bg-slate-800/90 pl-2.5 pr-1.5 py-1.5 rounded-2xl border border-slate-700 shadow-sm">
                <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-amber-400/60 bg-amber-700 flex items-center justify-center text-xs font-bold text-white shadow-inner">
                  {currentUser.avatarUrl ? (
                    <img
                      src={currentUser.avatarUrl}
                      alt={currentUser.fullName}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span>{currentUser.fullName.charAt(0)}</span>
                  )}
                </div>
                <div className="hidden xl:block text-left pr-2">
                  <div className="text-xs font-bold text-amber-100 leading-tight">
                    {currentUser.fullName}
                  </div>
                  <div className="text-[10px] text-amber-300/80 font-medium">
                    {currentUser.role === "provider"
                      ? t("nav_senior_artisan", "Senior Artisan")
                      : t("nav_neighbor_buyer", "Neighbor Buyer")}
                  </div>
                </div>
                <button
                  id="auth-logout-btn"
                  onClick={onLogout}
                  title={t("nav_logout", "Log Out")}
                  className="p-2 text-slate-400 hover:text-amber-300 rounded-xl hover:bg-slate-700/80 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                id="auth-login-btn"
                onClick={onOpenAuth}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs sm:text-sm shadow-md shadow-amber-900/30 transition-all cursor-pointer transform hover:scale-102"
              >
                {t("nav_sign_in", "Sign In")}
              </button>
            )}
          </div>
        </div>

        {/* Mobile Portal Navigation Bar */}
        <div className="md:hidden flex items-center justify-around py-2.5 border-t border-slate-800 text-xs font-bold gap-1">
          <button
            onClick={() => onSwitchPortal("customer")}
            className={`flex-1 py-1.5 px-2 rounded-lg text-center ${
              activePortal === "customer" ? "bg-amber-500 text-slate-950 font-black" : "text-slate-300"
            }`}
          >
            {t("nav_neighbor_feed", "Feed")}
          </button>
          <button
            onClick={() => onSwitchPortal("provider")}
            className={`flex-1 py-1.5 px-2 rounded-lg text-center ${
              activePortal === "provider" ? "bg-amber-500 text-slate-950 font-black" : "text-slate-300"
            }`}
          >
            {t("nav_artisan_portal", "Artisan")}
          </button>
          {onOpenMeetupModal && (
            <button
              onClick={onOpenMeetupModal}
              className="flex-1 py-1.5 px-2 rounded-lg text-center text-amber-300 border border-amber-500/20"
            >
              🎪 {t("nav_meetups_bazaars", "Bazaars")}
            </button>
          )}
          {onOpenMessages && (
            <button
              onClick={onOpenMessages}
              className="flex-1 py-1.5 px-2 rounded-lg text-center text-amber-300 border border-amber-500/20 relative"
            >
              💬 {t("nav_messages", "Chat")}
              {unreadMessagesCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 bg-emerald-500 text-slate-950 rounded-full text-[9px] font-black">
                  {unreadMessagesCount}
                </span>
              )}
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
