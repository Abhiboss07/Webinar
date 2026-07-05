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

// Payment-focused column set (Payment Manager export).
const PAYMENT_COLUMNS = [
  { key: "paymentId", header: "Payment ID", get: (r) => r.paymentId },
  { key: "orderId", header: "Order ID", get: (r) => r.orderId },
  { key: "regId", header: "Registration ID", get: (r) => r.regId },
  { key: "fullName", header: "Participant", get: (r) => r.fullName },
  { key: "workshop", header: "Workshop", get: (r) => r.workshop },
  { key: "amount", header: "Amount", get: (r) => r.amount || 0 },
  { key: "currency", header: "Currency", get: (r) => r.currency || "INR" },
  { key: "paymentMethod", header: "Method", get: (r) => r.paymentMethod },
  { key: "gateway", header: "Gateway", get: () => "Razorpay" },
  { key: "paymentStatus", header: "Status", get: (r) => r.paymentStatus },
  { key: "createdAt", header: "Created", get: (r) => (r.createdAt ? new Date(r.createdAt).toISOString() : "") },
  { key: "transactionTime", header: "Paid Time", get: (r) => (r.transactionTime ? new Date(r.transactionTime).toISOString() : "") },
  { key: "refundId", header: "Refund ID", get: (r) => r.refundId },
  { key: "refundAmount", header: "Refund Amount", get: (r) => r.refundAmount || 0 },
];

function csvCell(v) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV string (BOM-prefixed so Excel reads UTF-8 correctly). */
function buildCsv(rows, cols = COLUMNS) {
  const head = cols.map((c) => csvCell(c.header)).join(",");
  const body = rows.map((r) => cols.map((c) => csvCell(c.get(r))).join(",")).join("\n");
  return "﻿" + head + "\n" + body + "\n";
}

/** XLSX buffer with a styled header row. */
async function buildXlsx(rows, cols = COLUMNS, sheetName = "Registrations") {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);
  ws.columns = cols.map((c) => ({ header: c.header, key: c.key, width: Math.max(12, c.header.length + 2) }));
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEFEF" } };
  rows.forEach((r) => ws.addRow(cols.reduce((o, c) => ((o[c.key] = c.get(r)), o), {})));
  ws.autoFilter = { from: "A1", to: `${String.fromCharCode(64 + cols.length)}1` };
  return wb.xlsx.writeBuffer();
}

module.exports = { buildCsv, buildXlsx, COLUMNS, PAYMENT_COLUMNS };
