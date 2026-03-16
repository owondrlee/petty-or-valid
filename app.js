// Holds the last verdict so the copy button can format it
let lastResult = null;
let lastSituation = "";

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
  const color = VERDICT_COLORS[data.verdict] || "#ededed";
  const shareCard = document.getElementById("share-card");
  shareCard.style.setProperty("--sc-color", color);

  document.getElementById("sc-urge-text").textContent = "\u201c" + truncate(lastSituation, 120) + "\u201d";
  document.getElementById("sc-verdict").textContent = data.verdict;
  document.getElementById("sc-score").textContent = data.petty_score + " / 10";
  document.getElementById("sc-tea").textContent = getTeaEmoji(data.tea_level);
  document.getElementById("sc-why").textContent = data.why;
  document.getElementById("sc-quote").textContent = "\u201c" + data.group_chat_line + "\u201d";
}

function showResult(data) {
  lastResult = data;
  hideAll();
  const card = document.getElementById("result-card");

  // Apply verdict color as a CSS variable — flows through border, badge, quote bar
  const color = VERDICT_COLORS[data.verdict] || "#ededed";
  card.style.setProperty("--verdict-color", color);

  // Verdict badge
  const badge = document.getElementById("verdict-badge");
  badge.textContent = data.verdict;
  badge.dataset.verdict = data.verdict;

  // Petty score bar — reset to 0 first so the transition replays
  const bar = document.getElementById("petty-bar");
  bar.style.width = "0";
  document.getElementById("petty-score-num").textContent = data.petty_score + " / 10";
  requestAnimationFrame(() => {
    bar.style.width = (data.petty_score / 10 * 100) + "%";
  });

  // Tea level
  document.getElementById("tea-level").textContent = getTeaEmoji(data.tea_level);

  // Text fields
  document.getElementById("why").textContent = data.why;
  document.getElementById("should-act").textContent = data.should_you_act_on_it;
  document.getElementById("next-move").textContent = data.best_next_move;
  document.getElementById("group-chat").textContent = "\u201c" + data.group_chat_line + "\u201d";

  // Reset copy button if a previous verdict was shown
  const copyBtn = document.getElementById("copy-btn");
  copyBtn.textContent = "Copy verdict";
  copyBtn.classList.remove("copied");

  card.hidden = false;
  card.scrollIntoView({ behavior: "smooth", block: "nearest" });

  populateShareCard(data);
}

// ─── Copy handler ──────────────────────────

document.getElementById("copy-btn").addEventListener("click", function () {
  if (!lastResult) return;

  const d = lastResult;
  const text = [
    "petty or valid.",
    "",
    `verdict: ${d.verdict}`,
    `petty score: ${d.petty_score}/10`,
    `tea level: ${getTeaEmoji(d.tea_level)}`,
    "",
    `why: ${d.why}`,
    "",
    `should you do it? ${d.should_you_act_on_it}`,
    "",
    `better move: ${d.best_next_move}`,
    "",
    `\u201c${d.group_chat_line}\u201d`
  ].join("\n");

  navigator.clipboard.writeText(text).then(() => {
    this.textContent = "Copied";
    this.classList.add("copied");
    setTimeout(() => {
      this.textContent = "Copy verdict";
      this.classList.remove("copied");
    }, 2000);
  });
});

// ─── Save as image handler ─────────────────

document.getElementById("save-btn").addEventListener("click", function () {
  if (!lastResult) return;

  const btn = this;
  btn.textContent = "Saving…";
  btn.disabled = true;

  const shareCard = document.getElementById("share-card");

  html2canvas(shareCard, {
    scale: 2,
    backgroundColor: "#0c0c0c",
    useCORS: true,
    logging: false
  }).then(function (canvas) {
    const link = document.createElement("a");
    link.download = "petty-or-valid-" + lastResult.verdict.replace(/\s+/g, "-") + ".png";
    link.href = canvas.toDataURL("image/png");
    link.click();

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

  const situation = document.getElementById("situation").value.trim();
  if (!situation) return;
  lastSituation = situation;

  const category = document.getElementById("category").value;

  const btn = document.getElementById("submit-btn");
  const btnText = document.getElementById("btn-text");
  const btnLoading = document.getElementById("btn-loading");

  btn.disabled = true;
  btnText.hidden = true;
  btnLoading.hidden = false;

  try {
    const response = await fetch("/api/verdict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ situation, category })
    });

    const data = await response.json();

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
