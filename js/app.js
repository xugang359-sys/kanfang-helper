/* ============================================
   主应用：路由/导航/初始化
   ============================================ */
window.App = (function() {
  const ic = Utils.icon;   // SF Symbols 风格图标
  let curView = 'dashboard';

  const VIEW_MAP = {
    dashboard:    {mod: 'DashboardMod',  label: '看房画像'},
    expectation:  {mod: 'ExpectationMod',label: '期望档案'},
    calendar:     {mod: 'CalendarMod',   label: '看房日程'},
    records:      {mod: 'RecordsMod',    label: '房源记录'},
    news:         {mod: 'NewsMod',       label: '房产资讯'},
    compare:      {mod: 'CompareMod',    label: '决策对比'},
    chat:         {mod: 'ChatMod',       label: 'AI 购房助手'},
    report:       {mod: 'ReportMod',    label: '看房报告'},
    workflow:     {mod: 'WorkflowMod',   label: '购房进度追踪'},
    finance:      {mod: 'FinanceMod',    label: '看房助手'},
    location:     {mod: 'LocationMod',   label: '区位分析'},
    // 系统管理 · 四个独立子模块（仅管理员）
    'admin-users': {mod: 'AdminMod', label: '用户管理', sub: 'users'},
    'admin-logs':  {mod: 'AdminMod', label: '访问日志', sub: 'logs'},
    'admin-config':{mod: 'AdminMod', label: '配置清单', sub: 'config'},
    'admin-data':  {mod: 'AdminMod', label: '数据处理', sub: 'data'},
    'admin-quota': {mod: 'AdminMod', label: '额度管理', sub: 'quota'},
  };

  // 移动端Tabbar映射
  const MOBILE_TAB = {
    dashboard: 'dashboard',
    records: 'records',
    calendar: 'calendar',
    finance: 'finance',
    more: 'workflow',
  };

  function setContent(html) {
    // 离开聊天页时自动收起对话记录抽屉
    if (curView !== 'chat' && window.ChatMod && typeof ChatMod.closeDrawer === 'function') ChatMod.closeDrawer();
    // 全局内容宽度约束（与其他模块保持一致）；已自带 page-shell 的模块不重复包裹
    const wrap = typeof html === 'string' && !/class="[^"]*page-shell/.test(html);
    document.getElementById('mainContent').innerHTML = wrap ? `<div class="page-shell">${html}</div>` : html;
    // 注入 AI 悬浮按钮（chat 页面自身不显示）
    injectFab();
  }

  function injectFab() {
    try {
      const old = document.getElementById('chatFab');
      if (old) old.remove();
      if (curView === 'chat') return;
      if (typeof ChatMod === 'undefined' || !ChatMod.renderFab) return;
      if (typeof AuthMod === 'undefined' || !AuthMod.currentUser()) return;
      const fabHTML = ChatMod.renderFab();
      if (!fabHTML) return;
      document.body.insertAdjacentHTML('beforeend', `<div id="chatFab">${fabHTML}</div>`);
      if (typeof ChatMod.initFab === 'function') ChatMod.initFab();
    } catch(e) { /* ChatMod 未加载时静默跳过 */ }
  }

  // 低频视图模块按需加载：首屏不下载，首次切入对应视图时才动态注入
  const LAZY_MODS = {
    'AdminMod':    'js/modules/admin.js',
    'LocationMod': 'js/modules/location.js',
    'FinanceMod':  'js/modules/finance.js',
    'ReportMod':   'js/modules/report.js',
    'WorkflowMod': 'js/modules/workflow.js',
    'CompareMod':  'js/modules/compare.js',
  };
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src + '?v=20260928';
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('模块加载失败: ' + src));
      document.head.appendChild(s);
    });
  }

  function navigate(view) { return doNavigate(view).catch(() => {}); }
  async function doNavigate(view) {
    const v = VIEW_MAP[view];
    if (!v) return;
    // 权限拦截：系统管理四个子模块 仅管理员可访问
    if (view.indexOf('admin') === 0 && !AuthMod.isAdmin()) {
      Utils.toast('该模块仅管理员可访问', 'warn');
      navigate('dashboard');
      return;
    }
    curView = view;
    // 侧边栏
    document.querySelectorAll('.nav-item, .nav-sub-item').forEach(el => {
      el.classList.toggle('active', el.dataset.view === view);
    });
    // 子菜单触发器高亮（看房助手子项 → 看房助手；系统管理子项 → 系统管理）
    document.querySelectorAll('.nav-trigger').forEach(el => {
      const dd = el.dataset.dd;
      const on = (dd === 'assistantDD' && ['finance','location'].includes(view)) || (dd === 'adminDD' && view.indexOf('admin') === 0);
      el.classList.toggle('active', on);
    });
    // 移动端Tabbar
    document.querySelectorAll('.mobile-tabbar .tab').forEach(el => {
      const dataView = el.dataset.view;
      // tools -> finance/aids/location/compare/recommend 归 tools组高亮
      let active = false;
      if (dataView === 'dashboard') active = view==='dashboard';
      else if (dataView === 'records') active = ['records','expectation'].includes(view);
      else if (dataView === 'calendar') active = view==='calendar';
      else if (dataView === 'tools') active = ['finance','location','compare','news'].includes(view);
      else if (dataView === 'more') active = ['workflow'].includes(view);
      el.classList.toggle('active', active);
    });
    // 更新地址栏
    try {
      history.replaceState({view}, '', '#'+view);
    } catch(e){}
    // 调用对应模块render（先清理旧echarts实例，防止AJAX/异步回调操作已销毁的DOM）
    try {
      document.querySelectorAll('[_echarts_instance_]').forEach(el => { try { echarts.getInstanceByDom(el)?.dispose(); } catch(_){} });
    } catch(_){}
    try {
      const modName = v.mod;
      // 低频模块按需加载：首次切入该视图时动态注入脚本，完成后渲染
      if (!window[modName] && LAZY_MODS[modName]) {
        await loadScript(LAZY_MODS[modName]);
      }
      window._RENDER_ERR = null;
      window[v.mod].render(v.sub);   // AdminMod.render('users'|'logs'|'config'|'data')
    } catch(e) {
      console.error('Module render error:', e);
      window._RENDER_ERR = {msg: e.message||String(e), stack: e.stack||''};
      setContent(`<div class="card empty-state"><div class="icon">${ic('alert')}</div><h4>模块加载异常</h4>
        <p style="color:var(--danger);"><strong>模块：</strong>${v.mod}</p>
        <p style="color:var(--danger);"><strong>错误：</strong>${e.message||e}</p>
        <p style="font-size:11.5px;color:var(--text-3);white-space:pre-wrap;margin-top:10px;text-align:left;background:#00000006;padding:10px;border-radius:6px;">${e.stack||''}</p></div>`);
    }
    window.scrollTo(0,0);
  }

  function bindNav() {
    // 顶部门户导航（含子菜单项）
    document.querySelectorAll('#navList .nav-item, .nav-sub-item').forEach(el => {
      if (!el.dataset.view) return; // 跳过 trigger
      el.addEventListener('click', (e) => {
        e.preventDefault();
        hideAllDD();
        navigate(el.dataset.view);
        if (window.innerWidth < 1100) {
          try { document.getElementById('navList').scrollTo({ left: el.offsetLeft - 40, behavior: 'smooth' }); } catch(_){}
        }
      });
    });
    // 下拉子菜单（看房助手 / 系统管理）· 独立于滚动容器，展开时由 JS 定位到触发项正下方
    const topbarInner = document.querySelector('.topbar-inner');
    let leaveTimer = null;
    function positionDD(trigger, panel) {
      if (!trigger || !panel || !topbarInner) return;
      const tr = trigger.getBoundingClientRect();
      const ib = topbarInner.getBoundingClientRect();
      const pw = panel.offsetWidth || 200;
      let left = tr.left - ib.left;
      if (left + pw > ib.width - 16) left = Math.max(16, ib.width - pw - 16);
      panel.style.left = left + 'px';
    }
    function hideAllDD() { document.querySelectorAll('.nav-submenu.show').forEach(p => p.classList.remove('show')); }
    function showDD(trigger, panel) { hideAllDD(); positionDD(trigger, panel); panel.classList.add('show'); }
    document.querySelectorAll('.nav-trigger[data-dd]').forEach(trigger => {
      const panel = document.getElementById(trigger.dataset.dd);
      if (!panel) return;
      // 点击：触屏/无障碍切换
      trigger.addEventListener('click', (e) => {
        e.preventDefault();
        panel.classList.contains('show') ? hideAllDD() : showDD(trigger, panel);
      });
      // 鼠标滑过即自动展开（桌面端主交互）
      trigger.addEventListener('mouseenter', () => { clearTimeout(leaveTimer); showDD(trigger, panel); });
      // 离开 trigger 后延迟收起，期间若移入面板则取消
      trigger.addEventListener('mouseleave', () => { leaveTimer = setTimeout(hideAllDD, 180); });
      // 鼠标进入面板保持展开，离开面板后收起
      panel.addEventListener('mouseenter', () => clearTimeout(leaveTimer));
      panel.addEventListener('mouseleave', () => { leaveTimer = setTimeout(hideAllDD, 180); });
    });
    // 鼠标移出整个顶栏时收起（安全兜底）
    const topbarEl = document.querySelector('.topbar');
    if (topbarEl) topbarEl.addEventListener('mouseleave', () => { leaveTimer = setTimeout(hideAllDD, 120); });
    window.addEventListener('resize', () => { document.querySelectorAll('.nav-trigger[data-dd]').forEach(tr => { const p = document.getElementById(tr.dataset.dd); if (p && p.classList.contains('show')) positionDD(tr, p); }); });
    // 移动端Tabbar
    document.querySelectorAll('#mobileTabbar .tab').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const map = MOBILE_TAB[el.dataset.view] || 'dashboard';
        navigate(map);
      });
    });
    // 模态框遮罩点击关闭
    document.getElementById('modalMask').addEventListener('click', (e) => {
      if (e.target.id === 'modalMask') Utils.closeModal();
    });
    // ESC关闭模态框
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') Utils.closeModal();
    });
    // 响应式重绘图表（resize时）
    window.addEventListener('resize', () => {
      try { echarts.getInstanceByDom && document.querySelectorAll('[_echarts_instance_]').forEach(el => { const inst = echarts.getInstanceByDom(el); if (inst) inst.resize(); }); } catch(e){}
    });
  }

  // 顶栏城市切换（全局可见，省市级联；切换后各模块区域选项联动）
  function renderCitySwitch() {
    const box = document.getElementById('topbarCity');
    if (!box) return;
    box.innerHTML = `<span class="city-label">${ic('pin',14)}</span>
      <div class="cascade-group top-cascade">${Store.cityCascadeHTML(Store.getCity(), 'top', { id: 'topCitySel', onCity: 'App.changeCity(this.value)' })}</div>`;
  }
  function changeCity(city) {
    const old = Store.getCity();
    Store.setCity(city);
    const top = document.getElementById('topCitySel');
    if (top) top.value = city;
    // 联动期望档案的意向区域（跟随全局城市的区域组同步切换）
    if (window.ExpectationMod) ExpectationMod.onGlobalCityChange(city, old);
    Utils.toast(`已切换城市：${city}，区域选项已同步更新`, 'success');
  }

  // 顶栏用户菜单（头像 + 下拉：个人资料 / 退出登录）
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function avatarHTML(u, size) {
    if (u && u.avatar) return `<img class="user-avatar" src="${esc(u.avatar)}" alt="" width="${size}" height="${size}" style="width:${size}px;height:${size}px;">`;
    const ch = esc((u && (u.name || u.email) || '?').slice(0, 1).toUpperCase());
    return `<span class="user-avatar user-avatar-text" style="width:${size}px;height:${size}px;font-size:${Math.round(size*0.44)}px;">${ch}</span>`;
  }
  function renderUser() {
    const box = document.getElementById('topbarUser');
    if (!box) return;
    const u = AuthMod.currentUser();
    if (!u) { box.innerHTML = ''; return; }
    // 桌面端导航栏已有「系统管理」入口，用户菜单不再重复；移动端导航隐藏时保留该入口
    const isWide = window.innerWidth >= 1100;
    box.innerHTML = `
      <button type="button" class="topbar-quota" id="topbarQuota" onclick="App.gotoQuota()" title="AI 对话剩余额度 · 点击查看 / 充值">
        <span class="topbar-quota-ico">${ic('bolt', 13)}</span>
        <span class="topbar-quota-txt">AI …</span>
      </button>
      <div class="user-menu" id="userMenu">
        <button type="button" class="user-btn" id="userBtn" aria-haspopup="true">
          ${avatarHTML(u, 26)}<span class="user-name">${esc(u.name || u.email)}</span>${u.isAdmin ? '<span class="user-badge" title="管理员">管</span>' : ''}
        </button>
        <div class="user-dd" id="userDD">
          <div class="user-dd-head">
            ${avatarHTML(u, 40)}
            <div class="user-dd-meta"><strong>${esc(u.name || '')}</strong><small>${esc(u.email)} · ${u.isAdmin ? '管理员' : '普通用户'}</small></div>
          </div>
          <button type="button" class="user-dd-item user-dd-action" onclick="App.openProfile()">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>个人资料
          </button>
          ${u.isAdmin && !isWide ? '<button type="button" class="user-dd-item user-dd-action" onclick="App.navigate(\'admin-users\')"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>系统管理</button>' : ''}
          <button type="button" class="user-dd-item user-dd-action" onclick="App.goPortal()">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m3 10.5 9-7.5 9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/></svg>返回门户
          </button>
          <button type="button" class="user-dd-item user-dd-exit" onclick="App.doLogout()">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>退出登录
          </button>
        </div>
      </div>`;
    const btn = document.getElementById('userBtn');
    const dd  = document.getElementById('userDD');
    if (btn && dd) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        dd.classList.toggle('show');
      });
      document.addEventListener('click', () => dd.classList.remove('show'));
    }
    refreshTopbarQuota();
  }

  // 右上角额度徽章：读取后端实时额度并刷新；额度低时高亮，用尽时红色警示
  async function refreshTopbarQuota() {
    const el = document.getElementById('topbarQuota');
    if (!el) return;
    const q = await Utils.fetchQuota();
    if (!q) return;
    const txt = el.querySelector('.topbar-quota-txt');
    if (!txt) return;
    const small = window.innerWidth <= 768;
    if (q.unlimited) {
      txt.textContent = small ? '∞' : 'AI 无限';
      el.classList.remove('low', 'out');
    } else {
      txt.textContent = small ? String(q.remain) : 'AI 剩余 ' + q.remain + ' 次';
      el.classList.toggle('low', q.remain > 0 && q.remain <= 5);
      el.classList.toggle('out', q.remain <= 0);
    }
  }

  // 点击右上角额度徽章：打开充值中心（额度展示 / 卡密兑换 / 人工申请）
  function gotoQuota() {
    if (window.ChatMod && typeof ChatMod.openRechargeModal === 'function') ChatMod.openRechargeModal();
    else navigate('chat');
  }

  // ===== 个人资料：头像 / 昵称 / 修改密码 =====
  let pendingAvatar; // undefined=不修改
  function openProfile() {
    const u = AuthMod.currentUser();
    pendingAvatar = undefined;
    Utils.openModal({
      title: '个人资料',
      body: `
        <div style="display:flex;flex-direction:column;gap:14px;">
          <div style="display:flex;align-items:center;gap:18px;">
            <div id="profileAvatar">${avatarHTML(u, 64)}</div>
            <div style="display:flex;flex-direction:column;gap:8px;">
              <button class="btn btn-ghost btn-sm" onclick="App.pickAvatar()">${ic('camera',15)} 更换头像</button>
              ${u && u.avatar ? '<button class="btn btn-ghost btn-sm" onclick="App.removeAvatar()">移除头像</button>' : ''}
            </div>
            <input type="file" id="avatarFile" accept="image/*" style="display:none">
          </div>
          <div class="form-item"><label>昵称</label><input type="text" id="p_name" value="${esc(u.name || '')}" maxlength="20" placeholder="你的昵称"></div>
          <div class="form-item"><label>邮箱（登录账号，不可修改）</label><input type="text" value="${esc(u.email)}" disabled></div>
          <div style="border-top:1px solid var(--border-light);padding-top:14px;">
            <p style="font-size:12.5px;font-weight:700;color:var(--text-2);margin-bottom:10px;">修改密码（可选）</p>
            <div class="form-item"><label>原密码</label><input type="password" id="p_old" placeholder="输入当前密码" autocomplete="current-password"></div>
            <div class="form-item"><label>新密码</label><input type="password" id="p_new" placeholder="至少 6 位" autocomplete="new-password"></div>
          </div>
        </div>`,
      size: 'sm',
      footer: `<button class="btn btn-ghost" onclick="Utils.closeModal()">取消</button>
        <button class="btn btn-primary" onclick="App.saveProfile()">保存</button>`,
    });
    const file = document.getElementById('avatarFile');
    if (file) file.addEventListener('change', () => onAvatarFile(file));
  }
  // 头像压缩：居中裁剪为 128×128 → JPEG base64
  function onAvatarFile(input) {
    const f = input.files && input.files[0];
    if (!f) return;
    if (!/^image\//.test(f.type)) { Utils.toast('请选择图片文件', 'warn'); return; }
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const size = 128;
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d');
        const min = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width - min) / 2, (img.height - min) / 2, min, min, 0, 0, size, size);
        pendingAvatar = canvas.toDataURL('image/jpeg', 0.85);
        const el = document.getElementById('profileAvatar');
        if (el) el.innerHTML = `<img class="user-avatar" src="${pendingAvatar}" alt="" width="64" height="64" style="width:64px;height:64px;">`;
        Utils.toast('头像已选择，点击「保存」生效', 'info');
      };
      img.onerror = () => Utils.toast('图片读取失败', 'danger');
      img.src = e.target.result;
    };
    reader.readAsDataURL(f);
  }
  function removeAvatar() {
    pendingAvatar = '';
    const u = AuthMod.currentUser();
    const el = document.getElementById('profileAvatar');
    if (el) el.innerHTML = avatarHTML({ ...u, avatar: '' }, 64);
    Utils.toast('头像已移除，点击「保存」生效', 'info');
  }
  function pickAvatar() {
    const file = document.getElementById('avatarFile');
    if (file) file.click();
  }
  async function saveProfile() {
    const name = document.getElementById('p_name').value.trim();
    const oldPass = document.getElementById('p_old').value;
    const newPass = document.getElementById('p_new').value;
    if (!name) { Utils.toast('昵称不能为空', 'warn'); return; }
    if (newPass && newPass.length < 6) { Utils.toast('新密码至少 6 位', 'warn'); return; }
    if (newPass && !oldPass) { Utils.toast('修改密码需填写原密码', 'warn'); return; }
    const payload = { name };
    if (pendingAvatar !== undefined) payload.avatar = pendingAvatar;
    if (newPass) { payload.oldPass = oldPass; payload.newPass = newPass; }
    const r = await AuthMod.updateProfile(payload);
    if (!r.ok) { Utils.toast(r.err || '保存失败', 'danger'); return; }
    pendingAvatar = undefined;
    Utils.closeModal();
    renderUser();
    Utils.toast(r.changed ? '资料已保存，密码已更新' : '资料已保存', 'success');
  }

  function doLogout() {
    AuthMod.logout();
    Utils.toast('已退出登录', 'info');
    setTimeout(() => location.replace('login.html'), 500);
  }

  // 返回门户：保留登录态，回到门户首页（portal.html）；门户导航登录态显示"进入工作台"直达系统
  function goPortal() {
    Utils.toast('已返回门户', 'info');
    location.replace('portal.html');
  }

  // 返回顶部
  function initToTop() {
    const btn = document.getElementById('toTopBtn');
    if (!btn) return;
    const onScroll = () => btn.classList.toggle('show', window.scrollY > 520);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    btn.addEventListener('click', () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) window.scrollTo(0, 0);
      else window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // 隐藏刷新加载过渡动画（淡出后移除节点）
  function hideLoader() {
    const l = document.getElementById('appLoader');
    if (!l) return;
    l.classList.add('hide');
    setTimeout(() => { if (l.parentNode) l.parentNode.removeChild(l); }, 450);
  }
  // 兜底：即使初始化异常，也保证加载遮罩最终消失
  setTimeout(hideLoader, 6000);

  // 启动
  async function boot() {
    // 登录门槛：未登录一律跳转登录门户
    if (!AuthMod.isLoggedIn()) { location.replace('login.html'); return; }
    // 权限控制：系统设置 / 用户管理 导航仅管理员可见（CSS 默认隐藏，防止刷新闪现；管理员移除隐藏类恢复显示）
    document.querySelectorAll('.admin-only').forEach(el => {
      if (AuthMod.isAdmin()) el.classList.remove('admin-only');
    });
    // 上报本次访问日志（同一浏览器会话仅一次；城市用于区域登录统计）
    try {
      const lgKey = 'hh_logged_city';
      if (!sessionStorage.getItem(lgKey)) {
        AuthMod.logCity(Store.getCity() || '南京');
        sessionStorage.setItem(lgKey, '1');
      }
    } catch(e) {}
    // 先拉取云端快照与全局 API 配置（换设备恢复数据 + 管理员配置的 Key 全员共享）
    if (window.SyncMod) {
      try { await Promise.allSettled([SyncMod.syncAfterLogin(), SyncMod.loadConfig()]); } catch(e) {}
    }
    // 更新计划状态
    Store.updatePlanStatus();
    // 绑定导航
    bindNav();
    // 返回顶部
    initToTop();
    // 顶栏城市选择器
    renderCitySwitch();
    // 顶栏用户菜单
    renderUser();
    // 断点切换时刷新用户菜单（桌面/移动端「系统管理」入口差异）
    window.addEventListener('resize', () => { try { renderUser(); } catch(e){} });
    // 读取hash路由
    let initView = 'chat';
    if (location.hash) {
      const h = location.hash.slice(1);
      if (VIEW_MAP[h]) initView = h;
    }
    // echarts 已改为按需加载：首屏不依赖，直接渲染视图（图表由各模块 ensureEcharts 后补绘）
    navigate(initView);
    hideLoader();
    // 计划提醒延迟检查（给通知权限点的时间）
    setTimeout(() => CalendarMod.checkReminders(), 3000);
    // 欢迎Toast
    const records = Store.getRecords();
    const todayStr = Utils.today();
    Utils.toast(records.length ? `欢迎回来！当前共 ${records.length} 条房源记录` : '欢迎使用看房助手，点击"快速记录"开始第一条房源',
      'info', 2200);
  }

  // 监听hash变化
  window.addEventListener('hashchange', () => {
    const h = location.hash.slice(1);
    if (VIEW_MAP[h] && h !== curView) navigate(h);
  });

  // DOM Ready后启动
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  return { get curView() { return curView; }, setContent, navigate, changeCity, renderCitySwitch, renderUser, doLogout, goPortal, openProfile, pickAvatar, removeAvatar, saveProfile, refreshTopbarQuota, gotoQuota };
})();
