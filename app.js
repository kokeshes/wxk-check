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
    // Accept both E000 and E0000 as same family, but keep display as E0000
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
  // ---------------------
  const SUPABASE_URL = "https://YOUR_PROJECT.supabase.co";
  const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";

  const supabase = safe(() => {
    const okUrl = typeof SUPABASE_URL === "string" && SUPABASE_URL.startsWith("https://") && SUPABASE_URL.includes("supabase.co");
    const okKey = typeof SUPABASE_ANON_KEY === "string" && SUPABASE_ANON_KEY.startsWith("ey") && SUPABASE_ANON_KEY.length > 20;
    const hasLib = !!(window.supabase && typeof window.supabase.createClient === "function");
    if (okUrl && okKey && hasLib) return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return null;
  });

  // ---------------------
  // Constants
  // ---------------------
  const STORAGE_KEY = "wxk_logs_v3";
  const SEVERITY_RANK = { "Critical": 3, "High": 2, "Med": 1, "Info": 0 };

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

    // --- E-codes (note: E0000 is canonical display) ---
    { code: "E0000", name: "平常運転（異常なし）", sev: "Info", quick: "維持。良かった要因を1行ログ" },
    // 互換：古い参照がE000でもOK（normalizeでE0000に統一）
    { code: "E010", name: "雷出力：安定（集中・快）", sev: "Info", quick: "45–90分ごとに小休止＋水分固定" },
    { code: "E011", name: "思考が“外部モード”へ（距離が取れる）", sev: "Info", quick: "分析OK。感情は日本語で1回着地" },

    // 追加：良い状態の内訳（精度＋説明力UP）
    { code: "E020", name: "身体コンディション良好", sev: "Info", quick: "現状維持（睡眠/水分/食事を崩さない）" },
    { code: "E021", name: "境界線が機能している", sev: "Info", quick: "説明しすぎず短文で継続" },
    { code: "E022", name: "タスク明確で前進中", sev: "Info", quick: "次の一手だけ決めて淡々と" },
    { code: "E023", name: "情緒が安定（反芻少）", sev: "Info", quick: "刺激を増やさず維持" },
    { code: "E024", name: "対人負荷が軽い", sev: "Info", quick: "接触密度を今のまま維持" },

    // 生活基盤
    { code: "E100", name: "睡眠不足（軽）", sev: "Med", quick: "仮眠20分 or 今夜の締切を決め就寝固定" },
    { code: "E110", name: "低血糖（焦り・苛立ち）", sev: "Med", quick: "水＋糖＋タンパク（例：おにぎり＋乳製品）" },
    { code: "E120", name: "脱水（頭痛・めまい・情緒揺れ）", sev: "Med", quick: "水＋少量塩分。カフェインは後回し" },
    { code: "E130", name: "過負荷（体力・情緒の同時劣化）", sev: "High", quick: "強制デロード（軽い日）＋睡眠確保" },

    // 対人・境界
    { code: "E200", name: "境界が薄くなる（抱え込み）", sev: "Med", quick: "「できる/できない」を短文で宣言（説明しない）" },
    { code: "E210", name: "侵害刺激でフリーズ／反芻", sev: "High", quick: "距離→事実のみ記録→上長/第三者へ共有" },
    { code: "E220", name: "危険接近（引き込まれリスク）", sev: "Critical", quick: "接触ルール固定（時間/場所/回数）＋同席者" },

    // 気分・認知
    { code: "E300", name: "焦燥（タスク過密で空回り）", sev: "Med", quick: "「今日の最小勝利」を1つ決め他は保留" },
    { code: "E310", name: "怒りの熱（言葉が強くなる）", sev: "Med", quick: "即返信しない→水→5分歩く。文章は短く" },
    { code: "E320", name: "不安増幅（最悪想定が止まらない）", sev: "High", quick: "通知OFF→確認できる事実だけ紙に書く" },
    { code: "E330", name: "自己否定ループ（恥・罪悪感）", sev: "High", quick: "評価軸を外に置く（睡眠/栄養/水分/運動）" },

    // 研究・作業
    { code: "E500", name: "過集中前兆（時間が消える）", sev: "Med", quick: "タイマー45–60分＋水分を手元固定" },
    { code: "E510", name: "反芻（同じ一文を回し続ける）", sev: "High", quick: "「結論保留」でメモに封印→身体作業へ切替" },

    // 渇望・衝動
    { code: "E400", name: "渇望（軽）：口寂しさ／手持ち無沙汰", sev: "Med", quick: "代替行動を固定（ガム/炭酸/散歩3分）" },
    { code: "E410", name: "渇望（強）：思考が奪われる", sev: "High", quick: "補給→場所移動→5分だけ別タスク" },

    // 危機
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
      // 診断専用Infoもチップに出すか？ → 出さない（E系Infoは診断結果として見せたい）
      // ただしユーザーが手動選択したい場合もあるので、表示したいならここを調整。
      // 今回は「全部表示」にしておく。
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
    if (loginBtn && !loginBtn.dataset.bound) {
      loginBtn.dataset.bound = "1";
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
    if (logoutBtn && !logoutBtn.dataset.bound) {
      logoutBtn.dataset.bound = "1";
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

    if (!supabase || !sessionUser) {
      ownerOptions = [{ owner_id: "local", label: "この端末（ローカル）", isSelf: true }];
      activeOwnerId = "local";
      sel.appendChild(new Option(ownerOptions[0].label, ownerOptions[0].owner_id));
      sel.disabled = true;
      return;
    }

    ownerOptions.push({ owner_id: sessionUser.id, label: "自分（クラウド）", isSelf: true });

    const resp = await safe(async () => {
      return await supabase.from("log_viewers").select("owner_id").eq("viewer_email", sessionUser.email);
    });

    if (!resp?.error && Array.isArray(resp?.data)) {
      const uniq = Array.from(new Set(resp.data.map(x => x.owner_id).filter(Boolean)));
      let n = 1;
      uniq.forEach((oid) => {
        if (oid !== sessionUser.id) ownerOptions.push({ owner_id: oid, label: `共有：オーナー#${n++}`, isSelf: false });
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

  // ---------------------
  // Save entry (always local, optional cloud)
  // ---------------------
  async function saveEntry() {
    const profile = $("profile")?.value || "その他";
    const overloadVal = Number($("overload")?.value ?? 0);

    const entry = {
      id: (crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()) + "_" + Math.random().toString(16).slice(2)),
      ts: new Date().toISOString(),
      profile,
      overload: overloadVal,
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

    const logs = loadLogsLocal();
    logs.unshift(entry);
    saveLogsLocal(logs);

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

      const ins = await safe(async () => await supabase.from("logs").insert(payload));
      if (ins?.error) {
        setText("saveMsg", `ローカル保存OK / クラウド同期失敗：${ins.error.message}`);
        setTimeout(() => setText("saveMsg", ""), 2400);
        return;
      }
    }

    setText("saveMsg", "保存しました。");
    setTimeout(() => setText("saveMsg", ""), 1200);
  }

  function bindSave() {
    const btn = $("saveBtn");
    if (!btn || btn.dataset.bound) return;
    btn.dataset.bound = "1";
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

    if (resp?.error) {
      const li = document.createElement("li");
      li.className = "card";
      li.innerHTML = `<div class="muted">取得失敗：${escapeHtml(resp.error.message)}</div>`;
      ul.appendChild(li);
      return;
    }

    (resp?.data || []).forEach(row => {
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
        li.querySelector("[data-del]")?.addEventListener("click", async () => {
          const del = await safe(async () => await supabase.from("logs").delete().eq("id", row.id));
          if (del?.error) alert(`削除失敗：${del.error.message}`);
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
    if (exportBtn && !exportBtn.dataset.bound) {
      exportBtn.dataset.bound = "1";
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
    if (importFile && !importFile.dataset.bound) {
      importFile.dataset.bound = "1";
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
    if (!wipeBtn || wipeBtn.dataset.bound) return;
    wipeBtn.dataset.bound = "1";
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
        const ins = await safe(async () => await supabase.from("log_viewers").insert({ owner_id: sessionUser.id, viewer_email: vEmail }));
        if (ins?.error) return alert(`追加失敗：${ins.error.message}`);
        if ($("viewerEmail")) $("viewerEmail").value = "";
        await renderViewerList();
        await refreshOwnerOptions();
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
        const del = await safe(async () => await supabase
          .from("log_viewers")
          .delete()
          .eq("owner_id", sessionUser.id)
          .eq("viewer_email", v.viewer_email));
        if (del?.error) alert(`削除失敗：${del.error.message}`);
        await renderViewerList();
        await refreshOwnerOptions();
      });

      ul.appendChild(li);
    });
  }

  // =====================
  // Diagnosis engine (E0000 baseline + more questions)
  // =====================

  function addScore(scores, codeRaw, delta) {
    const code = normalizeCode(codeRaw);
    scores[code] = (scores[code] || 0) + delta;
  }

  function clampScores(scores) {
    for (const k of Object.keys(scores)) {
      if (!Number.isFinite(scores[k])) scores[k] = 0;
      if (scores[k] < 0) scores[k] = 0;
    }
    return scores;
  }

  function isGoodInfo(code) {
    return ["E0000", "E010", "E011", "E020", "E021", "E022", "E023", "E024"].includes(code);
  }

  function hasRisk(scores) {
    let sum = 0;
    for (const [code, v] of Object.entries(scores)) {
      if (isGoodInfo(code)) continue;
      sum += (v || 0);
    }
    return sum >= 3;
  }

  function profileBoost(profile, scores) {
    // リスクが出た場合のみ呼ぶ
    switch (profile) {
      case "恋愛":
        addScore(scores, "201", 1);
        addScore(scores, "202", 1);
        addScore(scores, "102", 1);
        addScore(scores, "E200", 1);
        addScore(scores, "E220", 1);
        break;
      case "仕事/研究":
        addScore(scores, "003", 1);
        addScore(scores, "301", 1);
        addScore(scores, "303", 1);
        addScore(scores, "E300", 1);
        addScore(scores, "E510", 1);
        addScore(scores, "E500", 1);
        break;
      case "相談/友人":
        addScore(scores, "004", 1);
        addScore(scores, "104", 1);
        addScore(scores, "101", 1);
        addScore(scores, "E200", 1);
        addScore(scores, "E210", 1);
        addScore(scores, "E330", 1);
        break;
      case "単独":
        addScore(scores, "005", 1);
        addScore(scores, "E320", 1);
        addScore(scores, "E330", 1);
        addScore(scores, "E011", 1);
        break;
      default:
        addScore(scores, "E300", 1);
        addScore(scores, "004", 1);
        break;
    }
    return scores;
  }

  function sortTop(scores) {
    clampScores(scores);

    // E0000は必ず候補に残す（0点でも最低1点扱い）
    if (!("E0000" in scores)) scores["E0000"] = 1;
    if (scores["E0000"] <= 0) scores["E0000"] = 1;

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

    return arr.slice(0, 3);
  }

  function hasCritical(top) {
    return (top || []).some(t => t.sev === "Critical");
  }

  // Branch format:
  //  yes: { add:{...}, sub:{...} }
  //  no : { add:{...}, sub:{...} }
  // Rule:
  //  - Problem YES -> add risk + sub E0000
  //  - Good YES/NO -> add E0000 + good-infos
  const DIAG_Q = [
    // --- Good state confirmations (increase true-negative precision) ---
    { id:"g_sleep_ok", q:"睡眠は足りている（6h以上/質が悪すぎない）？",
      yes:{ add:{ "E0000": 3, "E020": 2, "E023": 1 }, sub:{} },
      no :{ add:{ "E100": 6, "E320": 2 }, sub:{ "E0000": 4 } } },

    { id:"g_food_ok", q:"今日は食事を抜いていない（低血糖っぽさがない）？",
      yes:{ add:{ "E0000": 2, "E020": 2 }, sub:{} },
      no :{ add:{ "E110": 6, "E300": 2, "E310": 1 }, sub:{ "E0000": 3 } } },

    { id:"g_water_ok", q:"水分は足りている（口渇/頭痛/めまいがない）？",
      yes:{ add:{ "E0000": 2, "E020": 2 }, sub:{} },
      no :{ add:{ "E120": 6, "E320": 2 }, sub:{ "E0000": 3 } } },

    { id:"g_body_ok", q:"痛み・体調不良が意思決定に影響していない？",
      yes:{ add:{ "E0000": 2, "E020": 1 }, sub:{} },
      no :{ add:{ "E130": 4, "E320": 1 }, sub:{ "E0000": 2 } } },

    { id:"g_schedule_ok", q:"今日は予定が詰まりすぎていない？",
      yes:{ add:{ "E0000": 2, "E023": 1 }, sub:{} },
      no :{ add:{ "E300": 4, "E130": 2 }, sub:{ "E0000": 2 } } },

    { id:"g_boundary_ok", q:"境界線が守れている（抱え込み・過剰対応をしていない）？",
      yes:{ add:{ "E0000": 2, "E021": 3, "E024": 1 }, sub:{} },
      no :{ add:{ "E200": 6, "104": 2, "004": 1 }, sub:{ "E0000": 3 } } },

    { id:"g_task_ok", q:"今日のタスクは明確（次の一手が決まっている）？",
      yes:{ add:{ "E0000": 2, "E022": 3 }, sub:{} },
      no :{ add:{ "E300": 5, "303": 2 }, sub:{ "E0000": 2 } } },

    { id:"g_mood_ok", q:"今の気分は安定している（反芻が少ない）？",
      yes:{ add:{ "E0000": 2, "E023": 3 }, sub:{} },
      no :{ add:{ "E320": 4, "E510": 2, "E330": 1 }, sub:{ "E0000": 2 } } },

    // --- Safety / crisis ---
    { id:"c_crisis", q:"今、危険（自己破壊衝動/安全が揺らぐ/一人がまずい）？",
      yes:{ add:{ "E700": 10, "E710": 4 }, sub:{ "E0000": 8 } },
      no :{ add:{ "E0000": 1 }, sub:{} } },

    { id:"c_dereal", q:"現実感が薄い／自分が遠い感じがある？",
      yes:{ add:{ "E710": 9, "E700": 3 }, sub:{ "E0000": 6 } },
      no :{ add:{ "E0000": 1 }, sub:{} } },

    { id:"c_unsafe_place", q:"今いる場所/相手/状況が安全ではない（離れるべき）？",
      yes:{ add:{ "E700": 6, "E220": 4, "002": 3 }, sub:{ "E0000": 5 } },
      no :{ add:{ "E0000": 1 }, sub:{} } },

    // --- Body / life base (granular) ---
    { id:"b_sleep_debt", q:"寝不足が2日以上続いている？",
      yes:{ add:{ "E100": 4, "E130": 3, "E320": 2 }, sub:{ "E0000": 3 } },
      no :{ add:{ "E0000": 1 }, sub:{} } },

    { id:"b_overload_body", q:"疲労が溜まり、体力と情緒が同時に落ちてる？",
      yes:{ add:{ "E130": 7, "001": 2, "004": 2 }, sub:{ "E0000": 3 } },
      no :{ add:{ "E0000": 1 }, sub:{} } },

    { id:"b_stimulants", q:"カフェイン/ニコチン/刺激で整えようとして逆に乱れてる？",
      yes:{ add:{ "E320": 2, "E400": 2, "E410": 1 }, sub:{ "E0000": 1 } },
      no :{ add:{ "E0000": 1 }, sub:{} } },

    // --- People / boundary (granular) ---
    { id:"p_invasion", q:"相手の踏み込みすぎ（時間/身体/尊厳）を感じる？",
      yes:{ add:{ "002": 6, "E210": 3, "E220": 2 }, sub:{ "E0000": 4 } },
      no :{ add:{ "E0000": 1, "E021": 1 }, sub:{} } },

    { id:"p_freeze", q:"侵害刺激で固まる・反芻が出てる？",
      yes:{ add:{ "E210": 7, "002": 3, "203": 2 }, sub:{ "E0000": 3 } },
      no :{ add:{ "E0000": 1 }, sub:{} } },

    { id:"p_pull", q:"相手の踏み込みが増えて“引き込まれそう”？（密室化/頻度増/曖昧許容）",
      yes:{ add:{ "E220": 8, "202": 4, "201": 3 }, sub:{ "E0000": 4 } },
      no :{ add:{ "E0000": 1, "E024": 1 }, sub:{} } },

    { id:"p_test", q:"相手が試し行為（嫉妬/沈黙/揺さぶり）をしてる？",
      yes:{ add:{ "203": 7, "202": 4, "E220": 2 }, sub:{ "E0000": 3 } },
      no :{ add:{ "E0000": 1, "102": 1 }, sub:{} } },

    { id:"p_role", q:"“支える役/判断役”を続けすぎてる？",
      yes:{ add:{ "001": 4, "104": 3, "004": 2 }, sub:{ "E0000": 2 } },
      no :{ add:{ "E0000": 1, "E011": 1 }, sub:{} } },

    { id:"p_end_amb", q:"終了条件（いつまで/どこまで）が曖昧？",
      yes:{ add:{ "001": 5, "003": 3, "104": 2 }, sub:{ "E0000": 3 } },
      no :{ add:{ "E0000": 1, "E021": 1 }, sub:{} } },

    { id:"p_responsibility", q:"責任の所在が曖昧で、あなたが埋め合わせてる？",
      yes:{ add:{ "003": 6, "001": 2 }, sub:{ "E0000": 3 } },
      no :{ add:{ "E0000": 1, "E022": 1 }, sub:{} } },

    { id:"p_overshare", q:"初動で開示しすぎて後から重くなりそう？",
      yes:{ add:{ "101": 4, "E200": 1 }, sub:{ "E0000": 2 } },
      no :{ add:{ "E0000": 1 }, sub:{} } },

    // --- Cognition / mood ---
    { id:"m_anx", q:"最悪想定が止まらない？",
      yes:{ add:{ "E320": 6, "005": 1, "003": 1 }, sub:{ "E0000": 3 } },
      no :{ add:{ "E0000": 1, "E023": 1 }, sub:{} } },

    { id:"m_checking", q:"通知/相手の反応を何度も確認してしまう？",
      yes:{ add:{ "E320": 3, "203": 1, "201": 1 }, sub:{ "E0000": 2 } },
      no :{ add:{ "E0000": 1 }, sub:{} } },

    { id:"m_selfhate", q:"自己否定（恥/罪悪感/罵倒）ループ？",
      yes:{ add:{ "E330": 6, "004": 2 }, sub:{ "E0000": 3 } },
      no :{ add:{ "E0000": 1 }, sub:{} } },

    { id:"m_anger", q:"怒りの熱で言葉が強くなりそう？（即返信したい）",
      yes:{ add:{ "E310": 5, "102": 1 }, sub:{ "E0000": 2 } },
      no :{ add:{ "E0000": 1 }, sub:{} } },

    { id:"m_rush", q:"焦ってタスクが空回り？（手が散る/全部重い）",
      yes:{ add:{ "E300": 5, "303": 2 }, sub:{ "E0000": 2 } },
      no :{ add:{ "E0000": 1, "E022": 1 }, sub:{} } },

    { id:"m_meaning", q:"意味生成が止まらず疲れてる？",
      yes:{ add:{ "005": 5, "E320": 1, "003": 1 }, sub:{ "E0000": 2 } },
      no :{ add:{ "E0000": 1 }, sub:{} } },

    // --- Work / research ---
    { id:"w_hyperfocus", q:"時間感覚が飛ぶ没入が出てる（補給忘れ）？",
      yes:{ add:{ "E500": 5, "E010": 2 }, sub:{ "E0000": 1 } },
      no :{ add:{ "E0000": 1 }, sub:{} } },

    { id:"w_ruminate", q:"同じ文/同じ考えを焼き続けて進まない？",
      yes:{ add:{ "E510": 6, "003": 1, "005": 1 }, sub:{ "E0000": 2 } },
      no :{ add:{ "E0000": 1, "E022": 1 }, sub:{} } },

    { id:"w_interdiscipline", q:"多領域にまたがり『翻訳』だけで時間が溶けてる？",
      yes:{ add:{ "301": 6, "E510": 2, "E300": 1 }, sub:{ "E0000": 2 } },
      no :{ add:{ "E0000": 1 }, sub:{} } },

    { id:"w_premise", q:"前提・定義整備で止まって前進感がない？",
      yes:{ add:{ "301": 5, "E510": 2 }, sub:{ "E0000": 2 } },
      no :{ add:{ "E0000": 1 }, sub:{} } },

    { id:"w_deadline", q:"締切/提出が曖昧で先延ばしが起きてる？",
      yes:{ add:{ "303": 6, "E300": 1 }, sub:{ "E0000": 2 } },
      no :{ add:{ "E0000": 1, "E022": 1 }, sub:{} } },

    // --- Urge / impulse ---
    { id:"u_light", q:"口寂しさ/儀式が欲しい程度の渇望？",
      yes:{ add:{ "E400": 4 }, sub:{ "E0000": 1 } },
      no :{ add:{ "E0000": 1 }, sub:{} } },

    { id:"u_strong", q:"渇望が強く、思考が奪われてる？",
      yes:{ add:{ "E410": 6, "E130": 2 }, sub:{ "E0000": 2 } },
      no :{ add:{ "E0000": 1 }, sub:{} } },

    // --- Night rule (more granular) ---
    { id:"n_decide", q:"夜に結論を出したくなってる？",
      yes:{ add:{ "005": 5, "003": 2, "E320": 2 }, sub:{ "E0000": 2 } },
      no :{ add:{ "E0000": 1 }, sub:{} } },

    { id:"n_longmsg", q:"夜に長文を送りたくなってる？",
      yes:{ add:{ "005": 3, "101": 2, "E310": 1 }, sub:{ "E0000": 1 } },
      no :{ add:{ "E0000": 1 }, sub:{} } },
  ];

  function renderDiag() {
    const box = $("diagBox");
    const res = $("diagResult");
    if (!box || !res) return;

    box.innerHTML = "";
    res.innerHTML = "<div class='muted'>開始を押してね。</div>";

    let idx = 0;

    // ★E0000 baseline: always present and tends to win when all is fine
    let scores = { "E0000": 12 };

    // incorporate current overload slider lightly
    const overloadNow = Number($("overload")?.value ?? 0);
    if (overloadNow >= 4) addScore(scores, "E0000", -3);
    if (overloadNow === 0) addScore(scores, "E0000", +2);

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

      $("yesBtn")?.addEventListener("click", () => apply(node.yes));
      $("noBtn")?.addEventListener("click", () => apply(node.no));
    }

    function apply(branch) {
      const addMap = branch?.add || {};
      const subMap = branch?.sub || {};

      for (const [code, pts] of Object.entries(addMap)) addScore(scores, code, pts);
      for (const [code, pts] of Object.entries(subMap)) addScore(scores, code, -Math.abs(pts));

      idx += 1;
      step();
    }

    function finish() {
      const profile = $("profile")?.value || "その他";

      if (hasRisk(scores)) {
        scores = profileBoost(profile, scores);
      } else {
        // if no risk, reinforce E0000 & good-state breakdown
        addScore(scores, "E0000", +4);
        addScore(scores, "E023", +2);
      }

      clampScores(scores);
      const top = sortTop(scores);
      const critical = hasCritical(top);

      const banner = critical
        ? `<div class="card" style="border-color:#b00020;">
            <div style="font-weight:700;color:#b00020;">⚠ Critical 検知</div>
            <div class="muted">まず #1 の即応を最優先。必要なら距離復帰＋範囲/期限の再設定。</div>
          </div>`
        : `<div class="card"><div class="muted">Criticalなし。#1から順に軽く当てていく。</div></div>`;

      const rows = (top || []).map((t, i) => `
        <div class="card">
          <div><strong>#${i + 1} ${escapeHtml(t.code)} ${escapeHtml(t.name)}</strong>
            <span class="muted">（${escapeHtml(t.sev)} / score ${escapeHtml(t.score)}）</span>
          </div>
          <div class="muted" style="margin-top:6px;"><strong>即応：</strong> ${escapeHtml(t.quick)}</div>
        </div>
      `).join("");

      // Apply to chips: do NOT apply good-info codes automatically (including E0000)
      const codesToApply = (top || [])
        .map(t => t.code)
        .filter(c => !isGoodInfo(c));

      res.innerHTML = `
        ${banner}
        <div class="card">
          <div><strong>結果：上位3候補</strong>
            <span class="muted">（プロファイル：${escapeHtml(profile)} / 質問数：${DIAG_Q.length}）</span>
          </div>
          <div class="muted" style="margin-top:6px;">
            ※E0000が#1なら「特に異常なし」。維持要因だけ1行ログ推奨。<br>
            ※反映は“問題系コード”のみ（E0000などInfoは除外）。
          </div>
          <div class="row" style="margin-top:10px;">
            <button id="applyBtn" class="primary" type="button" ${codesToApply.length ? "" : "disabled"}>この結果をERR候補に反映</button>
            <button id="restartBtn" type="button">もう一回</button>
          </div>
        </div>
        ${rows}
      `;

      $("restartBtn")?.addEventListener("click", renderDiag);

      $("applyBtn")?.addEventListener("click", () => {
        safe(() => {
          qs('nav button[data-tab="log"]')?.click();
          setChipsFromCodes(codesToApply);
        });
      });

      box.innerHTML = `<div class="card"><div class="muted">診断が完了しました。</div></div>`;
    }
  }

  // ---------------------
  // Boot
  // ---------------------
  async function boot() {
    safe(renderErrChips);
    safe(bindTabs);
    safe(bindSlider);
    safe(bindSave);
    safe(bindExportImport);
    safe(bindWipe);

    await safe(async () => { await initAuth(); });
    await safe(async () => { await refreshOwnerOptions(); });

    const activeTabBtn = qs("nav button.active[data-tab]");
    const activeTab = activeTabBtn?.dataset?.tab;

    if (activeTab === "list") await safe(async () => await renderList());
    if (activeTab === "diag") safe(renderDiag);

    console.log("[WXK] boot ok", {
      supabaseEnabled: !!supabase,
      sessionUser,
      diagCount: DIAG_Q.length,
      errCount: ERR_CODES.length
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => boot().catch(console.error), { once: true });
  } else {
    boot().catch(console.error);
  }
})();
