/* ============================================
   账号系统 · 对接后端（零依赖 Node 服务）
   注册 / 登录 / 退出 / 会话管理
   用户与数据存于服务端 data/db/，支持换设备访问
   ============================================ */
window.AuthMod = (function() {
  const SESSION_KEY = 'house_hunter_session';
  const TOKEN_KEY   = 'house_hunter_token';

  function api(path, body) {
    return fetch('/api/' + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : '{}',
    }).then(r => r.json()).catch(() => ({ ok: false, err: '无法连接服务器，请确认已用 node server.js 启动' }));
  }

  function emailOk(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }
  function currentUser() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }
    catch(e) { return null; }
  }
  function isLoggedIn() { return !!currentUser(); }
  function isAdmin() { return !!currentUser()?.isAdmin; }
  function getToken() { return localStorage.getItem(TOKEN_KEY) || ''; }

  // 上报本次访问日志（携带城市；同一浏览器会话仅上报一次，由调用方控制）
  function logCity(city) {
    const t = getToken();
    if (!t) return;
    try {
      fetch('/api/log', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify({ city: city || '' }) });
    } catch(e) {}
  }

  // 登录成功后：保存会话、绑定默认城市并拉取云端数据
  // fallbackCity：注册场景下传入表单所选城市，服务端若未返回 city 也能立即绑定
  async function establish(r, fallbackCity) {
    localStorage.setItem(TOKEN_KEY, r.token);
    localStorage.setItem(SESSION_KEY, JSON.stringify({ email: r.user.email, name: r.user.name, isAdmin: !!r.user.isAdmin, avatar: r.user.avatar || '', loginAt: Date.now() }));
    // 账号切换隔离：先清空浏览器级共享业务键，再由云端快照恢复本账号数据（即使拉取失败也不会残留上一账号数据）
    if (window.SyncMod && typeof SyncMod.clearLocal === 'function') SyncMod.clearLocal();
    if (window.SyncMod) await SyncMod.syncAfterLogin();
    // 绑定城市：优先取服务端账号绑定城市，注册时回退到表单所选城市
    const city = r.user.city || fallbackCity;
    if (city && window.Store) Store.setCity(city);
    return { ok: true, user: r.user };
  }

  // 更新个人资料：昵称 / 头像 / 修改密码（改密成功后 token 会更换，需同步更新）
  async function updateProfile(payload) {
    const t = getToken();
    if (!t) return { ok: false, err: '未登录' };
    try {
      const r = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
        body: JSON.stringify(payload || {}),
      });
      const d = await r.json();
      if (!d.ok) return { ok: false, err: d.err || '保存失败' };
      const s = currentUser() || {};
      if (d.user) { s.name = d.user.name; s.avatar = d.user.avatar || ''; }
      if (d.token) localStorage.setItem(TOKEN_KEY, d.token);
      localStorage.setItem(SESSION_KEY, JSON.stringify(s));
      return { ok: true, user: d.user, changed: !!d.changed };
    } catch(e) { return { ok: false, err: '网络请求失败' }; }
  }

  // 预验证（不建立会话、不落盘）：登录校验邮箱已注册且密码正确；注册校验邮箱可用
  // 供登录/注册页在弹协议确认框之前先验证
  async function verify(email, pass, intent) {
    const r = await api('auth/verify', { email: (email || '').trim(), pass: pass || '', intent: intent || 'login' });
    return { ok: r.ok, err: r.err || '' };
  }

  async function register(name, email, pass, city) {
    const r = await api('auth/register', { name, email, pass, city: city || '' });
    if (!r.ok) return { ok: false, err: r.err || '注册失败' };
    // 新账号首次进入：清空浏览器中其他账号残留的本地缓存（本地数据键为浏览器级共享），确保从 0 开始；
    // 默认管理员的模拟数据仅存在于其账号云端快照，登录时按账号恢复
    if (window.Store) Store.clearAll();
    if (window.SyncMod && window.SyncMod.tsKey) {
      try { localStorage.removeItem(window.SyncMod.tsKey()); } catch(e) {}
    }
    return establish(r, city);
  }

  async function login(email, pass) {
    const r = await api('auth/login', { email, pass });
    if (!r.ok) return { ok: false, err: r.err || '登录失败' };
    return establish(r);
  }

  function logout() {
    const t = getToken();
    // 登出前先把防抖窗口内未上传的修改落盘到当前账号云端（不丢失数据）
    if (t && window.SyncMod && typeof SyncMod.pushNow === 'function') { try { SyncMod.pushNow(); } catch(e) {} }
    if (t) { try { fetch('/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) }); } catch(e) {} }
    if (window.SyncMod) SyncMod.logout();
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(SESSION_KEY);
    // 数据隔离：清空浏览器级共享的业务键，防止同浏览器下一账号看到本账号残留数据
    if (window.SyncMod && typeof SyncMod.clearLocal === 'function') SyncMod.clearLocal();
  }

  return { register, login, logout, updateProfile, isLoggedIn, currentUser, isAdmin, emailOk, getToken, logCity, verify };
})();
