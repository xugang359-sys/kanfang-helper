/* ============================================
   优宅邦 NestWise · 门户交互与模拟数据渲染
   数据来源：系统模拟数据（与 data/db 快照一致）
   ============================================ */
(function () {
  'use strict';

  /* ---------- 线性图标集（SF Symbols 风格） ---------- */
  const ICONS = {
    cpu: '<path d="M4 7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7Z"/><path d="M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2"/><rect x="9" y="9" width="6" height="6" rx="1"/>',
    home: '<path d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5.5v-6.5h-4.5V22H4a1 1 0 0 1-1-1V10.5Z"/>',
    calendar: '<rect x="3" y="4" width="18" height="17" rx="2.5"/><path d="M16 2v4M8 2v4M3 9h18"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    doc: '<path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7l-5-5Z"/><path d="M14 2v5h5M9 13h6M9 17h6"/>',
    shield: '<path d="M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10Z"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/>',
    send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  };
  const icon = (n, s) =>
    `<svg width="${s || 24}" height="${s || 24}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ICONS.spark}</svg>`;

  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  /* ============================================
     系统模拟数据（与 data/db/snapshots 快照一致）
     ============================================ */
  const RECORDS = [
    { name: '百家湖花园',     district: '江宁',   area: 98,  price: 138, rooms: '3室2厅', deco: '精装',   elevator: true,  ns: true,  rating: 4, date: '08-15', match: 87, dim: [85, 92, 72, 92, 88, 84], advice: '强烈推荐', adviceT: 'great' },
    { name: '江浦中海左岸澜庭', district: '浦口',   area: 110, price: 165, rooms: '3室2厅', deco: '精装',   elevator: true,  ns: true,  rating: 4, date: '08-18', match: 78, dim: [78, 84, 64, 76, 74, 86], advice: '推荐复看', adviceT: 'great' },
    { name: '九龙湖花园',     district: '江宁',   area: 105, price: 148, rooms: '3室2厅', deco: '毛坯',   elevator: true,  ns: false, rating: 3, date: '08-12', match: 68, dim: [72, 74, 62, 66, 64, 68], advice: '继续观望', adviceT: 'hold' },
    { name: '桥北新村',       district: '浦口',   area: 92,  price: 105, rooms: '3室1厅', deco: '简装',   elevator: false, ns: false, rating: 3, date: '08-10', match: 62, dim: [68, 70, 55, 66, 70, 52], advice: '继续观望', adviceT: 'hold' },
    { name: '江宁一号',       district: '江宁',   area: 88,  price: 118, rooms: '2室2厅', deco: '精装',   elevator: true,  ns: false, rating: 3, date: '08-22', match: 55, dim: [64, 58, 66, 62, 60, 50], advice: '谨慎考虑', adviceT: 'care' },
    { name: '板桥吾悦广场',   district: '雨花台', area: 95,  price: 128, rooms: '3室1厅', deco: '简装',   elevator: false, ns: false, rating: 2, date: '08-25', match: 41, dim: [55, 50, 48, 52, 48, 40], advice: '谨慎考虑', adviceT: 'care' },
  ];

  const FLOW = [
    ['需求确认', '梳理预算、房型、区域等硬性要求，建立购房期望档案'],
    ['线上筛选', '按期望档案六维权重，多平台筛选心仪房源，标注意向'],
    ['实地看房', '按看房日程出行，结构化记录每套房源并逐项检查'],
    ['对比决策', '多房源同台对比，AI 结合六维匹配度给出推荐与行动建议', true],
    ['贷款预审', '月供测算、贷款方案比对，提前确认可承受范围'],
    ['签约交易', '核实产权与满二满五，跟进合同签署与资金安全'],
    ['过户缴税', '联动税费优化器，测算契税个税增值税与过户成本'],
    ['物业交接', '验收房屋与设施，办理物业交割与钥匙交付'],
    ['装修入住', '按装修预算规划，正式开启新家生活'],
  ];

  const CITIES = [
    ['南京', '首套 3.2%', '公积金 130 万'], ['北京', '首套 3.3%', '公积金 120 万'],
    ['上海', '首套 3.3%', '公积金 120 万'], ['广州', '首套 3.2%', '公积金 100 万'],
    ['深圳', '首套 3.3%', '公积金 90 万'],  ['杭州', '首套 3.2%', '公积金 100 万'],
    ['苏州', '首套 3.2%', '公积金 90 万'],  ['成都', '首套 3.2%', '公积金 80 万'],
    ['武汉', '首套 3.2%', '公积金 70 万'],  ['重庆', '首套 3.2%', '公积金 60 万'],
    ['西安', '首套 3.2%', '公积金 75 万'],  ['长沙', '首套 3.2%', '公积金 70 万'],
    ['天津', '首套 3.3%', '公积金 80 万'],  ['合肥', '首套 3.2%', '公积金 60 万'],
    ['郑州', '首套 3.2%', '公积金 60 万'],
  ];

  const DIM_LABELS = ['预算', '户型', '通勤', '配套', '印象', '潜力'];

  /* ============================================
     工具：匹配度圆环 SVG
     ============================================ */
  const ring = (pct, size, color) => {
    const r = (size - 6) / 2, c = 2 * Math.PI * r;
    const col = color || (pct >= 70 ? '#34C759' : pct >= 55 ? '#FF9F0A' : '#FF3B30');
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" data-pct="${pct}" aria-hidden="true">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="rgba(0,0,0,0.06)" stroke-width="5"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${col}" stroke-width="5"
        stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c}"/>
    </svg>`;
  };

  /* ============================================
     1. 核心功能矩阵
     ============================================ */
  const FEATURES = [
    { icon: 'cpu', tag: 'AI 智能决策', title: 'AI 购房助手「贾维斯」', desc: '对话式选房，自动携带你的期望档案与看房记录作为上下文，让每次咨询都基于你的真实情况。' },
    { icon: 'home', tag: '房源全周期管理', title: '记录 · 画像 · 期望', desc: '从"想买什么样的房子"到"看过哪些房子"，全链路结构化沉淀，数据驱动每一次判断。' },
    { icon: 'calendar', tag: '日程与进度', title: '看房日程 · 购房进度', desc: '看房计划与 9 步购房流程双轨管理，到期自动提醒，进度不遗漏。' },
    { icon: 'chart', tag: '专业决策工具', title: '对比 · 测算 · 区位', desc: '多房源同台对比、贷款税费全成本测算、通勤学区实地验证——买房前把账算明白。' },
    { icon: 'doc', tag: '资讯与报告', title: '房产资讯 · 看房报告', desc: '政策与市场动态实时跟进，看房成果一键汇总成专业报告，随时分享给家人。' },
    { icon: 'shield', tag: '平台能力', title: '同步 · 城市 · 额度', desc: '数据云端快照自动同步，多城市政策随选随算，账号权限与 AI 额度精细管理。' },
  ];

  function renderFeatures() {
    $('#featureGrid').innerHTML = FEATURES.map(f => `
      <article class="p-feature reveal" data-anim="up">
        <div class="p-feature-ico">${icon(f.icon, 24)}</div>
        <span class="p-feature-tag">${f.tag}</span>
        <h3>${f.title}</h3>
        <p>${f.desc}</p>
      </article>`).join('');
  }

  /* ============================================
     2. 可交互 AI 购房助手演示
     输入框自动打字循环；可输入问题；点击发送 / 回车 → 前往登录页体验
     ============================================ */
  const AI_QUICK = ['分析我最近看的 3 套房', '推荐江宁区高性价比板块', '帮我测算 150 万贷款月供', '梳理完整买房流程'];

  /* 输入框打字机：循环"输入 → 停顿 → 删除 → 下一条" */
  function startTypewriter(input, list) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      input.value = list[0];
      return;
    }
    const SPEED = { type: 72, hold: 2600, erase: 26, gap: 600 };
    let idx = 0, pos = 0, deleting = false, timer = null, touched = false;
    const run = () => {
      if (touched) return;
      const q = list[idx];
      if (deleting) {
        pos = Math.max(0, pos - 1);
        input.value = q.slice(0, pos);
        timer = setTimeout(run, pos === 0 ? SPEED.gap : SPEED.erase);
        if (pos === 0) { deleting = false; idx = (idx + 1) % list.length; }
      } else {
        pos = Math.min(q.length, pos + 1);
        input.value = q.slice(0, pos);
        timer = pos === q.length ? setTimeout(() => { deleting = true; run(); }, SPEED.hold) : setTimeout(run, SPEED.type);
      }
    };
    const stop = () => { clearTimeout(timer); timer = null; };
    input.addEventListener('focus', stop);
    input.addEventListener('input', () => { touched = true; stop(); });
    input.addEventListener('blur', () => {
      if (touched && input.value.trim()) return;   // 保留用户输入，不再循环
      touched = false;
      if (!timer && !input.value.trim()) run();
    });
    run();
  }

  function renderAiDemo(root, opts) {
    const o = Object.assign({ compact: false, closable: false, onClose: null }, opts || {});
    root.innerHTML = `
      <div class="p-ai-head">
        <div class="p-ai-avatar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
        </div>
        <h5>你好，我是贾维斯</h5>
        <span class="p-ai-badge" title="AI 智能对话"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z"/><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z"/></svg>AI 智能</span>
        ${o.closable ? '<button type="button" class="p-ai-close" aria-label="收起悬浮助手"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>' : ''}
      </div>
      <div class="p-ai-body">
        ${o.compact ? '' : '<div class="p-bubble ai">可以直接向我提问，比如分析房源、推荐板块或测算贷款。试一试？</div>'}
        <div class="p-ai-quick">
          ${AI_QUICK.map(q => `<button type="button" data-q="${q}">${q}</button>`).join('')}
        </div>
      </div>
      <form class="p-ai-input" novalidate>
        <input type="text" placeholder="问点什么？比如：帮我分析最近看的 3 套房" maxlength="80" aria-label="向 AI 提问">
        <button type="submit" aria-label="发送">${icon('send', 18)}</button>
      </form>`;

    const input = root.querySelector('.p-ai-input input');
    const goLogin = () => { location.href = 'login.html'; };
    root.querySelector('.p-ai-quick').addEventListener('click', e => {
      const btn = e.target.closest('button[data-q]');
      if (!btn) return;
      input.value = btn.dataset.q;   // 快捷问题填入输入框，用户可编辑后发送
      input.focus();
    });
    root.querySelector('.p-ai-input').addEventListener('submit', e => {
      e.preventDefault();
      const v = input.value.trim();
      if (!v) { input.focus(); return; }
      goLogin();                     // 发送 → 跳转登录页
    });
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); input.value.trim() && goLogin(); }
    });
    if (o.closable) {
      const close = root.querySelector('.p-ai-close');
      if (close && typeof o.onClose === 'function') close.addEventListener('click', o.onClose);
    }
    startTypewriter(input, AI_QUICK);
  }

  /* ============================================
     3. 模拟截图秀
     ============================================ */
  function recCard(r, hot) {
    return `<div class="p-rec">
      <div class="p-rec-ring">${ring(r.match, 46)}<span class="p-rec-ring-txt">${r.match}</span></div>
      <div class="p-rec-main">
        <h5>${r.name}${hot ? '<small>★ 当前关注</small>' : ''}</h5>
        <p>${r.district} · ${r.rooms} · ${r.area}㎡ · ${r.deco}${r.elevator ? ' · 有电梯' : ' · 无电梯'}</p>
      </div>
      <div class="p-rec-price"><b>${r.price}万</b><span>${Math.round(r.price / r.area * 10000)}元/㎡</span></div>
      <span class="p-rec-badge ${r.adviceT}">${r.advice}</span>
    </div>`;
  }

  const SHOWCASE = [
    {
      title: '每一次看房，都有据可查',
      desc: '看房后快速录入：户型、朝向、楼层、检查清单与观后感，系统实时计算六维匹配度与决策档位——"这套房值不值得复看"一目了然。',
      points: ['结构化记录 + 实地检查清单', '六维匹配度实时计算，档位自动判定'],
      shot: `<div class="p-rec-list">${RECORDS.map(r => recCard(r, r.name === '百家湖花园')).join('')}</div>`,
      cap: '累计看房 6 套 · 匹配度 87 为当前最高',
    },
    {
      title: '三套同台对比，AI 帮你拍板',
      desc: '把纠结的几套房放上对比台：六维评分逐项高亮最优与短板，AI 按你的期望权重给出综合推荐与下一步行动建议。',
      points: ['六维评分明细 · 最优/短板高亮', '综合推荐排序 + 行动建议'],
      shot: (() => {
        const names = ['百家湖花园', '江浦中海左岸澜庭', '九龙湖花园'];
        const picks = RECORDS.filter(r => names.includes(r.name));
        const head = `<div class="p-cmp-head">
          <div class="p-cmp-cell lab">维度</div>
          <div class="p-cmp-cell hd">百家湖花园<b style="color:#0071E3">★首推</b></div>
          <div class="p-cmp-cell hd">江浦中海左岸澜庭</div>
          <div class="p-cmp-cell hd">九龙湖花园</div>
        </div>`;
        const rows = DIM_LABELS.map((dim, i) => {
          const vals = picks.map(r => r.dim[i]);
          const max = Math.max(...vals), min = Math.min(...vals);
          return `<div class="p-cmp-row">
            <div class="p-cmp-cell lab">${dim}</div>
            ${vals.map(v => `<div class="p-cmp-cell ${v === max ? 'best' : v === min ? 'worst' : ''}">
              <div class="p-cmp-score">${v}</div><div class="p-cmp-bar"><i style="width:${v}%"></i></div>
            </div>`).join('')}
          </div>`;
        }).join('');
        const foot = `<div class="p-cmp-row" style="margin-top:10px">
          <div class="p-cmp-cell lab">综合匹配</div>
          <div class="p-cmp-cell best"><b>87</b> · 强烈推荐</div>
          <div class="p-cmp-cell"><b>78</b> · 推荐复看</div>
          <div class="p-cmp-cell worst"><b>68</b> · 继续观望</div>
        </div>`;
        return head + rows + foot;
      })(),
      cap: '综合匹配度按期望档案权重（预算25/户型20/通勤15/配套15/印象15/潜力10）计算',
    },
    {
      title: '专属购房管家，随时在线',
      desc: 'AI 自动加载你的期望档案与看房记录，回答基于你的真实情况——分析房源、推荐板块、测算贷款，开口即答。',
      points: ['自动携带期望 + 房源上下文', '快捷追问 · 多会话管理'],
      shot: `
        <div class="p-chat">
          <div class="p-chat-welcome">
            <h5>你好，我是贾维斯</h5>
            <span class="p-ai-badge"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z"/><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z"/></svg>AI 智能</span>
            <p>你的专属购房管家，已加载期望档案与 6 套看房记录</p>
          </div>
          <div class="p-chat-quick">
            <div>分析已看房源</div><div>推荐意向板块</div><div>测算贷款方案</div><div>梳理买房流程</div>
          </div>
          <div class="p-bubble user">帮我分析最近看的 3 套房，哪套更适合我？</div>
          <div class="p-bubble ai">结合你的预算（100–150万）与六维权重，<b>百家湖花园</b>综合匹配 <b>87 分</b>，采光与配套优势明显，建议优先复看；若更看重<b>升值潜力</b>，可关注江浦中海左岸澜庭（潜力 86 分）。</div>
          <div class="p-chat-tags"><span>强烈推荐</span><span>建议复看</span><span>升值潜力</span></div>
        </div>`,
      cap: 'AI 基于期望档案权重与房源六维数据作答',
    },
  ];

  function renderShowcase() {
    $('#showcaseList').innerHTML = SHOWCASE.map((s, i) => {
      const metaDir = i % 2 ? 'right' : 'left';   // flip 时 meta 在右 → 从右滑入
      const shotDir = i % 2 ? 'left' : 'right';
      return `
      <div class="p-show-item ${i % 2 ? 'flip' : ''}">
        <div class="p-show-meta reveal" data-anim="${metaDir}">
          <h3>${s.title}</h3>
          <p>${s.desc}</p>
          <div class="p-show-points">${s.points.map(p => `<div>${icon('check', 16)}${p}</div>`).join('')}</div>
        </div>
        <div class="p-show-shot reveal" data-anim="${shotDir}" data-shot>
          <div class="p-shot-bar">
            <span class="p-shot-dot" style="background:#FF5F57"></span>
            <span class="p-shot-dot" style="background:#FEBC2E"></span>
            <span class="p-shot-dot" style="background:#28C840"></span>
            <span class="p-shot-title">优宅邦 NestWise</span>
          </div>
          <div class="p-shot-body">${s.shot}</div>
          <div class="p-shot-cap">${s.cap}</div>
        </div>
      </div>`;
    }).join('');
  }

  /* ============================================
     4. 购房流程
     ============================================ */
  function renderFlow() {
    $('#flowList').innerHTML = FLOW.map((f, i) => `
      <div class="p-flow-step ${f[2] ? 'on' : ''} reveal" data-anim="scale">
        <div class="p-flow-num">${String(i + 1).padStart(2, '0')}</div>
        <div class="p-flow-card">
          <h4>${f[0]}${f[2] ? '<em>· 当前阶段</em>' : ''}</h4>
          <p>${f[1]}</p>
        </div>
      </div>`).join('');
  }

  /* ============================================
     5. 多城市
     ============================================ */
  function renderCities() {
    $('#cityList').innerHTML = CITIES.map(c => `
      <div class="p-city reveal" data-anim="up">
        <h4>${c[0]}</h4>
        <p>商贷利率 <b>${c[1]}</b><br>${c[2]}</p>
      </div>`).join('');
  }

  /* ============================================
     6. 交互：导航吸顶 / 滚动渐显（组内 stagger）
     ============================================ */
  const REDUCED = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function initNav() {
    const nav = $('#pNav');
    // 页面载入：导航从顶部下坠入场
    requestAnimationFrame(() => requestAnimationFrame(() => nav.classList.add('nav-in')));
    const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 12);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // 导航右上角：扫码用手机访问 + 已登录显示昵称/进入工作台，未登录显示开始使用
  function renderNavAction() {
    const box = $('.p-nav-actions');
    if (!box) return;
    let u = null;
    try { u = JSON.parse(localStorage.getItem('house_hunter_session') || 'null'); } catch (e) {}
    // 移动设备直达移动版工作台，桌面进入 WEB 工作台
    const isMobile = /Android|iPhone|iPad|iPod|Mobile|MicroMessenger/i.test(navigator.userAgent) || window.innerWidth < 768;
    const workHref = isMobile ? 'mobile.html' : 'index.html';
    const scanBtn = '<button type="button" class="p-nav-scan" onclick="window.__pScanOpen && window.__pScanOpen()" title="扫码在手机上访问系统" aria-label="扫码在手机上访问系统">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10"/></svg><span>手机访问</span></button>';
    box.innerHTML = scanBtn + (u && u.email
      ? `<span class="p-nav-user">${esc(u.name || u.email)}</span><a class="p-btn p-btn-primary" href="${workHref}">进入工作台</a>`
      : `<a class="p-btn p-btn-primary" href="login.html">开始使用</a>`);
  }

  // 首屏分层入场：逐层上浮去模糊，与导航同步启动
  function animateHero() {
    if (REDUCED()) { $('.p-hero')?.classList.add('in'); return; }
    const hero = $('.p-hero');
    if (!hero) return;
    requestAnimationFrame(() => requestAnimationFrame(() => hero.classList.add('in')));
  }

  // 滚动揭示：单元素 + 组容器（组内卡片按序 stagger 出现）
  const GROUPS = ['.p-feature-grid', '.p-cities'];
  function initReveal() {
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        if (e.target.dataset.group === '1') {
          const kids = e.target.querySelectorAll('.reveal');
          kids.forEach((k, i) => {
            k.style.transitionDelay = Math.min(i * 80, 400) + 'ms';
            k.classList.add('in');
          });
        } else {
          e.target.classList.add('in');
          if (e.target.hasAttribute('data-shot')) animateShot(e.target);
        }
        io.unobserve(e.target);
      });
    }, { threshold: 0.12 });
    GROUPS.forEach(sel => {
      const g = document.querySelector(sel);
      if (g) { g.dataset.group = '1'; io.observe(g); }
    });
    document.querySelectorAll('.reveal').forEach(el => {
      if (!el.closest('[data-group]')) io.observe(el);
    });
  }

  /* ============================================
     6.5 模拟数据动效：圆环描边 / 数字滚动 / 评分条生长
     ============================================ */
  // 数字 0 → 目标值 滚动（rAF）
  function countUp(el, target, dur) {
    if (!el || REDUCED()) { if (el) el.textContent = target; return; }
    const t0 = performance.now();
    const tick = now => {
      const p = Math.min(1, (now - t0) / (dur || 1000));
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased);
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function animateShot(root) {
    if (REDUCED()) return;
    // 1) 匹配度圆环：描边从空画到目标 + 数字滚动
    root.querySelectorAll('.p-rec-ring').forEach((box, ri) => {
      const svg = box.querySelector('svg');
      const arc = box.querySelector('svg circle:last-child');
      const txt = box.querySelector('.p-rec-ring-txt');
      if (!svg || !arc) return;
      const pct = +svg.dataset.pct || 0;
      const c = 2 * Math.PI * arc.r.baseVal.value;
      setTimeout(() => { arc.style.strokeDashoffset = c * (1 - pct / 100); }, 180 + ri * 100);
      if (txt) countUp(txt, pct, 1100);
    });
    // 2) 决策对比：评分条从零生长（逐行延迟）
    root.querySelectorAll('.p-cmp-row').forEach((row, ri) => {
      row.querySelectorAll('.p-cmp-bar i').forEach(bar => {
        const w = bar.getAttribute('style') || '';
        const m = w.match(/width:(\d+(?:\.\d+)?)%/);
        const target = m ? m[1] + '%' : '0';
        bar.style.transitionDelay = ri * 60 + 'ms';
        bar.style.width = '0';                                    // 先归零
        requestAnimationFrame(() => requestAnimationFrame(() => {
          bar.style.width = target;                               // 下一帧生长到目标
        }));
      });
    });
    // 3) 房源记录 / AI 对话：内容逐条浮现，保证三张截图入场节奏一致
    root.querySelectorAll('.p-rec, .p-chat > *').forEach((el, i) => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(10px)';
      el.style.transition = 'opacity 0.5s var(--p-ease), transform 0.5s var(--p-ease)';
      el.style.transitionDelay = (i * 110) + 'ms';
      requestAnimationFrame(() => requestAnimationFrame(() => {
        el.style.opacity = '1';
        el.style.transform = 'none';
      }));
    });
  }

  /* ============================================
     6.6 首屏滚动视差：产品图/光晕随滚动轻微错位
     ============================================ */
  function parallaxHero() {
    const shot = $('.p-hero-shot'), glow = $('.p-hero-glow');
    if (!shot || REDUCED()) return;
    let ticking = false;
    const update = () => {
      const y = window.scrollY;
      if (y < window.innerHeight) {
        shot.style.transition = 'none';
        shot.style.transform = 'translateY(' + (y * -0.06).toFixed(1) + 'px)';
        if (glow) glow.style.transform = 'translateY(' + (y * 0.05).toFixed(1) + 'px)';
      }
      ticking = false;
    };
    window.addEventListener('scroll', () => {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
  }

  /* ============================================
     7. 滚动悬浮 AI 购房助手
     向下滚动越过首屏后，助手以固定位置出现（右下角玻璃卡片）
     ============================================ */
  function initAiFloat() {
    const heroShot = $('.p-hero-shot');
    if (!heroShot) return;

    const float = document.createElement('aside');
    float.id = 'aiFloat';
    float.className = 'p-ai-float p-ai-demo-sm';
    float.setAttribute('aria-hidden', 'true');
    document.body.appendChild(float);
    renderAiDemo(float, {
      compact: true,
      closable: true,
      onClose: () => { dismissed = true; setShown(false); },
    });

    let shown = false, dismissed = false;
    const toTopBtn = $('#pToTop');
    const HERO_TOP = heroShot.getBoundingClientRect().top + window.scrollY;
    // 置顶按钮固定在悬浮卡右上方（右对齐卡片右缘，gap 12px），避免与卡片重叠
    const placeToTop = () => {
      if (!toTopBtn) return;
      if (!shown) { toTopBtn.style.right = ''; toTopBtn.style.bottom = ''; return; }
      const pad = window.innerWidth >= 900 ? 24 : 14;
      toTopBtn.style.right = pad + 'px';
      toTopBtn.style.bottom = (pad + float.offsetHeight + 12) + 'px';
    };
    const setShown = on => {
      shown = on;
      float.classList.toggle('show', on);
      float.setAttribute('aria-hidden', on ? 'false' : 'true');
      placeToTop();
    };
    window.addEventListener('resize', placeToTop, { passive: true });
    const onScroll = () => {
      const past = window.scrollY > HERO_TOP + 60;
      if (!past) {                                       // 回到首屏区域：收起卡片并清除取消标记，再次下滚可重新触发
        if (shown) setShown(false);
        dismissed = false;
      } else if (past && !shown && !dismissed) {
        setShown(true);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ============================================
     8. 返回顶部
     ============================================ */
  function initToTop() {
    const btn = $('#pToTop');
    if (!btn) return;
    const onScroll = () => btn.classList.toggle('show', window.scrollY > 520);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    btn.addEventListener('click', () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) window.scrollTo(0, 0);
      else window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* ============================================
     9. 扫码用手机访问系统（桌面签发 → 手机扫码进入移动版并同步账号 → 桌面轮询）
     ============================================ */
  let __scanTimer = null;
  function drawQr(text) {
    const qrEl = $('#pScanQr');
    if (!qrEl) return;
    qrEl.innerHTML = '';
    try {
      const qr = qrcode(0, 'M');
      qr.addData(text);
      qr.make();
      const img = qr.createImgTag(5, 8);
      qrEl.innerHTML = img;
      const im = qrEl.querySelector('img');
      if (im) { im.style.width = '180px'; im.style.height = '180px'; im.alt = '用手机访问系统二维码'; }
    } catch (e) { qrEl.innerHTML = '<p class="p-scan-err">二维码生成失败</p>'; }
  }
  function pollScan(ticket) {
    if (__scanTimer) clearInterval(__scanTimer);
    __scanTimer = setInterval(() => {
      fetch('/api/scan/status?ticket=' + encodeURIComponent(ticket))
        .then(r => r.json())
        .then(d => {
          if (d.ok && d.status === 'claimed') {
            clearInterval(__scanTimer);
            __scanTimer = null;
            const qrEl = $('#pScanQr');
            const stEl = $('#pScanStatus');
            if (qrEl) qrEl.innerHTML = '<div class="p-scan-ok"><svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg></div>';
            if (stEl) stEl.textContent = '扫码成功，手机已打开移动版';
          }
        }).catch(() => {});
    }, 2000);
  }
  function openScanLogin() {
    const mask = $('#pScanMask');
    if (!mask) return;
    mask.hidden = false;
    const qrEl = $('#pScanQr');
    const stEl = $('#pScanStatus');
    if (qrEl) qrEl.innerHTML = '<div class="p-scan-loading">正在生成…</div>';
    if (stEl) stEl.textContent = '正在生成二维码…';
    let u = null;
    try { u = JSON.parse(localStorage.getItem('house_hunter_session') || 'null'); } catch (e) {}
    const token = localStorage.getItem('house_hunter_token') || '';
    // 电脑端未登录：二维码指向移动端引导页，手机扫码后自行登录/注册，在手机上使用系统
    if (!u || !u.email || !token) {
      resolveScanBase().then(base => {
        drawQr(base + '/onboarding.html');
        if (stEl) stEl.textContent = '扫一扫，在手机上开始使用';
      });
      return;
    }
    // 电脑端已登录：签发一次性票据，手机扫码自动同步同一账号，直接打开移动版
    resolveScanBase().then(base => {
      fetch('/api/scan/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: '{}',
      }).then(r => r.json()).then(d => {
        if (!d.ok) { if (stEl) stEl.textContent = d.err || '生成二维码失败'; return; }
        drawQr(base + '/onboarding.html?scan=' + encodeURIComponent(d.ticket));
        if (stEl) stEl.textContent = '扫码后手机将打开移动版并同步账号「' + (u.name || u.email) + '」';
        pollScan(d.ticket);
      }).catch(() => { if (stEl) stEl.textContent = '无法连接服务器，请确认已启动 node server.js'; });
    });
  }
  function closeScanLogin() {
    if (__scanTimer) { clearInterval(__scanTimer); __scanTimer = null; }
    const mask = $('#pScanMask');
    if (mask) mask.hidden = true;
  }
  // 二维码目标地址：localhost 对手机不可达，需换成电脑的局域网 IP
  async function resolveScanBase() {
    try {
      const h = location.hostname;
      if (h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' || h === '') {
        const r = await fetch('/api/net/ip', { cache: 'no-store' });
        const d = await r.json();
        if (d && d.ok && d.host) return location.protocol + '//' + d.host + (location.port ? ':' + location.port : '');
      }
    } catch (e) {}
    return location.origin;
  }
  function initScanLogin() {
    window.__pScanOpen = openScanLogin;
    window.__pScanClose = closeScanLogin;
    const mask = $('#pScanMask');
    if (mask) mask.addEventListener('click', e => { if (e.target === mask) closeScanLogin(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeScanLogin(); });
  }

  /* ---------- 启动 ---------- */
  function boot() {
    renderFeatures();
    renderAiDemo($('#aiHeroDemo'));
    renderShowcase();
    renderFlow();
    renderCities();
    initNav();
    renderNavAction();
    animateHero();
    initReveal();
    initAiFloat();
    initToTop();
    initScanLogin();
    parallaxHero();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
