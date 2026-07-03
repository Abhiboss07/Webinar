"use strict";
/** Renders a certificate PDF from the template + certificate data, with an
 *  embedded verification QR. (Remote logo/background embedding is a later
 *  enhancement; the layout is clean text + QR for now.) */
const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");
const { render } = require("./templateEngine");

async function buildCertificatePdf(cert, template, verifyUrl) {
  const qrBuf = await QRCode.toBuffer(String(verifyUrl), { margin: 1, width: 130 });
  const ctx = { name: cert.participantName, workshop: cert.workshop, date: cert.workshopDate, instructor: cert.instructor };

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", layout: template.orientation || "landscape", margin: 40 });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W = doc.page.width, H = doc.page.height;
    // Double border
    doc.lineWidth(3).strokeColor(template.primaryColor || "#1e3d52").rect(24, 24, W - 48, H - 48).stroke();
    doc.lineWidth(1).strokeColor(template.accentColor || "#c8862b").rect(34, 34, W - 68, H - 68).stroke();

    doc.fillColor(template.primaryColor || "#1e3d52").fontSize(30).font("Helvetica-Bold").text(template.title || "Certificate", 0, 90, { align: "center" });
    doc.moveDown(0.4).fontSize(13).fillColor("#666").font("Helvetica").text(template.subtitle || "This is presented to", { align: "center" });

    doc.moveDown(0.8).fontSize(34).fillColor("#111").font("Helvetica-Bold").text(cert.participantName || "—", { align: "center" });

    doc.moveDown(0.6).fontSize(14).fillColor("#333").font("Helvetica").text(render(template.bodyText || "", ctx), { align: "center", width: W - 160, indent: 80 });

    // Footer row: certificate number + issue date + instructor
    const y = H - 150;
    doc.fontSize(10).fillColor("#666");
    doc.text(`Certificate No: ${cert.certificateNumber}`, 60, y);
    doc.text(`Issued: ${new Date(cert.issueDate).toLocaleDateString()}`, 60, y + 16);
    if (cert.instructor) doc.text(`Instructor: ${cert.instructor}`, 60, y + 32);

    // Verification QR bottom-right
    doc.image(qrBuf, W - 150, y - 6, { width: 90 });
    doc.fontSize(8).fillColor("#999").text("Scan to verify", W - 152, y + 86, { width: 94, align: "center" });

    doc.end();
  });
}

module.exports = { buildCertificatePdf };
