/**
 * Code.gs — Backend for the 5th Biosciences Symposium registration form.
 *
 * Deployed as a Google Apps Script Web App, bound to a Google Sheet.
 * Receives registration submissions via POST, stores them in the bound
 * Sheet, and sends the registrant a confirmation email.
 *
 * See README.md for full setup and deployment instructions.
 */

// ---- Configuration -------------------------------------------------------

var SHEET_NAME = "Registrations";
var SYMPOSIUM_NAME = "5th Biosciences Symposium";
var SYMPOSIUM_DATE = "20 October 2026";
var SYMPOSIUM_VENUE = "Biology Building B2|03, Room 109, TU Darmstadt";

// Registration stays open through the end of 9 October 2026 (Europe/Berlin)
// and closes automatically at the start of 10 October 2026. Enforced here too
// (not just in the front end) so a direct POST after the deadline is also
// rejected.
var REGISTRATION_DEADLINE = new Date("2026-10-10T00:00:00+02:00");

var SHEET_HEADERS = [
  "Timestamp",
  "First Name",
  "Last Name",
  "Email",
  "Research Group",
  "Position",
  "Contribution",
  "Flash Talk",
  "Presentation Title",
  "Abstract",
  "Notes",
];

/**
 * Handles GET requests. With no parameters, just confirms the Web App is
 * live. With ?action=talkGroups, returns the list of research groups that
 * already have a Scientific Talk registered, so the form can block that
 * option for later registrants from the same group (Poster stays open).
 */
function doGet(e) {
  var action = e && e.parameter && e.parameter.action;

  if (action === "talkGroups") {
    return jsonResponse({ status: "success", groups: getGroupsWithTalk() });
  }

  return jsonResponse({ status: "ok", message: SYMPOSIUM_NAME + " registration endpoint is live." });
}

/**
 * Strips a leading "AG " (case-insensitive) so group names are compared
 * consistently regardless of whether they were stored with or without the
 * prefix — older sheet rows use "AG Dann", the registration form's dropdown
 * submits the bare surname ("Dann").
 */
function normalizeGroup(group) {
  return String(group || "").trim().replace(/^AG\s+/i, "").trim();
}

/**
 * Scans the Registrations sheet and returns the distinct list of research
 * groups (normalized, without any "AG " prefix) that already have a
 * "Scientific Talk" contribution registered.
 */
function getGroupsWithTalk() {
  var sheet = getOrCreateSheet();
  var rows = sheet.getDataRange().getValues();
  var groups = [];

  for (var i = 1; i < rows.length; i++) {
    var group = normalizeGroup(rows[i][4]);
    var contribution = String(rows[i][6] || "").trim();

    if (contribution === "Scientific Talk" && group && groups.indexOf(group) === -1) {
      groups.push(group);
    }
  }

  return groups;
}

/**
 * Handles POST requests from the registration form: validates the payload,
 * stores it in the Sheet, sends a confirmation email, and returns a JSON
 * success/error response.
 */
function doPost(e) {
  try {
    if (new Date() >= REGISTRATION_DEADLINE) {
      return jsonResponse({ status: "error", message: "Registration is closed. The deadline (9 October 2026) has passed." });
    }

    var data = parseRequest(e);

    appendRegistrationRow(data);
    sendConfirmationEmail(data);

    return jsonResponse({ status: "success", message: "Registration received." });
  } catch (error) {
    return jsonResponse({ status: "error", message: error && error.message ? error.message : String(error) });
  }
}

/**
 * Extracts and lightly sanitises the expected fields from the incoming
 * request's form parameters.
 */
function parseRequest(e) {
  var p = (e && e.parameter) || {};

  var required = ["firstName", "lastName", "email", "institute", "position", "contribution", "presentationTitle"];
  required.forEach(function (key) {
    if (!p[key] || String(p[key]).trim() === "") {
      throw new Error("Missing required field: " + key);
    }
  });

  return {
    firstName: String(p.firstName).trim(),
    lastName: String(p.lastName).trim(),
    email: String(p.email).trim(),
    institute: String(p.institute).trim(),
    position: String(p.position).trim(),
    contribution: String(p.contribution).trim(),
    flashTalk: String(p.flashTalk || "No").trim(),
    presentationTitle: String(p.presentationTitle).trim(),
    abstract: String(p.abstract || "").trim(),
    notes: String(p.notes || "").trim(),
  };
}

/**
 * Appends one row representing this registration to the bound Sheet,
 * creating the sheet and its header row on first use.
 */
function appendRegistrationRow(data) {
  var sheet = getOrCreateSheet();

  sheet.appendRow([
    new Date(),
    data.firstName,
    data.lastName,
    data.email,
    data.institute,
    data.position,
    data.contribution,
    data.flashTalk,
    data.presentationTitle,
    data.abstract,
    data.notes,
  ]);
}

/**
 * Returns the "Registrations" sheet in the active spreadsheet, creating it
 * with the correct header row if it doesn't exist yet.
 */
function getOrCreateSheet() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
    sheet.appendRow(SHEET_HEADERS);
    sheet.setFrozenRows(1);
  }

  return sheet;
}

/**
 * Sends the registrant an HTML confirmation email summarising their
 * registration details.
 */
function sendConfirmationEmail(data) {
  var subject = "Registration Confirmation – " + SYMPOSIUM_NAME;
  var htmlBody =
    '<div style="font-family: Arial, sans-serif; color: #1c2b27; max-width: 560px; margin: 0 auto;">' +
    '<h2 style="color: #0f5a43;">Registration received!</h2>' +
    "<p>Dear " + escapeHtml(data.firstName) + " " + escapeHtml(data.lastName) + ",</p>" +
    "<p>Thank you for registering for the <strong>" + SYMPOSIUM_NAME + "</strong>. Here is a summary of your registration:</p>" +
    '<table style="width: 100%; border-collapse: collapse; margin: 16px 0;">' +
    emailRow("Contribution", data.contribution) +
    emailRow("Presentation Title", data.presentationTitle) +
    emailRow("Date", SYMPOSIUM_DATE) +
    emailRow("Venue", SYMPOSIUM_VENUE) +
    "</table>" +
    '<p style="color: #5a6b66;">If any of these details are incorrect, simply reply to this email and we will update your registration.</p>' +
    '<p style="color: #5a6b66;">We look forward to seeing you at the symposium!</p>' +
    '<p style="margin-top: 24px; font-size: 0.85em; color: #9db6ad;">5th Biosciences Symposium — TU Darmstadt</p>' +
    "</div>";

  MailApp.sendEmail({
    to: data.email,
    subject: subject,
    htmlBody: htmlBody,
  });
}

/**
 * Renders a single labelled row for the confirmation email's summary table.
 */
function emailRow(label, value) {
  return (
    '<tr>' +
    '<td style="padding: 6px 12px 6px 0; font-weight: bold; color: #0f5a43;">' + escapeHtml(label) + '</td>' +
    '<td style="padding: 6px 0;">' + escapeHtml(value) + '</td>' +
    "</tr>"
  );
}

/**
 * Escapes a string for safe inclusion inside HTML email content.
 */
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Wraps a JavaScript object as a JSON ContentService response.
 */
function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
