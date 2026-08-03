/**
 * registration.js — 5th Biosciences Symposium, TU Darmstadt
 * Drives the registration form: conditional fields, live validation, the
 * character counter, drag & drop upload and the AJAX submission to the
 * Google Apps Script backend.
 */
(function () {
  "use strict";

  /**
   * REPLACE THIS with the URL of your deployed Google Apps Script Web App
   * (see README.md, step "Deploy Apps Script"). It must end in /exec.
   */
  var APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxpjiybwSdBpAzDJolF7-8W86KtyRO1CH6Vi6pWpPezyriVUxK2n3dMbG04HAQbsl0THw/exec";

  var MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
  var ALLOWED_EXTENSIONS = [".pdf", ".docx"];
  var ALLOWED_TYPES = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];

  var selectedFile = null;

  /**
   * Entry point: wires up every interactive piece of the registration form.
   * Does nothing on pages that don't contain the form.
   */
  function initRegistrationForm() {
    var form = document.getElementById("registration-form");
    if (!form) return;

    initContributionLogic();
    initCharCounter();
    initDropzone();
    initSubmitHandler(form);
  }

  /**
   * Shows the "Flash Talk" checkbox only when "Poster" is selected, and
   * clears/hides it again for "Scientific Talk" so it is never submitted
   * for talk presenters.
   */
  function initContributionLogic() {
    var radios = document.querySelectorAll('input[name="contribution"]');
    var flashBlock = document.getElementById("flashtalk-block");
    var flashCheckbox = document.getElementById("flashTalk");

    function update() {
      var selected = document.querySelector('input[name="contribution"]:checked');
      var isPoster = !!selected && selected.value === "Poster";

      if (isPoster) {
        flashBlock.classList.add("show");
      } else {
        flashBlock.classList.remove("show");
        flashCheckbox.checked = false;
      }
    }

    radios.forEach(function (radio) {
      radio.addEventListener("change", update);
    });

    update();
  }

  /**
   * Keeps the live character counter under the abstract textarea in sync,
   * warning the user visually as they approach the 3000-character limit.
   */
  function initCharCounter() {
    var textarea = document.getElementById("abstract");
    var counter = document.getElementById("abstract-count");
    if (!textarea || !counter) return;

    var limit = parseInt(textarea.getAttribute("maxlength"), 10) || 3000;

    function update() {
      var length = textarea.value.length;
      counter.textContent = String(length);

      var wrap = counter.closest(".char-counter");
      wrap.classList.remove("near-limit", "at-limit");
      if (length >= limit) {
        wrap.classList.add("at-limit");
      } else if (length >= limit * 0.9) {
        wrap.classList.add("near-limit");
      }
    }

    textarea.addEventListener("input", update);
    update();
  }

  /**
   * Enables click-to-browse and drag & drop uploading of the TOC file,
   * including client-side validation of file type and size.
   */
  function initDropzone() {
    var dropzone = document.getElementById("dropzone");
    var input = document.getElementById("tocFile");
    var preview = document.getElementById("file-preview");
    var fileNameEl = document.getElementById("file-name");
    var removeBtn = document.getElementById("file-remove");
    var errorEl = document.getElementById("file-error");
    if (!dropzone || !input) return;

    function showFile(file) {
      selectedFile = file;
      fileNameEl.textContent = file.name + " (" + Math.round(file.size / 1024) + " KB)";
      preview.classList.add("show");
      errorEl.classList.remove("show");
    }

    function clearFile() {
      selectedFile = null;
      input.value = "";
      preview.classList.remove("show");
    }

    function handleFile(file) {
      if (!file) return;

      var extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
      var validType = ALLOWED_TYPES.indexOf(file.type) !== -1 || ALLOWED_EXTENSIONS.indexOf(extension) !== -1;
      var validSize = file.size <= MAX_FILE_SIZE;

      if (!validType || !validSize) {
        errorEl.textContent = !validType
          ? "Only PDF or DOCX files are accepted."
          : "File exceeds the maximum size of 10 MB.";
        errorEl.classList.add("show");
        clearFile();
        return;
      }

      showFile(file);
    }

    dropzone.addEventListener("click", function () {
      input.click();
    });

    dropzone.addEventListener("keydown", function (event) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        input.click();
      }
    });

    input.addEventListener("change", function () {
      handleFile(input.files[0]);
    });

    ["dragenter", "dragover"].forEach(function (eventName) {
      dropzone.addEventListener(eventName, function (event) {
        event.preventDefault();
        dropzone.classList.add("dragover");
      });
    });

    ["dragleave", "drop"].forEach(function (eventName) {
      dropzone.addEventListener(eventName, function (event) {
        event.preventDefault();
        dropzone.classList.remove("dragover");
      });
    });

    dropzone.addEventListener("drop", function (event) {
      var file = event.dataTransfer.files && event.dataTransfer.files[0];
      handleFile(file);
    });

    removeBtn.addEventListener("click", function (event) {
      event.stopPropagation();
      clearFile();
    });
  }

  /**
   * Validates a single required text/email input, toggling its error
   * message and "invalid" style. Returns whether the field is valid.
   */
  function validateField(input, checkFn) {
    var group = input.closest(".form-group");
    var errorEl = group ? group.querySelector(".field-error") : null;
    var valid = checkFn(input.value.trim());

    input.classList.toggle("invalid", !valid);
    if (errorEl) errorEl.classList.toggle("show", !valid);

    return valid;
  }

  /**
   * Validates a required radio-button group, showing its shared error
   * message when nothing has been selected.
   */
  function validateRadioGroup(name, errorId) {
    var checked = document.querySelector('input[name="' + name + '"]:checked');
    var errorEl = document.getElementById(errorId);
    var valid = !!checked;

    if (errorEl) errorEl.classList.toggle("show", !valid);
    return valid;
  }

  /**
   * Runs full client-side validation across the form and returns true only
   * if every required field passes.
   */
  function validateForm(form) {
    var isEmail = function (value) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    };
    var notEmpty = function (value) {
      return value.length > 0;
    };

    var results = [
      validateField(form.firstName, notEmpty),
      validateField(form.lastName, notEmpty),
      validateField(form.email, isEmail),
      validateField(form.institute, notEmpty),
      validateField(form.presentationTitle, notEmpty),
      validateField(form.authors, notEmpty),
      validateRadioGroup("position", "position-error"),
      validateRadioGroup("contribution", "contribution-error"),
    ];

    var consent = document.getElementById("consent");
    var consentError = document.getElementById("consent-error");
    var consentValid = consent.checked;
    consentError.classList.toggle("show", !consentValid);
    results.push(consentValid);

    return results.every(Boolean);
  }

  /**
   * Reads the currently selected file as a base64 string so it can be sent
   * to Apps Script inside a plain form field (Apps Script has no native
   * multipart file API, so base64-in-a-field is the standard bridge).
   */
  function readFileAsBase64(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var result = reader.result;
        var base64 = result.substring(result.indexOf(",") + 1);
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Builds the FormData payload for the Apps Script backend from the form's
   * current field values, plus the optional base64-encoded TOC upload.
   */
  function buildPayload(form, base64File) {
    var data = new FormData();
    data.append("firstName", form.firstName.value.trim());
    data.append("lastName", form.lastName.value.trim());
    data.append("email", form.email.value.trim());
    data.append("institute", form.institute.value.trim());
    data.append("position", (form.querySelector('input[name="position"]:checked') || {}).value || "");
    data.append("contribution", (form.querySelector('input[name="contribution"]:checked') || {}).value || "");
    data.append("flashTalk", form.flashTalk.checked ? "Yes" : "No");
    data.append("presentationTitle", form.presentationTitle.value.trim());
    data.append("authors", form.authors.value.trim());
    data.append("keywords", form.keywords.value.trim());
    data.append("abstract", form.abstract.value.trim());
    data.append("notes", form.notes.value.trim());

    if (selectedFile && base64File) {
      data.append("tocFileName", selectedFile.name);
      data.append("tocFileType", selectedFile.type || "application/octet-stream");
      data.append("tocFileData", base64File);
    }

    return data;
  }

  /**
   * Wires up form submission: validates, shows the loading spinner, sends
   * the payload to Apps Script via fetch, and reveals the success screen
   * (or an inline error) based on the response — all without a page reload.
   */
  function initSubmitHandler(form) {
    var submitBtn = document.getElementById("submit-btn");
    var spinner = document.getElementById("submit-spinner");
    var label = document.getElementById("submit-label");
    var status = document.getElementById("form-status");
    var successScreen = document.getElementById("success-screen");

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      status.textContent = "";
      status.classList.remove("error");

      if (!validateForm(form)) {
        var firstInvalid = form.querySelector(".invalid, .field-error.show");
        if (firstInvalid) {
          var target = firstInvalid.classList.contains("field-error")
            ? firstInvalid.previousElementSibling || firstInvalid.parentElement
            : firstInvalid;
          if (target && target.scrollIntoView) {
            target.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }
        return;
      }

      submitBtn.disabled = true;
      spinner.classList.add("show");
      label.textContent = "Submitting...";

      var fileTask = selectedFile ? readFileAsBase64(selectedFile) : Promise.resolve(null);

      fileTask
        .then(function (base64File) {
          var payload = buildPayload(form, base64File);
          return fetch(APPS_SCRIPT_URL, {
            method: "POST",
            body: payload,
          });
        })
        .then(function (response) {
          return response.json();
        })
        .then(function (result) {
          if (result && result.status === "success") {
            form.style.display = "none";
            successScreen.classList.add("show");
            successScreen.scrollIntoView({ behavior: "smooth", block: "start" });
          } else {
            throw new Error((result && result.message) || "Submission failed. Please try again.");
          }
        })
        .catch(function (error) {
          status.textContent = "Something went wrong: " + error.message + " Please try again or contact the organisers.";
          status.classList.add("error");
        })
        .finally(function () {
          submitBtn.disabled = false;
          spinner.classList.remove("show");
          label.textContent = "Submit Registration";
        });
    });
  }

  document.addEventListener("DOMContentLoaded", initRegistrationForm);
})();
