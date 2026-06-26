export function StickyBar(c) {
  const s = c.sticky;
  return `
<div id="stickyBar" class="fixed inset-x-0 bottom-0 z-[200] border-t-2 border-gold/45 bg-paper/95 px-4 py-2.5 shadow-[0_-12px_40px_rgba(15,36,51,0.1)] backdrop-blur-md transition-transform md:hidden">
  <div class="flex items-center gap-3">
    <div class="min-w-0 flex-1 leading-tight">
      <strong class="block truncate text-[13px] font-bold text-navy-deep">${s.title}</strong>
      <span class="text-[11px] text-ink-muted">${s.subtitle}</span>
    </div>
    <button type="button" data-register class="btn-cta inline-flex shrink-0 items-center gap-1.5 rounded-[10px] px-5 py-3 text-[14px] font-bold text-white">${s.cta}</button>
  </div>
</div>`;
}
