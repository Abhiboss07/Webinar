"use strict";
/**
 * Storage facade — selects the adapter so the rest of the app is
 * provider-agnostic.  Cloudinary in production; local disk for dev and as a
 * safe fallback if Cloudinary isn't configured.
 *
 * Adapter selection order:
 *   1. STORAGE_PROVIDER env explicitly set → honour it.
 *   2. CLOUDINARY_CLOUD_NAME env set → cloudinary.
 *   3. Admin configured a cloud name in Settings → Media (runtime DB) → cloudinary.
 *   4. None of the above → local.
 *
 * (3) is checked via settingsProvider's synchronous cache so there is no
 * per-request async overhead once the cache is warm.
 */
const config = require("../../config");
const local = require("./localAdapter");
const cloudinary = require("./cloudinaryAdapter");

// settingsProvider caches in memory; require is cheap after first load.
let _provider;
function getSettingsProvider() {
  if (!_provider) _provider = require("../settingsProvider");
  return _provider;
}

function adapter() {
  // 1. Env-based decision (set at boot) — primary override.
  if (config.storage.provider === "cloudinary") return cloudinary;

  // 2. If env says "local" because no CLOUDINARY_CLOUD_NAME was set,
  //    check whether the admin has since configured one in the DB.
  //    settingsProvider keeps a synchronous in-memory cache (TTL 10s);
  //    peek into it without await by reading the raw cache.
  if (config.storage.provider === "local" && !process.env.STORAGE_PROVIDER) {
    try {
      const sp = getSettingsProvider();
      // _cache is the internal { data, ts } object; null when cold.
      const cached = sp._cache;
      if (cached && cached.data) {
        const cn = (cached.data.media && cached.data.media.cloudinary && cached.data.media.cloudinary.cloudName) || "";
        if (cn) return cloudinary;
      }
    } catch (_) { /* settings not loaded yet — fall through to local */ }
  }

  return local;
}

/**
 * Async, authoritative adapter resolution for actual storage operations.
 * The sync peek above depends on whether some earlier request happened to warm
 * the settings cache — invalidate() (fired on every settings save) nulls it,
 * so an upload right after configuring Cloudinary silently landed on local
 * disk. Uploads are rare; awaiting effective() (itself 10s-cached) makes the
 * choice deterministic. STORAGE_PROVIDER env still wins as documented.
 */
async function resolveAdapter() {
  if (config.storage.provider === "cloudinary") return cloudinary;
  if (config.storage.provider === "local" && !process.env.STORAGE_PROVIDER) {
    try {
      const s = await getSettingsProvider().effective();
      const cn = (s.media && s.media.cloudinary && s.media.cloudinary.cloudName) || "";
      if (cn) return cloudinary;
    } catch (_) { /* settings unreadable — fall through to local */ }
  }
  return local;
}

/** Map a mime type to a Cloudinary-style resource type. */
function resourceTypeFor(mimetype) {
  if (/^image\//.test(mimetype)) return "image";
  if (/^video\//.test(mimetype)) return "video";
  return "raw"; // pdf, etc.
}

module.exports = {
  provider: () => adapter().kind,
  resourceTypeFor,
  upload: async (buffer, opts) => (await resolveAdapter()).upload(buffer, opts),
  destroy: async (publicId, resourceType) => (await resolveAdapter()).destroy(publicId, resourceType),
};
