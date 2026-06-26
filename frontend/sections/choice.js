import { pillTerra } from "./_shared.js";

export function Choice(c) {
  const ch = c.choice;
  return `
<section class="bg-gradient-to-b from-white via-paper to-white py-14 md:py-20">
  <div class="mx-auto max-w-container px-5 md:px-6">
    <div class="reveal mx-auto mb-10 max-w-[760px] text-center">
      ${pillTerra(ch.label)}
      <h2 class="title-rule font-display text-[26px] font-bold leading-tight tracking-[-0.02em] text-navy-deep md:text-[40px]">${ch.heading}</h2>
    </div>
    <div class="mx-auto grid max-w-[1000px] gap-6 md:grid-cols-2">
      <article class="reveal rounded-lg bg-gradient-to-br from-[#a84a3d] to-terra-deep p-8 text-white shadow-card">
        <span class="mb-4 inline-block rounded-full bg-white/20 px-3.5 py-1.5 text-xs font-extrabold uppercase tracking-[2px]">${ch.bad.tag}</span>
        <p class="mb-5 text-[15px] leading-relaxed text-white/90">${ch.bad.text}</p>
        <span class="inline-flex items-center gap-2 rounded-lg bg-black/25 px-4 py-2.5 text-sm font-bold">${ch.bad.result}</span>
      </article>
      <article class="reveal rounded-lg border-2 border-gold bg-gradient-to-br from-clinic-dark to-clinic-deep p-8 text-white shadow-card shadow-gold">
        <span class="mb-4 inline-block rounded-full bg-gold px-3.5 py-1.5 text-xs font-extrabold uppercase tracking-[2px] text-navy-deep">${ch.good.tag}</span>
        <p class="mb-5 text-[15px] leading-relaxed text-white/95">${ch.good.text}</p>
        <span class="inline-flex items-center gap-2 rounded-lg bg-gold px-4 py-2.5 text-sm font-bold text-clinic-deep">${ch.good.result}</span>
      </article>
    </div>
    <div class="reveal mx-auto mt-7 max-w-[680px] rounded-lg border border-edge bg-white p-6 text-center shadow-card md:mt-9 md:p-7">
      <h3 class="font-display text-xl font-bold text-navy-deep md:text-2xl">${ch.final.title}</h3>
      <p class="mx-auto mt-2.5 max-w-[560px] text-[15px] text-ink-light md:mt-3">${ch.final.text}</p>
      <div class="mt-5 md:mt-6">
        <button type="button" data-register class="btn-cta inline-flex h-[52px] w-auto max-w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl px-5 text-[14px] font-bold leading-none text-white md:h-auto md:gap-2.5 md:px-8 md:py-4 md:text-base">${ch.final.cta}</button>
        <p class="mt-2.5 text-[13px] font-semibold text-navy">${c.ctaNote}</p>
      </div>
    </div>
  </div>
</section>`;
}
