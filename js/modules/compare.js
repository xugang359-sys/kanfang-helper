/* ============================================
   M6 智能决策对比模块
   ============================================ */
window.CompareMod = (function() {
  const ic = Utils.icon;   // SF Symbols 风格图标
  let selectedIds = [];
  let userCleared = false;

  function render() {
    const records = Store.getRecords();
    // 默认选中前3条有意向的（仅首次进入未主动清空时）
    if (!selectedIds.length && !userCleared) {
      records.forEach((r,i) => {
        if (i < 3 && selectedIds.length < 3) selectedIds.push(r.id);
      });
    }
    const html = `
      <div class="page-header">
        <div>
          <h2><span class="emoji">${ic('scale')}</span>智能决策对比</h2>
          <p class="page-desc">多房源对比 + 期望匹配度评分，告诉你该怎么选。</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-ghost btn-sm" onclick="CompareMod.clearSel()">清空选择</button>
        </div>
      </div>

      <div class="card">
        <div class="card-title">${ic('pin')} 选择对比房源（2-5个）</div>
        ${records.length<2 ? `<div class="empty-state" style="padding:20px;"><div class="icon">${ic('list')}</div><h4>需要至少2条房源记录</h4><button class="btn btn-primary btn-sm" onclick="App.navigate('records')">去创建记录</button></div>` : `
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;" id="cmpSelBox">
            ${records.map(r=>{
              const checked = selectedIds.includes(r.id);
              return `<label style="border:2px solid ${checked?'var(--primary-light)':'var(--border-light)'};border-radius:10px;padding:10px 12px;cursor:pointer;background:${checked?'var(--primary-soft)':'#fff'};transition:all 0.15s;" data-sel="${r.id}">
                <div style="display:flex;align-items:center;gap:8px;">
                  <input type="checkbox" value="${r.id}" ${checked?'checked':''} onchange="CompareMod.toggleSel('${r.id}', this.checked)">
                  <div style="flex:1;min-width:0;">
                    <div style="font-weight:600;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${r.communityName}</div>
                    <div style="font-size:11.5px;color:var(--text-3);">${r.district||'-'} · ${Utils.formatWan(r.totalPrice)} · ${Utils.formatRooms(r.rooms)}</div>
                  </div>
                </div>
              </label>`;
            }).join('')}
          </div>
          <p style="margin-top:10px;font-size:12px;color:var(--text-3);">当前已选 <strong id="cmpSelCount">${selectedIds.length}</strong> 个（建议2-5个）</p>
        `}
      </div>

      <div id="cmpResult"></div>
    `;
    App.setContent(html);
    if (records.length >= 2) generate();
  }

  function toggleSel(id, checked) {
    if (checked) {
      if (selectedIds.length >= 5) { Utils.toast('最多选5个','warn'); event.preventDefault(); return; }
      if (!selectedIds.includes(id)) selectedIds.push(id);
    } else {
      selectedIds = selectedIds.filter(x=>x!==id);
    }
    document.getElementById('cmpSelCount').textContent = selectedIds.length;
    document.querySelectorAll(`[data-sel]`).forEach(l=>{
      const id2 = l.dataset.sel;
      const c = selectedIds.includes(id2);
      l.style.borderColor = c ? 'var(--primary-light)' : 'var(--border-light)';
      l.style.background = c ? 'var(--primary-soft)' : '#fff';
    });
    generate();
  }
  function clearSel() {
    if (!selectedIds.length) { Utils.toast('当前未选择任何房源','info'); return; }
    selectedIds = [];
    userCleared = true;
    render();
    Utils.toast('已清空选择','success');
  }

  function generate() {
    const records = selectedIds.map(id=>Store.getRecord(id)).filter(Boolean);
    if (records.length < 2) { document.getElementById('cmpResult').innerHTML = ''; return; }
    const exp = Store.getExpectation();
    const data = records.map(r => {
      const m = Utils.calcMatchScore(r, exp);
      return { r, m, advice: Utils.decisionAdvice(m.score, m.hasExpectation) };
    });
    data.sort((a,b)=>b.m.score - a.m.score);

    // 期望匹配度对比表
    let rows = '';
    const dims = [['budget','预算匹配'],['layout','户型面积'],['commute','通勤距离'],['facility','配套教育'],['impression','个人观感'],['potential','区域潜力']];
    dims.forEach(([k,cn]) => {
      const vals = data.map(d => d.m.detail[k] || 0);
      const max = Math.max(...vals), min = Math.min(...vals);
      rows += `<tr><th>${cn}</th>` + vals.map(v=>{
        let cls='';
        if (v===max && max!==min) cls='best';
        else if (v===min && max!==min && v<50) cls='worst';
        return `<td class="${cls}"><div style="display:flex;align-items:center;gap:6px;">
          <div style="flex:1;height:6px;background:var(--border-light);border-radius:3px;overflow:hidden;"><div style="width:${v}%;height:100%;background:${v>=70?'var(--success)':'var(--primary)'};"></div></div>
          <strong style="font-size:12px;min-width:32px;">${v}</strong>
        </div></td>`;
      }).join('') + '</tr>';
    });
    const totals = data.map(d=>d.m.score);
    const maxT = Math.max(...totals), minT = Math.min(...totals);
    rows += `<tr style="background:var(--primary-soft);font-weight:700;">
      <th>综合匹配度</th>` + totals.map((v,i)=>`<td class="${v===maxT?'best':(v===minT&&v<60?'worst':'')}" style="font-size:16px;"><span style="color:var(--primary);">${v}</span> / 100 <span class="tag ${data[i].advice.color} tag-sm">${data[i].advice.level}</span></td>`).join('') + `</tr>`;

    const html = `
      <!-- 综合评分卡片 -->
      <div class="card">
        <div class="card-title">${ic('target')} 匹配度总览</div>
        <div style="display:grid;grid-template-columns:repeat(${Math.min(5,data.length)},1fr);gap:14px;">
          ${data.map((d,i)=>`
            <div style="border:1px solid var(--border-light);border-radius:10px;padding:14px;text-align:center;background:#fff;">
              <div style="display:flex;justify-content:center;margin-bottom:6px;">${Utils.matchRingHTML(d.m.score)}</div>
              <h4 style="font-size:13px;margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${d.r.communityName}">${d.r.communityName}</h4>
              <p style="font-size:11px;color:var(--text-3);margin-bottom:6px;">${d.r.district} · ${Utils.formatWan(d.r.totalPrice)}</p>
              <span class="tag ${d.advice.color} tag-sm">${d.advice.level}</span>
              ${i===0?'<div><span class="tag tag-success tag-sm" style="margin-top:4px;">'+ic('trophy',12)+' 首推</span></div>':''}
            </div>`).join('')}
        </div>
      </div>

      <!-- 期望匹配度评分 -->
      <div class="card">
        <div class="card-title">${ic('chart')} 期望匹配度评分明细（权重可调：<a onclick="App.navigate('expectation')" style="color:var(--primary);cursor:pointer;">去设置</a>）</div>
        <div style="overflow-x:auto;">
          <table class="compare-table">
            <thead><tr><th>维度</th>${data.map(d=>`<th>${d.r.communityName}</th>`).join('')}</tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>

      <!-- 雷达图对比 -->
      <div class="grid-2">
        <div class="card">
          <div class="card-title">${ic('grid')} 雷达图对比</div>
          <div style="height:300px;" id="cmpRadar"></div>
        </div>
        <div class="card">
          <div class="card-title">${ic('quote')} 观后感汇总</div>
          ${data.map(d=>`
            <div style="border-bottom:1px dashed var(--border-light);padding:14px 0;${data.indexOf(d)===data.length-1?'border:none':''}">
              <div style="font-weight:600;font-size:13.5px;margin-bottom:8px;">
                ${ic('house',14)} ${d.r.communityName} ${Utils.renderStars(d.r.overallRating||0)}
              </div>
              ${d.r.pros?`<div style="font-size:12.5px;margin:6px 0;line-height:1.7;"><span style="color:var(--success);font-weight:600;">${ic('sparkle',12)} 优势：</span>${d.r.pros}</div>`:''}
              ${d.r.cons?`<div style="font-size:12.5px;margin:6px 0;line-height:1.7;"><span style="color:var(--warn);font-weight:600;">${ic('alert',12)} 缺点：</span>${d.r.cons}</div>`:''}
              ${d.r.summary?`<div style="font-size:12px;color:var(--text-2);line-height:1.7;padding:8px 12px;background:var(--primary-soft);border-radius:6px;margin-top:8px;">${ic('note',12)} ${d.r.summary}</div>`:''}
            </div>`).join('')}
        </div>
      </div>

      <!-- 字段级对比 -->
      <div class="card">
        <div class="card-title">${ic('list')} 全字段对比矩阵</div>
        ${renderFullMatrix(data)}
      </div>

      <!-- 总结分析 -->
      <div class="card">
        <div class="card-title">${ic('chart')} 总结分析</div>
        <div style="padding:10px 12px;background:var(--primary-soft);border-radius:8px;margin-bottom:10px;">
          <h4 style="font-size:14px;color:var(--primary);margin-bottom:4px;">${ic('pin',14)} 综合推荐排序</h4>
          <p style="font-size:13px;">
            ${data.map((d,i)=>`第${i+1}名：<strong style="color:${i===0?'var(--success)':'var(--text-1)'}">${d.r.communityName}</strong>（${d.m.score}分，${d.advice.level}）${i<data.length-1?' → ':''}`).join('')}
          </p>
        </div>
        ${data.map((d,i)=>{
          const names = {budget:'预算',layout:'户型',commute:'通勤',facility:'配套',impression:'观感',potential:'潜力'};
          const det = d.m.detail;
          const strengths = Object.entries(det).filter(([k,v])=>v>=75).map(([k,v])=>names[k]).join('、') || '暂无明显优势项，整体均衡';
          const weaks = Object.entries(det).filter(([k,v])=>v<50).map(([k,v])=>names[k]).join('、') || '暂无明显短板，建议重点考虑';
          const pStyle = 'font-size:12.5px;color:var(--text-2);margin:5px 0;line-height:1.7;';
          return `<div style="border-left:4px solid ${i===0?'var(--success)':(d.m.score>=60?'var(--primary)':'var(--warn)')};padding:14px 18px;background:#fff;margin-bottom:12px;border-radius:0 8px 8px 0;">
            <h5 style="font-size:13.5px;margin-bottom:6px;">${i===0?ic('trophy',13)+' ':''}${d.r.communityName} · <span class="tag ${d.advice.color}">${d.advice.level}</span></h5>
            <p style="${pStyle}"><strong>推荐理由：</strong>${d.advice.desc}</p>
            <p style="${pStyle}"><strong style="color:var(--success);">${ic('check',12)} 主要优势：</strong>${strengths}${d.r.pros?' · '+d.r.pros.slice(0,40):''}</p>
            <p style="${pStyle}"><strong style="color:var(--warn);">${ic('alert',12)} 主要顾虑：</strong>${weaks}${d.r.cons?' · '+d.r.cons.slice(0,40):''}</p>
            <p style="${pStyle}color:var(--text-3);"><strong>下一步建议：</strong>${
              i===0?'与中介确认房源最新动态+产权/学区情况，尽快安排复看并洽谈价格。':
              (d.m.score>=60?'保持关注，可与中介沟通议价空间，如首推房源不成交可作为Plan B备选。':'继续观望，除非价格大幅下降或有其他利好变化，否则不建议优先考虑。')
            }</p>
          </div>`;
        }).join('')}
      </div>
    `;
    document.getElementById('cmpResult').innerHTML = html;

    if (echarts) {
      const chart = echarts.init(document.getElementById('cmpRadar'));
      const indNames = ['预算','户型','通勤','配套','观感','潜力'];
      const detKeys = ['budget','layout','commute','facility','impression','potential'];
      const colors = ['#0071E3','#2997FF','#FF9F0A','#64D2FF','#BF5AF2'];
      chart.setOption({
        tooltip:{},
        legend:{bottom:0, textStyle:{fontSize:11}},
        radar:{indicator:indNames.map(n=>({name:n,max:100})),center:['50%','52%'],radius:110},
        series:[{type:'radar', data: data.map((d,i)=>({
          name:d.r.communityName,
          value: detKeys.map(k=>d.m.detail[k]||0),
          itemStyle:{color:colors[i%colors.length]},
          areaStyle:{opacity:0.18}
        }))}]
      });
    }
  }

  function renderFullMatrix(data) {
    const rows = [
      ['区域', r=>r.district||'-'],
      ['房屋类型', r=>r.propertyType||'-'],
      ['总价', r=>r.totalPrice?Utils.formatWan(r.totalPrice):'-', false, 'p'],
      ['单价', r=>r.unitPrice?r.unitPrice.toLocaleString()+'元/㎡':'-', false, 'p'],
      ['户型', r=>Utils.formatRooms(r.rooms)],
      ['建筑面积', r=>Utils.formatArea(r.area), true, 'p'],
      ['楼层', r=>r.floor?`${r.floor.current||'-'}/${r.floor.total||'-'}(${r.floor.zone||'-'})`:'-'],
      ['朝向', r=>(r.orientation||'-')+(r.isNorthSouthTransparent?' · 南北通透':'')],
      ['电梯', r=>r.hasElevator==null?'-':(r.hasElevator?'有':'无')],
      ['建成年代', r=>r.buildYear?`${r.buildYear}年 (${Utils.calcHouseAgeText(r.buildYear)})`:'-'],
      ['装修', r=>r.decoration||'-'],
      ['产权年限', r=>r.propertyRights?r.propertyRights+'年':'-'],
      ['满五唯一', r=>r.isFiveYearUnique==null?'-':(r.isFiveYearUnique?'是':'否')],
      ['开发商/物业', r=>r.developer||r.propertyManagement||'-'],
      ['房源来源', r=>r.source||'-'],
      ['总体评分', r=>Utils.renderStars(r.overallRating||0), true],
      ['意向程度', r=>r.intention?`<span class="tag ${Utils.intentionTag(r.intention)} tag-sm">${r.intention}</span>`:'-'],
      ['后续计划', r=>r.nextAction||'-'],
    ];
    let body='';
    rows.forEach(([label, accessor, higher, type]) => {
      const vals = data.map(d => accessor(d.r, d.m));
      // 价格/数值型找最优
      let bestIdx=[], worstIdx=[];
      if (type==='p') {
        const nums = vals.map(v=>{
          if (typeof v === 'number') return v;
          const n = Number(String(v).replace(/[^\d.]/g,''));
          return isNaN(n)?null:n;
        });
        if (nums.every(v=>v!=null)) {
          const target = higher?Math.max(...nums):Math.min(...nums);
          const worst = higher?Math.min(...nums):Math.max(...nums);
          nums.forEach((v,i)=>{if(v===target)bestIdx.push(i);if(target!==worst&&v===worst)worstIdx.push(i);});
        }
      }
      body += `<tr><th>${label}</th>` + vals.map((v,i)=>{
        const cls = bestIdx.includes(i)?'best':(worstIdx.includes(i)?'worst':'');
        return `<td class="${cls}">${v}</td>`;
      }).join('') + '</tr>';
    });
    return `<div style="overflow-x:auto;"><table class="compare-table">
      <thead><tr><th>字段</th>${data.map(d=>`<th>${d.r.communityName}</th>`).join('')}</tr></thead>
      <tbody>${body}</tbody>
    </table></div>`;
  }

  return { render, toggleSel, clearSel, generate };
})();
