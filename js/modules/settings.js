/* ============================================
   设置与备份模块
   ============================================ */
window.SettingsMod = (function() {

  function render() {
    const s = Store.getSettings();
    const wf = Store.getWorkflow();
    const records = Store.getRecords();
    const plans = Store.getPlans();
    const exp = Store.getExpectation();
    const dataSize = encodeURIComponent(JSON.stringify(localStorage)).length;

    const html = `
      <div class="page-header">
        <div>
          <h2><span class="emoji">⚙️</span>系统设置</h2>
          <p class="page-desc">数据管理、API配置、通知偏好、初始化操作等</p>
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
          <div class="form-grid">
            <div class="form-item">
              <label>开启看房计划提醒</label>
              <select id="s_notify" onchange="SettingsMod.saveNotify()">
                <option value="true" ${s.enableNotification?'selected':''}>已开启</option>
                <option value="false" ${!s.enableNotification?'selected':''}>已关闭</option>
              </select>
            </div>
            <div class="form-item">
              <label>提前提醒天数</label>
              <select id="s_days" onchange="SettingsMod.saveNotify()">
                ${[1,2,3,5,7].map(d=>`<option ${s.remindBeforeDays===d?'selected':''}>${d}</option>`).join('')}
              </select>
            </div>
          </div>
          <div style="margin-top:10px;">
            <button class="btn btn-accent btn-sm" onclick="CalendarMod.toggleNotify()">🔔 开启/关闭看房提醒</button>
            <button class="btn btn-success btn-sm" onclick="CalendarMod.checkReminders();Utils.toast('已检查待看计划','success')">立即检查提醒</button>
          </div>
          <div style="margin-top:14px;">
            <div class="form-section-title" style="margin:0 0 10px;">🌐 联网API配置（可选，未配置时使用本地模拟数据）</div>
            <div class="form-grid">
              <div class="form-item full"><label>高德地图 Web端 JS Key</label>
                <input type="text" id="k_amap_js" placeholder="申请地址：console.amap.com" value="${localStorage.getItem('k_amap_js')||''}">
              </div>
              <div class="form-item full"><label>高德地图 Web服务 Key（通勤/距离计算）</label>
                <input type="text" id="k_amap_srv" placeholder="同控制台，创建Web服务类型Key" value="${localStorage.getItem('k_amap_srv')||''}">
              </div>
              <div class="form-item full"><label>AI大模型 / TRAE API 配置（预留）</label>
                <input type="text" id="k_ai" placeholder="自定义AI分析接口" value="${localStorage.getItem('k_ai')||''}">
              </div>
            </div>
            <div style="margin-top:14px;padding:12px;border:1px dashed var(--border);border-radius:8px;background:var(--accent-soft);">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                <strong style="font-size:13px;color:var(--accent);">🏠 贝壳开放平台 API</strong>
                <a href="https://open.ke.com" target="_blank" style="font-size:11px;color:var(--primary);">申请地址 →</a>
                <span style="font-size:11px;color:var(--text-3);">（用于真实成交案例/估值数据）</span>
              </div>
              <div class="form-grid">
                <div class="form-item"><label>AppKey (AK)</label>
                  <input type="text" id="k_beike_ak" placeholder="贝壳开放平台 AppKey" value="${localStorage.getItem('k_beike_ak')||''}">
                </div>
                <div class="form-item"><label>AppSecret (SK)</label>
                  <input type="text" id="k_beike_sk" placeholder="贝壳开放平台 AppSecret" value="${localStorage.getItem('k_beike_sk')||''}">
                </div>
              </div>
              <div style="display:flex;gap:8px;align-items:center;margin-top:8px;flex-wrap:wrap;">
                <button class="btn btn-accent btn-sm" onclick="SettingsMod.testBeike()">🧪 测试连接</button>
                <span id="beikeStatus" style="font-size:11.5px;color:var(--text-3);"></span>
              </div>
            </div>
            <div style="text-align:right;margin-top:8px;"><button class="btn btn-primary btn-sm" onclick="SettingsMod.saveKeys()">💾 保存API Key</button></div>
            <div class="callout" style="margin-top:10px;">
              <div class="callout-title">💡 说明</div>
              <p style="font-size:12px;">未配置API Key时，模块会使用南京本地模拟数据。所有功能在无Key状态下均可正常体验，Key仅用于提升真实度。本工具所有数据默认本地存储，不会未经授权上传到任何服务器。<br/>
              <strong style="color:var(--accent);">贝壳API说明：</strong>需企业认证账号；个人用户只有AppKey无AppSecret时无法调用，建议改用"房源推荐"模块的粘贴链接解析方案。</p>
            </div>
          </div>
        </div>

        <div class="card" style="grid-column:1/-1;">
          <div style="text-align:center;font-size:13px;color:var(--text-3);padding:8px;">
            🏡 <strong style="color:var(--text-2);">南京看房助手</strong> · 版本 v1.0.0 · 2026年8月
          </div>
        </div>
      </div>
    `;
    App.setContent(html);
  }

  function saveNotify() {
    const en = document.getElementById('s_notify').value === 'true';
    const days = Number(document.getElementById('s_days').value);
    Store.saveSettings({ enableNotification: en, remindBeforeDays: days });
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
    Utils.toast('已保存API Key','success');
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

  return { render, saveNotify, saveKeys, testBeike, importFile, doImport, exportCSVPlan, resetAll, doReset, seedDemo };
})();
