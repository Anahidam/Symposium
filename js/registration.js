/**
 * registration.js — 5th Biosciences Symposium, TU Darmstadt
 * Drives the registration form: conditional fields, per-group talk
 * availability, live validation and the AJAX submission to the Google
 * Apps Script backend.
 */
(function () {
  "use strict";

  /**
   * REPLACE THIS with the URL of your deployed Google Apps Script Web App
   * (see README.md, step "Deploy Apps Script"). It must end in /exec.
   */
  var APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwPCVjIxHBT8siX49V6NCxIbg_eUiJh6Z6B0YN6sDFo8GKtyGkJ3ziqRM7hmNUJZZ8N/exec";

  var takenTalkGroups = [];

  /**
   * Entry point: wires up every interactive piece of the registration form.
   * Does nothing on pages that don't contain the form.
   */
  function initRegistrationForm() {
    var form = document.getElementById("registration-form");
    if (!form) return;

    initContributionLogic();
    initTalkAvailability();
    initSubmitHandler(form);
  }

  /**
   * Ensures only one Scientific Talk slot exists per research group: fetches
   * the list of groups that already have a talk registered, then disables
   * the "Scientific Talk" option whenever the selected group is on that
   * list. "Poster" is never affected and always stays available.
   */
  function initTalkAvailability() {
    var instituteSelect = document.getElementById("institute");
    if (!instituteSelect) return;

    instituteSelect.addEventListener("change", applyTalkAvailability);

    fetch(APPS_SCRIPT_URL + "?action=talkGroups")
      .then(function (response) {
        return response.json();
      })
      .then(function (result) {
        if (result && result.status === "success" && Array.isArray(result.groups)) {
          takenTalkGroups = result.groups;
          applyTalkAvailability();
        }
      })
      .catch(function () {
        // If the check can't be reached, fail open: leave Scientific Talk
        // selectable rather than blocking registration entirely.
      });
  }

  /**
   * Disables/enables the Scientific Talk radio based on whether the
   * currently selected research group already has a talk slot taken. If
   * Scientific Talk was selected and becomes unavailable, switches the
   * selection to Poster automatically.
   */
  function applyTalkAvailability() {
    var instituteSelect = document.getElementById("institute");
    var talkRadio = document.getElementById("contribution-talk");
    var posterRadio = document.getElementById("contribution-poster");
    var note = document.getElementById("talk-taken-note");
    if (!instituteSelect || !talkRadio) return;

    var group = instituteSelect.value;
    var isTaken = group && takenTalkGroups.indexOf(group) !== -1;

    talkRadio.disabled = isTaken;
    if (note) note.style.display = isTaken ? "block" : "none";

    if (isTaken && talkRadio.checked) {
      talkRadio.checked = false;
      posterRadio.checked = true;
      posterRadio.dispatchEvent(new Event("change"));
    }
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
   * Builds the FormData payload for the Apps Script backend from the form's
   * current field values.
   */
  function buildPayload(form) {
    var data = new FormData();
    data.append("firstName", form.firstName.value.trim());
    data.append("lastName", form.lastName.value.trim());
    data.append("email", form.email.value.trim());
    data.append("institute", form.institute.value.trim());
    data.append("position", (form.querySelector('input[name="position"]:checked') || {}).value || "");
    data.append("contribution", (form.querySelector('input[name="contribution"]:checked') || {}).value || "");
    data.append("flashTalk", form.flashTalk.checked ? "Yes" : "No");
    data.append("presentationTitle", form.presentationTitle.value.trim());
    data.append("abstract", form.abstract.value.trim());

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

      fetch(APPS_SCRIPT_URL, {
        method: "POST",
        body: buildPayload(form),
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
