import { pillGoldDeep, ctaBlock } from "./_shared.js";

export function Modules(c) {
  const m = c.modules;
  const blocks = m.items.map((mod, i) => {
    const n = String(i + 1).padStart(2, "0");
    const cardCls = mod.highlight
      ? "reveal rounded-lg border-2 border-gold bg-gradient-to-br from-white to-cream p-6 shadow-gold md:p-8"
      : "reveal rounded-lg border border-edge bg-white p-6 shadow-sm md:p-8";
    const lessons = mod.lessons.map((l) => `<li class="flex gap-2.5"><span class="text-clinic">✔</span> ${l}</li>`).join("");
    return `<div class="${cardCls}">
        <div class="flex items-start gap-4">
          <span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-navy font-display text-lg font-extrabold text-gold">${n}</span>
          <div class="flex-1">
            <h3 class="text-lg font-bold text-navy-deep md:text-xl">${mod.title}</h3>
            <ul class="mt-3 grid gap-2 text-[15px] text-ink-light sm:grid-cols-2">${lessons}</ul>
          </div>
        </div>
      </div>`;
  }).join("");
  return `
<section class="bg-gradient-to-b from-white via-paper to-white py-14 md:py-20">
  <div class="mx-auto max-w-container px-5 md:px-6">
    <div class="reveal mx-auto mb-4 text-center">
      ${pillGoldDeep(m.label)}
      <h2 class="title-rule font-display text-[26px] font-bold leading-tight tracking-[-0.02em] text-navy-deep md:text-[40px]">${m.heading}</h2>
    </div>
    <div class="mx-auto mt-10 max-w-[860px] space-y-5">${blocks}</div>
    ${ctaBlock(m.cta, c.ctaNote)}
  </div>
</section>`;
}
