import { pillGold } from "./_shared.js";

export function Bonus(c) {
  const b = c.bonus;
  const cards = b.items.map((it, i) =>
    `<div class="reveal rounded-lg border border-gold/25 bg-gradient-to-br from-navy-light to-navy-deep p-7 shadow-gold shadow-card transition hover:-translate-y-1.5"><span class="mb-4 inline-block rounded bg-gold px-3 py-1 text-[11px] font-extrabold uppercase tracking-[1.5px] text-navy-deep">Bonus ${i + 1}</span><h3 class="mb-2 text-lg font-bold">${it.title}</h3><p class="mb-4 text-[14px] leading-relaxed text-white/70">${it.desc}</p><div class="flex flex-col gap-1 border-t border-gold/20 pt-3"><span class="text-[13px] text-white/55 line-through">${it.value}</span><span class="text-[15px] font-extrabold text-gold">FREE Today</span></div></div>`).join("");
  const total = `<div class="reveal flex flex-col items-center justify-center rounded-lg border-2 border-gold bg-gold/10 p-7 text-center"><span class="text-xs font-bold uppercase tracking-[2px] text-white/70">${b.total.label}</span><strong class="my-2 font-display text-5xl font-extrabold leading-none text-gold">${b.total.amount}</strong><span class="text-[15px] font-semibold text-white">${b.total.note}</span><button type="button" data-register class="mt-4 inline-flex items-center gap-2 rounded-[10px] bg-gold px-6 py-3 text-sm font-bold text-navy-deep transition hover:bg-gold-dark">${b.total.cta}</button></div>`;
  return `
<section class="relative bg-navy-deep py-14 text-white md:py-20">
  <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(184,149,47,0.08),transparent_50%),radial-gradient(circle_at_80%_80%,rgba(184,149,47,0.06),transparent_50%)]"></div>
  <div class="relative z-[1] mx-auto max-w-container px-5 md:px-6">
    <div class="reveal mx-auto mb-10 max-w-[760px] text-center">
      ${pillGold(b.label)}
      <h2 class="title-rule font-display text-[26px] font-bold leading-tight tracking-[-0.02em] text-white md:text-[40px]">${b.heading}</h2>
      <p class="mt-4 text-base text-white/70 md:text-[17px]">${b.sub}</p>
    </div>
    <div class="mx-auto grid max-w-[1000px] gap-6 sm:grid-cols-2 lg:grid-cols-3">${cards}${total}</div>
  </div>
</section>`;
}
