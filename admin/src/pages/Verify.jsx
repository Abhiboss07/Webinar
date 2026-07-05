import { useEffect, useState } from "react";
import { api } from "../lib/api.js";

const RESULT = {
  valid: { color: "var(--good)", icon: "✓", title: "Valid certificate" },
  revoked: { color: "var(--bad)", icon: "✕", title: "Certificate revoked" },
  not_found: { color: "var(--text-faint)", icon: "?", title: "Not found" },
};

export default function Verify() {
  const [num, setNum] = useState(""); const [tok, setTok] = useState("");
  const [res, setRes] = useState(null); const [busy, setBusy] = useState(false);

  const run = async (n, t) => {
    setBusy(true); setRes(null);
    try { const r = await api.certVerify(n, t); setRes(r); } catch (e) { setRes({ result: "not_found", error: e.message }); } finally { setBusy(false); }
  };
  useEffect(() => {
    const p = new URLSearchParams(location.search); const n = p.get("n"), t = p.get("t");
    if (n) { setNum(n); setTok(t || ""); run(n, t); }
  }, []);

  const meta = res ? RESULT[res.result] || RESULT.not_found : null;
  return (
    <div className="auth-wrap">
      <div className="auth-card" style={{ maxWidth: 440 }}>
        <div className="brand" style={{ padding: 0, marginBottom: 18 }}><div className="brand-mark">Y</div><div><div className="brand-name">Certificate Verification</div><div className="brand-sub">Youngness Institute</div></div></div>
        <div className="field"><label>Certificate number</label><input className="input" value={num} onChange={(e) => setNum(e.target.value)} placeholder="YW-2026-000123" /></div>
        <div className="field" style={{ marginTop: 10 }}><label>Verification token (optional)</label><input className="input" value={tok} onChange={(e) => setTok(e.target.value)} /></div>
        <button className="btn primary" style={{ width: "100%", justifyContent: "center", marginTop: 16 }} disabled={busy} onClick={() => run(num, tok)}>{busy ? <span className="spin" /> : "Verify"}</button>

        {meta && (
          <div className="panel" style={{ marginTop: 18 }}><div className="panel-body" style={{ textAlign: "center" }}>
            <div style={{ fontSize: 40, color: meta.color }}>{meta.icon}</div>
            <div style={{ fontWeight: 700, color: meta.color, marginTop: 6 }}>{meta.title}</div>
            {res.certificate && <div style={{ marginTop: 12, textAlign: "left" }}>
              <div className="kv"><span>Participant</span><b>{res.certificate.participant}</b></div>
              <div className="kv"><span>Workshop</span><b>{res.certificate.workshop}</b></div>
              <div className="kv"><span>Number</span><b className="mono">{res.certificate.number}</b></div>
              <div className="kv"><span>Issued</span><b>{new Date(res.certificate.issueDate).toLocaleDateString()}</b></div>
            </div>}
          </div></div>
        )}
      </div>
    </div>
  );
}
