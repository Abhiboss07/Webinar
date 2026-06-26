/* ============================================================================
   APP — entry module. Applies SEO, renders sections from the config, wires
   interactions, and orchestrates the registration → payment → success flow.
   Section markup lives in /sections; content lives in config/workshop-config.js.
   ========================================================================== */
import { C, $ } from "./config.js";
import { Components as T } from "../sections/index.js";
import { initPopup } from "./popup.js";
import { initForm } from "./form.js";
import { PaymentService } from "./payment.js";
import { showToast } from "./toast.js";

/* ---------- 1. SEO / meta from config ---------- */
function applySeo() {
  const s = C.seo;
  document.title = s.title;
  document.documentElement.lang = s.lang || "en";
  const set = (sel, attr, val) => { const el = document.querySelector(sel); if (el && val != null) el.setAttribute(attr, val); };
  set('meta[name="description"]', "content", s.description);
  set('meta[name="keywords"]', "content", s.keywords);
  set('meta[name="theme-color"]', "content", s.themeColor);
  set('link[rel="canonical"]', "href", s.canonical);
  set('meta[property="og:title"]', "content", s.title);
  set('meta[property="og:description"]', "content", s.description);
  set('meta[property="og:image"]', "content", s.ogImage);
  set('meta[name="twitter:title"]', "content", s.title);
  set('meta[name="twitter:description"]', "content", s.description);
  set('meta[name="twitter:image"]', "content", s.ogImage);
  const fav = document.querySelector('link[rel="icon"]'); if (fav && C.brand.favicon) fav.href = C.brand.favicon;
}

/* ---------- 2. Render all sections ---------- */
function render() {
  const mount = (id, html) => { const el = document.getElementById(id); if (el) el.outerHTML = html; };
  document.getElementById("mount-header").outerHTML = T.Header(C);
  const main = document.getElementById("top");
  main.innerHTML = [
    T.Hero(C), T.Testimonials(C), T.Problem(C), T.Modules(C), T.WhyDifferent(C),
    T.Audience(C), T.Choice(C), T.Trainer(C), T.Bonus(C), T.Guarantee(C),
    T.Faq(C), T.FinalCta(C),
  ].join("");
  mount("mount-footer", T.Footer(C));
  mount("mount-sticky", T.StickyBar(C));
  mount("mount-popup", T.Popup(C));
  mount("mount-modal", T.RegistrationModal(C));
}

/* ---------- 3. Interactions ---------- */
function initReveal() {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
  }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
}

function initFaq() {
  document.querySelectorAll("#faqList .faq-q").forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = btn.closest(".faq-item"); const open = item.classList.contains("open");
      document.querySelectorAll("#faqList .faq-item").forEach((f) => f.classList.remove("open"));
      if (!open) item.classList.add("open");
    });
  });
}

function initStickyBar() {
  const bar = document.getElementById("stickyBar"); const footer = document.querySelector("footer");
  if (!bar || !footer) return;
  new IntersectionObserver((entries) => {
    entries.forEach((e) => { bar.style.transform = e.isIntersecting ? "translateY(120%)" : "translateY(0)"; });
  }, { threshold: 0.05 }).observe(footer);
}

/* ---------- Registration + payment flow (shared state) ----------
   Three modal views: formState → paymentState → successState. A registration
   is saved as "Pending" first; the success view appears ONLY after a verified
   payment. The pending registration is persisted so a closed/abandoned payment
   can be resumed later (Payment Status stays Pending until paid).
   These helpers are exported so js/form.js can drive the same flow. */
const STORE_KEY = "youngness_pending_reg";
let pendingReg = null; // { regId, data }

export function genRegId() { return "reg_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8); }
export function getPending() { return pendingReg; }
export function setPending(obj) { pendingReg = obj; try { localStorage.setItem(STORE_KEY, JSON.stringify(pendingReg)); } catch (_) {} }
function loadPending() {
  try { const raw = localStorage.getItem(STORE_KEY); pendingReg = raw ? JSON.parse(raw) : null; }
  catch (_) { pendingReg = null; }
  return pendingReg;
}
function clearPending() { pendingReg = null; try { localStorage.removeItem(STORE_KEY); } catch (_) {} }

// Show exactly one of the three modal views.
function showState(name) {
  ["formState", "paymentState", "successState"].forEach((s) => { const n = $(s); if (n) n.classList.toggle("hidden", s !== name); });
}
export function goToPayment() {
  showState("paymentState");
  const amt = $("payAmount"); if (amt) amt.textContent = (C.workshop || {}).price || "";
  const err = $("payErr"); if (err) err.classList.add("hidden");
  resetPayBtn();
}
function resetPayBtn() {
  const b = $("payBtn"); if (!b) return;
  b.disabled = false; b.classList.remove("opacity-70", "pointer-events-none");
  b.querySelector(".btn-label").textContent = (C.payment.ui || {}).payLabel || "Pay Securely";
  b.querySelector(".btn-spin").classList.add("hidden");
}

function initModal() {
  const modal = document.getElementById("regModal");
  const open = () => {
    modal.classList.remove("hidden-modal"); document.body.style.overflow = "hidden";
    // Resume an unpaid registration if one is saved; otherwise show the form.
    if (loadPending() && pendingReg.regId) goToPayment();
    else showState("formState");
    setTimeout(() => { const f = modal.querySelector("#formState input, #formState select"); if (f && !$("formState").classList.contains("hidden")) f.focus(); }, 350);
  };
  const close = () => {
    modal.classList.add("hidden-modal"); document.body.style.overflow = "";
    // Only reset after a COMPLETED (paid) registration. An in-progress payment
    // is preserved so the user can resume it next time they open the modal.
    const success = $("successState");
    if (success && !success.classList.contains("hidden")) {
      setTimeout(() => {
        clearPending();
        const form = document.getElementById("regForm"); if (form) form.reset();
        const submitBtn = $("submitBtn");
        if (submitBtn) {
          submitBtn.disabled = false; submitBtn.classList.remove("opacity-70", "pointer-events-none");
          submitBtn.querySelector(".btn-label").textContent = C.registration.submitLabel;
          submitBtn.querySelector(".btn-spin").classList.add("hidden");
        }
        showState("formState");
      }, 250);
    }
  };
  document.querySelectorAll("[data-register]").forEach((b) => b.addEventListener("click", open));
  document.getElementById("modalClose").addEventListener("click", close);
  document.getElementById("successClose").addEventListener("click", close);
  modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.classList.contains("hidden-modal")) close(); });
}

/* ---------- Payment step: choose method → Razorpay → verify → success ---------- */
function initPayment() {
  const payBtn = $("payBtn");
  if (!payBtn) return;
  const ui = C.payment.ui || {};
  const payErr = $("payErr");
  const methodsWrap = $("payMethods");
  let selectedMethod = null;

  const selCls = ["border-navy", "ring-2", "ring-navy/30", "bg-navy/5"];
  if (methodsWrap) methodsWrap.querySelectorAll(".pay-method").forEach((b) => {
    b.addEventListener("click", () => {
      methodsWrap.querySelectorAll(".pay-method").forEach((x) => x.classList.remove.apply(x.classList, selCls));
      b.classList.add.apply(b.classList, selCls);
      selectedMethod = b.getAttribute("data-method");
    });
  });

  const setPaying = (on) => {
    payBtn.disabled = on; payBtn.classList.toggle("opacity-70", on); payBtn.classList.toggle("pointer-events-none", on);
    payBtn.querySelector(".btn-label").textContent = on ? (ui.payingLabel || "Processing…") : (ui.payLabel || "Pay Securely");
    payBtn.querySelector(".btn-spin").classList.toggle("hidden", !on);
  };
  const showPayMsg = (msg) => { if (payErr) { payErr.textContent = msg; payErr.classList.remove("hidden"); } };

  payBtn.addEventListener("click", () => {
    const reg = getPending();
    if (!reg || !reg.regId) { showState("formState"); return; }
    if (!PaymentService) { showPayMsg("Payment is unavailable right now. Please try again shortly."); return; }
    if (payErr) payErr.classList.add("hidden");
    setPaying(true);

    PaymentService.start({
      regId: reg.regId,
      data: reg.data,
      onSuccess: (info) => { setPaying(false); clearPending(); showSuccessView(reg.data, info); },
      onFailure: (err) => {
        console.error("[payment] failed:", err);
        setPaying(false);
        const m = (ui.failed || "Payment couldn't be completed. Please try again.") + (err && err.message ? ` (${err.message})` : "");
        showPayMsg(m);
        showToast(ui.failed || "Payment failed. Your seat is still reserved — please try again.", "error");
      },
      onDismiss: () => {
        setPaying(false);
        showPayMsg(ui.cancelled || "Payment cancelled — your seat is still reserved.");
        showToast(ui.cancelled || "Payment cancelled — your seat is still reserved.", "info");
      },
    });
  });

  const back = $("payBack");
  if (back) back.addEventListener("click", () => { if (payErr) payErr.classList.add("hidden"); showState("formState"); });
}

// Success view — shown ONLY after a verified payment.
function showSuccessView(data, info) {
  const r = C.registration;
  showState("successState");
  const msg = (r.whatsappTemplate || "").replace(/\{(\w+)\}/g, (_, k) => (data && data[k]) || "");
  const wa = $("waBtn"); if (wa) wa.href = `https://wa.me/${C.integrations.whatsappNumber}?text=${encodeURIComponent(msg)}`;
  const ref = $("payRef");
  if (ref && info && info.paymentId) { ref.textContent = `Payment reference: ${info.paymentId}`; ref.classList.remove("hidden"); }

  // Persist the confirmed registration for the Thank-You page.
  const confirmed = {
    regId: (data && data.regId) || "",
    name: data && data.fullName, email: data && data.email, mobile: data && data.mobile,
    paymentId: info && info.paymentId, orderId: info && info.orderId,
    method: info && info.method, amount: info && info.amount,
    currency: (C.payment || {}).currency || "INR",
    at: new Date().toISOString(),
  };
  try { sessionStorage.setItem("youngness_confirmed", JSON.stringify(confirmed)); } catch (_) {}

  showToast("Payment confirmed — your seat is booked! 🎉", "success");

  const redirect = (C.payment && C.payment.successRedirect) || "thank-you.html";
  const target = `${redirect}?ref=${encodeURIComponent((info && info.paymentId) || "")}`;
  const details = $("detailsBtn");
  if (details) details.href = target;
  // Optional: fire your conversion pixel here, e.g. fbq('track','Purchase').
  setTimeout(() => { window.location.href = target; }, 2200);
}

/* ---------- boot ---------- */
applySeo();
render();
initReveal();
initFaq();
initStickyBar();
initPopup();
initModal();
initForm();
initPayment();
