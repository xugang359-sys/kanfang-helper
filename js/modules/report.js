/* ============================================
   M12 看房报告模块 · 内嵌展示 + Word导出
   ============================================ */
window.ReportMod = (function() {

  function render() {
    const exp = Store.getExpectation();
    const records = Store.getRecords();
    const plans = Store.getPlans();
    const wf = Store.getWorkflow();

    const html = `
      <div class="page-header">
        <div>
          <h2><span class="emoji">📄</span>看房报告</h2>
          <p class="page-desc">汇总房源记录、购房期望、看房计划与进度，一键导出 Word 文档</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-primary btn-sm" onclick="ReportMod.exportWord()">📝 导出 Word</button>
        </div>
      </div>

      <div id="reportContent" style="background:#fff;border:1px solid var(--border-light);border-radius:10px;padding:24px;">
        ${buildReportHTML(exp, records, plans, wf)}
      </div>
    `;
    App.setContent(html);
  }

  function buildReportHTML(exp, records, plans, wf) {
    const curStep = wf.currentStep || 0;
    const hasExp = exp.budgetMin || exp.budgetMax;

    return `
      <div style="text-align:center;border-bottom:2px solid var(--primary);padding-bottom:12px;margin-bottom:20px;">
        <h1 style="font-size:22px;color:var(--primary);">🏡 看房总报告</h1>
        <div style="color:var(--text-3);font-size:12px;margin-top:4px;">生成日期：${Utils.today()} · 共 ${records.length} 条房源 · ${plans.length} 条看房计划</div>
      </div>

      ${hasExp ? `
      <h2 style="font-size:15px;color:var(--primary);border-left:4px solid var(--primary);padding-left:8px;margin:20px 0 10px;">🎯 我的购房期望</h2>
      <table style="width:100%;border-collapse:collapse;font-size:12.5px;margin-bottom:14px;">
        <tr style="background:var(--primary-soft);"><th style="border:1px solid var(--border-light);padding:6px;text-align:left;width:20%;">预算</th><td style="border:1px solid var(--border-light);padding:6px;">${exp.budgetMin||'-'}~${exp.budgetMax||'-'}万元</td><th style="border:1px solid var(--border-light);padding:6px;text-align:left;width:20%;">首付</th><td style="border:1px solid var(--border-light);padding:6px;">${exp.downPayment||'-'}万 · 月供上限 ${Utils.moneyFormat(exp.monthlyPaymentMax)}</td></tr>
        <tr><th style="border:1px solid var(--border-light);padding:6px;text-align:left;">房型</th><td style="border:1px solid var(--border-light);padding:6px;">${(exp.roomsNeeded?.bedrooms||3)}室${(exp.roomsNeeded?.livingRooms||2)}厅${(exp.roomsNeeded?.bathrooms||1)}卫 · ${exp.areaMin||'-'}~${exp.areaMax||'-'}㎡</td><th style="border:1px solid var(--border-light);padding:6px;text-align:left;">区域</th><td style="border:1px solid var(--border-light);padding:6px;">${(exp.preferredDistricts||[]).join('、')||'不限'}</td></tr>
        <tr><th style="border:1px solid var(--border-light);padding:6px;text-align:left;">硬性要求</th><td style="border:1px solid var(--border-light);padding:6px;" colspan="3">${(exp.mustHaves||[]).join('、')||'无'}</td></tr>
        <tr><th style="border:1px solid var(--border-light);padding:6px;text-align:left;">通勤</th><td style="border:1px solid var(--border-light);padding:6px;">${exp.workplace||'未填'} · 可接受 ${exp.maxCommuteTime||45} 分钟</td><th style="border:1px solid var(--border-light);padding:6px;text-align:left;">时间</th><td style="border:1px solid var(--border-light);padding:6px;">预计 ${exp.targetDate||'-'} 入住 ${exp.moveInDate||'-'}</td></tr>
      </table>` : ''}

      <h2 style="font-size:15px;color:var(--primary);border-left:4px solid var(--primary);padding-left:8px;margin:20px 0 10px;">🚀 购房进度（${curStep+1}/${wf.steps.length}）</h2>
      <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:14px;">
        ${wf.steps.map((s,i)=>`<span style="padding:4px 10px;border-radius:4px;font-size:11.5px;font-weight:${i===curStep?'700':'400'};background:${i<curStep?'var(--success-soft)':(i===curStep?'var(--primary-soft)':'var(--bg-2)')};color:${i<curStep?'var(--success)':(i===curStep?'var(--primary)':'var(--text-3)')};">${i+1}.${s}${i<curStep?' ✅':''}</span>`).join('')}
      </div>

      <h2 style="font-size:15px;color:var(--primary);border-left:4px solid var(--primary);padding-left:8px;margin:20px 0 10px;">📋 房源记录一览（${records.length}套）</h2>
      ${records.length===0?'<div class="empty-state"><p>暂无房源记录</p></div>':`
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;margin-bottom:14px;">
        ${records.map(r=>{
          const m=Utils.calcMatchScore(r,exp);
          const dim=r.dimRatings||{};
          return `<div style="border:1px solid var(--border-light);border-radius:8px;padding:12px;">
            <h3 style="font-size:14px;margin-bottom:4px;">${r.communityName} <span style="color:var(--accent);font-size:12px;">匹配度 ${m.score}</span></h3>
            <div style="font-size:12px;color:var(--text-2);line-height:1.8;">
              ${r.district||'-'} · ${r.propertyType||''} · ${Utils.formatRooms(r.rooms)} · ${Utils.formatArea(r.area)}<br/>
              💰 ${Utils.formatWan(r.totalPrice)} · 单价 ${r.unitPrice?r.unitPrice.toLocaleString():'-'}元/㎡<br/>
              ${r.buildYear?r.buildYear+'年建 · ':''}${r.floor?r.floor.current+'/'+r.floor.total+'层 · ':''}${r.orientation||''}${r.hasElevator?' · 有电梯':''}<br/>
              ⭐ 总体评分：${r.overallRating||Math.round((dim.lighting+dim.ventilation+dim.noise+dim.layout+dim.facility+dim.commute)/6)||'-'} / 5
            </div>
            ${r.summary?`<div style="background:var(--primary-soft);padding:6px 8px;border-radius:4px;margin-top:6px;font-size:11.5px;">📝 ${r.summary}</div>`:''}
          </div>`;
        }).join('')}
      </div>`}

      <h2 style="font-size:15px;color:var(--primary);border-left:4px solid var(--primary);padding-left:8px;margin:20px 0 10px;">📅 看房计划（${plans.length}条）</h2>
      ${plans.length?`
      <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:14px;">
        <thead><tr style="background:var(--accent-soft);"><th style="border:1px solid var(--border-light);padding:5px;text-align:left;">日期</th><th style="border:1px solid var(--border-light);padding:5px;text-align:left;">区域</th><th style="border:1px solid var(--border-light);padding:5px;text-align:left;">目标小区</th><th style="border:1px solid var(--border-light);padding:5px;text-align:left;">状态</th></tr></thead>
        <tbody>${plans.map(p=>`<tr><td style="border:1px solid var(--border-light);padding:5px;">${p.date||'-'}</td><td style="border:1px solid var(--border-light);padding:5px;">${p.district||'-'}</td><td style="border:1px solid var(--border-light);padding:5px;">${(p.targets||[]).join('、')||'-'}</td><td style="border:1px solid var(--border-light);padding:5px;">${p.status==='done'?'✅已看':(p.status==='expired'?'⚠️过期':'📌待看')}</td></tr>`).join('')}</tbody>
      </table>`:'<div class="empty-state"><p>暂无看房计划</p></div>'}

      <div style="margin-top:30px;padding-top:10px;border-top:1px solid var(--border-light);text-align:center;color:var(--text-3);font-size:11px;">
        看房助手 · 生成于 ${new Date().toLocaleString('zh-CN')}
      </div>
    `;
  }

  // 导出 Word（通过 HTML + MS Word header）
  function exportWord() {
    const exp = Store.getExpectation();
    const records = Store.getRecords();
    const plans = Store.getPlans();
    const wf = Store.getWorkflow();
    const bodyHTML = buildReportHTML(exp, records, plans, wf);
    const fullHTML = `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"><title>看房总报告</title>
      <style>
        body{font-family:'PingFang SC','Microsoft YaHei',sans-serif;font-size:12px;color:#0F172A;line-height:1.6;}
        h1{font-size:22px;color:#1E3A8A;text-align:center;border-bottom:2px solid #1E3A8A;padding-bottom:8px;}
        h2{font-size:15px;color:#1E3A8A;border-left:4px solid #1E3A8A;padding-left:8px;margin:20px 0 8px;}
        table{width:100%;border-collapse:collapse;margin:6px 0;}
        th,td{border:1px solid #ddd;padding:5px;font-size:11.5px;}
        th{background:#EFF6FF;}
      </style></head><body>${bodyHTML}</body></html>`;
    const blob = new Blob(['\ufeff'+fullHTML], {type:'application/msword'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `看房报告_${Utils.today()}.doc`;
    a.click();
    URL.revokeObjectURL(url);
    Utils.toast('Word 报告已下载','success');
  }

  // 导出网页（HTML，可 Ctrl+P 打印为 PDF）
  function exportHTML() {
    const exp = Store.getExpectation();
    const records = Store.getRecords();
    const plans = Store.getPlans();
    const wf = Store.getWorkflow();
    const bodyHTML = buildReportHTML(exp, records, plans, wf);
    const fullHTML = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>看房总报告 - ${Utils.today()}</title>
      <style>
        body{font-family:'PingFang SC','Microsoft YaHei',sans-serif;color:#0F172A;line-height:1.6;font-size:12px;max-width:900px;margin:0 auto;padding:20px;}
        h1{font-size:22px;color:#1E3A8A;text-align:center;border-bottom:2px solid #1E3A8A;padding-bottom:8px;}
        h2{font-size:15px;color:#1E3A8A;border-left:4px solid #1E3A8A;padding-left:8px;margin:20px 0 8px;}
        table{width:100%;border-collapse:collapse;margin:6px 0;}
        th,td{border:1px solid #ddd;padding:5px;}
        th{background:#EFF6FF;}
        @page{size:A4;margin:1.5cm;}
      </style></head><body>${bodyHTML}</body></html>`;
    Utils.downloadFile(`看房报告_${Utils.today()}.html`, fullHTML, 'text/html');
    Utils.toast('网页报告已下载，打开后按 Ctrl+P 可打印为 PDF','success');
  }

  return { render, exportWord, exportHTML };
})();
