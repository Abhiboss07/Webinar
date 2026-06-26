/* ============================================================================
   SHARED — small helpers + inline SVGs reused across section renderers.
   These produce HTML-string fragments; sections import what they need.
   ========================================================================== */

/* Inner SVG paths for the "Who Should Attend" cards (stroke icons, 1.8 weight) */
export const ICONS = {
  doctor:      '<path d="M8 2v4M16 2v4"/><rect x="4" y="6" width="16" height="16" rx="2"/><path d="M12 11v6M9 14h6"/>',
  nurse:       '<path d="M12 2a3 3 0 00-3 3v6a3 3 0 006 0V5a3 3 0 00-3-3z"/><path d="M19 11a7 7 0 01-14 0M12 18v3"/>',
  ot:          '<path d="M6 2v6a6 6 0 0012 0V2"/><line x1="6" y1="2" x2="18" y2="2"/><circle cx="12" cy="20" r="2"/>',
  physio:      '<circle cx="12" cy="5" r="2"/><path d="M12 7v6l-3 8M12 13l3 8M7 11h10"/>',
  lab:         '<path d="M9 2v6l-4 9a3 3 0 003 4h8a3 3 0 003-4l-4-9V2"/><line x1="9" y1="2" x2="15" y2="2"/><line x1="7" y1="14" x2="17" y2="14"/>',
  student:     '<path d="M22 10L12 5 2 10l10 5 10-5z"/><path d="M6 12v5c0 1 3 3 6 3s6-2 6-3v-5"/>',
  fresher:     '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/>',
  experienced: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/>',
  user:        '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/>',
};
export const audienceIcon = (name) =>
  `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ICONS.user}</svg>`;

/* Shared SVGs */
export const ARROW = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';
export const ARROW20 = ARROW.replace(/width="18" height="18"/, 'width="20" height="20"');
export const CHECK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
export const CROSS = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
export const CHECK_BOX = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
export const PLAY = '<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"/></svg>';
export const CHEVRON = '<svg class="faq-chev shrink-0 text-clinic" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';

/* Reusable bits */
export const pill = (txt, cls) => `<span class="mb-3 inline-block rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] ${cls}">${txt}</span>`;
export const pillTerra = (t) => pill(t, "border border-terra/15 bg-terra/10 text-terra-dark");
export const pillGold  = (t) => pill(t, "border border-gold/25 bg-gold/15 text-gold");
export const pillGoldDeep = (t) => pill(t, "border border-gold/25 bg-gold/15 text-gold-deep");

// The repeating Sakthi CTA block
export const ctaBlock = (label, note, mt = "mt-10") =>
  `<div class="reveal ${mt} text-center">
      <button type="button" data-register class="btn-cta inline-flex items-center justify-center gap-2.5 rounded-xl px-8 py-4 text-base font-bold text-white">${label}</button>
      <p class="mt-2 text-[13px] font-semibold text-navy">${note}</p>
    </div>`;
