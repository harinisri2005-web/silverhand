/**
 * Utility functions for local video processing, metadata extraction,
 * and automatic canvas thumbnail generation for artisan craft videos.
 */

export interface ProcessedVideoResult {
  videoUrl: string;
  thumbnailUrl: string;
  durationSeconds: number;
  fileName: string;
  fileSizeMb: string;
  width: number;
  height: number;
}

/**
 * Extracts duration and captures an authentic video frame thumbnail from a local video file.
 */
export async function processLocalVideoFile(file: File): Promise<ProcessedVideoResult> {
  const blobUrl = URL.createObjectURL(file);
  const fileSizeMb = (file.size / (1024 * 1024)).toFixed(1);
  const cleanTitle = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");

  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.src = blobUrl;
    video.muted = true;
    video.playsInline = true;

    // Timeout fallback in case video codec cannot be parsed
    const timeout = setTimeout(() => {
      resolve({
        videoUrl: blobUrl,
        thumbnailUrl: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=800&q=80",
        durationSeconds: 30,
        fileName: file.name,
        fileSizeMb,
        width: 1280,
        height: 720,
      });
    }, 5000);

    video.onloadedmetadata = () => {
      const durationSeconds = Math.round(video.duration) || 30;
      const seekTime = Math.min(1.0, durationSeconds > 2 ? durationSeconds / 2 : 0.5);

      video.currentTime = seekTime;
    };

    video.onseeked = () => {
      clearTimeout(timeout);
      try {
        const canvas = document.createElement("canvas");
        const width = video.videoWidth || 640;
        const height = video.videoHeight || 360;

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, width, height);
          const thumbnailUrl = canvas.toDataURL("image/jpeg", 0.85);

          resolve({
            videoUrl: blobUrl,
            thumbnailUrl,
            durationSeconds: Math.round(video.duration) || 30,
            fileName: cleanTitle,
            fileSizeMb,
            width,
            height,
          });
          return;
        }
      } catch (err) {
        console.warn("Could not extract canvas frame from video:", err);
      }

      // Fallback if canvas draw fails (e.g. strict cross-origin or unsupported video)
      resolve({
        videoUrl: blobUrl,
        thumbnailUrl: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=800&q=80",
        durationSeconds: Math.round(video.duration) || 30,
        fileName: cleanTitle,
        fileSizeMb,
        width: video.videoWidth || 1280,
        height: video.videoHeight || 720,
      });
    };

    video.onerror = (err) => {
      clearTimeout(timeout);
      console.warn("Video load error during metadata extraction:", err);
      resolve({
        videoUrl: blobUrl,
        thumbnailUrl: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=800&q=80",
        durationSeconds: 30,
        fileName: cleanTitle,
        fileSizeMb,
        width: 1280,
        height: 720,
      });
    };
  });
}
