"use strict";
/** Seed default email + WhatsApp templates (idempotent). `npm run seed:templates` */
const { connectDB, mongoose } = require("../db/connect");
const MessageTemplate = require("../models/MessageTemplate");

const DEFAULTS = [
  { channel: "email", key: "email.registration_success", name: "Registration received", trigger: "registration.success", category: "lifecycle",
    subject: "You're registered for {{workshop}} 🎉",
    body: "<p>Hi {{name}},</p><p>Thanks for registering for <strong>{{workshop}}</strong>.</p><p><strong>Date:</strong> {{date}}<br/><strong>Time:</strong> {{time}}<br/><strong>Mode:</strong> {{venue}}</p><p>We've attached a calendar invite. See you there!</p>" },
  { channel: "email", key: "email.payment_success", name: "Payment confirmed", trigger: "payment.success", category: "lifecycle",
    subject: "Payment received — your seat for {{workshop}} is confirmed ✅",
    body: "<p>Hi {{name}},</p><p>We've received your payment of <strong>{{amount}}</strong> — your seat for <strong>{{workshop}}</strong> on {{date}} is confirmed.</p><p>Your receipt is attached.</p>" },
  { channel: "email", key: "email.refund_processed", name: "Refund processed", trigger: "refund.processed", category: "lifecycle",
    subject: "Your refund for {{workshop}} has been processed",
    body: "<p>Hi {{name}},</p><p>Your refund of <strong>{{amount}}</strong> for {{workshop}} has been processed and should reflect in a few working days.</p>" },
  { channel: "whatsapp", key: "wa.payment_success", name: "Payment confirmed (WhatsApp)", trigger: "payment.success", category: "lifecycle",
    body: "Hi {{name}}! ✅ Your payment of {{amount}} for {{workshop}} ({{date}}) is confirmed. We'll share the joining link before the session.",
    whatsapp: { header: "Youngness Institute", footer: "Reply STOP to opt out" } },
  { channel: "email", key: "email.workshop_tomorrow", name: "Workshop tomorrow reminder", trigger: "workshop.tomorrow", category: "reminder",
    subject: "Reminder: {{workshop}} is tomorrow",
    body: "<p>Hi {{name}},</p><p>Just a reminder that <strong>{{workshop}}</strong> is tomorrow at {{time}} ({{venue}}). See you there!</p>" },
];

async function main() {
  await connectDB();
  let created = 0;
  for (const t of DEFAULTS) if (!(await MessageTemplate.exists({ key: t.key }))) { await MessageTemplate.create(t); created += 1; }
  console.log(`✓ Templates ensured (${created} created, ${DEFAULTS.length - created} already present).`);
  await mongoose.disconnect();
  process.exit(0);
}
main().catch((e) => { console.error("✗ seedTemplates failed:", e.message); process.exit(1); });
