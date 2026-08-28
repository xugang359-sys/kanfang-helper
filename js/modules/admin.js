/* ============================================
   系统管理 · 仅管理员可见（五个独立子模块）
   1. 用户管理 admin-users   ：用户数据增删改查 + 启用/禁用
   2. 访问日志 admin-logs    ：用户统计 + 天/周/月/全部 区域分布与活跃度（中国地图）
   3. 配置清单 admin-config  ：通知偏好 + 联网 API 配置（复用 SettingsMod）
   4. 数据处理 admin-data    ：数据备份与恢复（复用 SettingsMod）
   5. 额度管理 admin-quota   ：AI 对话额度列表 / 生成卡密 / 审批充值申请
   ============================================ */
window.AdminMod = (function() {
  const ic = Utils.icon;   // SF Symbols 风格图标
  let curSub = 'users';   // users | logs | config | data | quota
  let range  = 'all';     // all | day | week | month（访问日志时间范围）
  let editEmail = null;   // 用户弹窗当前编辑的邮箱（null = 新增）
  let _chinaGeo = null;   // 中国地图 geojson 缓存
  let _mapChart = null;     // 中国地图当前 ECharts 实例
  let _mapLevel = 'province'; // province=全国省域 | city=下钻城市
  let _mapBackBtn = null;   // “返回全国”按钮元素
  let _provOption = null;   // 省域层完整 option（供从城市层返回）
  let _provGeoCache = {};   // 已加载的省份 geojson 缓存（adcode -> geojson）

  // 常用城市经纬度 + 省份归属（简易中国地图散点与省份高亮）
  const CITY_LL = {
    '北京':[116.4,39.9],'上海':[121.5,31.2],'广州':[113.3,23.1],'深圳':[114.1,22.5],
    '南京':[118.8,32.1],'杭州':[120.2,30.3],'苏州':[120.6,31.3],'成都':[104.1,30.7],
    '重庆':[106.5,29.6],'武汉':[114.3,30.6],'西安':[108.9,34.3],'郑州':[113.6,34.8],
    '长沙':[113.0,28.2],'青岛':[120.4,36.1],'天津':[117.2,39.1],'沈阳':[123.4,41.8],
    '大连':[121.6,38.9],'济南':[117.0,36.7],'合肥':[117.3,31.9],'福州':[119.3,26.1],
    '厦门':[118.1,24.5],'昆明':[102.7,25.0],'贵阳':[106.6,26.6],'南宁':[108.3,22.8],
    '南昌':[115.9,28.7],'石家庄':[114.5,38.0],'太原':[112.5,37.9],'哈尔滨':[126.6,45.8],
    '长春':[125.3,43.9],'海口':[110.3,20.0],'兰州':[103.8,36.1],'乌鲁木齐':[87.6,43.8],
    '呼和浩特':[111.7,40.8],'银川':[106.2,38.5],'西宁':[101.8,36.6],'拉萨':[91.1,29.7],
    '无锡':[120.3,31.6],'宁波':[121.5,29.9],'徐州':[117.3,34.2],'南通':[120.9,32.0],
    '扬州':[119.4,32.4],'温州':[120.7,28.0],'佛山':[113.1,23.0],'东莞':[113.7,23.0],
    '香港':[114.2,22.3],'澳门':[113.5,22.2],
  };
  const CITY_PROVINCE = {
    '北京':'北京市','上海':'上海市','天津':'天津市','重庆':'重庆市','香港':'香港特别行政区','澳门':'澳门特别行政区',
    '广州':'广东省','深圳':'广东省','佛山':'广东省','东莞':'广东省',
    '南京':'江苏省','苏州':'江苏省','无锡':'江苏省','徐州':'江苏省','南通':'江苏省','扬州':'江苏省',
    '杭州':'浙江省','宁波':'浙江省','温州':'浙江省',
    '成都':'四川省','武汉':'湖北省','西安':'陕西省','郑州':'河南省','长沙':'湖南省',
    '青岛':'山东省','济南':'山东省','沈阳':'辽宁省','大连':'辽宁省',
    '合肥':'安徽省','福州':'福建省','厦门':'福建省','昆明':'云南省','贵阳':'贵州省','南宁':'广西壮族自治区',
    '南昌':'江西省','石家庄':'河北省','太原':'山西省','哈尔滨':'黑龙江省','长春':'吉林省','海口':'海南省',
    '兰州':'甘肃省','乌鲁木齐':'新疆维吾尔自治区','呼和浩特':'内蒙古自治区','银川':'宁夏回族自治区',
    '西宁':'青海省','拉萨':'西藏自治区',
  };
  // 省份行政区划编码（DataV areas_v3，点击省份下钻城市边界用）
  const PROV_ADCODE = {
    '北京市':110000,'天津市':120000,'河北省':130000,'山西省':140000,'内蒙古自治区':150000,
    '辽宁省':210000,'吉林省':220000,'黑龙江省':230000,'上海市':310000,'江苏省':320000,
    '浙江省':330000,'安徽省':340000,'福建省':350000,'江西省':360000,'山东省':370000,
    '河南省':410000,'湖北省':420000,'湖南省':430000,'广东省':440000,'广西壮族自治区':450000,
    '海南省':460000,'重庆市':500000,'四川省':510000,'贵州省':520000,'云南省':530000,
    '西藏自治区':540000,'陕西省':610000,'甘肃省':620000,'青海省':630000,'宁夏回族自治区':640000,
    '新疆维吾尔自治区':650000,'台湾省':710000,'香港特别行政区':810000,'澳门特别行政区':820000,
  };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function fmtTime(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  }
  function fmtDate(t) {
    if (!t) return '—';
    const d = new Date(t);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  // 通用带鉴权请求
  async function api(path, body, method) {
    const t = window.SyncMod && SyncMod.getToken();
    if (!t) return { ok: false, err: '未登录' };
    try {
      const r = await fetch('/api/' + path, {
        method: method || (body ? 'POST' : 'GET'),
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
        body: body ? JSON.stringify(body) : undefined,
      });
      return await r.json();
    } catch(e) { return { ok: false, err: '网络请求失败' }; }
  }

  // ==================== 系统管理四子模块：标签与标题图标 ====================
  const SUB_NAV = [
    ['users',  '用户管理', 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75'],
    ['logs',   '访问日志', 'M18 20V10M12 20V4M6 20v-6'],
    ['config', '配置清单', 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6'],
    ['data',   '数据处理', 'M12 2a9 9 0 0 0-9 9c0 5 9 11 9 11s9-6 9-11a9 9 0 0 0-9-9Zm0 6a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z'],
    ['quota',  '额度管理', 'M3 6h18M3 12h18M3 18h12'],
  ];
  const subIcon = (d, s) => `<svg width="${s || 15}" height="${s || 15}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="${d}"/></svg>`;
  // 内置默认管理员账号（系统初始化创建，禁止禁用/删除/移除管理员角色）
  const SUPER_ADMIN = 'admin@example.com';

  // ==================== ① 用户管理 ====================
  async function renderUsers(pane) {
    pane.innerHTML = `
      <div class="admin-bar">
        <button class="btn btn-primary btn-sm" onclick="AdminMod.openUserModal()">${subIcon('M12 5v14M5 12h14')}新增用户</button>
        <button class="btn btn-danger btn-sm" onclick="AdminMod.batchDelete()">${subIcon('M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14Z', 13)}批量删除</button>
        <span class="admin-bar-tip">可新增 / 编辑 / 删除用户，勾选多个用户后可批量删除</span>
      </div>
      <div id="userTableBox"><div class="card"><p style="color:var(--text-3);padding:10px 0;">正在加载用户...</p></div></div>`;
    const r = await api('admin/users', null, 'GET');
    const box = pane.querySelector('#userTableBox');
    if (!r.ok) { box.innerHTML = `<div class="card"><p style="color:var(--danger);">${esc(r.err || '加载失败')}</p></div>`; return; }
    window._adminUsers = r.users || []; // 缓存，供编辑弹窗预填
    box.innerHTML = userTable(r.users);
  }

  function userTable(users) {
    if (!users.length) return `<div class="card"><div class="card-title">${subIcon('M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75')}注册用户</div><p class="empty">暂无用户</p></div>`;
    const me = AuthMod.currentUser();
    const rows = users.map(u => {
      const isSuper = u.email === SUPER_ADMIN;
      const canDel = !isSuper && (!me || me.email !== u.email); // 与行内删除按钮同一保护条件
      const statusTag = u.enabled ? '<span class="tag tag-success">启用</span>' : '<span class="tag tag-danger">禁用</span>';
      const roleTag = u.isAdmin ? '<span class="tag tag-primary">管理员</span>' : '<span class="tag">普通用户</span>';
      const ops = [];
      ops.push(`<button class="btn btn-ghost btn-xs" onclick="AdminMod.openUserModal('${esc(u.email)}')">${subIcon('M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5Z', 13)}编辑</button>`);
      if (u.enabled) {
        if (!isSuper) ops.push(`<button class="btn btn-ghost btn-xs" onclick="AdminMod.toggleUser('${esc(u.email)}',false)">${subIcon('M10 4v16M14 4v16', 13)}禁用</button>`);
      } else {
        ops.push(`<button class="btn btn-success btn-xs" onclick="AdminMod.toggleUser('${esc(u.email)}',true)">${subIcon('M5 3l14 9-14 9V3Z', 13)}启用</button>`);
      }
      if (canDel) {
        ops.push(`<button class="btn btn-danger btn-xs" onclick="AdminMod.deleteUser('${esc(u.email)}')">${subIcon('M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14Z', 13)}删除</button>`);
      }
      return `<tr>
        <td><input type="checkbox" class="user-sel" data-email="${esc(u.email)}" ${canDel ? '' : 'disabled'}></td>
        <td><div style="font-weight:600;">${esc(u.name)}${me && me.email === u.email ? '<span class="user-badge">我</span>' : ''}</div></td>
        <td>${esc(u.email)}</td>
        <td>${roleTag}</td>
        <td>${statusTag}</td>
        <td>${fmtDate(u.createdAt)}</td>
        <td>${fmtTime(u.lastLogin)}</td>
        <td style="white-space:nowrap;">${ops.join(' ')}</td>
      </tr>`;
    }).join('');
    return `<div class="card" style="padding:16px;">
      <div class="card-title">${subIcon('M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75')}注册用户（${users.length}）</div>
      <div class="table-wrap"><table class="table">
        <thead><tr><th style="width:36px;"><input type="checkbox" id="selAll" onclick="AdminMod.toggleSelectAll(this)"></th><th>昵称</th><th>邮箱</th><th>角色</th><th>状态</th><th>注册日期</th><th>最后访问</th><th>操作</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
    </div>`;
  }

  // 新增 / 编辑用户弹窗
  function openUserModal(email) {
    editEmail = email || null;
    const u = email ? (window._adminUsers || []).find(x => x.email === email) : null;
    const isEdit = !!email;
    const isSuper = isEdit && String(email).toLowerCase() === SUPER_ADMIN;
    const isAdminAcc = isEdit && !!(u && u.isAdmin); // 管理员账号：邮箱唯一标识、角色不可降级，显示框置灰
    Utils.openModal({
      title: isEdit ? '编辑用户' : '新增用户',
      body: `<form id="userForm" style="display:grid;gap:12px;">
        <div class="form-item"><label>昵称 *</label>
          <input type="text" data-field="name" placeholder="用户昵称" value="${u ? esc(u.name) : ''}">
        </div>
        <div class="form-item"><label>邮箱 *${isEdit ? '（唯一标识，不可修改）' : ''}</label>
          <input type="email" data-field="email" placeholder="user@example.com" value="${u ? esc(u.email) : ''}" ${isEdit ? 'disabled' : ''}>
        </div>
        <div class="form-item"><label>密码 *${isEdit ? '（留空则不修改）' : ''}</label>
          <input type="password" data-field="pass" placeholder="${isEdit ? '留空保持原密码' : '至少 6 位'}" ${isEdit ? '' : 'required'}>
        </div>
        <div class="form-item"><label>角色</label>
          <select data-field="isAdmin" ${isSuper || isAdminAcc ? 'disabled' : ''}>
            <option value="false" ${u && !u.isAdmin ? 'selected' : ''}>普通用户</option>
            <option value="true"  ${u && u.isAdmin  ? 'selected' : ''}>管理员</option>
          </select>
        </div>
        <div class="form-item"><label>状态</label>
          <select data-field="enabled" ${isSuper ? 'disabled' : ''}>
            <option value="true"  ${!u || u.enabled ? 'selected' : ''}>启用</option>
            <option value="false" ${u && !u.enabled ? 'selected' : ''}>禁用</option>
          </select>
        </div>
      </form>`,
      size: 'sm',
      footer: `<button class="btn btn-ghost" onclick="Utils.closeModal()">取消</button>
        <button class="btn btn-primary" onclick="AdminMod.saveUser()">${isEdit ? '保存修改' : '创建用户'}</button>`,
    });
  }

  function saveUser() {
    const form = document.getElementById('userForm');
    if (!form) return;
    const f = Utils.collectForm(form);
    const isEdit = !!editEmail;
    const em = (f.email || '').trim().toLowerCase();
    if (!f.name || !String(f.name).trim()) { Utils.toast('请填写昵称', 'warn'); return; }
    if (!isEdit) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { Utils.toast('邮箱格式不正确', 'warn'); return; }
      if (!f.pass || f.pass.length < 6) { Utils.toast('密码至少 6 位', 'warn'); return; }
    } else if (f.pass && f.pass.length < 6) {
      Utils.toast('密码至少 6 位', 'warn'); return;
    }
    const isSuper = isEdit && String(editEmail).toLowerCase() === SUPER_ADMIN;
    const payload = {
      email: isEdit ? editEmail : em,
      name: String(f.name).trim(),
      isAdmin: isSuper ? true : f.isAdmin === 'true',
      enabled: isSuper ? true : f.enabled !== 'false',
    };
    if (f.pass) payload.pass = f.pass;
    const action = isEdit ? api('admin/users', payload, 'PUT') : api('admin/users', payload, 'POST');
    action.then(r => {
      if (!r.ok) { Utils.toast(r.err || '保存失败', 'danger'); return; }
      Utils.closeModal();
      editEmail = null;
      Utils.toast(isEdit ? '用户已更新' : '用户已创建', 'success');
      renderUsers(document.getElementById('adminPane'));
    });
  }

  // 启用 / 禁用
  function toggleUser(email, enabled) {
    if (!enabled && String(email).toLowerCase() === SUPER_ADMIN) { Utils.toast('默认管理员账号不可禁用', 'warn'); return; }
    api('admin/users', { email, enabled }, 'PUT').then(r => {
      if (!r.ok) { Utils.toast(r.err || '操作失败', 'danger'); return; }
      Utils.toast(enabled ? '已启用该账号' : '已禁用该账号', 'success');
      renderUsers(document.getElementById('adminPane'));
    });
  }

  // 删除用户
  function deleteUser(email) {
    Utils.openModal({ title: '确认删除用户？', body: `
      <p style="font-size:13px;">将永久删除用户 <strong>${esc(email)}</strong> 及其云端数据快照与登录会话，此操作不可恢复。</p>`, size: 'sm',
      footer: `<button class="btn btn-ghost" onclick="Utils.closeModal()">取消</button>
        <button class="btn btn-danger" onclick="AdminMod.doDeleteUser('${esc(email)}')">确认删除</button>` });
  }
  function doDeleteUser(email) {
    if (String(email).toLowerCase() === SUPER_ADMIN) { Utils.toast('默认管理员账号不可删除', 'warn'); return; }
    api('admin/users', { email }, 'DELETE').then(r => {
      Utils.closeModal();
      if (!r.ok) { Utils.toast(r.err || '删除失败', 'danger'); return; }
      Utils.toast('用户已删除', 'success');
      renderUsers(document.getElementById('adminPane'));
    });
  }

  // 全选 / 取消全选（超级管理员与当前登录账号勾选框已禁用，不参与）
  function toggleSelectAll(el) {
    document.querySelectorAll('#userTableBox .user-sel:not(:disabled)').forEach(c => c.checked = el.checked);
  }

  // 批量删除：收集勾选邮箱 → 确认弹窗 → 逐个调用删除接口（复用服务端全部保护逻辑）
  function batchDelete() {
    const sels = [...document.querySelectorAll('#userTableBox .user-sel:checked')].map(c => c.dataset.email);
    if (!sels.length) { Utils.toast('请先勾选要删除的用户', 'warn'); return; }
    window._batchDel = sels;
    Utils.openModal({
      title: `确认删除选中的 ${sels.length} 个用户？`,
      body: `<p style="font-size:13px;">将永久删除以下用户及其云端数据快照与登录会话，此操作不可恢复：<br><strong>${sels.map(esc).join('、')}</strong></p>`,
      size: 'sm',
      footer: `<button class="btn btn-ghost" onclick="Utils.closeModal()">取消</button>
        <button class="btn btn-danger" onclick="AdminMod.doBatchDelete()">确认删除</button>` });
  }
  function doBatchDelete() {
    const sels = window._batchDel || [];
    window._batchDel = null;
    if (!sels.length) return;
    let done = 0, failed = 0;
    const next = i => {
      if (i >= sels.length) {
        Utils.closeModal();
        Utils.toast(failed ? `已删除 ${done} 个，失败 ${failed} 个` : `已删除 ${done} 个用户`, failed ? 'warn' : 'success');
        renderUsers(document.getElementById('adminPane'));
        return;
      }
      api('admin/users', { email: sels[i] }, 'DELETE').then(r => {
        if (r.ok) done++; else failed++;
        next(i + 1);
      });
    };
    next(0);
  }

  // ==================== ② 访问日志 ====================
  function statCard(icon, label, value, sub, color) {
    return `<div class="stat-card ${color || ''}"><div class="stat-icon">${icon}</div>
      <div class="stat-label">${label}</div><div class="stat-value">${value}</div>
      ${sub ? `<div class="stat-sub">${sub}</div>` : ''}</div>`;
  }

  function rangeHTML() {
    const items = [['all','全部'],['day','天'],['week','周'],['month','月']];
    return `<div class="range-seg">
      <span class="range-label">时间范围：</span>
      ${items.map(([v, t]) => `<button class="range-btn ${range === v ? 'on' : ''}" onclick="AdminMod.setRange('${v}')">${t}</button>`).join('')}
    </div>`;
  }

  // 中国地图：省份按登录次数高亮 + 城市散点（气泡=次数），可缩放、点击省份下钻城市
  function chinaMapHTML(byCity, byProv, rangeText) {
    // 聚合省份数据：优先用服务端 IP 归属地省份（全称），再按城市表兜底
    const provMap = {};
    const hasProv = byProv && Object.keys(byProv).length;
    if (hasProv) {
      Object.entries(byProv).forEach(([p, n]) => { if (p) provMap[p] = (provMap[p] || 0) + n; });
      Object.entries(byCity).forEach(([city, n]) => {
        const p = CITY_PROVINCE[city];
        if (p && !provMap[p]) provMap[p] = (provMap[p] || 0) + n; // 兜底未覆盖到的省份
      });
    } else {
      // 兼容旧服务端（无 byProv）：按城市表完整聚合
      Object.entries(byCity).forEach(([city, n]) => {
        const p = CITY_PROVINCE[city];
        if (p) provMap[p] = (provMap[p] || 0) + n;
      });
    }
    const provData = Object.entries(provMap).map(([name, value]) => ({ name, value }));
    const cityData = Object.entries(byCity).map(([city, n]) => ({ name: city, value: CITY_LL[city] ? [...CITY_LL[city], n] : null })).filter(d => d.value);
    const maxProv = Math.max(1, ...Object.values(provMap));
    const maxCity = Math.max(1, ...Object.values(byCity));

    const boxId = 'chinaMap' + Date.now();
    const backId = boxId + 'Back';
    const html = `
      <div class="card" style="padding:16px;grid-column:1/-1;">
        <div class="card-title" style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
          <span style="display:inline-flex;align-items:center;gap:8px;">${subIcon('M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0ZM12 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z')}区域登录分布 · 中国地图（${rangeText}）</span>
          <button id="${backId}" class="btn btn-ghost btn-xs" style="display:none;" onclick="AdminMod.mapBack()">${subIcon('M15 18l-6-6 6-6', 13)}返回全国</button>
        </div>
        <div id="${boxId}" style="width:100%;height:600px;"></div>
        <p style="font-size:12px;color:var(--text-4);margin-top:6px;">滚轮缩放 / 拖拽平移，点击省份可下钻至城市</p>
      </div>`;

    setTimeout(() => {
      const el = document.getElementById(boxId);
      if (!el) return;
      _mapBackBtn = document.getElementById(backId);
      // 加载 echarts（按需）与中国地图 geojson（本地缓存）
      const setup = geo => {
        if (geo) {
          try { echarts.registerMap('china', geo); _chinaGeo = geo; } catch(e) { console.warn('registerMap:', e); }
        }
        const chart = echarts.init(el);
        _mapChart = chart; _mapLevel = 'province';
        _provOption = provinceMapOption(provData, cityData, maxProv);
        chart.setOption(_provOption);
        chart.on('click', p => {
          if (p.seriesType !== 'map' || !p.name) return;
          if (_mapLevel === 'province') {
            const adcode = PROV_ADCODE[p.name];
            if (adcode) drillToProvince(chart, p.name, adcode, byCity);
            else Utils.toast(`${p.name}：${finiteVal(p.value)} 次登录`, 'info');
          } else {
            Utils.toast(`${p.name}：${finiteVal(p.value)} 次登录`, 'info');
          }
        });
      };
      Utils.ensureEcharts().then(() => {
        if (_chinaGeo) { setup(_chinaGeo); return; }
        fetch('js/vendor/china.json')
          .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
          .then(geo => setup(geo))
          .catch(() => setup(null)); // 地图数据加载失败：退化为空底图（仅散点）
      }).catch(() => {});
    }, 50);
    return html;
  }

  // ECharts map 系列对无数据区域的 value 为 NaN，统一转 0
  function finiteVal(v) { return Number.isFinite(v) ? v : 0; }

  // 省域层 option（省份高亮 + 城市散点，可缩放）
  function provinceMapOption(provData, cityData, maxProv) {
    return {
      tooltip: { backgroundColor: 'rgba(255,255,255,0.95)', borderColor: '#E8E8ED', textStyle: { color: '#1D1D1F', fontSize: 12 }, extraCssText: 'border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,0.12);' },
      visualMap: {
        min: 0, max: maxProv,
        left: 12, bottom: 8, text: ['高', '低'],
        textStyle: { color: '#6E6E73' },
        inRange: { color: ['#EAF2FF', '#BBD6FF', '#0071E3'] },
        calculable: true,
      },
      series: [
        { // 省份高亮层
          id: 'province', type: 'map', map: 'china', roam: true, zoom: 1.0, layoutCenter: ['50%', '50%'], layoutSize: '98%', scaleLimit: { min: 1, max: 8 },
          label: { show: false },
          itemStyle: { areaColor: '#F0F2F5', borderColor: '#FFFFFF', borderWidth: 1 },
          emphasis: { label: { show: true, color: '#1D1D1F', fontSize: 12 }, itemStyle: { areaColor: '#2997FF' } },
          select: { disabled: true },
          data: provData,
          tooltip: { formatter: p => p.name + '<br/>登录次数：<b>' + finiteVal(p.value) + '</b>' },
        },
        { // 城市散点层
          id: 'cityScatter', type: 'scatter', coordinateSystem: 'geo', zlevel: 3,
          data: cityData,
          symbolSize: v => 6 + Math.sqrt(v[2]) * 7,
          itemStyle: { color: '#FF9F0A', borderColor: '#FFFFFF', borderWidth: 1.5, shadowBlur: 8, shadowColor: 'rgba(255,159,10,0.45)' },
          label: { show: false },
          emphasis: { label: { show: true, formatter: p => p.name + ' · ' + p.value[2] + ' 次', color: '#1D1D1F', fontSize: 12, position: 'top' } },
          tooltip: { formatter: p => p.name + '（' + (CITY_PROVINCE[p.name] || '') + '）<br/>登录次数：<b>' + p.value[2] + '</b>' },
        },
      ],
    };
  }

  // 城市层 option（下钻省份后的城市高亮）
  function cityMapOption(geoName, cityData, maxCity) {
    return {
      tooltip: { backgroundColor: 'rgba(255,255,255,0.95)', borderColor: '#E8E8ED', textStyle: { color: '#1D1D1F', fontSize: 12 }, extraCssText: 'border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,0.12);' },
      visualMap: {
        min: 0, max: maxCity,
        left: 12, bottom: 8, text: ['高', '低'],
        textStyle: { color: '#6E6E73' },
        inRange: { color: ['#EAF2FF', '#BBD6FF', '#0071E3'] },
        calculable: true,
      },
      series: [{
        id: 'city', type: 'map', map: geoName, roam: true, zoom: 1.05, scaleLimit: { min: 1, max: 8 },
        label: { show: false },
        itemStyle: { areaColor: '#F0F2F5', borderColor: '#FFFFFF', borderWidth: 1 },
        emphasis: { label: { show: true, color: '#1D1D1F', fontSize: 12 }, itemStyle: { areaColor: '#2997FF' } },
        data: cityData,
        tooltip: { formatter: p => p.name + '<br/>登录次数：<b>' + finiteVal(p.value) + '</b>' },
      }],
    };
  }

  // 点击省份下钻：加载该省（含下级市）geojson，切换为城市层地图
  function drillToProvince(chart, provName, adcode, byCity) {
    Utils.toast('正在加载 ' + provName + ' 城市数据…', 'info');
    const geoName = 'drill_' + adcode;
    const done = geo => {
      try { echarts.registerMap(geoName, geo); } catch(e) { console.warn('registerMap drill:', e); }
      // 城市名规范化（去掉“市/地区/自治州/盟”等后缀）后与日志数据匹配
      const norm = n => String(n).replace(/(市|地区|自治州|盟)$/, '');
      const cityData = [];
      geo.features.forEach(f => {
        const n = byCity[norm(f.properties.name)] || 0;
        if (n > 0) cityData.push({ name: f.properties.name, value: n });
      });
      // 直辖市：日志记的是“北京/上海/天津/重庆”，挂在“市辖区”上
      const muni = { '北京市':'北京', '上海市':'上海', '天津市':'天津', '重庆市':'重庆' };
      if (muni[provName] && byCity[muni[provName]]) {
        const f = geo.features.find(x => x.properties.name === '市辖区');
        if (f) {
          const i = cityData.findIndex(c => c.name === '市辖区');
          if (i >= 0) cityData[i].value += byCity[muni[provName]];
          else cityData.push({ name: '市辖区', value: byCity[muni[provName]] });
        }
      }
      const maxCity = Math.max(1, ...cityData.map(d => d.value));
      chart.setOption(cityMapOption(geoName, cityData, maxCity), true);
      _mapLevel = 'city';
      if (_mapBackBtn) _mapBackBtn.style.display = '';
    };
    if (_provGeoCache[adcode]) { done(_provGeoCache[adcode]); return; }
    // 依次尝试多个数据源（v3 主源 → v2 备用），任一失败自动切换，避免单源故障导致下钻失败
    const sources = [
      'https://geo.datav.aliyun.com/areas_v3/bound/' + adcode + '_full.json',
      'https://geo.datav.aliyun.com/areas_v2/bound/' + adcode + '_full.json',
    ];
    const loadGeo = i => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 10000);
      return fetch(sources[i], { signal: ctrl.signal })
        .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .finally(() => clearTimeout(timer));
    };
    const trySources = i => loadGeo(i)
      .then(geo => { _provGeoCache[adcode] = geo; done(geo); })
      .catch(() => (i + 1 < sources.length ? trySources(i + 1) : Promise.reject(new Error('all sources failed'))));
    trySources(0).catch(() => {
      // 离线降级：用本地 geojson 中的中心点放大到该省份区域
      const f = (_chinaGeo && _chinaGeo.features || []).find(x => x.properties.name === provName);
      if (f && f.properties.center) {
        chart.setOption({ series: [{ id: 'province', center: f.properties.center, zoom: 4.5 }] });
        Utils.toast('城市边界数据加载失败，已放大到 ' + provName, 'warn');
      } else {
        Utils.toast('城市边界数据加载失败', 'warn');
      }
    });
  }

  // 从城市层返回全国省域层
  function mapBack() {
    if (!_mapChart || _mapLevel !== 'city') return;
    if (_provOption) _mapChart.setOption(_provOption, true);
    _mapLevel = 'province';
    if (_mapBackBtn) _mapBackBtn.style.display = 'none';
  }

  // 条形统计（区域分布 / 每日活跃度）
  function barHTML(title, data, unit) {
    const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
    if (!entries.length) return `<div class="card"><div class="card-title">${title}</div><p class="empty">暂无数据</p></div>`;
    const max = Math.max(1, ...entries.map(e => e[1]));
    const rows = entries.slice(0, 14).map(([k, n]) => `
      <div class="bar-row"><span class="bar-label">${esc(k) || '未选择城市'}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${(n / max * 100).toFixed(1)}%"></div></div>
        <span class="bar-num">${n}${unit}</span>
      </div>`).join('');
    return `<div class="card" style="padding:16px;"><div class="card-title">${title}</div>
      <div class="bar-list">${rows}</div>
      ${entries.length > 14 ? `<p style="font-size:12px;color:var(--text-4);margin-top:6px;">仅显示前 14 项，共 ${entries.length} 项</p>` : ''}
    </div>`;
  }

  async function renderLogs(pane) {
    pane.innerHTML = `
      <div class="cards-grid" id="adminStats"><div class="card"><p style="color:var(--text-3);">正在加载统计数据...</p></div></div>
      <div id="rangeBox" style="margin-top:14px;">${rangeHTML()}</div>
      <div id="adminBody" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px;"></div>`;
    const r = await api('admin/stats?range=' + encodeURIComponent(range), null, 'GET');
    const statsBox = pane.querySelector('#adminStats');
    if (!r.ok) {
      statsBox.innerHTML = `<div class="card"><p style="color:var(--danger);">${esc(r.err || '加载失败')}</p></div>`;
      return;
    }
    const rangeText = { all: '累计', day: '近 1 天', week: '近 7 天', month: '近 30 天' }[range] || '累计';
    statsBox.innerHTML =
      statCard(subIcon('M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75', 22), '注册用户', r.usersTotal, '含管理员', 'blue') +
      statCard(subIcon('M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z', 22), '管理员', r.adminsTotal, '系统初始化账号', 'orange') +
      statCard(subIcon('M23 6l-9.5 9.5-5-5L1 18M17 6h6v6', 22), '累计访问', r.total, rangeText + '范围：' + r.inRange + ' 次', 'green') +
      statCard(subIcon('M13 2 3 14h9l-1 8 10-12h-9l1-8Z', 22), '今日访问', r.today, '按登录日志统计', 'red');
    const body = pane.querySelector('#adminBody');
    // 中国地图（省份高亮 + 城市散点）
    const mapHTML = chinaMapHTML(r.byCity || {}, r.byProv || {}, rangeText);
    // 区域分布 / 每日活跃度
    const distHTML = barHTML('区域访问分布（' + rangeText + '）', r.byCity || {}, ' 次');
    const actHTML = barHTML('每日登录活跃度（' + rangeText + '）', r.byDate || {}, ' 次');
    body.innerHTML = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;grid-column:1/-1;min-height:300px;">${distHTML}${actHTML}</div>${mapHTML}`;
  }

  function setRange(v) {
    range = v;
    renderSub('logs');
  }

  // ==================== ③ 配置清单 / ④ 数据处理 ====================
  function renderConfig(pane) {
    pane.innerHTML = SettingsMod.configHTML();
    SettingsMod.syncNotifyUI();
  }

  function renderData(pane) {
    pane.innerHTML = SettingsMod.dataHTML();
  }

  // ==================== ⑤ 额度管理（AI 对话额度 / 卡密 / 申请） ====================
  async function renderQuota(pane) {
    pane.innerHTML = `
      <div class="admin-bar">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <span style="font-size:13px;color:var(--text-2);">生成卡密</span>
          <input id="qCodeFace" type="number" min="1" placeholder="面额(次)" style="width:96px;height:32px;padding:0 10px;border:1px solid var(--border);border-radius:8px;font-size:13px;">
          <input id="qCodeCount" type="number" min="1" max="100" placeholder="数量" style="width:80px;height:32px;padding:0 10px;border:1px solid var(--border);border-radius:8px;font-size:13px;">
          <button class="btn btn-primary btn-sm" onclick="AdminMod.genCodes()">${subIcon('M12 5v14M5 12h14', 13)}生成</button>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="AdminMod.refreshQuota()">${subIcon('M4 4v5h5M20 20v-5h-5M5.1 9a7 7 0 0 1 12.4-2M18.9 15a7 7 0 0 1-12.4 2', 13)}刷新</button>
      </div>
      <div id="quotaBox"><div class="card"><p style="color:var(--text-3);padding:10px 0;">正在加载...</p></div></div>`;
    await refreshQuota();
  }

  // 加载额度 / 卡密 / 申请三类数据并渲染
  async function refreshQuota() {
    const box = document.getElementById('quotaBox');
    if (!box) return;
    box.innerHTML = `<div class="card"><p style="color:var(--text-3);padding:10px 0;">正在加载...</p></div>`;
    const [u, c, r] = await Promise.all([
      api('admin/quotas', null, 'GET'),
      api('admin/codes', null, 'GET'),
      api('admin/requests', null, 'GET'),
    ]);
    window._quotaUsers = (u.ok ? u.quotas : []) || [];
    window._quotaCodes = (c.ok ? c.codes : []) || [];
    window._quotaReqs = (r.ok ? r.requests : []) || [];
    box.innerHTML = quotaTable(window._quotaUsers) + reqTable(window._quotaReqs) + codeTable(window._quotaCodes);
  }

  // 用户额度表格
  function quotaTable(list) {
    const me = AuthMod.currentUser();
    const rows = list.map(u => {
      const remain = Math.max(0, (u.freeTotal || 0) + (u.extra || 0) - (u.used || 0));
      const tag = u.isAdmin ? '<span class="tag tag-primary">管理员</span>'
        : (u.enabled === false ? '<span class="tag tag-danger">禁用</span>' : '<span class="tag">普通用户</span>');
      return `<tr>
        <td><div style="font-weight:600;">${esc(u.name)}${me && me.email === u.email ? '<span class="user-badge">我</span>' : ''}</div></td>
        <td>${esc(u.email)}</td>
        <td>${tag}</td>
        <td class="num">${u.freeTotal}</td>
        <td class="num">${u.used}</td>
        <td class="num">${u.extra}</td>
        <td class="num" style="font-weight:700;color:${remain > 0 ? 'var(--success)' : 'var(--danger)'};">${remain}</td>
        <td style="white-space:nowrap;">
          <button class="btn btn-ghost btn-xs" onclick="AdminMod.adjQuota('${esc(u.email)}')">${subIcon('M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5Z', 13)}调整</button>
        </td>
      </tr>`;
    }).join('');
    return `<div class="card" style="padding:16px;">
      <div class="card-title">${subIcon('M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75')}用户额度（${list.length}）</div>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>昵称</th><th>邮箱</th><th>角色</th><th>免费</th><th>已用</th><th>充值</th><th>剩余</th><th>操作</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
    </div>`;
  }

  // 充值申请表格（仅展示待处理）
  function reqTable(list) {
    const pend = list.filter(x => x.status === 'pending');
    if (!pend.length) return '';
    const rows = pend.map(r => `<tr>
        <td>${esc(r.name)}</td>
        <td>${esc(r.email)}</td>
        <td>${esc(r.contact)}</td>
        <td class="num">${r.amount || 0}</td>
        <td style="max-width:180px;">${esc(r.note || '—')}</td>
        <td>${fmtTime(r.createdAt)}</td>
        <td style="white-space:nowrap;">
          <button class="btn btn-success btn-xs" onclick="AdminMod.handleRequest('${r.id}','approve')">通过</button>
          <button class="btn btn-danger btn-xs" onclick="AdminMod.handleRequest('${r.id}','reject')">驳回</button>
        </td>
      </tr>`).join('');
    return `<div class="card" style="padding:16px;">
      <div class="card-title">${subIcon('M3 6h18M3 12h18M3 18h12', 15)}充值申请（${pend.length} 待处理）</div>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>昵称</th><th>邮箱</th><th>联系方式</th><th>申请次数</th><th>备注</th><th>提交时间</th><th>操作</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
    </div>`;
  }

  // 卡密列表
  function codeTable(list) {
    const shown = list.slice(0, 50);
    const rows = shown.map(c => {
      const usedTag = c.usedBy
        ? `<span class="tag tag-danger" title="${esc(c.usedBy)}">已用</span>`
        : '<span class="tag tag-success">未用</span>';
      return `<tr>
        <td style="font-family:var(--font-num);user-select:all;">${esc(c.code)}</td>
        <td class="num">${c.face}</td>
        <td>${usedTag}</td>
        <td>${c.usedBy ? esc(c.usedBy) : '—'}</td>
        <td>${fmtTime(c.createdAt)}</td>
      </tr>`;
    }).join('');
    return `<div class="card" style="padding:16px;">
      <div class="card-title">${subIcon('M4 4h16v16H4z', 15)}兑换卡密（共 ${list.length}${list.length > 50 ? '，显示最近 50 张' : ''}）</div>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>兑换码</th><th>面额</th><th>状态</th><th>使用者</th><th>生成时间</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
    </div>`;
  }

  // 调整用户额度（增量，可正可负）
  function adjQuota(email) {
    const u = (window._quotaUsers || []).find(x => x.email === email);
    if (!u) return;
    Utils.openModal({
      title: '调整额度',
      body: `<div class="form-item"><label>用户</label><input disabled value="${esc(u.email)}"></div>
        <div class="form-item"><label>当前余额</label><input disabled value="${Math.max(0, (u.freeTotal || 0) + (u.extra || 0) - (u.used || 0))} 次（免费 ${u.freeTotal} / 已用 ${u.used} / 充值 ${u.extra}）"></div>
        <div class="form-item"><label>调整次数（+ 增加 / - 扣减）*</label>
          <input id="adjDelta" type="number" placeholder="如 50 或 -10"></div>`,
      footer: `<button class="btn btn-ghost" onclick="Utils.closeModal()">取消</button>
        <button class="btn btn-primary" id="adjOkBtn">确认调整</button>`,
      onOpen: () => {
        document.getElementById('adjOkBtn').onclick = async () => {
          const d = parseInt(document.getElementById('adjDelta').value, 10);
          if (isNaN(d) || d === 0) return Utils.toast('请输入非零次数', 'warn');
          const r = await api('admin/quotas', { email, delta: d }, 'PUT');
          if (r.ok) { Utils.closeModal(); Utils.toast('额度已调整', 'success'); refreshQuota(); }
          else Utils.toast(r.err || '调整失败', 'error');
        };
      }
    });
  }

  // 批量生成卡密
  async function genCodes() {
    const face = parseInt(document.getElementById('qCodeFace').value, 10);
    const count = Math.min(Math.max(parseInt(document.getElementById('qCodeCount').value, 10) || 1, 1), 100);
    if (!face || face <= 0) return Utils.toast('请填写面额（次数）', 'warn');
    const r = await api('admin/codes', { face, count }, 'POST');
    if (!r.ok) return Utils.toast(r.err || '生成失败', 'error');
    Utils.toast(`已生成 ${r.codes.length} 张卡密`, 'success');
    Utils.openModal({
      title: '生成的卡密',
      body: `<div style="max-height:300px;overflow:auto;display:grid;gap:6px;">
        ${r.codes.map(cd => `<div style="background:var(--bg-soft);border:1px solid var(--border-light);border-radius:8px;padding:8px 10px;font-family:var(--font-num);font-size:13px;user-select:all;">${esc(cd)}</div>`).join('')}
      </div>
      <p style="font-size:12px;color:var(--text-2);margin-top:8px;">一次性使用，兑换后自动增加对应次数，请妥善保管。</p>`,
      footer: `<button class="btn btn-primary" onclick="Utils.closeModal()">已记录</button>`
    });
    refreshQuota();
  }

  // 审批充值申请：approve 通过（可选到账次数）/ reject 驳回
  function handleRequest(id, action) {
    const rq = (window._quotaReqs || []).find(x => x.id === id) || {};
    if (action === 'approve') {
      Utils.openModal({
        title: '通过申请',
        body: `<div class="form-item"><label>用户</label><input disabled value="${esc(rq.email || '')}（${esc(rq.name || '')}）"></div>
          <div class="form-item"><label>申请次数</label><input disabled value="${rq.amount || 0} 次"></div>
          <div class="form-item"><label>到账次数 *</label><input id="apAmount" type="number" value="${rq.amount || 0}"></div>`,
        footer: `<button class="btn btn-ghost" onclick="Utils.closeModal()">取消</button>
          <button class="btn btn-success" id="apOkBtn">通过并到账</button>`,
        onOpen: () => {
          document.getElementById('apOkBtn').onclick = async () => {
            const amount = parseInt(document.getElementById('apAmount').value, 10);
            if (!amount || amount <= 0) return Utils.toast('请输入到账次数', 'warn');
            const r = await api('admin/requests', { id, action: 'approve', amount }, 'POST');
            if (r.ok) { Utils.closeModal(); Utils.toast('已通过并到账', 'success'); refreshQuota(); }
            else Utils.toast(r.err || '操作失败', 'error');
          };
        }
      });
      return;
    }
    Utils.openModal({
      title: '驳回申请',
      body: `<p style="font-size:13px;color:var(--text-2);">确认驳回该充值申请？</p>`,
      footer: `<button class="btn btn-ghost" onclick="Utils.closeModal()">取消</button>
        <button class="btn btn-danger" id="rjOkBtn">确认驳回</button>`,
      onOpen: () => {
        document.getElementById('rjOkBtn').onclick = async () => {
          const r = await api('admin/requests', { id, action: 'reject' }, 'POST');
          if (r.ok) { Utils.closeModal(); Utils.toast('已驳回', 'success'); refreshQuota(); }
          else Utils.toast(r.err || '操作失败', 'error');
        };
      }
    });
  }

  // ==================== 主渲染（五个子模块） ====================
  const TITLES = { users: '用户管理', logs: '访问日志', config: '配置清单', data: '数据处理', quota: '额度管理' };
  const DESCS = {
    users:  '注册用户列表 · 新增 / 编辑 / 删除 · 启用与禁用',
    logs:   '注册用户统计 · 区域分布与登录活跃度 · 中国地图',
    config: '通知与偏好 · 联网 API 配置（管理员维护，全员共享）',
    data:   '数据备份与恢复 · 导出与初始化',
    quota:  'AI 对话额度 · 用户额度调整 · 生成兑换卡密 · 审批充值申请',
  };

  async function render(sub) {
    curSub = sub || 'users';
    const meta = SUB_NAV.find(([k]) => k === curSub) || SUB_NAV[0];
    App.setContent(`
      <div class="page-header">
        <div>
          <h2><span class="emoji">${subIcon(meta[2], 22)}</span>${TITLES[curSub]}</h2>
          <p class="page-desc">${DESCS[curSub]}</p>
        </div>
      </div>
      <div id="adminPane"></div>
    `);
    await renderSub(curSub);
  }

  async function renderSub(sub) {
    curSub = sub;
    const pane = document.getElementById('adminPane');
    if (!pane) return;
    if (sub === 'users') await renderUsers(pane);
    else if (sub === 'logs') await renderLogs(pane);
    else if (sub === 'config') renderConfig(pane);
    else if (sub === 'quota') await renderQuota(pane);
    else renderData(pane);
  }

  return { render, setRange, mapBack, openUserModal, saveUser, toggleUser, deleteUser, doDeleteUser,
           toggleSelectAll, batchDelete, doBatchDelete,
           refreshQuota, adjQuota, genCodes, handleRequest };
})();
