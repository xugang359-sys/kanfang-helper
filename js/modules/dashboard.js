/* ============================================
   M7 个人画像仪表盘模块
   ============================================ */
window.DashboardMod = (function() {

  function render() {
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
    const districtBadge = (exp.preferredDistricts||[]).map(d=>`<span class="tag tag-primary tag-sm">${d}</span>`).join(' ');

    const html = `
      <div class="page-header">
        <div>
          <h2><span class="emoji">📊</span>个人画像仪表盘</h2>
          <p class="page-desc">购房计划全貌一览 — 期望、统计、偏好、进度可视化</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-ghost btn-sm" onclick="App.navigate('expectation')">编辑期望档案</button>
          <button class="btn btn-primary btn-sm" onclick="App.navigate('records')">去看房记录</button>
        </div>
      </div>

      <!-- 期望概览 -->
      <div class="card" style="background:linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%);color:#fff;border:none;">
        <div style="display:flex;align-items:center;gap:18px;flex-wrap:wrap;">
          <div style="width:60px;height:60px;border-radius:16px;background:rgba(255,255,255,0.18);display:flex;align-items:center;justify-content:center;font-size:30px;">🎯</div>
          <div style="flex:1;min-width:240px;">
            <h3 style="font-size:15px;margin-bottom:6px;opacity:0.9;">我的购房标准</h3>
            <p style="font-size:14px;line-height:1.8;">
              💰 预算 <strong>${exp.budgetMin||0}-${exp.budgetMax||0}万</strong> |
              🏘️ <strong>${(exp.roomsNeeded.bedrooms||3)}室${(exp.roomsNeeded.livingRooms||2)}厅</strong> |
              📐 ${exp.areaMin||0}-${exp.areaMax||0}㎡ |
              🛗 偏好：${exp.propertyPreference||'都接受'}
            </p>
            <div style="margin-top:6px;">
              ${districtBadge} ${mustHavesBadge}
            </div>
          </div>
        </div>
      </div>

      <!-- 6大核心指标 -->
      <div class="grid-4" style="margin:16px 0;">
        <div class="stat-card blue">
          <div class="stat-icon">🏠</div>
          <div class="stat-label">累计已看房</div>
          <div class="stat-value">${records.length}</div>
          <div class="stat-sub">套房源 · ${Object.keys(distStats).length}个区域</div>
          <div class="progress-bar"><div style="width:${Math.min(100, records.length*5)}%;"></div></div>
        </div>
        <div class="stat-card orange">
          <div class="stat-icon">📋</div>
          <div class="stat-label">待看计划</div>
          <div class="stat-value">${pending.length}</div>
          <div class="stat-sub">${pending.filter(p=>Utils.daysBetween(today,p.date)<=3).length}个近3天 · 已完成${donePlans.length}</div>
        </div>
        <div class="stat-card green">
          <div class="stat-icon">⭐</div>
          <div class="stat-label">重点关注</div>
          <div class="stat-value">${withMatch.filter(w=>w.m.score>=70).length}</div>
          <div class="stat-sub">匹配度 ≥ 70 分房源</div>
        </div>
        <div class="stat-card red">
          <div class="stat-icon">🎯</div>
          <div class="stat-label">最关注区域</div>
          <div class="stat-value" style="font-size:20px;">${topDistrict ? topDistrict[0] : '暂无'}</div>
          <div class="stat-sub">${topDistrict ? '看了 '+topDistrict[1]+' 套' : '开始看房后自动统计'}</div>
        </div>
      </div>

      <div class="grid-2">
        <!-- 购房进度 -->
        <div class="card">
          <div class="card-title">🚀 购房进度</div>
          <div class="workflow-steps" style="margin:14px 0 20px;">
            ${workflow.steps.map((s,i)=>`
              <div class="wf-step ${i<progress?'done':(i===progress?'current':'')}">
                <div class="num">${i+1}</div>
                <div class="label">${s}</div>
              </div>`).join('')}
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;">
            <div style="font-size:12.5px;color:var(--text-2);">
              进度：<strong style="color:var(--primary);">${progress+1}</strong>/9 · 当前阶段：<span class="tag tag-primary">${workflow.steps[progress]||'未开始'}</span>
            </div>
            <button class="btn btn-primary btn-sm" onclick="App.navigate('workflow')">去管理 →</button>
          </div>
        </div>

        <!-- 预算执行情况 -->
        <div class="card">
          <div class="card-title">💰 预算执行情况</div>
          <div style="height:220px;" id="budgetChart"></div>
          <div style="display:flex;justify-content:space-around;font-size:12.5px;margin-top:6px;">
            <span class="tag tag-success">✅ 在预算内：${inBudget}</span>
            <span class="tag tag-warn">⬇️ 低于预期：${underBudget}</span>
            <span class="tag tag-danger">⬆️ 超出预算：${overBudget}</span>
          </div>
        </div>

        <!-- 看房区域分布 -->
        <div class="card">
          <div class="card-title">📍 区域看房分布</div>
          <div style="height:260px;" id="districtChart"></div>
        </div>

        <!-- 房价区间分布 -->
        <div class="card">
          <div class="card-title">💵 看过房源价格区间</div>
          <div style="height:260px;" id="priceChart"></div>
        </div>
      </div>

      <!-- 意向房源 TOP5 -->
      <div class="card">
        <div class="card-title">🏆 意向房源排行 TOP5 <span style="font-size:12px;color:var(--text-3);font-weight:400;">（按匹配度+评分综合排序）</span></div>
        ${records.length===0 ? `<div class="empty-state" style="padding:24px;"><div class="icon">🔍</div><p>还没有房源数据，创建房源记录后自动生成排行。</p></div>`
          : `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;">
            ${top5.map((w,i)=>renderTopCard(w, i+1)).join('')}
          </div>`}
      </div>

      <!-- 户型分布 + 评分走势 -->
      <div class="grid-2">
        <div class="card">
          <div class="card-title">🏘️ 看过户型分布</div>
          <div style="height:260px;" id="roomChart"></div>
        </div>
        <div class="card">
          <div class="card-title">📈 看房评分走势</div>
          <div style="height:260px;" id="ratingChart"></div>
        </div>
      </div>
    `;
    App.setContent(html);

    // 渲染图表
    if (echarts) {
      renderBudgetChart(inBudget, underBudget, overBudget, exp.budgetMin||0, exp.budgetMax||150, records);
      renderDistrictChart(distStats);
      renderPriceChart(priceRange);
      renderRoomChart(roomMap);
      renderRatingChart(records);
    }
  }

  function renderTopCard(w, rank) {
    const r = w.r, m = w.m;
    const advice = Utils.decisionAdvice(m.score, m.hasExpectation);
    const colors = ['#1E3A8A','#3B82F6','#D4A24C','#0EA5E9','#7C3AED'];
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
    // 价格分布箱线/散点
    const prices = records.map(r=>r.totalPrice).filter(Boolean).sort((a,b)=>a-b);
    const avg = prices.length ? (prices.reduce((a,b)=>a+b,0)/prices.length).toFixed(1) : 0;
    chart.setOption({
      grid:{left:60,right:30,top:30,bottom:40},
      tooltip:{trigger:'axis', formatter: params => {
        const p = params[0]; return `${p.name}<br/>${p.seriesName}: ${p.value}万`;
      }},
      xAxis:{type:'category', data: records.map(r=>r.communityName?.slice(0,4)||'-'), axisLabel:{fontSize:10,rotate:30}},
      yAxis:{type:'value', name:'总价(万)', nameTextStyle:{fontSize:11}, axisLabel:{fontSize:11}},
      series:[
        {
          name:'总价', type:'bar', data: records.map(r=>r.totalPrice||0), itemStyle:{color:function(p){
            if (!p.value) return '#ccc';
            if (p.value >= min && p.value <= max) return C.success;
            if (p.value < min) return C.warn;
            return C.danger;
          }}, barMaxWidth:40
        },
        {name:'预算上限', type:'line', data: records.map(()=>max), lineStyle:{color:C.primary,type:'dashed',width:2}, symbol:'none', tooltip:{formatter:'预算上限: '+max+'万'}},
        {name:'预算下限', type:'line', data: records.map(()=>min), lineStyle:{color:C.accent,type:'dashed',width:2}, symbol:'none', tooltip:{formatter:'预算下限: '+min+'万'}},
      ]
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
    chart.setOption({
      tooltip:{trigger:'item', formatter:'{b}: {c}套 ({d}%)'},
      series:[{type:'pie', radius:['40%','70%'], center:['50%','50%'],
        label:{formatter:'{b}\n{c}套'},
        data: data.map(([k,v],i)=>({name:k, value:v, itemStyle:{color:C.palette[i%C.palette.length]}}))
      }]
    });
  }

  function renderPriceChart(range) {
    const C = Utils.theme();
    const chart = echarts.init(document.getElementById('priceChart'));
    const labels = Object.keys(range);
    const vals = Object.values(range);
    const total = vals.reduce((a,b)=>a+b,0) || 1;
    chart.setOption({
      grid:{left:55,right:25,top:25,bottom:35},
      tooltip:{trigger:'axis', formatter: p => {
        const d = p[0]; return `${d.name}<br/>房源数：<b>${d.value}</b> 套 (${(d.value/total*100).toFixed(1)}%)`;
      }},
      xAxis:{type:'category', data:labels, axisLabel:{fontSize:10,interval:0,rotate:15}},
      yAxis:{type:'value', name:'套', nameTextStyle:{fontSize:11}, axisLabel:{fontSize:11}},
      series:[{type:'bar', data:vals, barWidth:'50%',
        label:{show:true, position:'top', formatter:'{c}套'},
        itemStyle:{color:new echarts.graphic.LinearGradient(0,0,0,1,[{offset:0,color:C.primaryLight},{offset:1,color:C.primary}])}
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
      tooltip:{trigger:'item'},
      legend:{bottom:0, textStyle:{fontSize:11}},
      series:[{type:'pie', radius:'60%', roseType:'radius',
        data: entries.map(([k,v])=>({name:k, value:v})),
        label:{formatter:'{b}: {c}套'}
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
      grid:{left:40,right:30,top:30,bottom:40},
      tooltip:{trigger:'axis'},
      legend:{top:0,right:0,textStyle:{fontSize:11}},
      xAxis:{type:'category', data:sorted.map(r=>(r.viewingDate||'').slice(5)||r.communityName?.slice(0,4)||'-'), axisLabel:{fontSize:10,rotate:30}},
      yAxis:{type:'value', max:5},
      series:[
        {name:'总体评分', type:'line', smooth:true, data:sorted.map(r=>r.overallRating||0), symbol:'circle', symbolSize:8, itemStyle:{color:C.primary}, areaStyle:{color:'rgba(15,118,110,0.12)'}},
        {name:'匹配度(/20)', type:'line', smooth:true, data:sorted.map(r=>{ const m=Utils.calcMatchScore(r,Store.getExpectation()).score; return m/20; }), symbol:'diamond', symbolSize:8, itemStyle:{color:C.accent}},
      ]
    });
  }

  return { render };
})();
