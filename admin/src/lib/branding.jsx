import { createContext, useContext, useEffect, useState } from "react";
import { api } from "./api.js";

const Ctx = createContext({ siteName: "Youngness CMS", logo: "", ready: false });

function hexToRgba(hex, a) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "");
  if (!m) return `rgba(30,61,82,${a})`;
  return `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${a})`;
}
function setFavicon(url) {
  if (!url) return;
  let link = document.querySelector('link[rel="icon"]');
  if (!link) { link = document.createElement("link"); link.rel = "icon"; document.head.appendChild(link); }
  link.href = url;
}
function applyTheme(g) {
  const r = document.documentElement;
  if (g.primaryColor) { r.style.setProperty("--brand", g.primaryColor); r.style.setProperty("--brand-ink", g.primaryColor); r.style.setProperty("--ring", hexToRgba(g.primaryColor, 0.14)); }
  if (g.secondaryColor) r.style.setProperty("--accent", g.secondaryColor);
  if (g.borderRadius) { r.style.setProperty("--radius", g.borderRadius); r.style.setProperty("--radius-sm", `calc(${g.borderRadius} - 4px)`); }
  if (g.siteName) document.title = `${g.siteName} · Admin`;
  if (g.favicon) setFavicon(g.favicon);
}

export function BrandingProvider({ children }) {
  const [b, setB] = useState({ siteName: "Youngness CMS", logo: "", ready: false });
  useEffect(() => {
    api.settingsPublic()
      .then((r) => { const g = (r.settings && r.settings.general) || {}; applyTheme(g); setB({ siteName: g.siteName || "Youngness CMS", logo: g.logo || "", poweredBy: g.poweredBy, adminFooter: g.adminFooter, ready: true }); })
      .catch(() => setB((x) => ({ ...x, ready: true })));
  }, []);
  return <Ctx.Provider value={b}>{children}</Ctx.Provider>;
}

export const useBranding = () => useContext(Ctx);
