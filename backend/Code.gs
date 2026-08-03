/**
 * Code.gs — Backend for the 5th Biosciences Symposium registration form.
 *
 * Deployed as a Google Apps Script Web App, bound to a Google Sheet.
 * Receives registration submissions via POST, stores them in the bound
 * Sheet, uploads the optional TOC file to Google Drive, and sends the
 * registrant a confirmation email.
 *
 * See README.md for full setup and deployment instructions.
 */

// ---- Configuration -------------------------------------------------------

var SHEET_NAME = "Registrations";
var DRIVE_ROOT_FOLDER_NAME = "TOC Uploads";
var SYMPOSIUM_NAME = "5th Biosciences Symposium";
var SYMPOSIUM_DATE = "20 October 2026";
var SYMPOSIUM_VENUE = "Biology Building B2|03, Room 109, TU Darmstadt";

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
  "Authors",
  "Keywords",
  "Abstract",
  "TOC Drive Link",
  "Notes",
];

/**
 * Handles GET requests. Only used to confirm the Web App is deployed and
 * reachable — the registration form itself always submits via POST.
 */
function doGet() {
  return ContentService.createTextOutput(
    JSON.stringify({ status: "ok", message: SYMPOSIUM_NAME + " registration endpoint is live." })
  ).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Handles POST requests from the registration form: validates the payload,
 * stores it in the Sheet, uploads the TOC file (if any) to Drive, sends a
 * confirmation email, and returns a JSON success/error response.
 */
function doPost(e) {
  try {
    var data = parseRequest(e);
    var driveUrl = "";

    if (data.tocFileData && data.tocFileName) {
      driveUrl = saveTocFile(data);
    }

    appendRegistrationRow(data, driveUrl);
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

  var required = ["firstName", "lastName", "email", "institute", "position", "contribution", "presentationTitle", "authors"];
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
    authors: String(p.authors).trim(),
    keywords: String(p.keywords || "").trim(),
    abstract: String(p.abstract || "").trim(),
    notes: String(p.notes || "").trim(),
    tocFileName: p.tocFileName ? String(p.tocFileName).trim() : "",
    tocFileType: p.tocFileType ? String(p.tocFileType).trim() : "application/octet-stream",
    tocFileData: p.tocFileData ? String(p.tocFileData) : "",
  };
}

/**
 * Decodes the base64-encoded TOC upload and saves it into the Drive
 * subfolder matching the registrant's contribution type, returning the
 * file's shareable URL.
 */
function saveTocFile(data) {
  var bytes = Utilities.base64Decode(data.tocFileData);
  var blob = Utilities.newBlob(bytes, data.tocFileType, data.tocFileName);

  var rootFolder = getOrCreateFolder(DriveApp.getRootFolder(), DRIVE_ROOT_FOLDER_NAME);
  var subFolderName = data.contribution === "Poster" ? "Poster" : "Talk";
  var targetFolder = getOrCreateFolder(rootFolder, subFolderName);

  var file = targetFolder.createFile(blob);
  file.setName(data.lastName + "_" + data.firstName + "_" + data.tocFileName);

  return file.getUrl();
}

/**
 * Returns the child folder with the given name inside parentFolder,
 * creating it first if it does not already exist.
 */
function getOrCreateFolder(parentFolder, name) {
  var existing = parentFolder.getFoldersByName(name);
  if (existing.hasNext()) {
    return existing.next();
  }
  return parentFolder.createFolder(name);
}

/**
 * Appends one row representing this registration to the bound Sheet,
 * creating the sheet and its header row on first use.
 */
function appendRegistrationRow(data, driveUrl) {
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
    data.authors,
    data.keywords,
    data.abstract,
    driveUrl,
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
