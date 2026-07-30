// 管培生研发岗培训 · 章节级定位评论（utterances）
// 行为：每个 .module 的 h2 自动加「💬 本节讨论」按钮；
// 点击在该模块下方展开独立评论区（utterances，issue-term 用 pathname#id 区分）。
// 栏目 index（无 .module）则在页脚前放一个整页评论区。
(function () {
  "use strict";
  var REPO = "lyzbcy/computer-knowledge";
  var THEME = "github-light";

  function slugify(text, idx) {
    var t = (text || "").trim()
      .replace(/[、，。！？：；""''（）()【】《》\.,!?;:'"]/g, "")
      .replace(/\s+/g, "-");
    return t ? t : "sec-" + idx;
  }

  function makeUtterances(issueTerm) {
    var s = document.createElement("script");
    s.src = "https://utteranc.es/client.js";
    s.setAttribute("repo", REPO);
    s.setAttribute("issue-term", issueTerm);
    s.setAttribute("theme", THEME);
    s.setAttribute("crossorigin", "anonymous");
    s.async = true;
    return s;
  }

  function toggleSection(anchorEl, issueTerm) {
    var next = anchorEl.nextElementSibling;
    if (next && next.classList.contains("sec-comments")) {
      var open = next.style.display !== "none";
      next.style.display = open ? "none" : "block";
      anchorEl.classList.toggle("open", !open);
      return;
    }
    var box = document.createElement("div");
    box.className = "sec-comments";
    box.appendChild(makeUtterances(issueTerm));
    anchorEl.parentNode.insertBefore(box, anchorEl.nextSibling);
    anchorEl.classList.add("open");
  }

  function init() {
    // 优先：页面如果提供了 #page-comments 容器（想把整页评论放前面的页面），渲染进去
    var pc = document.getElementById("page-comments");
    if (pc && !pc.querySelector("iframe")) {
      pc.appendChild(makeUtterances(location.pathname));
    }

    // 章节页：每个 .module 的 h2 加定位讨论按钮
    var modules = document.querySelectorAll(".module");
    if (modules.length) {
      modules.forEach(function (m, mi) {
        var h = m.querySelector("h2");
        if (!h) return;
        if (!h.id) h.id = slugify(h.textContent, mi);
        // 避免重复添加
        if (h.querySelector(".sec-discuss-btn")) return;
        var btn = document.createElement("button");
        btn.className = "sec-discuss-btn";
        btn.type = "button";
        btn.innerHTML = "💬 本节讨论";
        h.appendChild(btn);
        var term = location.pathname + "#" + h.id;
        btn.addEventListener("click", function () {
          toggleSection(h, term);
        });
      });
    } else {
      // 栏目 index：页脚前放整页评论区（若已用 #page-comments 放到前面，则跳过）
      if (document.getElementById("page-comments")) return;
      var footer = document.querySelector("footer");
      if (footer && !document.querySelector(".page-comments")) {
        var wrap = document.createElement("div");
        wrap.className = "page-comments";
        var title = document.createElement("h2");
        title.textContent = "💬 交流讨论";
        wrap.appendChild(title);
        wrap.appendChild(makeUtterances(location.pathname));
        footer.parentNode.insertBefore(wrap, footer);
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
