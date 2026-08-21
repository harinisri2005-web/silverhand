import React, { useState, useRef, useEffect } from "react";
import {
  Video,
  Play,
  Square,
  RefreshCw,
  Check,
  X,
  Upload,
  Film,
  Sparkles,
  Camera,
  AlertCircle,
  Clock,
  HelpCircle,
  FileVideo,
  CheckCircle,
  Loader2,
  HardDrive,
} from "lucide-react";
import { VideoDemo } from "../types";
import { CRAFT_VIDEO_PRESETS, CraftVideoPreset } from "../services/storageService";
import { processLocalVideoFile, ProcessedVideoResult } from "../utils/videoUtils";

interface VideoRecorderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveVideo: (videoDemo: VideoDemo) => void;
  currentVideoDemo?: VideoDemo | null;
  serviceTitle: string;
  serviceCategory: string;
  elderName: string;
  initialTab?: "preset" | "camera" | "upload";
}

export const VideoRecorderModal: React.FC<VideoRecorderModalProps> = ({
  isOpen,
  onClose,
  onSaveVideo,
  currentVideoDemo,
  serviceTitle,
  serviceCategory,
  elderName,
  initialTab = "upload",
}) => {
  const [activeTab, setActiveTab] = useState<"preset" | "camera" | "upload">(initialTab);
  const [selectedPreset, setSelectedPreset] = useState<CraftVideoPreset | null>(null);

  // Camera Recording States
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);

  // Local Upload & Custom Video state
  const [customVideoUrl, setCustomVideoUrl] = useState("");
  const [customThumbnailUrl, setCustomThumbnailUrl] = useState("");
  const [customDuration, setCustomDuration] = useState<number>(35);
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [uploadedFileSize, setUploadedFileSize] = useState("");
  const [isProcessingVideo, setIsProcessingVideo] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [videoTitle, setVideoTitle] = useState("");
  const [videoDescription, setVideoDescription] = useState("");

  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Initialize preset matching service category or fallback
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      const match = CRAFT_VIDEO_PRESETS.find((p) => p.category === serviceCategory) || CRAFT_VIDEO_PRESETS[0];
      setSelectedPreset(match);
      setVideoTitle(currentVideoDemo?.title || `${elderName}'s Craft Demonstration`);
      setVideoDescription(currentVideoDemo?.description || `Master demonstration for ${serviceTitle || "artisan service"}`);
      if (currentVideoDemo?.videoUrl) {
        setCustomVideoUrl(currentVideoDemo.videoUrl);
        setCustomThumbnailUrl(currentVideoDemo.thumbnailUrl || "");
        setCustomDuration(currentVideoDemo.durationSeconds || 35);
      }
    }
  }, [isOpen, initialTab, serviceCategory, serviceTitle, elderName, currentVideoDemo]);

  // Clean up camera stream
  const stopCameraStream = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setIsCameraActive(false);
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    if (!isOpen) {
      stopCameraStream();
    }
    return () => {
      stopCameraStream();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Start Camera Feed
  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: true,
      });
      mediaStreamRef.current = stream;
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.play();
      }
      setIsCameraActive(true);
    } catch (err: any) {
      console.warn("Webcam access warning:", err);
      setCameraError(
        "Camera permission was not granted or webcam is unavailable in this environment. You can upload a video file from your device or select an authentic craft demo."
      );
    }
  };

  // Start Recording
  const startRecording = () => {
    if (!mediaStreamRef.current) return;
    chunksRef.current = [];
    try {
      const recorder = new MediaRecorder(mediaStreamRef.current);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        const videoUrl = URL.createObjectURL(blob);
        setRecordedVideoUrl(videoUrl);
      };

      recorder.start(500);
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((t) => t + 1);
      }, 1000);
    } catch (err) {
      console.error("Recording error:", err);
      setCameraError("Could not start recording with current browser codec.");
    }
  };

  // Stop Recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  // Retake Recording
  const handleRetake = () => {
    setRecordedVideoUrl(null);
    setRecordingTime(0);
    startCamera();
  };

  // Process Local Video File (from picker or drag-and-drop)
  const handleProcessFile = async (file: File) => {
    if (!file || !file.type.startsWith("video/")) {
      return;
    }

    setIsProcessingVideo(true);
    try {
      const processed: ProcessedVideoResult = await processLocalVideoFile(file);
      setCustomVideoUrl(processed.videoUrl);
      setCustomThumbnailUrl(processed.thumbnailUrl);
      setCustomDuration(processed.durationSeconds);
      setUploadedFileName(file.name);
      setUploadedFileSize(`${processed.fileSizeMb} MB`);

      if (!videoTitle || videoTitle === `${elderName}'s Craft Demonstration`) {
        setVideoTitle(`${elderName}'s ${processed.fileName} Demonstration`);
      }
    } catch (err) {
      console.error("Local video processing error:", err);
      const url = URL.createObjectURL(file);
      setCustomVideoUrl(url);
      setUploadedFileName(file.name);
    } finally {
      setIsProcessingVideo(false);
    }
  };

  // Handle local video file input change
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleProcessFile(file);
    }
  };

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("video/")) {
      handleProcessFile(file);
    }
  };

  // Save Video Demo
  const handleConfirmAndSave = () => {
    let finalUrl = "";
    let finalThumb = "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=800&q=80";
    let finalDuration = 35;

    if (activeTab === "upload" && customVideoUrl) {
      finalUrl = customVideoUrl;
      finalThumb = customThumbnailUrl || "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=800&q=80";
      finalDuration = customDuration || 35;
    } else if (activeTab === "camera" && recordedVideoUrl) {
      finalUrl = recordedVideoUrl;
      finalThumb = "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=800&q=80";
      finalDuration = recordingTime || 30;
    } else if (activeTab === "preset" && selectedPreset) {
      finalUrl = selectedPreset.videoUrl;
      finalThumb = selectedPreset.thumbnailUrl;
      finalDuration = selectedPreset.durationSeconds;
    } else if (customVideoUrl) {
      finalUrl = customVideoUrl;
      finalThumb = customThumbnailUrl || "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=800&q=80";
      finalDuration = customDuration || 35;
    } else if (selectedPreset) {
      finalUrl = selectedPreset.videoUrl;
      finalThumb = selectedPreset.thumbnailUrl;
      finalDuration = selectedPreset.durationSeconds;
    }

    if (!finalUrl) return;

    const videoDemo: VideoDemo = {
      id: `vd_${Date.now()}`,
      videoUrl: finalUrl,
      thumbnailUrl: finalThumb,
      durationSeconds: finalDuration,
      recordedAt: new Date().toISOString(),
      title: videoTitle.trim() || selectedPreset?.title || `${elderName}'s Craft Demonstration`,
      description: videoDescription.trim() || selectedPreset?.description || "Master craft demonstration video",
    };

    onSaveVideo(videoDemo);
    stopCameraStream();
    onClose();
  };

  return (
    <div
      id="video-recorder-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto"
    >
      <div className="relative w-full max-w-3xl bg-slate-900 border-2 border-amber-500/50 rounded-3xl shadow-2xl overflow-hidden text-amber-50 my-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-slate-900 px-6 py-5 border-b border-amber-500/30 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-amber-500/20 border border-amber-400/40 rounded-2xl">
              <Film className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 font-bold text-xs uppercase tracking-wider">
                  Senior Trust Verification
                </span>
                <span className="text-xs text-amber-300/80 font-mono">Step: Video Showcase</span>
              </div>
              <h2 className="text-xl font-bold font-serif text-amber-100 mt-0.5">
                Master Craft Video Demonstration
              </h2>
            </div>
          </div>
          <button
            onClick={() => {
              stopCameraStream();
              onClose();
            }}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Why Video Box */}
        <div className="px-6 pt-5">
          <div className="p-3.5 bg-amber-950/40 border border-amber-500/30 rounded-2xl flex items-start space-x-3 text-xs text-amber-200/90 leading-relaxed">
            <Sparkles className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-amber-300">Why post a video before publishing? </span>
              A short live demonstration of your hands-on skills (weaving, carving, spice grinding, clock repair) gives neighborhood customers and professional recruiters confidence in your generational expertise!
            </div>
          </div>
        </div>

        {/* Tabs: Upload Device Video, Live Camera, Preset Demos */}
        <div className="px-6 pt-4 flex space-x-2 border-b border-slate-800">
          <button
            onClick={() => {
              stopCameraStream();
              setActiveTab("upload");
            }}
            id="tab-video-upload"
            className={`pb-3 px-4 text-sm font-bold border-b-2 transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === "upload"
                ? "border-amber-400 text-amber-300"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Upload from Device</span>
          </button>
          <button
            onClick={() => {
              setActiveTab("camera");
              startCamera();
            }}
            id="tab-video-camera"
            className={`pb-3 px-4 text-sm font-bold border-b-2 transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === "camera"
                ? "border-amber-400 text-amber-300"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>Record Live with Webcam</span>
          </button>
          <button
            onClick={() => {
              stopCameraStream();
              setActiveTab("preset");
            }}
            id="tab-video-presets"
            className={`pb-3 px-4 text-sm font-bold border-b-2 transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === "preset"
                ? "border-amber-400 text-amber-300"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Curated Craft Demos</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 space-y-5">
          {/* 1. CURATED PRESETS */}
          {activeTab === "preset" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-300 font-medium">
                  Select a live artisan demonstration video that represents your service:
                </p>
                <span className="text-xs text-amber-400 font-mono font-semibold">
                  {CRAFT_VIDEO_PRESETS.length} Verified Clips
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
                {CRAFT_VIDEO_PRESETS.map((preset) => {
                  const isSelected = selectedPreset?.id === preset.id;
                  return (
                    <div
                      key={preset.id}
                      onClick={() => {
                        setSelectedPreset(preset);
                        setVideoTitle(preset.title);
                        setVideoDescription(preset.description);
                      }}
                      className={`p-3 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between space-y-2 ${
                        isSelected
                          ? "bg-amber-950/60 border-amber-400 shadow-lg shadow-amber-900/30"
                          : "bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300"
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <div className="relative w-20 h-16 rounded-xl overflow-hidden bg-slate-900 flex-shrink-0">
                          <img
                            src={preset.thumbnailUrl}
                            alt={preset.title}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                            <Play className="w-5 h-5 text-amber-300 fill-amber-300" />
                          </div>
                          <span className="absolute bottom-1 right-1 bg-black/80 text-[10px] text-white px-1 py-0.2 rounded font-mono">
                            {preset.durationSeconds}s
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-bold text-amber-100 line-clamp-2 leading-tight">
                            {preset.title}
                          </h4>
                          <p className="text-[11px] text-slate-400 line-clamp-2 mt-1">
                            {preset.description}
                          </p>
                        </div>
                      </div>
                      {isSelected && (
                        <div className="flex items-center space-x-1 text-xs text-amber-400 font-bold self-end">
                          <Check className="w-3.5 h-3.5" />
                          <span>Selected</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Live Preset Preview Video Player */}
              {selectedPreset && (
                <div className="mt-4 p-4 bg-slate-950 rounded-2xl border border-amber-500/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-amber-300 flex items-center space-x-1.5">
                      <Film className="w-4 h-4" />
                      <span>Preview Selected Video: {selectedPreset.title}</span>
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      {selectedPreset.durationSeconds} seconds
                    </span>
                  </div>
                  <video
                    src={selectedPreset.videoUrl}
                    controls
                    className="w-full h-48 sm:h-56 rounded-xl bg-black object-cover"
                  />
                </div>
              )}
            </div>
          )}

          {/* 2. LIVE CAMERA RECORDER */}
          {activeTab === "camera" && (
            <div className="space-y-4">
              {cameraError ? (
                <div className="p-4 bg-red-950/40 border border-red-500/40 rounded-2xl text-xs text-red-200 space-y-3">
                  <div className="flex items-start space-x-2">
                    <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <span>{cameraError}</span>
                  </div>
                  <button
                    onClick={() => setActiveTab("preset")}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs cursor-pointer"
                  >
                    Switch to Curated Craft Video Presets
                  </button>
                </div>
              ) : (
                <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800">
                  {!recordedVideoUrl ? (
                    <>
                      <video
                        ref={videoPreviewRef}
                        muted
                        autoPlay
                        playsInline
                        className="w-full h-64 sm:h-80 object-cover bg-slate-950"
                      />
                      {/* Recording status badge */}
                      {isRecording && (
                        <div className="absolute top-4 left-4 bg-red-600/90 text-white px-3 py-1.5 rounded-full text-xs font-bold flex items-center space-x-2 animate-pulse shadow-lg">
                          <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
                          <span>RECORDING • {recordingTime}s</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="p-4 space-y-3">
                      <div className="flex items-center justify-between text-xs text-amber-300 font-bold">
                        <span>Recorded Video Preview ({recordingTime}s)</span>
                        <button
                          onClick={handleRetake}
                          className="flex items-center space-x-1 text-slate-400 hover:text-amber-300 cursor-pointer"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Retake</span>
                        </button>
                      </div>
                      <video
                        src={recordedVideoUrl}
                        controls
                        className="w-full h-64 sm:h-80 object-cover rounded-xl bg-black"
                      />
                    </div>
                  )}

                  {/* Recorder Controls Bar */}
                  {!recordedVideoUrl && (
                    <div className="p-4 bg-slate-950/90 border-t border-slate-800 flex items-center justify-center space-x-4">
                      {!isRecording ? (
                        <button
                          onClick={startRecording}
                          disabled={!isCameraActive}
                          id="btn-start-record-video"
                          className="px-6 py-3 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm shadow-lg flex items-center space-x-2 cursor-pointer disabled:opacity-50"
                        >
                          <span className="w-3.5 h-3.5 rounded-full bg-white" />
                          <span>Start Recording</span>
                        </button>
                      ) : (
                        <button
                          onClick={stopRecording}
                          id="btn-stop-record-video"
                          className="px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm shadow-lg flex items-center space-x-2 cursor-pointer"
                        >
                          <Square className="w-4 h-4 fill-current" />
                          <span>Stop Recording ({recordingTime}s)</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 3. UPLOAD CUSTOM VIDEO FROM LOCAL DEVICE */}
          {activeTab === "upload" && (
            <div className="space-y-4">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`p-6 sm:p-8 border-2 border-dashed rounded-3xl text-center space-y-4 transition-all ${
                  isDragging
                    ? "border-amber-400 bg-amber-500/10 scale-[1.01]"
                    : customVideoUrl
                    ? "border-amber-500/50 bg-slate-950/60"
                    : "border-slate-700 hover:border-amber-500/60 bg-slate-950/40"
                }`}
              >
                <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-400 mx-auto">
                  {isProcessingVideo ? (
                    <Loader2 className="w-8 h-8 animate-spin" />
                  ) : customVideoUrl ? (
                    <CheckCircle className="w-8 h-8 text-emerald-400" />
                  ) : (
                    <HardDrive className="w-8 h-8 text-amber-400" />
                  )}
                </div>

                <div className="space-y-1">
                  <h4 className="text-base font-bold text-amber-100 font-serif">
                    {isProcessingVideo
                      ? "Analyzing Video & Generating Thumbnail..."
                      : customVideoUrl
                      ? "Craft Video Successfully Attached from Device"
                      : "Select Video File from Your Device"}
                  </h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Drag and drop your workshop demonstration video here, or browse files on your phone, tablet, or PC.
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/*,.mp4,.webm,.mov,.m4v,.mkv,.avi,.3gp"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="local-video-file-input"
                  />

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessingVideo}
                    id="btn-browse-device-video"
                    className="px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm rounded-2xl cursor-pointer shadow-lg shadow-amber-900/40 flex items-center space-x-2 transition-all disabled:opacity-50"
                  >
                    <Upload className="w-4 h-4" />
                    <span>{customVideoUrl ? "Choose Different Local Video" : "Browse Files on Device"}</span>
                  </button>
                </div>

                {/* File info pill if loaded */}
                {uploadedFileName && (
                  <div className="inline-flex flex-wrap items-center justify-center gap-2 p-2 bg-slate-900/90 border border-amber-500/30 rounded-xl text-xs text-amber-200">
                    <span className="font-bold flex items-center space-x-1 text-amber-300">
                      <FileVideo className="w-3.5 h-3.5" />
                      <span>{uploadedFileName}</span>
                    </span>
                    {uploadedFileSize && (
                      <span className="text-slate-400 font-mono">({uploadedFileSize})</span>
                    )}
                    {customDuration > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                        ⏱️ {customDuration}s duration
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Video Player Preview with thumbnail card */}
              {customVideoUrl && (
                <div className="p-4 bg-slate-950 rounded-2xl border border-amber-500/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-300 flex items-center space-x-1.5">
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Active Video Preview (Ready to Attach)</span>
                    </span>
                    <span className="text-xs text-emerald-400 font-bold bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-500/40">
                      ✓ Ready for Customers & Recruiters
                    </span>
                  </div>

                  <div className="relative rounded-xl overflow-hidden bg-black aspect-video flex items-center justify-center border border-slate-800">
                    <video
                      src={customVideoUrl}
                      controls
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>
              )}

              {/* Optional Web URL Fallback */}
              <div className="pt-2">
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Or paste a direct web video link (Optional):
                </label>
                <input
                  type="url"
                  value={customVideoUrl.startsWith("blob:") ? "" : customVideoUrl}
                  onChange={(e) => {
                    setCustomVideoUrl(e.target.value);
                    setUploadedFileName("Web Video Stream");
                  }}
                  placeholder="https://example.com/craft_demo.mp4"
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl text-xs text-amber-100 outline-none"
                />
              </div>
            </div>
          )}

          {/* Video Metadata Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
            <div>
              <label className="block text-xs font-semibold text-amber-200 mb-1">
                Video Title:
              </label>
              <input
                type="text"
                value={videoTitle}
                onChange={(e) => setVideoTitle(e.target.value)}
                placeholder="e.g. Live Zari Darning Demonstration"
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl text-xs text-amber-100"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-amber-200 mb-1">
                Short Demonstration Note:
              </label>
              <input
                type="text"
                value={videoDescription}
                onChange={(e) => setVideoDescription(e.target.value)}
                placeholder="e.g. Demonstrating delicate silk weft matching"
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl text-xs text-amber-100"
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-950 px-6 py-4 border-t border-slate-800 flex items-center justify-between">
          <button
            onClick={() => {
              stopCameraStream();
              onClose();
            }}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmAndSave}
            id="btn-confirm-video-demo"
            className="px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm shadow-lg shadow-amber-900/30 flex items-center space-x-2 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>Attach Video & Ready to Publish</span>
          </button>
        </div>
      </div>
    </div>
  );
};
