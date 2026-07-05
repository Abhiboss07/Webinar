import { useEffect, useState, useCallback } from "react";
import Layout from "../components/Layout.jsx";
import { useToast } from "../components/ui.jsx";
import { api } from "../lib/api.js";

const num = (n) => new Intl.NumberFormat().format(n || 0);
const when = (d) => (d ? new Date(d).toLocaleString() : "—");
const TRIGGERS = ["manual", "registration.success", "payment.success", "payment.failed", "refund.processed", "workshop.reminder", "workshop.tomorrow", "workshop.started", "certificate.ready"];
const statusBadge = (s) => ({ sent: "good", delivered: "good", queued: "warn", sending: "warn", failed: "bad", cancelled: "" }[s] || "");

function Card({ label, value }) { return <div className="card stat"><div className="label">{label}</div><div className="value">{value}</div></div>; }

/* ---------------- Templates ---------------- */
function TemplateModal({ id, onClose, onSaved }) {
  const toast = useToast();
  const [t, setT] = useState(id === "new" ? { channel: "email", name: "", key: "", trigger: "manual", subject: "", body: "", whatsapp: {}, enabled: true } : null);
  const [preview, setPreview] = useState(null);
  useEffect(() => { if (id !== "new") api.commTemplateGet(id).then((r) => setT(r.template)).catch((e) => toast(e.message, "error")); }, [id, toast]);
  if (!t) return null;
  const set = (k, v) => setT((p) => ({ ...p, [k]: v }));
  const save = async () => {
    try { const r = id === "new" ? await api.commTemplateCreate(t) : await api.commTemplateUpdate(id, t); toast("Saved", "success"); onSaved(r.template); onClose(); }
    catch (e) { toast(e.message, "error"); }
  };
  const doPreview = async () => { try { setPreview(await api.commPreview(t.subject, t.body)); } catch (e) { toast(e.message, "error"); } };
  return (
    <div className="modal-backdrop" onClick={onClose}><div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
      <div className="modal-head"><h3>{id === "new" ? "New template" : t.name}</h3><button className="btn ghost icon" onClick={onClose}>✕</button></div>
      <div className="row2">
        <div className="field"><label>Name</label><input className="input" value={t.name} onChange={(e) => set("name", e.target.value)} /></div>
        {id === "new" && <div className="field"><label>Key</label><input className="input" value={t.key} onChange={(e) => set("key", e.target.value)} /></div>}
        <div className="field"><label>Channel</label><select value={t.channel} onChange={(e) => set("channel", e.target.value)} disabled={id !== "new"}><option value="email">Email</option><option value="whatsapp">WhatsApp</option></select></div>
        <div className="field"><label>Trigger</label><select value={t.trigger} onChange={(e) => set("trigger", e.target.value)}>{TRIGGERS.map((x) => <option key={x}>{x}</option>)}</select></div>
      </div>
      {t.channel === "email" && <div className="field"><label>Subject</label><input className="input" value={t.subject} onChange={(e) => set("subject", e.target.value)} /></div>}
      <div className="field"><label>Body <span className="muted" style={{ fontWeight: 400 }}>— variables: {"{{name}} {{workshop}} {{date}} {{time}} {{venue}} {{amount}} {{payment_status}} {{certificate_link}}"}</span></label>
        <textarea style={{ minHeight: 180 }} value={t.body} onChange={(e) => set("body", e.target.value)} /></div>
      <label className="flag"><input type="checkbox" checked={t.enabled} onChange={(e) => set("enabled", e.target.checked)} /> Enabled (fires on its trigger)</label>
      <div className="hstack" style={{ marginTop: 14, gap: 8 }}>
        <button className="btn primary" onClick={save}>Save</button>
        <button className="btn ghost" onClick={doPreview}>Preview</button>
      </div>
      {preview && <div className="panel" style={{ marginTop: 14 }}><div className="panel-body">
        {preview.subject && <div style={{ fontWeight: 700, marginBottom: 8 }}>{preview.subject}</div>}
        <div dangerouslySetInnerHTML={{ __html: preview.body }} />
      </div></div>}
    </div></div>
  );
}

function Templates() {
  const toast = useToast();
  const [list, setList] = useState(null); const [edit, setEdit] = useState(null);
  const load = useCallback(() => api.commTemplates().then((r) => setList(r.templates)).catch((e) => toast(e.message, "error")), [toast]);
  useEffect(() => { load(); }, [load]);
  const dup = async (id) => { try { await api.commTemplateDuplicate(id); toast("Duplicated", "success"); load(); } catch (e) { toast(e.message, "error"); } };
  const del = async (id) => { if (!window.confirm("Delete template?")) return; try { await api.commTemplateDelete(id); toast("Deleted", "info"); load(); } catch (e) { toast(e.message, "error"); } };
  return (
    <div>
      <div className="hstack" style={{ marginBottom: 12 }}><div className="spacer" /><button className="btn primary" onClick={() => setEdit("new")}>+ New template</button></div>
      <div className="crm-table-wrap"><table className="crm-table"><thead><tr><th>Name</th><th>Channel</th><th>Trigger</th><th>Status</th><th></th></tr></thead>
        <tbody>{!list ? <tr><td colSpan={5}><div className="skel" style={{ height: 14 }} /></td></tr> :
          list.map((t) => (
            <tr key={t._id}>
              <td style={{ fontWeight: 600, cursor: "pointer" }} onClick={() => setEdit(t._id)}>{t.name}</td>
              <td><span className="badge" style={{ background: "var(--ring)", color: "var(--brand-ink)" }}>{t.channel}</span></td>
              <td className="mono" style={{ fontSize: 12 }}>{t.trigger}</td>
              <td>{t.enabled ? <span className="badge good">On</span> : <span className="badge">Off</span>}</td>
              <td><button className="btn ghost" style={{ padding: "3px 8px" }} onClick={() => dup(t._id)}>Duplicate</button> <button className="btn ghost" style={{ padding: "3px 8px", color: "var(--bad)" }} onClick={() => del(t._id)}>Delete</button></td>
            </tr>
          ))}</tbody></table></div>
      {edit && <TemplateModal id={edit} onClose={() => setEdit(null)} onSaved={load} />}
    </div>
  );
}

/* ---------------- History ---------------- */
function History() {
  const toast = useToast();
  const [data, setData] = useState(null); const [flt, setFlt] = useState({ channel: "", status: "" }); const [page, setPage] = useState(1);
  const load = useCallback(() => api.commHistory({ ...flt, page, limit: 25 }).then(setData).catch((e) => toast(e.message, "error")), [flt, page, toast]);
  useEffect(() => { load(); }, [load]);
  return (
    <div>
      <div className="crm-toolbar">
        <select value={flt.channel} onChange={(e) => { setPage(1); setFlt((f) => ({ ...f, channel: e.target.value })); }}><option value="">All channels</option><option value="email">Email</option><option value="whatsapp">WhatsApp</option></select>
        <select value={flt.status} onChange={(e) => { setPage(1); setFlt((f) => ({ ...f, status: e.target.value })); }}><option value="">Any status</option>{["queued", "sent", "failed", "cancelled"].map((s) => <option key={s}>{s}</option>)}</select>
      </div>
      <div className="crm-table-wrap"><table className="crm-table"><thead><tr><th>Channel</th><th>To</th><th>Template</th><th>Status</th><th>Retries</th><th>Time</th></tr></thead>
        <tbody>{!data ? <tr><td colSpan={6}><div className="skel" style={{ height: 14 }} /></td></tr> :
          data.items.length === 0 ? <tr><td colSpan={6}><div className="empty"><div className="em-title">No messages</div></div></td></tr> :
            data.items.map((m) => (
              <tr key={m._id}>
                <td>{m.channel}</td><td className="muted">{m.to}</td><td className="mono" style={{ fontSize: 11.5 }}>{m.templateKey || m.trigger}</td>
                <td><span className={`badge ${statusBadge(m.status)}`}>{m.status}</span>{m.error && <div className="muted" style={{ fontSize: 11 }}>{m.error}</div>}</td>
                <td>{m.retries}</td><td className="muted" style={{ whiteSpace: "nowrap" }}>{when(m.sentAt || m.createdAt)}</td>
              </tr>
            ))}</tbody></table></div>
      {data && data.pages > 1 && <div className="pager"><button className="btn ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Prev</button><span className="muted">Page {page} of {data.pages}</span><button className="btn ghost" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>Next →</button></div>}
    </div>
  );
}

/* ---------------- Send (bulk + test) ---------------- */
function Send({ onSent }) {
  const toast = useToast();
  const [templates, setTemplates] = useState([]); const [tpl, setTpl] = useState(""); const [aud, setAud] = useState("paid");
  const [workshop, setWorkshop] = useState(""); const [when_, setWhen] = useState(""); const [testTo, setTestTo] = useState("");
  useEffect(() => { api.commTemplates().then((r) => setTemplates(r.templates)); }, []);
  const bulk = async () => {
    if (!tpl) return toast("Pick a template", "error");
    try { const r = await api.commSendBulk({ templateId: tpl, audience: aud, workshop, scheduledFor: when_ || undefined }); toast(`Queued ${r.enqueued} message(s)`, "success"); onSent && onSent(); }
    catch (e) { toast(e.message, "error"); }
  };
  const test = async () => { if (!testTo) return; try { const r = await api.commSendTest({ templateId: tpl || undefined, to: testTo }); toast(`Test ${r.message.status}`, r.message.status === "sent" ? "success" : "error"); onSent && onSent(); } catch (e) { toast(e.message, "error"); } };
  return (
    <div className="row2">
      <div className="panel" style={{ margin: 0 }}><div className="panel-head"><h3>Bulk send</h3></div><div className="panel-body">
        <div className="field"><label>Template</label><select value={tpl} onChange={(e) => setTpl(e.target.value)}><option value="">Select…</option>{templates.map((t) => <option key={t._id} value={t._id}>{t.channel} · {t.name}</option>)}</select></div>
        <div className="field"><label>Audience</label><select value={aud} onChange={(e) => setAud(e.target.value)}><option value="">All</option><option value="paid">Paid</option><option value="pending">Pending</option><option value="failed">Failed</option></select></div>
        <div className="field"><label>Workshop (optional)</label><input className="input" value={workshop} onChange={(e) => setWorkshop(e.target.value)} /></div>
        <div className="field"><label>Schedule (optional)</label><input className="input" type="datetime-local" value={when_} onChange={(e) => setWhen(e.target.value)} /></div>
        <button className="btn primary" onClick={bulk}>Queue bulk send</button>
      </div></div>
      <div className="panel" style={{ margin: 0 }}><div className="panel-head"><h3>Send test</h3></div><div className="panel-body">
        <div className="field"><label>Template (optional)</label><select value={tpl} onChange={(e) => setTpl(e.target.value)}><option value="">Default test</option>{templates.map((t) => <option key={t._id} value={t._id}>{t.channel} · {t.name}</option>)}</select></div>
        <div className="field"><label>Recipient</label><input className="input" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="email or phone" /></div>
        <button className="btn ghost" onClick={test}>Send test now</button>
        <div className="notice" style={{ marginTop: 12 }}>Tip: set Email/WhatsApp provider to <b>mock</b> in Settings → Communication to simulate delivery without real credentials.</div>
      </div></div>
    </div>
  );
}

function Triggers() {
  const toast = useToast();
  const [t, setT] = useState(null);
  useEffect(() => { api.commTriggers().then((r) => setT(r.triggers)).catch(() => {}); }, []);
  if (!t) return null;
  const toggle = async (k) => { const next = { [k]: !t[k] }; try { const r = await api.commSetTriggers(next); setT(r.triggers); toast("Trigger updated", "success"); } catch (e) { toast(e.message, "error"); } };
  return (
    <div className="panel" style={{ marginTop: 18 }}><div className="panel-head"><h3>Automation triggers</h3><p>Which events auto-send their enabled templates</p></div>
      <div className="panel-body">{Object.keys(t).map((k) => (
        <div className="hstack" key={k} style={{ padding: "5px 0" }}><span className="mono" style={{ fontSize: 13 }}>{k}</span><div className="spacer" /><button className={`switch ${t[k] ? "on" : ""}`} onClick={() => toggle(k)}><span className="knob" /></button></div>
      ))}</div></div>
  );
}

export default function Communication() {
  const toast = useToast();
  const [tab, setTab] = useState("dashboard");
  const [dash, setDash] = useState(null);
  const loadDash = useCallback(() => api.commDashboard().then(setDash).catch((e) => toast(e.message, "error")), [toast]);
  useEffect(() => { if (tab === "dashboard") loadDash(); }, [tab, loadDash]);
  const act = async (fn, msg) => { try { const r = await fn(); toast(msg || "Done", "success"); loadDash(); return r; } catch (e) { toast(e.message, "error"); } };

  return (
    <Layout title="Communication">
      <div className="hstack" style={{ gap: 6, marginBottom: 16 }}>
        {["dashboard", "templates", "history", "send"].map((t) => <button key={t} className={`btn ${tab === t ? "primary" : "ghost"}`} onClick={() => setTab(t)} style={{ textTransform: "capitalize" }}>{t}</button>)}
      </div>

      {tab === "dashboard" && (!dash ? <div className="notice">Loading…</div> : <>
        <div className="grid cards">
          <Card label="Emails today" value={num(dash.cards.emailToday)} />
          <Card label="WhatsApp today" value={num(dash.cards.whatsappToday)} />
          <Card label="Queued" value={num(dash.cards.queued)} />
          <Card label="Failed" value={num(dash.cards.failed)} />
          <Card label="Sent (all)" value={num(dash.cards.sent)} />
          <Card label="Opened" value={num(dash.cards.opened)} />
        </div>
        <div className="hstack" style={{ gap: 8, margin: "16px 0", flexWrap: "wrap" }}>
          <button className="btn primary" onClick={() => act(() => api.commQueueProcess(), "Queue processed")}>Process queue now</button>
          <button className="btn ghost" onClick={() => act(() => api.commQueueRetry(), "Retried failed")}>Retry failed</button>
          <button className="btn ghost" onClick={() => act(() => api.commQueuePause(!dash.paused), dash.paused ? "Resumed" : "Paused")}>{dash.paused ? "Resume queue" : "Pause queue"}</button>
          {dash.paused && <span className="badge warn">Queue paused</span>}
        </div>
        <div className="section-title">Recent activity</div>
        <div className="crm-table-wrap"><table className="crm-table"><thead><tr><th>Channel</th><th>To</th><th>Trigger</th><th>Status</th><th>Time</th></tr></thead>
          <tbody>{dash.recent.map((m) => <tr key={m._id}><td>{m.channel}</td><td className="muted">{m.to}</td><td className="mono" style={{ fontSize: 11.5 }}>{m.trigger}</td><td><span className={`badge ${statusBadge(m.status)}`}>{m.status}</span></td><td className="muted">{when(m.createdAt)}</td></tr>)}
            {dash.recent.length === 0 && <tr><td colSpan={5}><div className="empty"><div className="em-title">No activity yet</div></div></td></tr>}</tbody></table></div>
        <Triggers />
      </>)}
      {tab === "templates" && <Templates />}
      {tab === "history" && <History />}
      {tab === "send" && <Send onSent={loadDash} />}
    </Layout>
  );
}
