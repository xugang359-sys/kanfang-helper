/* ============================================
   设置与备份模块
   ============================================ */
window.SettingsMod = (function() {

  function render() {
    const s = Store.getSettings();
    const wf = Store.getWorkflow();
    const records = Store.getRecords();
    const plans = Store.getPlans();
    const dataSize = encodeURIComponent(JSON.stringify(localStorage)).length;
    const keys = Utils.getApiKeys();
    const st = Utils.apiStatus();
    const chip = a => `<div class="api-chip ${a.configured?'ok':'no'}" id="apiChip_${a.id}">${a.icon} ${a.label}<span>${a.configured?'已配置':'未配置'}</span></div>`;
    const tagCls = ok => 'tag tag-sm ' + (ok ? 'tag-success' : 'tag-danger');

    const html = `
      <div class="page-header">
        <div>
          <h2><span class="emoji">⚙️</span>系统设置</h2>
          <p class="page-desc">数据管理、API 配置与连接测试、通知偏好、初始化操作</p>
        </div>
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="card-title">💾 数据备份与恢复</div>
          <div style="background:var(--primary-soft);padding:10px 12px;border-radius:8px;margin-bottom:12px;">
            <p style="font-size:12.5px;">当前已有：<strong>${records.length}</strong> 条房源记录 · <strong>${plans.length}</strong> 条看房计划 · <strong>${wf.steps.length}</strong> 步购房流程进度</p>
            <p style="font-size:12px;color:var(--text-3);">数据存储大小：约 ${(dataSize/1024).toFixed(1)} KB（本地 localStorage）</p>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <button class="btn btn-primary" onclick="WorkflowMod.exportJSON()">📦 导出全量JSON</button>
            <button class="btn btn-accent" onclick="WorkflowMod.exportExcel()">📊 导出房源CSV</button>
            <label class="btn btn-success" style="cursor:pointer;">
              📥 导入JSON备份<input type="file" accept=".json,application/json" style="display:none;" onchange="SettingsMod.importFile(this)">
            </label>
            <button class="btn btn-ghost" onclick="SettingsMod.exportCSVPlan()">📋 导出看房计划CSV</button>
          </div>
          <div style="margin-top:14px;padding:10px;background:var(--danger-soft);border-radius:8px;">
            <h4 style="font-size:13px;color:var(--danger);margin-bottom:6px;">⚠️ 危险操作</h4>
            <button class="btn btn-danger btn-sm" onclick="SettingsMod.resetAll()">🗑️ 清空所有数据（恢复初始）</button>
            <button class="btn btn-warn btn-sm" onclick="SettingsMod.seedDemo()" style="background:var(--warn);color:#fff;">🧪 载入示例数据</button>
          </div>
        </div>

        <div class="card">
          <div class="card-title">🔔 通知与偏好</div>
          <div class="pref-grid">
            <div class="pref-row">
              <div class="pref-label">
                <span class="pref-icon">🔔</span>
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
                <span class="pref-icon">⏰</span>
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
            <button class="btn btn-accent btn-sm" id="notifyPrefBtn" onclick="SettingsMod.toggleNotifyPref()">${s.enableNotification?'🔕 关闭提醒':'🔔 开启提醒'}</button>
            <button class="btn btn-success btn-sm" onclick="SettingsMod.checkRemindersUI()">📢 立即检查提醒</button>
          </div>
        </div>

        <div class="card" style="grid-column:1/-1;">
          <div class="card-title">🌐 联网 API 配置</div>
          <div class="api-status-grid">${st.map(chip).join('')}</div>

          <div class="api-block">
            <div class="api-block-head">
              <div class="api-block-title"><span class="ico">🗺️</span>高德地图</div>
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
              <div class="api-block-title"><span class="ico">🤖</span>AI 大模型</div>
              <span class="${tagCls(!!keys.ai)}" id="aiKeyTag">${keys.ai?'已配置':'未配置'}</span>
            </div>
            <p class="api-desc">用于「决策对比」的 AI 深度分析。支持平台前缀：<code>trae:</code> TRAE 内置（默认）· <code>glm:</code> 智谱 GLM · <code>deepseek:</code> DeepSeek · <code>openai:</code> OpenAI。无前缀默认按 TRAE 调用。</p>
            <div class="form-item full"><label>API Key</label>
              <div class="key-row">
                <input type="text" id="k_ai" placeholder="trae:sk-xxx 或 glm:xxx / deepseek:xxx / openai:xxx" value="${keys.ai}">
                <button class="btn btn-accent btn-sm" onclick="SettingsMod.testAI()">测试连接</button>
              </div>
            </div>
            <div class="api-actions"><span class="api-test-msg" id="aiTestStatus"></span></div>
          </div>

          <div class="api-block">
            <div class="api-block-head">
              <div class="api-block-title"><span class="ico">🏠</span>贝壳开放平台</div>
              <span class="${tagCls(!!(keys.beikeAk&&keys.beikeSk))}" id="beikeKeyTag">${(keys.beikeAk&&keys.beikeSk)?'已配置':'未配置'}</span>
              <a href="https://open.ke.com" target="_blank" style="font-size:11px;color:var(--primary);">申请地址 →</a>
            </div>
            <p class="api-desc">用于「房源推荐」获取真实成交案例与估值数据。需企业认证账号；个人用户仅有 AppKey 无 AppSecret 无法调用，建议改用「粘贴链接手动导入」。</p>
            <div class="form-grid">
              <div class="form-item"><label>AppKey (AK)</label><input type="text" id="k_beike_ak" placeholder="贝壳开放平台 AppKey" value="${keys.beikeAk}"></div>
              <div class="form-item"><label>AppSecret (SK)</label><input type="text" id="k_beike_sk" placeholder="贝壳开放平台 AppSecret" value="${keys.beikeSk}"></div>
            </div>
            <div class="api-actions">
              <button class="btn btn-accent btn-sm" onclick="SettingsMod.testBeike()">测试连接</button>
              <span id="beikeStatus" class="api-test-msg"></span>
            </div>
          </div>

          <div style="display:flex;justify-content:flex-end;margin-top:6px;">
            <button class="btn btn-primary btn-sm" onclick="SettingsMod.saveKeys()">💾 保存全部 API Key</button>
          </div>
          <div class="callout" style="margin-top:12px;">
            <div class="callout-title">💡 说明</div>
            <p style="font-size:12px;">未配置相应 API 时，对应模块会提示「前往配置」，不会使用本地模拟数据。所有数据默认仅存储在本地浏览器，不会未经授权上传到任何服务器。</p>
          </div>
        </div>
      </div>
    `;
    App.setContent(html);
    syncNotifyUI();
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
    [['amapKeyTag','amap'],['aiKeyTag','ai'],['beikeKeyTag','beike']].forEach(([id, name]) => {
      const el = document.getElementById(id);
      if (!el) return;
      const ok = Utils.apiConfigured(name);
      el.textContent = ok ? '已配置' : '未配置';
      el.className = 'tag tag-sm ' + (ok ? 'tag-success' : 'tag-danger');
    });
  }

  // ===== 通知偏好 · 与开关/按钮双向联动 =====
  // 根据当前设置同步 select 与按钮文本
  function syncNotifyUI() {
    const s = Store.getSettings();
    const sel = document.getElementById('s_notify');
    if (sel) sel.value = String(s.enableNotification);
    const btn = document.getElementById('notifyPrefBtn');
    if (btn) btn.textContent = s.enableNotification ? '🔕 关闭提醒' : '🔔 开启提醒';
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
    const keys = ['k_amap_js','k_amap_srv','k_ai','k_beike_ak','k_beike_sk'];
    keys.forEach(k => {
      const v = document.getElementById(k)?.value?.trim() || '';
      if (v) localStorage.setItem(k, v); else localStorage.removeItem(k);
    });
    // 贝壳配置变更时清空旧 token
    localStorage.removeItem('k_beike_token');
    localStorage.removeItem('k_beike_token_exp');
    refreshApiStatus();
    Utils.toast('已保存API Key','success');
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
        Utils.toast('✅ JS Key 有效，地图可正常加载','success');
        refreshApiStatus();
      } else {
        Utils.toast('❌ JS Key 加载失败','danger');
      }
      s.remove();
      try { delete window.__amapTestCb; } catch(e) {}
    };
    s.onerror = () => {
      Utils.toast('❌ JS Key 无效或网络错误，请检查 Key 类型和域名白名单','danger');
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
        Utils.toast('✅ Web服务 Key 有效，地理编码正常','success');
        refreshApiStatus();
      } else {
        Utils.toast('❌ ' + (data.info || 'Key无效'), 'danger');
      }
    } catch(e) {
      Utils.toast('❌ 网络错误：' + (e.message||e), 'danger');
    }
  }

  // AI 大模型连接测试（复用 compare.js 的 key 解析规则）
  async function testAI() {
    const raw = (document.getElementById('k_ai')?.value || '').trim();
    if (!raw) { Utils.toast('请先填写 AI Key','warn'); return; }
    localStorage.setItem('k_ai', raw);
    const status = document.getElementById('aiTestStatus');
    if (status) { status.textContent = '⏳ 正在测试连接...'; status.className = 'api-test-msg'; }
    try {
      const cfg = CompareMod.parseAIKey();
      const res = await fetch(cfg.base + '/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'Authorization':'Bearer ' + cfg.key },
        body: JSON.stringify({
          model: cfg.model,
          messages: [{ role:'user', content:'请仅回复四个字：连接正常' }],
          temperature: 0,
          max_tokens: 16
        })
      });
      if (!res.ok) {
        const txt = await res.text().catch(()=>'');
        throw new Error(`HTTP ${res.status} ${txt.slice(0,120)}`);
      }
      const data = await res.json();
      const content = (data?.choices?.[0]?.message?.content || '').trim();
      const msg = `✅ ${cfg.desc}（${cfg.model}）连接成功` + (content ? '：' + content.slice(0,20) : '');
      if (status) { status.textContent = msg; status.className = 'api-test-msg ok'; }
      refreshApiStatus();
      Utils.toast('AI 连接成功','success');
    } catch(e) {
      const msg = '❌ ' + (e.message || e) + '（注意：浏览器前端直调第三方 API 可能受 CORS 限制，建议使用支持 CORS 的 Key 或代理）';
      if (status) { status.textContent = msg; status.className = 'api-test-msg err'; }
      Utils.toast('AI 连接失败：' + (e.message || e), 'danger');
    }
  }

  async function testBeike() {
    saveKeys();
    const status = document.getElementById('beikeStatus');
    if (status) { status.textContent = '⏳ 正在测试连接...'; status.style.color = 'var(--text-3)'; }
    const r = await BeikeMod.testConnection();
    if (status) {
      status.textContent = r.ok ? '✅ ' + r.msg : '❌ ' + r.err;
      status.style.color = r.ok ? 'var(--success)' : 'var(--danger)';
    }
    refreshApiStatus();
    Utils.toast(r.ok ? '贝壳API连接成功' : '连接失败：'+r.err, r.ok ? 'success' : 'danger');
  }

  function importFile(input) {
    const file = input.files[0];
    if (!file) return;
    Utils.openModal({title:'导入方式', body:`
      <p style="margin-bottom:10px;">已选择文件：<strong>${file.name}</strong> (${(file.size/1024).toFixed(1)} KB)</p>
      <p style="font-size:12.5px;color:var(--warn);">请选择导入模式：</p>`, size:'sm',
      footer:`<button class="btn btn-ghost" onclick="Utils.closeModal();this.value=''">取消</button>
        <button class="btn btn-warn btn-sm" style="background:var(--warn);color:#fff;" onclick="SettingsMod.doImport('merge', '${file.name}')">合并导入（保留现有）</button>
        <button class="btn btn-danger" onclick="SettingsMod.doImport('overwrite', '${file.name}')">覆盖导入（替换现有）</button>`
    });
    // 暂存文件内容
    Utils.readFileAsText(file).then(txt => { window.__pendingImportContent = txt; });
    input.value = '';
  }
  function doImport(mode, fname) {
    try {
      const content = window.__pendingImportContent;
      if (!content) throw new Error('读取失败');
      const data = JSON.parse(content);
      Store.importAll(data, mode==='overwrite');
      Utils.closeModal();
      Utils.toast(mode==='overwrite'?'已覆盖所有数据':'已合并导入数据', 'success');
      setTimeout(()=>location.reload(), 800);
    } catch(e) {
      Utils.toast('导入失败：'+e.message, 'danger');
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
    Utils.openModal({title:'⚠️ 确认清空所有数据？', body:`
      <div style="color:var(--danger);font-size:13px;">此操作将永久删除：<br/>
        - 所有房源记录<br/>- 所有看房计划<br/>- 购房期望档案<br/>- 工作流进度<br/>- 收藏与设置</div>
      <p style="margin-top:10px;font-size:12.5px;">建议先在左侧"导出JSON备份"保存一份备份文件！</p>`, size:'sm',
      footer:`<button class="btn btn-ghost" onclick="Utils.closeModal()">取消</button>
        <button class="btn btn-danger" onclick="SettingsMod.doReset()">是的，清空并重置</button>`});
  }
  function doReset() {
    Store.clearAll();
    Utils.closeModal();
    Utils.toast('已重置，正在刷新...','success');
    setTimeout(()=>location.reload(), 800);
  }
  function seedDemo() {
    Utils.openModal({title:'载入示例数据？', body:`<p>当前数据会被示例数据覆盖。</p>`, size:'sm',
      footer:`<button class="btn btn-ghost" onclick="Utils.closeModal()">取消</button>
        <button class="btn btn-primary" onclick="Store.clearAll();Store.seedDemoIfEmpty();Utils.closeModal();location.reload();">确认载入</button>`});
  }

  return { render, saveNotify, saveKeys, refreshApiStatus, syncNotifyUI, toggleNotifyPref, checkRemindersUI, testAmapJS, testAmapSrv, testAI, testBeike, importFile, doImport, exportCSVPlan, resetAll, doReset, seedDemo };
})();
