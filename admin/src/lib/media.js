// Client-side helpers for the media library.

export const formatBytes = (b) => {
  if (!b) return "0 B";
  const u = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(b) / Math.log(1024));
  return `${(b / Math.pow(1024, i)).toFixed(i ? 1 : 0)} ${u[i]}`;
};

export const isImage = (f) => /^image\//.test(f.type) && f.type !== "image/svg+xml" && f.type !== "image/gif";

/**
 * Downscale large images in the browser before upload (provider-agnostic
 * optimisation). Returns a new File (JPEG/WebP) when it helps, else the original.
 * SVG/GIF and small images pass through untouched.
 */
export async function optimizeImage(file, maxDim = 1600, quality = 0.82) {
  if (!isImage(file)) return file;
  try {
    const bmp = await createImageBitmap(file);
    if (bmp.width <= maxDim && bmp.height <= maxDim && file.size < 500 * 1024) return file;
    const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    canvas.getContext("2d").drawImage(bmp, 0, 0, w, h);
    const type = file.type === "image/png" ? "image/webp" : "image/jpeg";
    const blob = await new Promise((r) => canvas.toBlob(r, type, quality));
    if (!blob || blob.size >= file.size) return file; // no gain → keep original
    const ext = type === "image/webp" ? "webp" : "jpg";
    const name = file.name.replace(/\.[^.]+$/, "") + "." + ext;
    return new File([blob], name, { type });
  } catch (_) {
    return file; // any failure → upload the original
  }
}

export const TYPE_ICONS = { image: "🖼", video: "🎬", raw: "📄" };
