import { useEffect, useState } from "react";
import Layout from "../components/Layout.jsx";
import PublishBar from "../components/PublishBar.jsx";
import { Panel, Field, TextArea } from "../components/ui.jsx";
import { MediaField } from "../components/MediaPicker.jsx";
import { useDraft, getPath } from "../lib/draft.jsx";

/* Repeatable-item editor: reorder (↑/↓ = display order), enable/disable
   without deleting, remove, add. `render(item, set)` draws one item's fields. */
function ListEditor({ items, onChange, render, blank, addLabel }) {
  const list = Array.isArray(items) ? items : [];
  const set = (i, patch) => onChange(list.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const move = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    const n = [...list]; [n[i], n[j]] = [n[j], n[i]]; onChange(n);
  };
  return (
    <div className="field" style={{ gridColumn: "1 / -1" }}>
      {list.map((item, i) => (
        <div key={i} className="card" style={{ padding: 14, marginBottom: 10, opacity: item.enabled === false ? 0.55 : 1 }}>
          <div className="hstack" style={{ marginBottom: 8, gap: 6 }}>
            <span className="muted" style={{ fontSize: 12.5 }}>#{i + 1}</span>
            <div className="spacer" />
            <button className="btn ghost" style={{ padding: "3px 9px" }} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
            <button className="btn ghost" style={{ padding: "3px 9px" }} disabled={i === list.length - 1} onClick={() => move(i, 1)}>↓</button>
            <button className={`btn ghost`} style={{ padding: "3px 9px" }}
              onClick={() => set(i, { enabled: item.enabled === false })}>
              {item.enabled === false ? "Hidden — click to show" : "Visible — click to hide"}
            </button>
            <button className="btn ghost" style={{ padding: "3px 9px", color: "var(--bad)" }}
              onClick={() => { if (window.confirm("Remove this item?")) onChange(list.filter((_, idx) => idx !== i)); }}>✕</button>
          </div>
          <div className="row2">{render(item, (patch) => set(i, patch))}</div>
        </div>
      ))}
      <button className="btn ghost" onClick={() => onChange([...list, { ...blank }])}>+ {addLabel}</button>
    </div>
  );
}

export default function Content() {
  const { config, update, setConfig } = useDraft();
  const [tab, setTab] = useState("guided");
  const [jsonText, setJsonText] = useState("");
  const [jsonErr, setJsonErr] = useState("");

  useEffect(() => {
    if (tab === "json" && config) { setJsonText(JSON.stringify(config, null, 2)); setJsonErr(""); }
  }, [tab]); // eslint-disable-line

  if (!config) return <Layout title="Content Editor"><div className="notice">Loading content…</div></Layout>;

  const applyJson = () => {
    try {
      const parsed = JSON.parse(jsonText);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Top level must be an object");
      setConfig(parsed); setJsonErr("");
    } catch (e) { setJsonErr(e.message); }
  };

  const F = (label, path, opts = {}) => (
    <Field label={label} value={getPath(config, path)} onChange={(v) => update(path, v)} {...opts} />
  );
  const TA = (label, path, opts = {}) => (
    <TextArea label={label} value={getPath(config, path)} onChange={(v) => update(path, v)} {...opts} />
  );
  const M = (label, path, opts = {}) => (
    <MediaField label={label} value={getPath(config, path)} onChange={(v) => update(path, v)} {...opts} />
  );

  return (
    <Layout title="Content Editor">
      <PublishBar />

      <div className="hstack" style={{ margin: "18px 0" }}>
        <div className="hstack" style={{ gap: 6, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 4 }}>
          <button className={`btn ${tab === "guided" ? "primary" : "ghost"}`} onClick={() => setTab("guided")}>Guided</button>
          <button className={`btn ${tab === "json" ? "primary" : "ghost"}`} onClick={() => setTab("json")}>Advanced (JSON)</button>
        </div>
      </div>

      {tab === "guided" ? (
        <>
          <Panel title="Brand" subtitle="Shown in the navbar and footer">
            {F("Brand name", ["brand", "name"], { half: true })}
            {M("Logo", ["brand", "logo"], { half: true, desc: "Pick from the Media Library or paste a path" })}
          </Panel>

          <Panel title="Workshop facts" subtitle="Change once — these propagate everywhere via {{tokens}}">
            <div className="row2">
              {F("Workshop name", ["workshop", "name"], { half: true })}
              {F("Date", ["workshop", "date"], { half: true })}
              {F("Time", ["workshop", "time"], { half: true })}
              {F("Venue / Mode", ["workshop", "venue"], { half: true })}
              {F("Price", ["workshop", "price"], { half: true })}
              {F("Original price", ["workshop", "originalPrice"], { half: true })}
              {F("Bonus stack value", ["workshop", "bonusValue"], { half: true })}
              {F("Map URL", ["workshop", "mapUrl"], { half: true })}
            </div>
          </Panel>

          <Panel title="Hero section" subtitle="The first thing visitors see">
            {F("Attention label", ["hero", "attentionLabel"])}
            {F("Title", ["hero", "title"])}
            {F("Subtitle", ["hero", "subtitle"])}
            {TA("Description", ["hero", "description"])}
            {F("Primary button text", ["hero", "primaryCta"], { half: true })}
            {M("Hero image", ["hero", "image"], { half: true })}
          </Panel>

          <Panel title="Success Stories" subtitle="Photo cards and written reviews — reorder with ↑↓, hide without deleting">
            {F("Section label", ["testimonials", "label"], { half: true })}
            {F("Heading", ["testimonials", "heading"], { half: true })}
            <div className="field" style={{ gridColumn: "1 / -1" }}><label>Photo cards</label></div>
            <ListEditor
              items={getPath(config, ["testimonials", "videos"])}
              onChange={(v) => update(["testimonials", "videos"], v)}
              blank={{ thumb: "", name: "", designation: "", enabled: true }}
              addLabel="Add photo card"
              render={(item, set) => (<>
                <MediaField label="Image" value={item.thumb} onChange={(v) => set({ thumb: v })} half desc="Pick from the Media Library or upload" />
                <Field label="Name" value={item.name} onChange={(v) => set({ name: v })} half />
                <Field label="Designation" value={item.designation} onChange={(v) => set({ designation: v })} half desc="e.g. Staff Nurse" />
              </>)}
            />
            <div className="field" style={{ gridColumn: "1 / -1" }}><label>Written reviews</label></div>
            <ListEditor
              items={getPath(config, ["testimonials", "reviews"])}
              onChange={(v) => update(["testimonials", "reviews"], v)}
              blank={{ name: "", role: "", quote: "", rating: 5, enabled: true }}
              addLabel="Add review"
              render={(item, set) => (<>
                <Field label="Name" value={item.name} onChange={(v) => set({ name: v })} half />
                <Field label="Designation / role" value={item.role} onChange={(v) => set({ role: v })} half />
                <TextArea label="Review text" value={item.quote} onChange={(v) => set({ quote: v })} rows={2} />
                <div className="field" style={{ gridColumn: "auto" }}><label>Rating</label>
                  <select value={item.rating || 5} onChange={(e) => set({ rating: Number(e.target.value) })}>
                    {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{"★".repeat(n)}</option>)}
                  </select>
                </div>
              </>)}
            />
          </Panel>

          <Panel title="Registration &amp; contact" subtitle="Pricing, WhatsApp and contact details">
            <div className="row2">
              {F("Public Razorpay Key ID", ["payment", "keyId"], { half: true, desc: "Public key only — the secret lives on the server" })}
              {F("Amount (paise)", ["payment", "amount"], { half: true, type: "number", desc: "e.g. 9900 = ₹99.00" })}
              {F("WhatsApp number", ["integrations", "whatsappNumber"], { half: true, desc: "No + sign, e.g. 919310032619" })}
              {F("Contact email", ["footer", "contact", "email"], { half: true })}
              {F("Contact phone", ["footer", "contact", "phone"], { half: true })}
            </div>
          </Panel>

          <Panel title="SEO" subtitle="Search & social preview">
            {F("Meta title", ["seo", "title"])}
            {TA("Meta description", ["seo", "description"])}
            {F("Keywords", ["seo", "keywords"])}
            <div className="row2">
              {M("OG image", ["seo", "ogImage"], { half: true })}
              {F("Canonical URL", ["seo", "canonical"], { half: true })}
            </div>
          </Panel>

          <div className="notice">
            Reorder / show / hide sections on the <b>Homepage Sections</b> page. Success Stories are edited above;
            the remaining arrays (<b>Trainers, Modules, FAQ</b>) are edited in the <b>Advanced (JSON)</b> tab.
          </div>
        </>
      ) : (
        <Panel title="Full content (JSON)" subtitle="Edit any value — including arrays like modules, faq, testimonials"
          right={<button className="btn primary" onClick={applyJson}>Apply to draft</button>}>
          {jsonErr && <div className="auth-err">Invalid JSON: {jsonErr}</div>}
          <textarea className="mono" style={{ minHeight: 460 }} value={jsonText}
            onChange={(e) => setJsonText(e.target.value)} spellCheck={false} />
        </Panel>
      )}
    </Layout>
  );
}
