/* ============================================
   贝壳开放平台 API 封装
   文档：open.ke.com
   鉴权流程：AppKey + AppSecret → /oauth/token → access_token → 业务接口
   关键接口：
     - 成交案例库 assessTransactionCase（同小区历史成交）
     - 壳e估 assessEstimate（房屋估值）
   ============================================ */
window.BeikeMod = (function() {
  const DIRECT_BASE = 'https://gw-open.ke.com';
  // 每个接口提供两个地址：优先本地 server.js 代理（同源无 CORS），失败时回退直连
  const ENDPOINTS = {
    token:    ['/api/beike/oauth/token',            DIRECT_BASE + '/oauth/token'],
    dealCase: ['/api/beike/assessTransactionCase', DIRECT_BASE + '/api/assessTransactionCase'],
    estimate: ['/api/beike/assessEstimate',        DIRECT_BASE + '/api/assessEstimate'],
  };

  // 统一 POST 封装：依次尝试代理地址 → 直连地址
  async function _post(paths, { headers = {}, body }) {
    let lastErr = '';
    for (const p of paths) {
      try {
        const res = await fetch(p, { method: 'POST', headers, body });
        if (res.ok) return await res.json();
        // 非 2xx：若响应体是贝壳业务 JSON（含 code/msg/data），返回给上层判断，而非误判为网络失败
        const text = await res.text().catch(() => '');
        if (text) {
          try {
            const j = JSON.parse(text);
            if (j && (j.code !== undefined || j.msg || j.data)) return j;
          } catch (_e) { /* 非 JSON 响应，忽略 */ }
        }
        lastErr = 'HTTP ' + res.status;
      } catch (e) { lastErr = e.message || String(e); }
    }
    const err = new Error(lastErr);
    err.cors = /fetch|Failed/i.test(lastErr);
    throw err;
  }

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
      const data = await _post(ENDPOINTS.token, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=client_credentials&client_id=${encodeURIComponent(c.appKey)}&client_secret=${encodeURIComponent(c.appSecret)}`
      });
      if (data.code === 0 && data.data && data.data.access_token) {
        const token = data.data.access_token;
        const exp = Date.now() + (Number(data.data.expires_in) || 7200) * 1000;
        localStorage.setItem('k_beike_token', token);
        localStorage.setItem('k_beike_token_exp', String(exp));
        return { ok:true, token };
      }
      return { ok:false, err: data.data?.error || data.data?.message || data.msg || data.message || JSON.stringify(data).slice(0,200) };
    } catch(e) {
      return { ok:false, err:'网络错误：'+(e.message||e)+(e.cors?'（跨域被拦截，请使用 node server.js 启动以启用本地代理）':'') };
    }
  }

  // 获取可用 token：有就用，过期就刷新
  async function ensureToken() {
    if (hasValidToken()) return { ok:true, token: getConfig().token };
    return await fetchToken();
  }

  // 调用业务接口（统一鉴权头 + 错误处理）
  async function callAPI(ep, params) {
    const t = await ensureToken();
    if (!t.ok) return t;
    const paths = ENDPOINTS[ep];
    if (!paths) return { ok:false, err:'未知接口：'+ep };
    try {
      const body = Object.entries(params).map(([k,v]) =>
        `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
      const data = await _post(paths, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'access_token': t.token },
        body
      });
      // 兼容 code / errno 两种返回结构
      const bizCode = data.code !== undefined ? data.code : (data.errno !== undefined ? data.errno : 0);
      const bizMsg = data.msg || data.errmsg || data.message;
      // token 失效 → 自动刷新一次重试
      if (bizCode === -2000 || /token/i.test(bizMsg||'')) {
        localStorage.removeItem('k_beike_token');
        localStorage.removeItem('k_beike_token_exp');
        const t2 = await fetchToken();
        if (!t2.ok) return t2;
        const data2 = await _post(paths, {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'access_token': t2.token },
          body
        });
        return { ok:true, data: data2 };
      }
      // 业务错误码（如配额不足 -2001）不得当作成功返回
      if (bizCode !== 0) return { ok:false, err: bizMsg || ('接口错误 code=' + bizCode) };
      return { ok:true, data };
    } catch(e) {
      return { ok:false, err:'网络错误：'+(e.message||e) };
    }
  }

  // 成交案例库：输入地址+面积 → 返回 3 套近期同小区成交记录
  // 参数：city, address, buildArea, timePeriod=LAST_THREE_MONTH
  async function dealCases({ city='南京', address, buildArea, timePeriod='LAST_THREE_MONTH' }) {
    if (!address) return { ok:false, err:'缺少 address' };
    const r = await callAPI('dealCase', {
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
    const r = await callAPI('estimate', {
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
