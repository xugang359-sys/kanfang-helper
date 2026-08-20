/* ============================================
   贝壳开放平台 API 封装
   文档：open.ke.com
   鉴权流程：AppKey + AppSecret → /oauth/token → access_token → 业务接口
   关键接口：
     - 成交案例库 assessTransactionCase（同小区历史成交）
     - 壳e估 assessEstimate（房屋估值）
   ============================================ */
window.BeikeMod = (function() {
  const BASE = 'https://gw-open.ke.com';
  const TOKEN_URL = BASE + '/oauth/token';
  const DEAL_CASE_URL = BASE + '/api/assessTransactionCase';
  const ESTIMATE_URL = BASE + '/api/assessEstimate';

  // 读取本地配置
  function getConfig() {
    return {
      appKey:    (localStorage.getItem('k_beike_ak') || '').trim(),
      appSecret: (localStorage.getItem('k_beike_sk') || '').trim(),
      token:     (localStorage.getItem('k_beike_token') || '').trim(),
      tokenExp:  Number(localStorage.getItem('k_beike_token_exp') || 0)
    };
  }

  function isConfigured() {
    const c = getConfig();
    return !!(c.appKey && c.appSecret);
  }

  function hasValidToken() {
    const c = getConfig();
    return !!(c.token && c.tokenExp > Date.now() + 60_000); // 提前1分钟过期
  }

  // 获取/刷新 access_token（有效期通常 7200 秒）
  async function fetchToken() {
    const c = getConfig();
    if (!c.appKey || !c.appSecret) {
      return { ok:false, err:'未配置贝壳 AppKey/AppSecret' };
    }
    try {
      const res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=client_credentials&app_id=${encodeURIComponent(c.appKey)}&app_secret=${encodeURIComponent(c.appSecret)}`
      });
      const data = await res.json();
      if (data.code === 0 && data.data && data.data.access_token) {
        const token = data.data.access_token;
        const exp = Date.now() + (Number(data.data.expires_in) || 7200) * 1000;
        localStorage.setItem('k_beike_token', token);
        localStorage.setItem('k_beike_token_exp', String(exp));
        return { ok:true, token };
      }
      return { ok:false, err: data.msg || data.message || JSON.stringify(data).slice(0,200) };
    } catch(e) {
      return { ok:false, err:'网络错误：'+(e.message||e)+'（可能是CORS，建议通过server.js代理）' };
    }
  }

  // 获取可用 token：有就用，过期就刷新
  async function ensureToken() {
    if (hasValidToken()) return { ok:true, token: getConfig().token };
    return await fetchToken();
  }

  // 调用业务接口（统一鉴权头 + 错误处理）
  async function callAPI(url, params) {
    const t = await ensureToken();
    if (!t.ok) return t;
    try {
      const body = Object.entries(params).map(([k,v]) =>
        `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'access_token': t.token
        },
        body
      });
      const data = await res.json();
      // token 失效 → 自动刷新一次重试
      if (data.code === -2000 || /token/i.test(data.msg||'')) {
        localStorage.removeItem('k_beike_token');
        localStorage.removeItem('k_beike_token_exp');
        const t2 = await fetchToken();
        if (!t2.ok) return t2;
        const res2 = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'access_token': t2.token
          },
          body
        });
        return { ok:true, data: await res2.json() };
      }
      return { ok:true, data };
    } catch(e) {
      return { ok:false, err:'网络错误：'+(e.message||e) };
    }
  }

  // 成交案例库：输入地址+面积 → 返回 3 套近期同小区成交记录
  // 参数：city, address, buildArea, timePeriod=LAST_THREE_MONTH
  async function dealCases({ city='南京', address, buildArea, timePeriod='LAST_THREE_MONTH' }) {
    if (!address) return { ok:false, err:'缺少 address' };
    const r = await callAPI(DEAL_CASE_URL, {
      standCity: city,
      standDetailedAddress: address,
      standPriceAssessBuildArea: String(buildArea || 100),
      timePeriod
    });
    if (!r.ok) return r;
    const list = r.data?.data?.transactionItemListOut || r.data?.data?.transactionItems || [];
    return {
      ok: true,
      cases: list.map(c => ({
        resblockName: c.resblockName,
        frame: c.frame,
        buildSize: Number(c.buildSize) || null,
        unitPrice: Number(c.unitPrice) || null,
        transPrice: Number(c.transPrice) || null,
        listDays: c.listDays,
        transDate: c.transDate,
        buildYear: c.buildYear,
        hasElevator: c.isElevatorStr
      }))
    };
  }

  // 壳e估：输入地址+面积 → 返回估值
  async function estimate({ city='南京', address, buildArea }) {
    if (!address) return { ok:false, err:'缺少 address' };
    const r = await callAPI(ESTIMATE_URL, {
      standCity: city,
      standDetailedAddress: address,
      standPriceAssessBuildArea: String(buildArea || 100)
    });
    if (!r.ok) return r;
    const d = r.data?.data || {};
    return {
      ok: true,
      estimate: {
        totalPrice: d.assessPrice || d.totalPrice,
        unitPrice: d.assessUnitPrice || d.unitPrice,
        confidence: d.confidence || d.confidenceCoefficient
      }
    };
  }

  // 测试连接：在系统设置里点"测试"按钮时调用
  async function testConnection() {
    if (!isConfigured()) return { ok:false, err:'未配置 AppKey/AppSecret' };
    const r = await fetchToken();
    if (!r.ok) return r;
    return { ok:true, msg:'连接成功，已获取 access_token（有效期2小时）' };
  }

  return { getConfig, isConfigured, hasValidToken, fetchToken, dealCases, estimate, testConnection };
})();
