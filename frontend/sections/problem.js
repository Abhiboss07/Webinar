import { CHECK_BOX, pillTerra, ctaBlock } from "./_shared.js";

export function Problem(c) {
  const p = c.problem;
  const items = p.items.map((txt) =>
    `<li class="flex items-center gap-3.5 rounded-[14px] border border-edge bg-white px-5 py-4 shadow-sm"><span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border-2 border-terra/40 text-terra">${CHECK_BOX}</span><span class="text-[15px] font-medium text-ink md:text-base">${txt}</span></li>`).join("");
  return `
<section class="grid-bg py-14 md:py-20">
  <div class="mx-auto max-w-[820px] px-5 md:px-6">
    <div class="reveal mb-8 text-center">
      ${pillTerra(p.label)}
      <h2 class="title-rule font-display text-[26px] font-bold leading-tight tracking-[-0.02em] text-navy-deep md:text-[40px]">${p.heading}</h2>
    </div>
    <ul class="reveal mx-auto max-w-[680px] space-y-3">${items}</ul>
    <p class="reveal mx-auto mt-7 max-w-[620px] text-center text-[17px] font-semibold text-navy-deep">${p.punchline}</p>
    ${ctaBlock(p.cta, c.ctaNote, "mt-7")}
  </div>
</section>`;
}
