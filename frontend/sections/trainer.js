import { pillGold } from "./_shared.js";

export function Trainer(c) {
  const t = c.trainer;
  const bio = t.bio.map((p) => `<p class="mb-5 text-[16px] leading-relaxed text-white/75">${p}</p>`).join("");
  const ach = t.achievements.map((a) => `<li class="flex items-center gap-2.5"><span class="text-gold">★</span> ${a}</li>`).join("");
  return `
<section class="relative overflow-hidden bg-navy py-14 text-white md:py-20">
  <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(184,149,47,0.08),transparent_60%)]"></div>
  <div class="relative z-[1] mx-auto max-w-container px-5 md:px-6">
    <div class="reveal mx-auto mb-10 max-w-[760px] text-center">
      ${pillGold(t.label)}
      <h2 class="title-rule font-display text-[26px] font-bold leading-tight tracking-[-0.02em] text-white md:text-[40px]">${t.heading}</h2>
    </div>
    <div class="mx-auto grid max-w-[940px] items-center gap-8 md:grid-cols-[320px_1fr]">
      <div class="reveal flex justify-center">
        <div class="h-56 w-56 overflow-hidden rounded-full border-4 border-gold shadow-gold md:h-64 md:w-64">
          <img src="${t.image}" alt="${t.name} — ${t.designation}" class="h-full w-full object-cover" loading="lazy" />
        </div>
      </div>
      <div class="reveal">
        <h3 class="font-display text-2xl font-bold">${t.name}</h3>
        <p class="text-[15px] font-semibold text-gold">${t.designation}</p>
        ${t.experience ? `<p class="mt-0.5 text-[14px] font-medium text-white/60">${t.experience}</p>` : ""}
        <div class="mt-4">${bio}</div>
        <ul class="grid gap-2.5 text-[15px] sm:grid-cols-2">${ach}</ul>
      </div>
    </div>
  </div>
</section>`;
}
