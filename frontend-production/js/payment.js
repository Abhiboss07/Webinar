/* ============================================================================
   PAYMENT — real Razorpay Checkout. Talks ONLY to the backend (js/api.js).
   No demo, no fake success: a registration is confirmed only after the backend
   verifies the signature (HMAC-SHA256). The Key SECRET never reaches the browser.
   Exposes PaymentService (also on window for any classic caller).
   ========================================================================== */
import { C } from "./config.js";
import * as api from "./api.js";

function loadSdk() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not load the payment SDK. Check your connection and try again."));
    document.head.appendChild(s);
  });
}

export const PaymentService = {
  // Step 1 — save registration as Pending (backend → Google Sheets).
  async saveRegistration(reg) {
    return api.register(reg);
  },

  /* Launch real Razorpay Checkout for a saved (Pending) registration.
     opts: { regId, data, onSuccess(info), onFailure(err), onDismiss() } */
  async start(opts) {
    const o = opts || {};
    const onSuccess = o.onSuccess || function () {};
    const onFailure = o.onFailure || function () {};
    const onDismiss = o.onDismiss || function () {};
    const pay = C.payment || {};

    // 1) Create the order (amount is decided server-side).
    let order;
    try { order = await api.createOrder(o.regId); }
    catch (err) { return onFailure(err); }
    if (order.status !== "success" || !order.orderId || !order.keyId) {
      return onFailure(new Error(order.message || "Could not start payment. Please try again."));
    }

    // 2) Open Razorpay Checkout (UPI / GPay / PhonePe / Cards / Net-banking / Wallets).
    try { await loadSdk(); } catch (err) { return onFailure(err); }

    const data = o.data || {};
    const rzp = new window.Razorpay({
      key: order.keyId,
      order_id: order.orderId,
      amount: order.amount,
      currency: order.currency || pay.currency,
      name: (C.brand || {}).name || "",
      description: (C.workshop || {}).name || "Workshop Registration",
      image: (C.brand || {}).logo || undefined,
      prefill: { name: data.fullName || "", email: data.email || "", contact: data.mobile || "" },
      notes: { regId: o.regId },
      theme: { color: pay.themeColor || "#1e3d52" },
      // 3) Send the result to the backend for signature verification.
      handler: async (resp) => {
        try {
          const v = await api.verifyPayment({
            regId: o.regId,
            razorpay_order_id: resp.razorpay_order_id,
            razorpay_payment_id: resp.razorpay_payment_id,
            razorpay_signature: resp.razorpay_signature,
          });
          if (v.status === "success") {
            onSuccess({ paymentId: v.paymentId || resp.razorpay_payment_id, orderId: resp.razorpay_order_id, method: v.method || "Razorpay", amount: v.amount });
          } else {
            onFailure(new Error(v.message || "Payment verification failed."));
          }
        } catch (err) { onFailure(err); }
      },
      modal: { ondismiss: () => onDismiss(), escape: true, backdropclose: false },
    });
    rzp.on("payment.failed", (r) => onFailure(new Error((r && r.error && r.error.description) || "Payment failed.")));
    rzp.open();
  },
};

if (typeof window !== "undefined") window.PaymentService = PaymentService;
export default PaymentService;
