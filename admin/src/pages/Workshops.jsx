import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout.jsx";
import { useToast } from "../components/ui.jsx";
import { api } from "../lib/api.js";

const PUBLIC_SITE = (import.meta.env.VITE_PUBLIC_SITE_URL || "").replace(/\/$/, "");
const FILTERS = [["", "All"], ["draft", "Draft"], ["published", "Published"], ["archived", "Archived"]];

function StatusBadge({ w }) {
  if (w.status === "published") return <span className={`badge ${w.live ? "good" : "warn"}`}>{w.live ? "Published" : "Scheduled"}</span>;
  if (w.status === "archived") return <span className="badge" style={{ background: "var(--surface-2)", color: "var(--text-faint)" }}>Archived</span>;
  return <span className="badge warn">Draft</span>;
}

export default function Workshops() {
  const toast = useToast();
  const nav = useNavigate();
  const [list, setList] = useState(null);
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(() => {
    api.workshops(filter).then((r) => setList(r.workshops)).catch((e) => toast(e.message, "error"));
  }, [filter, toast]);
  useEffect(() => { load(); }, [load]);

  const act = async (fn, id, okMsg) => {
    setBusy(id);
    try { await fn(); if (okMsg) toast(okMsg, "success"); load(); }
    catch (e) { toast(e.message, "error"); }
    finally { setBusy(""); }
  };

  const create = async () => {
    const title = window.prompt("New workshop title:", "New Workshop");
    if (!title) return;
    try { const r = await api.workshopCreate({ title }); toast("Workshop created", "success"); nav(`/workshops/${r.workshop._id}`); }
    catch (e) { toast(e.message, "error"); }
  };

  const del = (w) => {
    if (!window.confirm(`Delete “${w.title}”? This cannot be undone.`)) return;
    act(() => api.workshopDelete(w.id), w.id, "Deleted");
  };
  const preview = (w) => {
    if (!PUBLIC_SITE) return toast("Set VITE_PUBLIC_SITE_URL to enable Preview", "error");
    window.open(`${PUBLIC_SITE}/?preview=1&workshop=${encodeURIComponent(w.slug)}`, "_blank", "noopener");
  };

  return (
    <Layout title="Workshops">
      <div className="hstack" style={{ marginBottom: 16 }}>
        <div className="hstack" style={{ gap: 6, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 4 }}>
          {FILTERS.map(([v, l]) => <button key={v} className={`btn ${filter === v ? "primary" : "ghost"}`} style={{ padding: "6px 11px" }} onClick={() => setFilter(v)}>{l}</button>)}
        </div>
        <div className="spacer" />
        <button className="btn primary" onClick={create}>+ New workshop</button>
      </div>

      {!list ? <div className="notice">Loading…</div> :
        list.length === 0 ? <div className="empty"><div className="em-ico">🎓</div><div className="em-title">No workshops</div><div style={{ fontSize: 13 }}>Create one, or clone your active workshop for the next batch.</div></div> :
          <div className="grid" style={{ gap: 12 }}>
            {list.map((w) => (
              <div className="card" key={w.id} style={{ padding: 16 }}>
                <div className="hstack" style={{ alignItems: "flex-start" }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="hstack" style={{ gap: 8 }}>
                      <h3 style={{ fontSize: 16 }}>{w.title}</h3>
                      <StatusBadge w={w} />
                      {w.isActive && <span className="badge good">● Active (live)</span>}
                    </div>
                    <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
                      <span className="mono">/{w.slug}</span>
                      {w.date ? ` · ${w.date}` : ""}{w.venue ? ` · ${w.venue}` : ""}{w.price ? ` · ${w.price}` : ""}
                      {w.status === "published" && !w.live && w.scheduledFor ? ` · goes live ${new Date(w.scheduledFor).toLocaleString()}` : ""}
                    </div>
                  </div>
                  <div className="spacer" />
                </div>

                <div className="hstack" style={{ gap: 6, marginTop: 12, flexWrap: "wrap" }}>
                  <button className="btn primary" style={{ padding: "6px 11px" }} onClick={() => nav(`/workshops/${w.id}`)}>Edit</button>
                  <button className="btn ghost" style={{ padding: "6px 11px" }} onClick={() => preview(w)}>Preview</button>
                  {w.status !== "published"
                    ? <button className="btn ghost" style={{ padding: "6px 11px" }} disabled={busy === w.id} onClick={() => act(() => api.workshopStatus(w.id, "published"), w.id, "Published")}>Publish</button>
                    : <button className="btn ghost" style={{ padding: "6px 11px" }} disabled={busy === w.id} onClick={() => act(() => api.workshopStatus(w.id, "draft"), w.id, "Unpublished")}>Unpublish</button>}
                  {w.status === "published" && !w.isActive &&
                    <button className="btn ghost" style={{ padding: "6px 11px" }} disabled={busy === w.id} onClick={() => act(() => api.workshopActivate(w.id), w.id, "Now the active workshop")}>Set active</button>}
                  <button className="btn ghost" style={{ padding: "6px 11px" }} disabled={busy === w.id} onClick={() => act(() => api.workshopDuplicate(w.id), w.id, "Duplicated")}>Duplicate</button>
                  {w.status !== "archived"
                    ? <button className="btn ghost" style={{ padding: "6px 11px" }} disabled={busy === w.id} onClick={() => act(() => api.workshopStatus(w.id, "archived"), w.id, "Archived")}>Archive</button>
                    : <button className="btn ghost" style={{ padding: "6px 11px" }} disabled={busy === w.id} onClick={() => act(() => api.workshopStatus(w.id, "draft"), w.id, "Restored")}>Restore</button>}
                  <div className="spacer" />
                  <button className="btn ghost" style={{ padding: "6px 11px", color: "var(--bad)" }} onClick={() => del(w)}>Delete</button>
                </div>
              </div>
            ))}
          </div>}
    </Layout>
  );
}
