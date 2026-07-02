import { useEffect, useRef, useState, useCallback } from "react";
import Layout from "../components/Layout.jsx";
import { Panel, Field, TextArea, useToast } from "../components/ui.jsx";
import { api } from "../lib/api.js";

/* Immutable nested set: setPath(obj, ["workshop","price"], "₹149"). */
function setPath(obj, path, value) {
  if (!path.length) return value;
  const [head, ...rest] = path;
  const base = obj && typeof obj === "object" ? obj : {};
  return { ...base, [head]: setPath(base[head], rest, value) };
}
const get = (obj, path) => path.reduce((o, k) => (o == null ? o : o[k]), obj);

export default function Content() {
  const toast = useToast();
  const [cfg, setCfg] = useState(null);
  const [tab, setTab] = useState("guided");
  const [status, setStatus] = useState("saved"); // saved | dirty | saving | error
  const [jsonText, setJsonText] = useState("");
  const [jsonErr, setJsonErr] = useState("");
  const latest = useRef(null);
  const timer = useRef(null);

  useEffect(() => {
    api.getConfig().then((r) => { setCfg(r.data || {}); latest.current = r.data || {}; })
      .catch((e) => toast(e.message, "error"));
  }, [toast]);

  const persist = useCallback(async () => {
    setStatus("saving");
    try { await api.saveConfig(latest.current); setStatus("saved"); }
    catch (e) { setStatus("error"); toast(e.message || "Save failed", "error"); }
  }, [toast]);

  // Debounced autosave whenever cfg changes via the guided editor.
  const update = useCallback((path, value) => {
    setCfg((prev) => {
      const next = setPath(prev, path, value);
      latest.current = next;
      return next;
    });
    setStatus("dirty");
    clearTimeout(timer.current);
    timer.current = setTimeout(persist, 900);
  }, [persist]);

  const saveNow = () => { clearTimeout(timer.current); persist(); };

  // Keep the JSON tab in sync when opened.
  useEffect(() => {
    if (tab === "json" && cfg) { setJsonText(JSON.stringify(cfg, null, 2)); setJsonErr(""); }
  }, [tab]); // eslint-disable-line

  const applyJson = () => {
    try {
      const parsed = JSON.parse(jsonText);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Top level must be an object");
      setCfg(parsed); latest.current = parsed; setJsonErr("");
      saveNow();
      toast("Saved from JSON", "success");
    } catch (e) { setJsonErr(e.message); }
  };

  if (!cfg) return <Layout title="Content Editor"><div className="notice">Loading content…</div></Layout>;

  const F = (label, path, opts = {}) => (
    <Field label={label} value={get(cfg, path)} onChange={(v) => update(path, v)} {...opts} />
  );
  const TA = (label, path, opts = {}) => (
    <TextArea label={label} value={get(cfg, path)} onChange={(v) => update(path, v)} {...opts} />
  );

  const saver = {
    saved: <span className="saver"><span className="dot saved" /> All changes saved</span>,
    dirty: <span className="saver"><span className="dot dirty" /> Unsaved changes…</span>,
    saving: <span className="saver"><span className="dot saving" /> Saving…</span>,
    error: <span className="saver"><span className="dot" style={{ background: "var(--bad)" }} /> Save failed</span>,
  }[status];

  return (
    <Layout title="Content Editor">
      <div className="hstack" style={{ marginBottom: 18 }}>
        <div className="hstack" style={{ gap: 6, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 4 }}>
          <button className={`btn ${tab === "guided" ? "primary" : "ghost"}`} onClick={() => setTab("guided")}>Guided</button>
          <button className={`btn ${tab === "json" ? "primary" : "ghost"}`} onClick={() => setTab("json")}>Advanced (JSON)</button>
        </div>
        <div className="spacer" />
        {saver}
        <button className="btn primary" onClick={saveNow} disabled={status === "saving"}>Save now</button>
      </div>

      {tab === "guided" ? (
        <>
          <Panel title="Brand" subtitle="Shown in the navbar and footer">
            {F("Brand name", ["brand", "name"], { half: true })}
            {F("Logo path", ["brand", "logo"], { half: true, desc: "e.g. assets/logo.png (Media manager comes in Phase 2)" })}
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
            {F("Hero image", ["hero", "image"], { half: true })}
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
              {F("OG image", ["seo", "ogImage"], { half: true })}
              {F("Canonical URL", ["seo", "canonical"], { half: true })}
            </div>
          </Panel>

          <div className="notice">
            Dedicated editors for <b>Trainers, Modules, FAQ, Testimonials, Benefits, Features</b> (add / edit / delete /
            drag-reorder) arrive in Phase 2. Until then, edit those arrays in the <b>Advanced (JSON)</b> tab — every value is fully editable today.
          </div>
        </>
      ) : (
        <Panel title="Full content (JSON)" subtitle="Edit any value — including arrays like modules, faq, testimonials"
          right={<button className="btn primary" onClick={applyJson}>Validate &amp; save</button>}>
          {jsonErr && <div className="auth-err">Invalid JSON: {jsonErr}</div>}
          <textarea className="mono" style={{ minHeight: 460 }} value={jsonText}
            onChange={(e) => setJsonText(e.target.value)} spellCheck={false} />
        </Panel>
      )}
    </Layout>
  );
}
