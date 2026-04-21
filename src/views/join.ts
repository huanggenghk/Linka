export interface JoinPageEvent {
  name: string;
  date: string | null;
  location: string | null;
  host?: string | null;
}

export interface FeedEntry {
  name: string;
  profilePreview: string;
  joinedAt: string;
}

export interface JoinPageData {
  event: JoinPageEvent;
  activeCount: number;
  feed: FeedEntry[];
  joinUrl: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatRelative(iso: string, now: number = Date.now()): string {
  const t = new Date(iso).getTime();
  const diff = Math.max(0, now - t);
  const min = Math.floor(diff / 60000);
  if (min < 1) return "刚刚";
  if (min < 60) return `${min} min 前`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  return `${d} 天前`;
}

function truncate(s: string, n: number): string {
  const chars = Array.from(s);
  if (chars.length <= n) return s;
  return chars.slice(0, n).join("").trimEnd() + "…";
}

function renderFeedRow(entry: FeedEntry, now: number): string {
  const t = escapeHtml(formatRelative(entry.joinedAt, now));
  const who = escapeHtml(entry.name);
  const what = escapeHtml(truncate(entry.profilePreview, 40));
  return `      <div class="feed-row">
        <span class="t">${t}</span>
        <span class="who">${who}</span>
        <span class="arrow">→</span>
        <span class="what">${what}</span>
      </div>`;
}

export function renderJoinPage(data: JoinPageData): string {
  const now = Date.now();
  const eventName = escapeHtml(data.event.name);
  const joinUrl = escapeHtml(data.joinUrl);
  const activeCount = Math.max(0, Math.floor(data.activeCount));

  const metaRows: string[] = [];
  if (data.event.date) {
    metaRows.push(`    <div class="row"><span class="label">DATE</span><span>${escapeHtml(data.event.date)}</span></div>`);
  }
  if (data.event.location) {
    metaRows.push(`    <div class="row"><span class="label">LOC</span><span>${escapeHtml(data.event.location)}</span></div>`);
  }
  if (data.event.host) {
    metaRows.push(`    <div class="row"><span class="label">HOST</span><span>${escapeHtml(data.event.host)}</span></div>`);
  }
  const metaBlock = metaRows.length
    ? `  <div class="event-meta">\n${metaRows.join("\n")}\n  </div>`
    : "";

  // Seamless vertical loop needs two copies of the track. Also, if the feed is
  // small, repeat entries so the track fills enough height that scrolling feels
  // continuous rather than ping-ponging.
  let padded = data.feed.slice();
  while (padded.length > 0 && padded.length < 6) padded = padded.concat(data.feed);
  const rows = padded.map((e) => renderFeedRow(e, now)).join("\n");
  const trackHtml = padded.length > 0 ? `${rows}\n${rows}` : "";

  return `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
<meta name="theme-color" content="#07090F" />
<title>${eventName} — Linka</title>
<link rel="preconnect" href="https://fonts.bunny.net">
<link href="https://fonts.bunny.net/css?family=dm-sans:400,500,600,700|jetbrains-mono:400,500" rel="stylesheet">
<style>
  :root {
    --bg: #07090F;
    --amber: #C28B3E;
    --amber-soft: #D4A04A;
    --amber-dim: rgba(194,139,62,0.55);
    --text: rgba(255,252,244,0.94);
    --text-dim: rgba(255,252,244,0.55);
    --text-muted: rgba(255,252,244,0.32);
    --line: rgba(255,255,255,0.10);
  }
  * { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0; min-height: 100vh;
    background: var(--bg);
    color: var(--text);
    font-family: 'DM Sans', -apple-system, 'PingFang SC', 'Noto Sans SC', sans-serif;
    font-size: 15px;
    -webkit-font-smoothing: antialiased;
    overflow-x: hidden;
  }
  body { position: relative; }

  body::before, body::after {
    content: ''; position: fixed; pointer-events: none; z-index: 0;
  }
  body::before {
    top: -10%; right: -10%; width: 60vw; height: 60vw;
    background: radial-gradient(ellipse at 70% 35%, rgba(180,110,20,0.45) 0%, rgba(180,110,20,0.10) 45%, transparent 70%);
  }
  body::after {
    bottom: -10%; left: -15%; width: 55vw; height: 55vw;
    background: radial-gradient(ellipse at 25% 55%, rgba(30,60,140,0.40) 0%, rgba(30,60,140,0.08) 45%, transparent 72%);
  }

  canvas#network {
    position: fixed; inset: 0; width: 100%; height: 100%;
    z-index: 1; pointer-events: none;
  }

  .scan-line {
    position: fixed; inset: 0; z-index: 2; pointer-events: none;
    background: linear-gradient(180deg, transparent 0%, rgba(194,139,62,0.025) 50%, transparent 100%);
    background-size: 100% 8px;
    mix-blend-mode: overlay;
    opacity: 0.6;
  }

  main {
    position: relative; z-index: 3;
    max-width: 520px; margin: 0 auto;
    padding: 64px 24px 96px;
    min-height: 100vh;
    display: flex; flex-direction: column;
  }

  h1.event {
    font-family: 'DM Sans', 'PingFang SC', sans-serif;
    font-weight: 700;
    font-size: 36px;
    line-height: 1.15;
    letter-spacing: -0.02em;
    margin: 0 0 24px;
    color: var(--text);
  }

  .event-meta {
    display: flex; flex-direction: column; gap: 8px;
    margin-bottom: 36px;
    font-size: 14px;
    color: var(--text-dim);
  }
  .event-meta .row {
    display: flex; align-items: center; gap: 12px;
  }
  .event-meta .label {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px; letter-spacing: 0.1em;
    color: var(--amber-dim);
    min-width: 38px;
    text-transform: uppercase;
  }

  .live {
    position: relative;
    background: rgba(255,255,255,0.04);
    border: 1px solid var(--line);
    border-radius: 12px;
    margin-bottom: 32px;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    overflow: hidden;
  }
  .live-header {
    display: flex; align-items: baseline; justify-content: space-between;
    padding: 18px 20px 14px;
    border-bottom: 1px dashed var(--line);
  }
  .live-count {
    display: flex; align-items: baseline; gap: 10px;
  }
  .live-count .num {
    font-family: 'DM Sans', sans-serif;
    font-weight: 700; font-size: 32px;
    line-height: 1;
    color: var(--text);
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.01em;
  }
  .live-count .num::after {
    content: ''; display: inline-block;
    width: 8px; height: 8px; border-radius: 50%;
    background: var(--amber);
    margin-left: 10px; vertical-align: middle;
    box-shadow: 0 0 12px rgba(194,139,62,0.8);
    animation: livedot 1.4s ease-in-out infinite;
  }
  @keyframes livedot { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.85); } }
  .live-count .lbl {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px; letter-spacing: 0.1em;
    color: var(--amber-dim);
    text-transform: uppercase;
  }
  .live-tag {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px; letter-spacing: 0.1em;
    color: var(--text-muted);
    text-transform: uppercase;
  }

  .feed {
    position: relative;
    height: 112px;
    overflow: hidden;
    -webkit-mask-image: linear-gradient(180deg, transparent 0, #000 18%, #000 82%, transparent 100%);
            mask-image: linear-gradient(180deg, transparent 0, #000 18%, #000 82%, transparent 100%);
  }
  .feed-track {
    display: flex; flex-direction: column;
    animation: feedscroll 22s linear infinite;
  }
  @keyframes feedscroll {
    from { transform: translateY(0); }
    to   { transform: translateY(-50%); }
  }
  .feed-row {
    display: flex; align-items: center; gap: 12px;
    padding: 8px 20px;
    font-size: 12.5px;
    color: var(--text-dim);
    line-height: 1.4;
    white-space: nowrap;
  }
  .feed-row .t {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px; letter-spacing: 0.06em;
    color: var(--amber-dim);
    min-width: 54px;
    text-transform: uppercase;
  }
  .feed-row .who {
    color: var(--text);
    font-weight: 600;
  }
  .feed-row .arrow {
    color: var(--amber);
    opacity: 0.6;
  }
  .feed-row .what {
    color: var(--text-dim);
    overflow: hidden; text-overflow: ellipsis;
  }

  .cta-card {
    position: relative;
    background: rgba(255,255,255,0.04);
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 24px;
    margin-bottom: 24px;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    overflow: hidden;
  }
  .cta-card::before {
    content: ''; position: absolute; inset: 0;
    background: radial-gradient(circle at 85% 0%, rgba(194,139,62,0.15) 0%, transparent 50%);
    pointer-events: none;
  }
  .cta-label {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px; letter-spacing: 0.12em;
    color: var(--amber);
    text-transform: uppercase;
    margin-bottom: 12px;
    display: flex; align-items: center; gap: 8px;
  }
  .cta-label::before {
    content: ''; width: 20px; height: 1px;
    background: var(--amber);
  }
  .cta-title {
    font-size: 17px; font-weight: 600;
    margin-bottom: 14px;
    line-height: 1.4;
    color: var(--text);
  }
  .cta-url-box {
    display: flex; align-items: center; gap: 10px;
    background: rgba(0,0,0,0.4);
    border: 1px solid rgba(194,139,62,0.25);
    border-radius: 8px;
    padding: 12px 14px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 13px;
    cursor: pointer;
    transition: border-color 150ms ease-out, background 150ms ease-out;
  }
  .cta-url-box:hover {
    border-color: rgba(194,139,62,0.55);
    background: rgba(0,0,0,0.5);
  }
  .cta-url-box .url {
    flex: 1; color: var(--text);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .cta-url-box .copy-hint {
    color: var(--amber);
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    flex-shrink: 0;
  }

  .steps {
    margin-top: 24px;
    display: flex; flex-direction: column; gap: 14px;
  }
  .step {
    display: flex; gap: 14px; align-items: flex-start;
    font-size: 13.5px;
    color: var(--text-dim);
    line-height: 1.5;
  }
  .step .idx {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    color: var(--amber);
    border: 1px solid rgba(194,139,62,0.35);
    border-radius: 50%;
    width: 22px; height: 22px;
    display: grid; place-items: center;
    flex-shrink: 0;
  }
  .step strong { color: var(--text); font-weight: 600; }

  .agents {
    margin-top: 28px;
    padding-top: 20px;
    border-top: 1px dashed var(--line);
  }
  .agents .heading {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px; letter-spacing: 0.1em;
    color: var(--text-muted);
    text-transform: uppercase;
    margin-bottom: 12px;
  }
  .agents .chips {
    display: flex; flex-wrap: wrap; gap: 8px;
  }
  .chip {
    font-size: 12px;
    color: var(--text-dim);
    border: 1px solid var(--line);
    border-radius: 999px;
    padding: 5px 11px;
    background: rgba(255,255,255,0.02);
    font-family: 'DM Sans', sans-serif;
  }

  footer {
    margin-top: auto;
    padding-top: 48px;
    display: flex; align-items: center; justify-content: space-between;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px; letter-spacing: 0.08em;
    color: var(--text-muted);
  }
  footer a { color: var(--amber-dim); text-decoration: none; }
  footer a:hover { color: var(--amber); }

  .toast {
    position: fixed; left: 50%; bottom: 32px;
    transform: translateX(-50%) translateY(20px);
    background: rgba(194,139,62,0.95);
    color: #0b0b0b;
    font-weight: 600; font-size: 13px;
    padding: 10px 18px;
    border-radius: 999px;
    opacity: 0; pointer-events: none;
    transition: opacity 200ms ease-out, transform 200ms ease-out;
    z-index: 100;
    box-shadow: 0 10px 30px rgba(194,139,62,0.25);
  }
  .toast.show {
    opacity: 1; transform: translateX(-50%) translateY(0);
  }

  @media (max-width: 480px) {
    h1.event { font-size: 30px; }
    main { padding: 48px 20px 80px; }
  }

  @media (prefers-reduced-motion: reduce) {
    .feed-track { animation: none !important; }
    .live-count .num::after { animation: none !important; }
  }
</style>
</head>
<body>

<canvas id="network"></canvas>
<div class="scan-line"></div>

<main>
  <h1 class="event">${eventName}</h1>
${metaBlock}

  <div class="live">
    <div class="live-header">
      <div class="live-count">
        <span class="num">${activeCount}</span>
        <span class="lbl">活跃 Agent · 在线</span>
      </div>
      <div class="live-tag">LIVE FEED</div>
    </div>
    <div class="feed">
      <div class="feed-track" id="feedTrack">
${trackHtml}
      </div>
    </div>
  </div>

  <div class="cta-card">
    <div class="cta-label">加入网络</div>
    <div class="cta-title">把这个链接发给你的 AI Agent，自动帮你接入活动</div>
    <div class="cta-url-box" id="copyUrl" data-url="${joinUrl}">
      <span class="url">${joinUrl}</span>
      <span class="copy-hint">COPY</span>
    </div>

    <div class="steps">
      <div class="step">
        <div class="idx">1</div>
        <div>复制上面链接，<strong>粘贴到 Claude / 飞书 aily / 其他 AI 助手</strong></div>
      </div>
      <div class="step">
        <div class="idx">2</div>
        <div>告诉 Agent：<strong>"帮我加入这个活动，介绍一下我自己"</strong></div>
      </div>
      <div class="step">
        <div class="idx">3</div>
        <div>Agent 自动通过 MCP 接入 Linka，帮你找到<strong>现场值得聊的人</strong></div>
      </div>
    </div>

    <div class="agents">
      <div class="heading">支持的 Agent</div>
      <div class="chips">
        <span class="chip">Claude</span>
        <span class="chip">飞书 aily</span>
        <span class="chip">Cursor</span>
        <span class="chip">ChatGPT (MCP)</span>
        <span class="chip">自建 Agent</span>
      </div>
    </div>
  </div>

  <footer>
    <span>POWERED BY MCP</span>
    <a href="https://linka.zone">linka.zone ↗</a>
  </footer>
</main>

<div class="toast" id="toast">链接已复制</div>

<script>
(function() {
  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── Network particle background ──
  var canvas = document.getElementById('network');
  var ctx = canvas.getContext('2d');
  var W, H, DPR;
  var nodes = [];
  var mouse = { x: -9999, y: -9999, active: false };

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.width = window.innerWidth * DPR;
    H = canvas.height = window.innerHeight * DPR;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    initNodes();
  }

  function initNodes() {
    var area = (W * H) / (DPR * DPR);
    var count = Math.min(120, Math.max(40, Math.round(area / 11000)));
    nodes = [];
    for (var i = 0; i < count; i++) {
      var isHub = Math.random() < 0.08;
      nodes.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.25 * DPR,
        vy: (Math.random() - 0.5) * 0.25 * DPR,
        r: (isHub ? 2.2 : 1.2) * DPR,
        hub: isHub,
        pulse: Math.random() * Math.PI * 2,
      });
    }
  }

  var LINK_DIST = 140;
  function step() {
    ctx.clearRect(0, 0, W, H);
    var linkDistPx = LINK_DIST * DPR;

    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      n.x += n.vx; n.y += n.vy;
      if (n.x < 0 || n.x > W) n.vx *= -1;
      if (n.y < 0 || n.y > H) n.vy *= -1;

      if (mouse.active) {
        var dx = mouse.x - n.x, dy = mouse.y - n.y;
        var d2 = dx*dx + dy*dy;
        var radius = 180 * DPR;
        if (d2 < radius * radius) {
          var f = (1 - Math.sqrt(d2) / radius) * 0.08;
          var dist = Math.sqrt(d2) + 1;
          n.vx += (dx / dist) * f;
          n.vy += (dy / dist) * f;
        }
      }
      var vmax = 0.6 * DPR;
      if (n.vx > vmax) n.vx = vmax; if (n.vx < -vmax) n.vx = -vmax;
      if (n.vy > vmax) n.vy = vmax; if (n.vy < -vmax) n.vy = -vmax;
      n.pulse += 0.02;
    }

    for (var i2 = 0; i2 < nodes.length; i2++) {
      for (var j = i2 + 1; j < nodes.length; j++) {
        var a = nodes[i2], b = nodes[j];
        var dxl = a.x - b.x, dyl = a.y - b.y;
        var d2l = dxl*dxl + dyl*dyl;
        if (d2l < linkDistPx * linkDistPx) {
          var dl = Math.sqrt(d2l);
          var alpha = (1 - dl / linkDistPx);
          if (a.hub || b.hub) {
            ctx.strokeStyle = 'rgba(194,139,62,' + (alpha * 0.56).toFixed(3) + ')';
            ctx.lineWidth = 0.8 * DPR;
          } else {
            ctx.strokeStyle = 'rgba(200,200,220,' + (alpha * 0.10).toFixed(3) + ')';
            ctx.lineWidth = 0.5 * DPR;
          }
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    for (var k = 0; k < nodes.length; k++) {
      var nn = nodes[k];
      if (nn.hub) {
        var g = ctx.createRadialGradient(nn.x, nn.y, 0, nn.x, nn.y, 10 * DPR);
        g.addColorStop(0, 'rgba(212,160,74,0.75)');
        g.addColorStop(1, 'rgba(212,160,74,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(nn.x, nn.y, 10 * DPR, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#D4A04A';
        ctx.beginPath();
        ctx.arc(nn.x, nn.y, nn.r * (1 + Math.sin(nn.pulse) * 0.15), 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(210,210,225,0.45)';
        ctx.beginPath();
        ctx.arc(nn.x, nn.y, nn.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (!prefersReducedMotion) requestAnimationFrame(step);
  }

  window.addEventListener('resize', resize);
  if (window.matchMedia('(hover: hover)').matches) {
    window.addEventListener('mousemove', function (e) {
      mouse.x = e.clientX * DPR;
      mouse.y = e.clientY * DPR;
      mouse.active = true;
    });
    window.addEventListener('mouseleave', function () { mouse.active = false; });
  }

  resize();
  step();

  // ── Copy URL ──
  var copyEl = document.getElementById('copyUrl');
  var toast = document.getElementById('toast');
  var url = copyEl.getAttribute('data-url');
  copyEl.addEventListener('click', function () {
    var done = function (ok) {
      toast.textContent = ok ? '链接已复制' : '复制失败，请手动选中';
      toast.classList.add('show');
      setTimeout(function () { toast.classList.remove('show'); }, 1600);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () { done(true); }, function () { done(false); });
    } else {
      done(false);
    }
  });
})();
</script>
</body>
</html>`;
}
