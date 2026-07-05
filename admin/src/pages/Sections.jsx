import { useState } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout.jsx";
import PublishBar from "../components/PublishBar.jsx";
import { useDraft } from "../lib/draft.jsx";

// Friendly labels — must mirror backend/config/sections.js keys.
const LABELS = {
  hero: "Hero", testimonials: "Success Stories / Testimonials", problem: "Problem (“If You Are…”)",
  modules: "What You'll Learn (Curriculum)", whyDifferent: "Why This Workshop Is Different",
  audience: "Who Should Attend", choice: "Your Choice Today", trainer: "Meet Your Trainer",
  bonus: "Benefits / Bonus Offers", guarantee: "Guarantee", faq: "FAQ", finalCta: "Final CTA",
};

export default function Sections() {
  const { config, setConfig } = useDraft();
  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);

  if (!config) return <Layout title="Homepage Sections"><div className="notice">Loading…</div></Layout>;

  const sections = Array.isArray(config.sections) ? config.sections : [];
  const enabledCount = sections.filter((s) => s.enabled !== false).length;

  const commit = (next) => setConfig({ ...config, sections: next });

  const toggle = (i) => {
    const next = sections.map((s, idx) => (idx === i ? { ...s, enabled: s.enabled === false } : s));
    commit(next);
  };

  const move = (from, to) => {
    if (from == null || to == null || from === to) return;
    const next = sections.slice();
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    commit(next);
  };

  const onDrop = () => { move(dragIdx, overIdx); setDragIdx(null); setOverIdx(null); };
  const footerEnabled = !(config.footer && config.footer.enabled === false);
  const setFooter = (on) => setConfig({ ...config, footer: { ...(config.footer || {}), enabled: on } });

  return (
    <Layout title="Homepage Sections">
      <PublishBar />

      <div className="notice" style={{ marginTop: 16 }}>
        Drag to reorder, toggle to show/hide. Changes save to a <b>draft</b> — click <b>Preview</b> to see
        them, then <b>Publish</b> to make them live. <b>{enabledCount}</b> of {sections.length} sections enabled.
        {enabledCount === 0 && <div style={{ color: "var(--bad)", marginTop: 6 }}>⚠ All sections are hidden — your homepage body will be empty.</div>}
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <div className="panel-head"><div><h3>Header</h3><p>Always visible · fixed at top</p></div><span className="badge good">On</span></div>
      </div>

      <div className="section-list">
        {sections.map((s, i) => {
          const hasContent = !!config[s.key];
          const on = s.enabled !== false;
          return (
            <div
              key={s.key}
              className={`sec-row ${dragIdx === i ? "dragging" : ""} ${overIdx === i && dragIdx !== i ? "over" : ""} ${on ? "" : "off"}`}
              draggable
              onDragStart={() => setDragIdx(i)}
              onDragOver={(e) => { e.preventDefault(); setOverIdx(i); }}
              onDrop={onDrop}
              onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
            >
              <span className="drag-handle" title="Drag to reorder">⠿</span>
              <span className="sec-num">{i + 1}</span>
              <div className="sec-main">
                <div className="sec-label">{LABELS[s.key] || s.key}</div>
                <div className="sec-key">
                  <span className="mono">{s.key}</span>
                  {!hasContent && <span className="badge bad" style={{ marginLeft: 8 }}>no content</span>}
                </div>
              </div>
              <Link to="/content" className="btn ghost" style={{ padding: "6px 11px" }}>Edit content →</Link>
              <button
                className={`switch ${on ? "on" : ""}`}
                role="switch" aria-checked={on} aria-label={`Toggle ${LABELS[s.key] || s.key}`}
                onClick={() => toggle(i)}
              ><span className="knob" /></button>
            </div>
          );
        })}
      </div>

      <div className="panel" style={{ marginTop: 4 }}>
        <div className="panel-head">
          <div><h3>Footer</h3><p>Contact, links & copyright · always rendered last</p></div>
          <button className={`switch ${footerEnabled ? "on" : ""}`} role="switch" aria-checked={footerEnabled}
            aria-label="Toggle footer" onClick={() => setFooter(!footerEnabled)}><span className="knob" /></button>
        </div>
      </div>
    </Layout>
  );
}
