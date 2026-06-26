import { ARROW } from "./_shared.js";

export function Hero(c) {
  const h = c.hero;
  const tr = c.trainer || {};
  // Workshop info cards (2×2) — label + value.
  const cards = h.facts.map((f) =>
    `<div class="rounded-[14px] border border-edge border-t-[3px] border-t-gold/45 bg-gradient-to-b from-white to-cream/65 px-4 py-4 text-center shadow-sm transition hover:-translate-y-1 hover:shadow-md">
        <span class="block text-[11px] font-bold uppercase tracking-[1.5px] text-ink-muted">${f.emoji} ${f.label}</span>
        <strong class="mt-1 block text-[14px] font-bold leading-tight text-navy-deep">${f.value}</strong>
      </div>`).join("");
  // Trainer nameplate (identity sourced from the `trainer` block).
  const nameplate = `<div class="mt-5 max-w-[340px] text-center">
        ${h.imageBadge ? `<span class="inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-gold-deep">${h.imageBadge}</span>` : ""}
        ${tr.name ? `<p class="mt-2 font-display text-xl font-extrabold leading-tight text-navy-deep md:text-2xl">${tr.name}</p>` : ""}
        ${tr.designation ? `<p class="mt-0.5 text-[14px] font-semibold text-clinic">${tr.designation}</p>` : ""}
        ${tr.organization ? `<p class="text-[13px] font-medium text-ink-muted">${tr.organization}</p>` : ""}
      </div>`;
  return `
<section class="hero-grid relative overflow-hidden bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(184,149,47,0.12),transparent_55%),linear-gradient(180deg,#fff9f3_0%,#faf6ef_100%)] pb-12 pt-8 md:pb-16 md:pt-14">
  <div class="relative z-[1] mx-auto max-w-[1080px] px-5 md:px-6">

    <!-- ROW 1 · FULL-WIDTH CENTERED HEADING -->
    <div class="mx-auto flex max-w-[820px] flex-col items-center gap-4 text-center">
      <div class="reveal inline-flex max-w-[680px] flex-wrap items-center justify-center gap-1.5 rounded-full border border-gold/35 bg-paper/85 px-5 py-2.5 text-[13px] font-medium shadow-sm md:text-sm">
        <span class="font-extrabold text-terra">${h.attentionLabel}</span>
        <span>${h.attentionText}</span>
      </div>
      <h1 class="reveal font-display text-[30px] font-extrabold leading-[1.1] tracking-[-0.03em] text-navy-deep md:text-5xl lg:text-[54px]">${h.title}</h1>
      <h2 class="reveal -mt-3 font-display text-[22px] font-bold leading-[1.2] tracking-[-0.02em] text-clinic md:text-[34px]">${h.subtitle}</h2>
      <p class="reveal text-base font-medium text-ink-light md:text-lg">${h.description}</p>
    </div>

    <!-- ROW 2 · TRAINER (left)  |  WORKSHOP INFO + CTA (right) -->
    <div class="mt-10 grid items-start gap-10 md:mt-12 md:grid-cols-2">

      <!-- LEFT · TRAINER -->
      <div class="reveal flex flex-col items-center">
        <div class="w-[78%] max-w-[300px] md:w-full md:max-w-[260px]">
          <div class="overflow-hidden rounded-[22px] border border-white/70 bg-white shadow-card ring-1 ring-gold/25">
            <img src="${h.image}" alt="${h.imageAlt || "Workshop trainer"}" class="aspect-[3/4] w-full object-cover object-top" fetchpriority="high" />
          </div>
        </div>
        ${nameplate}
      </div>

      <!-- RIGHT · WORKSHOP INFO CARDS + CTA (nudged down on desktop for balance) -->
      <div class="reveal flex flex-col items-center gap-5 md:mt-8 md:items-stretch">
        <div class="grid w-full max-w-[420px] grid-cols-2 gap-3 md:max-w-none">${cards}</div>
        <div class="flex w-full max-w-[420px] flex-col items-center gap-2 md:max-w-none">
          <button type="button" data-register class="btn-cta inline-flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl px-7 py-3.5 text-[15px] font-bold text-white md:py-4 md:text-base">
            ${h.primaryCta} ${ARROW}
          </button>
          <p class="text-[13px] font-semibold text-navy"><span class="text-terra">🎁</span> ${h.bonusNote}</p>
        </div>
      </div>
    </div>
  </div>
</section>`;
}
