// =====================
// WXK Check (Supabase sync + Shared read-only history)
// =====================

// --- PWA register ---
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

// --- Supabase config (SET YOUR VALUES) ---
const SUPABASE_URL = "https://YOUR_PROJECT.supabase.co";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";

// Create client (requires supabase-js script)
const supabase =
  (window.supabase &&
    typeof window.supabase.createClient === "function" &&
    SUPABASE_URL.includes("supabase.co") &&
    SUPABASE_ANON_KEY &&
    SUPABASE_ANON_KEY.length > 20)
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

// --- Constants ---
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
// DOM helpers（nullでも落ちない）
// =====================
const $ = (id) => document.getElementById(id);

function on(el, ev, fn) { if (el) el.addEventListener(ev, fn); }

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
// Local storage (offline fallback)
// =====================
function loadLogsLocal() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch { return []; }
}
function saveLogsLocal(logs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
}

// =====================
// Supabase state
// =====================
let sessionUser = null;    // { id, email }
let ownerOptions = [];     // [{owner_id, label, isSelf}]
let activeOwnerId = null;  // currently viewed owner_id

// =====================
// Tabs
// =====================
document.querySelectorAll("nav button").forEach(btn => {
  btn.addEventListener("click", async () => {
    document.querySelectorAll("nav button").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    btn.classList.add("active");
    const tab = document.getElementById(`tab-${btn.dataset.tab}`);
    if (tab) tab.classList.add("active");

    if (btn.dataset.tab === "list") await renderList();
    if (btn.dataset.tab === "diag") renderDiag();
    if (btn.dataset.tab === "settings") await renderSettings();
  });
});

// =====================
// Slider label
// =====================
const overload = $("overload");
const overloadVal = $("overloadVal");
on(overload, "input", () => { if (overloadVal) overloadVal.textContent = overload.value; });

// =====================
// ERR chips
// =====================
const errChips = $("errChips");
const selectedErr = new Set();
const chipButtons = new Map();

if (errChips) {
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
// Auth UI
// =====================
function setAuthMsg(msg) {
  const el = $("authMsg");
  if (el) el.textContent = msg;
}

function updateAuthUI() {
  const emailEl = $("authEmail");
  if (emailEl && sessionUser?.email) emailEl.value = sessionUser.email;

  if (!supabase) {
    setAuthMsg("Supabase未設定：SUPABASE_URL / SUPABASE_ANON_KEY を設定してね。");
    return;
  }
  if (!sessionUser) {
    setAuthMsg("未ログイン：共有（クラウド閲覧）は使えません。診断/入力はローカルで使えます。");
  } else {
    setAuthMsg(`ログイン中：${sessionUser.email}`);
  }
}

async function initAuth() {
  if (!supabase) {
    updateAuthUI();
    return;
  }

  const { data: { session } } = await supabase.auth.getSession();
  sessionUser = session?.user ? { id: session.user.id, email: session.user.email } : null;
  updateAuthUI();

  supabase.auth.onAuthStateChange((_event, s) => {
    sessionUser = s?.user ? { id: s.user.id, email: s.user.email } : null;
    updateAuthUI();
    refreshOwnerOptions().catch(() => {});
  });

  on($("loginBtn"), "click", async () => {
    const email = ($("authEmail")?.value || "").trim();
    if (!email) return setAuthMsg("メールを入れてください。");

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: location.href }
    });
    if (error) return setAuthMsg(`送信失敗：${error.message}`);
    setAuthMsg("ログインリンクを送信しました。メールを開いてリンクを押してね。");
  });

  on($("logoutBtn"), "click", async () => {
    await supabase.auth.signOut();
    setAuthMsg("ログアウトしました。");
  });
}

// =====================
// Shared history: owner select
// =====================
async function refreshOwnerOptions() {
  const sel = $("ownerSelect");
  if (!sel) return;

  ownerOptions = [];
  sel.innerHTML = "";

  if (!sessionUser || !supabase) {
    ownerOptions = [{ owner_id: "local", label: "この端末（ローカル）", isSelf: true }];
    activeOwnerId = "local";
    sel.appendChild(new Option(ownerOptions[0].label, ownerOptions[0].owner_id));
    sel.disabled = true;
    return;
  }

  ownerOptions.push({ owner_id: sessionUser.id, label: "自分（クラウド）", isSelf: true });

  const { data: shares } = await supabase
    .from("log_viewers")
    .select("owner_id")
    .eq("viewer_email", sessionUser.email);

  if (Array.isArray(shares)) {
    const uniq = Array.from(new Set(shares.map(x => x.owner_id).filter(Boolean)));
    uniq.forEach((oid, i) => {
      if (oid !== sessionUser.id) ownerOptions.push({ owner_id: oid, label: `共有：オーナー#${i+1}`, isSelf: false });
    });
  }

  ownerOptions.forEach(o => sel.appendChild(new Option(o.label, o.owner_id)));
  sel.disabled = ownerOptions.length <= 1;

  if (!activeOwnerId || !ownerOptions.some(o => o.owner_id === activeOwnerId)) {
    activeOwnerId = sessionUser.id;
  }
  sel.value = activeOwnerId;

  sel.onchange = async () => {
    activeOwnerId = sel.value;
    await renderList();
  };
}

// =====================
// Save entry
// =====================
on($("saveBtn"), "click", async () => {
  const entry = {
    id: crypto.randomUUID(),
    ts: new Date().toISOString(),
    profile: $("profile")?.value || "その他",
    overload: Number($("overload")?.value || 0),
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

  // Always keep local (offline safety)
  const logsLocal = loadLogsLocal();
  logsLocal.unshift(entry);
  saveLogsLocal(logsLocal);

  // If logged in, also sync to Supabase
  if (supabase && sessionUser) {
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
      const m = $("saveMsg");
      if (m) m.textContent = `ローカル保存OK / クラウド同期失敗：${error.message}`;
      setTimeout(() => { if ($("saveMsg")) $("saveMsg").textContent = ""; }, 2200);
      return;
    }
  }

  const msg = $("saveMsg");
  if (msg) msg.textContent = "保存しました。";
  setTimeout(() => { if ($("saveMsg")) $("saveMsg").textContent = ""; }, 1200);
});

// =====================
// List render (history)
// =====================
async function renderList() {
  const ul = $("logList");
  if (!ul) return;
  ul.innerHTML = "";

  await refreshOwnerOptions();

  // LOCAL MODE
  if (!sessionUser || !supabase || activeOwnerId === "local") {
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
      `;
      ul.appendChild(li);
    });
    return;
  }

  const viewingSelf = (activeOwnerId === sessionUser.id);

  const { data, error } = await supabase
    .from("logs")
    .select("id, owner_id, ts, profile, overload, err, note, actions, boundary_tpl, boundary_note")
    .eq("owner_id", activeOwnerId)
    .order("ts", { ascending: false })
    .limit(300);

  if (error) {
    const li = document.createElement("li");
    li.className = "card";
    li.innerHTML = `<div class="muted">取得失敗：${escapeHtml(error.message)}</div>`;
    ul.appendChild(li);
    return;
  }

  (data || []).forEach(row => {
    const li = document.createElement("li");
    li.className = "card";
    const errText = row.err?.length ? row.err.join(", ") : "—";

    li.innerHTML = `
      <div><strong>${fmt(row.ts)}</strong> / ${escapeHtml(row.profile)} / 過負荷 ${row.overload}</div>
      <div class="muted">ERR: ${escapeHtml(errText)}</div>
      ${row.note ? `<div>${escapeHtml(row.note)}</div>` : ""}
      ${(row.boundary_tpl || row.boundary_note) ? `<div class="muted">境界: ${escapeHtml((row.boundary_tpl||"") + (row.boundary_note?(" / "+row.boundary_note):""))}</div>` : ""}
      ${viewingSelf ? `<div class="row" style="margin-top:10px;"><button data-del="${row.id}" class="danger">削除</button></div>` : `<div class="muted" style="margin-top:10px;">（閲覧専用）</div>`}
    `;

    if (viewingSelf) {
      li.querySelector("[data-del]")?.addEventListener("click", async () => {
        const { error: delErr } = await supabase.from("logs").delete().eq("id", row.id);
        if (delErr) alert(`削除失敗：${delErr.message}`);
        await renderList();
      });
    }

    ul.appendChild(li);
  });
}

// =====================
// Export / Import (LOCAL ONLY)
// =====================
on($("exportBtn"), "click", () => {
  const blob = new Blob([JSON.stringify(loadLogsLocal(), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `wxk_logs_local_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

on($("importFile"), "change", async (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  const text = await f.text();
  try {
    const imported = JSON.parse(text);
    if (!Array.isArray(imported)) throw new Error("not array");
    saveLogsLocal(imported);
    alert("ローカルにインポートしました。");
    await renderList();
  } catch {
    alert("インポート失敗：JSON形式を確認してください。");
  } finally {
    e.target.value = "";
  }
});

on($("wipeBtn"), "click", () => {
  if (confirm("ローカルデータを削除します。よろしいですか？（クラウドは消えません）")) {
    localStorage.removeItem(STORAGE_KEY);
    alert("削除しました。");
  }
});

// =====================
// Owner-only: manage viewers (share history)
// =====================
async function renderSettings() {
  // viewerListが無い環境でも落ちない
  const vList = $("viewerList");
  if (vList) vList.innerHTML = "";

  if (!supabase) {
    setAuthMsg("Supabase未設定：SUPABASE_URL / SUPABASE_ANON_KEY を設定してね。");
    return;
  }
  if (!sessionUser) {
    // 未ログインならここで止める（UIはあるが操作できない）
    return;
  }

  on($("addViewerBtn"), "click", async () => {
    const vEmail = ($("viewerEmail")?.value || "").trim().toLowerCase();
    if (!vEmail) return alert("閲覧者メールを入れてください。");

    const { error } = await supabase
      .from("log_viewers")
      .insert({ owner_id: sessionUser.id, viewer_email: vEmail });

    if (error) return alert(`追加失敗：${error.message}`);
    if ($("viewerEmail")) $("viewerEmail").value = "";
    await renderViewerList();
    await refreshOwnerOptions();
  });

  await renderViewerList();
}

async function renderViewerList() {
  const ul = $("viewerList");
  if (!ul) return;
  ul.innerHTML = "";

  if (!supabase || !sessionUser) return;

  const { data, error } = await supabase
    .from("log_viewers")
    .select("viewer_email, created_at")
    .eq("owner_id", sessionUser.id)
    .order("created_at", { ascending: false });

  if (error) {
    ul.innerHTML = `<li class="card"><div class="muted">取得失敗：${escapeHtml(error.message)}</div></li>`;
    return;
  }

  (data || []).forEach(v => {
    const li = document.createElement("li");
    li.className = "card";
    li.innerHTML = `
      <div><strong>${escapeHtml(v.viewer_email)}</strong></div>
      <div class="muted">${fmt(v.created_at)}</div>
      <div class="row" style="margin-top:10px;">
        <button class="danger" data-rm="${escapeHtml(v.viewer_email)}">削除</button>
      </div>
    `;
    li.querySelector("[data-rm]")?.addEventListener("click", async () => {
      const email = v.viewer_email;
      const { error: delErr } = await supabase
        .from("log_viewers")
        .delete()
        .eq("owner_id", sessionUser.id)
        .eq("viewer_email", email);

      if (delErr) alert(`削除失敗：${delErr.message}`);
      await renderViewerList();
      await refreshOwnerOptions();
    });
    ul.appendChild(li);
  });
}

// =====================
// Diagnosis
// =====================
const DIAG_Q = [
  { id:"crisis1", q:"今、危険（自己破壊衝動/安全が揺らぐ/一人がまずい）？", yes:{ "E700": 8, "E710": 4 }, no:{} },
  { id:"dereal", q:"現実感が薄い／自分が遠い感じがある？", yes:{ "E710": 7, "E700": 2 }, no:{} },

  { id:"sleep", q:"睡眠が足りない（6h未満/質が悪い）？", yes:{ "E100": 4, "E320": 1, "E330": 1, "005": 1 }, no:{} },
  { id:"food", q:"空腹・食事抜き・糖が足りない感じ？", yes:{ "E110": 4, "E310": 1, "E300": 1 }, no:{} },
  { id:"water", q:"水分不足っぽい（口渇/頭痛/めまい/暖房/運動後）？", yes:{ "E120": 4, "E320": 1, "E330": 1 }, no:{} },
  { id:"overloadBody", q:"疲労が溜まり、体力と情緒が同時に落ちてる？", yes:{ "E130": 5, "001": 2, "004": 1 }, no:{} },

  { id:"boundaryThin", q:"優しくしすぎて抱え込みモードになってる？", yes:{ "E200": 4, "104": 2, "004": 1 }, no:{} },
  { id:"freeze", q:"侵害刺激（嫌な言葉/圧/ハラスメント）で固まる・反芻が出てる？", yes:{ "E210": 6, "002": 3, "203": 2 }, no:{} },
  { id:"dangerApproach", q:"相手の踏み込みが増えて“引き込まれそう”？（密室化/頻度増/曖昧許容）", yes:{ "E220": 7, "202": 3, "201": 2 }, no:{} },
  { id:"test", q:"相手が試し行為（嫉妬/沈黙/既読無視/揺さぶり）をしてる？", yes:{ "203": 6, "202": 3, "E220": 2 }, no:{ "102": 2 } },

  { id:"anx", q:"最悪想定が止まらない？", yes:{ "E320": 5, "005": 1, "003": 1 }, no:{} },
  { id:"selfhate", q:"自己否定（恥/罪悪感/罵倒）ループに入ってる？", yes:{ "E330": 5, "004": 1 }, no:{} },
  { id:"anger", q:"怒りの熱で言葉が強くなりそう？（即返信したい）", yes:{ "E310": 4, "102": 1 }, no:{} },
  { id:"rush", q:"焦ってタスクが空回りしてる？（手が散る/全部重い）", yes:{ "E300": 4, "303": 1 }, no:{} },

  { id:"hyperfocus", q:"時間感覚が飛ぶ没入が出てる？（補給忘れ）", yes:{ "E500": 4, "E010": 1 }, no:{} },
  { id:"ruminateWork", q:"同じ文/同じ考えを焼き続けて進まない？", yes:{ "E510": 5, "003": 1, "005": 1 }, no:{} },

  { id:"interdiscipline", q:"今、論点が複数領域にまたがりすぎて『翻訳』だけで時間が溶けてる？", yes:{ "301": 5, "E510": 1, "E300": 1 }, no:{} },
  { id:"premiseMissing", q:"結論より先に前提・定義・用語の整備で止まってる？（前進感がない）", yes:{ "301": 4, "E510": 2 }, no:{} },

  { id:"role", q:"“支える役/判断役”を続けている？", yes:{ "001": 3, "104": 2, "004": 1 }, no:{ "E011": 1 } },
  { id:"end", q:"終了条件（いつまで/どこまで）が明示されてる？", yes:{}, no:{ "001": 4, "003": 2, "104": 1 } },
  { id:"responsibility", q:"責任の所在は明確？（誰が決める？）", yes:{}, no:{ "003": 4, "001": 1 } },
  { id:"decisionOwner", q:"『誰が決める？』が曖昧なまま、こちらが埋め合わせて決めてない？", yes:{ "003": 4, "104": 1 }, no:{} },

  { id:"urgeLight", q:"口寂しさ/儀式が欲しい程度の渇望がある？", yes:{ "E400": 3 }, no:{} },
  { id:"urgeStrong", q:"渇望が強く、思考が奪われてる？", yes:{ "E410": 5, "E130": 1 }, no:{} },

  { id:"night", q:"夜に結論を出したくなってる？", yes:{ "005": 4, "003": 1, "E320": 1 }, no:{} }
];

function getErrMeta(code) {
  const ref = ERR_CODES.find(e => e.code === code);
  if (!ref) return { sev: "Info", name: "不明", quick: "距離復帰／範囲を決める" };
  return ref;
}

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

    on($("yesBtn"), "click", () => apply(node.yes));
    on($("noBtn"), "click", () => apply(node.no));
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
          <div><strong>#${i+1} ${t.code} ${escapeHtml(t.name)}</strong>
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

    on($("restartBtn"), "click", renderDiag);
    on($("applyBtn"), "click", () => {
      document.querySelector('nav button[data-tab="log"]')?.click();
      setChipsFromCodes(codesToApply);
    });

    box.innerHTML = `<div class="card"><div class="muted">診断が完了しました。</div></div>`;
  }
}

// =====================
// Boot
// =====================
(async function boot() {
  await initAuth();
  await refreshOwnerOptions();
})();
