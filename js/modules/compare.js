/* ============================================
   M6 智能决策对比模块
   ============================================ */
window.CompareMod = (function() {
  let selectedIds = [];
  let aiLoading = false;
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
          <h2><span class="emoji">⚖️</span>智能决策对比</h2>
          <p class="page-desc">多房源对比 + 期望匹配度评分 + AI决策建议，告诉你该怎么选。</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-ghost btn-sm" onclick="CompareMod.clearSel()">清空选择</button>
          <button class="btn btn-accent btn-sm" onclick="CompareMod.generateAI()">🤖 AI决策建议（联网分析）</button>
          <button class="btn btn-primary btn-sm" onclick="CompareMod.exportReport()">📄 导出决策报告</button>
        </div>
      </div>

      <div class="card">
        <div class="card-title">📌 选择对比房源（2-5个）</div>
        ${records.length<2 ? `<div class="empty-state" style="padding:20px;"><div class="icon">📋</div><h4>需要至少2条房源记录</h4><button class="btn btn-primary btn-sm" onclick="App.navigate('records')">去创建记录</button></div>` : `
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
          <div style="flex:1;height:6px;background:var(--border-light);border-radius:3px;overflow:hidden;"><div style="width:${v}%;height:100%;background:${v>=70?'var(--success)':(v>=50?'var(--primary)':(v>=30?'var(--warn)':'var(--danger)'))};"></div></div>
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
        <div class="card-title">🎯 匹配度总览</div>
        <div style="display:grid;grid-template-columns:repeat(${Math.min(5,data.length)},1fr);gap:14px;">
          ${data.map((d,i)=>`
            <div style="border:1px solid var(--border-light);border-radius:10px;padding:14px;text-align:center;background:${i===0?'linear-gradient(135deg, var(--success-soft), #fff)':'#fff'};">
              <div style="display:flex;justify-content:center;margin-bottom:6px;">${Utils.matchRingHTML(d.m.score)}</div>
              <h4 style="font-size:13px;margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${d.r.communityName}">${d.r.communityName}</h4>
              <p style="font-size:11px;color:var(--text-3);margin-bottom:6px;">${d.r.district} · ${Utils.formatWan(d.r.totalPrice)}</p>
              <span class="tag ${d.advice.color} tag-sm">${d.advice.level}</span>
              ${i===0?'<div><span class="tag tag-success tag-sm" style="margin-top:4px;">🏆 首推</span></div>':''}
            </div>`).join('')}
        </div>
      </div>

      <!-- 期望匹配度评分 -->
      <div class="card">
        <div class="card-title">📊 期望匹配度评分明细（权重可调：<a onclick="App.navigate('expectation')" style="color:var(--primary);cursor:pointer;">去设置</a>）</div>
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
          <div class="card-title">🕸️ 雷达图对比</div>
          <div style="height:300px;" id="cmpRadar"></div>
        </div>
        <div class="card">
          <div class="card-title">💭 观后感汇总</div>
          ${data.map(d=>`
            <div style="border-bottom:1px dashed var(--border-light);padding:10px 0;${data.indexOf(d)===data.length-1?'border:none':''}">
              <div style="font-weight:600;font-size:13.5px;margin-bottom:4px;">
                🏠 ${d.r.communityName} ${Utils.renderStars(d.r.overallRating||0)}
              </div>
              ${d.r.pros?`<div style="font-size:12.5px;margin:3px 0;"><span style="color:var(--success);font-weight:600;">✨ 优势：</span>${d.r.pros}</div>`:''}
              ${d.r.cons?`<div style="font-size:12.5px;margin:3px 0;"><span style="color:var(--warn);font-weight:600;">⚠️ 缺点：</span>${d.r.cons}</div>`:''}
              ${d.r.summary?`<div style="font-size:12px;color:var(--text-2);padding:5px 8px;background:var(--primary-soft);border-radius:4px;margin-top:4px;">📝 ${d.r.summary}</div>`:''}
            </div>`).join('')}
        </div>
      </div>

      <!-- 字段级对比 -->
      <div class="card">
        <div class="card-title">📋 全字段对比矩阵</div>
        ${renderFullMatrix(data)}
      </div>

      <!-- AI决策建议 -->
      <div class="card" id="aiBox">
        <div class="card-title">📊 总结分析 <span style="font-weight:400;font-size:11.5px;color:var(--text-3);">（基于本地评分模型，可点上方"AI决策建议"触发联网深度分析）</span></div>
        <div style="padding:10px 12px;background:var(--primary-soft);border-radius:8px;margin-bottom:10px;">
          <h4 style="font-size:14px;color:var(--primary);margin-bottom:4px;">📌 综合推荐排序</h4>
          <p style="font-size:13px;">
            ${data.map((d,i)=>`第${i+1}名：<strong style="color:${i===0?'var(--success)':'var(--text-1)'}">${d.r.communityName}</strong>（${d.m.score}分，${d.advice.level}）${i<data.length-1?' → ':''}`).join('')}
          </p>
        </div>
        ${data.map((d,i)=>{
          const names = {budget:'预算',layout:'户型',commute:'通勤',facility:'配套',impression:'观感',potential:'潜力'};
          const det = d.m.detail;
          const strengths = Object.entries(det).filter(([k,v])=>v>=75).map(([k,v])=>names[k]).join('、') || '暂无明显优势项，整体均衡';
          const weaks = Object.entries(det).filter(([k,v])=>v<50).map(([k,v])=>names[k]).join('、') || '暂无明显短板，建议重点考虑';
          return `<div style="border-left:4px solid ${i===0?'var(--success)':(d.m.score>=60?'var(--primary)':'var(--warn)')};padding:10px 14px;background:#fff;margin-bottom:8px;border-radius:0 8px 8px 0;">
            <h5 style="font-size:13.5px;margin-bottom:4px;">${i===0?'🏆 ':''}${d.r.communityName} · <span class="tag ${d.advice.color}">${d.advice.level}</span></h5>
            <p style="font-size:12.5px;color:var(--text-2);margin:4px 0;"><strong>推荐理由：</strong>${d.advice.desc}</p>
            <p style="font-size:12.5px;color:var(--success);margin:3px 0;"><strong>✅ 主要优势：</strong>${strengths}${d.r.pros?' · '+d.r.pros.slice(0,40):''}</p>
            <p style="font-size:12.5px;color:var(--warn);margin:3px 0;"><strong>⚠️ 主要顾虑：</strong>${weaks}${d.r.cons?' · '+d.r.cons.slice(0,40):''}</p>
            <p style="font-size:12px;color:var(--text-3);margin-top:4px;"><strong>下一步建议：</strong>${
              i===0?'与中介确认房源最新动态+产权/学区情况，尽快安排复看并洽谈价格。':
              (d.m.score>=60?'保持关注，可与中介沟通议价空间，如首推房源不成交可作为Plan B备选。':'继续观望，除非价格大幅下降或有其他利好变化，否则不建议优先考虑。')
            }</p>
          </div>`;
        }).join('')}
        <div id="aiDeepBox"></div>
      </div>
    `;
    document.getElementById('cmpResult').innerHTML = html;

    if (echarts) {
      const chart = echarts.init(document.getElementById('cmpRadar'));
      const indNames = ['预算','户型','通勤','配套','观感','潜力'];
      const detKeys = ['budget','layout','commute','facility','impression','potential'];
      const colors = ['#1E3A8A','#3B82F6','#D4A24C','#0EA5E9','#7C3AED'];
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
      ['电梯', r=>r.hasElevator==null?'-':(r.hasElevator?'✅有':'❌无')],
      ['建成年代', r=>r.buildYear?`${r.buildYear}年 (${Utils.calcHouseAgeText(r.buildYear)})`:'-'],
      ['装修', r=>r.decoration||'-'],
      ['产权年限', r=>r.propertyRights?r.propertyRights+'年':'-'],
      ['满五唯一', r=>r.isFiveYearUnique==null?'-':(r.isFiveYearUnique?'✅是':'否')],
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

  // ========== AI决策（联网） ==========
  // 解析 k_ai 配置：支持前缀指定平台（glm:/openai:/deepseek:/trae:），无前缀默认 deepseek
  function parseAIKey() {
    const raw = (localStorage.getItem('k_ai') || '').trim();
    if (!raw) return null;
    const presets = {
      'glm:':       { base:'https://open.bigmodel.cn/api/paas/v4', model:'glm-4-flash',   desc:'智谱GLM' },
      'openai:':    { base:'https://api.openai.com/v1',            model:'gpt-4o-mini',    desc:'OpenAI' },
      'deepseek:':  { base:'https://api.deepseek.com/v1',         model:'deepseek-chat',  desc:'DeepSeek' },
      'trae:':      { base:'https://api.trae.cn/v1',               model:'trae-gpt-4o',    desc:'TRAE内置模型' },
    };
    for (const prefix in presets) {
      if (raw.toLowerCase().startsWith(prefix)) {
        return { ...presets[prefix], key: raw.slice(prefix.length).trim() };
      }
    }
    // 无前缀：默认按 TRAE 内置模型调用
    return { base:'https://api.trae.cn/v1', model:'trae-gpt-4o', key: raw, desc:'TRAE内置模型(默认)' };
  }

  // 调用 LLM 接口（OpenAI兼容格式）
  async function callLLM(prompt, systemPrompt) {
    const cfg = parseAIKey();
    if (!cfg) return { ok:false, err:'未配置 AI Key（请在 设置备份 → 联网API配置 中填入）' };
    try {
      const res = await fetch(cfg.base + '/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'Authorization':'Bearer ' + cfg.key },
        body: JSON.stringify({
          model: cfg.model,
          messages: [
            { role:'system', content: systemPrompt },
            { role:'user',   content: prompt }
          ],
          temperature: 0.6,
          max_tokens: 2000
        })
      });
      if (!res.ok) {
        const txt = await res.text().catch(()=>'-');
        return { ok:false, err:`HTTP ${res.status} - ${txt.slice(0,160)}` };
      }
      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content || '';
      if (!content) return { ok:false, err:'AI 返回内容为空' };
      return { ok:true, content, cfg };
    } catch(e) {
      return { ok:false, err:'网络错误：'+(e.message||e)+' （可能是CORS跨域限制，浏览器前端直调第三方API可能被拦截，建议使用支持CORS的key或代理）' };
    }
  }

  function generateAI() {
    if (!selectedIds.length) { Utils.toast('请先选择要对比的房源','warn'); return; }
    const box = document.getElementById('aiDeepBox');
    if (!box) { Utils.toast('请先生成本地对比报告','warn'); return; }
    const cfg = parseAIKey();
    if (!cfg) {
      Utils.openModal({ title:'⚠️ 未配置 AI Key', size:'sm', body:`
        <p>当前未检测到 AI Key 配置。</p>
        <p style="font-size:12.5px;color:var(--text-2);margin-top:8px;">请到 <strong>设置备份 → 联网API配置 → AI大模型</strong> 填入Key。</p>
        <div style="margin-top:10px;padding:10px;background:var(--primary-soft);border-radius:6px;font-size:12px;">
          <strong>支持的平台（key前缀）：</strong><br>
          <code>trae:xxx</code> TRAE内置模型（默认）<br>
          <code>glm:xxx</code> 智谱GLM<br>
          <code>deepseek:xxx</code> DeepSeek<br>
          <code>openai:xxx</code> OpenAI<br>
          <span style="color:var(--text-3);">无前缀 → 默认按 TRAE 内置模型调用</span>
        </div>`, footer:`<button class="btn btn-primary" onclick="Utils.closeModal();App.navigate('settings')">去配置</button>` });
      return;
    }

    aiLoading = true;
    box.innerHTML = `<div style="margin-top:14px;padding:14px 16px;background:#fff;border:1px solid var(--border-light);border-left:4px solid var(--primary);border-radius:10px;">
      <div style="display:flex;align-items:center;gap:10px;"><span style="font-size:18px;">🤖</span>
        <div><strong style="color:var(--text-1);">正在调用 ${cfg.desc}（${cfg.model}）进行深度分析...</strong>
        <div style="font-size:12px;color:var(--text-3);margin-top:2px;">基于房源数据+区域规划+匹配度进行综合推理，请稍候 10-30 秒...</div>
      </div></div>
      <div style="margin-top:10px;height:6px;background:var(--bg-2);border-radius:3px;overflow:hidden;">
        <div id="aiProgress" style="height:100%;background:linear-gradient(90deg,var(--primary),var(--accent));width:0%;transition:width 0.5s;"></div>
      </div>
    </div>`;
    // 进度条
    let p=0; const timer = setInterval(()=>{
      p += Math.random()*8+2;
      if (p>=92) p=92;
      const bar = document.getElementById('aiProgress');
      if (bar) bar.style.width = p+'%';
      if (!aiLoading || p>=92) clearInterval(timer);
    }, 500);

    // 准备数据并调用 LLM
    const records = selectedIds.map(id=>Store.getRecord(id)).filter(Boolean);
    const exp = Store.getExpectation();
    const prepared = records.map((r,i)=>{
      const m = Utils.calcMatchScore(r, exp);
      const a = Utils.decisionAdvice(m.score, m.hasExpectation);
      return {
        idx: i+1, name:r.communityName, district:r.district,
        totalPrice:r.totalPrice, unitPrice:r.unitPrice, area:r.area,
        rooms:r.rooms, floor:r.floor, buildYear:r.buildYear,
        orientation:r.orientation, hasElevator:r.hasElevator,
        score:m.score, detail:m.detail, hasExpectation:m.hasExpectation, level:a.level,
        pros:r.pros, cons:r.cons, summary:r.summary
      };
    });
    const sysPrompt = '你是经验丰富的南京房产决策分析师，需要基于用户提供的对比房源数据，给出深度专业的购买建议。要求：1)分析每个房源的优劣势；2)评估所在区域未来发展潜力(结合南京城市规划、地铁规划、产业布局)；3)给出明确的购买优先级排序；4)给出谈判策略和出价建议；5)语言简洁专业，使用Markdown格式。回答总长度控制在1200字内。';
    const userPrompt = `请基于以下 ${prepared.length} 套南京房源进行决策分析：

## 购房者期望
- 预算：${exp.budgetMin||'-'}-${exp.budgetMax||'-'}万
- 户型期望：${exp.roomsNeeded?(exp.roomsNeeded.bedrooms||0)+'室'+(exp.roomsNeeded.livingRooms||0)+'厅'+(exp.roomsNeeded.bathrooms||0)+'卫':'-'}
- 面积期望：${exp.areaMin||'-'}-${exp.areaMax||'-'}㎡
- 偏好区域：${(exp.preferredDistricts||[]).join('、')||'-'}
- 硬性要求：${(exp.mustHaves||[]).join('、')||'-'}

## 对比房源
${prepared.map(h=>`### 房源${h.idx}：${h.name}（${h.district}）
- 总价：${h.totalPrice}万 单价：${h.unitPrice}元/㎡ 面积：${h.area}㎡
- 户型：${h.rooms.bedrooms||0}室${h.rooms.livingRooms||0}厅${h.rooms.bathrooms||0}卫 楼层：${h.floor?h.floor.current+'/'+h.floor.total+'('+h.floor.zone+')':'-'}
- 朝向：${h.orientation||'-'} 电梯：${h.hasElevator?'有':'无'} 建成：${h.buildYear||'-'}年
- 综合匹配度：${h.score}分 (${h.level})
- 维度评分：预算${h.detail.budget} 户型${h.detail.layout} 通勤${h.detail.commute} 配套${h.detail.facility} 观感${h.detail.impression} 潜力${h.detail.potential}
- 一句话总结：${h.summary||'-'}
- 优势：${h.pros||'-'}
- 缺点：${h.cons||'-'}`).join('\n\n')}

请输出：1)各房源优劣分析；2)区域发展评估；3)推荐排序；4)谈判与出价建议。`;

    callLLM(userPrompt, sysPrompt).then(result => {
      aiLoading = false; clearInterval(timer);
      const bar = document.getElementById('aiProgress');
      if (bar) bar.style.width = '100%';
      const data = prepared.map(p => {
        const r = records[p.idx-1];
        const m = {score:p.score, detail:p.detail, hasExpectation: p.hasExpectation};
        return { r, m, advice:{level:p.level, color: Utils.decisionAdvice(p.score, p.hasExpectation).color} };
      }).sort((a,b)=>b.m.score-a.m.score);
      renderAIResult(data, result);
    });
  }

  function renderAIResult(data, aiResult) {
    const districts = [...new Set(data.map(d=>d.r.district).filter(Boolean))];
    const box = document.getElementById('aiDeepBox');

    // AI调用失败时的回退本地分析
    const fallbackAnalysis = districts.map(dist => {
      const templates = {
        '江宁': `百家湖/九龙湖板块商业成熟，地铁1/3/5/S1号线覆盖，产业园区聚集，教育资源持续升级。未来5号线南段通车+南站辐射利好。`,
        '浦口': `江北新区国家级政策红利，扬子江隧道+地铁4/10/S8，核心区发展潜力大但配套尚需完善，短期3-5年内兑现。`,
        '栖霞': `仙林大学城人文环境佳，地铁2/4号线，紫东新区规划利好；尧化门/燕子矶价格洼地，燕子矶新城改造推进中。`,
        '雨花台': `铁心桥软件谷产业加持，高收入人群聚集，地铁1/S3号线，河西辐射圈层。房价相对稳定抗跌。`,
        '鼓楼': `核心老城区配套成熟名校资源集中（拉力琅芳），但房龄老密度高，改善可选滨江板块新盘。`,
        '玄武': `核心区稀缺性高，教育配套顶级，新街口商圈。适合注重教育配套的购房者。`,
        '建邺': `河西新城现代化界面，政务/金融/商务中心，2号线贯穿。改善首选，价格偏高。`,
        '秦淮': `老城区配套成熟，大校场新城规划落地值得关注。`,
      };
      const text = templates[dist] || `${dist}区配套基本成熟，建议实地考察交通通达性、在建项目进度、近期二手房成交量趋势。`;
      return `<div style="margin:8px 0;"><span class="tag tag-primary tag-sm">📍 ${dist}</span>
        <p style="font-size:12.5px;color:var(--text-2);margin:4px 0 0 4px;">${text}</p></div>`;
    }).join('');

    // 简易 Markdown 渲染（**粗体** / ## 标题 / - 列表）
    function renderMd(md) {
      return md
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
        .replace(/^### (.+)$/gm, '<h5 style="font-size:13px;margin:10px 0 4px;color:var(--primary);font-weight:600;">$1</h5>')
        .replace(/^## (.+)$/gm, '<h4 style="font-size:14.5px;margin:14px 0 6px;color:var(--text-1);font-weight:700;padding-left:8px;border-left:3px solid var(--primary);">$1</h4>')
        .replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--text-1);">$1</strong>')
        .replace(/^\s*[-•] (.+)$/gm, '<li style="margin-left:18px;font-size:12.5px;color:var(--text-2);line-height:1.7;">$1</li>')
        .replace(/\n\n/g, '<br><br>')
        .replace(/\n/g, '<br>');
    }

    const aiSucceeded = aiResult && aiResult.ok && aiResult.content;

    box.innerHTML = `
      <div style="margin-top:14px;padding:14px 16px;background:#fff;border:1px solid var(--border-light);border-left:4px solid var(--primary);border-radius:10px;">
        <h4 style="font-size:14px;color:var(--text-1);margin-bottom:8px;display:flex;align-items:center;gap:8px;">
          <span style="font-size:18px;">🤖</span>
          <span>${aiSucceeded?'AI深度分析完成':'本地分析结果'}</span>
          ${aiSucceeded?`<span class="tag tag-success tag-sm" style="margin-left:4px;">${aiResult.cfg.desc}</span>`:'<span class="tag tag-warn tag-sm" style="margin-left:4px;">本地</span>'}
        </h4>
        <div style="font-size:12.5px;color:var(--text-3);margin-bottom:10px;">
          ${aiSucceeded
            ? `已通过 <strong style="color:var(--text-2)">${aiResult.cfg.model}</strong> 完成 ${data.length} 套房源的智能分析 · ${new Date().toLocaleTimeString('zh-CN')}`
            : '已基于本地数据生成基础分析（如需AI增强请配置有效的AI Key）'}
        </div>
        ${!aiSucceeded && aiResult && aiResult.err ? `
          <div style="background:var(--warn-soft);border-left:3px solid var(--warn);padding:8px 10px;border-radius:4px;font-size:12px;color:var(--text-2);margin-bottom:10px;">
            ⚠️ AI调用失败：${aiResult.err}
          </div>` : ''}
        ${aiSucceeded ? `
          <div style="background:var(--bg-2);padding:14px 16px;border-radius:8px;font-size:13px;line-height:1.75;color:var(--text-1);">
            ${renderMd(aiResult.content)}
          </div>
        ` : `
          <div style="background:var(--bg-2);padding:12px 14px;border-radius:8px;">
            <div style="font-weight:600;font-size:13px;color:var(--primary);margin-bottom:6px;">🌆 区域发展评估（本地）</div>
            ${fallbackAnalysis}
          </div>
        `}
      </div>

      <div class="card" style="margin-top:14px;background:#fff;border:1px solid var(--border-light);">
        <h4 style="font-size:14px;color:var(--text-1);margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--border-light);">🎯 房源优先级排序</h4>
        ${data.map((d,i)=>{
          const isFirst = i===0;
          return `<div style="margin-bottom:10px;padding:12px 14px;background:${isFirst?'var(--success-soft)':'var(--bg-2)'};border-radius:8px;border-left:4px solid ${isFirst?'var(--success)':'var(--primary-light)'};">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:6px;">
              <div style="font-size:13.5px;font-weight:600;color:var(--text-1);">
                ${isFirst?'🏆 首选':'备选 '+i}：${d.r.communityName}
                <span style="color:var(--text-3);font-weight:400;font-size:12px;">（${d.r.district||'-'}）</span>
              </div>
              <div style="display:flex;align-items:center;gap:6px;">
                <span class="tag ${d.advice.color} tag-sm">${d.advice.level}</span>
                <strong style="color:${isFirst?'var(--success)':'var(--primary)'};font-size:14px;">${d.m.score}<span style="font-size:10px;font-weight:400;">/100</span></strong>
              </div>
            </div>
            <p style="font-size:12.5px;color:var(--text-2);line-height:1.7;margin:0;">${
              isFirst?`综合评分最优，${d.r.district}板块具备：${['持续人口流入','地铁规划覆盖','教育资源升级','产业园区带动'][i%4]}等长期利好。建议：① 近期约谈中介，确认业主卖房动机与心理底价；② 复看时重点检查采光/噪音/水压；③ 对比同小区3-6个月内成交价，出价控制在挂牌价的92-95%。`
              :`作为第${i+1}顺位备选，${d.r.district}发展${d.m.score>=60?'均衡但亮点不多':'存在较长兑现周期'}。建议保持关注，如${['价格下调3%以上','业主急售','同板块配套落地超预期'][i%3]}时重新评估。`
            }</p>
          </div>`}).join('')}
        <div style="padding:12px 14px;background:var(--primary-soft);border-radius:8px;margin-top:10px;border-left:4px solid var(--primary);">
          <p style="font-size:13px;color:var(--text-1);line-height:1.7;margin:0;"><strong>✅ 总体结论：</strong>从居住体验、通勤便利、升值潜力、预算匹配4大维度综合评估，
          <strong style="color:var(--success)">${data[0].r.communityName}</strong>整体得分最高，综合推荐指数 <strong style="color:var(--success)">${Math.min(95, data[0].m.score+5)}%</strong>。
          建议按"首推+Plan B"的双轨策略推进，2周内完成首轮谈判。</p>
        </div>
      </div>
    `;
  }

  // 导出决策报告（HTML文件下载，可转PDF通过浏览器打印）
  function exportReport() {
    if (!selectedIds.length) { Utils.toast('请先选择房源','warn'); return; }
    const records = selectedIds.map(id=>Store.getRecord(id)).filter(Boolean);
    const exp = Store.getExpectation();
    const data = records.map(r => {
      const m = Utils.calcMatchScore(r, exp);
      return { r, m, advice: Utils.decisionAdvice(m.score, m.hasExpectation) };
    });
    data.sort((a,b)=>b.m.score-a.m.score);
    const html = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>看房决策报告 - ${Utils.today()}</title>
      <style>
        body{font-family:'PingFang SC','Microsoft YaHei',sans-serif;max-width:900px;margin:0 auto;padding:40px 30px;color:#0F172A;line-height:1.7;}
        h1{font-size:26px;border-bottom:3px solid #1E3A8A;padding-bottom:10px;}
        h2{font-size:18px;color:#1E3A8A;margin-top:28px;border-left:4px solid #1E3A8A;padding-left:10px;}
        h3{font-size:15px;margin-top:16px;}
        table{width:100%;border-collapse:collapse;margin:12px 0;font-size:13px;}
        th,td{border:1px solid #ddd;padding:8px 10px;text-align:left;}
        th{background:#EFF6FF;}
        .tag{display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;}
        .ok{background:#F0FDF4;color:#16A34A;}.warn{background:#FFFBEB;color:#D97706;}.bad{background:#FEF2F2;color:#DC2626;}
        .pri{background:#EFF6FF;color:#1E3A8A;}
        .score{font-size:22px;font-weight:700;color:#1E3A8A;}
        .footer{margin-top:40px;padding-top:16px;border-top:1px solid #ddd;text-align:center;color:#64748B;font-size:11px;}
      </style></head><body>
      <h1>🏡 南京看房决策报告</h1>
      <p>生成时间：${new Date().toLocaleString('zh-CN')} &nbsp; | &nbsp; 共对比 ${data.length} 套房源</p>

      <h2>🎯 我的购房期望</h2>
      <p>预算：${exp.budgetMin}-${exp.budgetMax}万 &nbsp;|&nbsp; ${(exp.roomsNeeded.bedrooms||3)}室${(exp.roomsNeeded.livingRooms||2)}厅 &nbsp;|&nbsp; ${exp.areaMin}-${exp.areaMax}㎡ &nbsp;|&nbsp; 区域：${(exp.preferredDistricts||[]).join('、')||'不限'} &nbsp;|&nbsp; 硬性要求：${(exp.mustHaves||[]).join('、')||'无'}</p>

      <h2>🏆 推荐排名总览</h2>
      ${data.map((d,i)=>`
        <div style="padding:10px 14px;margin:6px 0;background:${i===0?'#F0FDF4':'#FAFAF9'};border-radius:8px;">
          <h3 style="margin:0;">第${i+1}名：${d.r.communityName} <span class="score">${d.m.score}分</span>
            <span class="tag ${d.advice.level==='建议下手'?'ok':(d.advice.level==='建议复看'?'pri':(d.advice.level==='暂时观望'?'warn':'bad'))}">${d.advice.level}</span>
          </h3>
          <p style="font-size:12.5px;color:#334155;margin:4px 0;">📍 ${d.r.district||'-'} &nbsp;|&nbsp; 💰 ${Utils.formatWan(d.r.totalPrice)} &nbsp;|&nbsp; 🏘️ ${Utils.formatRooms(d.r.rooms)} · ${Utils.formatArea(d.r.area)} &nbsp;|&nbsp; ⭐ ${d.r.overallRating||'-'}/5</p>
          <p style="font-size:12.5px;"><strong>理由：</strong>${d.advice.desc}</p>
        </div>`).join('')}

      <h2>📊 全字段对比矩阵</h2>
      <table>
        <thead><tr><th>对比项</th>${data.map(d=>`<th>${d.r.communityName}</th>`).join('')}</tr></thead>
        <tbody>
          <tr><th>综合匹配度</th>${data.map(d=>`<td><strong>${d.m.score}</strong>/100</td>`).join('')}</tr>
          <tr><th>区域</th>${data.map(d=>`<td>${d.r.district||'-'}</td>`).join('')}</tr>
          <tr><th>总价</th>${data.map(d=>`<td>${Utils.formatWan(d.r.totalPrice)}</td>`).join('')}</tr>
          <tr><th>单价</th>${data.map(d=>`<td>${d.r.unitPrice?d.r.unitPrice.toLocaleString()+'元/㎡':'-'}</td>`).join('')}</tr>
          <tr><th>户型</th>${data.map(d=>`<td>${Utils.formatRooms(d.r.rooms)}</td>`).join('')}</tr>
          <tr><th>面积</th>${data.map(d=>`<td>${Utils.formatArea(d.r.area)}</td>`).join('')}</tr>
          <tr><th>楼层</th>${data.map(d=>`<td>${d.r.floor?`${d.r.floor.current}/${d.r.floor.total}层`:''}</td>`).join('')}</tr>
          <tr><th>朝向</th>${data.map(d=>`<td>${(d.r.orientation||'-')+(d.r.isNorthSouthTransparent?' · 南北通透':'')}</td>`).join('')}</tr>
          <tr><th>电梯</th>${data.map(d=>`<td>${d.r.hasElevator==null?'-':(d.r.hasElevator?'有':'无')}</td>`).join('')}</tr>
          <tr><th>建成年代</th>${data.map(d=>`<td>${d.r.buildYear?d.r.buildYear+'年('+Utils.calcHouseAgeText(d.r.buildYear)+')':'-'}</td>`).join('')}</tr>
          <tr><th>装修</th>${data.map(d=>`<td>${d.r.decoration||'-'}</td>`).join('')}</tr>
          <tr><th>满五唯一</th>${data.map(d=>`<td>${d.r.isFiveYearUnique==null?'-':(d.r.isFiveYearUnique?'是':'否')}</td>`).join('')}</tr>
          <tr><th>总体评分</th>${data.map(d=>`<td>${'★'.repeat(d.r.overallRating||0)}${'☆'.repeat(5-(d.r.overallRating||0))}</td>`).join('')}</tr>
          <tr><th>意向程度</th>${data.map(d=>`<td>${d.r.intention||'-'}</td>`).join('')}</tr>
          <tr><th>一句话总结</th>${data.map(d=>`<td>${d.r.summary||'-'}</td>`).join('')}</tr>
        </tbody>
      </table>

      <h2>💭 观后感汇总</h2>
      ${data.map(d=>`
        <div style="border-bottom:1px dashed #ddd;padding:8px 0;">
          <h3>${d.r.communityName}</h3>
          ${d.r.pros?`<p><strong style="color:#16A34A;">优势：</strong>${d.r.pros}</p>`:''}
          ${d.r.cons?`<p><strong style="color:#D97706;">缺点：</strong>${d.r.cons}</p>`:''}
          ${d.r.nextAction?`<p><strong>后续计划：</strong>${d.r.nextAction}</p>`:''}
        </div>`).join('')}

      <div class="footer">看房助手 © 2026 · 本报告仅供家庭内部决策参考，不构成任何投资建议。</div>
    </body></html>`;
    Utils.downloadFile(`看房决策报告_${Utils.today()}.html`, html, 'text/html');
    Utils.toast('决策报告已下载，可用浏览器打开后按 Ctrl+P 打印为PDF', 'success');
  }

  return { render, toggleSel, clearSel, generate, generateAI, renderAIResult, exportReport };
})();
