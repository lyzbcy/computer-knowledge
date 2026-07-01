/*
 * voice-sub.js · 字幕同步引擎（独立 IIFE，不改固定语音引擎）
 * ============================================================
 * 核心思路（解耦设计）：
 *   固定语音引擎用 new Audio() 创建音频对象，但它不插入 DOM，
 *   所以 document.querySelectorAll('audio') 找不到。
 *
 *   这里改用 MutationObserver 监听播放器的 .vp-cur 时间显示节点。
 *   固定语音引擎每秒更新 .vp-cur 文本（"00:01" → "00:02" → ...），
 *   节点一变，我们就从文本里解析出当前秒数，驱动字幕。
 *
 *   同时监听 .vp-title 变化来感知"切曲"，加载对应字幕。
 *   完全不碰 audio 对象本身，零侵入。
 */
(function () {
  "use strict";
  if (window.__subEngine) return;
  window.__subEngine = true;

  var listNode = document.getElementById("voicePlaylist");
  if (!listNode) return;
  var subBox = document.querySelector("#voicePlayer .vp-sub");
  var curEl = document.querySelector("#voicePlayer .vp-cur");
  var titleEl = document.querySelector("#voicePlayer .vp-title");
  if (!subBox) return;

  /* ---- 字幕数据缓存：按曲目 src 存 ---- */
  var subs = [];        // 当前曲目字幕
  var subCache = {};    // src → 字幕数组
  var curSrc = "";

  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  /* mp3 路径 → json 字幕路径（同目录同名） */
  function mp3ToJson(src) {
    // 兼容相对/绝对/blob URL，取路径主体
    var m = src.replace(/^.*?([a-zA-Z0-9_\/.\-]+\.mp3)(?:\?.*)?$/i, "$1");
    return m.replace(/\.mp3$/i, ".json");
  }

  function loadSubFor(src) {
    if (!src || src === curSrc) return;
    curSrc = src;
    var jsonUrl = mp3ToJson(src);
    if (subCache[jsonUrl]) {
      subs = subCache[jsonUrl];
      return;
    }
    fetch(jsonUrl)
      .then(function (r) {
        if (!r.ok) throw new Error(r.status);
        return r.json();
      })
      .then(function (arr) {
        subCache[jsonUrl] = Array.isArray(arr) ? arr : [];
        subs = subCache[jsonUrl];
      })
      .catch(function () {
        subs = [];
      });
  }

  /* "mm:ss" → 秒 */
  function parseTime(text) {
    var p = String(text).trim().split(":");
    if (p.length === 2) {
      var m = parseInt(p[0], 10) || 0;
      var s = parseInt(p[1], 10) || 0;
      return m * 60 + s;
    }
    return parseFloat(text) || 0;
  }

  function renderSub(t) {
    if (!subs.length) return;
    var hit = null, idx = -1;
    for (var i = 0; i < subs.length; i++) {
      if (t >= subs[i].start && t < subs[i].end) { hit = subs[i]; idx = i; break; }
    }
    if (!hit) {
      /* 不在任何句区间：显示最近的上一句（淡）作为上下文 */
      var prev = null;
      for (var j = 0; j < subs.length; j++) {
        if (subs[j].start <= t) prev = subs[j]; else break;
      }
      subBox.classList.remove("active");
      subBox.innerHTML = prev ? esc(prev.text) : "";
      return;
    }
    subBox.classList.add("active");
    var prevHtml = idx > 0
      ? '<span style="opacity:.45">' + esc(subs[idx - 1].text) + "</span> "
      : "";
    subBox.innerHTML = prevHtml + '<span class="cur">' + esc(hit.text) + "</span>";
  }

  /* ---- 监听 .vp-cur 文本变化 → 驱动字幕 ---- */
  function tick() {
    if (!curEl) return;
    var sec = parseTime(curEl.textContent);
    renderSub(sec);
  }

  /* ---- 监听 .vp-title 变化 → 切曲加载字幕 ---- */
  function onTitleChange() {
    var TRACKS = [];
    try {
      TRACKS = JSON.parse(listNode.textContent.trim());
    } catch (e) { return; }
    var title = titleEl ? titleEl.textContent.trim() : "";
    /* 用标题反查当前曲目 src（标题是曲目名，播放器 load 时写入） */
    for (var i = 0; i < TRACKS.length; i++) {
      if (TRACKS[i].title === title) {
        loadSubFor(TRACKS[i].src);
        return;
      }
    }
  }

  /* MutationObserver 监听播放器内部文本节点 */
  if (window.MutationObserver) {
    var obs = new MutationObserver(function () {
      tick();
      onTitleChange();
    });
    if (curEl) obs.observe(curEl, { childList: true, characterData: true, subtree: true });
    if (titleEl) obs.observe(titleEl, { childList: true, characterData: true, subtree: true });
  } else {
    /* 降级：轮询 */
    setInterval(function () { tick(); onTitleChange(); }, 300);
  }

  /* 保险：启动时也 tick 一次（应对已显示的时间） */
  setTimeout(tick, 500);
})();
