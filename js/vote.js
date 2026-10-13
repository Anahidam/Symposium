/**
 * vote.js — 5th Biosciences Symposium, TU Darmstadt
 * Drives the Democratic Voting ballot: renders the nominee lists, enforces
 * one vote per device via a random anonymous token stored in localStorage,
 * and submits the vote to the Google Apps Script backend.
 */
(function () {
  "use strict";

  /**
   * REPLACE THIS with the URL of your deployed voting Google Apps Script Web
   * App (a separate deployment from the registration one, bound to its own
   * private Sheet). It must end in /exec.
   */
  var APPS_SCRIPT_URL = "REPLACE_WITH_VOTE_APPS_SCRIPT_URL";

  var STORAGE_TOKEN = "symposium_vote_device_token";
  var STORAGE_VOTED = "symposium_vote_cast";

  var TALK_NOMINEES = [
    ["Hui Zhang", "AG Cardoso"],
    ["Patrick Reinmöller", "AG Dann"],
    ["Justin Teixeira Pereira Bassiaridis", "AG Hess"],
    ["Yunwei Hu", "AG Löwer"],
    ["Teodora Nazare", "AG Mirzapour"],
    ["Vincent Gunawan", "AG Süß"],
    ["Michał Mozolewski", "AG Waldminghaus"],
    ["Hongfei Liu", "Prof. Heinz Köppl"],
    ["Yannick Burgdorf", "Hochschule Darmstadt (h_da)"],
    ["Lina Dammel", "Julius Kühn-Institut (JKI)"],
    ["Celine Pana", "Uniklinikum Frankfurt"]
  ];

  var POSTER_NOMINEES = [
    ["Ishita Jain", "AG Cardoso"],
    ["Vjosa Berisha", "AG Dann"],
    ["Anne-Christin Pohland", "AG Dann"],
    ["Till Pfeifer", "AG Heun"],
    ["Ahmed Bulldan", "AG Löwer"],
    ["MohammadSadegh Zaman", "AG Mirzapour"],
    ["Arooj Sajjad", "AG Poppinga"],
    ["Olga Becker", "AG Süß"],
    ["Alexandra Neradt", "AG Waldminghaus"],
    ["Iurii Sheludko", "AG Warzecha"],
    ["Caroline Erler", "Uniklinikum Frankfurt"],
    ["Daniel Osmar Velazquez", "Uniklinikum Frankfurt"],
    ["Jeremie Marlhens", "Prof. Heinz Köppl"]
  ];

  function getDeviceToken() {
    var token = null;
    try {
      token = localStorage.getItem(STORAGE_TOKEN);
      if (!token) {
        token = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
        localStorage.setItem(STORAGE_TOKEN, token);
      }
    } catch (e) {
      // localStorage unavailable (private browsing, etc.) — fall back to a
      // per-session token; the one-vote-per-device check then relies on the
      // backend's own record for this token only within this page load.
      token = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
    }
    return token;
  }

  function hasVoted() {
    try {
      return localStorage.getItem(STORAGE_VOTED) === "yes";
    } catch (e) {
      return false;
    }
  }

  function markVoted() {
    try {
      localStorage.setItem(STORAGE_VOTED, "yes");
    } catch (e) {}
  }

  function renderNominees(container, nominees, groupName) {
    nominees.forEach(function (n, i) {
      var id = groupName + "-" + i;
      var wrap = document.createElement("div");
      wrap.className = "nominee";

      var input = document.createElement("input");
      input.type = "radio";
      input.name = groupName;
      input.id = id;
      input.value = n[0];
      input.required = true;

      var label = document.createElement("label");
      label.setAttribute("for", id);

      var who = document.createElement("span");
      who.className = "who";
      var nameEl = document.createElement("span");
      nameEl.className = "nominee-name";
      nameEl.textContent = n[0];
      var groupEl = document.createElement("span");
      groupEl.className = "nominee-group";
      groupEl.textContent = n[1];
      who.appendChild(nameEl);
      who.appendChild(groupEl);

      var dot = document.createElement("span");
      dot.className = "dot";

      label.appendChild(who);
      label.appendChild(dot);

      wrap.appendChild(input);
      wrap.appendChild(label);
      container.appendChild(wrap);
    });
  }

  function initVoteForm() {
    var form = document.getElementById("ballot-form");
    if (!form) return;

    var votedScreen = document.getElementById("voted-screen");
    if (hasVoted()) {
      form.style.display = "none";
      if (votedScreen) votedScreen.classList.add("show");
      return;
    }

    renderNominees(document.getElementById("talkList"), TALK_NOMINEES, "bestTalk");
    renderNominees(document.getElementById("posterList"), POSTER_NOMINEES, "bestPoster");

    var submitBtn = document.getElementById("submit-btn");
    var spinner = document.getElementById("submit-spinner");
    var label = document.getElementById("submit-label");
    var status = document.getElementById("form-status");
    var successScreen = document.getElementById("success-screen");

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      status.textContent = "";
      status.classList.remove("error");

      var talk = form.querySelector('input[name="bestTalk"]:checked');
      var poster = form.querySelector('input[name="bestPoster"]:checked');
      if (!talk || !poster) {
        status.textContent = "Please select one nominee in each category.";
        status.classList.add("error");
        return;
      }

      submitBtn.disabled = true;
      spinner.classList.add("show");
      label.textContent = "Submitting...";

      var data = new FormData();
      data.append("deviceToken", getDeviceToken());
      data.append("bestTalk", talk.value);
      data.append("bestPoster", poster.value);

      fetch(APPS_SCRIPT_URL, {
        method: "POST",
        body: data,
      })
        .then(function (response) {
          return response.json();
        })
        .then(function (result) {
          if (result && result.status === "success") {
            markVoted();
            form.style.display = "none";
            successScreen.classList.add("show");
            successScreen.scrollIntoView({ behavior: "smooth", block: "start" });
          } else if (result && result.status === "error" && /already voted/i.test(result.message || "")) {
            markVoted();
            form.style.display = "none";
            if (votedScreen) votedScreen.classList.add("show");
          } else {
            throw new Error((result && result.message) || "Submission failed. Please try again.");
          }
        })
        .catch(function (error) {
          status.textContent = "Something went wrong: " + error.message + " Please try again.";
          status.classList.add("error");
        })
        .finally(function () {
          submitBtn.disabled = false;
          spinner.classList.remove("show");
          label.textContent = "Submit Vote";
        });
    });
  }

  document.addEventListener("DOMContentLoaded", initVoteForm);
})();
