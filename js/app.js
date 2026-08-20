/* ============================================
   主应用：路由/导航/初始化
   ============================================ */
window.App = (function() {
  let curView = 'dashboard';

  const VIEW_MAP = {
    dashboard:    {mod: 'DashboardMod',  label: '🏠 看房画像'},
    expectation:  {mod: 'ExpectationMod',label: '🎯 期望档案'},
    calendar:     {mod: 'CalendarMod',   label: '📅 看房日程'},
    records:      {mod: 'RecordsMod',    label: '📋 房源记录'},
    recommend:    {mod: 'RecommendMod',  label: '🔍 房源推荐'},
    compare:      {mod: 'CompareMod',    label: '⚖️ 决策对比'},
    report:       {mod: 'ReportMod',    label: '📄 看房报告'},
    workflow:     {mod: 'WorkflowMod',   label: '🚀 购房进度追踪'},
    aids:         {mod: 'AidsMod',       label: '🛠️ 实地检查清单'},
    finance:      {mod: 'FinanceMod',    label: '🧰 看房助手'},
    location:     {mod: 'LocationMod',   label: '🗺️ 区位分析'},
    settings:     {mod: 'SettingsMod',   label: '⚙️ 系统设置'},
  };

  // 移动端Tabbar映射
  const MOBILE_TAB = {
    dashboard: 'dashboard',
    records: 'records',
    calendar: 'calendar',
    finance: 'finance',
    more: 'settings',
  };

  function setContent(html) {
    document.getElementById('mainContent').innerHTML = html;
  }

  function navigate(view) {
    const v = VIEW_MAP[view];
    if (!v) return;
    curView = view;
    // 侧边栏
    document.querySelectorAll('.nav-item, .nav-sub-item').forEach(el => {
      el.classList.toggle('active', el.dataset.view === view);
    });
    // 子菜单触发器高亮（当看房助手子项被选中时）
    document.querySelectorAll('.nav-trigger').forEach(el => {
      el.classList.toggle('active', ['finance','location'].includes(view));
    });
    // 移动端Tabbar
    document.querySelectorAll('.mobile-tabbar .tab').forEach(el => {
      const dataView = el.dataset.view;
      // tools -> finance/aids/location/compare/recommend 归 tools组高亮
      let active = false;
      if (dataView === 'dashboard') active = view==='dashboard';
      else if (dataView === 'records') active = ['records','expectation'].includes(view);
      else if (dataView === 'calendar') active = ['calendar','recommend'].includes(view);
      else if (dataView === 'tools') active = ['finance','location','aids','compare'].includes(view);
      else if (dataView === 'more') active = ['workflow','settings'].includes(view);
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
      window._RENDER_ERR = null;
      window[v.mod].render();
    } catch(e) {
      console.error('Module render error:', e);
      window._RENDER_ERR = {msg: e.message||String(e), stack: e.stack||''};
      setContent(`<div class="card empty-state"><div class="icon">⚠️</div><h4>模块加载异常</h4>
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
        hideDD();
        navigate(el.dataset.view);
        if (window.innerWidth < 1100) {
          try { document.getElementById('navList').scrollTo({ left: el.offsetLeft - 40, behavior: 'smooth' }); } catch(_){}
        }
      });
    });
    // 看房助手子菜单 · 独立于滚动容器，展开时由 JS 定位到触发项正下方
    const ddTrigger = document.querySelector('.nav-trigger');
    const ddPanel = document.getElementById('assistantDD');
    const topbarInner = document.querySelector('.topbar-inner');
    let leaveTimer = null;
    function positionDD() {
      if (!ddTrigger || !ddPanel || !topbarInner) return;
      const tr = ddTrigger.getBoundingClientRect();
      const ib = topbarInner.getBoundingClientRect();
      const pw = ddPanel.offsetWidth || 200;
      let left = tr.left - ib.left;
      if (left + pw > ib.width - 16) left = Math.max(16, ib.width - pw - 16);
      ddPanel.style.left = left + 'px';
    }
    function showDD() { positionDD(); if (ddPanel) ddPanel.classList.add('show'); }
    function hideDD() { if (ddPanel) ddPanel.classList.remove('show'); }
    if (ddTrigger) {
      // 点击：触屏/无障碍切换
      ddTrigger.addEventListener('click', (e) => {
        e.preventDefault();
        ddPanel.classList.contains('show') ? hideDD() : showDD();
      });
      // 鼠标滑过即自动展开（桌面端主交互）
      ddTrigger.addEventListener('mouseenter', () => {
        clearTimeout(leaveTimer);
        showDD();
      });
      // 离开 trigger 后延迟收起，期间若移入面板则取消
      ddTrigger.addEventListener('mouseleave', () => {
        leaveTimer = setTimeout(hideDD, 180);
      });
    }
    // 鼠标进入面板保持展开，离开面板后收起
    if (ddPanel) {
      ddPanel.addEventListener('mouseenter', () => clearTimeout(leaveTimer));
      ddPanel.addEventListener('mouseleave', () => { leaveTimer = setTimeout(hideDD, 180); });
    }
    // 鼠标移出整个顶栏时收起（安全兜底）
    const topbarEl = document.querySelector('.topbar');
    if (topbarEl) topbarEl.addEventListener('mouseleave', () => { leaveTimer = setTimeout(hideDD, 120); });
    window.addEventListener('resize', positionDD);
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

  // 启动
  function boot() {
    // 首次启动示例数据
    Store.seedDemoIfEmpty();
    // 更新计划状态
    Store.updatePlanStatus();
    // 绑定导航
    bindNav();
    // 读取hash路由
    let initView = 'dashboard';
    if (location.hash) {
      const h = location.hash.slice(1);
      if (VIEW_MAP[h]) initView = h;
    }
    // 如果 echarts 尚未加载完成（CDN慢），等待最多5秒再渲染
    if (typeof echarts === 'undefined') {
      let waited = 0;
      const waitEcharts = setInterval(() => {
        waited += 200;
        if (typeof echarts !== 'undefined' || waited >= 5000) {
          clearInterval(waitEcharts);
          navigate(initView);
          if (typeof echarts === 'undefined') {
            Utils.toast('图表库加载失败，部分图表可能不显示', 'warn', 3000);
          }
        }
      }, 200);
    } else {
      navigate(initView);
    }
    // 计划提醒延迟检查（给通知权限点的时间）
    setTimeout(() => CalendarMod.checkReminders(), 3000);
    // 欢迎Toast
    const records = Store.getRecords();
    const todayStr = Utils.today();
    Utils.toast(records.length ? `欢迎回来！当前共 ${records.length} 条房源记录 📊` : '👋 欢迎使用南京看房助手，点击"快速记录"开始第一条房源',
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

  return { setContent, navigate };
})();
