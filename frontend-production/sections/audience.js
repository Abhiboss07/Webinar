import { audienceIcon, pillTerra } from "./_shared.js";

export function Audience(c) {
  const a = c.audience;
  const cards = a.items.map((it) =>
    `<div class="reveal rounded-[14px] border border-edge bg-white px-5 py-6 text-center shadow-sm transition hover:-translate-y-1 hover:border-clinic hover:shadow-card"><div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-clinic/10 text-clinic">${audienceIcon(it.icon)}</div><h3 class="text-[15px] font-bold text-navy-deep">${it.title}</h3></div>`).join("");
  return `
<section class="grid-bg py-14 md:py-20">
  <div class="mx-auto max-w-container px-5 md:px-6">
    <div class="reveal mx-auto mb-10 max-w-[760px] text-center">
      ${pillTerra(a.label)}
      <h2 class="title-rule font-display text-[26px] font-bold leading-tight tracking-[-0.02em] text-navy-deep md:text-[40px]">${a.heading}</h2>
    </div>
    <div class="mx-auto grid max-w-[1000px] grid-cols-2 gap-4 md:grid-cols-4">${cards}</div>
  </div>
</section>`;
}
