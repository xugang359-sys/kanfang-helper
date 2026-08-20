/* ============================================
   M10 实地检查清单模块
   ============================================ */
window.AidsMod = (function() {
  function render() {
    const records = Store.getRecords();
    const html = `
      <div class="page-header">
        <div>
          <h2><span class="emoji">🛠️</span>实地检查清单</h2>
          <p class="page-desc">标准化7大类别实地检查清单，看房现场逐项核实。</p>
        </div>
      </div>

      <div class="card">
        <div class="card-title">✅ 实地检查清单（7大类别）</div>
        ${records.length ? `
          <div style="margin-bottom:14px;">
            <label style="font-size:13px;font-weight:500;">关联房源记录（可选）：</label>
            <select id="clRecordSel" style="margin-left:8px;padding:6px 10px;border:1px solid var(--border);border-radius:4px;" onchange="AidsMod.loadChecklist()">
              <option value="">— 独立使用（不关联） —</option>
              ${records.map(r=>`<option value="${r.id}">${r.communityName} · ${r.district}</option>`).join('')}
            </select>
          </div>` : `<p style="font-size:12.5px;color:var(--text-3);margin-bottom:12px;">💡 不关联记录也可直接使用；创建房源记录后可将清单结果同步到该房源。</p>`}
        <div id="checklistBox"></div>
        <div style="margin-top:14px;display:flex;gap:8px;justify-content:flex-end;">
          <button class="btn btn-ghost btn-sm" onclick="AidsMod.resetChecklist()">重置</button>
          <button class="btn btn-primary btn-sm" onclick="AidsMod.saveChecklist()">💾 保存检查结果</button>
        </div>
      </div>
    `;
    App.setContent(html);
    renderChecklistItems({});
  }

  function renderChecklistItems(data) {
    const box = document.getElementById('checklistBox');
    const cats = Store.DEFAULT_CHECKLIST;
    box.innerHTML = Object.entries(cats).map(([cat, items])=>`
      <div class="checklist-category">
        <div class="checklist-header" onclick="const b=this.nextElementSibling;b.style.display=b.style.display==='none'?'block':'none';">
          <span>📌 ${cat}（${items.length}项）</span>
          <div id="catStat_${hashCode(cat)}" style="font-size:11px;"></div>
        </div>
        <div class="checklist-body">
          ${items.map(it=>`
            <div class="check-item">
              <div class="ci-label">${it}</div>
              <div class="ci-actions" data-ci="${cat}" data-item="${it}">
                <button class="ci-btn ok" data-val="ok" onclick="AidsMod.setCi(this)">✅正常</button>
                <button class="ci-btn warn" data-val="warn" onclick="AidsMod.setCi(this)">⚠️有问题</button>
                <button class="ci-btn bad" data-val="bad" onclick="AidsMod.setCi(this)">❌不合格</button>
                <button class="ci-btn" data-val="" onclick="AidsMod.setCi(this)">—未查</button>
              </div>
            </div>`).join('')}
        </div>
      </div>
    `).join('');
    // 回填值
    if (data && Object.keys(data).length) {
      Object.entries(data).forEach(([cat, items])=>{
        Object.entries(items).forEach(([item,v])=>{
          const btn = document.querySelector(`[data-ci="${cat}"][data-item="${item}"] [data-val="${v}"]`);
          if (btn) AidsMod.setCi(btn, true);
        });
      });
    }
    updateCiStats();
  }
  function hashCode(s) { return s.split('').reduce((a,c)=>((a<<5)-a+c.charCodeAt(0))|0,0); }

  function setCi(btn, skipStats=false) {
    const box = btn.parentElement;
    const val = btn.dataset.val;
    box.querySelectorAll('.ci-btn').forEach(b => b.classList.remove('active'));
    if (val) btn.classList.add('active');
    if (!skipStats) updateCiStats();
  }
  function updateCiStats() {
    // 分类统计
    document.querySelectorAll('.checklist-category').forEach(cat=>{
      const header = cat.querySelector('.checklist-header span').textContent;
      const catName = header.replace(/^📌 /,'').replace(/（.*$/,'');
      let ok=0, warn=0, bad=0, total=0;
      cat.querySelectorAll('[data-ci]').forEach(ci=>{
        total++;
        const active = ci.querySelector('.ci-btn.active');
        if (!active) return;
        const v = active.dataset.val;
        if (v==='ok') ok++; else if (v==='warn') warn++; else if (v==='bad') bad++;
      });
      const parts=[];
      if (ok) parts.push(`✅${ok}`);
      if (warn) parts.push(`⚠️${warn}`);
      if (bad) parts.push(`❌${bad}`);
      const unchk = total-ok-warn-bad;
      if (unchk) parts.push(`—${unchk}`);
      const el = document.getElementById('catStat_'+hashCode(catName));
      if (el) el.textContent = parts.join(' ');
    });
  }

  function loadChecklist() {
    const sel = document.getElementById('clRecordSel');
    const id = sel.value;
    clRecordId = id || null;
    const data = id ? (Store.getRecord(id)?.checklist || {}) : {};
    renderChecklistItems(data);
  }

  function resetChecklist() {
    Utils.openModal({title:'确认重置',body:'<p>清空所有检查项？</p>',size:'sm',
      footer:`<button class="btn btn-ghost" onclick="Utils.closeModal()">取消</button><button class="btn btn-danger" onclick="AidsMod.doResetCl();Utils.closeModal();">确认清空</button>`});
  }
  function doResetCl() { renderChecklistItems({}); }

  function collectChecklist() {
    const result = {};
    document.querySelectorAll('[data-ci]').forEach(ci=>{
      const cat = ci.dataset.ci, item = ci.dataset.item;
      const active = ci.querySelector('.ci-btn.active');
      if (!active) return;
      const v = active.dataset.val;
      if (!v) return;
      if (!result[cat]) result[cat] = {};
      result[cat][item] = v;
    });
    return result;
  }

  function saveChecklist() {
    const sel = document.getElementById('clRecordSel');
    const id = sel ? sel.value : null;
    const data = collectChecklist();
    if (id) {
      const r = Store.getRecord(id);
      if (r) { r.checklist = data; Store.saveRecord(r); }
    } else {
      localStorage.setItem('hh_last_checklist', JSON.stringify(data));
    }
    Utils.toast('检查清单已保存' + (id?'到房源记录':''), 'success');
  }

  function openChecklistFor(recordId) {
    const records = Store.getRecords();
    const r = Store.getRecord(recordId);
    const data = (r && r.checklist) ? r.checklist : {};
    const body = `
      <div style="margin-bottom:14px;">
        <div style="font-size:13px;margin-bottom:6px;">关联房源：<strong>${r?r.communityName:'-'}</strong> · ${r?r.district:''}</div>
      </div>
      <div id="modalChecklistBox">${renderChecklistItems_Modal(data)}</div>
    `;
    Utils.openModal({title:'实地检查清单', body, size:'lg',
      footer:`<button class="btn btn-ghost" onclick="Utils.closeModal()">取消</button><button class="btn btn-primary" onclick="AidsMod.saveModalCl('${recordId}')">保存</button>`});
    // bind
    setTimeout(()=>document.querySelectorAll('#modalChecklistBox .ci-btn').forEach(b=>b.addEventListener('click',()=>{
      const box=b.parentElement;
      box.querySelectorAll('.ci-btn').forEach(x=>x.classList.remove('active'));
      if (b.dataset.val) b.classList.add('active');
    })), 20);
  }
  function renderChecklistItems_Modal(data) {
    const cats = Store.DEFAULT_CHECKLIST;
    return Object.entries(cats).map(([cat, items])=>`
      <div style="margin-bottom:14px;">
        <div style="font-weight:600;color:var(--primary);padding:8px 10px;background:var(--primary-soft);border-radius:6px;margin-bottom:8px;">📌 ${cat}</div>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;">
          ${items.map(it=>{
            const v = (data[cat]||{})[it];
            return `<div style="border:1px solid var(--border-light);padding:8px 10px;border-radius:6px;">
              <div style="font-size:12.5px;margin-bottom:5px;">${it}</div>
              <div class="ci-actions" data-ci="${cat}" data-item="${it}">
                <button class="ci-btn ok ${v==='ok'?'active':''}" data-val="ok">✅</button>
                <button class="ci-btn warn ${v==='warn'?'active':''}" data-val="warn">⚠️</button>
                <button class="ci-btn bad ${v==='bad'?'active':''}" data-val="bad">❌</button>
                <button class="ci-btn ${!v?'active':''}" data-val="">—</button>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>`).join('');
  }
  function saveModalCl(recordId) {
    const result = {};
    document.querySelectorAll('#modalChecklistBox [data-ci]').forEach(ci=>{
      const cat = ci.dataset.ci, item = ci.dataset.item;
      const active = ci.querySelector('.ci-btn.active');
      const v = active ? active.dataset.val : '';
      if (!v) return;
      if (!result[cat]) result[cat] = {};
      result[cat][item] = v;
    });
    const r = Store.getRecord(recordId);
    if (r) { r.checklist = result; Store.saveRecord(r); }
    Utils.closeModal();
    Utils.toast('检查清单已保存','success');
    // 回到详情页时刷新
    if (r) RecordsMod.view(recordId);
  }

  return { render, setCi, loadChecklist, resetChecklist, doResetCl, collectChecklist, saveChecklist, openChecklistFor, renderChecklistItems, saveModalCl };
})();
