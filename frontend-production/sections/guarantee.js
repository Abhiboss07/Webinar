export function Guarantee(c) {
  const g = c.guarantee;
  const pts = g.points.map((p) => `<span class="inline-flex items-center gap-1.5 text-[13px] font-semibold text-navy-deep"><span class="text-clinic">✓</span> ${p}</span>`).join("");
  return `
<section class="grid-bg py-10 md:py-14">
  <div class="mx-auto max-w-[620px] px-5 md:px-6">
    <div class="reveal rounded-xl border border-clinic/25 bg-white p-6 text-center shadow-card md:p-8">
      <div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-clinic/12 text-clinic"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg></div>
      <span class="inline-block rounded-full bg-clinic/10 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-clinic-deep">${g.badge}</span>
      <h2 class="mt-2.5 font-display text-[22px] font-bold leading-tight text-navy-deep md:text-[28px]">${g.heading}</h2>
      <p class="mx-auto mt-2.5 max-w-[440px] text-[14px] leading-relaxed text-ink-light">${g.text}</p>
      <div class="mx-auto mt-4 flex max-w-[460px] flex-col items-center justify-center gap-2 sm:flex-row sm:flex-wrap">${pts}</div>
      <button type="button" data-register class="btn-cta mt-5 inline-flex items-center justify-center gap-2.5 rounded-xl px-8 py-4 text-base font-bold text-white">${g.cta}</button>
    </div>
  </div>
</section>`;
}
