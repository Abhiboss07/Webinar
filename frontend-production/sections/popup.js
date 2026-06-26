export function Popup(c) {
  return `
<div id="popup" class="fixed bottom-24 left-3 z-[150] flex max-w-[260px] items-center gap-3 rounded-[14px] border border-edge bg-white p-3 pr-8 opacity-0 shadow-[0_10px_30px_rgba(0,0,0,0.18)] transition-all duration-500 md:bottom-6 md:left-5" style="transform: translateX(-130%);">
  <span id="popupAvatar" class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gold to-gold-dark font-extrabold text-navy-deep">P</span>
  <div class="min-w-0 flex-1 leading-tight">
    <span class="text-[11px] text-ink-muted">${c.popup.tag}</span>
    <strong id="popupName" class="block truncate text-[14px] font-bold text-navy-deep">—</strong>
    <span class="text-[12px] text-ink-light">${c.popup.suffix}</span>
  </div>
  <span class="absolute right-3 top-3.5 h-2.5 w-2.5 rounded-full bg-clinic-dark"></span>
</div>`;
}
