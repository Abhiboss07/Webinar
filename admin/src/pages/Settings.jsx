import { useEffect, useState, useCallback } from "react";
import Layout from "../components/Layout.jsx";
import { MediaField } from "../components/MediaPicker.jsx";
import { useToast } from "../components/ui.jsx";
import { api, download } from "../lib/api.js";

const get = (o, p) => p.split(".").reduce((x, k) => (x == null ? x : x[k]), o);
function setP(o, p, v) { const ks = p.split("."); const last = ks.pop(); let c = o; for (const k of ks) { c[k] = c[k] && typeof c[k] === "object" ? { ...c[k] } : {}; c = c[k]; } c[last] = v; }

// section → fields. type: text|textarea|number|color|select|toggle|secret|media
const CFG = {
  general: { label: "General", fields: [
    ["general.siteName", "Site name", "text"], ["general.currency", "Currency", "text", null, true], ["general.timezone", "Timezone", "text", null, true],
    ["general.language", "Language", "text", null, true], ["general.dateFormat", "Date format", "text", null, true],
    ["general.primaryColor", "Primary color", "color", null, true], ["general.secondaryColor", "Secondary color", "color", null, true],
    ["general.typography", "Typography", "text", null, true], ["general.logo", "Logo", "media"], ["general.favicon", "Favicon", "media"] ] },
  contact: { label: "Contact", fields: [
    ["contact.phone", "Phone", "text", null, true], ["contact.whatsapp", "WhatsApp", "text", null, true], ["contact.email", "Email", "text", null, true],
    ["contact.supportEmail", "Support email", "text", null, true], ["contact.mapsLink", "Google Maps link", "text"], ["contact.address", "Address", "textarea"] ] },
  payment: { label: "Payment", test: "razorpay", fields: [
    ["payment.mode", "Mode", "select", ["test", "live"]],
    ["payment.test.keyId", "Test Key ID", "text"], ["payment.test.keySecret", "Test Key Secret", "secret"], ["payment.test.webhookSecret", "Test Webhook Secret", "secret"],
    ["payment.live.keyId", "Live Key ID", "text"], ["payment.live.keySecret", "Live Key Secret", "secret"], ["payment.live.webhookSecret", "Live Webhook Secret", "secret"] ] },
  media: { label: "Media", test: "cloudinary", fields: [
    ["media.cloudinary.cloudName", "Cloud name", "text", null, true], ["media.cloudinary.apiKey", "API key", "text", null, true], ["media.cloudinary.apiSecret", "API secret", "secret"],
    ["media.cloudinary.folder", "Folder", "text", null, true], ["media.imageQuality", "Image quality", "select", ["auto", "best", "good", "eco"], true], ["media.compression", "Compression", "toggle", null, true] ] },
  email: { label: "Email (SMTP)", test: "smtp", email: true, fields: [
    ["email.smtp.host", "Host", "text"], ["email.smtp.port", "Port", "number", null, true], ["email.smtp.encryption", "Encryption", "select", ["tls", "ssl", "none"], true],
    ["email.smtp.username", "Username", "text"], ["email.smtp.password", "Password", "secret"], ["email.smtp.fromName", "From name", "text", null, true], ["email.smtp.fromEmail", "From email", "text", null, true] ] },
  google: { label: "Google", test: "sheets", fields: [
    ["google.sheets.spreadsheetId", "Spreadsheet ID", "text"], ["google.sheets.appsScriptUrl", "Apps Script URL", "text"], ["google.sheets.sharedToken", "Shared token", "secret"],
    ["google.analyticsId", "Analytics ID", "text", null, true], ["google.tagManagerId", "Tag Manager ID", "text", null, true] ] },
  seo: { label: "SEO", fields: [
    ["seo.defaultTitle", "Default title", "text"], ["seo.metaDescription", "Meta description", "textarea"], ["seo.keywords", "Keywords", "text"],
    ["seo.ogImage", "OG image", "media"], ["seo.robots", "Robots", "text", null, true], ["seo.canonicalUrl", "Canonical URL", "text", null, true],
    ["seo.googleVerification", "Google verification", "text"], ["seo.schema", "Schema JSON", "textarea"] ] },
  security: { label: "Security", fields: [
    ["security.sessionTimeout", "Session timeout", "text", null, true], ["security.passwordMinLength", "Password min length", "number", null, true],
    ["security.maxLoginAttempts", "Max login attempts", "number", null, true], ["security.lockMinutes", "Lock minutes", "number", null, true],
    ["security.twoFactor", "2FA enabled", "toggle", null, true], ["security.maintenance.enabled", "Maintenance mode", "toggle", null, true], ["security.maintenance.message", "Maintenance message", "text"] ] },
  branding: { label: "Branding", fields: [
    ["branding.loaderLogo", "Loader logo", "media"], ["branding.emailLogo", "Email logo", "media"], ["branding.invoiceLogo", "Invoice logo", "media"],
    ["branding.certificateLogo", "Certificate logo", "media"], ["branding.adminLogo", "Admin logo", "media"] ] },
};
const SOCIAL = ["facebook", "instagram", "linkedin", "youtube", "twitter"];

function SectionForm({ sectionKey, settings, onSaved }) {
  const toast = useToast();
  const cfg = CFG[sectionKey];
  const [draft, setDraft] = useState({});
  const [busy, setBusy] = useState(false);
  const [testMsg, setTestMsg] = useState(null);
  const [emailTo, setEmailTo] = useState("");

  useEffect(() => {
    const d = {};
    for (const [path, , type] of cfg.fields) {
      if (type === "secret") continue; // write-only, start blank
      setP(d, path, get(settings, path) ?? "");
    }
    setDraft(d);
  }, [sectionKey, settings]); // eslint-disable-line

  const upd = (path, v) => setDraft((p) => { const n = { ...p }; setP(n, path, v); return n; });
  const save = async () => {
    setBusy(true);
    try { const r = await api.settingsUpdate(sectionKey, get(draft, sectionKey) || {}); toast("Saved", "success"); onSaved(r.settings); }
    catch (e) { toast(e.message, "error"); } finally { setBusy(false); }
  };
  const runTest = async () => { setTestMsg("testing"); try { const r = await api.settingsTest(cfg.test); setTestMsg(r); } catch (e) { setTestMsg({ ok: false, message: e.message }); } };
  const sendEmail = async () => { try { const r = await api.settingsTestEmail(emailTo); toast(r.message, "success"); } catch (e) { toast(e.message, "error"); } };

  const field = ([path, label, type, options, half]) => {
    const val = get(draft, path);
    const secretInfo = type === "secret" ? get(settings, path) : null;
    const common = { key: path };
    let control;
    if (type === "media") return <MediaField key={path} label={label} value={val} onChange={(v) => upd(path, v)} half />;
    if (type === "textarea") control = <textarea value={val ?? ""} onChange={(e) => upd(path, e.target.value)} />;
    else if (type === "select") control = <select value={val ?? ""} onChange={(e) => upd(path, e.target.value)}>{options.map((o) => <option key={o}>{o}</option>)}</select>;
    else if (type === "toggle") return <div className="field" key={path} style={{ gridColumn: half ? "auto" : "1 / -1" }}><label>{label}</label><button className={`switch ${val ? "on" : ""}`} onClick={() => upd(path, !val)}><span className="knob" /></button></div>;
    else if (type === "color") control = <input className="input" type="color" style={{ height: 40, padding: 4 }} value={val || "#000000"} onChange={(e) => upd(path, e.target.value)} />;
    else if (type === "secret") control = <input className="input" type="password" placeholder={secretInfo && secretInfo.set ? `Saved (${secretInfo.masked}) — leave blank to keep` : "Not set"} value={val ?? ""} onChange={(e) => upd(path, e.target.value)} />;
    else control = <input className="input" type={type === "number" ? "number" : "text"} value={val ?? ""} onChange={(e) => upd(path, type === "number" ? Number(e.target.value) : e.target.value)} />;
    return <div className="field" {...common} style={{ gridColumn: half ? "auto" : "1 / -1" }}><label>{label}</label>{control}</div>;
  };

  return (
    <div>
      <div className="panel-body" style={{ padding: 0 }}>
        <div className="row2">{cfg.fields.map(field)}</div>
      </div>
      <div className="hstack" style={{ marginTop: 16, gap: 10, flexWrap: "wrap" }}>
        <button className="btn primary" onClick={save} disabled={busy}>{busy ? <span className="spin" /> : "Save"}</button>
        {cfg.test && <button className="btn ghost" onClick={runTest}>Test connection</button>}
        {testMsg && testMsg !== "testing" && <span className={`badge ${testMsg.ok ? "good" : "bad"}`}>{testMsg.ok ? "✓ " : "✗ "}{testMsg.message}</span>}
        {testMsg === "testing" && <span className="muted">Testing…</span>}
      </div>
      {cfg.email && (
        <div className="hstack" style={{ marginTop: 12, gap: 8 }}>
          <input className="input" style={{ maxWidth: 240 }} placeholder="you@example.com" value={emailTo} onChange={(e) => setEmailTo(e.target.value)} />
          <button className="btn ghost" onClick={sendEmail}>Send test email</button>
        </div>
      )}
    </div>
  );
}

function SocialForm({ settings, onSaved }) {
  const toast = useToast();
  const [draft, setDraft] = useState({});
  useEffect(() => { setDraft(JSON.parse(JSON.stringify(settings.social || {}))); }, [settings]);
  const save = async () => { try { const r = await api.settingsUpdate("social", draft); toast("Saved", "success"); onSaved(r.settings); } catch (e) { toast(e.message, "error"); } };
  return (
    <div>
      {SOCIAL.map((k) => (
        <div className="hstack" key={k} style={{ gap: 10, marginBottom: 10 }}>
          <span style={{ width: 90, textTransform: "capitalize" }}>{k}</span>
          <input className="input" placeholder="https://…" value={draft[k]?.url || ""} onChange={(e) => setDraft((d) => ({ ...d, [k]: { ...d[k], url: e.target.value } }))} />
          <button className={`switch ${draft[k]?.enabled ? "on" : ""}`} onClick={() => setDraft((d) => ({ ...d, [k]: { ...d[k], enabled: !d[k]?.enabled } }))}><span className="knob" /></button>
        </div>
      ))}
      <button className="btn primary" onClick={save} style={{ marginTop: 8 }}>Save</button>
    </div>
  );
}

function Diagnostics() {
  const [d, setD] = useState(null);
  const load = () => api.settingsDiagnostics().then(setD).catch(() => {});
  useEffect(() => { load(); }, []);
  if (!d) return <div className="notice">Running checks…</div>;
  return (
    <div>
      <div className="hstack" style={{ marginBottom: 12 }}><span className={`badge ${d.healthy ? "good" : "warn"}`}>{d.healthy ? "All systems go" : "Attention needed"}</span><div className="spacer" /><button className="btn ghost" onClick={load}>Refresh</button></div>
      <div className="grid cards">
        {d.checks.map((c, i) => (
          <div className="card stat" key={i}>
            <div className="label"><span className="dot" style={{ background: c.ok ? "var(--good)" : "var(--bad)" }} /> {c.label}</div>
            <div className="hint" style={{ marginTop: 8, fontSize: 13 }}>{c.detail}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Backup({ onChanged }) {
  const toast = useToast();
  const [hist, setHist] = useState([]);
  const load = () => api.settingsHistory().then((r) => setHist(r.history || [])).catch(() => {});
  useEffect(() => { load(); }, []);
  const doImport = async (file) => {
    try { const txt = await file.text(); const parsed = JSON.parse(txt); const data = parsed.data || parsed; const r = await api.settingsImport(data); toast("Imported", "success"); onChanged(r.settings); load(); }
    catch (e) { toast(e.message || "Invalid file", "error"); }
  };
  return (
    <div>
      <div className="hstack" style={{ gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <button className="btn ghost" onClick={() => download("/api/settings/export", "settings.json").catch((e) => toast(e.message, "error"))}>Export settings</button>
        <label className="btn ghost" style={{ cursor: "pointer" }}>Import<input type="file" accept="application/json" hidden onChange={(e) => e.target.files[0] && doImport(e.target.files[0])} /></label>
        <button className="btn ghost" style={{ color: "var(--bad)" }} onClick={async () => { if (window.confirm("Restore all settings to defaults?")) { const r = await api.settingsRestore(); toast("Restored defaults", "info"); onChanged(r.settings); load(); } }}>Restore defaults</button>
      </div>
      <div className="drawer-sec-t">Version history</div>
      {hist.length === 0 ? <div className="muted" style={{ fontSize: 13 }}>No snapshots yet.</div> : hist.map((h) => (
        <div className="hstack" key={h.index} style={{ padding: "7px 0", fontSize: 13 }}>
          <span>{new Date(h.at).toLocaleString()} <span className="muted">· {h.by || "—"}</span></span>
          <div className="spacer" /><button className="btn ghost" style={{ padding: "3px 9px" }} onClick={async () => { const r = await api.settingsRevert(h.index); toast("Reverted", "success"); onChanged(r.settings); load(); }}>Restore</button>
        </div>
      ))}
    </div>
  );
}

const TABS = [...Object.keys(CFG).slice(0, 2), "social", ...Object.keys(CFG).slice(2), "backup", "diagnostics"];
const TAB_LABEL = { ...Object.fromEntries(Object.entries(CFG).map(([k, v]) => [k, v.label])), social: "Social", backup: "Backup", diagnostics: "Diagnostics" };

export default function Settings() {
  const toast = useToast();
  const [settings, setSettings] = useState(null);
  const [tab, setTab] = useState("general");
  const load = useCallback(() => api.settingsGet().then((r) => setSettings(r.settings)).catch((e) => toast(e.message, "error")), [toast]);
  useEffect(() => { load(); }, [load]);
  if (!settings) return <Layout title="Settings"><div className="notice">Loading…</div></Layout>;

  return (
    <Layout title="Settings">
      <div className="roles-layout">
        <div className="roles-list" style={{ width: 190 }}>
          {TABS.map((t) => <button key={t} className={`role-item ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>{TAB_LABEL[t]}</button>)}
        </div>
        <div className="panel" style={{ margin: 0, flex: 1 }}>
          <div className="panel-head"><div><h3>{TAB_LABEL[tab]}</h3><p>Changes are saved to the database — no config files.</p></div></div>
          <div className="panel-body">
            {tab === "social" ? <SocialForm settings={settings} onSaved={setSettings} /> :
              tab === "backup" ? <Backup onChanged={setSettings} /> :
                tab === "diagnostics" ? <Diagnostics /> :
                  <SectionForm sectionKey={tab} settings={settings} onSaved={setSettings} />}
          </div>
        </div>
      </div>
    </Layout>
  );
}
