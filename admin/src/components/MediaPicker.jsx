import { useState } from "react";
import MediaLibrary from "./MediaLibrary.jsx";

/* Modal that hosts the library in "pick" mode. */
export function PickerModal({ accept, onPick, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-xl" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><h3>Choose from Media Library</h3><button className="btn ghost icon" onClick={onClose}>✕</button></div>
        <div style={{ padding: "4px 2px" }}>
          <MediaLibrary mode="pick" accept={accept} onPick={(m) => { onPick(m); onClose(); }} />
        </div>
      </div>
    </div>
  );
}

/* A CMS content field bound to a media URL: preview + "Library" picker + manual entry. */
export function MediaField({ label, desc, value, onChange, accept = "image", half }) {
  const [open, setOpen] = useState(false);
  const isImg = value && /\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(value);
  return (
    <div className="field" style={half ? {} : { gridColumn: "1 / -1" }}>
      <label>{label}</label>
      {desc && <div className="desc">{desc}</div>}
      <div className="media-field">
        {isImg && <img className="media-field-preview" src={value} alt="" />}
        <input className="input" value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder="Pick from library or paste a URL / path" />
        <button type="button" className="btn ghost" onClick={() => setOpen(true)}>Library</button>
      </div>
      {open && <PickerModal accept={accept} onPick={(m) => onChange(m.secureUrl)} onClose={() => setOpen(false)} />}
    </div>
  );
}
