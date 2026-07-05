import { useEffect, useRef, useState, useCallback } from "react";
import { api, uploadMedia, replaceMedia } from "../lib/api.js";
import { useToast } from "./ui.jsx";
import { formatBytes, optimizeImage, TYPE_ICONS } from "../lib/media.js";

const TYPES = [["", "All"], ["image", "Images"], ["video", "Videos"], ["raw", "Docs / PDF"]];

function Thumb({ m, size = 88 }) {
  const s = { width: size, height: size };
  if (m.resourceType === "image") return <img className="thumb-img" style={s} src={m.thumbUrl || m.secureUrl} alt={m.altText || m.originalFilename} loading="lazy" />;
  if (m.resourceType === "video") return <div className="thumb-ph" style={s}>🎬</div>;
  return <div className="thumb-ph" style={s}>📄</div>;
}

/* Detail / edit modal for a single asset. */
function AssetModal({ id, onClose, onChanged }) {
  const toast = useToast();
  const [m, setM] = useState(null);
  const [alt, setAlt] = useState("");
  const [folder, setFolder] = useState("");
  const [tags, setTags] = useState("");
  const [prog, setProg] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    api.mediaGet(id).then((r) => { setM(r.media); setAlt(r.media.altText || ""); setFolder(r.media.folder || ""); setTags((r.media.tags || []).join(", ")); }).catch((e) => toast(e.message, "error"));
  }, [id, toast]);

  if (!m) return <div className="modal-backdrop" onClick={onClose}><div className="modal" onClick={(e) => e.stopPropagation()}><div className="notice">Loading…</div></div></div>;

  const save = async () => {
    try { const r = await api.mediaPatch(id, { altText: alt, folder, tags }); setM(r.media); toast("Saved", "success"); onChanged && onChanged(); }
    catch (e) { toast(e.message, "error"); }
  };
  const copy = () => { navigator.clipboard.writeText(m.secureUrl); toast("URL copied", "success"); };
  const doReplace = async (file) => {
    try { setProg(0); const opt = await optimizeImage(file); const r = await replaceMedia(id, opt, setProg); setProg(null); setM(r.media); toast(`Replaced — updated ${r.replaced} reference(s) on the site`, "success"); onChanged && onChanged(); }
    catch (e) { setProg(null); toast(e.message, "error"); }
  };
  const del = async () => {
    try {
      await api.mediaDelete(id); toast("Deleted", "info"); onChanged && onChanged(); onClose();
    } catch (e) {
      if (/used in/i.test(e.message) && window.confirm(e.message + "\n\nDelete anyway?")) {
        try { await api.mediaDelete(id, true); toast("Deleted", "info"); onChanged && onChanged(); onClose(); }
        catch (e2) { toast(e2.message, "error"); }
      } else { toast(e.message, "error"); }
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><h3>Asset details</h3><button className="btn ghost icon" onClick={onClose}>✕</button></div>
        <div className="asset-detail">
          <div className="asset-preview">
            {m.resourceType === "image" ? <img src={m.secureUrl} alt={m.altText} /> :
              m.resourceType === "video" ? <video src={m.secureUrl} controls /> :
                <a className="btn ghost" href={m.secureUrl} target="_blank" rel="noopener">Open file ↗</a>}
          </div>
          <div className="asset-meta">
            <div className="kv"><span>Type</span><b>{TYPE_ICONS[m.resourceType]} {m.resourceType} · {m.format?.toUpperCase()}</b></div>
            <div className="kv"><span>Size</span><b>{formatBytes(m.bytes)}</b></div>
            {m.width ? <div className="kv"><span>Dimensions</span><b>{m.width}×{m.height}</b></div> : null}
            <div className="kv"><span>Used in</span><b>{m.usageCount ?? 0} place(s)</b></div>
            <div className="field" style={{ marginTop: 8 }}><label>Alt text</label><input className="input" value={alt} onChange={(e) => setAlt(e.target.value)} placeholder="Describe the image (SEO + accessibility)" /></div>
            <div className="row2">
              <div className="field"><label>Folder</label><input className="input" value={folder} onChange={(e) => setFolder(e.target.value)} /></div>
              <div className="field"><label>Tags</label><input className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="comma,separated" /></div>
            </div>
            <div className="field"><label>URL</label><div className="hstack"><input className="input mono" readOnly value={m.secureUrl} /><button className="btn ghost" onClick={copy}>Copy</button></div></div>
            {prog != null && <div className="prog"><div className="prog-fill" style={{ width: `${prog}%` }} /></div>}
            <div className="hstack" style={{ marginTop: 12 }}>
              <button className="btn primary" onClick={save}>Save</button>
              <button className="btn ghost" onClick={() => fileRef.current.click()}>Replace file</button>
              <div className="spacer" />
              <button className="btn ghost" style={{ color: "var(--bad)" }} onClick={del}>Delete</button>
              <input ref={fileRef} type="file" hidden onChange={(e) => e.target.files[0] && doReplace(e.target.files[0])} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MediaLibrary({ mode = "manage", accept = "", onPick }) {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [q, setQ] = useState("");
  const [type, setType] = useState(accept === "image" ? "image" : "");
  const [folder, setFolder] = useState("");
  const [page, setPage] = useState(1);
  const [uploads, setUploads] = useState([]);   // in-flight: {name, pct, error}
  const [openId, setOpenId] = useState(null);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef(null);

  const load = useCallback(() => {
    api.mediaList({ q, type, folder, page }).then(setData).catch((e) => toast(e.message, "error"));
  }, [q, type, folder, page, toast]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList);
    for (const file of files) {
      const key = Math.random().toString(36).slice(2);
      setUploads((u) => [...u, { key, name: file.name, pct: 0 }]);
      try {
        const opt = await optimizeImage(file);
        const r = await uploadMedia(opt, { folder: folder || "general" }, (pct) => setUploads((u) => u.map((x) => x.key === key ? { ...x, pct } : x)));
        toast(r.duplicate ? `“${file.name}” already exists — reused it` : `Uploaded “${file.name}”`, r.duplicate ? "info" : "success");
      } catch (e) {
        toast(`${file.name}: ${e.message}`, "error");
      } finally {
        setUploads((u) => u.filter((x) => x.key !== key));
      }
    }
    setPage(1); load();
  };

  const onDrop = (e) => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files); };
  const copy = (url) => { navigator.clipboard.writeText(url); toast("URL copied", "success"); };

  const items = data?.items || [];

  return (
    <div>
      <div className="media-toolbar">
        <input className="input" style={{ maxWidth: 240 }} placeholder="Search name, alt, tags…" value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} />
        <select value={type} onChange={(e) => { setPage(1); setType(e.target.value); }} style={{ maxWidth: 150 }} disabled={accept === "image"}>
          {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={folder} onChange={(e) => { setPage(1); setFolder(e.target.value); }} style={{ maxWidth: 160 }}>
          <option value="">All folders</option>
          {(data?.folders || []).map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <div className="spacer" />
        <span className="muted" style={{ fontSize: 12.5 }}>{data ? `${data.total} asset(s) · ${data.provider}` : ""}</span>
        <button className="btn primary" onClick={() => fileRef.current.click()}>Upload</button>
        <input ref={fileRef} type="file" hidden multiple accept={accept === "image" ? "image/*" : undefined} onChange={(e) => e.target.files.length && handleFiles(e.target.files)} />
      </div>

      <div className={`dropzone ${drag ? "over" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)} onDrop={onDrop} onClick={() => fileRef.current.click()}>
        <div className="dz-ico">⬆</div>
        <div><b>Drag &amp; drop</b> files here, or click to browse — images auto-optimise before upload</div>
      </div>

      {uploads.length > 0 && (
        <div className="upload-list">
          {uploads.map((u) => (
            <div className="upload-row" key={u.key}>
              <span className="muted" style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name}</span>
              <div className="prog"><div className="prog-fill" style={{ width: `${u.pct}%` }} /></div>
              <span className="mono" style={{ fontSize: 12 }}>{u.pct}%</span>
            </div>
          ))}
        </div>
      )}

      {!data ? <div className="notice" style={{ marginTop: 16 }}>Loading library…</div> :
        items.length === 0 ? (
          <div className="empty" style={{ marginTop: 16 }}><div className="em-ico">🖼</div><div className="em-title">No assets yet</div><div style={{ fontSize: 13 }}>Upload images, videos or PDFs to get started.</div></div>
        ) : (
          <div className="media-grid">
            {items.map((m) => (
              <div className="media-card" key={m._id}>
                <div className="media-thumb" onClick={() => setOpenId(m._id)} title="View details">
                  <Thumb m={m} />
                  {m.usageCount > 0 && <span className="usage-badge" title={`Used in ${m.usageCount} place(s)`}>{m.usageCount}×</span>}
                </div>
                <div className="media-name" title={m.originalFilename}>{m.originalFilename}</div>
                <div className="media-sub">{TYPE_ICONS[m.resourceType]} {m.width ? `${m.width}×${m.height} · ` : ""}{formatBytes(m.bytes)}</div>
                <div className="media-actions">
                  {mode === "pick"
                    ? <button className="btn primary" style={{ padding: "5px 10px", width: "100%" }} onClick={() => onPick(m)}>Select</button>
                    : <>
                      <button className="btn ghost" style={{ padding: "5px 9px" }} onClick={() => copy(m.secureUrl)}>Copy URL</button>
                      <button className="btn ghost" style={{ padding: "5px 9px" }} onClick={() => setOpenId(m._id)}>Edit</button>
                    </>}
                </div>
              </div>
            ))}
          </div>
        )}

      {data && data.pages > 1 && (
        <div className="pager">
          <button className="btn ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Prev</button>
          <span className="muted">Page {page} of {data.pages}</span>
          <button className="btn ghost" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>Next →</button>
        </div>
      )}

      {openId && <AssetModal id={openId} onClose={() => setOpenId(null)} onChanged={load} />}
    </div>
  );
}
