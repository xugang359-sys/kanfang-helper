/* ============================================
   M11 流程追踪与导出模块
   ============================================ */
window.WorkflowMod = (function() {
  const STEP_GUIDES = [
    { title: '需求确认', tips: '确定预算、房型、区域等硬性要求。建议将期望档案填写完整，并与家人沟通达成一致。', materials: ['购房预算表','家庭成员沟通记录','意向区域清单'] },
    { title: '线上筛选', tips: '在贝壳/链家/安居客等平台筛选房源，对比价格、户型、区位，收藏心仪房源并联系中介。', materials: ['各平台账号','收藏清单','中介联系方式'] },
    { title: '实地看房', tips: '按计划实地看小区、楼栋、房屋，使用实地检查清单逐项核实，填写观后感。', materials: ['实地检查清单（本工具M10）','充电宝+卷尺+笔记本','中介联系人'] },
    { title: '对比决策', tips: '使用智能对比工具（M6）多维度对比房源，匹配期望档案，结合AI建议形成初步决策。', materials: ['对比矩阵报告','匹配度评分','AI决策建议'] },
    { title: '贷款预审', tips: '前往银行或通过中介进行贷款预审，确定可贷额度、利率、月供方案，组合贷需分别走商贷+公积金审批。', materials: ['身份证/户口本/结婚证','收入证明/银行流水','征信报告','首付证明'] },
    { title: '签约交易', tips: '签订购房合同，支付定金/首付。注意：合同条款逐条核对，特别是价格、付款方式、交房时间、违约责任、户口迁出等。', materials: ['身份证/户口本/结婚证','购房合同（逐条审查）','首付款凭证'] },
    { title: '过户缴税', tips: '前往不动产登记中心办理过户，按本工具M8税费方案缴纳契税、个税、增值税等。', materials: ['原有房产证/土地证','买方首套房证明','买卖双方身份材料','银行卡（缴税）'] },
    { title: '物业交接', tips: '办理物业、水电燃气、网络、有线电视过户，核查卖家户口是否迁出，现场验收房屋。', materials: ['前业主水电燃气缴费记录','原物业费结清证明','新房本'] },
    { title: '装修入住', tips: '如需装修，提前确定风格、预算、装修公司或施工队，制定工期计划。家具家电进场后通风散味3-6个月入住。', materials: ['装修方案','装修预算表','空气检测报告'] },
  ];

  function render() {
    const wf = Store.getWorkflow();
    const curStep = wf.currentStep || 0;
    const html = `
      <div class="page-header">
        <div>
          <h2><span class="emoji">🚀</span>购房进度追踪</h2>
          <p class="page-desc">9步购房流程进度追踪 + 全量数据导出备份</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-ghost btn-sm" onclick="WorkflowMod.exportJSON()">📦 导出JSON备份</button>
          <button class="btn btn-accent btn-sm" onclick="WorkflowMod.exportExcel()">📊 导出Excel</button>
          <button class="btn btn-primary btn-sm" onclick="WorkflowMod.exportPDF()">📄 打印为PDF</button>
        </div>
      </div>

      <div class="card">
        <div class="card-title">🧭 购房全流程追踪</div>
        <div class="workflow-steps">
          ${wf.steps.map((s,i)=>`
            <div class="wf-step ${i<curStep?'done':(i===curStep?'current':'')}" onclick="WorkflowMod.jumpTo(${i})" style="cursor:pointer;">
              <div class="num">${i+1}</div>
              <div class="label">${s}</div>
            </div>`).join('')}
        </div>

        <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:10px;">
          <button class="btn btn-ghost btn-sm" onclick="WorkflowMod.prev()">← 上一步</button>
          <button class="btn btn-primary btn-sm" onclick="WorkflowMod.next()">下一步 →</button>
          <button class="btn btn-success btn-sm" onclick="WorkflowMod.markAllDone()">一键标记全部已完成</button>
          <button class="btn btn-danger btn-sm" onclick="WorkflowMod.reset()">重置进度</button>
        </div>
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="card-title">📌 当前步骤：${wf.steps[curStep]} <span class="tag tag-primary tag-sm">第 ${curStep+1}/9 步</span></div>
          <div style="background:var(--primary-soft);padding:10px 12px;border-radius:8px;margin-bottom:10px;">
            <p style="font-size:13px;color:var(--text-2);">💡 ${STEP_GUIDES[curStep].tips}</p>
          </div>
          <h4 style="font-size:13px;color:var(--text-2);margin:10px 0 6px;">📋 建议准备材料</h4>
          <ul style="font-size:13px;padding-left:18px;line-height:2;color:var(--text-2);">
            ${STEP_GUIDES[curStep].materials.map(m=>`<li>${m}</li>`).join('')}
          </ul>
          <div style="margin-top:14px;">
            <label style="font-size:12.5px;font-weight:600;color:var(--text-2);">📝 备注 / 当前状态</label>
            <textarea id="wfNote" style="width:100%;margin-top:6px;padding:8px 10px;border:1px solid var(--border);border-radius:6px;min-height:72px;" placeholder="可记录该步骤进展、材料清单核对情况等">${wf.stepNotes[curStep]||''}</textarea>
            <div style="text-align:right;margin-top:6px;">
              <button class="btn btn-primary btn-sm" onclick="WorkflowMod.saveNote(${curStep})">保存备注</button>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-title">📤 数据导出</div>
          <div style="display:grid;grid-template-columns:repeat(1,1fr);gap:10px;">
            <div style="border:1px solid var(--border-light);border-radius:8px;padding:12px;">
              <h4 style="font-size:13.5px;margin-bottom:4px;">📦 JSON 全量备份 <span class="tag tag-primary tag-sm">推荐</span></h4>
              <p style="font-size:12px;color:var(--text-3);margin-bottom:8px;">导出所有数据（房源+期望+计划+流程+设置），可在"设置与备份"中导入恢复，防止数据丢失。</p>
              <button class="btn btn-primary btn-sm" onclick="WorkflowMod.exportJSON()">立即导出</button>
            </div>
            <div style="border:1px solid var(--border-light);border-radius:8px;padding:12px;">
              <h4 style="font-size:13.5px;margin-bottom:4px;">📊 Excel（CSV）房源记录表</h4>
              <p style="font-size:12px;color:var(--text-3);margin-bottom:8px;">导出房源记录为CSV格式，可用Excel/Numbers/WPS打开做进一步分析（价格对比、筛选、透视等）。</p>
              <button class="btn btn-accent btn-sm" onclick="WorkflowMod.exportExcel()">导出CSV</button>
            </div>
            <div style="border:1px solid var(--border-light);border-radius:8px;padding:12px;">
              <h4 style="font-size:13.5px;margin-bottom:4px;">📄 PDF看房报告（可打印）</h4>
              <p style="font-size:12px;color:var(--text-3);margin-bottom:8px;">生成可打印的HTML报告，打开后 Ctrl+P（Windows）或 Cmd+P（Mac）选择"另存为PDF"，方便分享给家人查看。</p>
              <button class="btn btn-success btn-sm" onclick="WorkflowMod.exportPDF()">生成PDF报告</button>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">📋 全步骤备注看板</div>
        ${wf.steps.map((s,i)=>`
          <div style="padding:8px 0;border-bottom:1px dashed var(--border-light);">
            <div style="display:flex;gap:8px;align-items:center;">
              <div style="width:22px;height:22px;border-radius:50%;background:${i<curStep?'var(--success)':(i===curStep?'var(--primary)':'#ddd')};color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${i+1}</div>
              <div style="font-weight:600;font-size:13px;flex-shrink:0;width:100px;">${s}</div>
              <div style="flex:1;font-size:12.5px;color:var(--text-2);">${wf.stepNotes[i] || '<span style="color:var(--text-4);">（未填写备注）</span>'}</div>
            </div>
          </div>`).join('')}
      </div>
    `;
    App.setContent(html);
  }

  function next() {
    const wf = Store.getWorkflow();
    if (wf.currentStep >= wf.steps.length - 1) { Utils.toast('已到最后一步','success'); return; }
    wf.currentStep = wf.currentStep + 1;
    Store.saveWorkflow(wf); render();
    Utils.toast('进度已更新：'+wf.steps[wf.currentStep], 'success');
  }
  function prev() {
    const wf = Store.getWorkflow();
    if (wf.currentStep <= 0) return;
    wf.currentStep = wf.currentStep - 1;
    Store.saveWorkflow(wf); render();
  }
  function jumpTo(i) {
    const wf = Store.getWorkflow();
    wf.currentStep = i;
    Store.saveWorkflow(wf); render();
  }
  function reset() {
    Utils.openModal({title:'确认重置？',body:'<p>流程进度恢复为第1步（备注内容不会被清空）。</p>',size:'sm',
      footer:`<button class="btn btn-ghost" onclick="Utils.closeModal()">取消</button>
      <button class="btn btn-danger" onclick="WorkflowMod.doReset()">确认重置</button>`});
  }
  function doReset() {
    const wf = Store.getWorkflow();
    wf.currentStep = 0;
    Store.saveWorkflow(wf); Utils.closeModal(); render();
    Utils.toast('已重置','success');
  }
  function markAllDone() {
    Utils.openModal({title:'全部完成？',body:'<p>将所有步骤标记为已完成（适用于已完成购房的记录归档）。</p>',size:'sm',
      footer:`<button class="btn btn-ghost" onclick="Utils.closeModal()">取消</button>
      <button class="btn btn-success" onclick="WorkflowMod.doAllDone()">确认</button>`});
  }
  function doAllDone() {
    const wf = Store.getWorkflow();
    wf.currentStep = wf.steps.length - 1;
    Store.saveWorkflow(wf); Utils.closeModal(); render();
    Utils.toast('🎉 恭喜完成全部流程！', 'success');
  }
  function saveNote(stepIdx) {
    const v = document.getElementById('wfNote').value;
    const wf = Store.getWorkflow();
    wf.stepNotes = {...wf.stepNotes, [stepIdx]: v};
    Store.saveWorkflow(wf);
    Utils.toast('备注已保存','success');
    render();
  }

  // ========== 导出 ==========
  function exportJSON() {
    const data = Store.exportAll();
    Utils.downloadFile(`看房助手备份_${Utils.today()}.json`, JSON.stringify(data, null, 2), 'application/json');
    Utils.toast('全量备份已下载','success');
  }

  function exportExcel() {
    const records = Store.getRecords();
    if (!records.length) { Utils.toast('暂无房源记录可导出','warn'); return; }
    const headers = ['小区名称','区域','地址','类型','户型','面积(㎡)','楼层','朝向','南北通透','电梯','建成年代','房龄','总价(万)','单价(元/㎡)','装修','开发商','物业','产权年限','满五唯一','看房日期','来源','总体评分','采光','通风','噪音','户型评分','配套','通勤','意向程度','后续计划','总结','优势','缺点'];
    const rows = records.map(r=>{
      const dim = r.dimRatings || {};
      return [r.communityName,r.district,r.address,r.propertyType,Utils.formatRooms(r.rooms),r.area||'',(r.floor?`${r.floor.current||''}/${r.floor.total||''}`:''),r.orientation||'',r.isNorthSouthTransparent?'是':'',r.hasElevator?'是':'',r.buildYear||'',Utils.calcHouseAge(r.buildYear)||'',r.totalPrice||'',r.unitPrice||'',r.decoration||'',r.developer||'',r.propertyManagement||'',r.propertyRights||'',r.isFiveYearUnique?'是':'',r.viewingDate||'',r.source||'',r.overallRating||'',dim.lighting||'',dim.ventilation||'',dim.noise||'',dim.layout||'',dim.facility||'',dim.commute||'',r.intention||'',r.nextAction||'',(r.summary||'').replace(/\n/g,' '),(r.pros||'').replace(/\n/g,' '),(r.cons||'').replace(/\n/g,' ')];
    });
    const csv = [headers, ...rows].map(row => row.map(cell => {
      let s = String(cell ?? '');
      if (/[,"\n]/.test(s)) s = '"' + s.replace(/"/g,'""') + '"';
      return s;
    }).join(',')).join('\n');
    // UTF8 BOM 防止 Excel 乱码
    Utils.downloadFile(`房源记录_${Utils.today()}.csv`, '\uFEFF'+csv, 'text/csv');
    Utils.toast('CSV已下载，可直接用Excel打开','success');
  }

  function exportPDF() {
    const exp = Store.getExpectation();
    const records = Store.getRecords();
    const plans = Store.getPlans();
    const wf = Store.getWorkflow();
    const html = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>看房总报告 - ${Utils.today()}</title>
      <style>
        @page { size: A4; margin: 1.5cm; }
        body{font-family:'PingFang SC','Microsoft YaHei',sans-serif;color:#0F172A;line-height:1.6;font-size:12px;}
        h1{font-size:22px;border-bottom:3px solid #1E3A8A;padding-bottom:8px;}
        h2{font-size:15px;color:#1E3A8A;margin-top:20px;padding-left:8px;border-left:4px solid #1E3A8A;}
        h3{font-size:13px;margin-top:12px;}
        table{width:100%;border-collapse:collapse;margin:8px 0;font-size:11px;}
        th,td{border:1px solid #ddd;padding:5px 6px;}
        th{background:#EFF6FF;}
        .meta{color:#64748B;font-size:11px;margin:4px 0 14px;}
        .cards{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin:8px 0;}
        .card{border:1px solid #ddd;border-radius:6px;padding:8px;page-break-inside:avoid;}
        .stars{color:#D4A24C;}
        .bar{height:6px;background:#eee;border-radius:3px;overflow:hidden;margin:2px 0;}
        .bar > div{height:100%;background:#1E3A8A;}
        .footer{margin-top:30px;padding-top:10px;border-top:1px solid #ddd;text-align:center;color:#64748B;font-size:10px;}
      </style></head><body>
      <h1>🏡 看房总报告</h1>
      <div class="meta">生成日期：${Utils.today()} · 共 ${records.length} 条房源记录 · ${plans.length} 条看房计划</div>

      <h2>🎯 我的购房期望</h2>
      <table>
        <tr><th style="width:20%;">预算</th><td>${exp.budgetMin}-${exp.budgetMax}万元</td>
          <th style="width:20%;">首付能力</th><td>${exp.downPayment}万元 · 月供上限 ${Utils.moneyFormat(exp.monthlyPaymentMax)}</td></tr>
        <tr><th>房型</th><td>${(exp.roomsNeeded.bedrooms||3)}室${(exp.roomsNeeded.livingRooms||2)}厅${(exp.roomsNeeded.bathrooms||1)}卫 · ${exp.areaMin}-${exp.areaMax}㎡</td>
          <th>类型偏好</th><td>${exp.propertyPreference||'都接受'} · 区域：${(exp.preferredDistricts||[]).join('、')||'不限'}</td></tr>
        <tr><th>硬性要求</th><td colspan="3">${(exp.mustHaves||[]).join('、')||'无'}</td></tr>
        <tr><th>通勤</th><td>工作地：${exp.workplace||'未填'} / 伴侣：${exp.partnerWorkplace||'未填'}，可接受 ${exp.maxCommuteTime} 分钟</td>
          <th>时间</th><td>预计购房：${exp.targetDate||'-'} · 入住：${exp.moveInDate||'-'}</td></tr>
      </table>

      <h2>🚀 购房进度（${wf.currentStep+1}/9）</h2>
      <table><tr>${wf.steps.map((s,i)=>`<td style="text-align:center;background:${i<wf.currentStep?'#EFF6FF':(i===wf.currentStep?'#DBEAFE':'#fff')};font-weight:${i===wf.currentStep?'700':'400'};">${i+1}. ${s}</td>`).join('')}</tr></table>

      <h2>📋 房源记录一览（${records.length}套）</h2>
      ${records.length===0?'<p>暂无记录</p>':`<div class="cards">
        ${records.map(r=>{
          const m=Utils.calcMatchScore(r,exp);
          return `<div class="card">
            <h3>${r.communityName} <span style="color:#1E3A8A;">匹配度 ${m.score}</span> <span class="stars">${'★'.repeat(r.overallRating||0)}</span></h3>
            <div>${r.district||'-'} · ${r.propertyType||''} · ${Utils.formatRooms(r.rooms)} · ${Utils.formatArea(r.area)}</div>
            <div>💰 ${Utils.formatWan(r.totalPrice)} · 单价 ${r.unitPrice?r.unitPrice.toLocaleString():'-'}元/㎡</div>
            <div>楼层：${r.floor?r.floor.current+'/'+r.floor.total:'-'}层 · ${r.orientation||''}${r.hasElevator?' · 有电梯':''} · ${r.buildYear?r.buildYear+'年('+Utils.calcHouseAgeText(r.buildYear)+')':'-'}</div>
            <div>匹配度: <div class="bar"><div style="width:${m.score}%"></div></div></div>
            ${r.summary?`<div style="background:#EFF6FF;padding:4px 6px;border-radius:4px;margin-top:4px;">📝 ${r.summary}</div>`:''}
          </div>`;
        }).join('')}
      </div>`}

      <h2>📅 看房计划</h2>
      ${plans.length?`<table>
        <thead><tr><th>日期</th><th>区域</th><th>目标小区</th><th>备注</th><th>状态</th></tr></thead>
        <tbody>
        ${plans.map(p=>`<tr><td>${p.date||'-'}</td><td>${p.district||'-'}</td><td>${(p.targets||[]).join('、')||'-'}</td><td>${p.note||'-'}</td><td>${p.status==='done'?'已完成':(p.status==='expired'?'已过期':'待看')}</td></tr>`).join('')}
        </tbody></table>`:'<p>暂无计划</p>'}

      <div class="footer">看房助手 © 2026 · 本报告仅供参考 · 生成于 ${new Date().toLocaleString('zh-CN')}</div>
      </body></html>`;
    Utils.downloadFile(`看房总报告_${Utils.today()}.html`, html, 'text/html');
    Utils.toast('报告已生成，打开文件后按 Ctrl+P / Cmd+P 可打印为PDF','success');
  }

  return { render, next, prev, jumpTo, reset, doReset, markAllDone, doAllDone, saveNote, exportJSON, exportExcel, exportPDF };
})();
