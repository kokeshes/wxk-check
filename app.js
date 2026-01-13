// --- PWA register ---
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

window.addEventListener("DOMContentLoaded", () => {
  // 必須DOMが無いページでは何もしない
  const errChips = document.getElementById("errChips");
  const diagBox = document.getElementById("diagBox");
  const diagResult = document.getElementById("diagResult");
  if (!errChips || !diagBox || !diagResult) return;

  // --- Constants ---
  const STORAGE_KEY = "wxk_logs_v1";

  // ERRコード（3桁 + Eコード）
  const ERR_CODES = [
    // ===== 3桁 =====
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
    { code: "301", name: "学際翻訳過多", sev: "Med", quick: "仮結論を先に置く／対象読者を固定" },
    { code: "303", name: "締切未設定", sev: "High", quick: "擬似締切を作る（外部提出）" },

    // ===== Eコード（取説のエラー表）=====
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
    { code: "E710", name: "現実感の低下（ぼんやり／自分が遠い）", sev: "Critical", quick: "五感接地（冷水/香り/足裏）＋誰かの声" }
  ];

  const SEVERITY_RANK = { Critical: 3, High: 2, Med: 1, Info: 0 };

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
    for (const code of selectedErr) toggleChip(code, false);
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
  // Diagnosis Questions (充実版)
  // --------------------
  // ※ すべてキーは "E700": 5 のように文字列で統一
  const DIAG_Q = [
    // ====== A. Safety / Crisis ======
    { id:"A1", q:"今、危険（自己破壊衝動/安全が揺らぐ/一人がまずい）？", yes:{ "E700":10, "E710":4 }, no:{} },
    { id:"A2", q:"現実感が薄い／自分が遠い（ぼんやり・離人）？", yes:{ "E710":10, "E700":3 }, no:{} },
    { id:"A3", q:"今すぐ刺激源（人/通知/場所）から離れたほうがいい感じ？", yes:{ "E700":6, "E220":3, "002":2 }, no:{} },

    // ====== B. Body / Life base ======
    { id:"B1", q:"睡眠が足りない（6h未満/質が悪い/連日）？", yes:{ "E100":6, "E320":2, "E330":2, "005":1 }, no:{} },
    { id:"B2", q:"空腹・食事抜き・糖が足りない感じ？", yes:{ "E110":6, "E310":2, "E300":2 }, no:{} },
    { id:"B3", q:"水分不足っぽい（口渇/頭痛/めまい/暖房/運動後）？", yes:{ "E120":6, "E320":2, "E330":1 }, no:{} },
    { id:"B4", q:"疲労が溜まり、体力と情緒が同時に落ちてる？", yes:{ "E130":7, "001":2, "004":2 }, no:{} },
    { id:"B5", q:"身体が固い／呼吸が浅い／交感神経が上がりっぱなし？", yes:{ "E210":3, "E320":2, "E130":2 }, no:{} },

    // ====== C. People / Boundary ======
    { id:"C1", q:"優しくしすぎて抱え込みモードになってる？", yes:{ "E200":6, "104":3, "004":2 }, no:{} },
    { id:"C2", q:"連絡・要求が増えて“常駐”を期待されてる？", yes:{ "001":6, "201":3, "104":2 }, no:{} },
    { id:"C3", q:"相手の踏み込みが増えて“引き込まれそう”？（密室化/頻度増/曖昧許容）", yes:{ "E220":7, "202":4, "201":3 }, no:{} },
    { id:"C4", q:"侵害刺激（嫌な言葉/圧/ハラスメント）で固まる・反芻が出てる？", yes:{ "E210":7, "002":4, "203":2 }, no:{} },
    { id:"C5", q:"相手が試し行為（嫉妬/沈黙/既読無視/揺さぶり）をしてる？", yes:{ "203":7, "202":3, "E220":2 }, no:{ "102":2 } },
    { id:"C6", q:"関係の定義が曖昧なまま長引いてる？（期待と不安が循環）", yes:{ "202":7, "201":2, "003":1 }, no:{} },
    { id:"C7", q:"境界線を言うと嫌われる/壊れる気がして言えない？", yes:{ "102":4, "E200":3, "201":2 }, no:{} },
    { id:"C8", q:"いま“身体接触/私的接触”が危ない（線引きが必要）？", yes:{ "204":5, "E220":4, "002":2 }, no:{} },

    // ====== D. Cognition / Mood ======
    { id:"D1", q:"最悪想定が止まらない？", yes:{ "E320":7, "005":2, "003":1 }, no:{} },
    { id:"D2", q:"自己否定（恥/罪悪感/罵倒）ループに入ってる？", yes:{ "E330":7, "004":2 }, no:{} },
    { id:"D3", q:"怒りの熱で言葉が強くなりそう？", yes:{ "E310":6, "102":2 }, no:{} },
    { id:"D4", q:"焦ってタスクが空回り（手が散る/全部重い）？", yes:{ "E300":6, "303":2, "001":1 }, no:{} },
    { id:"D5", q:"感情を“処理”し続けて受信過多になってる？", yes:{ "004":7, "104":3, "E200":2 }, no:{} },
    { id:"D6", q:"夜に文章や判断が“過剰に意味深”になる傾向が出てる？", yes:{ "005":6, "E320":2, "003":1 }, no:{} },

    // ====== E. Work / Research (精密化：301/303/500/510/003) ======
    // 303：締切未設定
    { id:"E1", q:"締切がない/外部提出がないせいで終わらない？", yes:{ "303":7, "E300":2, "E510":1 }, no:{} },
    { id:"E2", q:"「いつまでに何を出すか」が一文で言えない？", yes:{ "303":5, "003":2, "E300":1 }, no:{} },

    // 003：責任未定義
    { id:"E3", q:"責任の所在が曖昧（誰が決める？）で止まってる？", yes:{ "003":7, "001":2, "104":1 }, no:{} },
    { id:"E4", q:"意思決定を自分で全部抱えてしまってる？（合意・委任がない）", yes:{ "003":5, "104":2, "001":1 }, no:{} },

    // 301：学際翻訳過多（ここが本丸）
    { id:"E5", q:"“説明のための説明”が増えて、本題が進まない？", yes:{ "301":7, "E510":2, "E300":1 }, no:{} },
    { id:"E6", q:"読者/相手（誰に向けた文か）が固定されていない？", yes:{ "301":6, "303":1 }, no:{} },
    { id:"E7", q:"レイヤーが混線（概念整理/批判/実証/例示が同じ段落に混ざる）？", yes:{ "301":6, "E510":2 }, no:{} },
    { id:"E8", q:"一次資料（原典/論文）の読み込みが詰まって、翻訳だけが回ってる？", yes:{ "301":5, "E500":1, "E510":2 }, no:{} },
    { id:"E9", q:"比喩・横道・関連知識が増えて、主張の線が太くならない？", yes:{ "301":5, "005":2 }, no:{} },

    // 500：過集中
    { id:"E10", q:"時間感覚が飛ぶ没入が出てる？（補給忘れ）", yes:{ "E500":6, "E010":2, "E120":1 }, no:{} },
    { id:"E11", q:"集中が切れた瞬間に急落する（燃料切れ→荒れ）？", yes:{ "E500":4, "E130":2, "E330":1 }, no:{} },

    // 510：反芻
    { id:"E12", q:"同じ文/同じ考えを焼き続けて進まない？", yes:{ "E510":7, "003":2, "005":1 }, no:{} },
    { id:"E13", q:"「保留」の宣言ができず、決着を求めて詰まってる？", yes:{ "E510":5, "303":2, "003":1 }, no:{} },

    // ====== F. Urge / craving ======
    { id:"F1", q:"口寂しさ/儀式が欲しい程度の渇望がある？", yes:{ "E400":5 }, no:{} },
    { id:"F2", q:"渇望が強く、思考が奪われてる？", yes:{ "E410":7, "E130":2, "E110":1 }, no:{} },

    // ====== G. Night rule / finishing ======
    { id:"G1", q:"夜に結論を出したくなってる？（即断・長文化）", yes:{ "005":6, "003":2, "E320":1 }, no:{} },
    { id:"G2", q:"今日の自分は“整えるより決めたい”モードが強い？", yes:{ "005":4, "003":2, "E300":1 }, no:{} }
  ];

  function getErrMeta(code) {
    const ref = ERR_CODES.find(e => e.code === code);
    if (!ref) return { sev: "Info", name: "不明", quick: "距離復帰／範囲を決める" };
    return ref;
  }

  // プロファイル補正（起きやすさの微加点）
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
        scores["E500"] = (scores["E500"] || 0) + 1;
        scores["E510"] = (scores["E510"] || 0) + 1;
        break;

      case "相談/友人":
        scores["004"] = (scores["004"] || 0) + 1;
        scores["104"] = (scores["104"] || 0) + 1;
        scores["101"] = (scores["101"] || 0) + 1;
        scores["E200"] = (scores["E200"] || 0) + 1;
        scores["E210"] = (scores["E210"] || 0) + 1;
        break;

      case "単独":
        scores["005"] = (scores["005"] || 0) + 1;
        scores["E320"] = (scores["E320"] || 0) + 1;
        scores["E330"] = (scores["E330"] || 0) + 1;
        scores["E011"] = (scores["E011"] || 0) + 1;
        break;

      default:
        scores["E300"] = (scores["E300"] || 0) + 1;
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

  // overload(0–5) を診断に加点
  function overloadBoost(scores) {
    const ov = Number(document.getElementById("overload")?.value || 0);

    if (ov >= 5) {
      scores["E130"] = (scores["E130"] || 0) + 4;
      scores["001"]  = (scores["001"]  || 0) + 2;
      scores["004"]  = (scores["004"]  || 0) + 2;
      scores["E330"] = (scores["E330"] || 0) + 1;
    } else if (ov >= 4) {
      scores["E130"] = (scores["E130"] || 0) + 3;
      scores["001"]  = (scores["001"]  || 0) + 1;
      scores["004"]  = (scores["004"]  || 0) + 1;
    } else if (ov >= 3) {
      scores["E300"] = (scores["E300"] || 0) + 1;
      scores["E320"] = (scores["E320"] || 0) + 1;
    }
    return scores;
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
      scores = overloadBoost(scores);

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
          <div><strong>結果：上位3候補</strong> <span class="muted">（プロファイル：${escapeHtml(profile)} / 過負荷 ${escapeHtml(String(overload.value))}）</span></div>
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

      document.getElementById("applyBtn")?.addEventListener("click", () => {
        document.querySelector('nav button[data-tab="log"]').click();
        setChipsFromCodes(codesToApply);
      });

      box.innerHTML = `<div class="card"><div class="muted">診断が完了しました。</div></div>`;
    }
  }
});
