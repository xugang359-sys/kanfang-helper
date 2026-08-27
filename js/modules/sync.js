/* ============================================
   数据同步层 · 对接后端零依赖服务
   快照上传（防抖 1.5s）/ 登录拉取合并（取新不覆盖旧）
   离线降级：后端不可用时本地照常使用
   ============================================ */
window.SyncMod = (function() {
  const PREFIX = 'house_hunter_';
  const KEYS = ['expectation', 'records', 'plans', 'settings', 'workflow', 'favorites', 'notifications'];
  const TS_KEY = PREFIX + 'last_snapshot_ts';
  let timer = null;

  // 按账号隔离同步时间戳：共享浏览器内跨账号比较时间戳会互相覆盖云端，故以账号邮箱区分
  function tsKey() {
    try {
      const s = JSON.parse(localStorage.getItem(PREFIX + 'session') || 'null');
      return (s && s.email) ? (PREFIX + 'last_snapshot_ts_' + s.email) : TS_KEY;
    } catch(e) { return TS_KEY; }
  }

  function getToken() { return localStorage.getItem(PREFIX + 'token') || ''; }
  function api(path, body, method) {
    const t = getToken();
    return fetch('/api/' + path, {
      method: method || (body ? 'PUT' : 'GET'),
      headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    }).then(r => r.json()).catch(() => ({ ok: false, off: true }));
  }

  // 收集本地全部用户数据为快照
  function collect() {
    const data = {};
    KEYS.forEach(k => {
      const v = localStorage.getItem(PREFIX + k);
      if (v != null) { try { data[k] = JSON.parse(v); } catch(e) {} }
    });
    return data;
  }
  // 用云端快照完整对齐本地：先清空全部业务键再写入云端数据（云端缺键即本地清空），
  // 保证切换账号后本地绝不残留上一账号的数据
  function apply(data) {
    KEYS.forEach(k => localStorage.removeItem(PREFIX + k));
    if (!data || Object.keys(data).length === 0) return; // 空快照视为云端已清空
    KEYS.forEach(k => { if (k in data) localStorage.setItem(PREFIX + k, JSON.stringify(data[k])); });
  }
  function hasLocal() { return KEYS.some(k => localStorage.getItem(PREFIX + k) != null); }
  function localTs() { return +localStorage.getItem(tsKey()) || 0; }
  // 清空浏览器级共享的业务数据（账号切换隔离用；不触发上传）
  function clearLocal() { KEYS.forEach(k => localStorage.removeItem(PREFIX + k)); }

  // 立即上传本地快照
  async function pushNow() {
    const t = getToken();
    if (!t) return { ok: false };
    const savedAt = Date.now();
    localStorage.setItem(tsKey(), savedAt);
    const r = await api('sync', { savedAt, data: collect() }, 'PUT');
    return r.ok ? { ok: true } : { ok: false, off: !!r.off };
  }

  // 数据变更后防抖上传
  function markChanged() {
    localStorage.setItem(tsKey(), Date.now());
    clearTimeout(timer);
    timer = setTimeout(() => pushNow(), 1500);
  }

  // 登录后与云端对齐：取新不覆盖旧
  async function syncAfterLogin() {
    const t = getToken();
    if (!t) return;
    const res = await api('sync', null, 'GET');
    if (!res.ok) {
      if (res.off && window.Utils) Utils.toast('后端未连接，数据不会跨设备同步', 'warn');
      return;
    }
    const local = localTs(), cloud = res.savedAt || 0;
    if (res.empty) {
      // 云端无快照：本地若无本账号数据则清空防残留；本地确有数据（换设备未同步过）则上传
      if (local > 0 && hasLocal()) { await pushNow(); }
      else { apply({}); }
      return;
    }
    if (cloud >= local) { apply(res.data); localStorage.setItem(tsKey(), cloud); } // 云端新/相等 → 覆盖本地
    else { await pushNow(); }                             // 本地新 → 上传云端
  }

  // 登出：停止上传
  function logout() { clearTimeout(timer); }

  /* ========== 全局 API 配置（管理员维护，全员共享） ========== */
  // 后端 config 键 → 本地 localStorage 键 映射
  const CFG_MAP = { amapJs: 'k_amap_js', amapSrv: 'k_amap_srv', newsApi: 'k_news_api' };
  function cfgToLocal(config) {
    if (!config) return;
    Object.entries(CFG_MAP).forEach(([ck, lk]) => {
      if (config[ck]) localStorage.setItem(lk, String(config[ck]));
    });
  }
  function localToCfg() {
    const cfg = {};
    Object.entries(CFG_MAP).forEach(([ck, lk]) => {
      const v = localStorage.getItem(lk);
      if (v) cfg[ck] = v;
    });
    return cfg;
  }
  // 登录后拉取全局配置并写入本地（普通用户也能使用管理员配置的 Key）
  async function loadConfig() {
    const t = getToken();
    if (!t) return;
    const r = await api('config', null, 'GET');
    if (r.ok) cfgToLocal(r.config);
  }
  // 管理员保存全局配置
  async function saveConfig() {
    const t = getToken();
    if (!t) return { ok: false };
    const r = await api('config', { config: localToCfg() }, 'PUT');
    return r.ok ? { ok: true } : { ok: false, err: r.err };
  }

  return { syncAfterLogin, markChanged, pushNow, logout, getToken, loadConfig, saveConfig, tsKey, api, clearLocal };
})();
