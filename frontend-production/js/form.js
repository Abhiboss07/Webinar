/* ============================================================================
   FORM — config-driven validation + submit. On submit it saves the lead as
   Pending (via the backend) and opens the payment step. No success popup is
   ever shown before a verified payment.
   ========================================================================== */
import { C } from "./config.js";
import { PaymentService } from "./payment.js";
import { NetworkError } from "./api.js";
import { showToast } from "./toast.js";
import { genRegId, getPending, setPending, goToPayment } from "./app.js";

export function initForm() {
  const r = C.registration;
  const form = document.getElementById("regForm");
  const submitBtn = document.getElementById("submitBtn");
  const formErr = document.getElementById("formErr");
  if (!form || !submitBtn) return;
  const fields = r.fields;

  const errEl = (input) => {
    const wrap = input.closest(".phone-wrap") ? input.closest(".phone-wrap").parentElement : input.parentElement;
    return wrap.querySelector(":scope > .err");
  };
  const setErr = (input, msg) => {
    const p = errEl(input);
    if (msg) { input.classList.add("border-terra"); if (p) { p.textContent = msg; p.classList.remove("hidden"); } }
    else { input.classList.remove("border-terra"); if (p) { p.textContent = ""; p.classList.add("hidden"); } }
  };

  // Build a validator per configured field
  const validators = {};
  fields.forEach((f) => {
    validators[f.name] = (v) => {
      const val = (v || "").trim();
      if (f.required && val === "") return f.type === "select" ? `Please select your ${f.label.toLowerCase()}` : `Please enter your ${f.label.toLowerCase()}`;
      if (f.validate === "mobileIN" && !/^[6-9]\d{9}$/.test(val)) return "Enter a valid 10-digit Indian mobile number";
      if (f.type === "email" && val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return "Enter a valid email address";
      if (f.minLength && val.length < f.minLength) return `Please enter a valid ${f.label.toLowerCase()}`;
      return true;
    };
  });

  // Digit-only filter for mobile-type fields
  fields.filter((f) => f.validate === "mobileIN").forEach((f) => {
    const el = form[f.name];
    el.addEventListener("input", () => { el.value = el.value.replace(/\D/g, "").slice(0, f.maxlength || 10); });
  });

  // Live-clear errors once a field is corrected
  fields.forEach((f) => {
    const el = form[f.name];
    const ev = el.tagName === "SELECT" ? "change" : "input";
    el.addEventListener(ev, () => { if (el.classList.contains("border-terra")) { const res = validators[f.name](el.value); setErr(el, res === true ? "" : res); } });
  });

  const validate = () => {
    let ok = true;
    fields.forEach((f) => { const res = validators[f.name](form[f.name].value); if (res !== true) { setErr(form[f.name], res); ok = false; } else setErr(form[f.name], ""); });
    return ok;
  };

  const resetSubmitBtn = () => {
    submitBtn.disabled = false; submitBtn.classList.remove("opacity-70", "pointer-events-none");
    submitBtn.querySelector(".btn-label").textContent = r.submitLabel;
    submitBtn.querySelector(".btn-spin").classList.add("hidden");
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    formErr.classList.add("hidden");
    if (!validate()) {
      const el = form.querySelector(".border-terra"); if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      showToast("Please fix the highlighted fields and try again.", "error");
      return;
    }

    submitBtn.disabled = true; submitBtn.classList.add("opacity-70", "pointer-events-none");
    submitBtn.querySelector(".btn-label").textContent = "Reserving your seat…";
    submitBtn.querySelector(".btn-spin").classList.remove("hidden");

    // Reuse the regId if the user came back to edit (no duplicate row).
    const current = getPending();
    const regId = (current && current.regId) || genRegId();
    const data = { regId: regId, source: location.href, workshop: (C.workshop || {}).name || "" };
    fields.forEach((f) => { let v = form[f.name].value.trim(); if (f.prefix) v = f.prefix + v; data[f.name] = v; });

    try {
      if (!PaymentService) throw new Error("Payment service unavailable — please refresh and try again.");
      // Save the registration as Pending (backend → Google Sheets). No success popup yet.
      await PaymentService.saveRegistration(data);
      setPending({ regId: regId, data: data });
      resetSubmitBtn();
      goToPayment(); // open the payment step immediately
    } catch (err) {
      console.error("[registration] save failed:", err);
      const network = err instanceof NetworkError;
      const msg = network
        ? `Network error — please check your connection and try again, or WhatsApp us at ${C.footer.contact.phone}.`
        : `Something went wrong saving your registration. Please try again or WhatsApp us at ${C.footer.contact.phone}.`;
      formErr.textContent = msg;
      formErr.classList.remove("hidden");
      showToast(network ? "Network error — please check your connection." : "Couldn't save your registration. Please try again.", "error");
      resetSubmitBtn();
    }
  });
}
