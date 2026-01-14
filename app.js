// =====================
// WXK Check (Robust + High-precision diagnosis + E0000 support)
// - Offline local logs + optional Supabase cloud sync + shared read-only viewing
// - Designed to NEVER break UI even if some DOM nodes are missing / duplicated
// =====================

(() => {
  "use strict";

  // ---------------------
  // Helpers
  // ---------------------
  const $ = (id) => document.getElementById(id);
  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function safe(fn) {
    try { return fn(); } catch (e) { console.error("[WXK] error:", e); return undefined; }
  }

  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  function fmt(ts) {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return String(ts);
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  function setText(id, text) {
    const el = $(id);
    if (el) el.textContent = text;
  }

  function normalizeCode(code) {
    if (code === "E000") return "E0000";
    return code;
  }

  // ---------------------
  // PWA register
  // ---------------------
  safe(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    }
  });

  // ---------------------
  // Supabase config (SET YOUR VALUES)
  // 重要：Supabase画面の "Publishable key (sb_publishable_...)" でもOKにする
  // ---------------------
  const SUPABASE_URL = "https://nghnvqolxlzblwncpfgw.supabase.co";
  const SUPABASE_KEY = "sb_publishable_eMbDDZzJfNIheEzK04rsRw_oXMoc7fh";

  const supabase = safe(() => {
    const okUrl =
      typeof SUPABASE_URL === "string" &&
      SUPABASE_URL.startsWith("https://") &&
      SUPABASE_URL.includes(".supabase.co");

    const okKey =
      typeof SUPABASE_KEY === "string" &&
      (
        SUPABASE_KEY.startsWith("eyJ") ||          // 従来の anon/public key
        SUPABASE_KEY.startsWith("sb_publishable_") // 新しい publishable key
      ) &&
      SUPABASE_KEY.length > 20;

    const hasLib = !!(window.supabase && typeof window.supabase.createClient === "function");
    if (!okUrl || !okKey || !hasLib) return null;

    return window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
  });

  // ---------------------
  // Constants
  // ---------------------
  const STORAGE_KEY = "wxk_logs_v3";
  const SEVERITY_RANK = { "Critical": 3, "High": 2, "Med": 1, "Info": 0 };

  // Unified ERR codes
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
    { code: "303", name: "締切未設定", sev: "High", quick: "擬似締切を作る（外部提出）" },

    { code: "E0000", name: "平常運転（異常なし）", sev: "Info", quick: "維持。良かった要因を1行ログ" },
    { code: "E010", name: "雷出力：安定（集中・快）", sev: "Info", quick: "45–90分ごとに小休止＋水分固定" },
    { code: "E011", name: "思考が“外部モード”へ（距離が取れる）", sev: "Info", quick: "分析OK。感情は日本語で1回着地" },

    { code: "E020", name: "身体コンディション良好", sev: "Info", quick: "現状維持（睡眠/水分/食事を崩さない）" },
    { code: "E021", name: "境界線が機能している", sev: "Info", quick: "説明しすぎず短文で継続" },
    { code: "E022", name: "タスク明確で前進中", sev: "Info", quick: "次の一手だけ決めて淡々と" },
    { code: "E023", name: "情緒が安定（反芻少）", sev: "Info", quick: "刺激を増やさず維持" },
    { code: "E024", name: "対人負荷が軽い", sev: "Info", quick: "接触密度を今のまま維持" },

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

  function getErrMeta(codeRaw) {
    const code = normalizeCode(codeRaw);
    const ref = ERR_CODES.find(e => e.code === code);
    if (!ref) return { sev: "Info", name: "不明", quick: "距離復帰／範囲を決める" };
    return ref;
  }

  // ---------------------
  // Local storage
  // ---------------------
  function loadLogsLocal() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
    catch { return []; }
  }
  function saveLogsLocal(logs) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(logs)); } catch {}
  }

  // ---------------------
  // State
  // ---------------------
  let sessionUser = null;
  let ownerOptions = [];
  let activeOwnerId = null;

  // ---------------------
  // Chips
  // ---------------------
  const selectedErr = new Set();
  const chipButtons = new Map();

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
    Array.from(selectedErr).forEach(c => toggleChip(c, false));
    (codes || []).forEach(c => toggleChip(c, true));
  }

  function renderErrChips() {
    const wrap = $("errChips");
    if (!wrap) return;

    wrap.innerHTML = "";
    chipButtons.clear();

    ERR_CODES.forEach(e => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.textContent = `${e.code} ${e.name}`;
      b.dataset.code = e.code;
      b.addEventListener("click", () => toggleChip(e.code));
      wrap.appendChild(b);
      chipButtons.set(e.code, b);
    });
  }

  // ---------------------
  // Tabs
  // ---------------------
  function bindTabs() {
    const navBtns = qsa("nav button[data-tab]");
    const tabs = qsa(".tab");
    if (navBtns.length === 0 || tabs.length === 0) return;

    navBtns.forEach(btn => {
      btn.addEventListener("click", async () => {
        safe(() => {
          navBtns.forEach(b => b.classList.remove("active"));
          tabs.forEach(t => t.classList.remove("active"));
          btn.classList.add("active");
          const sec = $(`tab-${btn.dataset.tab}`);
          if (sec) sec.classList.add("active");
        });

        const tab = btn.dataset.tab;
        if (tab === "list") await renderList();
        if (tab === "diag") renderDiag();
        if (tab === "settings") await renderSettings();
      });
    });
  }

  // ---------------------
  // Slider label
  // ---------------------
  function bindSlider() {
    const overload = $("overload");
    const overloadVal = $("overloadVal");
    if (!overload || !overloadVal) return;
    overloadVal.textContent = overload.value;
    overload.addEventListener("input", () => overloadVal.textContent = overload.value);
  }

  // ---------------------
  // Auth UI (Supabase optional)
  // ---------------------
  function setAuthMsg(msg) {
    const el = $("authMsg");
    if (el) el.textContent = msg;
  }

  function updateAuthUI() {
    const emailEl = $("authEmail");
    if (emailEl && sessionUser?.email) emailEl.value = sessionUser.email;

    if (!supabase) {
      setAuthMsg("Supabase未設定/未読込：ローカルのみ動作中（SUPABASE_URL / KEY と supabase-js 読込を確認）");
      return;
    }
    if (!sessionUser) {
      setAuthMsg("未ログイン：履歴共有（クラウド）は使えません。入力/診断はローカルで使えます。");
    } else {
      setAuthMsg(`ログイン中：${sessionUser.email}`);
    }
  }

  async function initAuth() {
    if (!supabase) {
      updateAuthUI();
      ret
