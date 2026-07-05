"use strict";
/**
 * PDF receipt / invoice for a paid registration (pdfkit → Buffer). Contains only
 * non-sensitive data already on the registration — never any secret/key.
 */
const PDFDocument = require("pdfkit");

const money = (n, cur = "INR") => `${cur === "INR" ? "₹" : cur + " "}${Number(n || 0).toLocaleString("en-IN")}`;
const line = (d) => d ? new Date(d).toLocaleString("en-IN") : "—";

/** kind: "Receipt" | "Invoice". brand: { name, email, phone, address }. */
function buildPdf(reg, kind = "Receipt", brand = {}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const brandName = brand.name || "Youngness Institute";
    doc.fontSize(20).fillColor("#1e3d52").text(brandName, { continued: false });
    doc.moveDown(0.2);
    doc.fontSize(10).fillColor("#666");
    if (brand.address) doc.text(brand.address);
    if (brand.email) doc.text(brand.email);
    if (brand.phone) doc.text(brand.phone);

    doc.moveDown(1);
    doc.fontSize(16).fillColor("#111").text(kind.toUpperCase(), { align: "right" });
    doc.fontSize(9).fillColor("#666").text(`Date: ${line(reg.transactionTime || reg.createdAt)}`, { align: "right" });
    doc.text(`Ref: ${reg.paymentId || reg.regId || ""}`, { align: "right" });

    doc.moveDown(1.5);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#ddd").stroke();
    doc.moveDown(0.8);

    doc.fontSize(11).fillColor("#111").text("Billed to");
    doc.fontSize(10).fillColor("#333");
    doc.text(reg.fullName || "—");
    if (reg.email) doc.text(reg.email);
    if (reg.mobile) doc.text(reg.mobile);

    doc.moveDown(1);
    const rows = [
      ["Workshop", reg.workshop || "—"],
      ["Registration ID", reg.regId || "—"],
      ["Order ID", reg.orderId || "—"],
      ["Payment ID", reg.paymentId || "—"],
      ["Method", `${reg.paymentMethod || "—"} · Razorpay`],
      ["Status", reg.paymentStatus || "—"],
    ];
    if (reg.paymentStatus === "Refunded") rows.push(["Refund", `${money(reg.refundAmount, reg.currency)} · ${reg.refundId || ""}`]);

    doc.fontSize(10);
    rows.forEach(([k, v]) => {
      doc.fillColor("#666").text(k, 50, doc.y, { continued: true, width: 200 });
      doc.fillColor("#111").text(String(v), { align: "left" });
    });

    doc.moveDown(1);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#ddd").stroke();
    doc.moveDown(0.6);
    doc.fontSize(14).fillColor("#1e3d52").text(`Amount ${reg.paymentStatus === "Paid" ? "Paid" : ""}: ${money(reg.amount, reg.currency)}`, { align: "right" });

    doc.moveDown(3);
    doc.fontSize(8).fillColor("#999").text("This is a system-generated document. For queries, contact us at the details above.", { align: "center" });

    doc.end();
  });
}

module.exports = { buildPdf };
