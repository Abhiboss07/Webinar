"use strict";
/** Minimal .ics calendar invite builder (no dependency). */
function pad(n) { return String(n).padStart(2, "0"); }
function toICSDate(d) {
  const dt = new Date(d);
  return `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}T${pad(dt.getUTCHours())}${pad(dt.getUTCMinutes())}00Z`;
}
const esc = (s) => String(s || "").replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");

/** { title, description, location, start, durationMinutes } → ics string buffer. */
function buildIcs({ title, description, location, start, durationMinutes = 240 }) {
  const dtStart = start ? new Date(start) : new Date();
  const dtEnd = new Date(dtStart.getTime() + durationMinutes * 60000);
  const uid = `${Date.now()}@youngness`;
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Youngness//CMS//EN", "METHOD:PUBLISH",
    "BEGIN:VEVENT", `UID:${uid}`, `DTSTAMP:${toICSDate(new Date())}`,
    `DTSTART:${toICSDate(dtStart)}`, `DTEND:${toICSDate(dtEnd)}`,
    `SUMMARY:${esc(title)}`, `DESCRIPTION:${esc(description)}`, `LOCATION:${esc(location)}`,
    "END:VEVENT", "END:VCALENDAR",
  ];
  return Buffer.from(lines.join("\r\n"), "utf8");
}

module.exports = { buildIcs };
