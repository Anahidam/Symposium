# 5th Biosciences Symposium — TU Darmstadt

A complete, static website for the 5th Biosciences Symposium at TU Darmstadt, with a
Google Apps Script + Google Sheets + Google Drive backend for registration. Built
with plain HTML5, CSS3 and vanilla ES6 JavaScript — no build step, no frameworks,
no Node.js, no PHP. Deployable directly on GitHub Pages.

## Project structure

```
biosymposium/
├── index.html            Homepage
├── registration.html      Registration form
├── programme.html         Full-day programme
├── venue.html             Venue & travel information
├── contact.html           Organising committee & contact details
├── privacy.html           Privacy policy (GDPR)
├── css/
│   ├── style.css          Design system & layout
│   └── mobile.css         Responsive overrides (tablet & phone)
├── js/
│   ├── main.js            Shared nav / scroll-reveal behaviour
│   └── registration.js    Registration form logic & AJAX submission
├── assets/
│   ├── images/            Logo & hero artwork
│   └── icons/             Feature card icons
├── backend/
│   ├── Code.gs            Apps Script backend (Sheets + Drive + email)
│   └── appsscript.json    Apps Script manifest
└── README.md
```

## How the backend works

The registration form (`registration.html` + `js/registration.js`) submits the form
data — plus the optional TOC upload, base64-encoded — via `fetch()` as a POST
request to a Google Apps Script Web App. `backend/Code.gs`:

1. Validates the incoming fields.
2. Saves the uploaded TOC file (if any) into a `TOC Uploads/Talk` or
   `TOC Uploads/Poster` folder in Google Drive, depending on the contribution type.
3. Appends a row to the **Registrations** sheet with the Drive file link.
4. Sends the registrant an HTML confirmation email.
5. Returns a JSON response (`{"status":"success"}` or `{"status":"error", ...}`)
   that the front end uses to show the success screen or an error message.

## Setup guide

### 1. Create a Google Sheet

Go to [sheets.google.com](https://sheets.google.com) and create a new, blank
spreadsheet. Name it something like **"5th Biosciences Symposium — Registrations"**.
You don't need to add any headers manually — the backend creates a
`Registrations` sheet and header row automatically on the first submission.

### 2. Create a Drive folder (optional)

You don't need to create anything manually in Drive either: the backend
automatically creates a `TOC Uploads` folder (with `Talk` and `Poster`
subfolders) the first time a file is uploaded, in the Drive of whichever
account the script runs as. If you'd like the uploads to live in a specific
shared folder instead, create it now and adapt `saveTocFile()` in `Code.gs`
accordingly.

### 3. Paste the Apps Script

1. Open the Google Sheet from step 1.
2. Go to **Extensions → Apps Script**.
3. Delete the default contents of `Code.gs` and paste in the contents of
   [`backend/Code.gs`](backend/Code.gs).
4. Click the gear icon (**Project Settings**) and confirm/set the Script's
   manifest to match [`backend/appsscript.json`](backend/appsscript.json) —
   or open **Project Settings → Show "appsscript.json" manifest file in
   editor**, then replace its contents with that file.
5. Save the project (**Ctrl/Cmd + S**), giving it a name like
   `Biosciences Symposium Backend`.

### 4. Deploy the Apps Script as a Web App

1. In the Apps Script editor, click **Deploy → New deployment**.
2. Click the gear icon next to "Select type" and choose **Web app**.
3. Set:
   - **Execute as:** Me (your account)
   - **Who has access:** Anyone
4. Click **Deploy**.
5. Authorise the requested permissions (Sheets, Drive, Gmail/MailApp) when
   prompted — this is expected, since the script needs to write to your
   Sheet, upload to your Drive, and send confirmation emails on your behalf.
6. Copy the **Web app URL** shown after deployment. It looks like:
   `https://script.google.com/macros/s/XXXXXXXXXXXXXXXX/exec`

> Whenever you edit `Code.gs` after this point, use **Deploy → Manage
> deployments → Edit (pencil icon) → New version** to publish your changes —
> simply saving the file does not update the live Web App.

### 5. Replace the Web App URL in the front end

Open [`js/registration.js`](js/registration.js) and replace the placeholder
at the top of the file:

```js
var APPS_SCRIPT_URL = "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec";
```

with the Web App URL you copied in step 4.

### 6. Push the project to GitHub

From inside the `biosymposium` folder:

```bash
git init
git add .
git commit -m "Initial commit: 5th Biosciences Symposium website"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

### 7. Enable GitHub Pages

1. On GitHub, go to your repository's **Settings → Pages**.
2. Under **Build and deployment → Source**, select **Deploy from a branch**.
3. Choose the **main** branch and the **/ (root)** folder (or `/biosymposium`
   if you pushed the parent folder — adjust so `index.html` sits at the
   published root).
4. Save. GitHub will publish your site at:
   `https://<your-username>.github.io/<your-repo>/`

It can take a minute or two for the site to go live after the first deploy.

### 8. Generate a QR code

Once your GitHub Pages URL is live, generate a QR code that links directly to
the registration page (e.g. `https://<your-username>.github.io/<your-repo>/registration.html`)
using any QR code generator (e.g. [qr-code-generator.com](https://www.qr-code-generator.com/)
or the `qrencode` CLI tool). Add the QR code image to your printed posters and
flyers so attendees can register directly from their phones.

## Local development

Because the site is fully static, you can preview it locally by simply
opening `index.html` in a browser, or by serving the folder with any static
file server, for example:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`. Note that the registration form's AJAX
submission requires the Apps Script Web App URL from step 5 to be configured
and reachable — file:// URLs work for browsing, but submitting the form
requires the page to be served over http:// or https://.

## Customising the design

All colours, spacing and typography are defined as CSS custom properties at
the top of [`css/style.css`](css/style.css) (`:root { ... }`), so the green
(`#0F5A43`) and gold (`#B8943A`) theme can be adjusted from a single place.
Responsive breakpoints live in [`css/mobile.css`](css/mobile.css).
