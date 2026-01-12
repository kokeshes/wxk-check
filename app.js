// --- PWA register ---
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

// --- Constants ---
const STORAGE_KEY = "wxk_logs_v1";
const ERR_CODES = [
  { code: "001", name: "常駐要求過負荷", sev: "Critical", quick: "範囲・期限を宣言／距離復帰" },
  { code: "002", name: "境界侵害", sev: "Critical", quick: "中断／距離復帰" },
  { code: "003", name: "責任未定義ループ", sev: "High", quick: "誰が決めるか確定" },
  { code: "004", name: "感情受信飽和", sev: "High", quick: "時間枠で回線を細く" },
  { code: "005", name: "意味過剰生成", sev: "High", quick: "夜に判断しない／接地" },
  { code: "101", name: "過剰開示誘発", sev: "High", quick: "初回から区切る" },
  { code: "102", name: "基準点誤認", sev: "High", quick: "決定を相手に返す" },
  { code: "104", name: "役割化・装置化", sev: "High", quick: "役割を減らす／表を出す" },
  { code: "201", name: "熱烈出力→常駐期待", sev: "High", quick: "ペース・境界線合意" },
  { code: "202", name: "曖昧関係長期化", sev: "Critical", quick: "定義要求 or 離脱" },
  { code: "203", name: "反応テスト検知", sev: "Critical", quick: "不可宣言／継続なら終了" },
  { code: "204", name: "身体遮断", sev: "High", quick: "接触中止／安全再構築" },
  { code: "301", name: "学際翻訳過多", sev: "Med", quick: "仮結論を先に置く" },
  { code: "303", name: "締切未設定", sev: "High", quick: "擬似締切を作る" }
];

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
ERR_CODES.forEach(e => {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "chip";
  b.textContent = `${e.code} ${e.name}`;
  b.addEventListener("click", () => {
    if (selectedErr.has(e.code)) selectedErr.delete(e.code);
    else selectedErr.add(e.code);
    b.classList.toggle("active");
  });
  errChips.appendChild(b);
});

// --- Storage helpers ---
function loadLogs() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch { return []; }
}
function saveLogs(logs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
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
function fmt(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2,"0")}`;
}

function renderList() {
  const ul = document.getElementById("logList");
  ul.innerHTML = "";
  const logs = loadLogs();
  logs.forEach(ent => {
    const li = document.createElement("li");
    li.className = "card";

    const errText = ent.err.length ? ent.err.join(", ") : "—";
    li.innerHTML = `
      <div><strong>${fmt(ent.ts)}</strong> / ${ent.profile} / 過負荷 ${ent.overload}</div>
      <div class="muted">ERR: ${errText}</div>
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

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
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

// --- Diagnosis (YES/NO) ---
const DIAG = [
  { id: "tired", q: "今、疲れている？", yes: "resident", no: "distanceRisk" },
  { id: "resident", q: "“支える役/判断役”を続けている？", yes: "hasEnd", no: "responsibility" },
  { id: "hasEnd", q: "終了条件（いつまで/どこまで）が明示されている？", yes: "responsibility", no: "RES_ERR_001" },
  { id: "responsibility", q: "責任の所在は明確？（誰が決める？）", yes: "emotional", no: "RES_ERR_003" },
  { id: "emotional", q: "相手の感情を“処理”してない？（受信しすぎ）", yes: "RES_ERR_004", no: "distanceRisk" },
  { id: "distanceRisk", q: "距離を取ると関係が壊れそうに感じる？", yes: "test", no: "night" },
  { id: "test", q: "相手が試し行為（嫉妬/沈黙/既読無視）をしてる？", yes: "RES_ERR_203", no: "RES_ERR_102" },
  { id: "night", q: "夜に結論を出したくなってる？", yes: "RES_ERR_005", no: "RES_OK" }
];

function renderDiag() {
  const box = document.getElementById("diagBox");
  const res = document.getElementById("diagResult");
  box.innerHTML = "";
  res.innerHTML = "<div class='muted'>開始を押してね。</div>";

  let cur = DIAG[0].id;

  const startBtn = document.createElement("button");
  startBtn.textContent = "開始";
  startBtn.className = "primary";
  startBtn.addEventListener("click", () => step(cur));
  box.appendChild(startBtn);

  function step(id) {
    const node = DIAG.find(x => x.id === id);
    if (!node) return;
    box.innerHTML = `<div class="card"><div><strong>${node.q}</strong></div>
      <div class="row" style="margin-top:10px;">
        <button id="yesBtn" class="primary">YES</button>
        <button id="noBtn">NO</button>
      </div>
    </div>`;

    document.getElementById("yesBtn").addEventListener("click", () => next(node.yes));
    document.getElementById("noBtn").addEventListener("click", () => next(node.no));
  }

  function next(to) {
    if (to.startsWith("RES_")) return showResult(to);
    cur = to;
    step(cur);
  }

  function showResult(code) {
    const map = {
      "RES_ERR_001": ["001","常駐要求過負荷","範囲・期限の宣言／距離復帰"],
      "RES_ERR_003": ["003","責任未定義ループ","『誰が決める？』を確定"],
      "RES_ERR_004": ["004","感情受信飽和","相談を時間枠化／回線を細く"],
      "RES_ERR_005": ["005","意味過剰生成","夜に判断しない／身体接地"],
      "RES_ERR_102": ["102","基準点誤認","決定を相手に返す質問"],
      "RES_ERR_203": ["203","反応テスト検知","不可宣言／継続なら離脱"],
      "RES_OK": ["OK","Monitor","今日は大丈夫。ログだけ残す"]
    };
    const [c, title, quick] = map[code] || ["?","不明","いったん距離復帰"];
    const ref = ERR_CODES.find(e => e.code === c);
    const sev = ref?.sev ? `（${ref.sev}）` : "";
    res.innerHTML = `
      <div><strong>結果：</strong> ${c} ${title} ${sev}</div>
      <div class="muted" style="margin-top:6px;"><strong>即応：</strong> ${quick}</div>
      ${ref?.quick ? `<div class="muted"><strong>メモ：</strong> ${ref.quick}</div>` : ""}
      <div style="margin-top:10px;">
        <button id="restartBtn">もう一回</button>
      </div>
    `;
    document.getElementById("restartBtn").addEventListener("click", renderDiag);
  }
}
