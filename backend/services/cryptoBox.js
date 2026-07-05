"use strict";
/**
 * Symmetric encryption for settings secrets (AES-256-GCM). The key derives from
 * SETTINGS_ENC_KEY (preferred) or JWT_SECRET so no extra setup is required, but
 * rotating SETTINGS_ENC_KEY changes the key. Ciphertext format:
 *   enc:v1:<base64 iv>.<base64 tag>.<base64 ciphertext>
 */
const crypto = require("crypto");
const config = require("../config");

const KEY = crypto.createHash("sha256").update(String(process.env.SETTINGS_ENC_KEY || config.jwt.secret || "youngness-fallback-key")).digest(); // 32 bytes
const PREFIX = "enc:v1:";

function encrypt(plain) {
  if (plain == null || plain === "") return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const ct = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + `${iv.toString("base64")}.${tag.toString("base64")}.${ct.toString("base64")}`;
}

function decrypt(value) {
  if (!value || typeof value !== "string" || !value.startsWith(PREFIX)) return "";
  try {
    const [ivB, tagB, ctB] = value.slice(PREFIX.length).split(".");
    const decipher = crypto.createDecipheriv("aes-256-gcm", KEY, Buffer.from(ivB, "base64"));
    decipher.setAuthTag(Buffer.from(tagB, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(ctB, "base64")), decipher.final()]).toString("utf8");
  } catch (_) {
    return "";
  }
}

const isEncrypted = (v) => typeof v === "string" && v.startsWith(PREFIX);
/** Masked hint for the UI: never the real value, just the last 4 chars. */
function mask(plain) {
  const s = String(plain || "");
  if (!s) return "";
  return "••••" + s.slice(-4);
}

module.exports = { encrypt, decrypt, isEncrypted, mask };
