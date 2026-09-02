/* ============================================
   设置功能库 · 供"系统管理"下两个子模块复用
   配置清单：通知与偏好 + 联网 API 配置（configHTML）
   数据处理：数据备份与恢复（dataHTML）
   ============================================ */
window.SettingsMod = (function() {
  const ic = Utils.icon;   // SF Symbols 风格图标

  // ===== 配置清单片段：通知与偏好 + 联网 API 配置 =====
  function configHTML() {
    const s = Store.getSettings();
    const keys = Utils.getApiKeys();
    const st = Utils.apiStatus();
    const chip = a => `<div class="api-chip ${a.configured?'ok':'no'}" id="apiChip_${a.id}">${Utils.icon(a.icon,14)} ${a.label}<span>${a.configured?'已配置':'未配置'}</span></div>`;
    const tagCls = ok => 'tag tag-sm ' + (ok ? 'tag-success' : 'tag-danger');

    return `
      <div class="grid-2">
        <div class="card" style="grid-column:1/-1;">
          <div class="card-title">${ic('bell')} 通知与偏好</div>
          <div class="pref-grid">
            <div class="pref-row">
              <div class="pref-label">
                <span class="pref-icon">${ic('bell')}</span>
                <div><strong>看房计划提醒</strong><p>计划到期前通过浏览器通知推送提醒</p></div>
              </div>
              <div class="pref-control">
                <select id="s_notify" onchange="SettingsMod.saveNotify()">
                  <option value="true" ${s.enableNotification?'selected':''}>已开启</option>
                  <option value="false" ${!s.enableNotification?'selected':''}>已关闭</option>
                </select>
              </div>
            </div>
            <div class="pref-row">
              <div class="pref-label">
                <span class="pref-icon">${ic('clock')}</span>
                <div><strong>提前提醒天数</strong><p>在看房日期前多久开始提醒</p></div>
              </div>
              <div class="pref-control">
                <select id="s_days" onchange="SettingsMod.saveNotify()">
                  ${[1,2,3,5,7].map(d=>`<option ${s.remindBeforeDays===d?'selected':''}>${d}</option>`).join('')}
                </select>
              </div>
            </div>
          </div>
          <div class="pref-actions">
            <button class="btn btn-accent btn-sm" id="notifyPrefBtn" onclick="SettingsMod.toggleNotifyPref()">${s.enableNotification?ic('bellOff',15)+' 关闭提醒':ic('bell',15)+' 开启提醒'}</button>
            <button class="btn btn-success btn-sm" onclick="SettingsMod.checkRemindersUI()">${ic('bell',15)} 立即检查提醒</button>
          </div>
        </div>

        <div class="card" style="grid-column:1/-1;">
          <div class="card-title">${ic('globe')} 联网 API 配置</div>
          <div class="api-status-grid">${st.map(chip).join('')}</div>

          <div class="api-block">
            <div class="api-block-head">
              <div class="api-block-title"><span class="ico">${ic('map')}</span>高德地图</div>
              <span class="${tagCls(!!keys.amapSrv)}" id="amapKeyTag">${keys.amapSrv?'已配置':'未配置'}</span>
            </div>
            <p class="api-desc">区位分析（通勤 / 学区 / 周边配套 / 距离测算）依赖 Web 服务 Key；地图交互依赖 JS Key。申请地址：<a href="https://console.amap.com" target="_blank" style="color:var(--primary);">console.amap.com →</a></p>
            <div class="form-grid">
              <div class="form-item full"><label>Web 服务 Key（通勤 / 距离 / 静态地图）</label>
                <div class="key-row">
                  <input type="text" id="k_amap_srv" placeholder="创建「Web服务」类型 Key" value="${keys.amapSrv}">
                  <button class="btn btn-accent btn-sm" onclick="SettingsMod.testAmapSrv()">测试连接</button>
                </div>
              </div>
              <div class="form-item full"><label>Web端 JS Key（地图交互）</label>
                <div class="key-row">
                  <input type="text" id="k_amap_js" placeholder="创建「Web端(JS API)」类型 Key，需配置域名白名单" value="${keys.amapJs}">
                  <button class="btn btn-accent btn-sm" onclick="SettingsMod.testAmapJS()">测试连接</button>
                </div>
              </div>
            </div>
          </div>

          <div class="api-block">
            <div class="api-block-head">
              <div class="api-block-title"><span class="ico">${ic('news')}</span>新闻资讯</div>
              <span class="${tagCls(!!keys.news)}" id="newsKeyTag">${keys.news?'已配置':'未配置'}</span>
            </div>
            <p class="api-desc">用于「房产资讯」模块获取实时资讯。支持前缀：<code>tianapi:</code> 天行数据（免费100次/天）· <code>juhe:</code> 聚合数据 · 不填或填 <code>claw</code> 使用免费源 Claw Search（无需Key，实时性受该服务稳定性影响）。申请：<a href="https://www.tianapi.com" target="_blank" style="color:var(--primary);">tianapi.com →</a></p>
            <div class="form-item full"><label>API Key（可选）</label>
              <div class="key-row">
                <input type="text" id="k_news_api" placeholder="留空=Claw免费源 / tianapi:xxx / juhe:xxx" value="${keys.news}">
                <button class="btn btn-accent btn-sm" onclick="SettingsMod.testNewsKey()">测试连接</button>
              </div>
            </div>
            <div class="api-actions"><span class="api-test-msg" id="newsTestStatus"></span></div>
          </div>

          <div class="api-block">
            <div class="api-block-head">
              <div class="api-block-title"><span class="ico">${ic('sparkle')}</span>AI 大模型</div>
              <span class="${tagCls(!!keys.llm)}" id="llmKeyTag">${keys.llm?'已配置':'未配置'}</span>
            </div>
            <p class="api-desc">用于「AI购房助手」对话功能。支持前缀：<code>trae:</code> 走后端代理（推荐，Key不暴露）· <code>openai:</code> OpenAI · <code>deepseek:</code> 深度求索 · <code>glm:</code> 智谱清言。不填前缀默认 openai。申请：<a href="https://platform.openai.com/api-keys" target="_blank" style="color:var(--primary);">OpenAI →</a> · <a href="https://platform.deepseek.com" target="_blank" style="color:var(--primary);">DeepSeek →</a></p>
            <div class="form-grid">
              <div class="form-item full"><label>API Key（格式：trae:xxx 或 openai:sk-xxx）</label>
                <div class="key-row">
                  <input type="text" id="k_llm_api" placeholder="trae:xxx / openai:sk-xxx / deepseek:xxx / glm:xxx" value="${keys.llm}">
                  <button class="btn btn-accent btn-sm" onclick="SettingsMod.testLLM()">测试连接</button>
                </div>
              </div>
              <div class="form-item full"><label>模型名称（可选，留空用默认）</label>
                <input type="text" id="k_llm_model" placeholder="留空用默认 · deepseek-v4-flash / gpt-4o-mini / glm-4-flash" value="${keys.llmModel}">
              </div>
            </div>
            <div class="api-actions"><span class="api-test-msg" id="llmTestStatus"></span></div>
          </div>

          <div class="api-block">
            <div class="api-block-head">
              <div class="api-block-title"><span class="ico">${ic('mic')}</span>语音识别（讯飞）</div>
              <span class="${tagCls(Utils.apiConfigured('voice'))}" id="voiceKeyTag">${Utils.apiConfigured('voice')?'已配置':'未配置'}</span>
            </div>
            <p class="api-desc">用于「AI购房助手」的语音输入（国内直连，无需翻墙）。免费额度：讯飞开放平台语音听写每日 500 次（需实名认证）。申请：<a href="https://www.xfyun.cn/services/online_asr" target="_blank" style="color:var(--primary);">xfyun.cn →</a> 创建应用后开通「语音听写（流式版）」，获取 AppID / APIKey / APISecret。配置后，系统部署到云端 <strong>https 域名</strong>（或本机 localhost）时，Web 端与手机浏览器均可使用语音输入。</p>
            <div class="form-grid">
              <div class="form-item full"><label>AppID</label>
                <input type="text" id="k_xf_appid" placeholder="讯飞应用 AppID，如 5f2c1a9b" value="${keys.xfAppId}">
              </div>
              <div class="form-item full"><label>APIKey</label>
                <div class="key-row">
                  <input type="text" id="k_xf_apikey" placeholder="讯飞 APIKey" value="${keys.xfApiKey}">
                  <button class="btn btn-accent btn-sm" onclick="SettingsMod.testVoiceKey()">测试连接</button>
                </div>
              </div>
              <div class="form-item full"><label>APISecret</label>
                <input type="text" id="k_xf_apisecret" placeholder="讯飞 APISecret" value="${keys.xfApiSecret}">
              </div>
            </div>
            <div class="api-actions"><span class="api-test-msg" id="voiceTestStatus"></span></div>
          </div>

          <div style="display:flex;justify-content:flex-end;margin-top:6px;">
            <button class="btn btn-primary btn-sm" onclick="SettingsMod.saveKeys()">${ic('save',15)} 保存全部 API Key</button>
          </div>
          <div class="callout" style="margin-top:12px;">
            <div class="callout-title">${ic('bulb')} 说明</div>
            <p style="font-size:12px;">API Key 由管理员统一维护，保存后全局共享给所有注册用户（登录时自动同步）。未配置相应 API 时，对应模块会提示「前往配置」，不会使用本地模拟数据。</p>
          </div>
        </div>
      </div>
    `;
  }

  // ===== 数据处理片段：数据备份与恢复 =====
  function dataHTML() {
    const wf = Store.getWorkflow();
    const records = Store.getRecords();
    const plans = Store.getPlans();
    const dataSize = encodeURIComponent(JSON.stringify(localStorage)).length;
    return `
      <div class="grid-2">
        <div class="card" style="grid-column:1/-1;">
          <div class="card-title">${ic('save')} 数据备份与恢复</div>
          <div style="background:var(--primary-soft);padding:10px 12px;border-radius:8px;margin-bottom:12px;">
            <p style="font-size:12.5px;">当前已有：<strong>${records.length}</strong> 条房源记录 · <strong>${plans.length}</strong> 条看房计划 · <strong>${wf.steps.length}</strong> 步购房流程进度</p>
            <p style="font-size:12px;color:var(--text-3);">数据存储大小：约 ${(dataSize/1024).toFixed(1)} KB（本地 localStorage，随账号云端同步）</p>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <button class="btn btn-accent" onclick="WorkflowMod.exportExcel()">${ic('chart',15)} 导出房源CSV</button>
            <button class="btn btn-ghost" onclick="SettingsMod.exportCSVPlan()">${ic('list',15)} 导出看房计划CSV</button>
          </div>
          <div style="margin-top:14px;padding:10px;background:var(--danger-soft);border-radius:8px;">
            <h4 style="font-size:13px;color:var(--danger);margin-bottom:6px;">${ic('alert',13)} 危险操作</h4>
            <button class="btn btn-danger btn-sm" onclick="SettingsMod.resetAll()">${ic('trash',15)} 清空所有数据（恢复初始）</button>
          </div>
        </div>
      </div>
    `;
  }

  function refreshApiStatus() {
    const st = Utils.apiStatus();
    st.forEach(a => {
      const chip = document.getElementById('apiChip_' + a.id);
      if (!chip) return;
      chip.className = 'api-chip ' + (a.configured ? 'ok' : 'no');
      const sp = chip.querySelector('span');
      if (sp) sp.textContent = a.configured ? '已配置' : '未配置';
    });
    [['amapKeyTag','amap'],['newsKeyTag','news'],['llmKeyTag','llm'],['voiceKeyTag','voice']].forEach(([id, name]) => {
      const el = document.getElementById(id);
      if (!el) return;
      const ok = Utils.apiConfigured(name);
      el.textContent = ok ? '已配置' : '未配置';
      el.className = 'tag tag-sm ' + (ok ? 'tag-success' : 'tag-danger');
    });
  }

  // 语音识别（讯飞）配置校验：三要素齐全 + 可生成签名连接
  async function testVoiceKey() {
    ['k_xf_appid','k_xf_apikey','k_xf_apisecret'].forEach(k => {
      const v = document.getElementById(k)?.value?.trim() || '';
      if (v) localStorage.setItem(k, v); else localStorage.removeItem(k);
    });
    const status = document.getElementById('voiceTestStatus');
    if (status) { status.textContent = '正在校验配置...'; status.className = 'api-test-msg'; }
    try {
      if (!window.VoiceMod) throw new Error('语音模块未加载，请刷新页面');
      const msg = await VoiceMod.test();
      if (status) { status.textContent = msg; status.className = 'api-test-msg ok'; }
      refreshApiStatus();
      Utils.toast('讯飞语音配置有效','success');
    } catch(e) {
      const msg = e.message || '配置无效';
      if (status) { status.textContent = msg; status.className = 'api-test-msg err'; }
      Utils.toast('讯飞语音配置校验失败：' + msg, 'warn');
    }
  }

  // ===== 通知偏好 · 与开关/按钮双向联动 =====
  // 根据当前设置同步 select 与按钮文本
  function syncNotifyUI() {
    const s = Store.getSettings();
    const sel = document.getElementById('s_notify');
    if (sel) sel.value = String(s.enableNotification);
    const btn = document.getElementById('notifyPrefBtn');
    if (btn) btn.innerHTML = s.enableNotification ? ic('bellOff',13) + ' 关闭提醒' : ic('bell',13) + ' 开启提醒';
  }
  // "开启/关闭看房提醒"按钮：复用日历模块的切换逻辑，随后同步本地 UI
  function toggleNotifyPref() {
    CalendarMod.toggleNotify();
    syncNotifyUI();
  }
  // "立即检查提醒"：未开启时明确提示，避免静默无效果
  function checkRemindersUI() {
    const s = Store.getSettings();
    if (!s.enableNotification) { Utils.toast('看房提醒当前为关闭状态，请先开启后再检查','warn'); return; }
    CalendarMod.checkReminders();
    Utils.toast('已检查待看计划，符合条件的提醒已推送','success');
  }

  function saveNotify() {
    const en = document.getElementById('s_notify').value === 'true';
    const days = Number(document.getElementById('s_days').value);
    Store.saveSettings({ enableNotification: en, remindBeforeDays: days });
    syncNotifyUI();
    Utils.toast('已保存通知设置','success');
  }

  function saveKeys() {
    const keys = ['k_amap_js','k_amap_srv','k_news_api','k_llm_api','k_llm_model','k_xf_appid','k_xf_apikey','k_xf_apisecret'];
    keys.forEach(k => {
      const v = document.getElementById(k)?.value?.trim() || '';
      if (v) localStorage.setItem(k, v); else localStorage.removeItem(k);
    });
    refreshApiStatus();
    Utils.toast('已保存API Key','success');
    // 同步到后端全局配置（管理员维护，普通用户登录后自动共享）
    if (window.SyncMod && SyncMod.saveConfig) {
      SyncMod.saveConfig().then(r => {
        if (!r.ok) Utils.toast('全局配置同步失败：' + (r.err || '网络错误'), 'warn');
      });
    }
  }

  async function testAmapJS() {
    const key = document.getElementById('k_amap_js').value.trim();
    if (!key) { Utils.toast('请先填写 JS Key','warn'); return; }
    localStorage.setItem('k_amap_js', key);
    Utils.toast('正在测试 JS Key...','info');
    const s = document.createElement('script');
    s.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(key)}&callback=__amapTestCb`;
    window.__amapTestCb = function() {
      if (window.AMap) {
        Utils.toast('JS Key 有效，地图可正常加载','success');
        refreshApiStatus();
      } else {
        Utils.toast('JS Key 加载失败','danger');
      }
      s.remove();
      try { delete window.__amapTestCb; } catch(e) {}
    };
    s.onerror = () => {
      Utils.toast('JS Key 无效或网络错误，请检查 Key 类型和域名白名单','danger');
      s.remove();
      try { delete window.__amapTestCb; } catch(e) {}
    };
    document.head.appendChild(s);
  }

  async function testAmapSrv() {
    const key = document.getElementById('k_amap_srv').value.trim();
    if (!key) { Utils.toast('请先填写 Web服务 Key','warn'); return; }
    localStorage.setItem('k_amap_srv', key);
    Utils.toast('正在测试 Web服务 Key...','info');
    try {
      const res = await fetch(`https://restapi.amap.com/v3/geocode/geo?key=${encodeURIComponent(key)}&address=南京新街口`);
      const data = await res.json();
      if (data.status === '1' && data.geocodes && data.geocodes[0]) {
        Utils.toast('Web服务 Key 有效，地理编码正常','success');
        refreshApiStatus();
      } else {
        Utils.toast(data.info || 'Key无效', 'danger');
      }
    } catch(e) {
      Utils.toast('网络错误：' + (e.message||e), 'danger');
    }
  }

  // 新闻资讯 API 连接测试
  async function testNewsKey() {
    const raw = (document.getElementById('k_news_api')?.value || '').trim();
    localStorage.setItem('k_news_api', raw);
    const status = document.getElementById('newsTestStatus');
    if (status) { status.textContent = '正在测试连接...'; status.className = 'api-test-msg'; }
    try {
      const cfg = NewsMod.testSource();
      if (cfg === 'claw') {
        const res = await fetch('https://www.claw-search.com/api/news?q=' + encodeURIComponent('房产'));
        if (!res.ok) throw new Error('Claw 服务返回 ' + res.status);
        const data = await res.json();
        const n = ((data.news && data.news.results) || (data.web && data.web.results) || []).length;
        const msg = `Claw 免费源连接成功，返回 ${n} 条结果`;
        if (status) { status.textContent = msg; status.className = 'api-test-msg ok'; }
        refreshApiStatus();
        Utils.toast('Claw 免费源可用','success');
      } else {
        const k = cfg.type === 'tianapi'
          ? `https://apis.tianapi.com/generalnews/index?key=${encodeURIComponent(cfg.val)}&num=1&word=房产`
          : `https://v.juhe.cn/toutiao/index?type=top&key=${encodeURIComponent(cfg.val)}&max=1`;
        const res = await fetch(k);
        const data = await res.json();
        const ok = cfg.type === 'tianapi' ? (data && data.code === 200) : (data && data.error_code === 0);
        if (!ok) throw new Error((data && (data.msg || data.reason)) || 'Key 无效');
        const msg = `${cfg.type === 'tianapi' ? '天行数据' : '聚合数据'} 连接成功`;
        if (status) { status.textContent = msg; status.className = 'api-test-msg ok'; }
        refreshApiStatus();
        Utils.toast('新闻 API 连接成功','success');
      }
    } catch(e) {
      const msg = (e.message || e) + '（若为 CORS 跨域限制，请改用支持跨域的服务或代理）';
      if (status) { status.textContent = msg; status.className = 'api-test-msg err'; }
      Utils.toast('新闻源连接失败：' + (e.message || e), 'danger');
    }
  }

  // AI 大模型 API 连接测试
  async function testLLM() {
    const raw = (document.getElementById('k_llm_api')?.value || '').trim();
    if (!raw) { Utils.toast('请先填写 AI 大模型 API Key','warn'); return; }
    localStorage.setItem('k_llm_api', raw);
    const modelEl = document.getElementById('k_llm_model');
    if (modelEl) localStorage.setItem('k_llm_model', modelEl.value.trim());
    const status = document.getElementById('llmTestStatus');
    if (status) { status.textContent = '正在测试连接...'; status.className = 'api-test-msg'; }
    const r = await Utils.callLLM([
      { role: 'system', content: '你是一个购房助手，请简短回复。' },
      { role: 'user', content: '请回复"连接成功"四个字' }
    ], { max_tokens: 20 });
    if (r.ok) {
      const msg = 'AI 连接成功：' + (r.reply || '').slice(0, 60);
      if (status) { status.textContent = msg; status.className = 'api-test-msg ok'; }
      refreshApiStatus();
      Utils.toast('AI 大模型连接成功','success');
    } else {
      const msg = r.err || '连接失败';
      if (status) { status.textContent = msg; status.className = 'api-test-msg err'; }
      Utils.toast('AI 连接失败：' + msg, 'danger');
    }
  }

  function exportCSVPlan() {
    const plans = Store.getPlans();
    if (!plans.length) { Utils.toast('暂无计划数据','warn'); return; }
    const headers = ['日期','区域','目标小区','状态','备注','准备项完成度'];
    const rows = plans.map(p=>[
      p.date||'', p.district||'', (p.targets||[]).join('、'),
      p.status==='done'?'已完成':(p.status==='expired'?'已过期':'待看'),
      (p.note||'').replace(/\n/g,' '),
      (()=>{ const arr=(p.prepItems||[]); const done=arr.filter(x=>x.checked).length; return `${done}/${arr.length}`; })()
    ]);
    const csv = [headers,...rows].map(row=>row.map(cell=>{
      let s = String(cell);
      if (/[,"\n]/.test(s)) s = '"'+s.replace(/"/g,'""')+'"';
      return s;
    }).join(',')).join('\n');
    Utils.downloadFile(`看房计划_${Utils.today()}.csv`, '\uFEFF'+csv, 'text/csv');
    Utils.toast('看房计划已导出','success');
  }

  function resetAll() {
    Utils.openModal({title:'确认清空所有数据？', body:`
      <div style="color:var(--danger);font-size:13px;">此操作将永久删除：<br/>
        - 所有房源记录<br/>- 所有看房计划<br/>- 购房期望档案<br/>- 工作流进度<br/>- 收藏与设置</div>
      <p style="margin-top:10px;font-size:12.5px;">如需留存数据，请先使用「导出房源CSV / 看房计划CSV」保存副本。</p>`, size:'sm',
      footer:`<button class="btn btn-ghost" onclick="Utils.closeModal()">取消</button>
        <button class="btn btn-danger" onclick="SettingsMod.doReset()">是的，清空并重置</button>`});
  }
  function doReset() {
    Store.clearAll();
    Utils.closeModal();
    Utils.toast('已重置，正在刷新...','success');
    setTimeout(()=>location.reload(), 800);
  }

  return { configHTML, dataHTML, saveNotify, saveKeys, refreshApiStatus, syncNotifyUI, toggleNotifyPref, checkRemindersUI, testAmapJS, testAmapSrv, testNewsKey, testLLM, testVoiceKey, exportCSVPlan, resetAll, doReset };
})();
