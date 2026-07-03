import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth.jsx";

// Each item names the resource it needs `view` on; the nav hides what you can't see.
const NAV = [
  { group: "Overview", items: [
    { to: "/", label: "Dashboard", ico: "▦", end: true, res: "dashboard" },
    { to: "/analytics", label: "Analytics", ico: "📊", res: "analytics" },
  ] },
  {
    group: "Workshops", items: [
      { to: "/workshops", label: "Workshops", ico: "🎓", res: "workshops" },
      { to: "/registrations", label: "Registrations", ico: "🧾", res: "registrations" },
      { to: "/payments", label: "Payments", ico: "💳", res: "payments" },
      { to: "/communication", label: "Communication", ico: "✉", res: "communication" },
      { to: "/attendance", label: "Attendance", ico: "✅", res: "events" },
      { to: "/certificates", label: "Certificates", ico: "🎓", res: "events" },
    ],
  },
  {
    group: "Website Content", items: [
      { to: "/sections", label: "Homepage Sections", ico: "▤", res: "homepage_cms" },
      { to: "/content", label: "Content Editor", ico: "✎", res: "homepage_cms" },
      { to: "/media", label: "Media Library", ico: "🖼", res: "media" },
    ],
  },
  {
    group: "Administration", items: [
      { to: "/users", label: "Users", ico: "👤", res: "users" },
      { to: "/roles", label: "Roles & Permissions", ico: "🔑", res: "roles", superOnly: true },
      { to: "/audit", label: "Audit Log", ico: "📜", res: "users" },
      { to: "/settings", label: "Settings", ico: "⚙", res: "settings" },
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
  const { user, logout, can, isSuperAdmin, roleName } = useAuth();
  const nav = useNavigate();
  const [theme, setTheme] = useTheme();
  const [open, setOpen] = useState(false);

  const visible = (it) => (it.superOnly ? isSuperAdmin : can(it.res, "view"));

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
        {NAV.map((sec) => {
          const items = sec.items.filter(visible);
          if (!items.length) return null;
          return (
            <div key={sec.group}>
              <div className="nav-group">{sec.group}</div>
              {items.map((it) => (
                <NavLink key={it.to} to={it.to} end={it.end} className="nav-item" onClick={() => setOpen(false)}>
                  <span className="ico">{it.ico}</span> {it.label}
                </NavLink>
              ))}
            </div>
          );
        })}

        <div className="sidebar-foot">
          <div className="hstack" style={{ padding: "6px 10px" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis" }}>{user?.name || "Admin"}</div>
              <div style={{ fontSize: 11.5, color: "var(--text-faint)" }}>{roleName || user?.role}</div>
            </div>
          </div>
          <button className="btn ghost" style={{ width: "100%", marginTop: 8 }}
            onClick={async () => { await logout(); nav("/login"); }}>Log out</button>
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
