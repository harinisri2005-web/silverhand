import React from "react";
import { Play, X, Clock, Award, ShieldCheck, User, Sparkles, MapPin } from "lucide-react";
import { Listing, VideoDemo } from "../types";

interface VideoPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  listing: Listing;
}

export const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({
  isOpen,
  onClose,
  listing,
}) => {
  if (!isOpen) return null;

  const videoDemo = listing.videoDemo;
  const videoUrl = listing.videoUrl || videoDemo?.videoUrl;

  return (
    <div
      id="video-player-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto"
    >
      <div className="relative w-full max-w-3xl bg-slate-900 border-2 border-amber-500/50 rounded-3xl shadow-2xl overflow-hidden text-amber-50 my-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-slate-900 px-6 py-4 border-b border-amber-500/30 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-amber-500/20 border border-amber-400/40 rounded-xl">
              <Play className="w-5 h-5 text-amber-400 fill-amber-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-bold uppercase tracking-wider">
                  Master Craft Video
                </span>
                {videoDemo?.durationSeconds && (
                  <span className="text-xs text-amber-300/80 font-mono">
                    {videoDemo.durationSeconds}s Demonstration
                  </span>
                )}
              </div>
              <h2 className="text-lg font-bold font-serif text-amber-100 mt-0.5 line-clamp-1">
                {videoDemo?.title || listing.titleEnglish || listing.title}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Player Box */}
        <div className="relative bg-black aspect-video w-full flex items-center justify-center">
          {videoUrl ? (
            <video
              src={videoUrl}
              controls
              autoPlay
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="p-8 text-center text-slate-400 space-y-2">
              <p>No video attached to this listing yet.</p>
            </div>
          )}
        </div>

        {/* Video & Artisan Details Footer */}
        <div className="p-6 bg-slate-950 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div className="flex items-center space-x-3">
              <img
                src={listing.providerAvatar || listing.imageUrl}
                alt={listing.providerName}
                className="w-12 h-12 rounded-full object-cover border-2 border-amber-400 shadow-md"
                referrerPolicy="no-referrer"
              />
              <div>
                <h4 className="text-base font-bold text-amber-100 font-serif">
                  {listing.providerName}
                </h4>
                <div className="text-xs text-slate-400 flex items-center space-x-1 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-amber-400" />
                  <span>{listing.location.neighborhood}, {listing.location.city}</span>
                  <span>• Native: {listing.providerLanguage || "Multilingual"}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <span className="px-3 py-1 bg-amber-950/60 border border-amber-500/40 text-amber-300 text-xs font-bold rounded-xl flex items-center space-x-1.5">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <span>Verified Senior Artisan</span>
              </span>
            </div>
          </div>

          {videoDemo?.description && (
            <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800 text-xs text-slate-300 leading-relaxed">
              <span className="font-bold text-amber-300 block mb-1">Demonstration Notes:</span>
              {videoDemo.description}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
