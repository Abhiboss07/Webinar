"use strict";
/** Registration export → CSV and real XLSX (exceljs). One column set, two formats. */
const ExcelJS = require("exceljs");

const COLUMNS = [
  { key: "regId", header: "Registration ID", get: (r) => r.regId },
  { key: "fullName", header: "Name", get: (r) => r.fullName },
  { key: "mobile", header: "Mobile", get: (r) => r.mobile },
  { key: "email", header: "Email", get: (r) => r.email },
  { key: "profession", header: "Profession", get: (r) => r.profession },
  { key: "experience", header: "Experience", get: (r) => r.experience },
  { key: "city", header: "City", get: (r) => r.city },
  { key: "mode", header: "Mode", get: (r) => r.mode },
  { key: "workshop", header: "Workshop", get: (r) => r.workshop },
  { key: "paymentStatus", header: "Payment Status", get: (r) => r.paymentStatus },
  { key: "amount", header: "Amount", get: (r) => r.amount || 0 },
  { key: "paymentMethod", header: "Payment Method", get: (r) => r.paymentMethod },
  { key: "attended", header: "Attended", get: (r) => (r.attended ? "Yes" : "No") },
  { key: "certificateIssued", header: "Certificate", get: (r) => (r.certificateIssued ? "Yes" : "No") },
  { key: "waitlisted", header: "Waiting List", get: (r) => (r.waitlisted ? "Yes" : "No") },
  { key: "source", header: "Source", get: (r) => r.source },
  { key: "createdAt", header: "Registered At", get: (r) => (r.createdAt ? new Date(r.createdAt).toISOString() : "") },
];

function csvCell(v) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV string (BOM-prefixed so Excel reads UTF-8 correctly). */
function buildCsv(rows) {
  const head = COLUMNS.map((c) => csvCell(c.header)).join(",");
  const body = rows.map((r) => COLUMNS.map((c) => csvCell(c.get(r))).join(",")).join("\n");
  return "﻿" + head + "\n" + body + "\n";
}

/** XLSX buffer with a styled header row. */
async function buildXlsx(rows) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Registrations");
  ws.columns = COLUMNS.map((c) => ({ header: c.header, key: c.key, width: Math.max(12, c.header.length + 2) }));
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEFEF" } };
  rows.forEach((r) => ws.addRow(COLUMNS.reduce((o, c) => ((o[c.key] = c.get(r)), o), {})));
  ws.autoFilter = { from: "A1", to: `${String.fromCharCode(64 + COLUMNS.length)}1` };
  return wb.xlsx.writeBuffer();
}

module.exports = { buildCsv, buildXlsx, COLUMNS };
