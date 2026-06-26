import { CHECK, CROSS, pillGold } from "./_shared.js";

export function WhyDifferent(c) {
  const w = c.whyDifferent;
  const col = (col) => {
    if (col.variant === "good") {
      const pts = col.points.map((p) => `<li class="flex gap-3"><span class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold text-clinic-deep">${CHECK}</span>${p}</li>`).join("");
      return `<div class="reveal rounded-lg border-2 border-gold bg-gradient-to-br from-clinic-dark to-clinic-deep p-7 shadow-gold">
          <h3 class="mb-4 text-lg font-bold text-gold">${col.title}</h3>
          <ul class="space-y-3 text-[15px] text-white/90">${pts}</ul>
          <p class="mt-4 text-[13px] italic text-white/70">${col.note}</p></div>`;
    }
    if (col.variant === "arrow") {
      const pts = col.points.map((p) => `<li class="flex gap-3"><span class="mt-0.5 text-gold">→</span>${p}</li>`).join("");
      return `<div class="reveal rounded-lg border border-white/10 bg-white/5 p-7">
          <h3 class="mb-4 text-lg font-bold text-white/90">${col.title}</h3>
          <ul class="space-y-3 text-[15px] text-white/80">${pts}</ul>
          <p class="mt-4 text-[13px] italic text-white/50">${col.note}</p></div>`;
    }
    const pts = col.points.map((p) => `<li class="flex gap-3"><span class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10">${CROSS}</span>${p}</li>`).join("");
    return `<div class="reveal rounded-lg border border-white/10 bg-white/5 p-7">
        <h3 class="mb-4 text-lg font-bold text-white/90">${col.title}</h3>
        <ul class="space-y-3 text-[15px] text-white/70">${pts}</ul>
        <p class="mt-4 text-[13px] italic text-white/50">${col.note}</p></div>`;
  };
  return `
<section class="relative bg-navy-deep py-14 text-white md:py-20">
  <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(184,149,47,0.07),transparent_45%),radial-gradient(circle_at_90%_100%,rgba(196,92,62,0.06),transparent_40%)]"></div>
  <div class="relative z-[1] mx-auto max-w-container px-5 md:px-6">
    <div class="reveal mx-auto mb-10 max-w-[760px] text-center">
      ${pillGold(w.label)}
      <h2 class="title-rule font-display text-[26px] font-bold leading-tight tracking-[-0.02em] text-white md:text-[40px]">${w.heading}</h2>
    </div>
    <div class="mx-auto grid max-w-[1000px] gap-6 md:grid-cols-3">${w.columns.map(col).join("")}</div>
  </div>
</section>`;
}
