/* ============================================
   看房助手 · 零依赖后端服务器
   静态服务 + 用户注册/登录 + 数据快照同步（JSON 文件存储）
   用法：node server.js [--port 8080]
   无需安装任何 npm 包（仅用 Node 内置 http/fs/crypto）
   数据目录：data/db/（users.json 用户表 / tokens.json 会话 / snapshots/ 数据快照）
   ============================================ */
const http   = require('http');
const https  = require('https');
const fs     = require('fs');
const path   = require('path');
const os     = require('os');
const crypto = require('crypto');
const { exec } = require('child_process');
const zlib    = require('zlib');

const DEFAULT_PORT = 8080;
const ROOT = __dirname;
const DB_DIR     = path.join(ROOT, 'data', 'db');
const USERS_FILE = path.join(DB_DIR, 'users.json');
const TOKENS_FILE = path.join(DB_DIR, 'tokens.json');
const SNAP_DIR   = path.join(DB_DIR, 'snapshots');
const LOGINS_FILE = path.join(DB_DIR, 'logins.json');    // 登录/访问日志
const CONFIG_FILE = path.join(DB_DIR, 'config.json');    // 全局 API 配置（管理员维护，全员共享）
const QUOTAS_FILE = path.join(DB_DIR, 'quotas.json');    // 用户 AI 对话额度
const CODES_FILE  = path.join(DB_DIR, 'codes.json');     // 充值卡密（兑换码）
const REQS_FILE   = path.join(DB_DIR, 'recharge_requests.json'); // 人工充值申请
const SCANS_FILE  = path.join(DB_DIR, 'scans.json');             // 扫码登录票据（桌面签发，手机领取）

/* ---------- 文件存储工具 ---------- */
function readJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch(e) { return fallback; }
}
function writeJSON(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}
const users  = () => readJSON(USERS_FILE, {});
const saveUsers  = u => writeJSON(USERS_FILE, u);
const tokens = () => readJSON(TOKENS_FILE, {});
const saveTokens = t => writeJSON(TOKENS_FILE, t);
const snapFile = email => path.join(SNAP_DIR, Buffer.from(email).toString('base64url') + '.json');
const readSnapshot  = email => readJSON(snapFile(email), null);
const writeSnapshot = (email, snap) => writeJSON(snapFile(email), snap);
const logins = () => readJSON(LOGINS_FILE, []);
const saveLogins = l => writeJSON(LOGINS_FILE, l);
const readConfig  = () => readJSON(CONFIG_FILE, {});
const writeConfig = c => writeJSON(CONFIG_FILE, c);
const quotas = () => readJSON(QUOTAS_FILE, {});
const saveQuotas = q => writeJSON(QUOTAS_FILE, q);
const codes  = () => readJSON(CODES_FILE, {});
const saveCodes = c => writeJSON(CODES_FILE, c);
const reqs   = () => readJSON(REQS_FILE, []);
const saveReqs = r => writeJSON(REQS_FILE, r);
const scans  = () => readJSON(SCANS_FILE, {});
const saveScans = s => writeJSON(SCANS_FILE, s);
const isAdminEmail = em => !!(users()[em] || {}).isAdmin;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const hashPass = (pass, salt) => crypto.scryptSync(String(pass), salt, 64).toString('hex');
const newToken = () => crypto.randomBytes(24).toString('hex');
const genId    = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/* ---------- AI 对话额度（免费 + 充值；管理员不受限） ---------- */
const FREE_QUOTA = 20; // 新注册用户免费对话次数
function quotaOf(email) {
  const q = quotas()[email] || {};
  return { freeTotal: +q.freeTotal || FREE_QUOTA, used: +q.used || 0, extra: +q.extra || 0, updatedAt: q.updatedAt || 0 };
}
function quotaRemain(q) { return Math.max(0, q.freeTotal + q.extra - q.used); }
function saveQuota(email, q) {
  const all = quotas();
  all[email] = q;
  saveQuotas(all);
}
// 注册时初始化免费额度
function initQuota(email) {
  const all = quotas();
  if (!all[email]) all[email] = { freeTotal: FREE_QUOTA, used: 0, extra: 0, updatedAt: Date.now() };
  saveQuotas(all);
}
// 生成 16 位卡密（去掉易混淆字符 I/O/0/1）
function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 16; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s.slice(0, 4) + '-' + s.slice(4, 8) + '-' + s.slice(8, 12) + '-' + s.slice(12, 16);
}

/* ---------- IP 归属地查询（免费接口，仅公网 IP；内网/失败时返回空） ---------- */
// 兜底用城市→省份全称表（与前端 js/modules/admin.js 的 CITY_PROVINCE 保持一致）
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
const IP_CACHE = new Map();        // ip -> { city, province, ts }
const IP_CACHE_TTL = 3600 * 1000;  // 缓存 1 小时
const IP_TIMEOUT_MS = 4000;        // 单次查询超时
let _logWrite = Promise.resolve(); // 访问日志串行写入队列（避免异步并发互相覆盖）

// 取客户端 IP（支持反代透传）
function clientIP(req) {
  const xff = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return (xff || String(req.socket.remoteAddress || '')).replace(/^::ffff:/, '');
}
// 内网/回环地址无法按 IP 定位
function isPrivateIP(ip) {
  return !ip || /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.|::1$|localhost)/.test(ip);
}
// 城市名规范化：去“市/地区/自治州/盟/县”后缀；空则取省名简称（直辖市）
function normCity(prov, city) {
  const pro = String(prov || '').replace(/(省|市|自治区|特别行政区)$/, '');
  const c = String(city || '').replace(/(市|地区|自治州|盟|县)$/, '');
  return c || pro;
}
// 查询 IP 归属地（whois.pconline 免费接口，GBK 编码需解码），成功回调 (city, province 全称)
function fetchIpLocation(ip, cb) {
  const hit = IP_CACHE.get(ip);
  if (hit && Date.now() - hit.ts < IP_CACHE_TTL) { cb(hit.city, hit.province); return; }
  if (isPrivateIP(ip)) { cb('', ''); return; }
  const req = https.get('https://whois.pconline.com.cn/ipJson.jsp?ip=' + encodeURIComponent(ip) + '&json=true', r => {
    const buf = [];
    r.on('data', c => buf.push(c));
    r.on('end', () => {
      try {
        let txt;
        try { txt = new TextDecoder('gbk').decode(Buffer.concat(buf)); }
        catch(e) { txt = Buffer.concat(buf).toString('utf8'); }
        const d = JSON.parse(txt.slice(txt.indexOf('{')));
        const city = normCity(d.pro, d.city);
        const province = String(d.pro || '');
        IP_CACHE.set(ip, { city, province, ts: Date.now() });
        cb(city, province);
      } catch(e) { cb('', ''); }
    });
  });
  req.setTimeout(IP_TIMEOUT_MS, () => { req.destroy(); cb('', ''); });
  req.on('error', () => cb('', ''));
}
// 追加一条访问日志（串行，避免并发读改写丢数据）
function appendLogin(entry) {
  _logWrite = _logWrite.then(() => {
    const l = logins();
    l.push(entry);
    saveLogins(l);
  }).catch(() => {});
}

/* ---------- API 路由 ---------- */
function apiRoute(req, res, url, body) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const j = (code, obj) => { res.writeHead(code); res.end(JSON.stringify(obj)); };
  const authEmail = () => {
    const h = req.headers['authorization'] || '';
    const t = h.startsWith('Bearer ') ? h.slice(7) : '';
    return tokens()[t] || null;
  };

  // 预验证（不签发 token、不落盘）：登录校验邮箱已注册且密码正确；注册校验邮箱可用
  // 供登录/注册页在弹协议确认框之前先验证，避免无谓弹窗
  if (url === '/api/auth/verify') {
    const { email, pass, intent } = body || {};
    const em = String(email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(em)) return j(400, { ok: false, err: '邮箱格式不正确' });
    const u = users()[em];
    if (intent === 'register') {
      if (u) return j(409, { ok: false, err: '该邮箱已注册，请直接登录' });
      return j(200, { ok: true, available: true });
    }
    // 默认按登录校验
    if (!u) return j(404, { ok: false, err: '该邮箱尚未注册' });
    if (u.enabled === false) return j(403, { ok: false, err: '该账号已被禁用，请联系管理员' });
    if (hashPass(pass || '', u.salt) !== u.passHash) return j(401, { ok: false, err: '密码错误' });
    return j(200, { ok: true, valid: true });
  }

  // 注册：昵称 + 邮箱 + 密码 + 所在城市 → 创建账号并签发 token（城市绑定为账号默认城市）
  if (url === '/api/auth/register') {
    const { name, email, pass, city } = body || {};
    if (!name || !String(name).trim()) return j(400, { ok: false, err: '请填写昵称' });
    const em = String(email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(em)) return j(400, { ok: false, err: '邮箱格式不正确' });
    if (!pass || String(pass).length < 6) return j(400, { ok: false, err: '密码至少 6 位' });
    const us = users();
    if (us[em]) return j(409, { ok: false, err: '该邮箱已注册，请直接登录' });
    const salt = crypto.randomBytes(16).toString('hex');
    // 新注册用户一律为普通用户（管理员由系统初始化创建，见 ensureDefaultAdmin）
    us[em] = { name: String(name).trim(), email: em, salt, passHash: hashPass(pass, salt), isAdmin: false, enabled: true, createdAt: Date.now(), city: String(city || '').trim() };
    saveUsers(us);
    initQuota(em); // 新用户赠送免费对话额度
    const token = newToken();
    const tk = tokens(); tk[token] = em; saveTokens(tk);
    return j(200, { ok: true, token, user: { name: us[em].name, email: em, isAdmin: false, avatar: '', city: us[em].city || '' } });
  }

  // 登录：校验密码并签发新 token
  if (url === '/api/auth/login') {
    const { email, pass } = body || {};
    const em = String(email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(em)) return j(400, { ok: false, err: '邮箱格式不正确' });
    const u = users()[em];
    if (!u) return j(404, { ok: false, err: '该邮箱尚未注册' });
    if (u.enabled === false) return j(403, { ok: false, err: '该账号已被禁用，请联系管理员' });
    if (hashPass(pass || '', u.salt) !== u.passHash) return j(401, { ok: false, err: '密码错误' });
    const token = newToken();
    const tk = tokens(); tk[token] = em; saveTokens(tk);
    return j(200, { ok: true, token, user: { name: u.name, email: em, isAdmin: !!u.isAdmin, avatar: u.avatar || '', city: u.city || '' } });
  }

  // 登出：吊销该用户全部会话 token
  if (url === '/api/auth/logout') {
    const em = authEmail();
    if (em) {
      const tk = tokens();
      for (const k in tk) if (tk[k] === em) delete tk[k];
      saveTokens(tk);
    }
    return j(200, { ok: true });
  }

  // 扫码用手机访问（电脑端登录后签发票据 → 手机扫码进入移动版同步账号 → 电脑端轮询状态）
  // 票据 10 分钟有效，创建时顺带清理过期票据
  const SCAN_TTL = 10 * 60 * 1000;
  if (url === '/api/scan/create' && req.method === 'POST') {
    const em = authEmail();
    if (!em) return j(401, { ok: false, err: '登录状态已失效，请先在电脑端登录后重新生成' });
    const sc = scans();
    const now = Date.now();
    for (const k in sc) if (now - sc[k].createdAt > SCAN_TTL) delete sc[k];
    const ticket = newToken();
    sc[ticket] = { email: em, status: 'pending', createdAt: now };
    saveScans(sc);
    return j(200, { ok: true, ticket });
  }

  if (url === '/api/scan/status' && req.method === 'GET') {
    const ticket = new URLSearchParams(String(req.url.split('?')[1] || '')).get('ticket') || '';
    const rec = scans()[ticket];
    if (!rec) return j(404, { ok: false, err: '二维码已过期，请重新获取' });
    return j(200, { ok: true, status: rec.status, email: rec.email });
  }

  if (url === '/api/scan/claim' && req.method === 'POST') {
    const { ticket } = body || {};
    const sc = scans();
    const rec = sc[ticket];
    if (!rec) return j(404, { ok: false, err: '二维码已失效，请重新获取' });
    if (rec.status === 'claimed') return j(409, { ok: false, err: '该二维码已被使用' });
    const u = users()[rec.email];
    if (!u) return j(404, { ok: false, err: '账号不存在' });
    rec.status = 'claimed';
    rec.claimedAt = Date.now();
    saveScans(sc);
    const token = newToken();
    const tk = tokens(); tk[token] = rec.email; saveTokens(tk);
    return j(200, { ok: true, token, user: { name: u.name, email: u.email, isAdmin: !!u.isAdmin, avatar: u.avatar || '' } });
  }

  // 局域网可达地址：桌面通过 localhost 访问时，二维码需要指向局域网 IP，
  // 否则手机扫码后会打开手机自身的 localhost 而无法访问引导页
  if (url === '/api/net/ip' && req.method === 'GET') {
    const nets = os.networkInterfaces();
    let host = '';
    for (const k in nets) for (const n of nets[k]) if (n.family === 'IPv4' && !n.internal) { host = n.address; break; }
    if (!host) return j(404, { ok: false, err: '未检测到局域网地址，请改用局域网 IP 访问门户' });
    return j(200, { ok: true, host });
  }

  // 拉取数据快照
  if (url === '/api/sync' && req.method === 'GET') {
    const em = authEmail();
    if (!em) return j(401, { ok: false, err: '未登录' });
    const snap = readSnapshot(em);
    if (!snap || !snap.data) return j(200, { ok: true, empty: true });
    return j(200, { ok: true, savedAt: snap.savedAt, data: snap.data });
  }

  // 保存数据快照
  if (url === '/api/sync' && req.method === 'PUT') {
    const em = authEmail();
    if (!em) return j(401, { ok: false, err: '未登录' });
    const { savedAt, data } = body || {};
    if (!data || typeof data !== 'object') return j(400, { ok: false, err: '快照格式错误' });
    const ts = +savedAt || Date.now();
    writeSnapshot(em, { savedAt: ts, data });
    return j(200, { ok: true, savedAt: ts });
  }

  // 上报访问/登录日志（用于区域登录统计；同一浏览器会话只上报一次，由前端控制）
  // 城市优先取 IP 归属地（公网 IP），内网/查询失败时回退客户端所选城市
  if (url === '/api/log' && req.method === 'POST') {
    const em = authEmail();
    if (!em) return j(401, { ok: false, err: '未登录' });
    const { city } = body || {};
    const u = users()[em];
    const c = String(city || '');
    const entry = { email: em, name: u ? u.name : em, city: c, province: CITY_PROVINCE[c] || '', date: new Date().toISOString().slice(0, 10), ts: Date.now() };
    fetchIpLocation(clientIP(req), (ipCity, ipProvince) => {
      if (ipCity) entry.city = ipCity;
      if (ipProvince) entry.province = ipProvince;
      appendLogin(entry);
    });
    return j(200, { ok: true });
  }

  // ========== 管理后台（仅管理员） ==========
  const needAdmin = () => {
    const em = authEmail();
    if (!em) return { err: '未登录', code: 401 };
    if (!isAdminEmail(em)) return { err: '无权限，仅管理员可访问', code: 403 };
    return { em };
  };
  // 最近登录时间（按日志 ts 取最大）
  const lastLoginBy = logs => {
    const m = {};
    logs.forEach(l => { if (!m[l.email] || l.ts > m[l.email]) m[l.email] = l.ts; });
    return m;
  };

  // 用户列表（仅管理员）
  if (url === '/api/admin/users' && req.method === 'GET') {
    const au = needAdmin();
    if (au.err) return j(au.code, { ok: false, err: au.err });
    const last = lastLoginBy(logins());
    const userList = Object.values(users()).map(u => ({
      name: u.name, email: u.email, isAdmin: !!u.isAdmin, enabled: u.enabled !== false, createdAt: u.createdAt, lastLogin: last[u.email] || null,
    }));
    return j(200, { ok: true, users: userList });
  }

  // 新增用户（仅管理员）：昵称 + 邮箱 + 密码 + 角色/状态
  if (url === '/api/admin/users' && req.method === 'POST') {
    const au = needAdmin();
    if (au.err) return j(au.code, { ok: false, err: au.err });
    const { name, email, pass, isAdmin, enabled } = body || {};
    if (!name || !String(name).trim()) return j(400, { ok: false, err: '请填写昵称' });
    const em = String(email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(em)) return j(400, { ok: false, err: '邮箱格式不正确' });
    if (!pass || String(pass).length < 6) return j(400, { ok: false, err: '密码至少 6 位' });
    const us = users();
    if (us[em]) return j(409, { ok: false, err: '该邮箱已存在' });
    const salt = crypto.randomBytes(16).toString('hex');
    us[em] = { name: String(name).trim(), email: em, salt, passHash: hashPass(pass, salt), isAdmin: !!isAdmin, enabled: enabled !== false, createdAt: Date.now() };
    saveUsers(us);
    return j(200, { ok: true, email: em });
  }

  // 编辑用户（仅管理员）：可改昵称 / 角色 / 状态 / 重置密码（邮箱为唯一标识，不可改）
  if (url === '/api/admin/users' && req.method === 'PUT') {
    const au = needAdmin();
    if (au.err) return j(au.code, { ok: false, err: au.err });
    const { email, name, pass, isAdmin, enabled } = body || {};
    const em = String(email || '').trim().toLowerCase();
    const us = users();
    const u = us[em];
    if (!u) return j(404, { ok: false, err: '用户不存在' });
    // 自我保护：不能移除自己的管理员角色、不能禁用自己
    if (em === au.em) {
      if (isAdmin === false) return j(400, { ok: false, err: '不能移除自己的管理员角色' });
      if (enabled === false) return j(400, { ok: false, err: '不能禁用当前登录账号' });
    }
    // 默认管理员账号保护：不可移除管理员角色、不可禁用
    if (em === 'admin@example.com') {
      if (isAdmin === false) return j(400, { ok: false, err: '默认管理员账号不可移除管理员角色' });
      if (enabled === false) return j(400, { ok: false, err: '默认管理员账号不可禁用' });
    }
    if (name !== undefined && String(name).trim()) u.name = String(name).trim();
    if (isAdmin === true) u.isAdmin = true;
    else if (isAdmin === false) u.isAdmin = false;
    if (enabled !== undefined) u.enabled = !!enabled;
    if (pass) {
      if (String(pass).length < 6) return j(400, { ok: false, err: '密码至少 6 位' });
      const salt = crypto.randomBytes(16).toString('hex');
      u.salt = salt; u.passHash = hashPass(pass, salt);
    }
    saveUsers(us);
    return j(200, { ok: true });
  }

  // 删除用户（仅管理员）：禁止删除自己 / 最后一个管理员
  if (url === '/api/admin/users' && req.method === 'DELETE') {
    const au = needAdmin();
    if (au.err) return j(au.code, { ok: false, err: au.err });
    const em = String((body || {}).email || '').trim().toLowerCase();
    if (!em) return j(400, { ok: false, err: '缺少邮箱' });
    if (em === au.em) return j(400, { ok: false, err: '不能删除当前登录账号' });
    if (em === 'admin@example.com') return j(400, { ok: false, err: '默认管理员账号不可删除' });
    const us = users();
    const u = us[em];
    if (!u) return j(404, { ok: false, err: '用户不存在' });
    const adminCount = Object.values(us).filter(x => x.isAdmin).length;
    if (u.isAdmin && adminCount <= 1) return j(400, { ok: false, err: '至少保留一名管理员' });
    delete us[em];
    saveUsers(us);
    // 清理会话与快照
    const tk = tokens();
    for (const k in tk) if (tk[k] === em) delete tk[k];
    saveTokens(tk);
    try { fs.unlinkSync(snapFile(em)); } catch(e) {}
    return j(200, { ok: true });
  }

  // 访问日志统计（仅管理员）：range = all|day|week|month 过滤时间范围
  if (url === '/api/admin/stats') {
    const au = needAdmin();
    if (au.err) return j(au.code, { ok: false, err: au.err });
    const q = new URLSearchParams(String(req.url.split('?')[1] || ''));
    const range = ['all', 'day', 'week', 'month'].includes(q.get('range')) ? q.get('range') : 'all';
    const logs = logins();
    const now = Date.now();
    const DAY = 86400000;
    const cut = range === 'day' ? now - DAY : range === 'week' ? now - 7 * DAY : range === 'month' ? now - 30 * DAY : 0;
    const filtered = range === 'all' ? logs : logs.filter(l => l.ts >= cut);
    const byCity = {}, byDate = {}, byProv = {};
    filtered.forEach(l => {
      byCity[l.city] = (byCity[l.city] || 0) + 1;
      byDate[l.date] = (byDate[l.date] || 0) + 1;
      const p = l.province || CITY_PROVINCE[l.city] || ''; // 省份：优先 IP 归属地，否则按城市兜底
      if (p) byProv[p] = (byProv[p] || 0) + 1;
    });
    const today = new Date().toISOString().slice(0, 10);
    const us = users();
    return j(200, {
      ok: true,
      range,
      usersTotal: Object.keys(us).length,
      adminsTotal: Object.values(us).filter(u => u.isAdmin).length,
      total: logs.length,        // 累计访问（全部）
      today: byDate[today] || (logs.filter(l => l.date === today).length), // 今日访问
      inRange: filtered.length,  // 当前范围访问数
      byCity, byProv, byDate,
    });
  }

  // 个人资料：修改昵称 / 头像 / 密码（登录用户）
  if (url === '/api/profile' && req.method === 'PUT') {
    const em = authEmail();
    if (!em) return j(401, { ok: false, err: '未登录' });
    const { name, avatar, oldPass, newPass } = body || {};
    const us = users();
    const u = us[em];
    if (!u) return j(404, { ok: false, err: '用户不存在' });
    if (name !== undefined && String(name).trim()) u.name = String(name).trim().slice(0, 20);
    if (avatar !== undefined) {
      if (avatar && String(avatar).length > 300000) return j(400, { ok: false, err: '头像图片过大（需小于 300KB）' });
      u.avatar = avatar || '';
    }
    if (newPass) {
      if (String(newPass).length < 6) return j(400, { ok: false, err: '新密码至少 6 位' });
      if (!oldPass || hashPass(oldPass, u.salt) !== u.passHash) return j(401, { ok: false, err: '原密码错误' });
      const salt = crypto.randomBytes(16).toString('hex');
      u.salt = salt; u.passHash = hashPass(newPass, salt);
      // 修改密码后吊销其它会话，保留当前并签发新 token
      const tk = tokens();
      for (const k in tk) if (tk[k] === em) delete tk[k];
      const ntk = newToken();
      tk[ntk] = em;
      saveTokens(tk);
      saveUsers(us);
      return j(200, { ok: true, changed: true, token: ntk, user: { name: u.name, email: em, isAdmin: !!u.isAdmin, avatar: u.avatar || '' } });
    }
    saveUsers(us);
    return j(200, { ok: true, user: { name: u.name, email: em, isAdmin: !!u.isAdmin, avatar: u.avatar || '' } });
  }

  // 全局 API 配置：读（登录用户） / 写（仅管理员）
  if (url === '/api/config' && req.method === 'GET') {
    const em = authEmail();
    if (!em) return j(401, { ok: false, err: '未登录' });
    // 全局配置全员下发：前端各功能（高德地图/新闻资讯/AI 大模型）均在浏览器端直连 API，依赖本地 Key，
    // 因此管理员在配置清单维护的 Key 需下发给所有登录账号，任何设备登录后即可统一应用
    return j(200, { ok: true, config: readConfig() });
  }
  if (url === '/api/config' && req.method === 'PUT') {
    const em = authEmail();
    if (!em) return j(401, { ok: false, err: '未登录' });
    if (!isAdminEmail(em)) return j(403, { ok: false, err: '无权限，仅管理员可配置' });
    writeConfig((body && body.config) || {});
    return j(200, { ok: true });
  }

  // ========== AI 对话额度（登录用户） ==========
  // 查询我的额度
  if (url === '/api/quota' && req.method === 'GET') {
    const em = authEmail();
    if (!em) return j(401, { ok: false, err: '未登录' });
    const q = quotaOf(em);
    return j(200, { ok: true, quota: { freeTotal: q.freeTotal, used: q.used, extra: q.extra, remain: quotaRemain(q), total: q.freeTotal + q.extra, unlimited: isAdminEmail(em) } });
  }

  // 卡密兑换（自助充值）
  if (url === '/api/quota/redeem' && req.method === 'POST') {
    const em = authEmail();
    if (!em) return j(401, { ok: false, err: '未登录' });
    const cd = String((body || {}).code || '').trim().toUpperCase();
    if (!cd) return j(400, { ok: false, err: '请输入兑换码' });
    const all = codes();
    const c = all[cd];
    if (!c) return j(404, { ok: false, err: '兑换码不存在或已失效' });
    if (c.usedBy) return j(409, { ok: false, err: '该兑换码已被使用' });
    c.usedBy = em;
    c.usedAt = Date.now();
    saveCodes(all);
    const q = quotaOf(em);
    q.extra += c.face;
    q.updatedAt = Date.now();
    saveQuota(em, q);
    return j(200, { ok: true, face: c.face, remain: quotaRemain(q) });
  }

  // 提交人工充值申请（无卡密时兜底）
  if (url === '/api/quota/request' && req.method === 'POST') {
    const em = authEmail();
    if (!em) return j(401, { ok: false, err: '未登录' });
    const contact = String((body || {}).contact || '').trim();
    const note = String((body || {}).note || '').trim();
    const amount = parseInt((body || {}).amount, 10);
    if (!contact) return j(400, { ok: false, err: '请填写联系方式（微信 / 支付宝 / 手机号）' });
    const list = reqs();
    list.push({ id: genId(), email: em, name: (users()[em] || {}).name || em, contact, note, amount: isNaN(amount) || amount <= 0 ? 0 : amount, status: 'pending', createdAt: Date.now(), handledAt: null });
    saveReqs(list);
    return j(200, { ok: true });
  }

  // ========== 额度管理（仅管理员） ==========
  // 用户额度列表
  if (url === '/api/admin/quotas' && req.method === 'GET') {
    const au = needAdmin();
    if (au.err) return j(au.code, { ok: false, err: au.err });
    const us = users();
    const list = Object.keys(us).map(email => {
      const q = quotaOf(email);
      return { email, name: us[email].name || email, isAdmin: !!us[email].isAdmin, enabled: us[email].enabled !== false, freeTotal: q.freeTotal, used: q.used, extra: q.extra, remain: quotaRemain(q), updatedAt: q.updatedAt };
    }).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    return j(200, { ok: true, quotas: list });
  }

  // 手动调整额度（delta 为次数增量，可正可负）
  if (url === '/api/admin/quotas' && req.method === 'PUT') {
    const au = needAdmin();
    if (au.err) return j(au.code, { ok: false, err: au.err });
    const { email, delta } = body || {};
    const em = String(email || '').trim().toLowerCase();
    const d = parseInt(delta, 10);
    if (!em || !users()[em]) return j(404, { ok: false, err: '用户不存在' });
    if (isNaN(d) || d === 0) return j(400, { ok: false, err: '调整次数无效' });
    const q = quotaOf(em);
    q.extra = Math.max(0, q.extra + d);
    if (q.used > q.freeTotal + q.extra) q.used = q.freeTotal + q.extra; // 负调整不使剩余为负
    q.updatedAt = Date.now();
    saveQuota(em, q);
    return j(200, { ok: true, remain: quotaRemain(q) });
  }

  // 生成卡密（批量 + 面额）
  if (url === '/api/admin/codes' && req.method === 'POST') {
    const au = needAdmin();
    if (au.err) return j(au.code, { ok: false, err: au.err });
    const face = parseInt((body || {}).face, 10);
    const count = Math.min(Math.max(parseInt((body || {}).count, 10) || 1, 1), 100);
    if (isNaN(face) || face <= 0) return j(400, { ok: false, err: '面额无效' });
    const all = codes();
    const made = [];
    for (let i = 0; i < count; i++) {
      let cd = genCode();
      let guard = 0;
      while (all[cd] && guard++ < 50) cd = genCode();
      all[cd] = { face, usedBy: null, usedAt: null, createdAt: Date.now() };
      made.push(cd);
    }
    saveCodes(all);
    return j(200, { ok: true, codes: made });
  }

  // 卡密列表
  if (url === '/api/admin/codes' && req.method === 'GET') {
    const au = needAdmin();
    if (au.err) return j(au.code, { ok: false, err: au.err });
    const all = codes();
    const list = Object.keys(all).map(code => ({ code, face: all[code].face, usedBy: all[code].usedBy, usedAt: all[code].usedAt, createdAt: all[code].createdAt })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return j(200, { ok: true, codes: list });
  }

  // 充值申请列表
  if (url === '/api/admin/requests' && req.method === 'GET') {
    const au = needAdmin();
    if (au.err) return j(au.code, { ok: false, err: au.err });
    return j(200, { ok: true, requests: reqs().slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)) });
  }

  // 审批申请：approve（通过，可按申请或填写次数加额）/ reject（驳回）
  if (url === '/api/admin/requests' && req.method === 'POST') {
    const au = needAdmin();
    if (au.err) return j(au.code, { ok: false, err: au.err });
    const { id, action, amount } = body || {};
    const list = reqs();
    const r = list.find(x => x.id === id);
    if (!r) return j(404, { ok: false, err: '申请不存在' });
    if (action === 'approve') {
      r.status = 'done';
      r.handledAt = Date.now();
      const amt = parseInt(amount, 10);
      if (!isNaN(amt) && amt > 0) {
        const q = quotaOf(r.email);
        q.extra += amt;
        q.updatedAt = Date.now();
        saveQuota(r.email, q);
      }
    } else if (action === 'reject') {
      r.status = 'rejected';
      r.handledAt = Date.now();
    } else {
      return j(400, { ok: false, err: '操作无效' });
    }
    saveReqs(list);
    return j(200, { ok: true });
  }

  // ========== AI 大模型代理（trae: 前缀的 Key 走后端，避免前端暴露） ==========
  if (url === '/api/llm/chat') {
    const em = authEmail();
    if (!em) return j(401, { ok: false, err: '未登录，请先登录后再使用 AI 对话' });
    const { messages, model, key: bodyKey } = body || {};
    if (!messages || !Array.isArray(messages) || !messages.length) return j(400, { ok: false, err: '缺少消息内容' });
    const isAdmin = isAdminEmail(em);
    // 普通用户：先校验额度（扣减放在 AI 成功回复后，失败不扣）
    if (!isAdmin) {
      const q = quotaOf(em);
      if (quotaRemain(q) <= 0) return j(200, { ok: false, code: 'QUOTA_EXCEEDED', err: 'AI 对话额度已用完，请先充值（兑换码 / 联系管理员）' });
    }
    // 优先使用前端本次填写的 Key（管理员测试用），否则读取全局配置（管理员统一维护）；普通用户强制使用全局配置
    const cfg = readConfig();
    const raw = String((isAdmin && bodyKey ? bodyKey : cfg.llm) || '').trim();
    // 解析平台前缀（与前端 parseLLMConfig 保持一致）：trae: / openai: / deepseek: / glm:，无前缀默认 openai
    const pi = raw.indexOf(':');
    let provider = 'openai', key = raw;
    if (pi > 0 && /^[a-z]+$/i.test(raw.slice(0, pi))) {
      provider = raw.slice(0, pi).toLowerCase();
      key = raw.slice(pi + 1);
    }
    key = String(key).trim();
    if (!key) return j(200, { ok: false, err: '未配置 AI 大模型 API Key（系统管理 → 配置清单中维护）' });
    // 模型名：优先前端传入（管理员测试），否则取全局配置 llmModel，再否则按平台默认
    const modelName = String(model || cfg.llmModel || '').trim() || (provider === 'trae' ? 'trae-gpt-4o' : 'gpt-4o-mini');
    const payload = JSON.stringify({
      model: modelName,
      messages,
      temperature: 0.7,
      max_tokens: 2000,
    });
    let done = false;
    const finish = (code, obj) => { if (!done) { done = true; j(code, obj); } };
    // 各平台 OpenAI 兼容转发端点（按 key 前缀路由，管理员配置任意平台 key 全员可用）
    const UPSTREAM = {
      'trae':     { host: 'api.trae.cn',      path: '/v1/chat/completions' },
      'openai':   { host: 'api.openai.com',   path: '/v1/chat/completions' },
      'deepseek': { host: 'api.deepseek.com', path: '/v1/chat/completions' },
      'glm':      { host: 'open.bigmodel.cn', path: '/api/paas/v4/chat/completions' },
    }[provider] || { host: 'api.openai.com', path: '/v1/chat/completions' };
    const up = https.request({
      hostname: UPSTREAM.host,
      method: 'POST',
      path: UPSTREAM.path,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + key,
        'Content-Length': Buffer.byteLength(payload),
      },
    }, r => {
      const buf = [];
      r.on('data', c => buf.push(c));
      r.on('end', () => {
        try {
          const data = JSON.parse(Buffer.concat(buf).toString('utf8'));
          const reply = data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : '';
          if (reply) {
            // 普通用户：AI 成功回复后扣减 1 次额度
            if (!isAdmin) {
              const q = quotaOf(em);
              q.used += 1;
              q.updatedAt = Date.now();
              saveQuota(em, q);
            }
            return finish(200, { ok: true, reply });
          }
          return finish(200, { ok: false, err: (data.error && (data.error.message || data.error.type)) || data.message || 'AI 返回异常' });
        } catch(e) {
          return finish(200, { ok: false, err: 'AI 响应解析失败' });
        }
      });
    });
    up.setTimeout(30000, () => { up.destroy(); finish(200, { ok: false, err: 'AI 请求超时（30秒），请稍后重试' }); });
    up.on('error', e => finish(200, { ok: false, err: 'AI 服务连接失败：' + (e.message || e) }));
    up.write(payload);
    up.end();
    return;
  }

  j(404, { ok: false, err: '接口不存在' });
}

/* ---------- 静态服务 ---------- */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico':  'image/x-icon',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
  '.pdf':  'application/pdf',
  '.csv':  'text/csv; charset=utf-8',
  '.ttf':  'font/ttf',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.mp4':  'video/mp4',
};

/* ---------- gzip 压缩（加速海外/弱网下的静态资源加载） ---------- */
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.svg', '.csv', '.ttf', '.woff']);
const gzipCache = new Map(); // key: 路径+修改时间 -> 压缩后 Buffer
function gzipIfWorth(filePath, data) {
  try {
    const key = filePath + ':' + fs.statSync(filePath).mtimeMs;
    let buf = gzipCache.get(key);
    if (!buf) {
      buf = zlib.gzipSync(data, { level: 6 });
      if (buf.length >= data.length) return null; // 压缩无收益则不缓存
      if (gzipCache.size > 200) gzipCache.clear();
      gzipCache.set(key, buf);
    }
    return buf;
  } catch(e) { return null; }
}

function openBrowser(url) {
  const cmd = process.platform === 'win32' ? 'start'
            : process.platform === 'darwin' ? 'open'
            : 'xdg-open';
  try { exec(`${cmd} "" "${url}"`); } catch(e) {}
}

function tryListen(port) {
  const server = http.createServer((req, res) => {
    try {
      const url = decodeURIComponent(req.url.split('?')[0]);

      // API 请求：收集 body 后路由
      if (url.startsWith('/api/')) {
        const buf = [];
        req.on('data', c => buf.push(c));
        req.on('end', () => {
          let body = null;
          try {
            const raw = Buffer.concat(buf).toString('utf8').trim();
            if (raw) body = JSON.parse(raw);
          } catch(e) { body = null; }
          apiRoute(req, res, url, body);
        });
        return;
      }

      // 静态文件（根路径默认打开门户页）
      const f = (url === '/' || url === '') ? '/portal.html' : url;
      const filePath = path.normalize(path.join(ROOT, f));
      if (!filePath.startsWith(ROOT)) { res.writeHead(403, {'Content-Type':'text/plain; charset=utf-8'}); res.end('403 Forbidden'); return; }
      fs.readFile(filePath, (err, data) => {
        if (err) {
          if (err.code === 'ENOENT') {
            res.writeHead(404, {'Content-Type':'text/html; charset=utf-8'});
            res.end(`<!DOCTYPE html><meta charset="utf-8"><title>404</title>
              <body style="font-family:Microsoft YaHei,sans-serif;padding:40px;text-align:center;">
              <h2>404 - 文件不存在</h2>
              <p style="color:#888;">路径：${url}</p>
              <p><a href="/">返回首页</a></p></body>`);
          } else {
            res.writeHead(500); res.end('500 Server Error');
          }
        } else {
          const ext = path.extname(filePath).toLowerCase();
          const isHtml = ext === '.html';
          const stat = fs.statSync(filePath);
          // ETag：基于文件大小 + 修改时间（内容不变则不变）
          const etag = '"' + stat.size.toString(16) + '-' + Math.floor(stat.mtimeMs).toString(16) + '"';
          const headers = {
            'Content-Type': MIME[ext] || 'application/octet-stream',
            'ETag': etag,
            'Access-Control-Allow-Origin': '*',
            // 缓存策略：HTML 每次回源校验（内容变化即 304/200），静态资源一年强缓存。
            // 业务 JS/CSS 均带 ?v= 版本号，改动后 URL 变化自动绕过缓存；vendor 与图片等固定资源不常变，可安全长缓存
            'Cache-Control': isHtml ? 'no-cache' : 'public, max-age=31536000, immutable',
          };
          // HTML 条件请求：内容未变直接 304，省去重复下载 HTML
          if (isHtml && req.headers['if-none-match'] === etag) {
            res.writeHead(304, headers);
            res.end();
            return;
          }
          // gzip 压缩文本类资源，加速海外/弱网加载
          if (COMPRESSIBLE.has(ext) && (req.headers['accept-encoding'] || '').includes('gzip')) {
            const gz = gzipIfWorth(filePath, data);
            if (gz) {
              headers['Content-Encoding'] = 'gzip';
              res.writeHead(200, headers);
              res.end(gz);
              return;
            }
          }
          res.writeHead(200, headers);
          res.end(data);
        }
      });
    } catch(e) { res.writeHead(500); res.end('500'); }
  });

  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      console.log(`端口 ${port} 已被占用，尝试 ${port + 1} ...`);
      tryListen(port + 1);
    } else {
      console.error('服务器启动失败:', e.message);
      process.exit(1);
    }
  });

  server.listen(port, '0.0.0.0', () => {
    const localUrl = `http://localhost:${port}/`;
    const nets = os.networkInterfaces();
    const ips = [];
    for (const k in nets) nets[k].forEach(n => { if (n.family === 'IPv4' && !n.internal) ips.push(n.address); });
    console.log('\n========================================');
    console.log('  🏠 HOUSE HUNTER · 看房助手 后端启动成功！');
    console.log('========================================');
    console.log(`  本机访问：   ${localUrl}`);
    if (ips.length) console.log(`  换设备访问： http://${ips[0]}:${port}/ （同一局域网内）`);
    console.log(`  数据目录：   ${DB_DIR}`);
    console.log('  关闭窗口即可停止服务');
    console.log('========================================\n');
    setTimeout(() => openBrowser(localUrl), 500);
  });
}

/* ---------- 系统初始化：默认管理员 ----------
   与"首个注册即管理员"的旧逻辑解耦：
   服务启动时若不存在任何管理员，自动创建 admin@example.com / admin123 */
function ensureDefaultAdmin() {
  const us = users();
  if (Object.values(us).some(u => u.isAdmin)) return;
  const em = 'admin@example.com';
  if (!us[em]) {
    const salt = crypto.randomBytes(16).toString('hex');
    us[em] = { name: '系统管理员', email: em, salt, passHash: hashPass('admin123', salt), isAdmin: true, enabled: true, createdAt: Date.now() };
    saveUsers(us);
    console.log('[初始化] 已创建默认管理员账号：admin@example.com / admin123');
  }
}

const args = process.argv.slice(2);
const pi = args.indexOf('--port');
ensureDefaultAdmin(); // 启动时确保存在默认管理员
// 云平台部署适配：优先使用平台注入的 PORT 环境变量（Zeabur/Render/Railway 等），本地默认 8080
const envPort = parseInt(process.env.PORT, 10) || 0;
const port = pi > -1 ? (parseInt(args[pi + 1], 10) || envPort || DEFAULT_PORT)
                     : (envPort || DEFAULT_PORT);
tryListen(port);
