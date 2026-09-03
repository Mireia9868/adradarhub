/* ==========================================================================
   Ad Trend Radar — 动效层
   与业务解耦：只负责数字滚动、滚动进场、加载态扫描线。
   全部为渐进增强，脚本失效时页面仍完整可用。
   ========================================================================== */

(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------------------------------------------------------- 数字滚动 */

  var METRIC_IDS = ["metricAds", "metricHot", "metricCompetitors", "metricTrends", "metricBacklog"];

  function countUp(el, from, to) {
    var duration = reduceMotion ? 0 : 720;
    if (!duration) {
      el.textContent = String(to);
      return;
    }

    el.dataset.animating = "1";
    el.classList.add("is-counting");

    var start = performance.now();

    function frame(now) {
      var progress = Math.min(1, (now - start) / duration);
      // easeOutCubic
      var eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = String(Math.round(from + (to - from) * eased));
      if (progress < 1) {
        requestAnimationFrame(frame);
      } else {
        el.textContent = String(to);
        el.classList.remove("is-counting");
        delete el.dataset.animating;
      }
    }

    requestAnimationFrame(frame);
  }

  function handleMetric(el) {
    // 自己写入的中间帧不处理，避免无限循环
    if (el.dataset.animating === "1") return;

    var raw = String(el.textContent || "").trim();
    if (!raw) return;

    var target = Number(raw);
    if (!Number.isFinite(target)) return;

    var from = Number(el.dataset.value || 0);
    el.dataset.value = String(target);

    if (from === target) return;
    countUp(el, from, target);
  }

  METRIC_IDS.forEach(function (id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.dataset.value = "0";
    new MutationObserver(function () {
      handleMetric(el);
    }).observe(el, { childList: true, characterData: true, subtree: true });
  });

  /* ------------------------------------------------------------ 加载态扫描线 */

  var scanline = document.getElementById("scanline");
  var watchedButtons = [
    document.querySelector(".run-button"),
    document.getElementById("iterationButton"),
    document.getElementById("genButton"),
    document.getElementById("dsButton")
  ].filter(Boolean);

  function syncScanline() {
    if (!scanline) return;
    var busy = watchedButtons.some(function (button) {
      return button.disabled === true;
    });
    scanline.classList.toggle("is-active", busy);
  }

  watchedButtons.forEach(function (button) {
    new MutationObserver(syncScanline).observe(button, {
      attributes: true,
      attributeFilter: ["disabled"]
    });
  });

  /* ---------------------------------------------------------------- 滚动进场 */

  var panels = Array.prototype.slice.call(document.querySelectorAll(".panel"));
  if (!reduceMotion && "IntersectionObserver" in window && panels.length) {
    panels.forEach(function (panel) {
      panel.classList.add("reveal");
    });

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var index = Number(entry.target.dataset.revealIndex || 0);
          entry.target.style.transitionDelay = Math.min(index * 60, 300) + "ms";
          entry.target.classList.add("is-in");
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.06 }
    );

    panels.forEach(function (panel, index) {
      panel.dataset.revealIndex = String(index);
      observer.observe(panel);
    });
  }

  /* ----------------------------------------------------- 卡片入场错落（重渲染） */

  // 列表由 app.js 重建，CSS animation 会在元素创建时自动重播，
  // 这里只需保证首屏未出现在视口内的卡片不会因为动画停在初始帧。
  if (!reduceMotion) {
    var gridSelectors = [".ads-grid", ".trend-list", ".competitor-list", ".source-list"];
    var gridObserver =
      "IntersectionObserver" in window
        ? new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
              if (!entry.isIntersecting) return;
              var items = entry.target.children;
              for (var i = 0; i < items.length; i += 1) {
                items[i].style.animationPlayState = "running";
              }
              gridObserver.unobserve(entry.target);
            });
          })
        : null;

    if (gridObserver) {
      gridSelectors.forEach(function (selector) {
        document.querySelectorAll(selector).forEach(function (grid) {
          gridObserver.observe(grid);
        });
      });
    }
  }
})();
