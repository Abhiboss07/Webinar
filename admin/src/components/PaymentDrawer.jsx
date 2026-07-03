import { useEffect, useState } from "react";
import { api, download } from "../lib/api.js";
import { useToast } from "./ui.jsx";

const money = (n, c = "INR") => new Intl.NumberFormat("en-IN", { style: "currency", currency: c, maximumFractionDigits: 0 }).format(n || 0);
const when = (d) => (d ? new Date(d).toLocaleString() : "—");

function KV({ k, v, mono, copy }) {
  const toast = useToast();
  return (
    <div className="kv">
      <span>{k}</span>
      <b className={mono ? "mono" : ""} style={{ display: "flex", gap: 6, alignItems: "center", minWidth: 0 }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{v || "—"}</span>
        {copy && v && <button className="btn ghost" style={{ padding: "1px 6px", fontSize: 11 }} onClick={() => { navigator.clipboard.writeText(v); toast("Copied", "success"); }}>copy</button>}
      </b>
    </div>
  );
}

export default function PaymentDrawer({ id, onClose, onChanged }) {
  const toast = useToast();
  const [p, setP] = useState(null);
  const [busy, setBusy] = useState("");

  const load = () => api.payGet(id).then((x) => setP(x.payment)).catch((e) => toast(e.message, "error"));
  useEffect(() => { load(); }, [id]); // eslint-disable-line

  const run = async (label, fn, okMsg) => {
    setBusy(label);
    try { const x = await fn(); if (x && x.payment) setP(x.payment); if (okMsg) toast(okMsg, "success"); onChanged && onChanged(); }
    catch (e) { toast(e.message, "error"); } finally { setBusy(""); }
  };
  const dl = (kind) => download(`/api/payments/${id}/${kind}`, `${kind}-${p?.regId || id}.pdf`).catch((e) => toast(e.message, "error"));

  const doRefund = () => {
    const gateway = window.confirm("Refund via Razorpay gateway?\n\nOK = real gateway refund · Cancel = record a manual/out-of-band refund");
    run("refund", () => api.payRefund(id, { gateway }), "Refund recorded");
  };

  if (!p) return <div className="drawer-backdrop" onClick={onClose}><div className="drawer"><div className="notice">Loading…</div></div></div>;

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div>
            <h3>{money(p.amount, p.currency)}</h3>
            <span className={`pill ${p.paymentStatus}`}>{p.paymentStatus}</span>
            {p.verified && <span className="badge good" style={{ marginLeft: 6 }}>✓ Verified</span>}
          </div>
          <button className="btn ghost icon" onClick={onClose}>✕</button>
        </div>

        <div className="drawer-body">
          <div className="drawer-sec">
            <div className="drawer-sec-t">Actions</div>
            <div className="hstack" style={{ flexWrap: "wrap", gap: 8 }}>
              <button className="btn ghost" disabled={!!busy} onClick={() => run("verify", () => api.payVerify(id), "Re-verified with gateway")}>Retry verification</button>
              {p.paymentStatus !== "Paid" && <button className="btn ghost" disabled={!!busy} onClick={() => run("paid", () => api.payMark(id, "Paid"), "Marked paid")}>Mark paid</button>}
              {p.paymentStatus !== "Failed" && <button className="btn ghost" disabled={!!busy} onClick={() => run("failed", () => api.payMark(id, "Failed"), "Marked failed")}>Mark failed</button>}
              {p.paymentStatus === "Paid" && <button className="btn ghost" style={{ color: "var(--bad)" }} disabled={!!busy} onClick={doRefund}>Refund</button>}
            </div>
            <div className="hstack" style={{ flexWrap: "wrap", gap: 8, marginTop: 8 }}>
              <button className="btn ghost" onClick={() => dl("receipt")}>Download receipt</button>
              <button className="btn ghost" onClick={() => dl("invoice")}>Download invoice</button>
            </div>
          </div>

          <div className="drawer-sec">
            <div className="drawer-sec-t">Customer</div>
            <KV k="Name" v={p.fullName} /><KV k="Email" v={p.email} copy /><KV k="Mobile" v={p.mobile} />
          </div>

          <div className="drawer-sec">
            <div className="drawer-sec-t">Payment</div>
            <KV k="Workshop" v={p.workshop} />
            <KV k="Amount" v={money(p.amount, p.currency)} />
            <KV k="Method" v={p.paymentMethod} /><KV k="Gateway" v={p.gateway} />
            <KV k="Payment ID" v={p.paymentId} mono copy />
            <KV k="Order ID" v={p.orderId} mono copy />
            <KV k="Registration ID" v={p.regId} mono copy />
            <KV k="Verification" v={p.verified ? "Verified (signature checked at capture)" : "Not verified"} />
            <KV k="Created" v={when(p.createdAt)} /><KV k="Paid time" v={when(p.transactionTime)} />
            {p.paymentStatus === "Refunded" && <><KV k="Refund" v={`${money(p.refundAmount, p.currency)}`} /><KV k="Refund ID" v={p.refundId} mono copy /><KV k="Refunded at" v={when(p.refundedAt)} /></>}
          </div>

          <div className="drawer-sec">
            <div className="drawer-sec-t">Activity</div>
            {(p.activity || []).slice().reverse().map((a, i) => (
              <div className="timeline-row" key={i}><span className="tl-dot" /><div><div style={{ fontSize: 13 }}>{a.detail}</div><div className="muted" style={{ fontSize: 11.5 }}>{a.by} · {when(a.at)}</div></div></div>
            ))}
            {(!p.activity || p.activity.length === 0) && <div className="muted" style={{ fontSize: 13 }}>No activity yet.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
