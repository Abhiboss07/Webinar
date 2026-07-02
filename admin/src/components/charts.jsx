import { useRef, useState } from "react";

/* ============================================================================
   Dependency-free SVG charts, built to the data-viz mark specs:
   thin marks, 2px lines, rounded ends, recessive grid, direct labels, hover
   tooltips, and a legend whenever there are 2+ series. Colors come from the
   validated CSS role variables in styles.css (light/dark swap in one place).
   ========================================================================== */

const fmt = (n) => new Intl.NumberFormat().format(n);
const niceDate = (s) => new Date(s + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });

/* ---- Area + line, single series (registrations over time) ---- */
export function AreaLine({ data }) {
  const [hover, setHover] = useState(null);
  const wrapRef = useRef(null);
  const W = 620, H = 220, padL = 30, padR = 12, padT = 14, padB = 26;
  const iw = W - padL - padR, ih = H - padT - padB;
  const max = Math.max(1, ...data.map((d) => d.total));
  const x = (i) => padL + (data.length <= 1 ? iw / 2 : (i / (data.length - 1)) * iw);
  const y = (v) => padT + ih - (v / max) * ih;

  const line = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d.total).toFixed(1)}`).join(" ");
  const area = `${line} L${x(data.length - 1).toFixed(1)},${padT + ih} L${x(0).toFixed(1)},${padT + ih} Z`;
  const ticks = [0, Math.round(max / 2), max];

  const onMove = (e) => {
    const r = wrapRef.current.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    let idx = Math.round(((px - padL) / iw) * (data.length - 1));
    idx = Math.max(0, Math.min(data.length - 1, idx));
    setHover(idx);
  };

  return (
    <div className="chart-wrap" ref={wrapRef} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      <svg className="chart-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img"
        aria-label="Registrations over time">
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="var(--viz-grid)" strokeWidth="1" />
            <text x={padL - 6} y={y(t) + 3} textAnchor="end" fontSize="10" fill="var(--viz-ink)">{t}</text>
          </g>
        ))}
        <path d={area} fill="var(--series-1-fill)" />
        <path d={line} fill="none" stroke="var(--series-1)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {hover != null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={padT} y2={padT + ih} stroke="var(--viz-axis)" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx={x(hover)} cy={y(data[hover].total)} r="4.5" fill="var(--series-1)" stroke="var(--surface)" strokeWidth="2" />
          </g>
        )}
        {data.map((d, i) => (
          (i === 0 || i === data.length - 1 || i === Math.floor(data.length / 2)) && (
            <text key={i} x={x(i)} y={H - 8} textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"}
              fontSize="10" fill="var(--viz-ink)">{niceDate(d.date)}</text>
          )
        ))}
      </svg>
      {hover != null && (
        <div className="viz-tooltip" style={{ left: `${(x(hover) / W) * 100}%`, top: `${(y(data[hover].total) / H) * 100}%` }}>
          <div>{niceDate(data[hover].date)}</div>
          <div><span className="t-val">{fmt(data[hover].total)}</span> registrations</div>
        </div>
      )}
    </div>
  );
}

/* ---- Donut for payment status (status palette + legend, never color-alone) ---- */
const ROLE_VAR = { good: "var(--st-good)", warning: "var(--st-warn)", critical: "var(--st-crit)" };
const ROLE_ICON = { good: "✓", warning: "◔", critical: "✕" };

export function Donut({ data }) {
  const [hover, setHover] = useState(null);
  const total = data.reduce((s, d) => s + d.value, 0);
  const R = 70, r = 46, C = 100;
  let acc = 0;
  const segs = data.map((d) => {
    const frac = total ? d.value / total : 0;
    const seg = { ...d, start: acc, frac };
    acc += frac;
    return seg;
  });
  const arc = (start, frac) => {
    if (frac <= 0) return "";
    const a0 = start * 2 * Math.PI - Math.PI / 2;
    const a1 = (start + frac) * 2 * Math.PI - Math.PI / 2;
    const big = frac > 0.5 ? 1 : 0;
    const p = (ang, rad) => [C + rad * Math.cos(ang), C + rad * Math.sin(ang)];
    const [x0, y0] = p(a0, R), [x1, y1] = p(a1, R), [x2, y2] = p(a1, r), [x3, y3] = p(a0, r);
    return `M${x0},${y0} A${R},${R} 0 ${big} 1 ${x1},${y1} L${x2},${y2} A${r},${r} 0 ${big} 0 ${x3},${y3} Z`;
  };

  return (
    <div className="chart-wrap">
      <svg className="chart-svg" viewBox="0 0 200 200" style={{ maxWidth: 220, margin: "0 auto" }} role="img" aria-label="Payment status breakdown">
        {total === 0 && <circle cx={C} cy={C} r={(R + r) / 2} fill="none" stroke="var(--viz-grid)" strokeWidth={R - r} />}
        {segs.map((s, i) => s.value > 0 && (
          <path key={i} d={arc(s.start, s.frac)} fill={ROLE_VAR[s.role]} stroke="var(--surface)" strokeWidth="2"
            opacity={hover == null || hover === i ? 1 : 0.4}
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
        ))}
        <text className="donut-center" x={C} y={C - 4} textAnchor="middle" fontSize="30" fontWeight="800" fill="var(--text)">{fmt(total)}</text>
        <text x={C} y={C + 16} textAnchor="middle" fontSize="11" fill="var(--viz-ink)">total</text>
      </svg>
      <div className="viz-legend" style={{ justifyContent: "center" }}>
        {data.map((d, i) => (
          <div className="li" key={i}>
            <span className="sw" style={{ background: ROLE_VAR[d.role] }} />
            <span aria-hidden style={{ color: ROLE_VAR[d.role], fontWeight: 700 }}>{ROLE_ICON[d.role]}</span>
            {d.label} <b>{fmt(d.value)}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---- Horizontal bars, categorical (registration source) with direct labels ---- */
export function HBars({ data }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const cat = (i) => `var(--cat-${(i % 6) + 1})`;
  if (!data.length) return null;
  return (
    <div>
      {data.map((d, i) => (
        <div className="hbar-row" key={i} title={`${d.label}: ${fmt(d.count)}`}>
          <div className="hbar-label">{d.label}</div>
          <div className="hbar-track">
            <div className="hbar-fill" style={{ width: `${(d.count / max) * 100}%`, background: cat(i) }} />
          </div>
          <div className="hbar-val">{fmt(d.count)}</div>
        </div>
      ))}
    </div>
  );
}
