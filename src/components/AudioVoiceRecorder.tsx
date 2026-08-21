import React, { useState, useRef, useEffect } from "react";
import { Mic, Square, Play, RotateCcw, Volume2, Check, AlertCircle, Globe, Sparkles, Loader2 } from "lucide-react";
import {
  AudioRecorder,
  speakText,
  SUPPORTED_SPEECH_LANGUAGES,
  getLanguageCode,
  detectLanguageFromText,
  transliteratedDevanagariToEnglish,
} from "../services/audioService";
import { detectLanguageWithAI, transcribeAudioWithAI } from "../services/geminiService";
import { VoiceNote } from "../types";

interface AudioVoiceRecorderProps {
  onVoiceNoteRecorded: (voiceNote: VoiceNote) => void;
  onTranscriptCaptured?: (transcript: string) => void;
  onLanguageAutoDetected?: (languageCode: string, languageName: string) => void;
  title?: string;
  subtitle?: string;
  defaultLanguage?: string;
}

export const AudioVoiceRecorder: React.FC<AudioVoiceRecorderProps> = ({
  onVoiceNoteRecorded,
  onTranscriptCaptured,
  onLanguageAutoDetected,
  title = "Record 30-Second Heritage Voice Story",
  subtitle = "Speak in your native language about how you make this or how it was passed down",
  defaultLanguage = "auto",
}) => {
  const [selectedLanguage, setSelectedLanguage] = useState<string>(
    defaultLanguage === "auto" ? "auto" : getLanguageCode(defaultLanguage)
  );
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribingWithAI, setIsTranscribingWithAI] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasPermissionError, setHasPermissionError] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [autoDetectedNotice, setAutoDetectedNotice] = useState<string | null>(null);

  const recorderRef = useRef<AudioRecorder>(new AudioRecorder());
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const liveTranscriptRef = useRef<string>("");
  const detectionDebounceRef = useRef<any>(null);

  useEffect(() => {
    if (defaultLanguage) {
      setSelectedLanguage(defaultLanguage === "auto" ? "auto" : getLanguageCode(defaultLanguage));
    }
  }, [defaultLanguage]);

  useEffect(() => {
    return () => {
      recorderRef.current.cancelRecording();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (_) {}
      }
      if (detectionDebounceRef.current) {
        clearTimeout(detectionDebounceRef.current);
      }
    };
  }, []);

  // Handler to auto-switch language when Tamil, Hindi, English, etc. is detected
  const handleAutoSwitchLanguage = (langCode: string, langName: string, nativeName: string) => {
    setSelectedLanguage(langCode);
    setAutoDetectedNotice(`✨ Automatically switched to ${langName} (${nativeName})`);
    
    // Dynamically update speech recognition engine language if active
    if (recognitionRef.current && recognitionRef.current.lang !== langCode) {
      try {
        recognitionRef.current.lang = langCode;
      } catch (_) {}
    }

    if (onLanguageAutoDetected) {
      onLanguageAutoDetected(langCode, langName);
    }
  };

  const startRecording = async () => {
    // 1. Fully teardown any lingering session
    recorderRef.current.cancelRecording();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (_) {}
      recognitionRef.current = null;
    }

    setAudioUrl(null);
    setSeconds(0);
    setLiveTranscript("");
    liveTranscriptRef.current = "";
    setAutoDetectedNotice(null);
    setHasPermissionError(false);
    setIsTranscribingWithAI(false);

    // 2. Start web speech recognition with language support for real-time live captions
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = getLanguageCode(selectedLanguage);
        
        recognition.onresult = (event: any) => {
          let full = "";
          for (let i = 0; i < event.results.length; i++) {
            full += event.results[i][0].transcript + " ";
          }
          const cleaned = full.trim();

          // Check if Devanagari or Tamil speech is actually English words transliterated by browser
          const transliteratedEnglish = transliteratedDevanagariToEnglish(cleaned);
          const effectiveText = transliteratedEnglish || cleaned;

          setLiveTranscript(effectiveText);
          liveTranscriptRef.current = effectiveText;
          if (onTranscriptCaptured) onTranscriptCaptured(effectiveText);

          // Fast, zero-latency local language detection
          if (effectiveText.length >= 2) {
            const detected = detectLanguageFromText(effectiveText);
            if (detected) {
              handleAutoSwitchLanguage(detected.code, detected.name, detected.nativeName);
            }
          }
        };

        recognition.onerror = (e: any) => {
          console.warn("Speech recognition notice:", e);
        };

        recognition.start();
        recognitionRef.current = recognition;
      } catch (e) {
        console.warn("Speech recognition skipped", e);
      }
    }

    // 3. Start MediaRecorder for high-fidelity audio capture
    const success = await recorderRef.current.startRecording(
      (sec) => setSeconds(sec),
      async (url, blob, duration) => {
        setIsRecording(false);
        setAudioUrl(url);

        let finalTranscript = liveTranscriptRef.current;

        // Multi-tier Auto-Detection:
        // 1. If we have audio bytes, transcribe with Multimodal AI with "auto-detect" to eliminate browser-language bias
        if (blob && blob.size > 1500) {
          setIsTranscribingWithAI(true);
          try {
            const aiRes = await transcribeAudioWithAI(blob, "auto-detect");
            const isValidAiTranscript =
              aiRes &&
              aiRes.transcript &&
              aiRes.transcript.trim().length > 0 &&
              !aiRes.transcript.toLowerCase().includes("voice recording captured") &&
              !aiRes.transcript.toLowerCase().startsWith("voice recording");

            if (isValidAiTranscript) {
              finalTranscript = aiRes.transcript.trim();
              setLiveTranscript(finalTranscript);
              liveTranscriptRef.current = finalTranscript;
              if (onTranscriptCaptured) onTranscriptCaptured(finalTranscript);
              if (aiRes.languageCode && aiRes.detectedLanguage) {
                handleAutoSwitchLanguage(
                  aiRes.languageCode,
                  aiRes.detectedLanguage,
                  aiRes.nativeName || aiRes.detectedLanguage
                );
              }
            } else if (finalTranscript && finalTranscript.trim()) {
              // We have speech captured by local browser recognition - preserve it!
              setLiveTranscript(finalTranscript);
              if (onTranscriptCaptured) onTranscriptCaptured(finalTranscript);
              const detected = detectLanguageFromText(finalTranscript);
              if (detected) {
                handleAutoSwitchLanguage(detected.code, detected.name, detected.nativeName);
              }
            }
          } catch (err) {
            console.warn("AI audio transcription fallback notice:", err);
            if (finalTranscript && finalTranscript.trim()) {
              setLiveTranscript(finalTranscript);
              if (onTranscriptCaptured) onTranscriptCaptured(finalTranscript);
              const detected = detectLanguageFromText(finalTranscript);
              if (detected) {
                handleAutoSwitchLanguage(detected.code, detected.name, detected.nativeName);
              }
            }
          } finally {
            setIsTranscribingWithAI(false);
          }
        } else if (finalTranscript && finalTranscript.trim()) {
          // If no blob was captured, detect from live text
          setLiveTranscript(finalTranscript);
          if (onTranscriptCaptured) onTranscriptCaptured(finalTranscript);
          const detected = detectLanguageFromText(finalTranscript);
          if (detected) {
            handleAutoSwitchLanguage(detected.code, detected.name, detected.nativeName);
          }
        }

        const validTranscript =
          finalTranscript &&
          finalTranscript.trim() &&
          !finalTranscript.toLowerCase().includes("voice recording captured")
            ? finalTranscript.trim()
            : undefined;

        const newVoiceNote: VoiceNote = {
          audioUrl: url,
          durationSeconds: duration,
          recordedAt: new Date().toISOString(),
          transcript: validTranscript,
        };
        onVoiceNoteRecorded(newVoiceNote);
      }
    );

    if (success) {
      setIsRecording(true);
    } else {
      setHasPermissionError(true);
    }
  };

  const stopRecording = () => {
    recorderRef.current.stopRecording();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (_) {}
      recognitionRef.current = null;
    }
    setIsRecording(false);
  };

  const togglePlay = () => {
    if (!audioPlayerRef.current || !audioUrl) return;
    if (isPlaying) {
      audioPlayerRef.current.pause();
      setIsPlaying(false);
    } else {
      audioPlayerRef.current.play();
      setIsPlaying(true);
    }
  };

  const resetRecording = () => {
    recorderRef.current.cancelRecording();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (_) {}
      recognitionRef.current = null;
    }
    setAudioUrl(null);
    setSeconds(0);
    setLiveTranscript("");
    liveTranscriptRef.current = "";
    setAutoDetectedNotice(null);
    setIsPlaying(false);
    setIsRecording(false);
    setIsTranscribingWithAI(false);
  };

  const QUICK_LANGUAGES = [
    { code: "ta-IN", name: "Tamil", label: "தமிழ் (Tamil)" },
    { code: "hi-IN", name: "Hindi", label: "हिन्दी (Hindi)" },
    { code: "en-IN", name: "English", label: "English" },
    { code: "te-IN", name: "Telugu", label: "తెలుగు (Telugu)" },
    { code: "auto", name: "Auto-Detect", label: "✨ Auto-Detect" },
  ];

  return (
    <div className="bg-slate-900/90 border-2 border-amber-500/40 rounded-3xl p-6 text-amber-50 shadow-xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400 flex items-center justify-center text-amber-400 flex-shrink-0">
            <Volume2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-amber-100 font-serif">{title}</h3>
            <p className="text-xs text-amber-200/70">{subtitle}</p>
          </div>
        </div>

        {/* Spoken Language Selector with Auto-Switch */}
        <div className="flex items-center space-x-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 self-start sm:self-auto">
          <Globe className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <span className="text-[11px] text-slate-400 font-semibold">Language:</span>
          <select
            value={selectedLanguage}
            onChange={(e) => {
              const code = e.target.value;
              setSelectedLanguage(code);
              setAutoDetectedNotice(null);
              const matched = SUPPORTED_SPEECH_LANGUAGES.find((l) => l.code === code);
              if (matched && onLanguageAutoDetected) {
                onLanguageAutoDetected(code, matched.name);
              }
            }}
            disabled={isRecording}
            className="bg-transparent text-xs font-bold text-amber-300 outline-none cursor-pointer"
          >
            {SUPPORTED_SPEECH_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code} className="bg-slate-900 text-white">
                {lang.nativeName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 1-Tap Quick Language Selector Pills */}
      <div className="flex items-center gap-1.5 flex-wrap pt-1">
        <span className="text-[11px] font-semibold text-amber-200/80 mr-1">Speak in:</span>
        {QUICK_LANGUAGES.map((lang) => {
          const isSelected =
            selectedLanguage === lang.code ||
            (lang.code === "auto" && selectedLanguage === "auto");
          return (
            <button
              key={lang.code}
              type="button"
              onClick={() => {
                setSelectedLanguage(lang.code);
                setAutoDetectedNotice(null);
                if (onLanguageAutoDetected) {
                  onLanguageAutoDetected(lang.code, lang.name);
                }
              }}
              className={`text-xs px-3 py-1 rounded-lg font-medium transition-all cursor-pointer border ${
                isSelected
                  ? "bg-amber-500 text-slate-950 font-bold border-amber-400 shadow-sm"
                  : "bg-slate-800/80 hover:bg-slate-700 text-amber-200 border-slate-700"
              }`}
            >
              {lang.label}
            </button>
          );
        })}
      </div>

      {/* Auto-detected notification banner */}
      {autoDetectedNotice && (
        <div className="p-3 bg-amber-950/70 border border-amber-500/60 rounded-2xl text-amber-200 text-xs flex items-center space-x-2 animate-fadeIn">
          <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0 animate-pulse" />
          <span className="font-medium">{autoDetectedNotice}</span>
        </div>
      )}

      {hasPermissionError && (
        <div className="p-3 bg-red-950/60 border border-red-500/40 rounded-xl text-red-200 text-xs flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>Please allow microphone access in your browser to record your voice.</span>
        </div>
      )}

      {/* Visual Timer and Waveform */}
      <div className="bg-slate-950/80 rounded-2xl p-4 border border-slate-800 flex flex-col items-center justify-center space-y-3">
        <div className="flex items-center space-x-3">
          <div
            className={`w-3 h-3 rounded-full ${
              isRecording ? "bg-red-500 animate-ping" : audioUrl ? "bg-emerald-400" : "bg-slate-600"
            }`}
          />
          <span className="font-mono text-2xl font-bold tracking-wider text-amber-200">
            00:{seconds < 10 ? `0${seconds}` : seconds} / 00:30
          </span>
        </div>

        {/* Animated Bars */}
        <div className="flex items-center justify-center space-x-1.5 h-12 w-full max-w-xs px-4">
          {[40, 75, 55, 90, 60, 80, 45, 95, 65, 85, 50, 70, 95, 60, 40].map((height, i) => (
            <div
              key={i}
              className={`w-2 rounded-full transition-all duration-150 ${
                isRecording
                  ? "bg-amber-400 animate-pulse"
                  : audioUrl
                  ? "bg-amber-600"
                  : "bg-slate-800"
              }`}
              style={{
                height: isRecording ? `${Math.max(15, height * Math.random() + 20)}%` : "30%",
              }}
            />
          ))}
        </div>

        {/* Live speech preview if captured in native language */}
        {isTranscribingWithAI ? (
          <div className="text-xs text-amber-300 italic flex items-center justify-center space-x-2 bg-amber-950/60 p-2.5 rounded-xl border border-amber-500/40 animate-pulse">
            <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
            <span>✨ Gemini AI is accurately transcribing your voice in {selectedLanguage === 'auto' ? 'native language' : selectedLanguage}...</span>
          </div>
        ) : liveTranscript ? (
          <div className="text-xs text-amber-200 italic max-w-md text-center bg-slate-900/90 p-2.5 rounded-xl border border-amber-500/30">
            <span className="text-[10px] text-amber-400 uppercase tracking-wider block not-italic font-bold mb-0.5">
              Live Transcript:
            </span>
            "{liveTranscript}"
          </div>
        ) : isRecording ? (
          <div className="text-[11px] text-slate-400 italic">
            Listening in{" "}
            {SUPPORTED_SPEECH_LANGUAGES.find((l) => l.code === selectedLanguage)?.name || "selected language"}
            ... Speak freely in Tamil, Hindi, or any language!
          </div>
        ) : null}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center space-x-4 pt-1">
        {!isRecording && !audioUrl && (
          <button
            type="button"
            id="start-voice-record-btn"
            onClick={startRecording}
            className="flex items-center space-x-3 px-6 py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-lg shadow-lg shadow-amber-900/30 transition-all cursor-pointer"
          >
            <Mic className="w-6 h-6 animate-bounce" />
            <span>Tap to Speak & Record</span>
          </button>
        )}

        {isRecording && (
          <button
            type="button"
            id="stop-voice-record-btn"
            onClick={stopRecording}
            className="flex items-center space-x-3 px-6 py-3.5 rounded-2xl bg-red-500 hover:bg-red-600 text-white font-bold text-lg shadow-lg shadow-red-900/40 transition-all animate-pulse cursor-pointer"
          >
            <Square className="w-6 h-6" />
            <span>Stop & Finish ({30 - seconds}s left)</span>
          </button>
        )}

        {audioUrl && (
          <div className="flex items-center space-x-3">
            <audio
              ref={audioPlayerRef}
              src={audioUrl}
              onEnded={() => setIsPlaying(false)}
              className="hidden"
            />
            <button
              type="button"
              id="preview-voice-btn"
              onClick={togglePlay}
              className="flex items-center space-x-2 px-5 py-3 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-base shadow-md cursor-pointer"
            >
              {isPlaying ? <Square className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              <span>{isPlaying ? "Pause" : "Listen Back"}</span>
            </button>

            <button
              type="button"
              onClick={resetRecording}
              className="flex items-center space-x-1.5 px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-amber-200 font-semibold text-sm border border-slate-700 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Re-record</span>
            </button>

            <div className="flex items-center text-emerald-400 text-sm font-semibold pl-2">
              <Check className="w-5 h-5 mr-1" />
              <span>Attached</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
