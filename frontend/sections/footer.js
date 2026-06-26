export function Footer(c) {
  const f = c.footer;
  const links = f.quickLinks.map((l) => `<a href="${l.href}" class="mb-2.5 block text-[15px] transition hover:text-gold">${l.label}</a>`).join("");
  const addr = f.contact.addressLines.join("<br />");
  return `
<footer class="bg-gradient-to-b from-[#0a1520] to-navy-deep pt-12 text-white/70">
  <div class="mx-auto grid max-w-container gap-8 px-5 pb-8 md:grid-cols-3 md:px-6">
    <div>
      <a href="#top" class="mb-4 flex items-center gap-2.5"><img src="${c.brand.logo}" alt="${c.brand.name}" class="h-9 w-auto" /><span class="font-display text-xl font-bold text-white">${c.brand.name}</span></a>
      <p class="max-w-sm text-[15px] leading-relaxed">${f.about}</p>
    </div>
    <div>
      <h4 class="mb-4 font-bold text-white">Quick Links</h4>
      ${links}
      <button type="button" data-register class="mb-2.5 block text-[15px] font-semibold text-gold transition hover:text-gold-dark">Register Now</button>
    </div>
    <div>
      <h4 class="mb-4 font-bold text-white">${f.contact.heading}</h4>
      <ul class="space-y-4 text-[15px]">
        <li class="flex gap-3"><span class="shrink-0 text-gold" aria-hidden="true">📍</span><span class="not-italic leading-relaxed">${addr}</span></li>
        <li class="flex gap-3"><span class="shrink-0 text-gold" aria-hidden="true">📞</span><a href="tel:${f.contact.phoneTel}" class="break-words transition hover:text-gold">${f.contact.phone}</a></li>
        <li class="flex gap-3"><span class="shrink-0 text-gold" aria-hidden="true">✉️</span><a href="mailto:${f.contact.email}" class="break-all transition hover:text-gold">${f.contact.email}</a></li>
      </ul>
    </div>
  </div>
  <div class="border-t border-white/10 py-5">
    <div class="mx-auto flex max-w-container flex-col items-center justify-between gap-2 px-5 text-center md:flex-row md:px-6">
      <p class="text-[13px] text-white/45">${f.copyright}</p>
      <p class="max-w-[600px] text-[13px] italic text-white/45">${f.disclaimer}</p>
    </div>
  </div>
</footer>`;
}
