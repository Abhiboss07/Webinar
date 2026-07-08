import { PLAY, pillTerra, ctaBlock } from "./_shared.js";

/* Auto-derive avatar initials ("Priya Nair" → "PN") when none are stored. */
const initialsOf = (name) =>
  String(name || "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "★";

export function Testimonials(c) {
  const t = c.testimonials;
  // Items are CMS-managed lists: array order = display order, and an item with
  // enabled === false is hidden without being deleted.
  const shown = (list) => (Array.isArray(list) ? list : []).filter((x) => x && x.enabled !== false);
  // Cards are an image gallery by default; the play overlay renders ONLY when
  // an item is actually a video (has a video/url field or type === "video").
  const videos = shown(t.videos).map((v) => {
    const isVideo = !!(v.video || v.url || v.type === "video");
    const overlay = isVideo
      ? `<span class="absolute inset-0 flex items-center justify-center"><span class="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 text-terra shadow-lg transition group-hover:scale-110">${PLAY}</span></span>`
      : "";
    const caption = `${v.name || ""}${v.designation ? ` · ${v.designation}` : ""}`;
    return `<div class="group relative aspect-video ${isVideo ? "cursor-pointer " : ""}overflow-hidden rounded-lg bg-navy-deep shadow-card">
        <img src="${v.thumb}" alt="${isVideo ? "Video testimonial" : "Testimonial"} — ${caption}" class="h-full w-full object-cover opacity-70 transition group-hover:scale-105 group-hover:opacity-90" loading="lazy" />
        ${overlay}
        <span class="absolute bottom-3 left-4 text-sm font-bold text-white drop-shadow">${caption}</span>
      </div>`;
  }).join("");
  const reviews = shown(t.reviews).map((r) => {
    const n = Math.min(5, Math.max(1, parseInt(r.rating, 10) || 5));
    return `<article class="reveal w-[85%] shrink-0 snap-center rounded-lg border border-edge bg-white p-6 shadow-sm md:w-auto">
        <div class="mb-3 text-gold">${"★".repeat(n)}${"☆".repeat(5 - n)}</div>
        <p class="mb-4 text-[15px] leading-relaxed text-ink">${r.quote || ""}</p>
        <div class="flex items-center gap-3"><span class="flex h-10 w-10 items-center justify-center rounded-full bg-clinic/15 font-bold text-clinic">${r.initials || initialsOf(r.name)}</span><div><strong class="block text-[14px] text-navy-deep">${r.name || ""}</strong><span class="text-[12px] text-ink-muted">${r.role || ""}</span></div></div>
      </article>`;
  }).join("");
  return `
<section id="stories" class="bg-gradient-to-b from-white via-paper to-white pb-14 pt-8 md:pb-20 md:pt-10">
  <div class="mx-auto max-w-container px-5 md:px-6">
    <div class="reveal mx-auto mb-8 max-w-[760px] text-center">
      ${pillTerra(t.label)}
      <h2 class="title-rule font-display text-[26px] font-bold leading-tight tracking-[-0.02em] text-navy-deep md:text-[40px]">${t.heading}</h2>
    </div>
    <div class="reveal mx-auto mb-8 grid max-w-[900px] gap-4 sm:grid-cols-2">${videos}</div>
    <div class="no-bar mx-auto flex max-w-[1000px] snap-x snap-mandatory gap-5 overflow-x-auto pb-3 md:grid md:grid-cols-3 md:overflow-visible">${reviews}</div>
    ${ctaBlock(t.cta, c.ctaNote)}
  </div>
</section>`;
}
