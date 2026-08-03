/**
 * main.js — 5th Biosciences Symposium, TU Darmstadt
 * Shared front-end behaviour for every page: sticky nav shadow, mobile menu
 * toggle, active-link highlighting and scroll-reveal animations.
 */
(function () {
  "use strict";

  /**
   * Adds a shadow to the sticky header once the page has been scrolled,
   * so it visually separates from the content beneath it.
   */
  function initStickyHeader() {
    var header = document.getElementById("site-header");
    if (!header) return;

    function onScroll() {
      if (window.scrollY > 8) {
        header.classList.add("scrolled");
      } else {
        header.classList.remove("scrolled");
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /**
   * Wires up the hamburger button to open/close the mobile navigation
   * drawer, and closes it again whenever a link inside it is clicked.
   */
  function initMobileNav() {
    var toggle = document.getElementById("nav-toggle");
    var links = document.getElementById("nav-links");
    if (!toggle || !links) return;

    function closeMenu() {
      toggle.classList.remove("active");
      links.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    }

    function toggleMenu() {
      var isOpen = links.classList.toggle("open");
      toggle.classList.toggle("active", isOpen);
      toggle.setAttribute("aria-expanded", String(isOpen));
    }

    toggle.addEventListener("click", toggleMenu);

    links.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", closeMenu);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeMenu();
    });
  }

  /**
   * Marks the navigation link matching the current page as active, so the
   * highlighted item stays correct even if a page is opened directly.
   */
  function initActiveLink() {
    var currentPage = window.location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll(".nav-links a[href]").forEach(function (link) {
      var href = link.getAttribute("href");
      link.classList.toggle("active", href === currentPage);
    });
  }

  /**
   * Fades and slides ".reveal" elements into view the first time they
   * scroll into the viewport, using IntersectionObserver where available.
   */
  function initScrollReveal() {
    var items = document.querySelectorAll(".reveal");
    if (!items.length) return;

    if (!("IntersectionObserver" in window)) {
      items.forEach(function (item) {
        item.classList.add("in-view");
      });
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );

    items.forEach(function (item) {
      observer.observe(item);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initStickyHeader();
    initMobileNav();
    initActiveLink();
    initScrollReveal();
  });
})();
