// =====================
// WXK Check (Robust / Guarded)
// - Offline local logs + optional Supabase cloud sync + shared read-only viewing
// - Designed to NEVER break the whole UI even if some DOM nodes are missing
// =====================

(() => {
  "use strict";

  // ---------------------
  // Basic helpers
  // ---------------------
  const $ = (id) => document.getElementById(id);
  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function safe(fn) {
    try { return fn(); } catch (e) { console.error(e); return undefined; }
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

  function setHtml(id, html) {
    const el = $(id);
    if (el) el.innerHTML = html;
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
  // ---------------------
  // If you don't want cloud sync, leave as-is. App will run local-only.
  const SUPABASE_URL = "https://nghnvqolxlzblwncpfgw.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_eMbDDZzJfNIheEzK04rsRw_oXMoc7fh";

 // localStorage keys
  const LS_ROOM_ID = "wxk_room_id";
  const LS_ROOM_CODE = "wxk_room_code";

  // Supabase client
  const supabase = window.supabase?.createClient?.(SUPABASE_URL, SUPABASE_ANON_KEY);
  if (!supabase) {
    console.error("Supabase SDKが読み込まれていません。index.htmlの<script>順序を確認してね。");
    return;
  }

  // DOM helpers
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const escapeHtml = (s) =>
    String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");

  function toast(msg) {
    // 既存UIが無い前提でも出るように簡易トースト
    let el = $("#wxk-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "wxk-toast";
      el.style.position = "fixed";
      el.style.left = "50%";
      el.style.bottom = "18px";
      el.style.transform = "translateX(-50%)";
      el.style.padding = "10px 12px";
      el.style.border = "1px solid rgba(255,255,255,.18)";
      el.style.background = "rgba(20,20,22,.92)";
      el.style.backdropFilter = "blur(8px)";
      el.style.borderRadius = "12px";
      el.style.fontSize = "14px";
      el.style.zIndex = "9999";
      el.style.maxWidth = "92vw";
      el.style.color = "inherit";
      el.style.boxShadow = "0 10px 30px rgba(0,0,0,.35)";
      el.style.display = "none";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.display = "block";
    clearTimeout(toast._t);
    toast._t = setTimeout(() => (el.style.display = "none"), 2400);
  }

  function ensureRoomUi() {
    // 既存HTMLにUIが無い場合でも動くように、ログタブ上に「共有」UIを自動挿入
    const logPanel =
      $('[data-tab-panel="log"]') ||
      $("#tab-log") ||
      $(".tab-panel.log") ||
      $("main") ||
      document.body;

    // すでにあるなら何もしない
    if ($("#wxk-room-box")) return;

    const wrap = document.createElement("section");
    wrap.id = "wxk-room-box";
    wrap.style.border = "1px solid rgba(255,255,255,.12)";
    wrap.style.borderRadius = "16px";
    wrap.style.padding = "12px";
    wrap.style.margin = "10px 0 14px";
    wrap.style.background = "rgba(255,255,255,.03)";

    wrap.innerHTML = `
      <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
        <button id="btn-create-room" type="button" style="padding:10px 12px; border-radius:12px; border:1px solid rgba(255,255,255,.18); background:rgba(255,255,255,.06); color:inherit; cursor:pointer;">
          共有ルーム作成
        </button>

        <div style="display:flex; gap:8px; align-items:center; flex:1; min-width:220px;">
          <input id="join-code" inputmode="text" autocomplete="one-time-code" placeholder="参加コード（例: ABC123）"
            style="flex:1; padding:10px 12px; border-radius:12px; border:1px solid rgba(255,255,255,.18); background:rgba(0,0,0,.18); color:inherit;">
          <button id="btn-join-room" type="button" style="padding:10px 12px; border-radius:12px; border:1px solid rgba(255,255,255,.18); background:rgba(255,255,255,.06); color:inherit; cursor:pointer;">
            参加
          </button>
        </div>
      </div>

      <div style="margin-top:10px; display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
        <div style="font-size:13px; opacity:.85;">
          現在のルーム: <span id="room-status" style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;">(未接続)</span>
        </div>

        <button id="btn-copy-link" type="button" style="padding:8px 10px; border-radius:12px; border:1px solid rgba(255,255,255,.18); background:rgba(255,255,255,.06); color:inherit; cursor:pointer;">
          共有リンクコピー
        </button>

        <button id="btn-leave-room" type="button" style="padding:8px 10px; border-radius:12px; border:1px solid rgba(255,80,110,.35); background:rgba(255,80,110,.10); color:inherit; cursor:pointer;">
          ルーム切替（解除）
        </button>
      </div>

      <div id="room-hint" style="margin-top:8px; font-size:12px; opacity:.75; line-height:1.4;">
        「共有ルーム作成」で出たコードをURLに埋めて相手に送ると、同じ履歴を共同編集できます。
      </div>
    `;

    // なるべく上に挿入
    logPanel.prepend(wrap);
  }

  function getRoomStatusEl() {
    return $("#room-status");
  }

  function setRoomStatus(text) {
    const el = getRoomStatusEl();
    if (el) el.textContent = text;
  }

  function parseUrlCode() {
    const u = new URL(location.href);
    const code = (u.searchParams.get("code") || "").trim();
    return code ? code.toUpperCase() : "";
  }

  function setUrlCode(code) {
    const u = new URL(location.href);
    if (code) u.searchParams.set("code", code);
    else u.searchParams.delete("code");
    history.replaceState({}, "", u.toString());
  }

  async function ensureAnonAuth() {
    const { data } = await supabase.auth.getUser();
    if (data?.user) return data.user;

    const res = await supabase.auth.signInAnonymously();
    if (res.error) throw res.error;

    const again = await supabase.auth.getUser();
    if (!again.data?.user) throw new Error("匿名ログインに失敗しました。");
    return again.data.user;
  }

  async function rpcCreateRoom() {
    const { data, error } = await supabase.rpc("create_room");
    if (error) throw error;

    // data は [{ room_id, code }] 形式のことが多い
    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.room_id || !row?.code) throw new Error("create_room の戻り値が想定と違います。");
    return { room_id: row.room_id, code: row.code };
  }

  async function rpcJoinRoom(code) {
    const { data, error } = await supabase.rpc("join_room", { p_code: code });
    if (error) throw error;
    // data は room_id
    if (!data) throw new Error("join_room の戻り値が空です。");
    return data;
  }

  function saveRoomLocal(room_id, code) {
    if (room_id) localStorage.setItem(LS_ROOM_ID, room_id);
    if (code) localStorage.setItem(LS_ROOM_CODE, code);
  }

  function clearRoomLocal() {
    localStorage.removeItem(LS_ROOM_ID);
    localStorage.removeItem(LS_ROOM_CODE);
  }

  function loadRoomLocal() {
    return {
      room_id: localStorage.getItem(LS_ROOM_ID) || "",
      code: localStorage.getItem(LS_ROOM_CODE) || "",
    };
  }

  function buildShareLink(code) {
    const u = new URL(location.href);
    u.searchParams.set("code", code);
    return u.toString();
  }

  function getLogPanelRoot() {
    return $('[data-tab-panel="log"]') || document;
  }

  function getListPanelRoot() {
    return $('[data-tab-panel="list"]') || document;
  }

  function serializeAllInputs(root) {
    // root内の input/select/textarea を全部拾って JSON化
    // name or id をキーにする。無い場合も拾う（自動採番）
    const fields = root.querySelectorAll("input, select, textarea");
    const payload = {};
    let anonIdx = 0;

    fields.forEach((el) => {
      const tag = el.tagName.toLowerCase();
      const type = (el.getAttribute("type") || "").toLowerCase();
      const key = el.name || el.id || `__field_${anonIdx++}`;

      if (tag === "input" && (type === "checkbox" || type === "radio")) {
        if (type === "radio") {
          if (el.checked) payload[key] = el.value;
          else if (!(key in payload)) payload[key] = payload[key] ?? null; // 未選択を明示
        } else {
          payload[key] = el.checked;
        }
        return;
      }

      // file input は保存しない（参照のみ）
      if (tag === "input" && type === "file") {
        payload[key] = "[file]";
        return;
      }

      payload[key] = el.value;
    });

    return payload;
  }

  function pickPrimaryText(payload) {
    // ざっくり「本文っぽいもの」を探す（履歴一覧で見やすくする）
    const candidates = ["text", "memo", "note", "input", "body", "message", "content"];
    for (const k of candidates) {
      if (payload[k] && String(payload[k]).trim()) return String(payload[k]).trim();
    }
    // textarea優先で拾う
    for (const [k, v] of Object.entries(payload)) {
      if (typeof v === "string" && v.length > 0 && k.toLowerCase().includes("text")) return v.trim();
    }
    // 最後の手段：最長文字列
    let best = "";
    for (const v of Object.values(payload)) {
      if (typeof v === "string" && v.trim().length > best.length) best = v.trim();
    }
    return best;
  }

  function pickPrimaryResult(payload) {
    const candidates = ["result", "judge", "status", "code", "error", "type"];
    for (const k of candidates) {
      if (payload[k] && String(payload[k]).trim()) return String(payload[k]).trim();
    }
    return null;
  }

  async function insertLog(room_id) {
    const user = await ensureAnonAuth();
    const root = getLogPanelRoot();

    const payload = serializeAllInputs(root);
    const text = pickPrimaryText(payload) || "(no text)";
    const result = pickPrimaryResult(payload);

    const { error } = await supabase.from("logs").insert({
      room_id,
      user_id: user.id,
      text,
      result,
      payload, // jsonb
    });

    if (error) throw error;
  }

  function findSaveButton() {
    // 既存UIの「保存」「登録」ボタンっぽいのを雑に探す
    const candidates = [
      "#btn-save",
      "#save",
      '[data-action="save"]',
      'button[type="submit"]',
      "button",
    ];

    for (const sel of candidates) {
      const els = $$(sel);
      // 文字に "保存" / "登録" / "追加" / "記録" が含まれるもの優先
      const hit = els.find((b) => /保存|登録|追加|記録|送信|submit/i.test((b.textContent || "").trim()));
      if (hit) return hit;
    }
    return null;
  }

  function getHistoryContainer() {
    // 履歴一覧を差し込む場所
    return (
      $("#history") ||
      $("#log-list") ||
      $('[data-role="history"]') ||
      $("#list") ||
      getListPanelRoot()
    );
  }

  function renderLogs(rows) {
    const box = getHistoryContainer();
    if (!box) return;

    // box が panel 全体だったら汚さないよう専用要素を作る
    let target = $("#wxk-history");
    if (!target) {
      target = document.createElement("div");
      target.id = "wxk-history";
      target.style.display = "grid";
      target.style.gap = "10px";
      box.innerHTML = ""; // 履歴として使う前提でクリア
      box.appendChild(target);
    } else {
      target.innerHTML = "";
    }

    if (!rows.length) {
      target.innerHTML = `<div style="opacity:.75; font-size:13px;">履歴がまだありません。</div>`;
      return;
    }

    rows.forEach((r) => {
      const card = document.createElement("article");
      card.style.border = "1px solid rgba(255,255,255,.12)";
      card.style.borderRadius = "16px";
      card.style.padding = "12px";
      card.style.background = "rgba(255,255,255,.03)";

      const created = r.created_at ? new Date(r.created_at) : null;
      const when = created ? created.toLocaleString() : "";

      const body = escapeHtml(r.text || "");
      const result = escapeHtml(r.result || "");
      const meta = escapeHtml(when);

      // payloadを折りたたみ表示
      const payloadStr = r.payload ? escapeHtml(JSON.stringify(r.payload, null, 2)) : "";

      card.innerHTML = `
        <div style="display:flex; gap:10px; align-items:flex-start; justify-content:space-between;">
          <div style="flex:1; min-width:0;">
            <div style="font-size:12px; opacity:.7; margin-bottom:6px;">${meta}</div>
            <div style="font-size:14px; line-height:1.45; white-space:pre-wrap; word-break:break-word;">${body}</div>
            ${result ? `<div style="margin-top:8px; font-size:12px; opacity:.85;">Result: <span style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;">${result}</span></div>` : ""}
          </div>
        </div>

        ${payloadStr ? `
          <details style="margin-top:10px;">
            <summary style="cursor:pointer; opacity:.85; font-size:13px;">保存された全データ（payload）</summary>
            <pre style="margin:8px 0 0; padding:10px; border-radius:12px; border:1px solid rgba(255,255,255,.12); background:rgba(0,0,0,.18); overflow:auto; max-height:260px;">${payloadStr}</pre>
          </details>
        ` : ""}
      `;

      target.appendChild(card);
    });
  }

  async function fetchAndRender(room_id) {
    const { data, error } = await supabase
      .from("logs")
      .select("id, created_at, text, result, payload")
      .eq("room_id", room_id)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) throw error;
    renderLogs(data || []);
  }

  function setupRealtime(room_id) {
    // 2重購読を避ける
    if (setupRealtime._ch) {
      supabase.removeChannel(setupRealtime._ch);
      setupRealtime._ch = null;
    }

    const ch = supabase
      .channel(`logs_room_${room_id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "logs", filter: `room_id=eq.${room_id}` },
        async () => {
          // 更新が来たら取り直す（簡単で確実）
          try {
            await fetchAndRender(room_id);
          } catch (e) {
            console.warn(e);
          }
        }
      )
      .subscribe();

    setupRealtime._ch = ch;
  }

  function setupTabs() {
    // 既存のタブUIに寄り添う（data-tabのbuttonがある想定）
    const tabButtons = $$("button[data-tab]");
    const panels = $$("[data-tab-panel]");

    if (!tabButtons.length || !panels.length) return;

    function activate(tabName) {
      tabButtons.forEach((b) => b.classList.toggle("active", b.dataset.tab === tabName));
      panels.forEach((p) => p.classList.toggle("active", p.dataset.tabPanel === tabName));
    }

    tabButtons.forEach((b) => {
      b.addEventListener("click", () => activate(b.dataset.tab));
    });
  }

  async function main() {
    ensureRoomUi();
    setupTabs();

    // 1) 認証確保
    await ensureAnonAuth();

    // 2) 参加コード（URL優先）→ 無ければlocalStorage
    const urlCode = parseUrlCode();
    const local = loadRoomLocal();

    let room_id = local.room_id;
    let room_code = local.code;

    // URLにcodeがあれば、それが最優先（相手から受け取ったケース）
    if (urlCode) {
      try {
        room_id = await rpcJoinRoom(urlCode);
        room_code = urlCode;
        saveRoomLocal(room_id, room_code);
        toast(`ルーム参加: ${room_code}`);
      } catch (e) {
        console.error(e);
        toast("参加コードが無効か、参加に失敗しました。");
        // URLのcodeが死んでるなら外しておく
        setUrlCode("");
      }
    }

    // 3) まだ room_id 無いなら：作成を促す状態
    if (!room_id) {
      setRoomStatus("(未接続) 共有ルーム作成 or 参加してね");
    } else {
      setRoomStatus(`${room_code || "(code?)"} / ${room_id.slice(0, 8)}…`);
      await fetchAndRender(room_id);
      setupRealtime(room_id);
    }

    // UI events
    $("#btn-create-room")?.addEventListener("click", async () => {
      try {
        const made = await rpcCreateRoom();
        room_id = made.room_id;
        room_code = made.code;
        saveRoomLocal(room_id, room_code);
        setUrlCode(room_code);
        setRoomStatus(`${room_code} / ${room_id.slice(0, 8)}…`);
        toast(`ルーム作成: ${room_code}`);

        await fetchAndRender(room_id);
        setupRealtime(room_id);
      } catch (e) {
        console.error(e);
        toast("ルーム作成に失敗しました。");
      }
    });

    $("#btn-join-room")?.addEventListener("click", async () => {
      const code = ($("#join-code")?.value || "").trim().toUpperCase();
      if (!code) return toast("参加コードを入力してね。");

      try {
        const joined = await rpcJoinRoom(code);
        room_id = joined;
        room_code = code;
        saveRoomLocal(room_id, room_code);
        setUrlCode(room_code);
        setRoomStatus(`${room_code} / ${room_id.slice(0, 8)}…`);
        toast(`ルーム参加: ${room_code}`);

        await fetchAndRender(room_id);
        setupRealtime(room_id);
      } catch (e) {
        console.error(e);
        toast("参加に失敗しました（コード違い or 権限）。");
      }
    });

    $("#btn-copy-link")?.addEventListener("click", async () => {
      const code = room_code || loadRoomLocal().code;
      if (!code) return toast("共有コードがまだ無い（ルーム未作成/未参加）。");

      const link = buildShareLink(code);
      try {
        await navigator.clipboard.writeText(link);
        toast("共有リンクをコピーしました。");
      } catch {
        // clipboard不可環境のフォールバック
        prompt("このリンクをコピーして共有してね:", link);
      }
    });

    $("#btn-leave-room")?.addEventListener("click", () => {
      clearRoomLocal();
      setUrlCode("");
      setRoomStatus("(未接続) 共有ルーム作成 or 参加してね");
      if (setupRealtime._ch) {
        supabase.removeChannel(setupRealtime._ch);
        setupRealtime._ch = null;
      }
      // 履歴表示もクリア
      const box = $("#wxk-history");
      if (box) box.innerHTML = `<div style="opacity:.75; font-size:13px;">ルーム未接続です。</div>`;
      toast("ルーム情報を解除しました。");
    });

    // 保存ボタンにフック（既存UIの保存/送信に乗る）
    const saveBtn = findSaveButton();
    if (saveBtn) {
      saveBtn.addEventListener("click", async (ev) => {
        // 既存がsubmitの場合に二重送信を避けたいなら preventDefault してもいいが、
        // 既存仕様が不明なので基本は触らない。
        try {
          const rid = room_id || loadRoomLocal().room_id;
          if (!rid) return toast("先に共有ルームを作成/参加してね。");

          await insertLog(rid);
          toast("保存しました。");
          await fetchAndRender(rid);
        } catch (e) {
          console.error(e);
          toast("保存に失敗しました（権限/接続/RLS）。");
        }
      });
    } else {
      // 保存ボタンが見つからない場合でも使えるように、Ctrl+Enter で保存
      document.addEventListener("keydown", async (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
          try {
            const rid = room_id || loadRoomLocal().room_id;
            if (!rid) return toast("先に共有ルームを作成/参加してね。");
            await insertLog(rid);
            toast("保存しました。");
            await fetchAndRender(rid);
          } catch (err) {
            console.error(err);
            toast("保存に失敗しました。");
          }
        }
      });
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    main().catch((e) => {
      console.error(e);
      toast("初期化に失敗しました。Supabase設定を確認してね。");
    });
  });
})();

  // ---------------------
  // Constants
  // ---------------------
  const STORAGE_KEY = "wxk_logs_v2"; // bump version to reduce "old broken data" issues
  const SEVERITY_RANK = { "Critical": 3, "High": 2, "Med": 1, "Info": 0 };

  // Unified ERR codes (3-digit + E-codes)
  // NOTE: You can add more codes here safely.
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

  function getErrMeta(code) {
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
  let sessionUser = null;   // { id, email }
  let ownerOptions = [];    // [{owner_id,label,isSelf}]
  let activeOwnerId = null; // "local" or uuid

  // ---------------------
  // ERR chips
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
    // Clear
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
          const id = `tab-${btn.dataset.tab}`;
          const sec = $(id);
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
      setAuthMsg("Supabase未設定：ローカルのみ動作中（SUPABASE_URL / KEY を設定すると共有できます）");
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
      return;
    }

    const sess = await safe(async () => {
      const { data } = await supabase.auth.getSession();
      return data?.session || null;
    });

    sessionUser = sess?.user ? { id: sess.user.id, email: sess.user.email } : null;
    updateAuthUI();

    safe(() => {
      supabase.auth.onAuthStateChange((_event, s) => {
        sessionUser = s?.user ? { id: s.user.id, email: s.user.email } : null;
        updateAuthUI();
        refreshOwnerOptions().catch(() => {});
      });
    });

    const loginBtn = $("loginBtn");
    if (loginBtn) {
      loginBtn.addEventListener("click", async () => {
        const email = ($("authEmail")?.value || "").trim();
        if (!email) return setAuthMsg("メールを入れてください。");

        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: location.href }
        });

        if (error) return setAuthMsg(`送信失敗：${error.message}`);
        setAuthMsg("ログインリンクを送信しました。メールを開いてリンクを押してね。");
      });
    }

    const logoutBtn = $("logoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", async () => {
        await safe(() => supabase.auth.signOut());
        setAuthMsg("ログアウトしました。");
      });
    }
  }

  // ---------------------
  // Shared history owner select
  // ---------------------
  async function refreshOwnerOptions() {
    const sel = $("ownerSelect");
    if (!sel) return;

    ownerOptions = [];
    sel.innerHTML = "";

    // local-only fallback
    if (!supabase || !sessionUser) {
      ownerOptions = [{ owner_id: "local", label: "この端末（ローカル）", isSelf: true }];
      activeOwnerId = "local";
      sel.appendChild(new Option(ownerOptions[0].label, ownerOptions[0].owner_id));
      sel.disabled = true;
      return;
    }

    // self
    ownerOptions.push({ owner_id: sessionUser.id, label: "自分（クラウド）", isSelf: true });

    // shares where my email is viewer
    const { data: shares, error } = await safe(async () => {
      return await supabase.from("log_viewers").select("owner_id").eq("viewer_email", sessionUser.email);
    }) || { data: null, error: null };

    if (!error && Array.isArray(shares)) {
      const uniq = Array.from(new Set(shares.map(x => x.owner_id).filter(Boolean)));
      let n = 1;
      uniq.forEach((oid) => {
        if (oid !== sessionUser.id) {
          ownerOptions.push({ owner_id: oid, label: `共有：オーナー#${n++}`, isSelf: false });
        }
      });
    }

    ownerOptions.forEach(o => sel.appendChild(new Option(o.label, o.owner_id)));
    sel.disabled = ownerOptions.length <= 1;

    // pick current or default to self
    if (!activeOwnerId || !ownerOptions.some(o => o.owner_id === activeOwnerId)) {
      activeOwnerId = sessionUser.id;
    }
    sel.value = activeOwnerId;

    sel.onchange = async () => {
      activeOwnerId = sel.value;
      await renderList();
    };
  }

  // ---------------------
  // Save entry (always local, optional cloud)
  // ---------------------
  async function saveEntry() {
    const profile = $("profile")?.value || "その他";
    const overload = Number($("overload")?.value ?? 0);

    const entry = {
      id: (crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()) + "_" + Math.random().toString(16).slice(2)),
      ts: new Date().toISOString(),
      profile,
      overload,
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

    // local always
    const logs = loadLogsLocal();
    logs.unshift(entry);
    saveLogsLocal(logs);

    // cloud optional
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

      const { error } = await safe(async () => await supabase.from("logs").insert(payload)) || { error: null };
      if (error) {
        setText("saveMsg", `ローカル保存OK / クラウド同期失敗：${error.message}`);
        setTimeout(() => setText("saveMsg", ""), 2400);
        return;
      }
    }

    setText("saveMsg", "保存しました。");
    setTimeout(() => setText("saveMsg", ""), 1200);
  }

  function bindSave() {
    const btn = $("saveBtn");
    if (!btn) return;
    btn.addEventListener("click", () => safe(() => saveEntry()));
  }

  // ---------------------
  // List render (history)
  // ---------------------
  async function renderList() {
    const ul = $("logList");
    if (!ul) return;

    ul.innerHTML = "";

    await refreshOwnerOptions();

    // Local mode
    if (!supabase || !sessionUser || activeOwnerId === "local") {
      const logs = loadLogsLocal();
      logs.forEach(ent => {
        const li = document.createElement("li");
        li.className = "card";
        const errText = ent.err?.length ? ent.err.join(", ") : "—";
        li.innerHTML = `
          <div><strong>${escapeHtml(fmt(ent.ts))}</strong> / ${escapeHtml(ent.profile)} / 過負荷 ${escapeHtml(ent.overload)}</div>
          <div class="muted">ERR: ${escapeHtml(errText)}</div>
          ${ent.note ? `<div>${escapeHtml(ent.note)}</div>` : ""}
          ${(ent.boundaryTpl || ent.boundaryNote) ? `<div class="muted">境界: ${escapeHtml((ent.boundaryTpl || "") + (ent.boundaryNote ? (" / " + ent.boundaryNote) : ""))}</div>` : ""}
        `;
        ul.appendChild(li);
      });
      return;
    }

    const viewingSelf = (activeOwnerId === sessionUser.id);

    const resp = await safe(async () => {
      return await supabase
        .from("logs")
        .select("id, owner_id, ts, profile, overload, err, note, actions, boundary_tpl, boundary_note")
        .eq("owner_id", activeOwnerId)
        .order("ts", { ascending: false })
        .limit(300);
    });

    const data = resp?.data || null;
    const error = resp?.error || null;

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
        <div><strong>${escapeHtml(fmt(row.ts))}</strong> / ${escapeHtml(row.profile)} / 過負荷 ${escapeHtml(row.overload)}</div>
        <div class="muted">ERR: ${escapeHtml(errText)}</div>
        ${row.note ? `<div>${escapeHtml(row.note)}</div>` : ""}
        ${(row.boundary_tpl || row.boundary_note) ? `<div class="muted">境界: ${escapeHtml((row.boundary_tpl || "") + (row.boundary_note ? (" / " + row.boundary_note) : ""))}</div>` : ""}
        ${viewingSelf ? `<div class="row" style="margin-top:10px;"><button data-del="${escapeHtml(row.id)}" class="danger" type="button">削除</button></div>` : `<div class="muted" style="margin-top:10px;">（閲覧専用）</div>`}
      `;

      if (viewingSelf) {
        const delBtn = li.querySelector("[data-del]");
        delBtn?.addEventListener("click", async () => {
          const id = row.id;
          const delResp = await safe(async () => await supabase.from("logs").delete().eq("id", id));
          if (delResp?.error) alert(`削除失敗：${delResp.error.message}`);
          await renderList();
        });
      }

      ul.appendChild(li);
    });
  }

  // ---------------------
  // Export / Import (LOCAL ONLY)
  // ---------------------
  function bindExportImport() {
    const exportBtn = $("exportBtn");
    if (exportBtn) {
      exportBtn.addEventListener("click", () => {
        safe(() => {
          const blob = new Blob([JSON.stringify(loadLogsLocal(), null, 2)], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `wxk_logs_local_${new Date().toISOString().slice(0, 10)}.json`;
          a.click();
          URL.revokeObjectURL(url);
        });
      });
    }

    const importFile = $("importFile");
    if (importFile) {
      importFile.addEventListener("change", async (e) => {
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
    }
  }

  // ---------------------
  // Wipe (LOCAL ONLY)
  // ---------------------
  function bindWipe() {
    const wipeBtn = $("wipeBtn");
    if (!wipeBtn) return;
    wipeBtn.addEventListener("click", () => {
      safe(() => {
        if (confirm("ローカルデータを削除します。よろしいですか？（クラウドは消えません）")) {
          localStorage.removeItem(STORAGE_KEY);
          alert("削除しました。");
        }
      });
    });
  }

  // ---------------------
  // Settings: manage viewers (owner only)
  // ---------------------
  async function renderSettings() {
    const viewerList = $("viewerList");
    if (viewerList) viewerList.innerHTML = "";

    if (!supabase || !sessionUser) return;

    const addBtn = $("addViewerBtn");
    if (addBtn && !addBtn.dataset.bound) {
      addBtn.dataset.bound = "1";
      addBtn.addEventListener("click", async () => {
        const vEmail = ($("viewerEmail")?.value || "").trim().toLowerCase();
        if (!vEmail) return alert("閲覧者メールを入れてください。");
        const resp = await safe(async () => await supabase.from("log_viewers").insert({ owner_id: sessionUser.id, viewer_email: vEmail }));
        if (resp?.error) return alert(`追加失敗：${resp.error.message}`);
        if ($("viewerEmail")) $("viewerEmail").value = "";
        await renderViewerList();
      });
    }

    await renderViewerList();
  }

  async function renderViewerList() {
    const ul = $("viewerList");
    if (!ul) return;
    ul.innerHTML = "";

    if (!supabase || !sessionUser) return;

    const resp = await safe(async () => {
      return await supabase
        .from("log_viewers")
        .select("viewer_email, created_at")
        .eq("owner_id", sessionUser.id)
        .order("created_at", { ascending: false });
    });

    if (resp?.error) {
      ul.innerHTML = `<li class="card"><div class="muted">取得失敗：${escapeHtml(resp.error.message)}</div></li>`;
      return;
    }

    (resp?.data || []).forEach(v => {
      const li = document.createElement("li");
      li.className = "card";
      li.innerHTML = `
        <div><strong>${escapeHtml(v.viewer_email)}</strong></div>
        <div class="muted">${escapeHtml(fmt(v.created_at))}</div>
        <div class="row" style="margin-top:10px;">
          <button class="danger" data-rm="${escapeHtml(v.viewer_email)}" type="button">削除</button>
        </div>
      `;

      li.querySelector("[data-rm]")?.addEventListener("click", async () => {
        const email = v.viewer_email;
        const delResp = await safe(async () => await supabase
          .from("log_viewers")
          .delete()
          .eq("owner_id", sessionUser.id)
          .eq("viewer_email", email));
        if (delResp?.error) alert(`削除失敗：${delResp.error.message}`);
        await renderViewerList();
        await refreshOwnerOptions();
      });

      ul.appendChild(li);
    });
  }

  // ---------------------
  // Diagnosis (Expanded: more questions, higher precision)
  // ---------------------
  // 方針：
  // - CRITICAL/安全を最初に検知
  // - 生活基盤（睡眠/食/水/疲労）→認知/気分→対人境界→研究作業→衝動→夜ルール
  // - YES/NOで加点、最後に profileBoost で軽い事前分布補正
  const DIAG_Q = [
    // --- Safety first / crisis ---
    { id:"crisis1", q:"今、危険（自己破壊衝動/安全が揺らぐ/一人がまずい）？", yes:{ "E700": 10, "E710": 4 }, no:{} },
    { id:"dereal", q:"現実感が薄い／自分が遠い感じがある？", yes:{ "E710": 9, "E700": 3 }, no:{} },
    { id:"panic", q:"胸が詰まる・過呼吸っぽい・動悸が強い？", yes:{ "E710": 5, "E320": 3 }, no:{} },
    { id:"unsafeEnv", q:"いま居る場所/相手が安全じゃない（離れるべき）？", yes:{ "E700": 6, "E220": 4, "002": 3 }, no:{} },

    // --- Body / life base ---
    { id:"sleep", q:"睡眠が足りない（6h未満/質が悪い）？", yes:{ "E100": 5, "E320": 2, "E330": 2, "005": 1 }, no:{} },
    { id:"sleep2", q:"寝不足が2日以上続いている？", yes:{ "E100": 3, "E130": 2, "E320": 2 }, no:{} },
    { id:"food", q:"空腹・食事抜き・糖が足りない感じ？", yes:{ "E110": 5, "E310": 2, "E300": 2 }, no:{} },
    { id:"water", q:"水分不足っぽい（口渇/頭痛/めまい/暖房/運動後）？", yes:{ "E120": 5, "E320": 2, "E330": 1 }, no:{} },
    { id:"sick", q:"風邪/体調不良で出力が荒れてる？", yes:{ "E130": 3, "E320": 1, "E330": 1 }, no:{} },
    { id:"overloadBody", q:"疲労が溜まり、体力と情緒が同時に落ちてる？", yes:{ "E130": 6, "001": 2, "004": 2 }, no:{} },
    { id:"overtrain", q:"運動/仕事/対人の負荷を積みすぎて回復を軽視してる？", yes:{ "E130": 4, "E500": 1, "E330": 1 }, no:{} },

    // --- People / boundary ---
    { id:"boundaryThin", q:"優しくしすぎて抱え込みモードになってる？", yes:{ "E200": 5, "104": 3, "004": 2 }, no:{} },
    { id:"invasion", q:"相手が踏み込みすぎ（時間/身体/私生活/尊厳）？", yes:{ "002": 5, "E210": 3, "E220": 2 }, no:{} },
    { id:"freeze", q:"侵害刺激（嫌な言葉/圧/ハラスメント）で固まる・反芻が出てる？", yes:{ "E210": 7, "002": 3, "203": 2 }, no:{} },
    { id:"dangerApproach", q:"相手の踏み込みが増えて“引き込まれそう”？（密室化/頻度増/曖昧許容）", yes:{ "E220": 8, "202": 4, "201": 3 }, no:{} },
    { id:"test", q:"相手が試し行為（嫉妬/沈黙/既読無視/揺さぶり）をしてる？", yes:{ "203": 7, "202": 4, "E220": 2 }, no:{ "102": 2 } },
    { id:"rescue", q:"相手の問題を“救わなきゃ”で背負ってない？", yes:{ "004": 4, "E200": 2, "104": 2 }, no:{} },
    { id:"role", q:"“支える役/判断役”を続けている？", yes:{ "001": 4, "104": 3, "004": 2 }, no:{ "E011": 1 } },
    { id:"end", q:"終了条件（いつまで/どこまで）が明示されてる？", yes:{}, no:{ "001": 5, "003": 3, "104": 2 } },
    { id:"responsibility", q:"責任の所在は明確？（誰が決める？）", yes:{}, no:{ "003": 5, "001": 2 } },
    { id:"decisionOwner", q:"『誰が決める？』が曖昧なまま、こちらが埋め合わせて決めてない？", yes:{ "003": 5, "104": 2 }, no:{} },

    // --- Cognition / mood ---
    { id:"anx", q:"最悪想定が止まらない？", yes:{ "E320": 6, "005": 1, "003": 1 }, no:{} },
    { id:"scan", q:"通知/相手の反応を何度も確認してしまう？", yes:{ "E320": 3, "203": 1, "201": 1 }, no:{} },
    { id:"selfhate", q:"自己否定（恥/罪悪感/罵倒）ループに入ってる？", yes:{ "E330": 6, "004": 2 }, no:{} },
    { id:"anger", q:"怒りの熱で言葉が強くなりそう？（即返信したい）", yes:{ "E310": 5, "102": 1 }, no:{} },
    { id:"rush", q:"焦ってタスクが空回りしてる？（手が散る/全部重い）", yes:{ "E300": 5, "303": 2 }, no:{} },
    { id:"meaning", q:"意味を生成しすぎて疲れてる？（解釈が止まらない）", yes:{ "005": 5, "E320": 1, "003": 1 }, no:{} },
    { id:"overshare", q:"初動で開示しすぎて後から重くなりそう？", yes:{ "101": 4, "E200": 1 }, no:{} },

    // --- Work / research ---
    { id:"hyperfocus", q:"時間感覚が飛ぶ没入が出てる？（補給忘れ）", yes:{ "E500": 5, "E010": 2 }, no:{} },
    { id:"ruminateWork", q:"同じ文/同じ考えを焼き続けて進まない？", yes:{ "E510": 6, "003": 1, "005": 1 }, no:{} },
    { id:"interdiscipline", q:"論点が多領域にまたがり『翻訳』だけで時間が溶けてる？", yes:{ "301": 6, "E510": 2, "E300": 1 }, no:{} },
    { id:"premiseMissing", q:"結論より先に前提・定義・用語の整備で止まってる？", yes:{ "301": 5, "E510": 2 }, no:{} },
    { id:"deadline", q:"締切/提出が曖昧で先延ばしが起きてる？", yes:{ "303": 6, "E300": 1 }, no:{} },
    { id:"responsibilityWork", q:"『誰が決める？』が曖昧で作業が止まってる？", yes:{ "003": 4, "E510": 1 }, no:{} },

    // --- Urge / craving ---
    { id:"urgeLight", q:"口寂しさ/儀式が欲しい程度の渇望がある？", yes:{ "E400": 4 }, no:{} },
    { id:"urgeStrong", q:"渇望が強く、思考が奪われてる？", yes:{ "E410": 6, "E130": 2 }, no:{} },
    { id:"impulse", q:"衝動で何か（連絡/購入/自己処理）をしそう？", yes:{ "E700": 2, "E320": 2, "E310": 2 }, no:{} },

    // --- Night rule ---
    { id:"night", q:"夜に結論を出したくなってる？", yes:{ "005": 5, "003": 2, "E320": 2 }, no:{} },
    { id:"lateMsg", q:"夜に長文を送りたくなってる？", yes:{ "005": 3, "101": 2, "E310": 1 }, no:{} },
  ];

  function profileBoost(profile, scores) {
    // プロファイル別・起きやすさ補正（軽く）
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
        scores["E011"] = (scores["E011"] || 0) + 1; // 良性
        break;

      default:
        scores["E300"] = (scores["E300"] || 0) + 1;
        scores["004"]  = (scores["004"]  || 0) + 1;
        break;
    }
    return scores;
  }

  function sortTop(scores) {
    const arr = Object.entries(scores || {})
      .filter(([, v]) => (v || 0) > 0)
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
      return String(a.code).localeCompare(String(b.code));
    });

    if (arr.length === 0) {
      return [{ code: "OK", score: 0, sev: "Info", sevRank: 0, name: "Monitor", quick: "今日は大丈夫。ログだけ残す" }];
    }
    return arr.slice(0, 3);
  }

  function hasCritical(top) {
    return (top || []).some(t => t.sev === "Critical");
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
    startBtn.type = "button";
    startBtn.addEventListener("click", () => step());
    box.appendChild(startBtn);

    function step() {
      if (idx >= DIAG_Q.length) return finish();
      const node = DIAG_Q[idx];

      box.innerHTML = `
        <div class="card">
          <div><strong>${escapeHtml(node.q)}</strong></div>
          <div class="row" style="margin-top:10px;">
            <button id="yesBtn" class="primary" type="button">YES</button>
            <button id="noBtn" type="button">NO</button>
          </div>
          <div class="muted" style="margin-top:8px;">${idx + 1} / ${DIAG_Q.length}</div>
        </div>
      `;

      const yesBtn = $("yesBtn");
      const noBtn = $("noBtn");
      if (yesBtn) yesBtn.addEventListener("click", () => apply(node.yes));
      if (noBtn) noBtn.addEventListener("click", () => apply(node.no));
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

      const rows = (top || []).map((t, i) => {
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
            <div><strong>#${i + 1} ${escapeHtml(t.code)} ${escapeHtml(t.name)}</strong>
              <span class="muted">（${escapeHtml(t.sev)} / score ${escapeHtml(t.score)}）</span>
            </div>
            <div class="muted" style="margin-top:6px;"><strong>即応：</strong> ${escapeHtml(t.quick)}</div>
          </div>
        `;
      }).join("");

      const codesToApply = (top || []).filter(t => t.code !== "OK").map(t => t.code);

      res.innerHTML = `
        ${banner}
        <div class="card">
          <div><strong>結果：上位3候補</strong> <span class="muted">（プロファイル：${escapeHtml(profile)}）</span></div>
          <div class="muted" style="margin-top:6px;">複合要因が前提。まず #1 を実施し、必要なら #2/#3 を追加。</div>
          <div class="row" style="margin-top:10px;">
            <button id="applyBtn" class="primary" type="button" ${codesToApply.length ? "" : "disabled"}>この結果をERR候補に反映</button>
            <button id="restartBtn" type="button">もう一回</button>
          </div>
          <div class="muted" style="margin-top:8px;">反映すると「入力」タブのERR候補がこの3つに切り替わる。</div>
        </div>
        ${rows}
      `;

      $("restartBtn")?.addEventListener("click", renderDiag);
      $("applyBtn")?.addEventListener("click", () => {
        safe(() => {
          // Switch to input tab
          qs('nav button[data-tab="log"]')?.click();
          setChipsFromCodes(codesToApply);
        });
      });

      box.innerHTML = `<div class="card"><div class="muted">診断が完了しました。</div></div>`;
    }
  }

  // ---------------------
  // Boot: bind everything after DOM ready
  // ---------------------
  async function boot() {
    // Make sure "partial DOM" does not kill the app
    safe(renderErrChips);
    safe(bindTabs);
    safe(bindSlider);
    safe(bindSave);
    safe(bindExportImport);
    safe(bindWipe);

    await safe(async () => { await initAuth(); });
    await safe(async () => { await refreshOwnerOptions(); });

    // If list tab is already active, render once
    const activeTabBtn = qs("nav button.active[data-tab]");
    const activeTab = activeTabBtn?.dataset?.tab;
    if (activeTab === "list") await safe(async () => await renderList());
    if (activeTab === "diag") safe(renderDiag);

    // Expose tiny debug info (optional)
    console.log("[WXK] boot ok", {
      supabaseEnabled: !!supabase,
      sessionUser,
      diagCount: DIAG_Q.length,
      errCount: ERR_CODES.length
    });
  }

  // Run boot at DOMContentLoaded (and also if already loaded)
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => boot().catch(console.error), { once: true });
  } else {
    boot().catch(console.error);
  }
})();
