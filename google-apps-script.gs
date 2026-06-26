/**
 * Youngness Institute — Sheets data layer (called by the Node backend only)
 * ========================================================================
 * This script is now a thin, secure persistence layer. Razorpay order creation
 * and signature verification live in the Node backend (which holds the secret);
 * this script just stores rows. Write actions require a shared token.
 *
 * POST actions (JSON body, routed by `action`):
 *   action:"register"  → upsert a row by "Reg ID" (Payment Status = Pending).
 *   action:"markPaid"  → set Payment Status = Paid + payment columns, by regId.
 * Both require `token` to equal the SHEET_SHARED_TOKEN script property.
 *
 * GET ?recent=1[&limit=][&callback=] → privacy-filtered recent registrations
 * (first name + city only) for the social-proof popup. PUBLIC (read-only, no token).
 *
 * SETUP:
 * 1. Sheet → Extensions → Apps Script → paste THIS file.
 * 2. Project Settings → Script properties → add SHEET_SHARED_TOKEN (must match
 *    the backend's SHEET_SHARED_TOKEN env var).
 * 3. Deploy → New deployment → Web app → Execute as: Me, Access: Anyone.
 * 4. Put the Web app URL in the backend's GOOGLE_SHEET_ENDPOINT.
 *    (The browser uses it too — read-only — via config/workshop-config.js integrations.sheetsEndpoint.)
 *
 * Columns: Timestamp, Reg ID, Full Name, Mobile, Email, Profession, City,
 * Experience, Preferred Mode, Workshop, Payment Status, Source, Order ID,
 * Payment ID, Signature, Payment Method, Amount, Transaction Time. (Dynamic —
 * they follow whatever keys the backend sends.)
 */

const SHEET_ID   = "";                 // "" if the script is bound to the sheet
const SHEET_NAME = "Registrations";
const REGID_COL  = "Reg ID";           // upsert key column
const FIRST_COLS = ["Timestamp", REGID_COL];

/* ------------------------------ routing ------------------------------ */
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action || "register";
    if (action === "register" || action === "markPaid") {
      const need = PropertiesService.getScriptProperties().getProperty("SHEET_SHARED_TOKEN");
      if (need && String(data.token || "") !== String(need)) {
        return json_({ result: "error", message: "Unauthorized" });
      }
    }
    if (action === "markPaid") return json_(handleMarkPaid_(data));
    return json_(handleRegister_(data));
  } catch (err) {
    return json_({ result: "error", message: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  const params = (e && e.parameter) || {};
  if (params.recent || params.callback) {
    const data = getRecentRegistrations_(Number(params.limit) || 12);
    if (params.callback) {
      return ContentService
        .createTextOutput(params.callback + "(" + JSON.stringify(data) + ")")
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return json_(data);
  }
  return json_({ status: "ok", service: "Youngness webinar registration" });
}

/* --------------------------- register (upsert) --------------------------- */
function handleRegister_(data) {
  const cols = {};
  Object.keys(data).forEach((k) => { if (k === "action" || k === "token") return; cols[k] = data[k]; });
  const regId = cols[REGID_COL] || "";
  const sheet = getSheet_();
  const headers = ensureHeaders_(sheet, Object.keys(cols));
  const rowIndex = regId ? findRowByRegId_(sheet, headers, regId) : -1;
  if (rowIndex === -1) {
    const rowValues = headers.map((h) => (h === "Timestamp" ? new Date() : (cols[h] != null ? cols[h] : "")));
    sheet.appendRow(rowValues);
  } else {
    updateRowByRegId_(regId, cols);   // update provided fields only
  }
  return { result: "success", regId: regId };
}

/* ----------------------------- mark as Paid ------------------------------ */
function handleMarkPaid_(data) {
  const regId = data.regId;
  if (!regId) return { result: "error", message: "Missing regId" };
  const fields = {};
  Object.keys(data).forEach((k) => { if (k === "action" || k === "token" || k === "regId") return; fields[k] = data[k]; });
  const ok = updateRowByRegId_(regId, fields);
  if (!ok) return { result: "error", message: "Registration not found for regId " + regId };
  return { result: "success" };
}

/* ----------------------------- popup (GET) ------------------------------- */
function getRecentRegistrations_(limit) {
  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const nameIdx = findCol_(headers, ["Full Name", "fullName", "name", "Name"]);
  const cityIdx = findCol_(headers, ["City", "city", "Location", "State"]);
  if (nameIdx === -1) return [];
  const n = Math.min(Math.max(limit, 1), lastRow - 1);
  const rows = sheet.getRange(lastRow - n + 1, 1, n, lastCol).getValues();
  const out = [];
  rows.forEach((r) => {
    const full = String(r[nameIdx] || "").trim();
    if (!full) return;
    const first = full.split(/\s+/)[0];
    const city = cityIdx !== -1 ? String(r[cityIdx] || "").trim() : "";
    out.push({ name: first, city: city });
  });
  return out.reverse();
}

/* ------------------------------- helpers --------------------------------- */
function ensureHeaders_(sheet, keys) {
  let headers = sheet.getLastRow() >= 1
    ? sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getValues()[0].filter(String)
    : [];
  if (headers.length === 0) { headers = FIRST_COLS.slice(); writeHeaders_(sheet, headers); }
  let changed = false;
  keys.forEach((k) => { if (k === "action" || k === "token") return; if (headers.indexOf(k) === -1) { headers.push(k); changed = true; } });
  if (changed) writeHeaders_(sheet, headers);
  return headers;
}

function updateRowByRegId_(regId, fields) {
  if (!regId) return false;
  const sheet = getSheet_();
  const headers = ensureHeaders_(sheet, Object.keys(fields).concat([REGID_COL]));
  const rowIndex = findRowByRegId_(sheet, headers, regId);
  if (rowIndex === -1) return false;
  Object.keys(fields).forEach((k) => {
    const col = headers.indexOf(k);
    if (col !== -1) sheet.getRange(rowIndex, col + 1).setValue(fields[k]);
  });
  return true;
}

function findRowByRegId_(sheet, headers, regId) {
  const idx = headers.indexOf(REGID_COL);
  if (idx === -1) return -1;
  const last = sheet.getLastRow();
  if (last < 2) return -1;
  const col = sheet.getRange(2, idx + 1, last - 1, 1).getValues();
  for (let i = 0; i < col.length; i++) { if (String(col[i][0]) === String(regId)) return i + 2; }
  return -1;
}

function findCol_(headers, candidates) {
  for (let i = 0; i < candidates.length; i++) {
    const idx = headers.indexOf(candidates[i]);
    if (idx !== -1) return idx;
  }
  return -1;
}

function getSheet_() {
  const ss = SHEET_ID ? SpreadsheetApp.openById(SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
}

function writeHeaders_(sheet, headers) {
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold");
  sheet.setFrozenRows(1);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* -------------------------------- test ----------------------------------- */
// Register a Pending lead, then mark it Paid — run once from the editor.
function testInsert() {
  const regId = "test_" + Date.now();
  handleRegister_({
    action: "register", "Reg ID": regId, "Full Name": "Test User", "Mobile": "+919999999999",
    "Email": "test@example.com", "Profession": "Nurse", "City": "Chennai", "Experience": "3–5 years",
    "Preferred Mode": "Online (Live)", "Workshop": "Career Workshop", "Payment Status": "Pending",
  });
  Logger.log(handleMarkPaid_({
    action: "markPaid", regId: regId, "Payment Status": "Paid", "Order ID": "order_test",
    "Payment ID": "pay_test", "Signature": "sig_test", "Payment Method": "upi", "Amount": 99,
    "Transaction Time": new Date().toISOString(),
  }));
}
