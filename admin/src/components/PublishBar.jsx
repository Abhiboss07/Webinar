import { useState } from "react";
import { useDraft } from "../lib/draft.jsx";
import { useToast } from "./ui.jsx";
import { api } from "../lib/api.js";

const PUBLIC_SITE = (import.meta.env.VITE_PUBLIC_SITE_URL || "").replace(/\/$/, "");

const SAVER = {
  saved: ["saved", "All changes saved to draft"],
  dirty: ["dirty", "Unsaved changes…"],
  saving: ["saving", "Saving…"],
  error: ["", "Save failed — retrying on next edit"],
};

function timeAgo(d) {
  if (!d) return "never";
  const s = Math.floor((Date.now() - new Date(d)) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(d).toLocaleDateString();
}

export default function PublishBar() {
  const { status, hasDraft, meta, publish, discard, revert, saveNow } = useDraft();
  const toast = useToast();
  const [busy, setBusy] = useState("");
  const [showHist, setShowHist] = useState(false);
  const [hist, setHist] = useState(null);

  const [dotCls, label] = SAVER[status] || SAVER.saved;

  const doPublish = async () => {
    setBusy("publish");
    try { await publish(); toast("Published — the live site is updated", "success"); }
    catch (e) { toast(e.message || "Publish failed", "error"); }
    finally { setBusy(""); }
  };

  const doDiscard = async () => {
    if (!window.confirm("Discard all unpublished changes and revert the editor to the live version?")) return;
    setBusy("discard");
    try { await discard(); toast("Draft discarded", "info"); }
    catch (e) { toast(e.message || "Could not discard", "error"); }
    finally { setBusy(""); }
  };

  const preview = async () => {
    if (!PUBLIC_SITE) { toast("Set VITE_PUBLIC_SITE_URL in admin/.env to enable Preview", "error"); return; }
    await saveNow();
    window.open(`${PUBLIC_SITE}/?preview=1`, "_blank", "noopener");
  };

  const openHistory = async () => {
    setShowHist((v) => !v);
    if (!hist) {
      try { const r = await api.history(); setHist(r.history || []); }
      catch (e) { toast(e.message, "error"); }
    }
  };

  const doRevert = async (version) => {
    if (!window.confirm(`Restore version ${version}? This publishes that version to the live site (the current version is snapshotted first).`)) return;
    setBusy("revert");
    try { await revert(version); setHist(null); setShowHist(false); toast(`Restored version ${version}`, "success"); }
    catch (e) { toast(e.message || "Could not restore", "error"); }
    finally { setBusy(""); }
  };

  return (
    <div className="publish-bar">
      <span className="saver"><span className={`dot ${dotCls}`} /> {label}</span>
      <span className="muted" style={{ fontSize: 12.5 }}>· Live version {meta.version ?? "—"} · published {timeAgo(meta.publishedAt)}</span>
      <div className="spacer" />

      <div style={{ position: "relative" }}>
        <button className="btn ghost" onClick={openHistory}>Version history</button>
        {showHist && (
          <div className="hist-pop">
            <div className="hist-title">Previously published</div>
            {hist == null ? <div className="muted" style={{ padding: 8, fontSize: 13 }}>Loading…</div> :
              hist.length === 0 ? <div className="muted" style={{ padding: 8, fontSize: 13 }}>No previous versions yet.</div> :
                hist.map((h) => (
                  <div className="hist-row" key={h.version}>
                    <div>v{h.version} <span className="muted" style={{ fontSize: 12 }}>· {new Date(h.publishedAt).toLocaleString()}</span></div>
                    <button className="btn ghost" style={{ padding: "4px 9px" }} disabled={busy === "revert"} onClick={() => doRevert(h.version)}>Restore</button>
                  </div>
                ))}
          </div>
        )}
      </div>

      <button className="btn ghost" onClick={preview}>Preview</button>
      <button className="btn ghost" onClick={doDiscard} disabled={!hasDraft || !!busy}>Discard</button>
      <button className="btn primary" onClick={doPublish} disabled={!hasDraft || !!busy}>
        {busy === "publish" ? <span className="spin" /> : hasDraft ? "Publish" : "Published"}
      </button>
    </div>
  );
}
