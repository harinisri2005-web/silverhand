import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Send,
  Mic,
  Volume2,
  Languages,
  Sparkles,
  Phone,
  CheckCheck,
  Loader2,
  Globe,
  CornerDownRight,
  Square,
  Play,
  RotateCcw,
} from "lucide-react";
import { ChatMessage, Listing, User, VoiceNote } from "../types";
import { translateMessage } from "../services/geminiService";
import { AudioRecorder, speakText } from "../services/audioService";
import { AudioVoiceRecorder } from "./AudioVoiceRecorder";
import { AudioPlayerButton } from "./AudioPlayerButton";
import { getStoredMessages, saveMessage } from "../services/storageService";

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  targetUser: User | { id: string; fullName: string; preferredLanguage: string; avatarUrl?: string };
  listing?: Listing | null;
  initialVoiceMode?: boolean;
}

export const ChatModal: React.FC<ChatModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  targetUser,
  listing,
  initialVoiceMode = false,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isTranslating, setIsTranslating] = useState(false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(initialVoiceMode);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const conversationId = `conv_${[currentUser.id, targetUser.id].sort().join("_")}`;

  useEffect(() => {
    if (isOpen) {
      loadMessages();
      setShowVoiceRecorder(initialVoiceMode);
    }
  }, [isOpen, conversationId, initialVoiceMode]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadMessages = () => {
    const stored = getStoredMessages(conversationId);
    if (stored.length === 0) {
      // Seed friendly welcoming starter message if starting a fresh chat
      const initialMessage: ChatMessage = {
        id: `msg_init_${Date.now()}`,
        conversationId,
        senderId: targetUser.id,
        senderName: targetUser.fullName,
        senderRole: "provider",
        originalText:
          targetUser.preferredLanguage === "Hindi"
            ? "नमस्ते! आप मेरी हस्तकला या सेवा के बारे में कुछ भी पूछ सकते हैं।"
            : targetUser.preferredLanguage === "Tamil"
            ? "வணக்கம்! எனது பாரம்பரிய கைவினைப் பொருட்கள் பற்றி நீங்கள் கேட்கலாம்."
            : "Hello neighbor! Feel free to ask about my handcrafted items or service.",
        translatedText:
          "Namaste & Hello! Feel free to ask me anything about my traditional craft, mending, or barter requests.",
        sourceLanguage: targetUser.preferredLanguage || "Hindi",
        targetLanguage: currentUser.preferredLanguage || "English",
        timestamp: new Date().toISOString(),
        isRead: true,
      };
      setMessages([initialMessage]);
    } else {
      setMessages(stored);
    }
  };

  const handleSendMessage = async (voiceNotePayload?: VoiceNote) => {
    const textToSend = inputText.trim();
    if (!textToSend && !voiceNotePayload) return;

    setIsTranslating(true);
    setInputText("");

    const sourceLanguage = currentUser.preferredLanguage || "English";
    const targetLanguage = targetUser.preferredLanguage || "English";

    let translated = textToSend;

    // Call Gemini AI translation if languages differ
    if (sourceLanguage !== targetLanguage && textToSend) {
      try {
        const transResult = await translateMessage(textToSend, targetLanguage, sourceLanguage);
        translated = transResult.translatedText;
      } catch (err) {
        console.error("Chat translation error:", err);
      }
    }

    const newMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      conversationId,
      senderId: currentUser.id,
      senderName: currentUser.fullName,
      senderRole: currentUser.role,
      originalText: textToSend || (voiceNotePayload ? "🎙️ Sent a 30s Voice Note" : ""),
      translatedText:
        sourceLanguage !== targetLanguage && textToSend ? translated : undefined,
      sourceLanguage,
      targetLanguage,
      voiceNote: voiceNotePayload,
      timestamp: new Date().toISOString(),
      isRead: false,
    };

    saveMessage(newMessage);
    setMessages((prev) => [...prev, newMessage]);
    setIsTranslating(false);
    setShowVoiceRecorder(false);

    // If simulating conversation, senior provider replies automatically after 2s
    if (currentUser.role === "customer" && targetUser.id.startsWith("user_")) {
      setTimeout(async () => {
        const replySourceLang = targetUser.preferredLanguage || "Hindi";
        const replyNative =
          replySourceLang === "Hindi"
            ? "बहुत बढ़िया! मैं आपके कपड़े की मरम्मत बहुत प्यार से कर दूँगी। आप कब आ रहे हैं?"
            : replySourceLang === "Tamil"
            ? "நிச்சயமாக! உங்கள் பொருளை சிறந்த முறையில் சரிசெய்து தருகிறேன்."
            : "Thank you for reaching out! I'd be happy to help restore this for you.";

        let replyTrans = replyNative;
        try {
          const autoTrans = await translateMessage(replyNative, currentUser.preferredLanguage, replySourceLang);
          replyTrans = autoTrans.translatedText;
        } catch (_) {}

        const autoReply: ChatMessage = {
          id: `msg_reply_${Date.now()}`,
          conversationId,
          senderId: targetUser.id,
          senderName: targetUser.fullName,
          senderRole: "provider",
          originalText: replyNative,
          translatedText: replyTrans,
          sourceLanguage: replySourceLang,
          targetLanguage: currentUser.preferredLanguage,
          timestamp: new Date().toISOString(),
          isRead: true,
        };

        saveMessage(autoReply);
        setMessages((prev) => [...prev, autoReply]);
      }, 1500);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border-2 border-amber-500/40 rounded-3xl w-full max-w-2xl h-[90vh] max-h-[720px] flex flex-col shadow-2xl text-amber-50 overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-amber-950/90 via-slate-900 to-slate-900 border-b border-amber-900/40 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <img
                src={targetUser.avatarUrl || "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80"}
                alt={targetUser.fullName}
                className="w-12 h-12 rounded-full object-cover border-2 border-amber-400"
                referrerPolicy="no-referrer"
              />
              <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-slate-900" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-bold text-amber-100 font-serif">
                  {targetUser.fullName}
                </h3>
                <span className="text-[11px] bg-amber-500/20 text-amber-300 border border-amber-400/40 px-2 py-0.5 rounded-full font-mono">
                  {targetUser.preferredLanguage}
                </span>
              </div>
              <div className="text-xs text-amber-200/80 flex items-center space-x-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Live Gemini AI Two-Way Multilingual Translation</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Listing Context Banner if initiated from a specific listing */}
        {listing && (
          <div className="bg-slate-950/90 border-b border-slate-800 p-2.5 px-4 flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2 truncate">
              <span className="text-amber-400 font-bold">Regarding:</span>
              <span className="text-slate-200 truncate font-medium">
                {listing.titleEnglish || listing.title}
              </span>
            </div>
            <span className="text-amber-300 font-bold font-mono pl-2">
              ₹{listing.price.toLocaleString("en-IN")}
            </span>
          </div>
        )}

        {/* Messages Stream */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 bg-[#0A0F1D]/80">
          {messages.map((msg) => {
            const isMe = msg.senderId === currentUser.id;

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-3xl p-4 shadow-lg space-y-2.5 ${
                    isMe
                      ? "bg-gradient-to-br from-amber-600 to-amber-700 text-slate-950 font-medium"
                      : "bg-slate-800 border border-slate-700 text-amber-50"
                  }`}
                >
                  {/* Sender Name */}
                  <div className="text-[11px] font-bold opacity-80 flex items-center justify-between">
                    <span>{isMe ? "You" : msg.senderName}</span>
                    <span className="font-mono text-[10px]">
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  {/* Voice Note Attachment */}
                  {msg.voiceNote && (
                    <div className="pt-1">
                      <AudioPlayerButton
                        voiceNote={msg.voiceNote}
                        fallbackText={msg.originalText}
                        language={msg.sourceLanguage}
                        size="md"
                        label="Play Voice Message"
                      />
                    </div>
                  )}

                  {/* Original Text */}
                  {msg.originalText && (
                    <p className={`text-base leading-relaxed ${isMe ? "text-slate-950 font-semibold" : "text-amber-100"}`}>
                      {msg.originalText}
                    </p>
                  )}

                  {/* Gemini AI Translated Text Block */}
                  {msg.translatedText && msg.translatedText !== msg.originalText && (
                    <div
                      className={`p-2.5 rounded-2xl text-xs space-y-1 ${
                        isMe
                          ? "bg-amber-800/30 border border-amber-900/40 text-slate-950"
                          : "bg-amber-950/40 border border-amber-500/30 text-amber-200"
                      }`}
                    >
                      <div className="flex items-center space-x-1.5 font-bold text-[10px] uppercase tracking-wider text-amber-400">
                        <Sparkles className="w-3 h-3" />
                        <span>Translated to {msg.targetLanguage}</span>
                      </div>
                      <p className="text-sm font-normal italic">
                        "{msg.translatedText}"
                      </p>
                    </div>
                  )}

                  {/* Text-to-Speech Button for Accessibility */}
                  <div className="pt-1 flex items-center justify-end space-x-2">
                    <button
                      onClick={() =>
                        speakText(
                          msg.translatedText || msg.originalText,
                          msg.targetLanguage || msg.sourceLanguage
                        )
                      }
                      title="Read aloud in native voice"
                      className={`p-1.5 rounded-full hover:bg-black/20 text-xs flex items-center space-x-1 ${
                        isMe ? "text-slate-900" : "text-amber-300"
                      }`}
                    >
                      <Volume2 className="w-4 h-4" />
                      <span className="text-[10px] font-bold">Listen</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* 30s Voice Note Recorder Drawer inside chat */}
        {showVoiceRecorder && (
          <div className="p-4 bg-slate-950 border-t border-amber-500/40 animate-slideUp">
            <AudioVoiceRecorder
              title="Record Voice Message"
              subtitle={`Your voice note will be sent directly to ${targetUser.fullName}`}
              onVoiceNoteRecorded={(note) => {
                handleSendMessage(note);
              }}
            />
          </div>
        )}

        {/* Chat Composer Bar */}
        <div className="p-4 bg-slate-900 border-t border-slate-800">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center space-x-3"
          >
            <button
              type="button"
              onClick={() => setShowVoiceRecorder(!showVoiceRecorder)}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                showVoiceRecorder
                  ? "bg-red-500 text-white border-red-400 shadow-md"
                  : "bg-slate-800 text-amber-400 border-slate-700 hover:bg-slate-700"
              }`}
              title="Send 30s Heritage Voice Note"
            >
              <Mic className="w-6 h-6" />
            </button>

            <div className="relative flex-1">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={`Type in ${currentUser.preferredLanguage}... (AI will translate to ${targetUser.preferredLanguage})`}
                className="w-full pl-4 pr-10 py-3.5 bg-slate-800 border-2 border-slate-700 focus:border-amber-500 rounded-2xl text-base text-white placeholder-slate-400 outline-none transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={isTranslating || !inputText.trim()}
              className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold shadow-lg shadow-amber-900/30 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isTranslating ? (
                <Loader2 className="w-6 h-6 animate-spin text-slate-950" />
              ) : (
                <Send className="w-6 h-6" />
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
