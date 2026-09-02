/* ============================================
   个人中心 · 聚合账号 / AI 额度 / 收藏 / 通知 / 数据导出
   移动端与桌面端共用；普通用户也可访问（区别于系统管理的管理员专属配置）
   ============================================ */
window.ProfileMod = (function() {
  const ic = Utils.icon;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  function avatarHTML(u) {
    if (u && u.avatar) return `<img class="profile-avatar" src="${esc(u.avatar)}" alt="" width="64" height="64">`;
    const ch = esc((u && (u.name || u.email) || '?').slice(0, 1).toUpperCase());
    return `<span class="profile-avatar profile-avatar-text">${ch}</span>`;
  }

  function row(label, icon, action, opts) {
    const o = opts || {};
    const cls = o.danger ? ' profile-row-danger' : '';
    return `
      <button type="button" class="profile-row${cls}" onclick="${action}">
        <span class="profile-row-ico">${ic(icon, 18)}</span>
        <span class="profile-row-label">${label}</span>
        <span class="profile-row-chev">${ic('chevron', 15)}</span>
      </button>`;
  }

  function render() {
    const u = AuthMod.currentUser() || {};
    const s = Store.getSettings() || {};
    // 资讯收藏（按账号隔离）为唯一有效收藏数据源；NewsMod 首屏加载，直接读取
    const favCount = (window.NewsMod && NewsMod.getFavs ? NewsMod.getFavs().length : 0) || 0;

    const html = `
      <div class="page-header">
        <div>
          <h2>${ic('users', 20)} 个人中心</h2>
          <p class="page-desc">管理你的账号、AI 额度、收藏与数据</p>
        </div>
      </div>

      <div class="profile-head">
        ${avatarHTML(u)}
        <div class="profile-head-meta">
          <strong>${esc(u.name || u.email || '未登录')}</strong>
          <span>${esc(u.email || '')}</span>
          ${u.isAdmin ? '<span class="tag tag-primary" style="margin-top:4px;padding:1px 7px;font-size:10px;line-height:1.5;align-self:flex-start;">管理</span>' : ''}
        </div>
        <button class="btn btn-ghost btn-sm" onclick="App.openProfile()">${ic('edit', 14)} 编辑</button>
      </div>

      <div class="profile-group">
        <div class="profile-group-title">账号</div>
        ${row('个人资料', 'users', 'App.openProfile()')}
        ${row('退出登录', 'arrowLeft', 'App.doLogout()', { danger: true })}
      </div>

      <div class="profile-group">
        <div class="profile-group-title">AI 助手</div>
        ${row('AI 额度与充值', 'bolt', 'App.gotoQuota()')}
      </div>

      <div class="profile-group">
        <div class="profile-group-title">数据与偏好</div>
        ${row('我的收藏' + (favCount ? ` <span class="profile-count">${favCount}</span>` : ''), 'star', "ProfileMod.goMyFavs()")}
        <div class="profile-row">
          <span class="profile-row-ico">${ic('bell', 18)}</span>
          <span class="profile-row-label">看房计划提醒</span>
          <button type="button" class="profile-switch ${s.enableNotification ? 'on' : ''}" onclick="ProfileMod.toggleNotify()" role="switch" aria-checked="${s.enableNotification ? 'true' : 'false'}" aria-label="看房计划提醒">
            <span class="profile-switch-knob"></span>
          </button>
        </div>
        ${row('导出看房计划 CSV', 'download', 'ProfileMod.exportPlans()')}
        ${row('导出房源数据 CSV', 'chart', 'ProfileMod.exportHouses()')}
      </div>

      <p class="profile-about">优宅邦 NestWise · 智慧选房 · 决策无忧</p>
    `;
    App.setContent(html);
  }

  function toggleNotify() {
    const s = Store.getSettings() || {};
    s.enableNotification = !s.enableNotification;
    Store.saveSettings(s);
    // 同步其它页面的通知 UI 状态（若 SettingsMod 已加载）
    if (window.SettingsMod && typeof SettingsMod.syncNotifyUI === 'function') SettingsMod.syncNotifyUI();
    render();
    Utils.toast(s.enableNotification ? '已开启看房计划提醒' : '已关闭看房计划提醒', 'success');
  }

  function exportPlans() {
    if (window.SettingsMod && typeof SettingsMod.exportCSVPlan === 'function') {
      SettingsMod.exportCSVPlan();
    } else {
      Utils.toast('导出模块未加载，请刷新后重试', 'warn');
    }
  }

  async function exportHouses() {
    // 房源 CSV 由 WorkflowMod 提供（低频模块，按需加载）
    if (window.WorkflowMod && typeof WorkflowMod.exportExcel === 'function') {
      WorkflowMod.exportExcel();
      return;
    }
    Utils.toast('正在准备导出...', 'info');
    try {
      await new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'js/modules/workflow.js?v=20261002';
        s.onload = res; s.onerror = () => rej(new Error('加载失败'));
        document.head.appendChild(s);
      });
      if (window.WorkflowMod && typeof WorkflowMod.exportExcel === 'function') WorkflowMod.exportExcel();
      else Utils.toast('导出失败，请重试', 'danger');
    } catch (e) {
      Utils.toast('导出模块加载失败', 'danger');
    }
  }

  // 「我的收藏」：先切到资讯页，再进入收藏筛选列表（NewsMod.openFavs 设置 curFav 后重渲染）
  function goMyFavs() {
    App.navigate('news').then(() => {
      if (window.NewsMod && typeof NewsMod.openFavs === 'function') NewsMod.openFavs();
    });
  }

  return { render, toggleNotify, exportPlans, exportHouses, goMyFavs };
})();
