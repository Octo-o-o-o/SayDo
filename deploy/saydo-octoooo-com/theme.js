/* SayDo 官网交互:亮暗主题切换 + 移动端导航。
   照搬 console Layout.tsx 方案:data-theme + localStorage("saydo.theme") + prefers-color-scheme。
   防 FOUC 的早期 data-theme 设置由各 HTML <head> 内联同步脚本完成(渲染前生效);
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

    // 移动端汉堡菜单
    var menuBtn = document.querySelector("[data-menu-toggle]");
    var nav = document.querySelector("[data-nav]");
    if (menuBtn && nav) {
      menuBtn.addEventListener("click", function () {
        var open = nav.classList.toggle("is-open");
        menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
      });
      // 点击导航链接后收起
      nav.querySelectorAll("a").forEach(function (a) {
        a.addEventListener("click", function () {
          nav.classList.remove("is-open");
          menuBtn.setAttribute("aria-expanded", "false");
        });
      });
    }

    // 账本示例日期:动态填当天,避免示例写死日期过期(no-JS 时保持静态兜底「今天」)
    var today = document.querySelector("[data-today]");
    if (today) {
      var d = new Date();
      var mm = String(d.getMonth() + 1).padStart(2, "0");
      var dd = String(d.getDate()).padStart(2, "0");
      today.textContent = d.getFullYear() + "." + mm + "." + dd;
    }

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
  });
})();
