import React, { useState, useRef } from "react";
import { Play, Pause, Volume2, Sparkles } from "lucide-react";
import { speakText } from "../services/audioService";
import { VoiceNote } from "../types";

interface AudioPlayerButtonProps {
  voiceNote?: VoiceNote;
  fallbackText?: string;
  language?: string;
  label?: string;
  size?: "sm" | "md" | "lg";
}

export const AudioPlayerButton: React.FC<AudioPlayerButtonProps> = ({
  voiceNote,
  fallbackText,
  language = "English",
  label = "Hear Heritage Voice",
  size = "md",
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handlePlayToggle = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (voiceNote?.audioUrl) {
      if (!audioRef.current) {
        audioRef.current = new Audio(voiceNote.audioUrl);
        audioRef.current.onended = () => setIsPlaying(false);
      }

      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
    } else if (fallbackText) {
      if (isPlaying) {
        window.speechSynthesis?.cancel();
        setIsPlaying(false);
      } else {
        speakText(fallbackText, language);
        setIsPlaying(true);
        // Reset state after reasonable speech time estimate
        const estimatedSeconds = Math.max(3, fallbackText.split(" ").length * 0.4);
        setTimeout(() => setIsPlaying(false), estimatedSeconds * 1000);
      }
    }
  };

  const isSmall = size === "sm";

  return (
    <button
      type="button"
      onClick={handlePlayToggle}
      className={`inline-flex items-center space-x-2 rounded-full font-bold transition-all shadow-md cursor-pointer border ${
        isPlaying
          ? "bg-amber-500 text-slate-950 border-amber-300 animate-pulse"
          : "bg-slate-900/90 text-amber-300 hover:bg-slate-800 border-amber-500/40 hover:border-amber-400"
      } ${isSmall ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"}`}
    >
      <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400">
        {isPlaying ? (
          <Pause className={isSmall ? "w-3.5 h-3.5" : "w-4 h-4"} />
        ) : (
          <Play className={isSmall ? "w-3.5 h-3.5" : "w-4 h-4"} />
        )}
      </div>
      <span>{isPlaying ? "Playing..." : label}</span>
      {voiceNote?.durationSeconds && (
        <span className="text-[11px] opacity-75 font-mono">
          {voiceNote.durationSeconds}s
        </span>
      )}
    </button>
  );
};
