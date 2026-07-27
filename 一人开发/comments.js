// 一人开发 · 章节级定位评论（utterances）
// 行为：详情页 .doc 内每个 h2 自动加 id + 「💬 本节讨论」按钮；
// 点击在该章节下方展开独立评论区（utterances，issue-term 用 pathname#id 区分）。
// 目录页（无 .doc）则在页脚前放一个整页评论区。
(function () {
  "use strict";
  var REPO = "lyzbcy/computer-knowledge";
  var THEME = "github-light";

  // 由标题文字生成稳定的 id（去掉中文标点，空格转连字符）
  function slugify(text, idx) {
    var t = (text || "").trim()
      .replace(/[、，。！？：；""''（）()【】《》\.,!?;:'"]/g, "")
      .replace(/\s+/g, "-");
    return t ? t : "sec-" + idx;
  }

  // 创建一个 utterances script 节点
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

  // 在某元素后面插入评论容器（懒加载：首次点击才注入）
  function toggleSection(anchorEl, issueTerm) {
    var next = anchorEl.nextElementSibling;
    // 已存在容器 → 切换显隐
    if (next && next.classList.contains("sec-comments")) {
      var open = next.style.display !== "none";
      next.style.display = open ? "none" : "block";
      anchorEl.classList.toggle("open", !open);
      return;
    }
    // 首次：创建容器并注入 utterances
    var box = document.createElement("div");
    box.className = "sec-comments";
    box.appendChild(makeUtterances(issueTerm));
    anchorEl.parentNode.insertBefore(box, anchorEl.nextSibling);
    anchorEl.classList.add("open");
  }

  function init() {
    var doc = document.querySelector(".doc");
    if (doc) {
      // 详情页：给每个 h2 加定位讨论按钮
      var heads = doc.querySelectorAll("h2");
      heads.forEach(function (h, i) {
        if (!h.id) h.id = slugify(h.textContent, i);
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
      // 目录页：在 footer 前放整页评论区
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
