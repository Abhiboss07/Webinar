"use strict";
/**
 * Saves a registration as Pending BEFORE any payment. Maps the form fields to
 * the canonical sheet columns. Idempotent: the same regId upserts one row.
 * (Input is validated by middleware/validate.js before this runs.)
 */
const config = require("../config");
const sheetService = require("../services/sheetService");
const { clean } = require("../utils/helpers");

async function register(req, res) {
  try {
    const b = req.body || {};
    const regId = clean(b.regId);

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

    await sheetService.saveRegistration(reg);
    return res.json({ status: "success", regId: regId });
  } catch (err) {
    console.error("[register] error:", err.message);
    return res.status(502).json({ status: "error", message: "Could not save registration" });
  }
}

module.exports = { register };
