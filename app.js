// =====================
// WXK Check (Robust + Expanded Diagnosis Q)
// - Works with your current index.html (tab-log/list/diag/settings)
// - Optional Supabase (no-crash if not configured / script not included)
// =====================

// --- PWA register ---
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

// =====================
// (Optional) Supabase config
// =====================
// NOTE:
// - If you don't use Supabase, leave as-is. App works locally.
// - If you use Supabase, you MUST include this in index.html:
//   <script src="https://unpkg.com/@supabase/supabase-js@2"></script>
//   and then set URL/KEY below.
const SUPABASE_URL = "https://YOUR_PROJECT.supabase.co";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";

// Create client only if available + looks configured
const supabase =
  (window.supabase &&
    typeof SUPABASE_URL === "string" &&
    SUPABASE_URL.includes("supabase.co") &&
    typeof SUPABASE_ANON_KEY === "string" &&
    SUPABASE_ANON_KEY.startsWith("ey"))
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

let sessionUser = null; // { id, email } or null

// =====================
// Constants
// =====================
const STORAGE_KEY = "wxk_logs_v1";

// Unified ERR codes (3-digit + E-codes)
const ERR_CODES = [
  // --- 3-digit legacy ---
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

  // --- E-codes (from manual) ---
  { code: "E000", name: "平常運転（異常なし）", sev: "Info", quick: "維持。良かった要因を1行ログ" },
  { code: "E010", name: "雷出力：安定（集中・快）", sev: "Info", quick: "45–90分ごとに小休止＋水分固定" },
  { code: "E011", name: "思考が“外部モード”へ（距離が取れる）", sev: "Info", quick: "分析OK。感情は日本語で1回着地" },

  { code: "E100", name: "睡眠不足（軽）", sev: "Med", quick: "仮眠20分 or 今夜の締切を決め就寝固定" },
  { code: "E110", name: "低血糖（焦り・苛立ち）", sev: "Med", quick: "水＋糖＋タンパク（例：おにぎり＋乳製品）" },
  { code: "E120", name: "脱水（頭痛・めまい・情緒揺れ）", sev: "Med", quick: "水＋少量塩分。カフェインは後回し" },
  { code: "E130", name: "過負荷（体力・情緒の同時劣化）", sev: "High", quick: "強制デロード（軽い日）＋睡眠確保" },

  { code: "E200", name: "境界が薄くなる（抱え込み）", sev: "Med", quick: "「できる/できない」を短文で宣言（説明しない）" },
  { code: "E210", name: "侵害刺激でフリーズ／反芻", sev: "High", quick: "距離→事実のみ記録→上長/第三者へ共有" },
  { code: "E220", name: "危険接近（引き込まれリスク）", sev: "Critical", quick: "接触ルール固定（時間/場所/回数）＋同席者" },

  { code: "E300", name: "焦燥（タスク過密で空回り）", sev: "Med", quick: "「今日の最小勝利」を1つ決め他は保留" },
  { code: "E310", name: "怒りの熱（言葉が強くなる）", sev: "Med", quick: "即返信しない→水→5分歩く。文章は短く" },
  { code: "E320", name: "不安増幅（最悪想定が止まらない）", sev: "High", quick: "通知OFF→確認できる事実だけ紙に書く" },
  { code: "E330", name: "自己否定ループ（恥・罪悪感）", sev: "High", quick: "評価軸を外に置く（睡眠/栄養/水分/運動）" },

  { code: "E500", name: "過集中前兆（時間が消える）", sev: "Med", quick: "タイマー45–60分＋水分を手元固定" },
  { code: "E510", name: "反芻（同じ一文を回し続ける）", sev: "High", quick: "「結論保留」でメモに封印→身体作業へ切替" },

  { code: "E400", name: "渇望（軽）：口寂しさ／手持ち無沙汰", sev: "Med", quick: "代替行動を固定（ガム/炭酸/散歩3分）" },
  { code: "E410", name: "渇望（強）：思考が奪われる", sev: "High", quick: "補給→場所移動→5分だけ別タスク" },

  { code: "E700", name: "危機：自己破壊衝動／安全が揺らぐ", sev: "Critical", quick: "一人にならない／刺激源から離脱／短文連絡" },
  { code: "E710", name: "現実感の低下（ぼんやり／自分が遠い）", sev: "Critical", quick: "五感接地（冷水/香り/足裏）＋誰かの声" },
];

const SEVERITY_RANK = { "Critical": 3, "High": 2, "Med": 1, "Info": 0 };

// =====================
// DOM helpers
// =====================
const $ = (id) => document.getElementById(id);

function safeOn(el, type, fn) {
  if (!el) return;
  el.addEventListener(type, fn);
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

// =====================
// Local storage
// =====================
function loadLogsLocal() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch { return []; }
}
function saveLogsLocal(logs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
}

// =====================
// Optional Auth (no UI required)
// =====================
async function initAuth() {
  if (!supabase) return;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    sessionUser = session?.user ? { id: session.user.id, email: session.user.email } : null;

    supabase.auth.onAuthStateChange((_event, s) => {
      sessionUser = s?.user ? { id: s.user.id, email: s.user.email } : null;
    });
  } catch {
    // keep local-only
    sessionUser = null;
  }
}

// =====================
// Tabs
// =====================
function initTabs() {
  const navBtns = document.querySelectorAll("nav button");
  navBtns.forEach(btn => {
    safeOn(btn, "click", () => {
      navBtns.forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));

      btn.classList.add("active");
      const tab = document.getElementById(`tab-${btn.dataset.tab}`);
      if (tab) tab.classList.add("active");

      if (btn.dataset.tab === "list") renderList().catch(() => {});
      if (btn.dataset.tab === "diag") renderDiag();
    });
  });
}

// =====================
// Slider label
// =====================
function initOverload() {
  const overload = $("overload");
  const overloadVal = $("overloadVal");
  if (!overload || !overloadVal) return;
  overloadVal.textContent = overload.value;
  safeOn(overload, "input", () => overloadVal.textContent = overload.value);
}

// =====================
// ERR chips
// =====================
const selectedErr = new Set();
const chipButtons = new Map();

function initErrChips() {
  const errChips = $("errChips");
  if (!errChips) return;
  errChips.innerHTML = "";
  chipButtons.clear();
  selectedErr.clear();

  ERR_CODES.forEach(e => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip";
    b.textContent = `${e.code} ${e.name}`;
    b.dataset.code = e.code;
    safeOn(b, "click", () => toggleChip(e.code));
    errChips.appendChild(b);
    chipButtons.set(e.code, b);
  });
}

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
  for (const code of Array.from(selectedErr)) toggleChip(code, false);
  (codes || []).forEach(c => toggleChip(c, true));
}

// =====================
// Save entry
// =====================
function initSave() {
  const saveBtn = $("saveBtn");
  if (!saveBtn) return;

  safeOn(saveBtn, "click", async () => {
    const entry = {
      id: crypto.randomUUID(),
      ts: new Date().toISOString(),
      profile: $("profile")?.value || "その他",
      overload: Number($("overload")?.value ?? 0),
      err: Array.from(selectedErr),
      note: ($("note")?.value || "").trim(),
      actions: {
        distance: !!$("actDistance")?.checked,
        scope: !!$("actScope")?.checked,
        body: !!$("actBody")?.checked,
        stop: !!$("actStop")?.checked
      },
      boundaryTpl: $("boundaryTpl")?.value || "",
      boundaryNote: ($("boundaryNote")?.value || "").trim()
    };

    // Local always
    const logsLocal = loadLogsLocal();
    logsLocal.unshift(entry);
    saveLogsLocal(logsLocal);

    // Optional cloud sync (only if supabase configured + logged in + table exists)
    if (supabase && sessionUser) {
      try {
        const payload = {
          owner_id: sessionUser.id,
          ts: entry.ts,
          profile: entry.profile,
          overload: entry.overload,
          err: entry.err,
          note: entry.note,
          actions: entry.actions,
          boundary_tpl: entry.boundaryTpl,
          boundary_note: entry.boundaryNote
        };
        const { error } = await supabase.from("logs").insert(payload);
        if (error) {
          const msg = $("saveMsg");
          if (msg) {
            msg.textContent = `ローカル保存OK / クラウド同期失敗：${error.message}`;
            setTimeout(() => (msg.textContent = ""), 2400);
          }
          return;
        }
      } catch (e) {
        const msg = $("saveMsg");
        if (msg) {
          msg.textContent = `ローカル保存OK / クラウド同期失敗`;
          setTimeout(() => (msg.textContent = ""), 2400);
        }
        return;
      }
    }

    const msg = $("saveMsg");
    if (msg) {
      msg.textContent = "保存しました。";
      setTimeout(() => (msg.textContent = ""), 1200);
    }
  });
}

// =====================
// List render
// =====================
async function renderList() {
  const ul = $("logList");
  if (!ul) return;
  ul.innerHTML = "";

  // If you later add "shared owners" UI, you can extend here.
  // For now: show local logs only (safe & matches current HTML).
  const logs = loadLogsLocal();

  logs.forEach(ent => {
    const li = document.createElement("li");
    li.className = "card";

    const errText = ent.err?.length ? ent.err.join(", ") : "—";
    li.innerHTML = `
      <div><strong>${fmt(ent.ts)}</strong> / ${escapeHtml(ent.profile)} / 過負荷 ${ent.overload}</div>
      <div class="muted">ERR: ${escapeHtml(errText)}</div>
      ${ent.note ? `<div>${escapeHtml(ent.note)}</div>` : ""}
      ${(ent.boundaryTpl || ent.boundaryNote) ? `<div class="muted">境界: ${escapeHtml((ent.boundaryTpl||"") + (ent.boundaryNote?(" / "+ent.boundaryNote):""))}</div>` : ""}
      <div class="row" style="margin-top:10px;">
        <button data-del="${ent.id}" class="danger">削除</button>
      </div>
    `;

    li.querySelector("[data-del]")?.addEventListener("click", () => {
      const next = loadLogsLocal().filter(x => x.id !== ent.id);
      saveLogsLocal(next);
      renderList().catch(() => {});
    });

    ul.appendChild(li);
  });
}

// =====================
// Export / Import (LOCAL)
// =====================
function initExportImport() {
  safeOn($("exportBtn"), "click", () => {
    const blob = new Blob([JSON.stringify(loadLogsLocal(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wxk_logs_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  safeOn($("importFile"), "change", async (e) => {
    const f = e.target?.files?.[0];
    if (!f) return;
    const text = await f.text();
    try {
      const imported = JSON.parse(text);
      if (!Array.isArray(imported)) throw new Error("not array");
      saveLogsLocal(imported);
      alert("インポートしました。");
      await renderList();
    } catch {
      alert("インポート失敗：JSON形式を確認してください。");
    } finally {
      e.target.value = "";
    }
  });
}

// =====================
// Wipe (LOCAL)
// =====================
function initWipe() {
  safeOn($("wipeBtn"), "click", () => {
    if (confirm("ローカルデータを削除します。よろしいですか？")) {
      localStorage.removeItem(STORAGE_KEY);
      alert("削除しました。");
    }
  });
}

// =====================
// Diagnosis (Expanded: more questions, more precision)
// =====================
const DIAG_Q = [
  // ===== 0) "Good/Stable" detection (optional)
  { id:"ok1", q:"今、全体として安定している（焦り/不安/怒りが強くない）？", yes:{ "E000": 2, "E011": 1 }, no:{} },
  { id:"ok2", q:"集中が気持ちよく回っている（やるべきが見えている）？", yes:{ "E010": 2, "E500": 1 }, no:{} },

  // ===== 1) Safety first
  { id:"crisisA", q:"今、危険（自己破壊衝動/安全が揺らぐ/一人がまずい）？", yes:{ "E700": 10, "E710": 4 }, no:{} },
  { id:"crisisB", q:"現実感が薄い／自分が遠い／ぼんやりして危ない？", yes:{ "E710": 9, "E700": 2 }, no:{} },
  { id:"crisisC", q:"判断力が落ちている感じが強い？（普段ならしない選択をしそう）", yes:{ "E700": 6, "E710": 2, "E330": 1 }, no:{} },

  // ===== 2) Body / life base (more granular)
  { id:"sleepA", q:"直近2日で睡眠が足りない（6h未満/中途覚醒/質が悪い）？", yes:{ "E100": 5, "E320": 1, "E330": 1 }, no:{} },
  { id:"sleepB", q:"寝不足で怒り/焦り/衝動が増えている？", yes:{ "E100": 3, "E310": 2, "E300": 2 }, no:{} },
  { id:"foodA", q:"空腹・食事抜き・糖が足りない感じ？", yes:{ "E110": 5, "E300": 1, "E310": 1 }, no:{} },
  { id:"foodB", q:"食べたのに集中が戻らない（体力の底打ち感）？", yes:{ "E130": 3, "E100": 1 }, no:{} },
  { id:"waterA", q:"水分不足っぽい（口渇/頭痛/めまい/暖房/運動後）？", yes:{ "E120": 5, "E320": 1, "E330": 1 }, no:{} },
  { id:"waterB", q:"カフェイン/ニコチンで誤魔化してる感じがある？", yes:{ "E120": 2, "E320": 2, "E410": 1 }, no:{} },
  { id:"bodyA", q:"体が固い／呼吸浅い／肩首が強張っている？", yes:{ "E210": 1, "E320": 2, "E130": 1 }, no:{} },
  { id:"overloadA", q:"疲労が溜まり、体力と情緒が同時に落ちてる？", yes:{ "E130": 6, "001": 2, "004": 1 }, no:{} },
  { id:"overloadB", q:"休む罪悪感が強い（休むと負けた気がする）？", yes:{ "E130": 2, "E330": 2, "303": 1 }, no:{} },

  // ===== 3) Urge / craving (more precision)
  { id:"urgeA", q:"口寂しさ/儀式が欲しい程度の渇望がある？", yes:{ "E400": 4, "E410": 1 }, no:{} },
  { id:"urgeB", q:"渇望が強く、思考が奪われてる？", yes:{ "E410": 6, "E130": 1 }, no:{} },
  { id:"urgeC", q:"渇望が『ストレス反応』っぽい（気持ちを鎮めるため）？", yes:{ "E410": 4, "E320": 2 }, no:{} },

  // ===== 4) People / boundary (分解強化)
  { id:"boundA", q:"優しくしすぎて抱え込みモードになってる？", yes:{ "E200": 5, "104": 2, "004": 1 }, no:{} },
  { id:"boundB", q:"『断る』より『説明して納得させる』方に寄ってない？", yes:{ "E200": 3, "104": 2, "101": 1 }, no:{} },
  { id:"boundC", q:"連絡頻度が上がりすぎて常駐っぽくなってる？", yes:{ "001": 4, "201": 2, "E220": 1 }, no:{} },
  { id:"boundD", q:"境界（時間/範囲/頻度）を文章で固定できていない？", yes:{ "001": 3, "E200": 2, "104": 2 }, no:{} },

  // Harassment / intrusion
  { id:"intrA", q:"侵害刺激（嫌な言葉/圧/ハラスメント）で固まる・反芻が出てる？", yes:{ "E210": 7, "002": 3, "203": 2 }, no:{} },
  { id:"intrB", q:"『嫌だった』を言語化できず、飲み込んでしまった？", yes:{ "E210": 4, "E200": 2, "004": 1 }, no:{} },
  { id:"intrC", q:"相手が距離を詰めてきて、こちらが“慣らされてる”感じ？", yes:{ "E220": 6, "202": 2, "201": 2 }, no:{} },
  { id:"intrD", q:"密室化/二人きり/個別対応が増えている？", yes:{ "E220": 6, "002": 2 }, no:{} },

  // tests / ambiguity
  { id:"testA", q:"相手が試し行為（嫉妬/沈黙/既読無視/揺さぶり）をしてる？", yes:{ "203": 7, "202": 3, "E220": 2 }, no:{ "102": 2 } },
  { id:"testB", q:"相手の機嫌で自分の状態が大きく揺れる？", yes:{ "203": 3, "E330": 2, "E320": 2 }, no:{} },
  { id:"ambiA", q:"関係が曖昧なまま長引いてる（定義がない）？", yes:{ "202": 6, "201": 2, "001": 1 }, no:{} },
  { id:"ambiB", q:"『定義/ルールを決める話』を避けてしまってる？", yes:{ "202": 4, "001": 2, "104": 1 }, no:{} },

  // ===== 5) Roles / responsibility loops
  { id:"roleA", q:"“支える役/判断役”を続けている？", yes:{ "001": 3, "104": 3, "004": 2 }, no:{ "E011": 1 } },
  { id:"roleB", q:"相手の人生の意思決定を、こちらが代行してない？", yes:{ "003": 3, "104": 3, "102": 1 }, no:{} },
  { id:"roleC", q:"『誰が決める？』が曖昧なまま、こちらが埋め合わせて決めてない？", yes:{ "003": 5, "104": 2 }, no:{} },
  { id:"endA", q:"終了条件（いつまで/どこまで）が明示されてる？", yes:{}, no:{ "001": 4, "003": 2, "104": 2 } },
  { id:"respA", q:"責任の所在は明確？（誰が決める？）", yes:{}, no:{ "003": 5, "001": 1 } },

  // ===== 6) Mood / cognition (more granular)
  { id:"anxA", q:"最悪想定が止まらない？", yes:{ "E320": 6, "005": 1, "003": 1 }, no:{} },
  { id:"anxB", q:"確認行為が増えてる（通知/既読/返事待ちを見に行く）？", yes:{ "E320": 4, "203": 1, "201": 1 }, no:{} },
  { id:"selfA", q:"自己否定（恥/罪悪感/罵倒）ループに入ってる？", yes:{ "E330": 6, "004": 1 }, no:{} },
  { id:"selfB", q:"『自分はダメ』ではなく『条件が悪い』に戻せてない？", yes:{ "E330": 4, "E100": 1, "E120": 1 }, no:{ "E011": 1 } },
  { id:"angerA", q:"怒りの熱で言葉が強くなりそう？（即返信したい）", yes:{ "E310": 5, "102": 1 }, no:{} },
  { id:"angerB", q:"怒りの後に自己嫌悪が来るパターンがある？", yes:{ "E310": 2, "E330": 3 }, no:{} },
  { id:"rushA", q:"焦ってタスクが空回りしてる？（手が散る/全部重い）", yes:{ "E300": 5, "303": 1 }, no:{} },
  { id:"rushB", q:"優先順位が決められず、全部を同時に抱えてる？", yes:{ "E300": 4, "003": 1, "303": 1 }, no:{} },
  { id:"meaningA", q:"意味づけを過剰に作ってしまう（読みすぎ/深読み/夜に決めたい）？", yes:{ "005": 5, "E320": 1 }, no:{} },

  // ===== 7) Work / research (精密化)
  { id:"focusA", q:"時間感覚が飛ぶ没入が出てる？（補給忘れ）", yes:{ "E500": 5, "E010": 2 }, no:{} },
  { id:"focusB", q:"没入後に急落する（燃料切れ→不安/自己否定）？", yes:{ "E500": 3, "E130": 2, "E330": 1 }, no:{} },
  { id:"rumiA", q:"同じ文/同じ考えを焼き続けて進まない？", yes:{ "E510": 6, "003": 1, "005": 1 }, no:{} },
  { id:"rumiB", q:"結論を保留にできず、確定させようとして詰まってる？", yes:{ "E510": 4, "005": 1, "301": 1 }, no:{} },

  { id:"interA", q:"論点が複数領域にまたがりすぎて『翻訳』だけで時間が溶けてる？", yes:{ "301": 6, "E510": 1, "E300": 1 }, no:{} },
  { id:"interB", q:"用語定義・前提整備で止まって“前進感”がない？", yes:{ "301": 5, "E510": 2 }, no:{} },
  { id:"deadlineA", q:"締切がない/弱いせいで、作業が無限に伸びてる？", yes:{ "303": 5, "E300": 1 }, no:{} },
  { id:"deadlineB", q:"外部提出（人に見せる/送る）を作れてない？", yes:{ "303": 4, "301": 1 }, no:{} },

  // ===== 8) Relationship-specific (精度アップ)
  { id:"loveA", q:"相手の期待に合わせて“出力”を上げすぎてる？", yes:{ "201": 4, "001": 2, "004": 1 }, no:{} },
  { id:"loveB", q:"相手の期待を下げる話（頻度/範囲）を避けてる？", yes:{ "201": 3, "001": 2, "202": 1 }, no:{} },
  { id:"shareA", q:"初手から深い話をしすぎた/しそう？（過剰開示）", yes:{ "101": 5, "E200": 1 }, no:{} },
  { id:"baselineA", q:"相手の基準点を自分が勝手に補完してしまう？", yes:{ "102": 4, "003": 1 }, no:{} },

  // ===== 9) Night rule (最後に強める)
  { id:"nightA", q:"夜に結論を出したくなってる？", yes:{ "005": 5, "003": 1, "E320": 1 }, no:{} },
  { id:"nightB", q:"夜ほどメッセージ/反芻が止まらない？", yes:{ "005": 3, "E320": 3, "E510": 1 }, no:{} },
];

// =====================
// Diagnosis helpers
// =====================
function getErrMeta(code) {
  const ref = ERR_CODES.find(e => e.code === code);
  if (!ref) return { sev: "Info", name: "不明", quick: "距離復帰／範囲を決める" };
  return ref;
}

// Profile boost (same idea, slightly tuned)
function profileBoost(profile, scores) {
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
      scores["004"]  = (scores["004"]  || 0) + 1;
      break;
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

// =====================
// Diagnosis UI
// =====================
function renderDiag() {
  const box = $("diagBox");
  const res = $("diagResult");
  if (!box || !res) return;

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

    const yesBtn = $("yesBtn");
    const noBtn = $("noBtn");

    safeOn(yesBtn, "click", () => apply(node.yes));
    safeOn(noBtn, "click", () => apply(node.no));
  }

  function apply(addMap) {
    for (const [code, pts] of Object.entries(addMap || {})) {
      scores[code] = (scores[code] || 0) + pts;
    }
    idx += 1;
    step();
  }

  function finish() {
    const profile = $("profile")?.value || "その他";
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
          <div><strong>#${i+1} ${escapeHtml(t.code)} ${escapeHtml(t.name)}</strong>
            <span class="muted">（${escapeHtml(t.sev)} / score ${t.score}）</span>
          </div>
          <div class="muted" style="margin-top:6px;"><strong>即応：</strong> ${escapeHtml(t.quick)}</div>
        </div>
      `;
    }).join("");

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

    safeOn($("restartBtn"), "click", renderDiag);
    safeOn($("applyBtn"), "click", () => {
      document.querySelector('nav button[data-tab="log"]')?.click();
      setChipsFromCodes(codesToApply);
    });

    box.innerHTML = `<div class="card"><div class="muted">診断が完了しました。</div></div>`;
  }
}

// =====================
// Boot (safe)
// =====================
(function boot() {
  try {
    initTabs();
    initOverload();
    initErrChips();
    initSave();
    initExportImport();
    initWipe();
    initAuth().catch(() => {});

    // First render for history tab content when opened later
    // (Do nothing now)
  } catch (e) {
    // If anything goes wrong, at least don't kill the page silently
    // (No alert here to avoid UX spam; use DevTools console.)
    console.error("[WXK] boot error:", e);
  }
})();
