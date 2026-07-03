import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { useToast } from "./ui.jsx";

const STATUSES = ["Pending", "Paid", "Failed", "Cancelled", "Refunded"];
const money = (n, c = "INR") => new Intl.NumberFormat("en-IN", { style: "currency", currency: c, maximumFractionDigits: 0 }).format(n || 0);
const when = (d) => (d ? new Date(d).toLocaleString() : "—");

function KV({ k, v }) { return <div className="kv"><span>{k}</span><b>{v || "—"}</b></div>; }

export default function RegistrationDrawer({ id, onClose, onChanged }) {
  const toast = useToast();
  const [r, setR] = useState(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => api.regGet(id).then((x) => setR(x.registration)).catch((e) => toast(e.message, "error"));
  useEffect(() => { load(); }, [id]); // eslint-disable-line

  const patch = async (body) => {
    setBusy(true);
    try { const x = await api.regPatch(id, body); setR(x.registration); onChanged && onChanged(); }
    catch (e) { toast(e.message, "error"); } finally { setBusy(false); }
  };
  const addNote = async () => {
    if (!note.trim()) return;
    try { const x = await api.regNote(id, note.trim()); setR(x.registration); setNote(""); onChanged && onChanged(); }
    catch (e) { toast(e.message, "error"); }
  };

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        {!r ? <div className="notice">Loading…</div> : <>
          <div className="drawer-head">
            <div>
              <h3>{r.fullName || "—"}</h3>
              <div className="muted mono" style={{ fontSize: 12 }}>{r.regId}</div>
            </div>
            <button className="btn ghost icon" onClick={onClose}>✕</button>
          </div>

          <div className="drawer-body">
            <div className="drawer-sec">
              <div className="drawer-sec-t">Status</div>
              <div className="field"><label>Payment status</label>
                <select value={r.paymentStatus} disabled={busy} onChange={(e) => patch({ paymentStatus: e.target.value })}>
                  {STATUSES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="flag-row">
                {[["attended", "Attended"], ["certificateIssued", "Certificate issued"], ["waitlisted", "Waiting list"]].map(([k, label]) => (
                  <label key={k} className="flag"><input type="checkbox" checked={!!r[k]} disabled={busy} onChange={(e) => patch({ [k]: e.target.checked })} /> {label}</label>
                ))}
              </div>
            </div>

            <div className="drawer-sec">
              <div className="drawer-sec-t">Profile</div>
              <KV k="Mobile" v={r.mobile} /><KV k="Email" v={r.email} />
              <KV k="Profession" v={r.profession} /><KV k="Experience" v={r.experience} />
              <KV k="City" v={r.city} /><KV k="Preferred mode" v={r.mode} />
            </div>

            <div className="drawer-sec">
              <div className="drawer-sec-t">Workshop &amp; payment</div>
              <KV k="Workshop" v={r.workshop} />
              <KV k="Amount" v={r.amount ? money(r.amount, r.currency) : "—"} />
              <KV k="Method" v={r.paymentMethod} /><KV k="Payment ID" v={r.paymentId} />
              <KV k="Registered" v={when(r.createdAt)} /><KV k="Paid at" v={when(r.transactionTime)} />
              <KV k="Source" v={r.sourceHost} />
            </div>

            <div className="drawer-sec">
              <div className="drawer-sec-t">Internal notes</div>
              <div className="hstack" style={{ gap: 6 }}>
                <input className="input" placeholder="Add a note…" value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addNote()} />
                <button className="btn primary" onClick={addNote}>Add</button>
              </div>
              {(r.notes || []).slice().reverse().map((n, i) => (
                <div className="note" key={i}><div>{n.text}</div><div className="muted" style={{ fontSize: 11.5 }}>{n.by} · {when(n.at)}</div></div>
              ))}
              {(!r.notes || r.notes.length === 0) && <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>No notes yet.</div>}
            </div>

            <div className="drawer-sec">
              <div className="drawer-sec-t">Activity</div>
              {(r.activity || []).slice().reverse().map((a, i) => (
                <div className="timeline-row" key={i}><span className="tl-dot" /><div><div style={{ fontSize: 13 }}>{a.detail}</div><div className="muted" style={{ fontSize: 11.5 }}>{a.by} · {when(a.at)}</div></div></div>
              ))}
              {(!r.activity || r.activity.length === 0) && <div className="muted" style={{ fontSize: 13 }}>No activity yet.</div>}
            </div>
          </div>
        </>}
      </div>
    </div>
  );
}
