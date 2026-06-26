/* Top announcement marquee + sticky navbar. */
export function Header(c) {
  return `
<div class="sticky top-0 z-[120]">
  <div class="overflow-hidden border-b border-gold/30 bg-gradient-to-r from-navy-deep via-[#1a3344] to-navy-deep py-2.5">
    <div class="marquee-track text-[13px] font-semibold tracking-wide md:text-sm">
      ${marqueeGroup(c)}
      ${marqueeGroup(c, true)}
    </div>
  </div>
  <header class="border-b border-white/10 bg-navy/95 backdrop-blur-md shadow-[0_4px_24px_rgba(15,36,51,0.12)]">
    <div class="mx-auto flex max-w-container items-center justify-between gap-4 px-4 py-2.5 md:px-6">
      <a href="#top" class="flex items-center gap-2.5" aria-label="${c.brand.name}">
        <img src="${c.brand.logo}" alt="${c.brand.name}" class="h-8 w-auto md:h-9" />
        <span class="font-display text-base font-bold text-white md:text-xl">${c.brand.name}</span>
      </a>
      <button type="button" data-register class="btn-cta inline-flex items-center gap-2 rounded-[10px] px-4 py-2.5 text-[13px] font-bold text-white md:text-sm">${c.header.cta}</button>
    </div>
  </header>
</div>`;
}

function marqueeGroup(c, hidden) {
  const styled = c.marquee.message.replace(/•/g, '<span class="text-gold">•</span>');
  const one = `<span class="mx-5 inline-flex items-center gap-2 text-white">${styled}</span>`;
  return `<span class="marquee-group"${hidden ? ' aria-hidden="true"' : ""}>${one.repeat(c.marquee.repeat || 4)}</span>`;
}
