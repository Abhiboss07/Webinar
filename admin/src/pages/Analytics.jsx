import { useEffect, useState, useCallback } from "react";
import Layout from "../components/Layout.jsx";
import { Panel } from "../components/ui.jsx";
import { AreaLine, HBars, Heatmap } from "../components/charts.jsx";
import { useToast } from "../components/ui.jsx";
import { api, download } from "../lib/api.js";

const money = (n) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);
const num = (n) => new Intl.NumberFormat().format(n || 0);
const asBars = (arr, k = "value") => (arr || []).map((x) => ({ label: x.label, count: x[k] ?? x.count }));
function Card({ label, value }) { return <div className="card stat"><div className="label">{label}</div><div className="value">{value}</div></div>; }

const TABS = ["Executive", "Revenue", "Registrations", "Attendance", "Certificates", "Communication", "Workshops"];

export default function Analytics() {
  const toast = useToast();
  const [tab, setTab] = useState("Executive");
  const [data, setData] = useState({});
  const [dates, setDates] = useState({ from: "", to: "" });
  const set = (key, v) => setData((d) => ({ ...d, [key]: v }));

  const load = useCallback(() => {
    const p = { from: dates.from, to: dates.to };
    const fn = {
      Executive: () => api.anExecutive().then((r) => set("exec", r.cards)),
      Revenue: () => api.anRevenue(p).then((r) => set("rev", r)),
      Registrations: () => api.anRegistrations(p).then((r) => set("reg", r)),
      Attendance: () => api.anAttendance().then((r) => set("att", r)),
      Certificates: () => api.anCertificates().then((r) => set("cert", r)),
      Communication: () => api.anCommunication().then((r) => set("comm", r)),
      Workshops: () => api.anWorkshops().then((r) => set("ws", r)),
    }[tab];
    fn && fn().catch((e) => toast(e.message, "error"));
  }, [tab, dates, toast]);
  useEffect(() => { load(); }, [load]);

  const exp = (report, format) => { const qs = new URLSearchParams({ report, format, ...(dates.from ? { from: dates.from } : {}), ...(dates.to ? { to: dates.to } : {}) }); download(`/api/analytics/export?${qs}`, `${report}.${format === "xlsx" ? "xlsx" : "csv"}`).catch((e) => toast(e.message, "error")); };
  const DateRange = () => (
    <div className="hstack" style={{ gap: 8, marginBottom: 14 }}>
      <input className="input" type="date" style={{ maxWidth: 150 }} value={dates.from} onChange={(e) => setDates((d) => ({ ...d, from: e.target.value }))} />
      <span className="muted">to</span>
      <input className="input" type="date" style={{ maxWidth: 150 }} value={dates.to} onChange={(e) => setDates((d) => ({ ...d, to: e.target.value }))} />
    </div>
  );

  const e = data.exec, rev = data.rev, reg = data.reg, att = data.att, cert = data.cert, comm = data.comm, ws = data.ws;

  return (
    <Layout title="Analytics & Reports">
      <div className="hstack" style={{ gap: 6, marginBottom: 18, flexWrap: "wrap" }}>
        {TABS.map((t) => <button key={t} className={`btn ${tab === t ? "primary" : "ghost"}`} onClick={() => setTab(t)}>{t}</button>)}
      </div>

      {tab === "Executive" && (!e ? <div className="notice">Loading…</div> :
        <div className="grid cards">
          <Card label="Total Revenue" value={money(e.totalRevenue)} />
          <Card label="Registrations" value={num(e.totalRegistrations)} />
          <Card label="Active Workshops" value={num(e.activeWorkshops)} />
          <Card label="Attendance Rate" value={`${e.attendanceRate}%`} />
          <Card label="Certificates" value={num(e.certificatesIssued)} />
          <Card label="Conversion" value={`${e.conversionRate}%`} />
          <Card label="Refund Rate" value={`${e.refundRate}%`} />
          <Card label="Avg Ticket" value={money(e.avgTicket)} />
          <Card label="Repeat Customers" value={num(e.repeatCustomers)} />
          <Card label="Monthly Growth" value={`${e.monthlyGrowth}%`} />
        </div>)}

      {tab === "Revenue" && (<>
        <DateRange />
        <div className="hstack" style={{ marginBottom: 12 }}><span className="badge good">Forecast next 7d: {money(rev?.forecastNext7)}</span><div className="spacer" /><button className="btn ghost" onClick={() => exp("revenue", "csv")}>CSV</button><button className="btn ghost" onClick={() => exp("revenue", "xlsx")}>Excel</button></div>
        <div className="charts-grid">
          <Panel title="Revenue over time">{rev ? <AreaLine data={rev.daily} /> : <div className="skel" style={{ height: 200 }} />}</Panel>
          <Panel title="Revenue by workshop">{rev ? <HBars data={rev.byWorkshop} /> : <div className="skel" style={{ height: 200 }} />}</Panel>
        </div>
        <div className="charts-grid" style={{ marginTop: 16 }}>
          <Panel title="Payment method split">{rev ? <HBars data={asBars(rev.methodSplit)} /> : null}</Panel>
          <Panel title="Refund trend">{rev ? <AreaLine data={rev.refundTrend} /> : null}</Panel>
        </div>
      </>)}

      {tab === "Registrations" && (<>
        <DateRange />
        <div className="hstack" style={{ marginBottom: 12 }}>
          <span className="badge">Cancelled: {num(reg?.cancelled)}</span> <span className="badge">Refunded: {num(reg?.refunded)}</span> <span className="badge">Waitlisted: {num(reg?.waitlisted)}</span>
          <div className="spacer" /><button className="btn ghost" onClick={() => exp("registrations", "csv")}>CSV</button><button className="btn ghost" onClick={() => exp("registrations", "xlsx")}>Excel</button>
        </div>
        <div className="charts-grid">
          <Panel title="Registrations over time">{reg ? <AreaLine data={reg.daily} /> : <div className="skel" style={{ height: 200 }} />}</Panel>
          <Panel title="Conversion funnel">{reg ? <HBars data={asBars(reg.funnel)} /> : null}</Panel>
        </div>
        <div className="charts-grid" style={{ marginTop: 16 }}>
          <Panel title="Profession distribution">{reg ? <HBars data={reg.professions} /> : null}</Panel>
          <Panel title="Top cities">{reg ? <HBars data={reg.cities} /> : null}</Panel>
        </div>
      </>)}

      {tab === "Attendance" && (att ? <>
        <div className="grid cards" style={{ marginBottom: 16 }}><Card label="Attendance Rate" value={`${att.attendanceRate}%`} /><Card label="No-shows" value={num(att.noShows)} /></div>
        <div className="charts-grid">
          <Panel title="Check-ins by hour">{<AreaLine data={att.checkinByHour} />}</Panel>
          <Panel title="Attendance by workshop">{<HBars data={att.byWorkshop} />}</Panel>
        </div>
        <Panel title="Arrival heatmap (day × hour)"><Heatmap data={att.heatmap} /></Panel>
      </> : <div className="notice">Loading…</div>)}

      {tab === "Certificates" && (cert ? <>
        <div className="grid cards" style={{ marginBottom: 16 }}><Card label="Issued" value={num(cert.issued)} /><Card label="Pending" value={num(cert.pending)} /><Card label="Revoked" value={num(cert.revoked)} /></div>
        <Panel title="Certificates by workshop"><HBars data={cert.byWorkshop} /></Panel>
      </> : <div className="notice">Loading…</div>)}

      {tab === "Communication" && (comm ? <>
        <div className="grid cards" style={{ marginBottom: 16 }}><Card label="Delivery Rate" value={`${comm.deliveryRate}%`} /><Card label="Failure Rate" value={`${comm.failureRate}%`} /><Card label="Retries" value={num(comm.retryCount)} /><Card label="Opens" value={num(comm.opens)} /></div>
        <div className="charts-grid">
          <Panel title="By channel"><HBars data={comm.byChannel} /></Panel>
          <Panel title="By status"><HBars data={asBars(comm.byStatus)} /></Panel>
        </div>
      </> : <div className="notice">Loading…</div>)}

      {tab === "Workshops" && (ws ? <>
        <div className="hstack" style={{ marginBottom: 12 }}><div className="spacer" /><button className="btn ghost" onClick={() => exp("workshops", "csv")}>CSV</button><button className="btn ghost" onClick={() => exp("workshops", "xlsx")}>Excel</button></div>
        <div className="crm-table-wrap"><table className="crm-table"><thead><tr><th>Workshop</th><th>Registrations</th><th>Revenue</th><th>Attended</th><th>Certificates</th><th>Completion</th></tr></thead>
          <tbody>{ws.workshops.length === 0 ? <tr><td colSpan={6}><div className="empty"><div className="em-title">No data</div></div></td></tr> :
            ws.workshops.map((w, i) => <tr key={i}><td style={{ fontWeight: 600 }}>{w.workshop}</td><td>{num(w.registrations)}</td><td>{money(w.revenue)}</td><td>{num(w.attended)}</td><td>{num(w.certificates)}</td><td>{w.completionRate}%</td></tr>)}
          </tbody></table></div>
      </> : <div className="notice">Loading…</div>)}
    </Layout>
  );
}
