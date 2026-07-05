"use strict";
/** Event → template dispatch. fire(event, {registration, extra}) renders every
 *  enabled template for that event and enqueues it. Best-effort — never throws
 *  into the caller's flow (registration/payment must not break on comms). */
const provider = require("./settingsProvider");
const MessageTemplate = require("../models/MessageTemplate");
const Workshop = require("../models/Workshop");
const SiteConfig = require("../models/SiteConfig");
const commQueue = require("./commQueue");
const { render, buildContext } = require("./templateEngine");

async function workshopFacts() {
  try {
    const w = await Workshop.findOne({ isActive: true, status: "published" }).lean();
    const src = (w && w.content && w.content.workshop) || ((await SiteConfig.getSingleton()).data.workshop) || {};
    return { workshop: src.name || "", date: src.date || "", time: src.time || "", venue: src.venue || "" };
  } catch (_) { return {}; }
}

function attachmentsFor(event, reg, facts) {
  if (event === "payment.success") {
    return [
      { filename: "receipt.pdf", kind: "receipt", ref: String(reg._id) },
      { filename: "invite.ics", kind: "ics", ref: JSON.stringify({ title: reg.workshop || facts.workshop, description: "Your workshop registration", location: facts.venue, start: Date.parse(facts.date) ? new Date(facts.date) : undefined }) },
    ];
  }
  if (event === "registration.success") {
    return [{ filename: "invite.ics", kind: "ics", ref: JSON.stringify({ title: reg.workshop || facts.workshop, description: "Your workshop registration", location: facts.venue, start: Date.parse(facts.date) ? new Date(facts.date) : undefined }) }];
  }
  return [];
}

async function fire(event, { registration, extra = {} } = {}) {
  try {
    if (!registration) return { enqueued: 0 };
    const comm = await provider.communication();
    if (comm.triggers && comm.triggers[event] === false) return { enqueued: 0, disabled: true };
    const templates = await MessageTemplate.find({ trigger: event, enabled: true });
    if (!templates.length) return { enqueued: 0 };

    const facts = await workshopFacts();
    const ctx = buildContext(registration, { ...facts, ...extra });
    let enqueued = 0;
    for (const t of templates) {
      if (t.channel === "email" && registration.email) {
        await commQueue.enqueue({
          channel: "email", to: registration.email, name: registration.fullName, registrationId: registration._id,
          templateKey: t.key, trigger: event, subject: render(t.subject, ctx), body: render(t.body, ctx),
          attachments: attachmentsFor(event, registration, facts),
        });
        enqueued += 1;
      }
      if (t.channel === "whatsapp" && registration.mobile) {
        await commQueue.enqueue({
          channel: "whatsapp", to: registration.mobile, name: registration.fullName, registrationId: registration._id,
          templateKey: t.key, trigger: event, body: render([t.whatsapp?.header, t.body, t.whatsapp?.footer].filter(Boolean).join("\n\n"), ctx),
        });
        enqueued += 1;
      }
    }
    return { enqueued };
  } catch (err) {
    console.error("[triggers.fire]", err.message);
    return { enqueued: 0, error: err.message };
  }
}

module.exports = { fire };
