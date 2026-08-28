/* ============================================
   M7 看房画像模块
   ============================================ */
window.DashboardMod = (function() {

  function render() {
    const ic = Utils.icon;   // SF Symbols 风格图标
    const exp = Store.getExpectation();
    const records = Store.getRecords();
    const plans = Store.getPlans();
    Store.updatePlanStatus();
    const workflow = Store.getWorkflow();

    const today = Utils.today();
    const pending = plans.filter(p=>p.status==='pending');
    const donePlans = plans.filter(p=>p.status==='done');

    // 统计计算
    const distStats = {};
    records.forEach(r => { if (r.district) distStats[r.district] = (distStats[r.district]||0) + 1; });
    const topDistrict = Object.entries(distStats).sort((a,b)=>b[1]-a[1])[0];

    // 价格分布
    const priceRange = { '100万内':0, '100-120万':0, '120-150万':0, '150-200万':0, '200万以上':0 };
    records.forEach(r => {
      const p = r.totalPrice;
      if (!p) return;
      if (p < 100) priceRange['100万内']++;
      else if (p < 120) priceRange['100-120万']++;
      else if (p < 150) priceRange['120-150万']++;
      else if (p < 200) priceRange['150-200万']++;
      else priceRange['200万以上']++;
    });

    // 户型分布
    const roomMap = {};
    records.forEach(r => {
      if (!r.rooms) return;
      const key = `${r.rooms.bedrooms||0}室${r.rooms.livingRooms||0}厅`;
      roomMap[key] = (roomMap[key]||0) + 1;
    });

    // TOP意向房源
    const withMatch = records.map(r => ({r, m: Utils.calcMatchScore(r, exp)}));
    withMatch.sort((a,b)=>b.m.score - a.m.score);
    const top5 = withMatch.slice(0, 5);

    // 购房进度
    const progress = workflow.currentStep || 0;

    // 预算执行
    const inBudget = records.filter(r => r.totalPrice && r.totalPrice >= (exp.budgetMin||0) && r.totalPrice <= (exp.budgetMax||Infinity)).length;
    const overBudget = records.filter(r => r.totalPrice && r.totalPrice > (exp.budgetMax||Infinity)).length;
    const underBudget = records.filter(r => r.totalPrice && r.totalPrice < (exp.budgetMin||0)).length;

    const mustHavesBadge = (exp.mustHaves||[]).slice(0,5).map(m=>`<span class="tag tag-accent tag-sm">${m}</span>`).join(' ');
    const prefAreas = Store.getPreferredAreas();
    const districtBadge = prefAreas.length
      ? prefAreas.map(a=>`<span class="tag tag-primary tag-sm">${a.districts.length ? a.city+'·'+a.districts.join('/') : a.city+'（全城）'}</span>`).join(' ')
      : '<span class="tag tag-sm">不限</span>';
    // 期望档案未填写时展示"未设置"，避免误导
    const noBudget = !exp.budgetMin && !exp.budgetMax;
    const noRooms = !exp.roomsNeeded || (!exp.roomsNeeded.bedrooms && !exp.roomsNeeded.livingRooms);
    const noArea = !exp.areaMin && !exp.areaMax;
    const budgetTxt = noBudget ? '未设置' : `${exp.budgetMin||0}-${exp.budgetMax||0}万`;
    const roomsTxt = noRooms ? '未设置' : `${exp.roomsNeeded.bedrooms}室${exp.roomsNeeded.livingRooms}厅`;
    const areaTxt = noArea ? '未设置' : `${exp.areaMin||0}-${exp.areaMax||0}㎡`;
    const prefTxt = exp.propertyPreference || '未设置';

    const html = `
      <div class="page-shell">
      <div class="page-header">
        <div>
          <h2><span class="emoji">${ic('chart')}</span>看房画像</h2>
          <p class="page-desc">购房计划全貌一览 — 期望、统计、偏好、进度可视化</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-ghost btn-sm" onclick="App.navigate('expectation')">编辑期望档案</button>
          <button class="btn btn-primary btn-sm" onclick="App.navigate('records')">去看房记录</button>
        </div>
      </div>

      <!-- AI 宣传横幅 -->
      <div class="ai-banner" onclick="App.navigate('chat')" role="button" tabindex="0" aria-label="向 AI 购房管家提问">
        <div class="ai-banner-icon" aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 8V4M8 4h8"/><circle cx="9" cy="14" r="1"/><circle cx="15" cy="14" r="1"/></svg>
        </div>
        <div class="ai-banner-text">
          <b>AI 购房管家「贾维斯」已就绪</b>
          <span>预算、政策、匹配度，随时问我 —— 聪明决策，从一问开始</span>
        </div>
        <div class="ai-banner-btn">向贾维斯提问
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        </div>
      </div>

      <!-- 期望概览 -->
      <div class="card">
        <div style="display:flex;align-items:center;gap:18px;flex-wrap:wrap;">
          <div style="width:60px;height:60px;border-radius:16px;background:var(--primary-soft);display:flex;align-items:center;justify-content:center;color:var(--primary);">${ic('target',30)}</div>
          <div style="flex:1;min-width:240px;">
            <h3 style="font-size:15px;margin-bottom:6px;color:var(--text-1);">我的购房标准</h3>
            <p style="font-size:14px;line-height:1.8;display:flex;align-items:center;gap:14px;flex-wrap:wrap;color:var(--text-2);">
              <span>${ic('wallet',14)} 预算 <strong>${budgetTxt}</strong></span>
              <span>${ic('houses',14)} <strong>${roomsTxt}</strong></span>
              <span>${ic('ruler',14)} ${areaTxt}</span>
              <span>${ic('elevator',14)} 偏好：${prefTxt}</span>
            </p>
            <div style="margin-top:6px;">
              ${districtBadge} ${mustHavesBadge}
            </div>
          </div>
        </div>
      </div>

      <!-- 6大核心指标 -->
      <div class="grid-4" style="margin:18px 0;">
        <div class="stat-card blue">
          <div class="stat-icon">${ic('house')}</div>
          <div class="stat-label">累计已看房</div>
          <div class="stat-value">${records.length}</div>
          <div class="stat-sub">套房源 · ${Object.keys(distStats).length}个区域</div>
        </div>
        <div class="stat-card orange">
          <div class="stat-icon">${ic('list')}</div>
          <div class="stat-label">待看计划</div>
          <div class="stat-value">${pending.length}</div>
          <div class="stat-sub">${pending.filter(p=>Utils.daysBetween(today,p.date)<=3).length}个近3天 · 已完成${donePlans.length}</div>
        </div>
        <div class="stat-card green">
          <div class="stat-icon">${ic('star')}</div>
          <div class="stat-label">重点关注</div>
          <div class="stat-value">${withMatch.filter(w=>w.m.score>=70).length}</div>
          <div class="stat-sub">匹配度 ≥ 70 分房源</div>
        </div>
        <div class="stat-card red">
          <div class="stat-icon">${ic('target')}</div>
          <div class="stat-label">最关注区域</div>
          <div class="stat-value" style="font-size:20px;">${topDistrict ? topDistrict[0] : '暂无'}</div>
          <div class="stat-sub">${topDistrict ? '看了 '+topDistrict[1]+' 套' : '开始看房后自动统计'}</div>
        </div>
      </div>

      <div class="grid-2">
        <!-- 购房进度 -->
        <div class="card">
          <div class="card-title">${ic('rocket')} 购房进度</div>
          <div class="wf-segments">
            ${workflow.steps.map((s,i)=>`
              <div class="wf-seg ${i<progress?'done':(i===progress?'current':'')}" title="${i+1}. ${s}">
                <i></i><span>${s}</span>
              </div>`).join('')}
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;">
            <div style="font-size:12.5px;color:var(--text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              进度 <strong style="color:var(--primary);">${progress+1}</strong>/${workflow.steps.length} · 当前阶段：<span class="tag tag-primary">${workflow.steps[progress]||'未开始'}</span>
            </div>
            <button class="btn btn-primary btn-sm" style="flex-shrink:0;" onclick="App.navigate('workflow')">去管理 →</button>
          </div>
        </div>

        <!-- 预算执行情况 -->
        <div class="card">
          <div class="card-title">${ic('wallet')} 预算执行情况</div>
          <div style="height:200px;" id="budgetChart"></div>
        </div>

        <!-- 看房区域分布 -->
        <div class="card">
          <div class="card-title">${ic('pin')} 区域看房分布</div>
          <div style="height:215px;" id="districtChart"></div>
        </div>

        <!-- 房价区间分布 -->
        <div class="card">
          <div class="card-title">${ic('coin')} 看过房源价格区间</div>
          <div style="height:215px;" id="priceChart"></div>
        </div>
      </div>

      <!-- 意向房源 TOP5 -->
      <div class="card">
        <div class="card-title">${ic('trophy')} 意向房源排行 TOP5 <span style="font-size:12px;color:var(--text-3);font-weight:400;">（按匹配度+评分综合排序）</span></div>
        ${records.length===0 ? `<div class="empty-state" style="padding:24px;"><div class="icon">${ic('search',54)}</div><p>还没有房源数据，创建房源记录后自动生成排行。</p></div>`
          : `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;">
            ${top5.map((w,i)=>renderTopCard(w, i+1)).join('')}
          </div>`}
      </div>

      <!-- 户型分布 + 评分走势 -->
      <div class="grid-2">
        <div class="card">
          <div class="card-title">${ic('houses')} 看过户型分布</div>
          <div style="height:215px;" id="roomChart"></div>
        </div>
        <div class="card">
          <div class="card-title">${ic('trend')} 看房评分走势</div>
          <div style="height:215px;" id="ratingChart"></div>
        </div>
      </div>
      </div>
    `;
    App.setContent(html);

    // 渲染图表（echarts 按需加载：首屏 DOM 先显示，图表就绪后补绘）
    Utils.ensureEcharts().then(() => {
      renderBudgetChart(inBudget, underBudget, overBudget, exp.budgetMin||0, exp.budgetMax||150, records);
      renderDistrictChart(distStats);
      renderPriceChart(priceRange);
      renderRoomChart(roomMap);
      renderRatingChart(records);
    }).catch(() => {});
  }

  function renderTopCard(w, rank) {
    const r = w.r, m = w.m;
    const advice = Utils.decisionAdvice(m.score, m.hasExpectation);
    const colors = ['#0071E3','#2997FF','#FF9F0A','#64D2FF','#BF5AF2'];
    return `<div style="position:relative;border:1px solid var(--border-light);border-radius:12px;padding:14px;cursor:pointer;" onclick="RecordsMod.view('${r.id}')">
      <div style="position:absolute;top:-8px;left:14px;width:32px;height:32px;border-radius:50%;background:${colors[rank-1]};color:#fff;font-weight:700;display:flex;align-items:center;justify-content:center;box-shadow:var(--shadow-sm);">${rank}</div>
      <div style="display:flex;gap:12px;align-items:center;margin-top:10px;">
        ${Utils.matchRingHTML(m.score)}
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${r.communityName}</div>
          <div style="font-size:12px;color:var(--text-3);margin:3px 0;">${r.district} · ${Utils.formatRooms(r.rooms)} · ${Utils.formatWan(r.totalPrice)}</div>
          <span class="tag ${advice.color} tag-sm">${advice.level}</span>
        </div>
      </div>
      <div style="margin-top:8px;padding-top:8px;border-top:1px dashed var(--border-light);font-size:12px;color:var(--text-2);">
        ${Utils.renderStars(r.overallRating||0)} ${r.summary?'· '+r.summary:''}
      </div>
    </div>`;
  }

  function renderBudgetChart(inB, underB, overB, min, max, records) {
    const C = Utils.theme();
    const chart = echarts.init(document.getElementById('budgetChart'));
    const rows = [
      {name:'低于预算', value:underB, color:C.warn},
      {name:'在预算内', value:inB, color:C.success},
      {name:'超出预算', value:overB, color:C.danger},
    ];
    chart.setOption({
      grid:{left:10,right:46,top:10,bottom:5,containLabel:true},
      tooltip:{trigger:'axis', axisPointer:{type:'shadow'}, formatter:p=>`${p[0].name}<br/><b>${p[0].value}</b> 套`},
      xAxis:{type:'value', splitLine:{lineStyle:{color:'#F0F1F4'}}, axisLabel:{fontSize:11, color:C.text3}},
      yAxis:{type:'category', data:rows.map(r=>r.name), axisLine:{show:false}, axisTick:{show:false}, axisLabel:{fontSize:12, color:C.text2}},
      series:[{type:'bar', barWidth:16,
        data:rows.map(r=>({value:r.value, itemStyle:{color:r.color, borderRadius:8}})),
        label:{show:true, position:'right', formatter:'{c}套', fontSize:11, color:C.text3}
      }]
    });
  }

  function renderDistrictChart(stats) {
    const C = Utils.theme();
    const chart = echarts.init(document.getElementById('districtChart'));
    const data = Object.entries(stats);
    if (!data.length) {
      chart.setOption({title:{text:'暂无可展示数据，开始看房后自动统计',left:'center',top:'center',textStyle:{fontSize:12,color:C.text3}}});
      return;
    }
    const total = data.reduce((a,[k,v])=>a+v,0);
    chart.setOption({
      tooltip:{trigger:'item', formatter:'{b}: {c}套 ({d}%)'},
      legend:{bottom:0, icon:'circle', itemWidth:8, itemHeight:8, textStyle:{fontSize:11, color:C.text2}},
      series:[{
        type:'pie', radius:['42%','68%'], center:['50%','44%'], avoidLabelOverlap:true,
        itemStyle:{borderRadius:6, borderColor:'#fff', borderWidth:2},
        label:{show:false},
        emphasis:{label:{show:true, formatter:'{b}\n{c}套', fontWeight:600, fontSize:12}},
        data: data.map(([k,v],i)=>({name:k, value:v, itemStyle:{color:C.palette[i%C.palette.length]}}))
      }],
      graphic:{elements:[
        {type:'text', left:'center', top:'36%', style:{text:String(total), fontSize:26, fontWeight:800, fill:C.text1}},
        {type:'text', left:'center', top:'52%', style:{text:'总看房(套)', fontSize:11, fill:C.text3}}
      ]}
    });
  }

  function renderPriceChart(range) {
    const C = Utils.theme();
    const chart = echarts.init(document.getElementById('priceChart'));
    const labels = Object.keys(range);
    const vals = Object.values(range);
    const total = vals.reduce((a,b)=>a+b,0) || 1;
    chart.setOption({
      grid:{left:10,right:15,top:32,bottom:5,containLabel:true},
      tooltip:{trigger:'axis', formatter: p => {
        const d = p[0]; return `${d.name}<br/>房源数：<b>${d.value}</b> 套 (${(d.value/total*100).toFixed(1)}%)`;
      }},
      xAxis:{type:'category', data:labels, axisLabel:{fontSize:10,interval:0,rotate:15}, axisLine:{lineStyle:{color:'#E5E5EA'}}},
      yAxis:{type:'value', name:'套', nameTextStyle:{fontSize:11}, axisLabel:{fontSize:11, color:C.text3}, splitLine:{lineStyle:{color:'#F0F1F4'}}},
      series:[{type:'bar', data:vals, barWidth:'46%',
        label:{show:true, position:'top', formatter:'{c}套', fontSize:10, color:C.text3},
        itemStyle:{color:C.primary, borderRadius:[8,8,0,0]}
      }]
    });
  }

  function renderRoomChart(map) {
    const C = Utils.theme();
    const chart = echarts.init(document.getElementById('roomChart'));
    const entries = Object.entries(map);
    if (!entries.length) {
      chart.setOption({title:{text:'暂无可展示数据',left:'center',top:'center',textStyle:{fontSize:12,color:C.text3}}});
      return;
    }
    chart.setOption({
      tooltip:{trigger:'item', formatter:'{b}: {c}套 ({d}%)'},
      legend:{bottom:0, textStyle:{fontSize:11, color:C.text2}},
      series:[{type:'pie', radius:'62%', center:['50%','44%'], roseType:'radius',
        itemStyle:{borderRadius:5, borderColor:'#fff', borderWidth:2},
        data: entries.map(([k,v])=>({name:k, value:v})),
        label:{formatter:'{b}\n{c}套', fontSize:11, color:C.text2}
      }]
    });
  }

  function renderRatingChart(records) {
    const C = Utils.theme();
    const chart = echarts.init(document.getElementById('ratingChart'));
    const sorted = [...records].sort((a,b)=>(a.viewingDate||'').localeCompare(b.viewingDate||''));
    if (!sorted.length) {
      chart.setOption({title:{text:'暂无可展示数据',left:'center',top:'center',textStyle:{fontSize:12,color:C.text3}}});
      return;
    }
    chart.setOption({
      grid:{left:10,right:15,top:30,bottom:5,containLabel:true},
      tooltip:{trigger:'axis'},
      legend:{top:0,right:0,textStyle:{fontSize:11}},
      xAxis:{type:'category', data:sorted.map(r=>(r.viewingDate||'').slice(5)||r.communityName?.slice(0,4)||'-'), axisLabel:{fontSize:10,rotate:30}, axisLine:{lineStyle:{color:'#E5E5EA'}}},
      yAxis:{type:'value', max:5, axisLabel:{fontSize:11, color:C.text3}, splitLine:{lineStyle:{color:'#F0F1F4'}}},
      series:[
        {name:'总体评分', type:'line', smooth:true, data:sorted.map(r=>r.overallRating||0), symbol:'circle', symbolSize:6, itemStyle:{color:C.primary}, lineStyle:{width:2.5}},
        {name:'匹配度(/20)', type:'line', smooth:true, data:sorted.map(r=>{ const m=Utils.calcMatchScore(r,Store.getExpectation()).score; return m/20; }), symbol:'diamond', symbolSize:6, itemStyle:{color:C.accent}, lineStyle:{width:2.5}},
      ]
    });
  }

  return { render };
})();
