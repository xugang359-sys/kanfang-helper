/* ============================================
   M10 房产资讯模块
   国家政策 / 市场动态
   数据：月度归档(data/news-archive.json，真实正文) 优先，
        天行实时 API 补充，无任何内置参考数据
   ============================================ */
window.NewsMod = (function() {
  const ic = Utils.icon;   // SF Symbols 风格图标
  // ===== 筛选状态 =====
  let curCat = '';      // '' | national | market
  let curMonth = '';    // '' | 2026-01 ~ 2026-08
  let curTag = '';
  let curFav = false;   // 是否只显示已收藏
  let kw = '';
  let view = 'list';    // list | detail
  let detailId = '';
  let _renderSeq = 0;   // 渲染序号：防止异步实时补充返回时覆盖新筛选结果

  // 数据缓存
  let _archive = null;  // news-archive.json
  let _liveCache = {};  // 实时补充缓存 { cat_city: items }

  // ===== 分类 / 标签 / 房产强词 =====
  const CATS = [
    { id:'national', label:'国家政策', icon:'building', color:'#0071E3' },
    { id:'market',   label:'市场动态', icon:'trend', color:'#16A34A' },
  ];
  const HOT_TAGS = ['房贷利率','公积金','保障房','二手房','房价走势','楼市新政','限购','人才购房','土拍','楼盘'];
  // 实时搜索词（与归档脚本一致）
  const CAT_KWS = {
    national: ['房贷利率','公积金','楼市调控','保障房'],
    market:   ['房价','楼市成交','二手房','土地拍卖'],
  };
  // 房产相关性强词：标题命中任一才算房产资讯
  const STRONG_WORDS = [
    '房价','楼市','楼盘','房贷','房地产','房产','住宅','二手房','新房','租赁','租金','住房',
    '土地','限购','限售','公积金','契税','房产税','保障房','安置房','商品房','成交','房企',
    '物业','贷款','购房','买房','开发商','交付','开盘','加推','小区','城中村','旧改','棚改','租售',
  ];

  // ===== 收藏（按账号隔离：每个用户只能看到自己的收藏） =====
  // 收藏 key 携带当前登录账号邮箱，切换账号后各自独立、互不可见
  function favKey() {
    try {
      const u = window.AuthMod && AuthMod.currentUser();
      return (u && u.email) ? ('house_hunter_news_fav_' + u.email) : 'house_hunter_news_fav';
    } catch(e) { return 'house_hunter_news_fav'; }
  }
  function getFavs() {
    const k = favKey();
    try {
      const v = localStorage.getItem(k);
      if (v != null) return JSON.parse(v) || [];
      // 首次使用：迁移旧版全局收藏到当前账号，保证老用户收藏不丢失
      const old = localStorage.getItem('house_hunter_news_fav');
      if (old != null) { localStorage.setItem(k, old); return JSON.parse(old) || []; }
      return [];
    } catch(e) { return []; }
  }
  function saveFavs(arr) { localStorage.setItem(favKey(), JSON.stringify(arr)); }
  function isFav(id) { return getFavs().includes(id); }
  function toggleFav(id) {
    const arr = getFavs();
    const i = arr.indexOf(id);
    if (i >= 0) { arr.splice(i,1); Utils.toast('已取消收藏','info'); }
    else { arr.push(id); Utils.toast('已收藏，可在列表中查看','success'); }
    saveFavs(arr);
    const b = document.getElementById('favBtn_' + id);
    if (b) {
      const f = isFav(id);
      b.className = 'btn btn-sm ' + (f ? 'btn-primary' : 'btn-ghost');
      b.innerHTML = (f ? ic('starFill',13) : ic('star',13)) + (f ? ' 已收藏' : ' 收藏');
    }
    // 列表页：收藏筛选下取消收藏需即时移除条目；按钮不在 DOM 时兜底刷新
    if (view === 'list' && (curFav || !b)) renderList(false);
  }

  // ===== 数据源配置 =====
  function newsApiKey() { return (localStorage.getItem('k_news_api') || '').trim(); }
  function parseNewsKey() {
    const raw = newsApiKey();
    if (!raw) return { type:'claw', val:'' };
    const m = raw.match(/^(tianapi|juhe|claw):(.+)$/);
    if (m) return { type:m[1], val:m[2].trim() };
    return { type:'claw', val:'' };
  }
  function testSource() {
    const p = parseNewsKey();
    return p.type === 'claw' ? 'claw' : p;
  }

  // fetch 带超时
  function fetchT(url, timeout = 8000) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeout);
    return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(t));
  }

  // ===== 静态数据加载 =====
  async function loadArchive(force) {
    if (_archive && !force) return _archive;
    try {
      const res = await fetchT('data/news-archive.json?v=' + Date.now());
      if (res.ok) _archive = await res.json();
    } catch(e) {}
    _archive = _archive || {};
    return _archive;
  }

  // 归档中取某分类数据（地方/楼盘按城市归档）
  function archiveItemsFor(cat, city) {
    if (!_archive) return [];
    const bucket = (cat === 'local' || cat === 'project')
      ? ((_archive[cat] || {})[city] || {})
      : (_archive[cat] || {});
    return Object.keys(bucket).flatMap(m => bucket[m] || []);
  }
  // 归档中某分类覆盖的月份
  function archiveMonthsFor(cat, city) {
    if (!_archive) return [];
    const bucket = (cat === 'local' || cat === 'project')
      ? ((_archive[cat] || {})[city] || {})
      : (_archive[cat] || {});
    return Object.keys(bucket).sort().reverse();
  }

  // ===== 实时补充（天行，带房产过滤；仅当归档无数据时调用）=====
  async function fetchLive(cat, city) {
    const key = cat + '_' + city;
    if (_liveCache[key]) return _liveCache[key];
    const cfg = parseNewsKey();
    let rawItems = [];
    if (cfg.type === 'tianapi' || cfg.type === 'juhe') {
      const kws = CAT_KWS[cat] || [];
      const words = (cat === 'local' || cat === 'project') ? kws.map(w => city + w) : kws;
      // 多关键词并行请求，缩短整体等待（单次超时 6s）
      const results = await Promise.all(words.map(async (w) => {
        try {
          const url = cfg.type === 'tianapi'
            ? `https://apis.tianapi.com/generalnews/index?key=${encodeURIComponent(cfg.val)}&num=15&word=${encodeURIComponent(w)}`
            : `https://v.juhe.cn/toutiao/index?type=top&key=${encodeURIComponent(cfg.val)}&max=15`;
          const res = await fetchT(url, 6000);
          const data = await res.json();
          const list = cfg.type === 'tianapi'
            ? ((data && data.result && (data.result.list || data.result.newslist)) || [])
            : ((data && data.result && data.result.data) || []);
          return list.map(n => ({
            title: n.title || '', summary: n.description || '', url: n.url || '',
            source: n.source || '天行数据', time: n.ctime || '',
          }));
        } catch(e) { return []; } /* 单个词失败不影响其他词 */
      }));
      rawItems = rawItems.concat(...results);
    }
    // 房产相关性过滤 + 去重
    const seen = new Set();
    const items = rawItems.filter(it => {
      const text = (it.title || '') + ' ' + (it.summary || '');
      if (!STRONG_WORDS.some(w => text.includes(w))) return false;
      const k = it.url || it.title;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    }).slice(0, 8).map((it, i) => ({
      id: 'live_' + cat + '_' + i,
      cat, title: it.title, summary: it.summary || it.title,
      url: it.url, source: it.source, time: it.time,
      city: (cat === 'local' || cat === 'project') ? city : '',
      tags: guessTags(it.title), live: true,
      content: liveContent(it, cat, city),
    }));
    _liveCache[key] = items;
    return items;
  }

  function guessTags(text) {
    const tags = [];
    HOT_TAGS.forEach(t => { if (text.includes(t) && tags.length < 3) tags.push(t); });
    return tags;
  }

  // 实时资讯无正文：按类别生成结构化解读（附原文链接）
  function liveContent(it, cat, city) {
    const c = city || '所在城市';
    const lead = it.summary || it.title;
    if (cat === 'national') {
      return `<p>${lead}</p><ul class="n-detail-list">
        <li>利率/额度调整对月供的影响，可到「财务计算」按当前利率试算</li>
        <li>公积金、税收等政策变化是否符合自身购房条件</li>
        <li>限购限贷变化是否影响购房资格与首付比例</li></ul>`;
    }
    if (cat === 'local') {
      return `<p>${lead}</p><ul class="n-detail-list">
        <li>「${c}」购房资格/限购政策是否变化</li>
        <li>落户、人才、契税补贴等政策可否叠加享受</li>
        <li>土地供应与旧改计划对板块供需的影响</li></ul>`;
    }
    if (cat === 'project') {
      return `<p>${lead}</p><ul class="n-detail-list">
        <li>开盘均价与周边二手房挂牌价对比</li>
        <li>户型得房率、梯户比、车位配比等细节</li>
        <li>周边学校、地铁、商业配套是否兑现（可用「区位分析」核实）</li></ul>`;
    }
    return `<p>${lead}</p><ul class="n-detail-list">
      <li>环比/同比变化反映短期热度与长期趋势</li>
      <li>成交放量往往伴随价格企稳，可结合「决策对比」判断</li>
      <li>关注土地拍卖与库存变化对后市的指引</li></ul>`;
  }

  // ===== 数据汇总：归档优先，缺失分类用实时缓存 =====
  function allArchived(city) {
    return CATS.flatMap(c => {
      const a = archiveItemsFor(c.id, city);
      return a.length ? a : (_liveCache[c.id + '_' + city] || []);
    });
  }
  // 当前城市实时补充总条数
  function liveCountTotal(city) {
    let n = 0;
    CATS.forEach(c => { n += (_liveCache[c.id + '_' + city] || []).length; });
    return n;
  }

  // ===== 筛选 =====
  function matchFilter(item) {
    if (curFav && !isFav(item.id)) return false;
    if (curCat && item.cat !== curCat) return false;
    if (curMonth && item.month !== curMonth) return false;
    if (curTag && !(item.tags || []).includes(curTag) && !(item.title || '').includes(curTag)) return false;
    if (kw) {
      const text = (item.title + ' ' + (item.summary || '') + ' ' + (item.source || '')).toLowerCase();
      if (!text.includes(kw.toLowerCase())) return false;
    }
    return true;
  }
  // 可选月份（归档各分类月份并集，倒序）
  function monthOptions() {
    const city = Store.getCity();
    const set = new Set();
    CATS.forEach(c => archiveMonthsFor(c.id, city).forEach(m => set.add(m)));
    return Array.from(set).sort().reverse();
  }

  // ===== 渲染 =====
  function render() {
    const html = `
      <div class="page-header">
        <div>
          <h2><span class="emoji">${ic('news')}</span>房产资讯</h2>
          <p class="page-desc">国家政策 · 市场动态 — 全国房产动态，月度归档 + 实时更新。</p>
        </div>
      </div>
      <div id="newsContent">
        <div class="empty-state" style="padding:30px;"><div class="icon">${ic('news')}</div><h4>正在获取资讯...</h4></div>
      </div>`;
    App.setContent(html);
    renderList(true);
  }

  // ---- 列表（两阶段：先渲染归档，再后台补充实时）----
  async function renderList(force) {
    const box = document.getElementById('newsContent');
    if (!box) return;
    if (force) _liveCache = {};
    await loadArchive();
    const city = Store.getCity();
    const reqId = ++_renderSeq;
    const months = monthOptions();
    const missing = CATS.filter(c => !archiveItemsFor(c.id, city).length);
    // 阶段1：立即用归档数据渲染（不等实时接口）；仅当存在缺失分类时才显示"加载中"
    let items = allArchived(city).filter(matchFilter);
    renderBox(box, items, months, missing.length > 0);
    // 阶段2：为归档缺失的分类补充实时资讯（并行，单类内多词也并行）
    if (!missing.length) return;
    const results = await Promise.all(missing.map(c => fetchLive(c.id, city)));
    if (reqId !== _renderSeq) return; // 用户已切换筛选/页面，丢弃过期结果
    const hasLive = results.some(r => r.length);
    items = allArchived(city).filter(matchFilter);
    renderBox(box, items, months, false);
    if (hasLive) Utils.toast('已补充实时资讯', 'info');
  }

  // 渲染筛选区 + 列表（liveLoading=true 表示实时补充进行中）
  function renderBox(box, items, months, liveLoading) {
    const city = Store.getCity();
    const catChips = [`<a class="chip ${curCat===''?'on':''}" data-cat="">全部</a>`]
      .concat(CATS.map(c => `<a class="chip ${curCat===c.id?'on':''}" data-cat="${c.id}">${ic(c.icon,13)} ${c.label}</a>`)).join('');
    const monthChips = months.length ? months.map(m =>
      `<a class="chip chip-month ${curMonth===m?'on':''}" data-month="${m}">${m.slice(5)}月</a>`).join('') : '';
    const tagChips = HOT_TAGS.map(t => `<a class="tag tag-sm ${curTag===t?'tag-primary':'tag-ghost'}" data-tag="${t}" style="cursor:pointer;">#${t}</a>`).join('');
    // 来源说明
    const liveN = liveCountTotal(city);
    let srcHtml;
    if (liveLoading && liveN === 0) srcHtml = '<span class="tag tag-warn tag-sm">' + ic('refresh',12) + ' 实时资讯加载中...</span>';
    else if (liveN > 0 && items.some(x => !x.live)) srcHtml = '<span class="tag tag-success tag-sm">' + ic('book',12) + ' 月度归档 + ' + ic('globe',12) + ' 实时补充（' + liveN + '条）</span>';
    else if (liveN > 0) srcHtml = '<span class="tag tag-success tag-sm">' + ic('globe',12) + ' 实时资讯</span>';
    else if (items.length) srcHtml = '<span class="tag tag-success tag-sm">' + ic('book',12) + ' 月度归档</span>';
    else srcHtml = '<span class="tag tag-warn tag-sm">暂无数据</span>';
    box.innerHTML = `
      <div class="card">
        <div class="n-filter-panel">
          <div class="filter-bar" style="flex-wrap:wrap;gap:8px;margin-bottom:2px;">
            <input type="text" id="nKw" placeholder="搜索资讯标题 / 内容 / 来源..." value="${kw}" onkeydown="if(event.key==='Enter')NewsMod.doSearch()" style="flex:1;min-width:170px;">
            <button class="btn btn-primary btn-sm" onclick="NewsMod.doSearch()">搜索</button>
            ${(kw || curTag || curMonth || curCat || curFav) ? `<button class="btn btn-ghost btn-sm" onclick="NewsMod.resetFilter()">重置</button>` : ''}
          </div>
          <div class="n-filter-row">
            <span class="n-filter-label">类型</span>${catChips}
          </div>
          ${monthChips ? `<div class="n-filter-row">
            <span class="n-filter-label">月份</span>${monthChips}
          </div>` : ''}
          <div class="n-filter-row">
            <span class="n-filter-label">热门</span>${tagChips}
          </div>
          <div class="n-filter-row">
            <span class="n-filter-label">收藏</span>
            <a class="chip ${curFav?'on':''}" data-fav="1" style="display:inline-flex;align-items:center;gap:5px;">${ic('star',13)} 我的收藏${getFavs().length?` <span class="tag tag-sm tag-primary">${getFavs().length}</span>`:''}</a>
            <span style="font-size:11.5px;color:var(--text-4);">点击星标即可收藏资讯</span>
          </div>
        </div>
        <button type="button" class="m-filter-btn" onclick="NewsMod.openFilter()">
          ${ic('filter', 15)} 筛选资讯
          ${filterCount() ? `<span class="m-filter-count">${filterCount()}</span>` : ''}
        </button>
        <div class="n-src" style="margin-top:6px;padding-top:10px;border-top:1px dashed var(--border-light);">
          ${srcHtml}
          <span style="margin-left:6px;">共 <strong>${items.length}</strong> 条 · 均为真实资讯</span>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:12px;margin-top:12px;" id="newsList">
        ${items.length ? items.map(cardHTML).join('') : emptyCard()}
      </div>`;
    box.querySelectorAll('[data-cat]').forEach(el => el.addEventListener('click', () => {
      curCat = el.dataset.cat; renderList(false);
    }));
    box.querySelectorAll('[data-month]').forEach(el => el.addEventListener('click', () => {
      curMonth = curMonth === el.dataset.month ? '' : el.dataset.month; renderList(false);
    }));
    box.querySelectorAll('[data-tag]').forEach(el => el.addEventListener('click', () => {
      curTag = curTag === el.dataset.tag ? '' : el.dataset.tag; renderList(false);
    }));
    box.querySelectorAll('[data-fav]').forEach(el => el.addEventListener('click', () => {
      curFav = !curFav; renderList(false);
    }));
  }

  function emptyCard() {
    return `<div class="card empty-state" style="grid-column:1/-1;">
      <div class="icon">${ic('search')}</div>
      <h4>暂无相关资讯</h4>
    </div>`;
  }

  function cardHTML(item) {
    const catDef = CATS.find(c => c.id === item.cat);
    const fav = isFav(item.id);
    const summary = (item.summary || (item.content || '').replace(/<[^>]+>/g,' ').slice(0, 80));
    return `<div class="card n-card" style="display:flex;flex-direction:column;justify-content:space-between;">
      <div>
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:8px;">
          <span class="tag tag-sm" style="background:${catDef.color}1a;color:${catDef.color};border:1px solid ${catDef.color}33;">${ic(catDef.icon,12)} ${catDef.label}</span>
          ${item.month ? `<span class="tag tag-sm tag-ghost" style="font-size:10.5px;">${ic('calendar',12)} ${item.month}</span>` : ''}
          ${(item.tags || []).slice(0,2).map(t => `<span class="tag tag-sm tag-ghost" style="font-size:10.5px;">#${t}</span>`).join('')}
          ${item.live ? '<span class="tag tag-sm tag-success" style="font-size:10.5px;">实时</span>' : ''}
        </div>
        <h4 style="font-size:14.5px;line-height:1.5;margin:0 0 6px;color:var(--text-1);cursor:pointer;" onclick="NewsMod.openDetail('${item.id}')">${item.title}</h4>
        <p style="font-size:12px;color:var(--text-2);line-height:1.7;margin:0 0 10px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${summary}</p>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <span style="font-size:11px;color:var(--text-3);">${item.source} · ${(item.time || '').slice(0,10) || '—'}</span>
        <span style="display:flex;gap:6px;">
          <button class="btn btn-ghost btn-sm" onclick="NewsMod.openDetail('${item.id}')">阅读</button>
          <button class="btn ${fav?'btn-primary':'btn-ghost'} btn-sm" id="favBtn_${item.id}" onclick="NewsMod.toggleFav('${item.id}')">${fav?ic('starFill',13)+' 已收藏':ic('star',13)+' 收藏'}</button>
        </span>
      </div>
    </div>`;
  }

  // ---- 详情 ----
  function findItem(id) {
    const city = Store.getCity();
    for (const c of CATS) {
      const arr = archiveItemsFor(c.id, city);
      const it = arr.find(x => x.id === id);
      if (it) return it;
    }
    for (const c of CATS) {
      const arr = _liveCache[c.id + '_' + city] || [];
      const it = arr.find(x => x.id === id);
      if (it) return it;
    }
    return null;
  }
  function openDetail(id) {
    const item = findItem(id);
    if (!item) { Utils.toast('资讯不存在或已失效', 'warn'); return; }
    view = 'detail'; detailId = id;
    const catDef = CATS.find(c => c.id === item.cat);
    const fav = isFav(item.id);
    const content = typeof item.content === 'string' && item.content.includes('<p>')
      ? item.content
      : (item.content || '').split('\n').filter(s => s.trim()).map(s => `<p>${s.trim()}</p>`).join('') || `<p>${item.summary || item.title}</p>`;
    const box = document.getElementById('newsContent');
    if (!box) { render(); return; }
    box.innerHTML = `
      <div class="card" style="max-width:860px;margin:0 auto;">
        <button class="btn btn-ghost btn-sm" onclick="NewsMod.backToList()">${ic('arrowLeft',13)} 返回列表</button>
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:12px 0 10px;">
          <span class="tag tag-sm" style="background:${catDef.color}1a;color:${catDef.color};border:1px solid ${catDef.color}33;">${ic(catDef.icon,12)} ${catDef.label}</span>
          ${(item.tags || []).map(t => `<span class="tag tag-sm tag-ghost" style="font-size:10.5px;">#${t}</span>`).join('')}
          ${item.live ? '<span class="tag tag-sm tag-success">实时</span>' : `<span class="tag tag-sm tag-ghost">归档</span>`}
        </div>
        <h2 style="font-size:19px;line-height:1.5;margin:0 0 10px;color:var(--text-1);">${item.title}</h2>
        <div style="font-size:12px;color:var(--text-3);margin-bottom:16px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <span>${ic('clock',12)} ${item.time || '—'}</span><span>·</span><span>${ic('tag',12)} ${item.source}</span><span>·</span><span>${ic('pin',12)} ${item.city || '全国'}</span>
        </div>
        <div style="font-size:13.5px;line-height:1.9;color:var(--text-1);">${content}</div>
        <div style="margin-top:18px;display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn ${fav?'btn-primary':'btn-ghost'} btn-sm" id="favBtn_${item.id}" onclick="NewsMod.toggleFav('${item.id}')">${fav?ic('starFill',13)+' 已收藏':ic('star',13)+' 收藏'}</button>
          ${item.url ? `<a class="btn btn-primary btn-sm" href="${item.url}" target="_blank" rel="noopener">${ic('link',13)} 查看原文</a>` : ''}
          <button class="btn btn-ghost btn-sm" onclick="NewsMod.shareItem('${item.id}')">${ic('send',13)} 分享</button>
        </div>
      </div>`;
    window.scrollTo(0, 0);
  }
  function backToList() { view = 'list'; renderList(false); }

  function fallbackCopy(text) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); ta.remove();
      Utils.toast('资讯已复制，可粘贴分享', 'success');
    } catch(e) { Utils.toast('分享复制失败', 'warn'); }
  }
  function shareItem(id) {
    const item = findItem(id);
    if (!item) return;
    const text = `【房产资讯】${item.title}\n${item.summary || ''}\n${item.url ? '原文：' + item.url : '来源：' + item.source}`;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text)
          .then(() => Utils.toast('资讯已复制，可粘贴分享', 'success'))
          .catch(() => fallbackCopy(text));
      } else {
        fallbackCopy(text);
      }
    } catch(e) { Utils.toast('分享复制失败', 'warn'); }
  }

  // ===== 筛选交互 =====
  function setMonth(v) { curMonth = v; renderList(false); }
  function setTime(v) { setMonth(v); }
  function doSearch() {
    const el = document.getElementById('nKw');
    kw = (el ? el.value.trim() : '');
    renderList(false);
  }
  function resetFilter() { curCat = ''; curMonth = ''; curTag = ''; curFav = false; kw = ''; renderList(false); }

  // ===== 移动端筛选抽屉（复用 more-sheet 底部抽屉样式） =====
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  // 已启用筛选条件数（按钮角标）
  function filterCount() { return (curCat ? 1 : 0) + (curMonth ? 1 : 0) + (curTag ? 1 : 0) + (curFav ? 1 : 0) + (kw ? 1 : 0); }
  function ensureFilterSheet() {
    if (document.getElementById('newsFilterMask')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <div class="more-mask" id="newsFilterMask" style="display:none" aria-hidden="true">
        <div class="more-sheet" id="newsFilterSheet" role="dialog" aria-label="筛选资讯">
          <div class="more-sheet-handle"></div>
          <div class="more-sheet-head">
            <h3>筛选资讯</h3>
            <button type="button" class="more-sheet-close" onclick="NewsMod.closeFilter()">✕</button>
          </div>
          <div class="filter-sheet-body" id="newsFilterBody"></div>
        </div>
      </div>`);
    document.getElementById('newsFilterMask').addEventListener('click', e => {
      if (e.target.id === 'newsFilterMask') closeFilter();
    });
  }
  function renderFilterSheet() {
    const body = document.getElementById('newsFilterBody');
    if (!body) return;
    const months = monthOptions();
    const tagChips = HOT_TAGS.map(t =>
      `<button type="button" class="f-chip ${curTag === t ? 'on' : ''}" data-tag="${t}" onclick="NewsMod.toggleTagM('${t}')">#${t}</button>`).join('');
    body.innerHTML = `
      <div class="filter-sheet-label">搜索</div>
      <input type="text" id="nKwM" placeholder="搜索资讯标题 / 内容 / 来源..." value="${esc(kw)}">
      <div class="filter-sheet-label">类型</div>
      <select id="nCatM">
        <option value="">全部类型</option>
        ${CATS.map(c => `<option value="${c.id}" ${curCat === c.id ? 'selected' : ''}>${c.label}</option>`).join('')}
      </select>
      <div class="filter-sheet-label">月份</div>
      <select id="nMonthM">
        <option value="">全部月份</option>
        ${months.map(m => `<option value="${m}" ${curMonth === m ? 'selected' : ''}>${m.slice(0, 4)}年${Number(m.slice(5))}月</option>`).join('')}
      </select>
      <div class="filter-sheet-label">热门标签</div>
      <div class="f-chips">${tagChips}</div>
      <div class="filter-sheet-label">收藏</div>
      <label class="f-switch-row">
        <span>只看我的收藏${getFavs().length ? ` <b style="color:var(--primary);">${getFavs().length}</b>` : ''}</span>
        <input type="checkbox" id="nFavM" class="f-check" ${curFav ? 'checked' : ''}>
        <span class="f-switch"></span>
      </label>
      <div class="filter-sheet-actions">
        <button class="btn btn-ghost" onclick="NewsMod.clearFilterM()">重置</button>
        <button class="btn btn-primary" onclick="NewsMod.applyFilterM()">应用筛选</button>
      </div>`;
  }
  function toggleTagM(t) {
    curTag = curTag === t ? '' : t;
    document.querySelectorAll('#newsFilterBody .f-chip').forEach(el => el.classList.toggle('on', el.dataset.tag === curTag));
  }
  function openFilter() {
    ensureFilterSheet();
    renderFilterSheet();
    const mask = document.getElementById('newsFilterMask');
    mask.style.display = 'block';
    mask.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => mask.classList.add('show'));
    document.body.style.overflow = 'hidden';
  }
  function closeFilter() {
    const mask = document.getElementById('newsFilterMask');
    if (!mask) return;
    mask.classList.remove('show');
    mask.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    setTimeout(() => { mask.style.display = 'none'; }, 320);
  }
  function applyFilterM() {
    curCat = document.getElementById('nCatM').value;
    curMonth = document.getElementById('nMonthM').value;
    curFav = document.getElementById('nFavM').checked;
    kw = document.getElementById('nKwM').value.trim();
    closeFilter();
    renderList(false);
  }
  function clearFilterM() {
    curCat = ''; curMonth = ''; curTag = ''; curFav = false; kw = '';
    closeFilter();
    renderList(false);
  }
  // 个人中心「我的收藏」入口：直接进入资讯收藏筛选列表
  function openFavs() {
    curCat = ''; curMonth = ''; curTag = ''; kw = ''; curFav = true; view = 'list';
    render();
  }

  return {
    render, openDetail, backToList, toggleFav, shareItem, setTime, setMonth, doSearch, resetFilter, testSource,
    openFilter, closeFilter, applyFilterM, clearFilterM, toggleTagM, openFavs, getFavs, filterCount
  };
})();
