/* Registration modal — three states: form → payment → success.
   `field` builds each config-driven input; validation/handlers live in js/form.js. */

function field(f) {
  const wrap = f.half ? "col-span-1" : "col-span-2";
  const req = f.required ? ' <span class="text-terra">*</span>' : "";
  const label = `<label for="${f.name}" class="mb-1.5 block text-sm font-semibold text-navy-deep">${f.label}${req}</label>`;
  const inputCls = "w-full rounded-[10px] border-[1.5px] border-edge bg-sand px-4 py-3 text-[15px] text-navy-deep outline-none transition focus:border-navy focus:bg-white focus:ring-4 focus:ring-navy/10";
  const selCls = "w-full rounded-[10px] border-[1.5px] border-edge bg-sand px-3 py-3 text-[15px] text-navy-deep outline-none transition focus:border-navy focus:bg-white focus:ring-4 focus:ring-navy/10";
  let control;
  if (f.type === "select") {
    control = `<select id="${f.name}" name="${f.name}" class="${selCls}"><option value="">Select…</option>${f.options.map((o) => `<option>${o}</option>`).join("")}</select>`;
  } else if (f.prefix) {
    control = `<div class="phone-wrap flex items-stretch overflow-hidden rounded-[10px] border-[1.5px] border-edge bg-sand transition focus-within:border-navy focus-within:bg-white focus-within:ring-4 focus-within:ring-navy/10">
        <span class="flex items-center border-r-[1.5px] border-edge bg-dune px-3.5 text-[15px] font-bold text-navy-deep">${f.prefix}</span>
        <input id="${f.name}" name="${f.name}" type="${f.type}"${f.inputmode ? ` inputmode="${f.inputmode}"` : ""}${f.maxlength ? ` maxlength="${f.maxlength}"` : ""}${f.autocomplete ? ` autocomplete="${f.autocomplete}"` : ""} placeholder="${f.placeholder || ""}" class="min-w-0 flex-1 bg-transparent px-4 py-3 text-[15px] text-navy-deep outline-none" />
      </div>`;
  } else {
    control = `<input id="${f.name}" name="${f.name}" type="${f.type}"${f.autocomplete ? ` autocomplete="${f.autocomplete}"` : ""} placeholder="${f.placeholder || ""}" class="${inputCls}" />`;
  }
  return `<div class="${wrap} field" data-field="${f.name}">${label}${control}<p class="err mt-1 hidden text-[13px] font-medium text-terra"></p></div>`;
}

export function RegistrationModal(c) {
  const r = c.registration;
  const p = c.payment || {};
  const pu = p.ui || {};
  const WA = '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.82 11.82 0 018.413 3.488 11.82 11.82 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.523 5.26l-.999 3.648 3.965-1.607zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.521.149-.174.198-.298.298-.497.099-.198.05-.372-.025-.521-.074-.149-.669-1.612-.916-2.207-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>';
  const methods = (pu.methods || []).map((m) => `
        <button type="button" class="pay-method flex items-center gap-3 rounded-[12px] border-[1.5px] border-edge bg-white p-3 text-left transition hover:border-navy hover:shadow-card" data-method="${m.id}">
          <span class="text-2xl leading-none" aria-hidden="true">${m.emoji}</span>
          <span class="min-w-0"><span class="block text-[14px] font-bold text-navy-deep">${m.label}</span><span class="block truncate text-[12px] text-ink-muted">${m.desc}</span></span>
        </button>`).join("");
  const spinSvg = '<svg class="btn-spin hidden animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56" stroke-linecap="round"/></svg>';
  return `
<div id="regModal" class="hidden-modal fixed inset-0 z-[300] flex items-end justify-center bg-navy-deep/70 p-0 backdrop-blur-sm md:items-center md:p-6" role="dialog" aria-modal="true" aria-labelledby="regModalTitle">
  <div class="modal-card relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-xl bg-white p-6 shadow-lg md:rounded-xl md:p-8">
    <button type="button" id="modalClose" aria-label="Close" class="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-sand text-ink-muted transition hover:bg-dune hover:text-navy-deep"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
    <div id="formState">
      <div class="mb-5 text-center">
        <span class="mb-2 inline-block rounded-full border border-gold/25 bg-gold/15 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-gold-deep">${r.badge}</span>
        <h3 id="regModalTitle" class="font-display text-2xl font-bold text-navy-deep">${r.title}</h3>
        <p class="text-sm text-ink-muted">${r.sub}</p>
      </div>
      <form id="regForm" novalidate>
        <div class="grid grid-cols-2 gap-x-3 gap-y-3.5">${r.fields.map(field).join("")}</div>
        <button type="submit" id="submitBtn" class="btn-cta mt-4 flex w-full items-center justify-center gap-2.5 rounded-xl px-8 py-4 text-base font-bold text-white md:text-lg">
          <span class="btn-label">${r.submitLabel}</span>
          <svg class="btn-spin hidden animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56" stroke-linecap="round"/></svg>
        </button>
        <p id="formErr" class="mt-3 hidden rounded-[10px] border border-terra/30 bg-terra/5 p-3 text-center text-[13px] font-medium text-terra"></p>
        <p class="mt-3 text-center text-xs leading-relaxed text-ink-muted">${r.securityNote}</p>
      </form>
    </div>
    <div id="paymentState" class="hidden">
      <div class="mb-5 text-center">
        <span class="mb-2 inline-block rounded-full border border-gold/25 bg-gold/15 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-gold-deep">${pu.badge || "Secure Payment"}</span>
        <h3 class="font-display text-2xl font-bold text-navy-deep">${pu.title || "Confirm &amp; Pay"}</h3>
        <p class="mx-auto mt-1 max-w-sm text-sm text-ink-muted">${pu.sub || ""}</p>
      </div>
      <div class="mb-4 flex items-center justify-between gap-3 rounded-[12px] border border-edge bg-sand px-4 py-3">
        <div class="min-w-0">
          <p class="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Amount payable</p>
          <p id="payAmount" class="font-display text-2xl font-bold text-navy-deep">${c.workshop.price}</p>
        </div>
        <div class="min-w-0 text-right">
          <p class="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Workshop</p>
          <p class="truncate text-[13px] font-semibold text-navy">${c.workshop.name}</p>
        </div>
      </div>
      <p class="mb-2 text-sm font-semibold text-navy-deep">Choose how you'd like to pay</p>
      <div id="payMethods" class="mb-4 grid grid-cols-2 gap-3">${methods}</div>
      <button type="button" id="payBtn" class="btn-cta flex w-full items-center justify-center gap-2.5 rounded-xl px-8 py-4 text-base font-bold text-white md:text-lg">
        <span class="btn-label">${pu.payLabel || "Pay Securely"}</span>
        ${spinSvg}
      </button>
      <p id="payErr" class="mt-3 hidden rounded-[10px] border border-terra/30 bg-terra/5 p-3 text-center text-[13px] font-medium text-terra"></p>
      <p class="mt-3 text-center text-xs leading-relaxed text-ink-muted">${pu.secureNote || ""}</p>
      <p class="mt-1 text-center text-xs leading-relaxed text-ink-muted">${pu.reservedNote || ""}</p>
      <div class="mt-3 text-center"><button type="button" id="payBack" class="text-sm font-semibold text-navy-light underline-offset-4 hover:underline">${pu.changeLabel || "← Edit my details"}</button></div>
    </div>
    <div id="successState" class="hidden py-4 text-center">
      <div class="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-clinic/12 text-clinic" style="animation: pulse-ring 2s ease-out infinite;"><svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div>
      <h3 class="font-display text-2xl font-bold text-navy-deep">${r.success.title}</h3>
      <p class="mx-auto mt-2 max-w-sm text-[15px] leading-relaxed text-ink-light">${r.success.text}</p>
      <p id="payRef" class="mx-auto mt-3 hidden max-w-sm rounded-[10px] bg-sand px-4 py-2 text-[13px] font-medium text-ink-light"></p>
      <a id="waBtn" href="#" target="_blank" rel="noopener" class="mt-6 inline-flex w-full items-center justify-center gap-2.5 rounded-xl bg-[#25D366] px-8 py-4 text-base font-bold text-white shadow-lg transition hover:brightness-105">${WA} ${r.success.whatsappLabel}</a>
      <a id="detailsBtn" href="thank-you.html" class="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border-[1.5px] border-navy/20 bg-white px-8 py-3.5 text-[15px] font-bold text-navy-deep transition hover:border-navy hover:bg-sand">${r.success.detailsLabel || "View Workshop Details"}</a>
      <button type="button" id="successClose" class="mt-3 inline-block text-sm font-semibold text-navy-light underline-offset-4 hover:underline">${r.success.doneLabel || "Done"}</button>
    </div>
  </div>
</div>`;
}
