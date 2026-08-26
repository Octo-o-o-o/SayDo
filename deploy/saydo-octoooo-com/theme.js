/* SayDo 官网交互:亮暗主题切换 + 移动端导航 + 顶栏滚动态 + 滚动入场 + Docs 目录选中。
   主题方案:data-theme + localStorage("saydo.theme") + prefers-color-scheme;
   防 FOUC 的早期 data-theme 设置由各 HTML <head> 内联同步脚本完成,
   本文件只接管按钮点击与持久化(DOMContentLoaded 后)。 */
(function () {
  "use strict";
  var KEY = "saydo.theme";
  var root = document.documentElement;

  function resolved() {
    var t = "";
    try { t = localStorage.getItem(KEY) || ""; } catch (e) {}
    if (t === "light" || t === "dark") return t;
    var mql = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)");
    return mql && mql.matches ? "dark" : "light";
  }

  document.addEventListener("DOMContentLoaded", function () {
    // 主题切换按钮:在亮/暗间切换并持久化(点击后不再跟随系统)
    document.querySelectorAll("[data-theme-toggle]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var next = resolved() === "dark" ? "light" : "dark";
        root.setAttribute("data-theme", next);
        try { localStorage.setItem(KEY, next); } catch (e) {}
      });
    });

    // 移动端汉堡菜单:切换开合;展开后点页面任何区域(除菜单按钮本身)都收起
    var menuBtn = document.querySelector("[data-menu-toggle]");
    var nav = document.querySelector("[data-nav]");
    if (menuBtn && nav) {
      menuBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        var open = nav.classList.toggle("is-open");
        menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
      });
      nav.querySelectorAll("a").forEach(function (a) {
        a.addEventListener("click", function () {
          nav.classList.remove("is-open");
          menuBtn.setAttribute("aria-expanded", "false");
        });
      });
      document.addEventListener("click", function (e) {
        if (!nav.classList.contains("is-open")) return;
        if (e.target === menuBtn || menuBtn.contains(e.target)) return;
        nav.classList.remove("is-open");
        menuBtn.setAttribute("aria-expanded", "false");
      });
      document.addEventListener("keydown", function (e) {
        if (e.key !== "Escape" || !nav.classList.contains("is-open")) return;
        nav.classList.remove("is-open");
        menuBtn.setAttribute("aria-expanded", "false");
      });
    }

    // 顶栏滚动态:离顶即加细线与浅影
    var header = document.querySelector(".site-header");
    if (header) {
      var onScroll = function () {
        header.classList.toggle("is-scrolled", window.scrollY > 4);
      };
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
    }

    // 账本示例日期:动态填当天,避免示例写死日期过期(no-JS 时保持静态兜底)
    var today = document.querySelector("[data-today]");
    if (today) {
      var d = new Date();
      var mm = String(d.getMonth() + 1).padStart(2, "0");
      var dd = String(d.getDate()).padStart(2, "0");
      today.textContent = d.getFullYear() + "." + mm + "." + dd;
    }

    // 页脚年份自动
    document.querySelectorAll("[data-year]").forEach(function (el) {
      el.textContent = String(new Date().getFullYear());
    });

    // 滚动入场:进入视口加 is-visible(CSS 配合 [data-reveal])
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { e.target.classList.add("is-visible"); io.unobserve(e.target); }
        });
      }, { rootMargin: "0px 0px -8% 0px", threshold: 0.04 });
      document.querySelectorAll("[data-reveal]").forEach(function (el) { io.observe(el); });
    } else {
      document.querySelectorAll("[data-reveal]").forEach(function (el) { el.classList.add("is-visible"); });
    }

    // Docs 目录:当前章用 .is-current + aria-current;点击锁定,滚动跟随
    (function initDocsToc() {
      var links = Array.prototype.slice.call(
        document.querySelectorAll(".docs-toc a[href^='#'], .docs-toc-mobile a[href^='#']")
      );
      if (!links.length) return;

      var ids = [];
      var seen = Object.create(null);
      links.forEach(function (a) {
        var id = (a.getAttribute("href") || "").slice(1);
        if (id && !seen[id]) {
          seen[id] = true;
          ids.push(id);
        }
      });
      var sections = [];
      ids.forEach(function (id) {
        var el = document.getElementById(id);
        if (el) sections.push(el);
      });
      if (!sections.length) return;

      var lockedUntil = 0;
      var ticking = false;
      var tocNav = document.querySelector(".docs-toc");

      function setCurrent(id) {
        if (!id) return;
        var href = "#" + id;
        links.forEach(function (a) {
          var on = a.getAttribute("href") === href;
          a.classList.toggle("is-current", on);
          if (on) a.setAttribute("aria-current", "location");
          else a.removeAttribute("aria-current");
        });
        if (!tocNav) return;
        var active = tocNav.querySelector("a.is-current");
        if (!active) return;
        var navRect = tocNav.getBoundingClientRect();
        var aRect = active.getBoundingClientRect();
        if (aRect.top < navRect.top + 8) tocNav.scrollTop += aRect.top - navRect.top - 8;
        else if (aRect.bottom > navRect.bottom - 8) tocNav.scrollTop += aRect.bottom - navRect.bottom + 8;
      }

      function markerY() {
        // 与 html { scroll-padding-top: 84px } 对齐:hash 落地时标题 top≈84,
        // 判定线必须不低于该值,否则会把当前章判成上一章。
        var pad = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop);
        if (!isFinite(pad) || pad < 0) pad = 84;
        var header = document.querySelector(".site-header");
        var bottom = header ? header.getBoundingClientRect().bottom : 0;
        return Math.max(pad + 24, Math.round(bottom + 24));
      }

      function idFromScroll() {
        var doc = document.documentElement;
        if (window.scrollY + window.innerHeight >= doc.scrollHeight - 8) {
          return sections[sections.length - 1].id;
        }
        var marker = markerY();
        var hashed = hashId();
        if (hashed) {
          var target = document.getElementById(hashed);
          if (target) {
            var ttop = target.getBoundingClientRect().top;
            if (ttop <= marker && ttop >= -32) return hashed;
          }
        }
        var id = sections[0].id;
        for (var i = 0; i < sections.length; i++) {
          if (sections[i].getBoundingClientRect().top <= marker) id = sections[i].id;
          else break;
        }
        return id;
      }

      function hashId() {
        var raw = location.hash ? location.hash.slice(1) : "";
        if (!raw) return "";
        try { raw = decodeURIComponent(raw); } catch (e) {}
        return seen[raw] ? raw : "";
      }

      function updateFromScroll() {
        if (Date.now() < lockedUntil) return;
        setCurrent(idFromScroll());
      }

      function lock(id) {
        lockedUntil = Date.now() + 1400;
        setCurrent(id);
      }

      function applyHashOrScroll() {
        var id = hashId();
        if (id) lock(id);
        else setCurrent(idFromScroll());
      }

      links.forEach(function (a) {
        a.addEventListener("click", function () {
          var id = (a.getAttribute("href") || "").slice(1);
          if (!id) return;
          lock(id);
          var details = a.closest(".docs-toc-mobile");
          if (details) details.open = false;
        });
      });

      window.addEventListener("scroll", function () {
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(function () {
          ticking = false;
          updateFromScroll();
        });
      }, { passive: true });

      window.addEventListener("hashchange", applyHashOrScroll);
      if (document.readyState === "complete") applyHashOrScroll();
      else window.addEventListener("load", applyHashOrScroll);
      applyHashOrScroll();
    })();
  });
})();
