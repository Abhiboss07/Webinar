"use strict";
/**
 * Saves a registration as Pending BEFORE any payment. Maps the form fields to
 * the canonical sheet columns. Idempotent: the same regId upserts one row.
 * (Input is validated by middleware/validate.js before this runs.)
 */
const config = require("../config");
const sheetService = require("../services/sheetService");
const registrationStore = require("../services/registrationStore");
const triggers = require("../services/triggers");
const Registration = require("../models/Registration");
const { clean } = require("../utils/helpers");

async function register(req, res) {
  try {
    const b = req.body || {};
    const regId = clean(b.regId);

    // Mirror into MongoDB first (best-effort; never throws). This means a lead is
    // captured for the dashboard even if the Sheets write below hiccups.
    const storedInDb = await registrationStore.upsertLead({
      regId,
      fullName: b.fullName, mobile: b.mobile, email: b.email, profession: b.profession,
      city: b.city, experience: b.experience, mode: b.mode,
      workshop: clean(b.workshop) || config.workshopName, source: b.source,
    });

    // Fire the registration-success comms off the Mongo capture (best-effort),
    // independent of the Sheets write below so a Sheets hiccup can't skip it.
    try { const doc = await Registration.findOne({ regId }).lean(); if (doc) await triggers.fire("registration.success", { registration: doc }); } catch (_) { /* ignore */ }

    const reg = {
      "Reg ID": regId,                              // upsert key column
      "Full Name": clean(b.fullName),
      "Mobile": clean(b.mobile),
      "Email": clean(b.email),
      "Profession": clean(b.profession),
      "City": clean(b.city),
      "Experience": clean(b.experience),
      "Preferred Mode": clean(b.mode),
      "Workshop": clean(b.workshop) || config.workshopName,
      "Payment Status": "Pending",
      "Source": clean(b.source),
    };

    // Same policy as verify-payment: the sheet is a mirror. If it hiccups but the
    // lead IS captured in MongoDB, the visitor must still proceed to payment —
    // log loudly for reconciliation instead of failing the registration.
    try {
      await sheetService.saveRegistration(reg);
    } catch (err) {
      if (!storedInDb) throw err; // nothing stored anywhere → real failure
      console.error("[register] sheet write failed (lead IS in MongoDB):", err.message, { regId });
    }
    return res.json({ status: "success", regId: regId });
  } catch (err) {
    console.error("[register] error:", err.message);
    return res.status(502).json({ status: "error", message: "Could not save registration" });
  }
}

module.exports = { register };
