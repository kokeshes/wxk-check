// --- PWA register ---
// --- PWA register ---
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

// --- Constants ---
const STORAGE_KEY = "wxk_logs_v1";

const ERR_CODES = [
  // ====== 既存 3桁コード ======
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
  { code: "303", name: "締切未設定", sev: "High", quick: "擬似締切を作る（外部提出）" },

  // ====== 追加 Eコード（完全版の一部） ======
  // --- INFO ---
  { code: "E000", name: "平常運転（異常なし）", sev: "Info", quick: "維持。良かった要因を1行ログ", domain: "mind", tags: ["仕様", "ログ"] },
  { code: "E010", name: "雷出力：安定（集中・快）", sev: "Info", quick: "45–90分ごとに小休止＋水分固定", domain: "work", tags: ["集中", "調律", "没入"] },
  { code: "E011", name: "思考が“外部モード”へ（距離が取れる）", sev: "Info", quick: "分析OK。感情は日本語で1回着地", domain: "mind", tags: ["外部性", "認知", "距離", "Exterity"] },

  // --- 生活基盤 ---
  { code: "E100", name: "睡眠不足（軽）", sev: "Med", quick: "仮眠20分 or 今夜の締切を決め就寝固定", domain: "life", tags: ["睡眠", "焦燥", "注意散漫"] },
  { code: "E110", name: "低血糖（焦り・苛立ち）", sev: "Med", quick: "水＋糖＋タンパク（例：おにぎり＋乳製品）", domain: "life", tags: ["栄養", "低血糖", "イライラ"] },
  { code: "E120", name: "脱水（頭痛・めまい・情緒揺れ）", sev: "Med", quick: "水＋少量塩分。カフェインは後回し", domain: "life", tags: ["水分", "脱水", "頭痛", "めまい"] },
  { code: "E130", name: "過負荷（体力・情緒の同時劣化）", sev: "High", quick: "強制デロード（軽い日）＋睡眠確保", domain: "life", tags: ["過負荷", "疲労", "回復"] },

  // --- 対人・境界 ---
  { code: "E200", name: "境界が薄くなる（抱え込み）", sev: "Med", quick: "「できる/できない」を短文で宣言（説明しない）", domain: "people", tags: ["境界", "共感", "抱え込み"] },
  { code: "E210", name: "侵害刺激でフリーズ／反芻", sev: "High", quick: "距離→事実のみ記録→上長/第三者へ共有", domain: "people", tags: ["ハラスメント", "フリーズ", "安全", "反芻"] },
  { code: "E220", name: "危険接近（引き込まれリスク）", sev: "Critical", quick: "接触ルール固定（時間/場所/回数）＋同席者", domain: "people", tags: ["危機", "境界", "ルール化"] },

  // --- 気分・認知 ---
  { code: "E300", name: "焦燥（タスク過密で空回り）", sev: "Med", quick: "「今日の最小勝利」を1つ決め他は保留", domain: "mind", tags: ["焦燥", "タスク", "空回り"] },
  { code: "E310", name: "怒りの熱（言葉が強くなる）", sev: "Med", quick: "即返信しない→水→5分歩く。文章は短く", domain: "mind", tags: ["怒り", "尊厳", "不正"] },
  { code: "E320", name: "不安増幅（最悪想定が止まらない）", sev: "High", quick: "通知OFF→確認できる事実だけ紙に書く", domain: "mind", tags: ["不安", "最悪想定", "刺激過多"] },
  { code: "E330", name: "自己否定ループ（恥・罪悪感）", sev: "High", quick: "評価軸を外に置く（睡眠/栄養/水分/運動）", domain: "mind", tags: ["自己否定", "恥", "罪悪感", "比較"] },

  // --- 研究・作業 ---
  { code: "E500", name: "過集中前兆（時間が消える）", sev: "Med", quick: "タイマー45–60分＋水分を手元固定", domain: "work", tags: ["過集中", "時間感覚", "研究"] },
  { code: "E510", name: "反芻（同じ一文を回し続ける）", sev: "High", quick: "「結論保留」でメモに封印→身体作業へ切替", domain: "work", tags: ["反芻", "停滞", "ループ"] },

  // --- 渇望・衝動 ---
  { code: "E400", name: "渇望（軽）：口寂しさ／手持ち無沙汰", sev: "Med", quick: "代替行動を固定（ガム/炭酸/散歩3分）", domain: "urge", tags: ["渇望", "習慣", "手持ち無沙汰"] },
  { code: "E410", name: "渇望（強）：思考が奪われる", sev: "High", quick: "補給→場所移動→5分だけ別タスク", domain: "urge", tags: ["渇望", "ストレス", "強"] },

  // --- 危機 ---
  { code: "E700", name: "危機：自己破壊衝動／安全が揺らぐ", sev: "Critical", quick: "一人にならない／刺激源から離脱／短文連絡", domain: "crisis", tags: ["危機", "安全", "自己破壊"] },
  { code: "E710", name: "現実感の低下（ぼんやり／自分が遠い）", sev: "Critical", quick: "五感接地（冷水/香り/足裏）＋誰かの声", domain: "crisis", tags: ["離人", "接地", "現実感"] }
];

const SEVERITY_RANK = { Critical: 3, High: 2, Med: 1, Info: 0 };

// --- Tabs ---
document.querySelectorAll("nav button").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("nav button").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
    if (btn.dataset.tab === "list") renderList();
    if (btn.dataset.tab === "diag") renderDiag();
  });
});

// --- Slider label ---
const overload = document.getElementById("overload");
const overloadVal = document.getElementById("overloadVal");
overload.addEventListener("input", () => (overloadVal.textContent = overload.value));

// --- ERR chips ---
const errChips = document.getElementById("errChips");
const selectedErr = new Set();
const chipButtons = new Map(); // code -> button

ERR_CODES.forEach((e) => {
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
  const next = forceState === null ? !isActive : forceState;

  if (next) selectedErr.add(code);
  else selectedErr.delete(code);

  btn.classList.toggle("active", next);
}

function setChipsFromCodes(codes) {
  // Clear all
  for (const code of selectedErr) toggleChip(code, false);
  // Set requested
  codes.forEach((c) => toggleChip(c, true));
}

// --- Storage helpers ---
function loadLogs() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}
function saveLogs(logs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
}

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}
function fmt(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
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

  logs.forEach((ent) => {
    const li = document.createElement("li");
    li.className = "card";

    const errText = ent.err.length ? ent.err.join(", ") : "—";
    li.innerHTML = `
      <div><strong>${fmt(ent.ts)}</strong> / ${escapeHtml(ent.profile)} / 過負荷 ${ent.overload}</div>
      <div class="muted">ERR: ${escapeHtml(errText)}</div>
      ${ent.note ? `<div>${escapeHtml(ent.note)}</div>` : ""}
      ${(ent.boundaryTpl || ent.boundaryNote) ? `<div class="muted">境界: ${escapeHtml((ent.boundaryTpl || "") + (ent.boundaryNote ? (" / " + ent.boundaryNote) : ""))}</div>` : ""}
      <div class="row" style="margin-top:10px;">
        <button data-del="${ent.id}" class="danger">削除</button>
      </div>
    `;

    li.querySelector("[data-del]").addEventListener("click", () => {
      const next = loadLogs().filter((x) => x.id !== ent.id);
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
  a.download = `wxk_logs_${new Date().toISOString().slice(0, 10)}.json`;
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
  // --- Safety first ---
  { id:"crisis1", q:"今、危険（自己破壊衝動/安全が揺らぐ/一人がまずい）？", yes:{ "E700": 8, "E710": 4 }, no:{} },
  { id:"dereal",  q:"現実感が薄い／自分が遠い感じがある？",                 yes:{ "E710": 7, "E700": 2 }, no:{} },

  // --- Body / life base ---
  { id:"sleep",        q:"睡眠が足りない（6h未満/質が悪い）？", yes:{ "E100":4, "E320":1, "E330":1, "005":1 }, no:{} },
  { id:"food",         q:"空腹・食事抜き・糖が足りない感じ？",   yes:{ "E110":4, "E310":1, "E300":1 }, no:{} },
  { id:"water",        q:"水分不足っぽい（口渇/頭痛/めまい/暖房/運動後）？", yes:{ "E120":4, "E320":1, "E330":1 }, no:{} },
  { id:"overloadBody", q:"疲労が溜まり、体力と情緒が同時に落ちてる？",       yes:{ "E130":5, "001":2, "004":1 }, no:{} },

  // --- People / boundary ---
  { id:"boundaryThin",  q:"優しくしすぎて抱え込みモードになってる？", yes:{ "E200":4, "104":2, "004":1 }, no:{} },
  { id:"freeze",        q:"侵害刺激（嫌な言葉/圧/ハラスメント）で固まる・反芻が出てる？", yes:{ "E210":6, "002":3, "203":2 }, no:{} },
  { id:"dangerApproach",q:"相手の踏み込みが増えて“引き込まれそう”？（密室化/頻度増/曖昧許容）", yes:{ "E220":7, "202":3, "201":2 }, no:{} },
  { id:"test",          q:"相手が試し行為（嫉妬/沈黙/既読無視/揺さぶり）をしてる？", yes:{ "203":6, "202":3, "E220":2 }, no:{ "102":2 } },

  // --- Cognition / mood ---
  { id:"anx",      q:"最悪想定が止まらない？", yes:{ "E320":5, "005":1, "003":1 }, no:{} },
  { id:"selfhate", q:"自己否定（恥/罪悪感/罵倒）ループに入ってる？", yes:{ "E330":5, "004":1 }, no:{} },
  { id:"anger",    q:"怒りの熱で言葉が強くなりそう？（即返信したい）", yes:{ "E310":4, "102":1 }, no:{} },
  { id:"rush",     q:"焦ってタスクが空回りしてる？（手が散る/全部重い）", yes:{ "E300":4, "303":1 }, no:{} },

  // --- Work / research ---
  { id:"hyperfocus",   q:"時間感覚が飛ぶ没入が出てる？（補給忘れ）", yes:{ "E500":4, "E010":1 }, no:{} },
  { id:"ruminateWork", q:"同じ文/同じ考えを焼き続けて進まない？",     yes:{ "E510":5, "003":1, "005":1 }, no:{} },
  { id:"role",         q:"“支える役/判断役”を続けている？",             yes:{ "001":3, "104":2, "004":1 }, no:{ "E011":1 } },
  { id:"end",          q:"終了条件（いつまで/どこまで）が明示されてる？", yes:{}, no:{ "001":4, "003":2, "104":1 } },
  { id:"responsibility",q:"責任の所在は明確？（誰が決める？）",          yes:{}, no:{ "003":4, "001":1 } },

  // --- Urge / craving ---
  { id:"urgeLight", q:"口寂しさ/儀式が欲しい程度の渇望がある？", yes:{ "E400":3 }, no:{} },
  { id:"urgeStrong",q:"渇望が強く、思考が奪われてる？",          yes:{ "E410":5, "E130":1 }, no:{} },

  // --- Night rule ---
  { id:"night", q:"夜に結論を出したくなってる？", yes:{ "005":4, "003":1, "E320":1 }, no:{} }
];

function getErrMeta(code) {
  const ref = ERR_CODES.find((e) => e.code === code);
  if (!ref) return { sev: "Info", name: "不明", quick: "距離復帰／範囲を決める" };
  return ref;
}

function profileBoost(profile, scores) {
  // プロファイル別・起きやすさ補正
  switch (profile) {
    case "恋愛":
      scores["201"] = (scores["201"] || 0) + 1;
      scores["202"] = (scores["202"] || 0) + 1;
      scores["102"] = (scores["102"] || 0) + 1;
      scores["E200"] = (scores["E200"] || 0) + 1;
      scores["E220"] = (scores["E220"] || 0) + 1;
      break;

    case "仕事/研究":
      scores["003"] = (scores["003"] || 0) + 1;
      scores["301"] = (scores["301"] || 0) + 1;
      scores["303"] = (scores["303"] || 0) + 1;
      scores["E300"] = (scores["E300"] || 0) + 1;
      scores["E510"] = (scores["E510"] || 0) + 1;
      scores["E500"] = (scores["E500"] || 0) + 1;
      break;

    case "相談/友人":
      scores["004"] = (scores["004"] || 0) + 1;
      scores["104"] = (scores["104"] || 0) + 1;
      scores["101"] = (scores["101"] || 0) + 1;
      scores["E200"] = (scores["E200"] || 0) + 1;
      scores["E210"] = (scores["E210"] || 0) + 1;
      scores["E330"] = (scores["E330"] || 0) + 1;
      break;

    case "単独":
      scores["005"] = (scores["005"] || 0) + 1;
      scores["E320"] = (scores["E320"] || 0) + 1;
      scores["E330"] = (scores["E330"] || 0) + 1;
      scores["E011"] = (scores["E011"] || 0) + 1;
      break;

    default:
      scores["E300"] = (scores["E300"] || 0) + 1;
      scores["004"] = (scores["004"] || 0) + 1;
      break;
  }
  return scores;
}

function sortTop(scores) {
  const arr = Object.entries(scores)
    .filter(([, v]) => v > 0)
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
  return top.some((t) => t.sev === "Critical");
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
        <div class="muted" style="margin-top:8px;">${idx + 1} / ${DIAG_Q.length}</div>
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

    // ★ overload (0-10) をスコアへ反映（あなたの目的の追加分）
    const ov = Number(document.getElementById("overload")?.value || 0);
    if (ov >= 8) {
      scores["E130"] = (scores["E130"] || 0) + 3;
      scores["001"] = (scores["001"] || 0) + 2;
      scores["004"] = (scores["004"] || 0) + 1;
    }
    if (ov >= 6) {
      scores["E300"] = (scores["E300"] || 0) + 1;
      scores["E320"] = (scores["E320"] || 0) + 1;
    }

    const top = sortTop(scores);
    const critical = hasCritical(top);

    const banner = critical
      ? `<div class="card" style="border-color:#b00020;">
           <div style="font-weight:700;color:#b00020;">⚠ Critical 検知</div>
           <div class="muted">まず #1 の即応を最優先。必要なら距離復帰＋範囲/期限の再設定。</div>
         </div>`
      : `<div class="card"><div class="muted">Criticalなし。#1から順に軽く当てていく。</div></div>`;

    const rows = top
      .map((t, i) => {
        if (t.code === "OK") {
          return `
          <div class="card">
            <div><strong>#${i + 1} OK（Monitor）</strong></div>
            <div class="muted" style="margin-top:6px;"><strong>即応：</strong> ${escapeHtml(t.quick)}</div>
          </div>
        `;
        }
        return `
        <div class="card">
          <div><strong>#${i + 1} ${t.code} ${escapeHtml(t.name)}</strong>
            <span class="muted">（${escapeHtml(t.sev)} / score ${t.score}）</span>
          </div>
          <div class="muted" style="margin-top:6px;"><strong>即応：</strong> ${escapeHtml(t.quick)}</div>
        </div>
      `;
      })
      .join("");

    const codesToApply = top.filter((t) => t.code !== "OK").map((t) => t.code);

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
      document.querySelector('nav button[data-tab="log"]').click();
      setChipsFromCodes(codesToApply);
    });

    box.innerHTML = `<div class="card"><div class="muted">診断が完了しました。</div></div>`;
  }
}
