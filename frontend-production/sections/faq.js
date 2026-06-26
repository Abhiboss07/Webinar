import { CHEVRON, pillTerra } from "./_shared.js";

export function Faq(c) {
  const f = c.faq;
  const items = f.items.map((it) =>
    `<div class="faq-item overflow-hidden rounded-[14px] border border-edge bg-white transition hover:border-clinic"><button type="button" class="faq-q flex w-full items-center justify-between gap-4 px-6 py-5 text-left text-[16px] font-semibold text-navy-deep md:text-[17px]">${it.q}${CHEVRON}</button><div class="faq-ans"><div class="faq-clip"><p class="faq-inner px-6 pb-5 text-[15px] leading-relaxed text-ink-light">${it.a}</p></div></div></div>`).join("");
  return `
<section id="faq" class="bg-sand py-14 md:py-20">
  <div class="mx-auto max-w-container px-5 md:px-6">
    <div class="reveal mx-auto mb-10 max-w-[760px] text-center">
      ${pillTerra(f.label)}
      <h2 class="title-rule font-display text-[26px] font-bold leading-tight tracking-[-0.02em] text-navy-deep md:text-[40px]">${f.heading}</h2>
    </div>
    <div class="mx-auto max-w-[800px] space-y-3" id="faqList">${items}</div>
  </div>
</section>`;
}
