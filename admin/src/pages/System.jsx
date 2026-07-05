import { useEffect, useState, useCallback } from "react";
import Layout from "../components/Layout.jsx";
import { useToast } from "../components/ui.jsx";
import { useAuth } from "../lib/auth.jsx";
import { api, download } from "../lib/api.js";

const mb = (b) => `${(Number(b || 0) / 1048576).toFixed(1)} MB`;
const when = (d) => (d ? new Date(d).toLocaleString() : "—");
const num = (n) => new Intl.NumberFormat().format(n || 0);
function Card({ label, value, hint }) { return <div className="card stat"><div className="label">{label}</div><div className="value" style={{ fontSize: 22 }}>{value}</div>{hint && <div className="hint">{hint}</div>}</div>; }
const Light = ({ ok }) => <span className="dot" style={{ background: ok ? "var(--good)" : "var(--bad)", width: 9, height: 9 }} />;

function Overview() {
  const [o, setO] = useState(null); const [h, setH] = useState(null);
  useEffect(() => { api.sysOverview().then(setO).catch(() => {}); api.sysHealth().then(setH).catch(() => {}); }, []);
  if (!o) return <div className="notice">Loading…</div>;
  return <>
    <div className="grid cards">
      <Card label="Uptime" value={`${Math.floor(o.server.uptimeSec / 60)}m`} hint={o.server.env} />
      <Card label="Database" value={o.database.ok ? `${o.database.responseMs}ms` : "down"} hint={`v${o.database.version}`} />
      <Card label="Memory" value={`${o.memory.rssMB}MB`} hint={`${o.memory.freeMB}/${o.memory.totalMB}MB free`} />
      <Card label="CPU load" value={o.cpu.load1} hint={`${o.cpu.cores} cores`} />
      <Card label="Storage" value={mb(o.storage.uploadBytes)} hint={`${o.storage.uploadFiles} files · ${o.storage.provider}`} />
      <Card label="Active users" value={num(o.activeUsers)} hint={`${o.activeSessions} sessions`} />
    </div>
    {h && <div className="panel" style={{ marginTop: 18 }}><div className="panel-head"><h3>Service health</h3><p>Checked {when(h.checkedAt)}</p></div>
      <div className="panel-body">{h.services.map((s) => <div className="hstack" key={s.name} style={{ padding: "5px 0" }}><Light ok={s.ok} /> <b style={{ minWidth: 130 }}>{s.name}</b> <span className="muted">{s.detail}{s.ms != null ? ` · ${s.ms}ms` : ""}</span></div>)}</div></div>}
  </>;
}

function Backups() {
  const toast = useToast(); const { isSuperAdmin } = useAuth();
  const [list, setList] = useState(null); const [busy, setBusy] = useState(false);
  const load = useCallback(() => api.sysBackups().then((r) => setList(r.backups)).catch((e) => toast(e.message, "error")), [toast]);
  useEffect(() => { load(); }, [load]);
  const create = async (includeData) => { setBusy(true); try { await api.sysBackup(includeData); toast("Backup created", "success"); load(); } catch (e) { toast(e.message, "error"); } finally { setBusy(false); } };
  const verify = async (id) => { try { const r = await api.sysBackupVerify(id); toast(r.verified ? "✓ Verified" : "✗ Checksum mismatch", r.verified ? "success" : "error"); load(); } catch (e) { toast(e.message, "error"); } };
  const restore = async (id) => { if (!window.confirm("Restore this backup? This overwrites config/content (users & audit are preserved).")) return; try { const r = await api.sysRestore(id); toast(`Restored: ${r.results.map((x) => x.name).join(", ")}`, "success"); } catch (e) { toast(e.message, "error"); } };
  return (
    <div>
      <div className="hstack" style={{ gap: 8, marginBottom: 14 }}>
        <button className="btn primary" disabled={busy} onClick={() => create(false)}>Backup config</button>
        <button className="btn ghost" disabled={busy} onClick={() => create(true)}>Backup config + data</button>
      </div>
      <div className="crm-table-wrap"><table className="crm-table"><thead><tr><th>Created</th><th>Collections</th><th>Size</th><th>Verified</th><th>By</th><th></th></tr></thead>
        <tbody>{!list ? <tr><td colSpan={6}><div className="skel" style={{ height: 14 }} /></td></tr> :
          list.length === 0 ? <tr><td colSpan={6}><div className="empty"><div className="em-title">No backups yet</div></div></td></tr> :
            list.map((b) => <tr key={b._id}>
              <td className="muted">{when(b.createdAt)}</td><td>{b.collections.reduce((s, c) => s + c.count, 0)} docs {b.includeData ? "(+data)" : ""}</td>
              <td>{mb(b.size)}</td><td><Light ok={b.verified} /></td><td className="muted">{b.by}</td>
              <td>
                <button className="btn ghost" style={{ padding: "3px 8px" }} onClick={() => download(`/api/system/backups/${b._id}/download`, `backup-${b._id}.json`).catch((e) => toast(e.message, "error"))}>Download</button>
                <button className="btn ghost" style={{ padding: "3px 8px" }} onClick={() => verify(b._id)}>Verify</button>
                {isSuperAdmin && <button className="btn ghost" style={{ padding: "3px 8px", color: "var(--bad)" }} onClick={() => restore(b._id)}>Restore</button>}
              </td>
            </tr>)}</tbody></table></div>
    </div>
  );
}

function Logs() {
  const [data, setData] = useState(null); const [cat, setCat] = useState("app"); const [q, setQ] = useState(""); const [cats, setCats] = useState([]);
  const load = useCallback(() => api.sysLogs({ category: cat, q, limit: 60 }).then((r) => { setData(r); if (r.categories) setCats(r.categories); }).catch(() => {}), [cat, q]);
  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [load]);
  return <div>
    <div className="crm-toolbar">
      <select value={cat} onChange={(e) => setCat(e.target.value)}>{(cats.length ? cats : ["app", "auth", "payment", "email", "whatsapp", "error"]).map((c) => <option key={c}>{c}</option>)}</select>
      <input className="input" style={{ maxWidth: 220 }} placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
    </div>
    <div className="crm-table-wrap"><table className="crm-table"><thead><tr><th>Time</th><th>Level</th><th>Message</th></tr></thead>
      <tbody>{!data ? <tr><td colSpan={3}><div className="skel" style={{ height: 14 }} /></td></tr> :
        data.items.length === 0 ? <tr><td colSpan={3}><div className="empty"><div className="em-title">No log entries</div></div></td></tr> :
          data.items.map((l, i) => <tr key={i}><td className="muted" style={{ whiteSpace: "nowrap" }}>{when(l.at)}</td><td><span className={`badge ${l.level === "error" ? "bad" : l.level === "warn" ? "warn" : ""}`}>{l.level}</span></td><td style={{ fontSize: 13 }}>{l.message}</td></tr>)}
      </tbody></table></div>
  </div>;
}

function Queue() {
  const [q, setQ] = useState(null);
  useEffect(() => { api.sysQueue().then(setQ).catch(() => {}); }, []);
  if (!q) return <div className="notice">Loading…</div>;
  return <>
    <div className="hstack" style={{ marginBottom: 14 }}><Light ok={q.healthy} /> <b>{q.healthy ? "Queue healthy" : "Queue needs attention"}</b>{q.paused && <span className="badge warn" style={{ marginLeft: 8 }}>Paused</span>}</div>
    <div className="grid cards">{Object.entries(q.counts).map(([k, v]) => <Card key={k} label={k} value={num(v)} />)}</div>
    {q.failedJobs.length > 0 && <div className="panel" style={{ marginTop: 16 }}><div className="panel-head"><h3>Failed jobs</h3></div><div className="panel-body">
      {q.failedJobs.map((f, i) => <div key={i} style={{ fontSize: 13, padding: "4px 0" }} className="muted">{f.channel} → {f.to} · <span style={{ color: "var(--bad)" }}>{f.error}</span> ({f.retries} retries)</div>)}
    </div></div>}
  </>;
}

function Storage() {
  const [s, setS] = useState(null);
  useEffect(() => { api.sysStorage().then(setS).catch(() => {}); }, []);
  if (!s) return <div className="notice">Loading…</div>;
  return <>
    <div className="grid cards"><Card label="Total assets" value={num(s.total.count)} hint={mb(s.total.bytes)} /><Card label="Duplicate groups" value={num(s.duplicateGroups)} /><Card label="Local disk" value={mb(s.localDisk.total)} hint={`${s.localDisk.files} files`} /></div>
    <div className="panel" style={{ marginTop: 16 }}><div className="panel-head"><h3>Largest files</h3></div><div className="panel-body">
      {s.largest.map((f, i) => <div key={i} className="hstack" style={{ fontSize: 13, padding: "3px 0" }}><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.originalFilename}</span><div className="spacer" /><span className="muted">{mb(f.bytes)}</span></div>)}
    </div></div>
  </>;
}

function Security() {
  const [s, setS] = useState(null);
  useEffect(() => { api.sysSecurity().then(setS).catch(() => {}); }, []);
  if (!s) return <div className="notice">Loading…</div>;
  return <>
    <div className="grid cards"><Card label="Failed logins (24h)" value={num(s.failedLogins24h)} /><Card label="Locked accounts" value={num(s.lockedAccounts.length)} /><Card label="Active sessions" value={num(s.activeSessions)} /><Card label="Min password" value={s.passwordPolicy.minLength} hint={`lock after ${s.passwordPolicy.maxLoginAttempts}`} /></div>
    <div className="panel" style={{ marginTop: 16 }}><div className="panel-head"><h3>Recent login failures</h3></div><div className="panel-body">
      {s.recentFailures.length === 0 ? <div className="muted">None recently.</div> : s.recentFailures.map((f, i) => <div key={i} style={{ fontSize: 13, padding: "3px 0" }} className="muted">{when(f.at)} · {f.userEmail || "?"} · {f.ip} · {f.action}</div>)}
    </div></div>
  </>;
}

function Environment() {
  const [e, setE] = useState(null);
  useEffect(() => { api.sysEnvironment().then(setE).catch(() => {}); }, []);
  if (!e) return <div className="notice">Loading…</div>;
  return <div className="panel"><div className="panel-body">
    {[["Build version", e.build.version], ["Node", e.build.node], ["MongoDB", e.build.mongo], ["Environment", e.build.env], ["Started", when(e.build.startedAt)], ["Configured", e.validation.configured ? "✓ yes" : "✗ no"], ["Missing env", e.validation.missing.length ? e.validation.missing.join(", ") : "none"]].map(([k, v]) => <div className="kv" key={k}><span>{k}</span><b>{String(v)}</b></div>)}
  </div></div>;
}

function Maintenance() {
  const toast = useToast(); const [m, setM] = useState(null);
  useEffect(() => { api.sysMaintenance().then((r) => setM(r.maintenance)).catch(() => {}); }, []);
  if (!m) return <div className="notice">Loading…</div>;
  const save = async (enabled) => { try { const r = await api.sysSetMaintenance(enabled, m.message); setM(r.maintenance); toast(enabled ? "Maintenance ON — public site shows the message" : "Maintenance OFF", enabled ? "info" : "success"); } catch (e) { toast(e.message, "error"); } };
  return <div className="panel"><div className="panel-body">
    <label className="flag" style={{ marginBottom: 12 }}><input type="checkbox" checked={m.enabled} onChange={(e) => save(e.target.checked)} /> Maintenance mode {m.enabled ? "ON" : "OFF"}</label>
    <div className="field"><label>Message shown to visitors</label><textarea value={m.message} onChange={(e) => setM({ ...m, message: e.target.value })} /></div>
    <button className="btn primary" onClick={() => save(m.enabled)}>Save</button>
    <div className="notice" style={{ marginTop: 10 }}>When ON, the public site shows this message. Admins can still preview via <span className="mono">?preview=1</span>.</div>
  </div></div>;
}

function Notifications() {
  const [n, setN] = useState(null);
  useEffect(() => { api.sysNotifications().then((r) => setN(r.alerts)).catch(() => {}); }, []);
  if (!n) return <div className="notice">Loading…</div>;
  if (n.length === 0) return <div className="empty"><div className="em-ico">✅</div><div className="em-title">All clear — no alerts</div></div>;
  return <div>{n.map((a, i) => <div className="panel" key={i} style={{ marginBottom: 10 }}><div className="panel-body hstack"><span className={`badge ${a.level === "error" ? "bad" : a.level === "warn" ? "warn" : "good"}`}>{a.level}</span> <b style={{ marginLeft: 10 }}>{a.title}</b><div className="spacer" /><span className="muted">{a.detail}</span></div></div>)}</div>;
}

const TABS = { Overview, Backups, Logs, Queue, Storage, Security, Environment, Maintenance, Notifications };

export default function System() {
  const [tab, setTab] = useState("Overview");
  const Comp = TABS[tab];
  return (
    <Layout title="System Administration">
      <div className="hstack" style={{ gap: 6, marginBottom: 18, flexWrap: "wrap" }}>
        {Object.keys(TABS).map((t) => <button key={t} className={`btn ${tab === t ? "primary" : "ghost"}`} onClick={() => setTab(t)}>{t}</button>)}
      </div>
      <Comp />
    </Layout>
  );
}
