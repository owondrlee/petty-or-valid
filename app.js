let lastResult = null;
let lastSituation = "";

// Image overlay state
let preRenderedDataURL = null;
let overlayGeneration = 0;
let hasVerdict = false;
let overlayShownForGen = -1; // tracks which generation the overlay already fired for
let scrollObserver = null;

// ─── Helpers ──────────────────────────────

function getTeaEmoji(teaLevel) {
  if (teaLevel === "emergency tea") return "🚨 emergency tea";
  if (teaLevel === "proper tea") return "🍵 proper tea";
  return "☕ mild tea";
}

const VERDICT_COLORS = {
  "valid": "#4ade80",
  "petty": "#fb923c",
  "petty but valid": "#c084fc",
  "seek peace": "#60a5fa",
  "touch grass immediately": "#fbbf24"
};

// ─── Display helpers ──────────────────────

function hideAll() {
  document.getElementById("result-card").hidden = true;
  document.getElementById("safe-message").hidden = true;
  document.getElementById("error-message").hidden = true;
}

function showError(message) {
  hideAll();
  const el = document.getElementById("error-message");
  el.textContent = message;
  el.hidden = false;
}

function showSafeResponse(message) {
  hideAll();
  document.getElementById("safe-text").textContent = message;
  const el = document.getElementById("safe-message");
  el.hidden = false;
  el.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function truncate(str, max) {
  if (str.length <= max) return str;
  const cut = str.lastIndexOf(" ", max);
  return str.slice(0, cut > 0 ? cut : max) + "\u2026";
}

function populateShareCard(data) {
  var color = VERDICT_COLORS[data.verdict] || "#ededed";
  document.getElementById("share-card").style.setProperty("--sc-color", color);

  document.getElementById("sc-confession-text").textContent =
    "\u201c" + truncate(lastSituation, 100) + "\u201d";

  // Verdict as a sentence: capitalize verdict + first sentence of why
  var v = data.verdict.charAt(0).toUpperCase() + data.verdict.slice(1);
  var firstSentence = data.why.split(/(?<=\.)\s/)[0] || data.why;
  document.getElementById("sc-verdict-text").textContent =
    v + ". " + truncate(firstSentence, 120);

  document.getElementById("sc-move-text").textContent = truncate(data.best_next_move, 100);
  document.getElementById("sc-score").textContent = data.petty_score + "/10 petty";
  document.getElementById("sc-tea").textContent = data.tea_level;
}

function showResult(data) {
  lastResult = data;
  hideAll();
  const card = document.getElementById("result-card");

  const color = VERDICT_COLORS[data.verdict] || "#ededed";
  card.style.setProperty("--verdict-color", color);

  const badge = document.getElementById("verdict-badge");
  badge.textContent = data.verdict;
  badge.dataset.verdict = data.verdict;

  const bar = document.getElementById("petty-bar");
  bar.style.width = "0";
  document.getElementById("petty-score-num").textContent = data.petty_score + " / 10";
  requestAnimationFrame(function () {
    bar.style.width = (data.petty_score / 10 * 100) + "%";
  });

  document.getElementById("tea-level").textContent = getTeaEmoji(data.tea_level);
  document.getElementById("why").textContent = data.why;
  document.getElementById("should-act").textContent = data.should_you_act_on_it;
  document.getElementById("next-move").textContent = data.best_next_move;
  document.getElementById("group-chat").textContent = "\u201c" + data.group_chat_line + "\u201d";

  const copyBtn = document.getElementById("copy-btn");
  copyBtn.textContent = "Copy verdict";
  copyBtn.classList.remove("copied");

  card.hidden = false;
  card.scrollIntoView({ behavior: "smooth", block: "nearest" });

  populateShareCard(data);
  hasVerdict = true;
  startOverlayPipeline();
}

// ─── Image overlay ──────────────────────────

function resetOverlay() {
  // Tear down observer
  if (scrollObserver) {
    scrollObserver.disconnect();
    scrollObserver = null;
  }
  preRenderedDataURL = null;
  hasVerdict = false;
  hideImageOverlay();
}

function startOverlayPipeline() {
  // Bump generation, discard any in-flight work from previous verdict
  var gen = ++overlayGeneration;

  // Pre-render the share card in the background after the verdict paints
  requestAnimationFrame(function () {
    html2canvas(document.getElementById("share-card"), {
      scale: 2,
      backgroundColor: "#0c0c0c",
      useCORS: true,
      logging: false
    }).then(function (canvas) {
      if (gen !== overlayGeneration) return;
      preRenderedDataURL = canvas.toDataURL("image/png");
    });
  });

  // Watch the copy-row (last visible element in the verdict card)
  observeScrollTrigger(gen);
}

function observeScrollTrigger(gen) {
  if (scrollObserver) {
    scrollObserver.disconnect();
    scrollObserver = null;
  }

  var target = document.querySelector(".copy-row");
  if (!target) return;

  scrollObserver = new IntersectionObserver(function (entries) {
    var entry = entries[0];
    if (!entry.isIntersecting) return;
    if (gen !== overlayGeneration) return;
    if (!hasVerdict) return;
    if (overlayShownForGen === gen) return; // already shown for this verdict

    // Small delay so it doesn't pop the instant the row peeks in
    setTimeout(function () {
      if (gen !== overlayGeneration) return;
      if (overlayShownForGen === gen) return;
      overlayShownForGen = gen;
      showImageOverlay();
    }, 600);

    // One-shot: stop observing after triggering
    scrollObserver.disconnect();
    scrollObserver = null;
  }, {
    threshold: 0.6 // fires when 60% of the copy-row is visible
  });

  scrollObserver.observe(target);
}

function showImageOverlay() {
  if (!hasVerdict || !preRenderedDataURL) return;

  var overlay = document.getElementById("image-overlay");
  var preview = document.getElementById("overlay-preview");
  preview.innerHTML = "";

  var img = document.createElement("img");
  img.src = preRenderedDataURL;
  img.alt = "Your verdict card";
  preview.appendChild(img);

  overlay.hidden = false;
}

function hideImageOverlay() {
  document.getElementById("image-overlay").hidden = true;
}

function downloadPreRenderedImage() {
  if (!preRenderedDataURL || !lastResult) return;
  var link = document.createElement("a");
  link.download = "petty-or-valid-" + lastResult.verdict.replace(/\s+/g, "-") + ".png";
  link.href = preRenderedDataURL;
  link.click();
}

// Overlay dismiss: close button, backdrop click, escape key
document.getElementById("overlay-close").addEventListener("click", hideImageOverlay);
document.getElementById("image-overlay").querySelector(".image-overlay-backdrop")
  .addEventListener("click", hideImageOverlay);
document.addEventListener("keydown", function (e) {
  if (e.key === "Escape" && !document.getElementById("image-overlay").hidden) {
    hideImageOverlay();
  }
});

// Overlay save button
document.getElementById("overlay-save-btn").addEventListener("click", function () {
  downloadPreRenderedImage();
  hideImageOverlay();
});

// ─── Copy handler ──────────────────────────

document.getElementById("copy-btn").addEventListener("click", function () {
  if (!lastResult) return;

  var d = lastResult;
  var text = [
    "petty or valid.",
    "",
    "verdict: " + d.verdict,
    "petty score: " + d.petty_score + "/10",
    "tea level: " + getTeaEmoji(d.tea_level),
    "",
    "why: " + d.why,
    "",
    "should you do it? " + d.should_you_act_on_it,
    "",
    "better move: " + d.best_next_move,
    "",
    "\u201c" + d.group_chat_line + "\u201d"
  ].join("\n");

  var btn = this;
  navigator.clipboard.writeText(text).then(function () {
    btn.textContent = "Copied";
    btn.classList.add("copied");
    setTimeout(function () {
      btn.textContent = "Copy verdict";
      btn.classList.remove("copied");
    }, 2000);
  });
});

// ─── Save as image handler (reuses pre-rendered image when available) ───

document.getElementById("save-btn").addEventListener("click", function () {
  if (!lastResult) return;

  if (preRenderedDataURL) {
    downloadPreRenderedImage();
    var b = this;
    b.textContent = "Saved";
    setTimeout(function () { b.textContent = "Save as image"; }, 2000);
    return;
  }

  var btn = this;
  btn.textContent = "Saving\u2026";
  btn.disabled = true;

  html2canvas(document.getElementById("share-card"), {
    scale: 2,
    backgroundColor: "#0c0c0c",
    useCORS: true,
    logging: false
  }).then(function (canvas) {
    preRenderedDataURL = canvas.toDataURL("image/png");
    downloadPreRenderedImage();
    btn.textContent = "Saved";
    setTimeout(function () {
      btn.textContent = "Save as image";
      btn.disabled = false;
    }, 2000);
  }).catch(function () {
    btn.textContent = "Save as image";
    btn.disabled = false;
  });
});

// ─── Form handler ─────────────────────────

document.getElementById("verdict-form").addEventListener("submit", async function (e) {
  e.preventDefault();

  var situation = document.getElementById("situation").value.trim();
  if (!situation) return;
  lastSituation = situation;

  var category = document.getElementById("category").value;
  var btn = document.getElementById("submit-btn");
  var btnText = document.getElementById("btn-text");
  var btnLoading = document.getElementById("btn-loading");

  btn.disabled = true;
  btnText.hidden = true;
  btnLoading.hidden = false;

  // Full reset of overlay state for the new verdict
  resetOverlay();

  try {
    var response = await fetch("/api/verdict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ situation: situation, category: category })
    });

    var data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Something went wrong.");
    }

    if (data.safe_response) {
      showSafeResponse(data.message);
    } else {
      showResult(data);
    }

  } catch (err) {
    showError(err.message || "Something went wrong. Try again.");
  } finally {
    btn.disabled = false;
    btnText.hidden = false;
    btnLoading.hidden = true;
  }
});
