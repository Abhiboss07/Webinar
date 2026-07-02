import { useEffect, useState } from "react";
import Layout from "../components/Layout.jsx";
import PublishBar from "../components/PublishBar.jsx";
import { Panel, Field, TextArea } from "../components/ui.jsx";
import { useDraft, getPath } from "../lib/draft.jsx";

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
            {F("Logo path", ["brand", "logo"], { half: true, desc: "e.g. assets/logo.png (Media manager comes in Module 2.3)" })}
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
            Reorder / show / hide sections on the <b>Homepage Sections</b> page. Dedicated editors for
            <b> Trainers, Modules, FAQ, Testimonials</b> (add / edit / delete) arrive next — until then, edit those
            arrays in the <b>Advanced (JSON)</b> tab.
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
