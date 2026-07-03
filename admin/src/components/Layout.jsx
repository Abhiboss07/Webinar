import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth.jsx";

const NAV = [
  { group: "Overview", items: [{ to: "/", label: "Dashboard", ico: "▦", end: true }] },
  {
    group: "Workshops",
    items: [
      { to: "/workshops", label: "Workshops", ico: "🎓" },
      { to: "/registrations", label: "Registrations", ico: "🧾" },
      { to: "/payments", label: "Payments", ico: "💳" },
    ],
  },
  {
    group: "Website Content",
    items: [
      { to: "/sections", label: "Homepage Sections", ico: "▤" },
      { to: "/content", label: "Content Editor", ico: "✎" },
      { to: "/media", label: "Media Library", ico: "🖼" },
    ],
  },
];

function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem("yn_admin_theme") || "light");
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("yn_admin_theme", theme);
  }, [theme]);
  return [theme, setTheme];
}

export default function Layout({ title, children }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [theme, setTheme] = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <div className="shell">
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">Y</div>
          <div>
            <div className="brand-name">Youngness CMS</div>
            <div className="brand-sub">Workshop admin</div>
          </div>
        </div>
        {NAV.map((sec) => (
          <div key={sec.group}>
            <div className="nav-group">{sec.group}</div>
            {sec.items.map((it) => (
              <NavLink key={it.to} to={it.to} end={it.end} className="nav-item" onClick={() => setOpen(false)}>
                <span className="ico">{it.ico}</span> {it.label}
              </NavLink>
            ))}
          </div>
        ))}
        <div className="nav-group">Coming next</div>
        <div className="nav-item" style={{ opacity: .5, cursor: "default" }}><span className="ico">◷</span> Users &amp; Roles</div>
        <div className="nav-item" style={{ opacity: .5, cursor: "default" }}><span className="ico">◷</span> Settings</div>
        <div className="nav-item" style={{ opacity: .5, cursor: "default" }}><span className="ico">◷</span> Audit Logs</div>

        <div className="sidebar-foot">
          <div className="hstack" style={{ padding: "6px 10px" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{user?.name || "Admin"}</div>
              <div style={{ fontSize: 11.5, color: "var(--text-faint)" }}>{user?.email}</div>
            </div>
          </div>
          <button className="btn ghost" style={{ width: "100%", marginTop: 8 }}
            onClick={() => { logout(); nav("/login"); }}>Log out</button>
        </div>
      </aside>

      <div className="main">
        <div className="topbar">
          <div className="hstack">
            <button className="btn ghost icon" style={{ display: "none" }} onClick={() => setOpen((o) => !o)}>☰</button>
            <h1>{title}</h1>
          </div>
          <div className="hstack">
            <button className="btn ghost icon" title="Toggle theme"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
              {theme === "dark" ? "☀" : "☾"}
            </button>
          </div>
        </div>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
