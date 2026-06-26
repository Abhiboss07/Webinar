import { ARROW20 } from "./_shared.js";

export function FinalCta(c) {
  const f = c.finalCta;
  const badges = f.badges.map((b) =>
    `<span class="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-[12px] font-semibold text-white/80">${b}</span>`).join("");
  return `
<section class="relative overflow-hidden bg-gradient-to-br from-navy-deep via-navy to-[#1a4a5c] py-20 text-center text-white md:py-28">
  <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_0%,rgba(184,149,47,0.15),transparent_55%)]"></div>
  <div class="relative z-[1] mx-auto max-w-[820px] px-5 md:px-6">
    <h2 class="reveal font-display text-[28px] font-bold leading-tight md:text-5xl">${f.heading}</h2>
    <p class="reveal mx-auto mt-5 max-w-[620px] text-[17px] text-white/75 md:text-xl">${f.sub}</p>
    <div class="reveal mt-8 flex flex-col items-center">
      <button type="button" data-register class="btn-cta inline-flex w-[90%] max-w-[360px] items-center justify-center gap-2 whitespace-nowrap rounded-xl px-8 py-3.5 text-base font-bold text-white md:w-auto md:px-9 md:py-4 md:text-lg">${f.cta} ${ARROW20}</button>
      <div class="reveal mt-5 flex flex-wrap items-center justify-center gap-2">${badges}</div>
    </div>
  </div>
</section>`;
}
