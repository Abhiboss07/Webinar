import { useEffect, useState, useCallback } from "react";
import Layout from "../components/Layout.jsx";
import { MediaField } from "../components/MediaPicker.jsx";
import { useToast } from "../components/ui.jsx";
import { api, download, downloadPost } from "../lib/api.js";

const when = (d) => (d ? new Date(d).toLocaleDateString() : "—");

function TemplateDesigner() {
  const toast = useToast();
  const [t, setT] = useState(null);
  useEffect(() => { api.certTemplate().then((r) => setT(r.template)).catch((e) => toast(e.message, "error")); }, [toast]);
  if (!t) return <div className="notice">Loading…</div>;
  const set = (k, v) => setT((p) => ({ ...p, [k]: v }));
  const save = async () => { try { await api.certTemplateSave(t); toast("Template saved", "success"); } catch (e) { toast(e.message, "error"); } };
  return (
    <div className="panel-body" style={{ padding: 0 }}>
      <div className="row2">
        <div className="field" style={{ gridColumn: "1 / -1" }}><label>Title</label><input className="input" value={t.title} onChange={(e) => set("title", e.target.value)} /></div>
        <div className="field" style={{ gridColumn: "1 / -1" }}><label>Subtitle</label><input className="input" value={t.subtitle} onChange={(e) => set("subtitle", e.target.value)} /></div>
        <div className="field" style={{ gridColumn: "1 / -1" }}><label>Body ({"{{name}} {{workshop}} {{date}}"})</label><textarea value={t.bodyText} onChange={(e) => set("bodyText", e.target.value)} /></div>
        <div className="field"><label>Orientation</label><select value={t.orientation} onChange={(e) => set("orientation", e.target.value)}><option value="landscape">Landscape</option><option value="portrait">Portrait</option></select></div>
        <div className="field"><label>Instructor</label><input className="input" value={t.instructor} onChange={(e) => set("instructor", e.target.value)} /></div>
        <div className="field"><label>Primary color</label><input className="input" type="color" style={{ height: 40 }} value={t.primaryColor} onChange={(e) => set("primaryColor", e.target.value)} /></div>
        <div className="field"><label>Accent color</label><input className="input" type="color" style={{ height: 40 }} value={t.accentColor} onChange={(e) => set("accentColor", e.target.value)} /></div>
        <MediaField label="Logo" value={t.logo} onChange={(v) => set("logo", v)} half />
        <MediaField label="Signature" value={t.signature} onChange={(v) => set("signature", v)} half />
        <MediaField label="Seal" value={t.seal} onChange={(v) => set("seal", v)} half />
        <MediaField label="Background" value={t.background} onChange={(v) => set("background", v)} half />
      </div>
      <button className="btn primary" style={{ marginTop: 14 }} onClick={save}>Save template</button>
      <div className="notice" style={{ marginTop: 10 }}>Logo/background image embedding in the PDF is a later enhancement; text + verification QR render today.</div>
    </div>
  );
}

function List() {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [flt, setFlt] = useState({ q: "", status: "" });
  const [aud, setAud] = useState("attended");
  const load = useCallback(() => api.certList({ ...flt, limit: 25 }).then(setData).catch((e) => toast(e.message, "error")), [flt, toast]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const bulk = async () => { try { const r = await api.certBulk({ audience: aud }); toast(`Generated ${r.created} certificate(s)`, "success"); load(); } catch (e) { toast(e.message, "error"); } };
  const revoke = async (id) => { const reason = window.prompt("Revoke reason (optional):", ""); if (reason === null) return; try { await api.certRevoke(id, reason); toast("Revoked", "info"); load(); } catch (e) { toast(e.message, "error"); } };
  const reissue = async (id) => { try { await api.certReissue(id); toast("Reissued", "success"); load(); } catch (e) { toast(e.message, "error"); } };
  const email = async (id) => { try { const r = await api.certEmail(id); toast(r.message, "success"); } catch (e) { toast(e.message, "error"); } };

  return (
    <div>
      <div className="crm-toolbar">
        <input className="input" style={{ maxWidth: 200 }} placeholder="Search name / number…" value={flt.q} onChange={(e) => setFlt((f) => ({ ...f, q: e.target.value }))} />
        <select value={flt.status} onChange={(e) => setFlt((f) => ({ ...f, status: e.target.value }))}><option value="">Any status</option><option value="valid">Valid</option><option value="revoked">Revoked</option></select>
        <div className="spacer" />
        <select value={aud} onChange={(e) => setAud(e.target.value)}><option value="attended">Attended</option><option value="paid">Paid</option></select>
        <button className="btn primary" onClick={bulk}>Generate for {aud}</button>
        <button className="btn ghost" onClick={() => downloadPost("/api/certificates/zip", {}, "certificates.zip").catch((e) => toast(e.message, "error"))}>Download ZIP</button>
      </div>
      <div className="crm-table-wrap"><table className="crm-table"><thead><tr><th>Number</th><th>Participant</th><th>Workshop</th><th>Status</th><th>Issued</th><th></th></tr></thead>
        <tbody>{!data ? <tr><td colSpan={6}><div className="skel" style={{ height: 14 }} /></td></tr> :
          data.items.length === 0 ? <tr><td colSpan={6}><div className="empty"><div className="em-ico">🎓</div><div className="em-title">No certificates yet</div><div style={{ fontSize: 13 }}>Generate them for attended or paid participants.</div></div></td></tr> :
            data.items.map((c) => (
              <tr key={c._id}>
                <td className="mono" style={{ fontSize: 12 }}>{c.certificateNumber}</td><td style={{ fontWeight: 600 }}>{c.participantName}</td>
                <td className="muted">{c.workshop}</td><td><span className={`badge ${c.status === "valid" ? "good" : "bad"}`}>{c.status}</span></td>
                <td className="muted">{when(c.issueDate)}</td>
                <td>
                  <button className="btn ghost" style={{ padding: "3px 8px" }} onClick={() => download(`/api/certificates/${c._id}/download`, `${c.certificateNumber}.pdf`).catch((e) => toast(e.message, "error"))}>PDF</button>
                  <button className="btn ghost" style={{ padding: "3px 8px" }} onClick={() => email(c._id)}>Email</button>
                  {c.status === "valid" ? <button className="btn ghost" style={{ padding: "3px 8px", color: "var(--bad)" }} onClick={() => revoke(c._id)}>Revoke</button> : <button className="btn ghost" style={{ padding: "3px 8px" }} onClick={() => reissue(c._id)}>Reissue</button>}
                </td>
              </tr>
            ))}</tbody></table></div>
    </div>
  );
}

export default function Certificates() {
  const [tab, setTab] = useState("list");
  return (
    <Layout title="Certificates">
      <div className="hstack" style={{ gap: 6, marginBottom: 16 }}>
        <button className={`btn ${tab === "list" ? "primary" : "ghost"}`} onClick={() => setTab("list")}>Certificates</button>
        <button className={`btn ${tab === "template" ? "primary" : "ghost"}`} onClick={() => setTab("template")}>Template designer</button>
      </div>
      {tab === "list" ? <List /> : <div className="panel"><div className="panel-body"><TemplateDesigner /></div></div>}
    </Layout>
  );
}
