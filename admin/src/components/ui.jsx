import { createContext, useContext, useState, useCallback } from "react";

/* ---------- Toasts ---------- */
const ToastCtx = createContext(null);
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((message, type = "info") => {
    const id = Math.random().toString(36).slice(2);
    setItems((x) => [...x, { id, message, type }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 3200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts">
        {items.map((t) => <div key={t.id} className={`toast ${t.type}`}>{t.message}</div>)}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

/* ---------- Form fields (controlled) ---------- */
export function Field({ label, desc, value, onChange, type = "text", placeholder, half }) {
  return (
    <div className="field" style={half ? {} : { gridColumn: "1 / -1" }}>
      <label>{label}</label>
      {desc && <div className="desc">{desc}</div>}
      <input className="input" type={type} value={value ?? ""} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export function TextArea({ label, desc, value, onChange, rows = 3 }) {
  return (
    <div className="field" style={{ gridColumn: "1 / -1" }}>
      <label>{label}</label>
      {desc && <div className="desc">{desc}</div>}
      <textarea rows={rows} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export function Panel({ title, subtitle, children, right }) {
  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <h3>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {right}
      </div>
      <div className="panel-body">{children}</div>
    </div>
  );
}
