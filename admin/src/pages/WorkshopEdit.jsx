import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Layout from "../components/Layout.jsx";
import { Field, TextArea, useToast } from "../components/ui.jsx";
import { MediaField, PickerModal } from "../components/MediaPicker.jsx";
import { setPath, getPath } from "../lib/draft.jsx";
import { api } from "../lib/api.js";

const PUBLIC_SITE = (import.meta.env.VITE_PUBLIC_SITE_URL || "").replace(/\/$/, "");
const TABS = ["General", "Schedule", "Registration", "Media", "SEO", "Advanced (JSON)"];

function GalleryEditor({ items, onChange }) {
  const [pick, setPick] = useState(false);
  const list = Array.isArray(items) ? items : [];
  return (
    <div className="field" style={{ gridColumn: "1 / -1" }}>
      <label>Gallery</label>
      <div className="gallery-grid">
        {list.map((url, i) => (
          <div className="gallery-item" key={i}>
            <img src={url} alt="" />
            <button className="gallery-x" onClick={() => onChange(list.filter((_, idx) => idx !== i))}>✕</button>
          </div>
        ))}
        <button className="gallery-add" onClick={() => setPick(true)}>+ Add</button>
      </div>
      {pick && <PickerModal accept="image" onPick={(m) => onChange([...list, m.secureUrl])} onClose={() => setPick(false)} />}
    </div>
  );
}

export default function WorkshopEdit() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const [w, setW] = useState(null);
  const [loadErr, setLoadErr] = useState("");
  const [tab, setTab] = useState("General");
  const [status, setStatus] = useState("saved");
  const [jsonText, setJsonText] = useState("");
  const [jsonErr, setJsonErr] = useState("");
  const latest = useRef(null);
  const timer = useRef(null);

  useEffect(() => {
    setLoadErr("");
    api.workshop(id)
      .then((r) => { setW(r.workshop); latest.current = r.workshop; })
      .catch((e) => { setLoadErr(e.message || "Could not load this workshop"); });
  }, [id]);

  const persist = useCallback(async () => {
    setStatus("saving");
    const b = latest.current;
    try {
      const r = await api.workshopUpdate(id, { title: b.title, subtitle: b.subtitle, description: b.description, category: b.category, slug: b.slug, content: b.content });
      // Backend may adjust the slug (uniqueness) — reflect it back.
      setW((cur) => ({ ...cur, slug: r.workshop.slug }));
      latest.current = { ...latest.current, slug: r.workshop.slug };
      setStatus("saved");
    } catch (e) { setStatus("error"); toast(e.message, "error"); }
  }, [id, toast]);

  const schedule = useCallback(() => {
    setStatus("dirty"); clearTimeout(timer.current); timer.current = setTimeout(persist, 900);
  }, [persist]);

  const setMeta = (field, value) => { setW((p) => { const n = { ...p, [field]: value }; latest.current = n; return n; }); schedule(); };
  const setC = (path, value) => { setW((p) => { const n = { ...p, content: setPath(p.content || {}, path, value) }; latest.current = n; return n; }); schedule(); };
  const saveNow = () => { clearTimeout(timer.current); persist(); };

  useEffect(() => { if (tab.startsWith("Advanced") && w) { setJsonText(JSON.stringify(w.content || {}, null, 2)); setJsonErr(""); } }, [tab]); // eslint-disable-line
  const applyJson = () => {
    try { const p = JSON.parse(jsonText); if (!p || typeof p !== "object" || Array.isArray(p)) throw new Error("Top level must be an object");
      setW((cur) => { const n = { ...cur, content: p }; latest.current = n; return n; }); setJsonErr(""); saveNow(); toast("Content saved", "success");
    } catch (e) { setJsonErr(e.message); }
  };

  if (loadErr) return (
    <Layout title="Workshop">
      <div className="empty">
        <div className="em-ico">⚠️</div>
        <div className="em-title">Could not load this workshop</div>
        <div style={{ fontSize: 13, marginBottom: 12 }}>{loadErr}</div>
        <button className="btn primary" onClick={() => nav("/workshops")}>← Back to Workshops</button>
      </div>
    </Layout>
  );
  if (!w) return <Layout title="Workshop"><div className="notice">Loading…</div></Layout>;

  const cF = (label, path, opts = {}) => <Field label={label} value={getPath(w.content, path)} onChange={(v) => setC(path, v)} {...opts} />;
  const cTA = (label, path, opts = {}) => <TextArea label={label} value={getPath(w.content, path)} onChange={(v) => setC(path, v)} {...opts} />;
  const cM = (label, path, opts = {}) => <MediaField label={label} value={getPath(w.content, path)} onChange={(v) => setC(path, v)} {...opts} />;

  const saver = { saved: "✓ Saved", dirty: "Unsaved…", saving: "Saving…", error: "Save failed" }[status];
  const preview = () => { if (!PUBLIC_SITE) return toast("Set VITE_PUBLIC_SITE_URL to enable Preview", "error"); window.open(`${PUBLIC_SITE}/?preview=1&workshop=${encodeURIComponent(w.slug)}`, "_blank", "noopener"); };

  return (
    <Layout title="Edit workshop">
      <div className="publish-bar">
        <button className="btn ghost" onClick={() => nav("/workshops")}>← Workshops</button>
        <b style={{ fontSize: 15 }}>{w.title}</b>
        <span className={`badge ${w.status === "published" ? "good" : "warn"}`}>{w.status}</span>
        {w.isActive && <span className="badge good">Active</span>}
        <span className="saver"><span className={`dot ${status === "saved" ? "saved" : status === "saving" ? "saving" : "dirty"}`} /> {saver}</span>
        <div className="spacer" />
        <button className="btn ghost" onClick={preview}>Preview</button>
        <button className="btn primary" onClick={saveNow} disabled={status === "saving"}>Save now</button>
      </div>

      <div className="hstack" style={{ gap: 6, margin: "16px 0", flexWrap: "wrap" }}>
        {TABS.map((t) => <button key={t} className={`btn ${tab === t ? "primary" : "ghost"}`} onClick={() => setTab(t)}>{t}</button>)}
      </div>

      <div className="panel"><div className="panel-body">
        {tab === "General" && <>
          <Field label="Title" value={w.title} onChange={(v) => setMeta("title", v)} />
          <div className="row2">
            <Field label="Subtitle" value={w.subtitle} onChange={(v) => setMeta("subtitle", v)} half />
            <Field label="Category" value={w.category} onChange={(v) => setMeta("category", v)} half />
          </div>
          <TextArea label="Description" value={w.description} onChange={(v) => setMeta("description", v)} />
          <Field label="Slug (URL)" value={w.slug} onChange={(v) => setMeta("slug", v)} desc="Auto-uniquified on save" half />
          {cF("Hero title", ["hero", "title"])}
          {cF("Hero subtitle", ["hero", "subtitle"])}
        </>}

        {tab === "Schedule" && <div className="row2">
          {cF("Date", ["workshop", "date"], { half: true })}
          {cF("Time", ["workshop", "time"], { half: true })}
          {cF("Duration", ["workshop", "duration"], { half: true })}
          {cF("Venue", ["workshop", "venue"], { half: true })}
          {cF("Mode (Online/Offline)", ["workshop", "mode"], { half: true })}
          {cF("Meeting link (Zoom/Meet)", ["workshop", "meetingLink"], { half: true })}
        </div>}

        {tab === "Registration" && <div className="row2">
          {cF("Price", ["workshop", "price"], { half: true })}
          {cF("Original price", ["workshop", "originalPrice"], { half: true })}
          {cF("Discount", ["workshop", "discount"], { half: true })}
          {cF("Seat limit", ["workshop", "seats"], { half: true, type: "number" })}
          {cF("Registration open (true/false)", ["registration", "open"], { half: true, desc: "Type true or false" })}
          {cF("Waiting list (true/false)", ["registration", "waitlist"], { half: true })}
          {cF("Registration closes at", ["registration", "closeAt"], { half: true, desc: "e.g. 28 June 2026" })}
        </div>}

        {tab === "Media" && <>
          {cM("Hero banner image", ["hero", "image"])}
          {cM("Trainer photo", ["trainer", "image"])}
          <GalleryEditor items={getPath(w.content, ["gallery"])} onChange={(v) => setC(["gallery"], v)} />
        </>}

        {tab === "SEO" && <>
          {cF("Meta title", ["seo", "title"])}
          {cTA("Meta description", ["seo", "description"])}
          {cM("OG image", ["seo", "ogImage"])}
        </>}

        {tab.startsWith("Advanced") && <div className="field" style={{ gridColumn: "1 / -1" }}>
          <div className="hstack" style={{ marginBottom: 8 }}>
            <div className="desc">Full workshop content — agenda/modules, faq, testimonials, bonus, certificates, sponsors…</div>
            <div className="spacer" />
            <button className="btn primary" onClick={applyJson}>Apply</button>
          </div>
          {jsonErr && <div className="auth-err">Invalid JSON: {jsonErr}</div>}
          <textarea className="mono" style={{ minHeight: 420 }} value={jsonText} onChange={(e) => setJsonText(e.target.value)} spellCheck={false} />
        </div>}
      </div></div>
    </Layout>
  );
}
