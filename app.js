// --- PWA register ---
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

// --- Constants ---
const STORAGE_KEY = "wxk_logs_v1";
const ERR_CODES = [
  { code: "001", name: "常駐要求過負荷", sev: "Critical", quick: "範囲・期限を宣言／距離復帰" },
  { code: "002", name: "境界侵害", sev: "Critical", quick: "中断／距離復帰" },
  { code: "003", name: "責任未定義ループ", sev: "High", quick: "『誰が決める？』を確定" },
  { code: "004", name: "感情受信飽和", sev: "High", quick: "相談を時間枠化／回線を細く" },
  { code: "005", name: "意味過剰生成", sev: "High", quick: "夜に判断しない／身体接地" },
  { code: "101", name: "過剰開示誘発", sev: "High", quick: "初回から区切る（今日はここまで）" },
  { code: "102", name: "基準点誤認", sev: "High", quick: "決定を相手に返す質問" },
  { code: "104", name: "役割化・装置化", sev: "High", quick: "役割を減らす／できること表" },
  { code: "201", name: "熱烈出力→常駐期待", sev: "High", quick: "ペース・頻度・境界線合意" },
  { code: "202", name: "曖昧関係長期化", sev: "Critical", quick: "定義要求 or 離脱" },
  { code: "203", name: "反応テスト検知", sev: "Critical", quick: "不可宣言／継続なら終了" },
  { code: "204", name: "身体遮断", sev: "High", quick: "接触中止／安全再構築" },
  { code: "301", name: "学際翻訳過多", sev: "Med", quick: "仮結論を先に置く" },
  { code: "303", name: "締切未設定", sev: "High", quick: "擬似締切を作る（外部提出）" }
];

const SEVERITY_RANK = { "Critical": 3, "High": 2, "Med": 1, "Info": 0 };

// --- Tabs ---
document.querySelectorAll("nav button").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("nav button").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
    if (btn.dataset.tab === "list") renderList();
    if (btn.dataset.tab === "diag") renderDiag();
  });
});

// --- Slider label ---
const overload = document.getElementById("overload");
const overloadVal = document.getElementById("overloadVal");
overload.addEventListener("input", () => overloadVal.textContent = overload.value);

// --- ERR chips ---
const errChips = document.getElementById("errChips");
const selectedErr = new Set();
const chipButtons = new Map(); // code -> button

ERR_CODES.forEach(e => {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "chip";
  b.textContent = `${e.code} ${e.name}`;
  b.dataset.code = e.code;

  b.addEventListener("click", () => toggleChip(e.code));
  errChips.appendChild(b);
  chipButtons.set(e.code, b);
});

function toggleChip(code, forceState = null) {
  const btn = chipButtons.get(code);
  if (!btn) return;
  const isActive = selectedErr.has(code);
  const next = (forceState === null) ? !isActive : forceState;

  if (next) selectedErr.add(code);
  else selectedErr.delete(code);

  btn.classList.toggle("active", next);
}

function setChipsFromCodes(codes) {
  // Clear all
  for (const code of selectedErr) toggleChip(code, false);
  // Set requested
  codes.forEach(c => toggleChip(c, true));
}

// --- Storage helpers ---
function loadLogs() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch { return []; }
}
function saveLogs(logs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
}

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}
function fmt(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2,"0")}`;
}

// --- Save entry ---
document.getElementById("saveBtn").addEventListener("click", () => {
  const entry = {
    id: crypto.randomUUID(),
    ts: new Date().toISOString(),
    profile: document.getElementById("profile").value,
    overload: Number(document.getElementById("overload").value),
    err: Array.from(selectedErr),
    note: document.getElementById("note").value.trim(),
    actions: {
      distance: document.getElementById("actDistance").checked,
      scope: document.getElementById("actScope").checked,
      body: document.getElementById("actBody").checked,
      stop: document.getElementById("actStop").checked
    },
    boundaryTpl: document.getElementById("boundaryTpl").value,
    boundaryNote: document.getElementById("boundaryNote").value.trim()
  };

  const logs = loadLogs();
  logs.unshift(entry);
  saveLogs(logs);

  document.getElementById("saveMsg").textContent = "保存しました。";
  setTimeout(() => (document.getElementById("saveMsg").textContent = ""), 1200);
});

// --- List render ---
function renderList() {
  const ul = document.getElementById("logList");
  ul.innerHTML = "";
  const logs = loadLogs();

  logs.forEach(ent => {
    const li = document.createElement("li");
    li.className = "card";

    const errText = ent.err.length ? ent.err.join(", ") : "—";
    li.innerHTML = `
      <div><strong>${fmt(ent.ts)}</strong> / ${escapeHtml(ent.profile)} / 過負荷 ${ent.overload}</div>
      <div class="muted">ERR: ${escapeHtml(errText)}</div>
      ${ent.note ? `<div>${escapeHtml(ent.note)}</div>` : ""}
      ${(ent.boundaryTpl || ent.boundaryNote) ? `<div class="muted">境界: ${escapeHtml((ent.boundaryTpl||"") + (ent.boundaryNote?(" / "+ent.boundaryNote):""))}</div>` : ""}
      <div class="row" style="margin-top:10px;">
        <button data-del="${ent.id}" class="danger">削除</button>
      </div>
    `;

    li.querySelector("[data-del]").addEventListener("click", () => {
      const next = loadLogs().filter(x => x.id !== ent.id);
      saveLogs(next);
      renderList();
    });

    ul.appendChild(li);
  });
}

// --- Export / Import ---
document.getElementById("exportBtn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(loadLogs(), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `wxk_logs_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById("importFile").addEventListener("change", async (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  const text = await f.text();
  try {
    const imported = JSON.parse(text);
    if (!Array.isArray(imported)) throw new Error("not array");
    saveLogs(imported);
    alert("インポートしました。");
    renderList();
  } catch {
    alert("インポート失敗：JSON形式を確認してください。");
  } finally {
    e.target.value = "";
  }
});

// --- Wipe ---
document.getElementById("wipeBtn").addEventListener("click", () => {
  if (confirm("全データを削除します。よろしいですか？")) {
    localStorage.removeItem(STORAGE_KEY);
    alert("削除しました。");
  }
});

// --------------------
// Diagnosis: Top 3 scoring + Apply to chips
// --------------------
const DIAG_Q = [
  {
    id: "tired",
    q: "今、疲れている？",
    yes: { "001": 2, "004": 1, "005": 1, "003": 1 },
    no:  { }
  },
  {
    id: "resident",
    q: "“支える役/判断役”を続けている？",
    yes: { "001": 3, "104": 2, "004": 1 },
    no:  { "005": 1 }
  },
  {
    id: "hasEnd",
    q: "終了条件（いつまで/どこまで）が明示されている？",
    yes: { },
    no:  { "001": 4, "003": 2, "104": 1 }
  },
  {
    id: "responsibility",
    q: "責任の所在は明確？（誰が決める？）",
    yes: { },
    no:  { "003": 4, "001": 1 }
  },
  {
    id: "emotional",
    q: "相手の感情を“処理”してない？（受信しすぎ）",
    yes: { "004": 4, "104": 2, "001": 1 },
    no:  { }
  },
  {
    id: "distanceRisk",
    q: "距離を取ると関係が壊れそうに感じる？",
    yes: { "102": 3, "201": 1, "104": 1 },
    no:  { }
  },
  {
    id: "test",
    q: "相手が試し行為（嫉妬/沈黙/既読無視）をしてる？",
    yes: { "203": 5, "202": 2 },
    no:  { "102": 2 }
  },
  {
    id: "night",
    q: "夜に結論を出したくなってる？",
    yes: { "005": 4, "003": 1 },
    no:  { }
  }
];

function getErrMeta(code) {
  const ref = ERR_CODES.find(e => e.code === code);
  if (!ref) return { sev: "Info", name: "不明", quick: "距離復帰／範囲を決める" };
  return ref;
}

function profileBoost(profile, scores) {
  // 軽い補正（“現実の起きやすさ”を反映）
  if (profile === "恋愛") {
    scores["201"] = (scores["201"] || 0) + 1;
    scores["202"] = (scores["202"] || 0) + 1;
  }
  if (profile === "仕事/研究") {
    scores["003"] = (scores["003"] || 0) + 1;
    scores["301"] = (scores["301"] || 0) + 1;
  }
  if (profile === "相談/友人") {
    scores["004"] = (scores["004"] || 0) + 1;
    scores["104"] = (scores["104"] || 0) + 1;
    scores["101"] = (scores["101"] || 0) + 1;
  }
  if (profile === "単独") {
    scores["005"] = (scores["005"] || 0) + 1;
  }
  return scores;
}

function sortTop(scores) {
  const arr = Object.entries(scores)
    .filter(([,v]) => v > 0)
    .map(([code, score]) => {
      const meta = getErrMeta(code);
      return {
        code,
        score,
        sev: meta.sev,
        sevRank: SEVERITY_RANK[meta.sev] ?? 0,
        name: meta.name,
        quick: meta.quick
      };
    });

  arr.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.sevRank !== a.sevRank) return b.sevRank - a.sevRank;
    return a.code.localeCompare(b.code);
  });

  if (arr.length === 0) {
    return [{ code: "OK", score: 0, sev: "Info", sevRank: 0, name: "Monitor", quick: "今日は大丈夫。ログだけ残す" }];
  }
  return arr.slice(0, 3);
}

function hasCritical(top) {
  return top.some(t => t.sev === "Critical");
}

function renderDiag() {
  const box = document.getElementById("diagBox");
  const res = document.getElementById("diagResult");
  box.innerHTML = "";
  res.innerHTML = "<div class='muted'>開始を押してね。</div>";

  let idx = 0;
  let scores = {};

  const startBtn = document.createElement("button");
  startBtn.textContent = "開始";
  startBtn.className = "primary";
  startBtn.addEventListener("click", () => step());
  box.appendChild(startBtn);

  function step() {
    if (idx >= DIAG_Q.length) return finish();
    const node = DIAG_Q[idx];

    box.innerHTML = `
      <div class="card">
        <div><strong>${escapeHtml(node.q)}</strong></div>
        <div class="row" style="margin-top:10px;">
          <button id="yesBtn" class="primary">YES</button>
          <button id="noBtn">NO</button>
        </div>
        <div class="muted" style="margin-top:8px;">${idx+1} / ${DIAG_Q.length}</div>
      </div>
    `;

    document.getElementById("yesBtn").addEventListener("click", () => apply(node.yes));
    document.getElementById("noBtn").addEventListener("click", () => apply(node.no));
  }

  function apply(addMap) {
    for (const [code, pts] of Object.entries(addMap || {})) {
      scores[code] = (scores[code] || 0) + pts;
    }
    idx += 1;
    step();
  }

  function finish() {
    const profile = document.getElementById("profile")?.value || "その他";
    scores = profileBoost(profile, scores);

    const top = sortTop(scores);
    const critical = hasCritical(top);

    const banner = critical
      ? `<div class="card" style="border-color:#b00020;">
           <div style="font-weight:700;color:#b00020;">⚠ Critical 検知</div>
           <div class="muted">まず #1 の即応を最優先。必要なら距離復帰＋範囲/期限の再設定。</div>
         </div>`
      : `<div class="card"><div class="muted">Criticalなし。#1から順に軽く当てていく。</div></div>`;

    const rows = top.map((t, i) => {
      if (t.code === "OK") {
        return `
          <div class="card">
            <div><strong>#${i+1} OK（Monitor）</strong></div>
            <div class="muted" style="margin-top:6px;"><strong>即応：</strong> ${escapeHtml(t.quick)}</div>
          </div>
        `;
      }
      return `
        <div class="card">
          <div><strong>#${i+1} ${t.code} ${escapeHtml(t.name)}</strong>
            <span class="muted">（${escapeHtml(t.sev)} / score ${t.score}）</span>
          </div>
          <div class="muted" style="margin-top:6px;"><strong>即応：</strong> ${escapeHtml(t.quick)}</div>
        </div>
      `;
    }).join("");

    // Apply button (top 1-3) to input chips
    const codesToApply = top.filter(t => t.code !== "OK").map(t => t.code);

    res.innerHTML = `
      ${banner}
      <div class="card">
        <div><strong>結果：上位3候補</strong> <span class="muted">（プロファイル：${escapeHtml(profile)}）</span></div>
        <div class="muted" style="margin-top:6px;">
          複合要因が前提。まず #1 を実施し、必要なら #2/#3 を追加。
        </div>
        <div class="row" style="margin-top:10px;">
          <button id="applyBtn" class="primary" ${codesToApply.length ? "" : "disabled"}>この結果をERR候補に反映</button>
          <button id="restartBtn">もう一回</button>
        </div>
        <div class="muted" style="margin-top:8px;">反映すると「入力」タブのERR候補がこの3つに切り替わる。</div>
      </div>
      ${rows}
    `;

    document.getElementById("restartBtn").addEventListener("click", renderDiag);

    const applyBtn = document.getElementById("applyBtn");
    applyBtn?.addEventListener("click", () => {
      // Switch to input tab, apply chips
      document.querySelector('nav button[data-tab="log"]').click();
      setChipsFromCodes(codesToApply);
      // ついでに一言メモを入れたい場合はここで note に追記もできる
    });

    box.innerHTML = `<div class="card"><div class="muted">診断が完了しました。</div></div>`;
  }
}
