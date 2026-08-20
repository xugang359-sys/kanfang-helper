/* ============================================
   M5 房源推荐与推送模块
   ============================================ */
window.RecommendMod = (function() {
  // 模拟南京各板块房源数据（let：可被 localStorage 抓取结果覆盖）
  let SEED_HOUSES = [
    // 江宁
    {communityName:'百家湖花园', district:'江宁', subDistrict:'百家湖', address:'江宁区双龙大道1118号', propertyType:'二手房',
      rooms:{bedrooms:3,livingRooms:2,bathrooms:1}, area:98, floor:{current:8,total:18,zone:'中区'}, orientation:'南',
      isNorthSouthTransparent:true, hasElevator:true, buildYear:2010, totalPrice:138, unitPrice:14082,
      decoration:'精装', developer:'百家湖置业', propertyManagement:'百家湖物业', propertyRights:70, isFiveYearUnique:true,
      source:'线上筛选'},
    {communityName:'九龙湖保利中央公园', district:'江宁', subDistrict:'九龙湖', address:'江宁区长亭街9号', propertyType:'二手房',
      rooms:{bedrooms:3,livingRooms:2,bathrooms:2}, area:108, floor:{current:12,total:26,zone:'中区'}, orientation:'南',
      isNorthSouthTransparent:true, hasElevator:true, buildYear:2016, totalPrice:168, unitPrice:15556,
      decoration:'精装', developer:'保利地产', propertyManagement:'保利物业', propertyRights:70, isFiveYearUnique:false,
      source:'中介推荐'},
    {communityName:'秣陵新城', district:'江宁', subDistrict:'秣陵', address:'江宁区秣陵街道', propertyType:'新房',
      rooms:{bedrooms:3,livingRooms:2,bathrooms:2}, area:110, floor:{current:6,total:18,zone:'低区'}, orientation:'东南',
      isNorthSouthTransparent:true, hasElevator:true, buildYear:2026, totalPrice:175, unitPrice:15909,
      decoration:'精装', developer:'新城地产', propertyManagement:'新城悦物业', propertyRights:70, isFiveYearUnique:false,
      source:'中介推荐'},
    {communityName:'汤山鎏园', district:'江宁', subDistrict:'汤山', address:'江宁区汤山街道', propertyType:'新房',
      rooms:{bedrooms:4,livingRooms:2,bathrooms:2}, area:128, floor:{current:3,total:8,zone:'低区'}, orientation:'南',
      isNorthSouthTransparent:true, hasElevator:true, buildYear:2025, totalPrice:158, unitPrice:12344,
      decoration:'毛坯', developer:'本地开发商', propertyManagement:'汤山物业', propertyRights:70, isFiveYearUnique:false,
      source:'线上筛选'},
    // 浦口
    {communityName:'桥北新村', district:'浦口', subDistrict:'桥北', address:'浦口区桥北板块', propertyType:'二手房',
      rooms:{bedrooms:3,livingRooms:1,bathrooms:1}, area:92, floor:{current:5,total:6,zone:'低区'}, orientation:'东南',
      isNorthSouthTransparent:false, hasElevator:false, buildYear:2008, totalPrice:105, unitPrice:11413,
      decoration:'简装', propertyManagement:'新村物业', propertyRights:70, isFiveYearUnique:false, source:'线上筛选'},
    {communityName:'高新区招商兰溪谷', district:'浦口', subDistrict:'高新区', address:'浦口区高新区兰山路', propertyType:'二手房',
      rooms:{bedrooms:3,livingRooms:2,bathrooms:2}, area:102, floor:{current:15,total:22,zone:'中区'}, orientation:'南',
      isNorthSouthTransparent:true, hasElevator:true, buildYear:2018, totalPrice:145, unitPrice:14216,
      decoration:'精装', developer:'招商蛇口', propertyManagement:'招商物业', propertyRights:70, isFiveYearUnique:false,
      source:'朋友介绍'},
    {communityName:'江浦中海左岸澜庭', district:'浦口', subDistrict:'江浦', address:'浦口区江浦街道', propertyType:'新房',
      rooms:{bedrooms:3,livingRooms:2,bathrooms:2}, area:112, floor:{current:10,total:25,zone:'中区'}, orientation:'南',
      isNorthSouthTransparent:true, hasElevator:true, buildYear:2027, totalPrice:185, unitPrice:16518,
      decoration:'精装', developer:'中海地产', propertyManagement:'中海物业', propertyRights:70, isFiveYearUnique:false,
      source:'中介推荐'},
    // 栖霞
    {communityName:'尧化门新城璞樾和山', district:'栖霞', subDistrict:'尧化门', address:'栖霞区尧化门', propertyType:'新房',
      rooms:{bedrooms:3,livingRooms:2,bathrooms:2}, area:105, floor:{current:8,total:18,zone:'中区'}, orientation:'南',
      isNorthSouthTransparent:true, hasElevator:true, buildYear:2026, totalPrice:158, unitPrice:15048,
      decoration:'精装', developer:'新城地产', propertyManagement:'新城悦物业', propertyRights:70, isFiveYearUnique:false,
      source:'中介推荐'},
    {communityName:'仙林湖万达茂', district:'栖霞', subDistrict:'仙林', address:'栖霞区仙林大道', propertyType:'二手房',
      rooms:{bedrooms:3,livingRooms:2,bathrooms:2}, area:118, floor:{current:16,total:32,zone:'高区'}, orientation:'南',
      isNorthSouthTransparent:true, hasElevator:true, buildYear:2015, totalPrice:178, unitPrice:15085,
      decoration:'精装', developer:'万达地产', propertyManagement:'万象物业', propertyRights:70, isFiveYearUnique:false,
      source:'线上筛选'},
    {communityName:'燕子矶保利国际社区', district:'栖霞', subDistrict:'燕子矶', address:'栖霞区燕子矶', propertyType:'新房',
      rooms:{bedrooms:3,livingRooms:2,bathrooms:2}, area:100, floor:{current:14,total:26,zone:'中区'}, orientation:'东南',
      isNorthSouthTransparent:true, hasElevator:true, buildYear:2026, totalPrice:148, unitPrice:14800,
      decoration:'精装', developer:'保利地产', propertyManagement:'保利物业', propertyRights:70, isFiveYearUnique:false,
      source:'中介推荐'},
    // 雨花台
    {communityName:'铁心桥龙湖春江郦城', district:'雨花台', subDistrict:'铁心桥', address:'雨花台区龙西路', propertyType:'二手房',
      rooms:{bedrooms:3,livingRooms:2,bathrooms:2}, area:106, floor:{current:11,total:24,zone:'中区'}, orientation:'南',
      isNorthSouthTransparent:true, hasElevator:true, buildYear:2019, totalPrice:172, unitPrice:16226,
      decoration:'精装', developer:'龙湖地产', propertyManagement:'龙湖物业', propertyRights:70, isFiveYearUnique:false,
      source:'朋友介绍'},
    {communityName:'板桥吾悦广场', district:'雨花台', subDistrict:'板桥', address:'雨花台区板桥新城', propertyType:'新房',
      rooms:{bedrooms:3,livingRooms:2,bathrooms:1}, area:95, floor:{current:7,total:18,zone:'中区'}, orientation:'南',
      isNorthSouthTransparent:true, hasElevator:true, buildYear:2026, totalPrice:132, unitPrice:13895,
      decoration:'精装', developer:'新城控股', propertyManagement:'新城悦物业', propertyRights:70, isFiveYearUnique:false,
      source:'线上筛选'},
    // 鼓楼
    {communityName:'龙江银城花园', district:'鼓楼', subDistrict:'龙江', address:'鼓楼区龙园西路', propertyType:'二手房',
      rooms:{bedrooms:2,livingRooms:1,bathrooms:1}, area:88, floor:{current:3,total:7,zone:'低区'}, orientation:'南',
      isNorthSouthTransparent:false, hasElevator:false, buildYear:2000, totalPrice:135, unitPrice:15341,
      decoration:'简装', propertyManagement:'银城物业', propertyRights:70, isFiveYearUnique:true,
      source:'中介推荐'},
    // 建邺
    {communityName:'河西南招商雍和府', district:'建邺', subDistrict:'河西', address:'建邺区河西南', propertyType:'新房',
      rooms:{bedrooms:3,livingRooms:2,bathrooms:2}, area:120, floor:{current:16,total:30,zone:'中区'}, orientation:'南',
      isNorthSouthTransparent:true, hasElevator:true, buildYear:2027, totalPrice:228, unitPrice:19000,
      decoration:'豪装', developer:'招商蛇口', propertyManagement:'招商物业', propertyRights:70, isFiveYearUnique:false,
      source:'中介推荐'},
    // 玄武
    {communityName:'红山新城尚华府', district:'玄武', subDistrict:'红山', address:'玄武区红山路', propertyType:'新房',
      rooms:{bedrooms:3,livingRooms:2,bathrooms:2}, area:115, floor:{current:9,total:20,zone:'中区'}, orientation:'南',
      isNorthSouthTransparent:true, hasElevator:true, buildYear:2026, totalPrice:208, unitPrice:18087,
      decoration:'精装', developer:'新城地产', propertyManagement:'新城悦物业', propertyRights:70, isFiveYearUnique:false,
      source:'中介推荐'},
    // 秦淮
    {communityName:'大校场金基望樾府', district:'秦淮', subDistrict:'大校场', address:'秦淮区大校场', propertyType:'新房',
      rooms:{bedrooms:4,livingRooms:2,bathrooms:3}, area:143, floor:{current:14,total:22,zone:'中区'}, orientation:'南',
      isNorthSouthTransparent:true, hasElevator:true, buildYear:2026, totalPrice:258, unitPrice:18042,
      decoration:'豪装', developer:'金基地产', propertyManagement:'金基物业', propertyRights:70, isFiveYearUnique:false,
      source:'线上筛选'},
    // 六合
    {communityName:'雄州龙池湖畔', district:'六合', subDistrict:'雄州', address:'六合区雄州街道', propertyType:'新房',
      rooms:{bedrooms:3,livingRooms:2,bathrooms:2}, area:108, floor:{current:10,total:20,zone:'中区'}, orientation:'南',
      isNorthSouthTransparent:true, hasElevator:true, buildYear:2026, totalPrice:98, unitPrice:9074,
      decoration:'毛坯', developer:'本地开发商', propertyManagement:'六合物业', propertyRights:70, isFiveYearUnique:false,
      source:'线上筛选'},
  ];

  function ensureSeed() {
    const cached = localStorage.getItem('hh_rec_seed');
    if (cached) {
      try {
        const arr = JSON.parse(cached);
        if (Array.isArray(arr) && arr.length) { SEED_HOUSES = arr; return; }
      } catch(e) {}
    }
    localStorage.setItem('hh_rec_seed', JSON.stringify(SEED_HOUSES));
  }

  let curDistrict = '';
  let curKw = '';
  let curMode = 'match'; // match / all / fav
  // 新增筛选条件
  let curYearMin = '', curYearMax = '';   // 建成年份范围
  let curAreaMin = '', curAreaMax = '';   // 面积范围
  let curPriceMin = '', curPriceMax = ''; // 总价范围（万）
  let curOnlyElevator = false;           // 仅看有电梯
  let curOnlyNorthSouth = false;          // 仅看南北通透

  function render() {
    ensureSeed();
    Store.updatePlanStatus();
    const exp = Store.getExpectation();
    const html = `
      <div class="page-header">
        <div>
          <h2><span class="emoji">🔍</span>房源推荐与推送</h2>
          <p class="page-desc">按区域+期望档案自动匹配房源。当前模拟 ${SEED_HOUSES.length} 套南京各板块真实风格房源数据。</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-accent btn-sm" onclick="RecommendMod.refreshPush()">📡 模拟月度刷新</button>
          <button class="btn btn-primary btn-sm" onclick="RecommendMod.requestOnline()">🌐 尝试联网获取最新</button>
        </div>
      </div>

      <div class="filter-bar">
        <input id="recKw" type="text" placeholder="搜索小区名/地址关键字" style="min-width:180px;" value="${curKw}">
        <select id="recDistrict" style="min-width:120px;">
          <option value="">全部区域</option>
          ${Store.DISTRICTS.map(d=>`<option ${curDistrict===d?'selected':''}>${d}</option>`).join('')}
        </select>
        <select id="recMode" style="min-width:140px;">
          <option value="match" ${curMode==='match'?'selected':''}>🎯 按我的期望匹配</option>
          <option value="all">📚 全部房源</option>
          <option value="fav">⭐ 仅收藏</option>
        </select>
        <button class="btn btn-primary btn-sm" onclick="RecommendMod.doFilter()">筛选</button>
        <button class="btn btn-ghost btn-sm" onclick="RecommendMod.resetFilter()">重置</button>
        <button class="btn btn-ghost btn-sm" onclick="RecommendMod.toggleAdvFilter()" id="recAdvToggle">${curYearMin||curYearMax||curAreaMin||curAreaMax||curPriceMin||curPriceMax||curOnlyElevator||curOnlyNorthSouth?'⚙️ 高级筛选 ●':'⚙️ 高级筛选'}</button>
      </div>

      <div id="recAdvPanel" style="display:${curYearMin||curYearMax||curAreaMin||curAreaMax||curPriceMin||curPriceMax||curOnlyElevator||curOnlyNorthSouth?'block':'none'};background:var(--bg-2);border:1px solid var(--border-light);border-radius:10px;padding:12px;margin-top:10px;">
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;">
          <div>
            <label style="font-size:11.5px;color:var(--text-3);">建成年份（起-止）</label>
            <div style="display:flex;gap:6px;align-items:center;">
              <input id="recYearMin" type="number" placeholder="如2000" value="${curYearMin}" style="width:80px;padding:4px 6px;border:1px solid var(--border-light);border-radius:6px;font-size:12.5px;">
              <span style="color:var(--text-3);">—</span>
              <input id="recYearMax" type="number" placeholder="如2026" value="${curYearMax}" style="width:80px;padding:4px 6px;border:1px solid var(--border-light);border-radius:6px;font-size:12.5px;">
            </div>
          </div>
          <div>
            <label style="font-size:11.5px;color:var(--text-3);">面积 ㎡（起-止）</label>
            <div style="display:flex;gap:6px;align-items:center;">
              <input id="recAreaMin" type="number" placeholder="如60" value="${curAreaMin}" style="width:70px;padding:4px 6px;border:1px solid var(--border-light);border-radius:6px;font-size:12.5px;">
              <span style="color:var(--text-3);">—</span>
              <input id="recAreaMax" type="number" placeholder="如150" value="${curAreaMax}" style="width:70px;padding:4px 6px;border:1px solid var(--border-light);border-radius:6px;font-size:12.5px;">
            </div>
          </div>
          <div>
            <label style="font-size:11.5px;color:var(--text-3);">总价 万（起-止）</label>
            <div style="display:flex;gap:6px;align-items:center;">
              <input id="recPriceMin" type="number" placeholder="如80" value="${curPriceMin}" style="width:70px;padding:4px 6px;border:1px solid var(--border-light);border-radius:6px;font-size:12.5px;">
              <span style="color:var(--text-3);">—</span>
              <input id="recPriceMax" type="number" placeholder="如300" value="${curPriceMax}" style="width:70px;padding:4px 6px;border:1px solid var(--border-light);border-radius:6px;font-size:12.5px;">
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;justify-content:flex-end;">
            <label style="font-size:11.5px;color:var(--text-3);display:flex;align-items:center;gap:6px;cursor:pointer;">
              <input type="checkbox" id="recOnlyElevator" ${curOnlyElevator?'checked':''}> 仅看有电梯
            </label>
            <label style="font-size:11.5px;color:var(--text-3);display:flex;align-items:center;gap:6px;cursor:pointer;">
              <input type="checkbox" id="recOnlyNorthSouth" ${curOnlyNorthSouth?'checked':''}> 仅看南北通透
            </label>
          </div>
        </div>
        <div style="margin-top:10px;display:flex;gap:8px;justify-content:flex-end;">
          <button class="btn btn-ghost btn-sm" onclick="RecommendMod.resetAdvFilter()">清空高级条件</button>
          <button class="btn btn-primary btn-sm" onclick="RecommendMod.doFilter()">应用筛选</button>
        </div>
      </div>

      <div id="recResult" style="margin-top:10px;"></div>
    `;
    App.setContent(html);
    doFilter();
  }

  function toggleAdvFilter() {
    const panel = document.getElementById('recAdvPanel');
    if (panel) {
      const isHidden = panel.style.display === 'none';
      panel.style.display = isHidden ? 'block' : 'none';
    }
  }

  function resetAdvFilter() {
    curYearMin=''; curYearMax='';
    curAreaMin=''; curAreaMax='';
    curPriceMin=''; curPriceMax='';
    curOnlyElevator=false; curOnlyNorthSouth=false;
    render();
    Utils.toast('已清空高级筛选条件','info');
  }

  function doFilter() {
    curKw = document.getElementById('recKw')?.value.trim() || curKw;
    curDistrict = document.getElementById('recDistrict')?.value || curDistrict;
    curMode = document.getElementById('recMode')?.value || curMode;
    // 高级筛选
    curYearMin = document.getElementById('recYearMin')?.value || '';
    curYearMax = document.getElementById('recYearMax')?.value || '';
    curAreaMin = document.getElementById('recAreaMin')?.value || '';
    curAreaMax = document.getElementById('recAreaMax')?.value || '';
    curPriceMin = document.getElementById('recPriceMin')?.value || '';
    curPriceMax = document.getElementById('recPriceMax')?.value || '';
    curOnlyElevator = !!document.getElementById('recOnlyElevator')?.checked;
    curOnlyNorthSouth = !!document.getElementById('recOnlyNorthSouth')?.checked;
    // 更新高级筛选按钮状态
    const advToggle = document.getElementById('recAdvToggle');
    if (advToggle) {
      const active = curYearMin||curYearMax||curAreaMin||curAreaMax||curPriceMin||curPriceMax||curOnlyElevator||curOnlyNorthSouth;
      advToggle.textContent = active ? '⚙️ 高级筛选 ●' : '⚙️ 高级筛选';
    }
    renderList();
  }
  function resetFilter() {
    curKw=''; curDistrict=''; curMode='match';
    curYearMin=''; curYearMax=''; curAreaMin=''; curAreaMax='';
    curPriceMin=''; curPriceMax=''; curOnlyElevator=false; curOnlyNorthSouth=false;
    render();
  }

  function renderList() {
    const exp = Store.getExpectation();
    const favs = Store.getFavorites();
    const favIds = new Set(favs.map(f=>f.id));
    let list = [...SEED_HOUSES];
    if (curDistrict) list = list.filter(h=>h.district === curDistrict);
    if (curKw) list = list.filter(h => (h.communityName.includes(curKw) || (h.address||'').includes(curKw)));
    if (curMode === 'fav') list = list.filter(h => favIds.has(h.id || ('seed_'+h.communityName)));
    // 高级筛选
    if (curYearMin) list = list.filter(h => (h.buildYear||0) >= Number(curYearMin));
    if (curYearMax) list = list.filter(h => (h.buildYear||0) <= Number(curYearMax));
    if (curAreaMin) list = list.filter(h => (h.area||0) >= Number(curAreaMin));
    if (curAreaMax) list = list.filter(h => (h.area||0) <= Number(curAreaMax));
    if (curPriceMin) list = list.filter(h => (h.totalPrice||0) >= Number(curPriceMin));
    if (curPriceMax) list = list.filter(h => (h.totalPrice||0) <= Number(curPriceMax));
    if (curOnlyElevator) list = list.filter(h => !!h.hasElevator);
    if (curOnlyNorthSouth) list = list.filter(h => !!h.isNorthSouthTransparent);
    // 赋ID
    list = list.map(h => ({...h, id: 'seed_'+h.communityName}));
    // 匹配
    const withScore = list.map(h => ({h, m: Utils.calcMatchScore(h, exp)}));
    if (curMode === 'match') withScore.sort((a,b)=>b.m.score - a.m.score);
    else withScore.sort((a,b)=>b.h.totalPrice - a.h.totalPrice);

    // 分档：高匹配/中匹配/低匹配
    const groups = {high:[], mid:[], low:[]};
    withScore.forEach(w=>{
      if (w.m.score >= 75) groups.high.push(w);
      else if (w.m.score >= 55) groups.mid.push(w);
      else groups.low.push(w);
    });

    const box = document.getElementById('recResult');
    if (!withScore.length) { box.innerHTML = `<div class="card empty-state"><div class="icon">🔍</div><h4>暂无符合条件的房源</h4><p>试试扩大筛选范围。</p></div>`; return; }

    const html = `
      <div style="margin-bottom:14px;display:flex;gap:10px;flex-wrap:wrap;">
        <span class="tag tag-success tag-sm">🎯 高度匹配 (≥75)：${groups.high.length} 套</span>
        <span class="tag tag-primary tag-sm">✅ 中度匹配 (55-74)：${groups.mid.length} 套</span>
        <span class="tag tag-warn tag-sm">🧐 一般匹配 (<55)：${groups.low.length} 套</span>
        <span style="margin-left:auto;font-size:12.5px;color:var(--text-3);">共找到 <strong>${withScore.length}</strong> 套房源</span>
      </div>
      ${renderCardGroup('⭐ 高度匹配 · 建议优先关注', groups.high)}
      ${renderCardGroup('✅ 中度匹配 · 可纳入对比', groups.mid)}
      ${renderCardGroup('🧐 一般匹配 · 按需参考', groups.low)}
    `;
    box.innerHTML = html;
  }

  function renderCardGroup(title, group) {
    if (!group.length) return '';
    return `
    <div class="card">
      <div class="card-title">${title} <span style="font-weight:400;font-size:12px;color:var(--text-3);">共 ${group.length} 套</span></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px;">
        ${group.map(({h,m})=>{
          const fav = Store.getFavorites().some(f=>f.id===h.id);
          const advice = Utils.decisionAdvice(m.score, m.hasExpectation);
          return `<div class="rec-card" style="cursor:pointer;" onclick="RecommendMod.viewDetail('${h.communityName}')">
            <div style="position:relative;height:160px;border-radius:8px 8px 0 0;overflow:hidden;background:linear-gradient(135deg,#E0E7FF,#FEF3C7);">
              <img src="${coverImage(h,0)}" alt="${h.communityName}" loading="lazy"
                   style="width:100%;height:100%;object-fit:cover;display:block;"
                   onerror="this.style.display='none';this.parentElement.style.background='linear-gradient(135deg,#E0E7FF,#FEF3C7)';">
              <div style="position:absolute;top:8px;left:8px;background:rgba(0,0,0,0.5);color:#fff;padding:2px 8px;border-radius:12px;font-size:11px;backdrop-filter:blur(4px);">
                ${h.district}${h.subDistrict?' · '+h.subDistrict:''}
              </div>
              <button class="btn btn-sm ${fav?'btn-accent':'btn-ghost'}" style="position:absolute;top:6px;right:6px;font-size:14px;padding:2px 8px;background:${fav?'var(--accent)':'rgba(255,255,255,0.9)'};color:${fav?'#fff':'var(--text-2)'};"
                      onclick="event.stopPropagation();RecommendMod.toggleFav('${h.communityName}')" title="收藏">${fav?'⭐':'☆'}</button>
              <div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,0.6));color:#fff;padding:14px 12px 8px;">
                <div style="display:flex;justify-content:space-between;align-items:flex-end;">
                  <strong style="font-size:14px;">${h.communityName}</strong>
                  <div style="text-align:right;">
                    <div style="color:#FBBF24;font-weight:600;font-size:15px;">${Utils.formatWan(h.totalPrice)}</div>
                    <small style="font-size:10px;opacity:0.9;">${h.unitPrice.toLocaleString()}元/㎡</small>
                  </div>
                </div>
              </div>
            </div>
            <div style="padding:10px;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                <span class="tag ${advice.color} tag-sm">${advice.level}</span>
                <span style="font-size:11.5px;color:var(--text-3);">匹配度 ${m.score}</span>
              </div>
              <div style="font-size:12.5px;color:var(--text-2);line-height:1.6;">
                ${Utils.formatRooms(h.rooms)} · ${Utils.formatArea(h.area)} · ${h.buildYear?h.buildYear+'年建':''}
              </div>
              <div style="font-size:11.5px;color:var(--text-3);margin-top:4px;">📍 ${h.address||'-'}</div>
              <div style="margin-top:8px;display:flex;gap:4px;flex-wrap:wrap;">
                ${h.hasElevator?'<span class="tag tag-success tag-sm">电梯</span>':''}
                ${h.isNorthSouthTransparent?'<span class="tag tag-primary tag-sm">南北通透</span>':''}
                ${h.isFiveYearUnique?'<span class="tag tag-success tag-sm">满五唯一</span>':''}
                ${h.decoration?`<span class="tag tag-sm">${h.decoration}</span>`:''}
              </div>
              <div style="margin-top:10px;display:flex;gap:6px;justify-content:flex-end;">
                <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();RecommendMod.toRecord('${h.communityName}')">📝 转记录</button>
                <button class="btn btn-primary btn-sm" onclick="event.stopPropagation();RecommendMod.toPlan('${h.communityName}','${h.district}')">📅 加计划</button>
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }

  // 通用占位图：根据小区名生成确定性图片（picsum.photos seed）
  function coverImage(h, idx=0) {
    const seed = (h.communityName || 'house') + idx;
    const hash = seed.split('').reduce((a,c)=>a + c.charCodeAt(0), 0);
    return `https://picsum.photos/seed/house${hash % 1000}${idx}/600/400`;
  }

  // 高德 Web 服务 Key（供静态图使用）
  function amapSrvKey() { return (localStorage.getItem('k_amap_srv')||'').trim(); }
  function amapJsKey() { return (localStorage.getItem('k_amap_js')||'').trim(); }

  // 高德静态图 URL：用小区真实坐标生成卫星图（zoom 越大越细）
  function staticMapUrl(lngLat, opts={}) {
    const key = amapSrvKey();
    if (!key || !lngLat) return '';
    const zoom = opts.zoom || 17;
    const size = opts.size || '600*400';
    const scale = opts.scale || 2;
    const markers = opts.markers || `mid,0xFF3B30,${lngLat}`;
    return `https://restapi.amap.com/v3/staticmap?key=${encodeURIComponent(key)}&location=${encodeURIComponent(lngLat)}&zoom=${zoom}&size=${size}&scale=${scale}&markers=${encodeURIComponent(markers)}`;
  }

  // 第三方平台外链（在贝壳/链家/安居客搜索该小区真实房源图片）
  function externalLinks(h) {
    const q = encodeURIComponent(h.communityName);
    return [
      { name:'贝壳找房', icon:'🏠', url:`https://nj.ke.com/xiaoqu/rs${q}/` },
      { name:'链家', icon:'🔗', url:`https://nj.lianjia.com/xiaoqu/rs${q}/` },
      { name:'安居客', icon:'📍', url:`https://nanjing.anjuke.com/community/props/sale/1188/#filtersort=${q}` },
      { name:'高德地图', icon:'🗺️', url:`https://uri.amap.com/marker?position=${h._location||''}&name=${encodeURIComponent(h.communityName)}` }
    ];
  }

  // 房源详情查看（含真实小区地图 + 第三方平台外链）
  async function viewDetail(name) {
    const h = SEED_HOUSES.find(s=>s.communityName===name);
    if (!h) { Utils.toast('未找到房源','warn'); return; }
    const exp = Store.getExpectation();
    const m = Utils.calcMatchScore(h, exp);
    const advice = Utils.decisionAdvice(m.score, m.hasExpectation);
    const floorText = h.floor ? `${h.floor.current}/${h.floor.total} (${h.floor.zone})` : '-';
    const srvKey = amapSrvKey();
    const jsKey = amapJsKey();
    const useReal = !!srvKey;

    // 先打开模态框（加载完成前不展示图片，避免占位图闪烁）
    const placeholderHtml = `
      <div style="padding:60px 20px;text-align:center;color:var(--text-3);">
        <div style="font-size:22px;margin-bottom:8px;">⏳</div>
        <div style="font-size:13px;">正在加载房源详情...</div>
      </div>
    `;
    Utils.openModal({ title: '🏠 ' + h.communityName, body: placeholderHtml, size: 'lg' });
    // 防御：确认模态框已正确初始化
    if (!document.getElementById('modalBody')) {
      Utils.toast('模态框初始化失败，请重试', 'warn');
      return;
    }

    // 异步解析小区坐标
    let lngLat = h._location || null;
    if (!lngLat && srvKey) {
      try {
        const url = `https://restapi.amap.com/v3/geocode/geo?key=${encodeURIComponent(srvKey)}&address=${encodeURIComponent(h.communityName)}&city=${encodeURIComponent('南京'+h.district)}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.status === '1' && data.geocodes && data.geocodes[0]) {
          lngLat = data.geocodes[0].location;
          h._location = lngLat; // 缓存到内存对象
        }
      } catch(e) { console.warn('geocode err', e); }
    }

    // 拼接主图 URL（有坐标则用高德静态图，无则回退 picsum）
    const mainImg = (useReal && lngLat)
      ? staticMapUrl(lngLat, { zoom: 17, size: '750*500' })
      : coverImage(h, 0);
    // 缩略图：4 张不同 zoom 的卫星图（或回退 picsum）
    const thumbs = (useReal && lngLat)
      ? [16, 17, 18, 14].map(z => staticMapUrl(lngLat, { zoom: z, size: '200*150' }))
      : [0,1,2,3].map(i => coverImage(h, i));

    const extLinks = externalLinks(h);
    const html = `
      <div>
        <!-- 主图：高德静态卫星图，反映小区真实位置 -->
        <div style="position:relative;height:280px;border-radius:10px;overflow:hidden;margin-bottom:10px;background:linear-gradient(135deg,#E0E7FF,#FEF3C7);">
          <img id="galleryMain" src="${mainImg}" alt="${h.communityName}位置卫星图"
               style="width:100%;height:100%;object-fit:cover;display:block;"
               onerror="this.style.display='none';this.parentElement.style.background='linear-gradient(135deg,#E0E7FF,#FEF3C7)';">
          <div style="position:absolute;top:10px;left:10px;background:rgba(0,0,0,0.6);color:#fff;padding:4px 10px;border-radius:14px;font-size:12px;backdrop-filter:blur(4px);">
            ${h.district}${h.subDistrict?' · '+h.subDistrict:''} · ${h.propertyType}
          </div>
          ${useReal && lngLat ? `<div style="position:absolute;bottom:10px;right:10px;background:rgba(0,0,0,0.5);color:#fff;padding:3px 8px;border-radius:10px;font-size:10.5px;">🌐 高德卫星图 · 真实位置</div>` : ''}
        </div>

        <!-- 缩略图：不同缩放级别的卫星图 -->
        <div style="display:flex;gap:6px;margin-bottom:14px;">
          ${thumbs.map((src, i)=>`<img src="${src}" alt="卫星图${i+1}" loading="lazy"
            onclick="document.getElementById('galleryMain').src='${src}'"
            style="width:64px;height:50px;object-fit:cover;border-radius:6px;cursor:pointer;border:2px solid var(--border-light);"
            onerror="this.style.opacity='0.3';this.style.background='var(--border-light)';">`).join('')}
          <div style="font-size:10.5px;color:var(--text-3);align-self:flex-end;padding:4px 0;">${useReal&&lngLat?'不同缩放级别卫星图':'占位图'}</div>
        </div>

        <!-- 第三方平台外链：跳转到链家/贝壳/安居客查看真实房源照片 -->
        <div class="card" style="padding:10px;margin-bottom:12px;background:linear-gradient(135deg,#FFF7ED,#FFFBEB);border:1px solid #FED7AA;">
          <div style="font-size:12.5px;font-weight:600;margin-bottom:8px;color:#9A3412;">📷 查看真实小区照片（跳转第三方平台）</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            ${extLinks.map(l=>`<a href="${l.url}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm" style="text-decoration:none;font-size:12px;padding:4px 10px;">${l.icon} ${l.name}</a>`).join('')}
          </div>
          <div style="font-size:10.5px;color:var(--text-3);margin-top:6px;">💡 第三方平台有反爬机制，浏览器直接抓取图片会被拦截。点击上方链接在新标签页查看真实房源/小区图片。</div>
        </div>

        <!-- 标题+操作 -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
          <div>
            <h3 style="font-size:17px;margin-bottom:4px;">🏠 ${h.communityName}
              <span class="tag ${advice.color} tag-sm" style="margin-left:6px;">${advice.level}</span>
            </h3>
            <p style="font-size:12px;color:var(--text-3);">${h.address||'-'}</p>
          </div>
          <div style="display:flex;gap:6px;">
            <button class="btn btn-ghost btn-sm" onclick="RecommendMod.toggleFav('${h.communityName}');Utils.closeModal();">⭐ 收藏</button>
            <button class="btn btn-ghost btn-sm" onclick="Utils.closeModal();RecommendMod.toRecord('${h.communityName}')">📝 转为记录</button>
            <button class="btn btn-primary btn-sm" onclick="Utils.closeModal();RecommendMod.toPlan('${h.communityName}','${h.district}')">📅 加计划</button>
          </div>
        </div>

        <!-- 价格+匹配度 -->
        <div class="grid-2" style="margin-bottom:12px;">
          <div class="card" style="padding:12px;">
            <div style="display:flex;align-items:center;gap:14px;">
              ${Utils.matchRingHTML(m.score)}
              <div style="flex:1;">
                <h4 style="font-size:13px;margin-bottom:6px;">综合匹配度</h4>
                <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;font-size:11px;">
                  <div><div style="color:var(--text-3)">预算</div><strong>${m.detail.budget}</strong></div>
                  <div><div style="color:var(--text-3)">户型</div><strong>${m.detail.layout}</strong></div>
                  <div><div style="color:var(--text-3)">通勤</div><strong>${m.detail.commute}</strong></div>
                  <div><div style="color:var(--text-3)">配套</div><strong>${m.detail.facility}</strong></div>
                  <div><div style="color:var(--text-3)">观感</div><strong>${m.detail.impression}</strong></div>
                  <div><div style="color:var(--text-3)">潜力</div><strong>${m.detail.potential}</strong></div>
                </div>
              </div>
            </div>
          </div>
          <div class="card" style="padding:12px;">
            <h4 style="font-size:13px;margin-bottom:8px;">💰 价格信息</h4>
            <div style="font-size:22px;font-weight:700;color:var(--accent);margin-bottom:4px;">${Utils.formatWan(h.totalPrice)}</div>
            <div style="font-size:12px;color:var(--text-3);">单价 <strong style="color:var(--text-1);">${h.unitPrice.toLocaleString()}元/㎡</strong></div>
            <div style="margin-top:8px;font-size:12px;color:var(--text-2);">来源：${h.source||'-'}</div>
          </div>
        </div>

        <!-- 基本信息 -->
        <div class="card" style="padding:12px;">
          <h4 style="font-size:13px;margin-bottom:10px;">📋 基本信息</h4>
          <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;font-size:12.5px;">
            <div><span style="color:var(--text-3);">户型：</span>${Utils.formatRooms(h.rooms)}</div>
            <div><span style="color:var(--text-3);">面积：</span>${Utils.formatArea(h.area)}</div>
            <div><span style="color:var(--text-3);">楼层：</span>${floorText}</div>
            <div><span style="color:var(--text-3);">朝向：</span>${h.orientation||'-'}${h.isNorthSouthTransparent?' · 南北通透':''}</div>
            <div><span style="color:var(--text-3);">电梯：</span>${h.hasElevator?'有':'无'}</div>
            <div><span style="color:var(--text-3);">建成：</span>${h.buildYear?h.buildYear+'年（'+Utils.calcHouseAgeText(h.buildYear)+'）':'-'}</div>
            <div><span style="color:var(--text-3);">装修：</span>${h.decoration||'-'}</div>
            <div><span style="color:var(--text-3);">产权：</span>${h.propertyRights?h.propertyRights+'年':'-'}</div>
            <div><span style="color:var(--text-3);">满五唯一：</span>${h.isFiveYearUnique==null?'-':(h.isFiveYearUnique?'是':'否')}</div>
            <div><span style="color:var(--text-3);">开发商：</span>${h.developer||'-'}</div>
            <div><span style="color:var(--text-3);">物业：</span>${h.propertyManagement||'-'}</div>
          </div>
        </div>

        <!-- 高德 JS API 交互式地图（仅在有 JS Key 时显示） -->
        ${jsKey && lngLat ? `
          <div class="card" style="padding:12px;margin-top:12px;">
            <h4 style="font-size:13px;margin-bottom:8px;">🗺️ 小区周边交互式地图（可缩放/拖动）</h4>
            <div id="recDetailMap" style="height:320px;border-radius:8px;overflow:hidden;border:1px solid var(--border-light);background:#f5f5f5;position:relative;">
              <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:var(--text-3);font-size:12px;">🗺️ 地图加载中...</div>
            </div>
            <div style="margin-top:6px;font-size:11px;color:var(--text-3);">📍 红色标记为小区位置，可点击标记查看详情；滚轮缩放、拖动平移。</div>
          </div>
        ` : ''}

        <div style="margin-top:10px;font-size:11px;color:var(--text-3);text-align:center;padding:8px;background:var(--primary-soft);border-radius:6px;">
          ${useReal && lngLat
            ? '🌐 主图来自高德地图卫星图（真实小区位置），点击上方按钮可在贝壳/链家/安居客查看真实房源照片。'
            : '💡 主图为通用占位图。在 设置 → 联网API配置 中填入高德Key后，将自动显示小区位置真实卫星图。'}
        </div>
      </div>
    `;
    document.getElementById('modalBody').innerHTML = html;

    // 渲染交互式地图
    if (jsKey && lngLat) {
      try {
        await renderDetailMap(lngLat, h);
      } catch(e) {
        console.warn('详情页地图加载失败:', e);
        const mapBox = document.getElementById('recDetailMap');
        if (mapBox) mapBox.innerHTML = `<div style="padding:30px;text-align:center;color:var(--text-3);">⚠️ 地图加载失败：${e.message}</div>`;
      }
    }
  }

  // 详情页交互式地图：单点定位 + InfoWindow
  async function renderDetailMap(lngLat, h) {
    // 复用 location.js 的 SDK 加载逻辑（避免重复加载）
    let AMap = window.AMap;
    if (!AMap) {
      // 动态加载（带 plugin：Scale、ToolBar）
      AMap = await new Promise((resolve, reject) => {
        const cb = '_amap_detail_cb_' + Date.now();
        window[cb] = function() { resolve(window.AMap); try { delete window[cb]; } catch(e) {} };
        const s = document.createElement('script');
        s.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(amapJsKey())}&plugin=AMap.Scale,AMap.ToolBar&callback=${cb}`;
        s.onerror = () => reject(new Error('SDK加载失败'));
        document.head.appendChild(s);
      });
    }
    const [lng, lat] = lngLat.split(',').map(Number);
    const map = new AMap.Map('recDetailMap', {
      zoom: 16, center: [lng, lat], mapStyle: 'amap://styles/normal', viewMode: '2D'
    });
    const marker = new AMap.Marker({
      position: [lng, lat],
      content: `<div style="background:#F5222D;color:#fff;padding:4px 10px;border-radius:14px;font-size:12px;font-weight:600;box-shadow:0 2px 8px rgba(245,34,45,0.4);white-space:nowrap;border:2px solid #fff;">🏠 ${h.communityName}</div>`,
      offset: new AMap.Pixel(-40, -14), anchor: 'center'
    });
    const info = new AMap.InfoWindow({
      content: `<div style="padding:6px 10px;font-size:12px;line-height:1.6;">
        <strong style="color:#F5222D;">🏠 ${h.communityName}</strong><br/>
        📍 ${h.address||'-'}<br/>
        💰 ${Utils.formatWan(h.totalPrice)} · ${h.unitPrice.toLocaleString()}元/㎡<br/>
        📐 ${Utils.formatArea(h.area)} · ${Utils.formatRooms(h.rooms)}<br/>
        🗓️ ${h.buildYear?h.buildYear+'年建':'-'}
      </div>`,
      offset: new AMap.Pixel(0, -24)
    });
    marker.on('click', () => info.open(map, [lng, lat]));
    map.add(marker);
    info.open(map, [lng, lat]);
    // 安全调用插件（避免未加载时报错）
    try { if (AMap.Scale) map.addControl(new AMap.Scale()); } catch(e) {}
    try { if (AMap.ToolBar) map.addControl(new AMap.ToolBar({ position: 'RB', locate: false })); } catch(e) {}
  }

  function toggleFav(name) {
    const h = SEED_HOUSES.find(s=>s.communityName===name);
    if (!h) return;
    const full = {...h, id:'seed_'+name};
    const isFav = Store.toggleFavorite(full);
    Utils.toast(isFav?'已收藏':'已取消收藏','success');
    renderList();
  }

  function toRecord(name) {
    const h = SEED_HOUSES.find(s=>s.communityName===name);
    if (!h) return;
    const id = Store.saveRecord({
      communityName:h.communityName, district:h.district, address:h.address, propertyType:h.propertyType,
      rooms:h.rooms, area:h.area, floor:h.floor, orientation:h.orientation,
      isNorthSouthTransparent:h.isNorthSouthTransparent, hasElevator:h.hasElevator,
      buildYear:h.buildYear, totalPrice:h.totalPrice, unitPrice:h.unitPrice,
      decoration:h.decoration, developer:h.developer, propertyManagement:h.propertyManagement,
      propertyRights:h.propertyRights, isFiveYearUnique:h.isFiveYearUnique,
      source:h.source||'线上筛选', viewingDate:Utils.today(),
      summary:'从推荐列表导入：'+h.communityName,
    });
    RecordsMod.edit(id);
  }

  function toPlan(name, district) {
    Utils.closeModal();
    CalendarMod.edit(null, null);
    setTimeout(()=>{
      const form = document.getElementById('planForm');
      if (!form) return;
      const dist = form.querySelector('[data-field="district"]'); if (dist) dist.value = district;
      const ti = document.getElementById('targetsInput'); if (ti) ti.value = name;
    }, 150);
  }

  function refreshPush() {
    Utils.toast('📡 正在调用方案A：刷新房源数据...','info');
    setTimeout(()=>{
      // 模拟抓取：在原数据基础上小幅调整价格
      const adjusted = SEED_HOUSES.map(h => {
        const delta = (Math.random() - 0.5) * 0.04; // ±2%
        const newPrice = Math.round(h.totalPrice * (1 + delta));
        return { ...h, totalPrice: newPrice, unitPrice: Math.round(newPrice * 10000 / h.area) };
      });
      localStorage.setItem('hh_rec_seed', JSON.stringify(adjusted));
      localStorage.setItem('hh_rec_last_refresh', Utils.today() + ' ' + new Date().toTimeString().slice(0,5));
      Utils.notify('🔔 房源数据已刷新', `本周共更新 ${adjusted.length} 套房源价格，请打开推荐模块查看。`);
      Utils.toast('已模拟方案A抓取，价格小幅波动更新','success');
      // 刷新列表
      render();
    }, 1200);
  }

  async function requestOnline() {
    // 优先尝试贝壳开放平台 API
    if (typeof BeikeMod !== 'undefined' && BeikeMod.isConfigured()) {
      return requestFromBeike();
    }
    Utils.openModal({
      title: '🌐 联网获取最新房源',
      body: `<div style="font-size:13px;line-height:1.9;">
        <p><strong>数据源方案说明：</strong></p>
        <div style="padding:10px;background:var(--primary-soft);border-radius:6px;margin:8px 0;">
          <p>📌 <strong>方案A（推荐 · 已启用）：</strong>使用 TRAE 定时任务，每周一09:00自动抓取南京各板块房源数据（贝壳/链家公开信息）。抓取结果会同步到本模块。</p>
          <p>📌 <strong>方案B：</strong>引导用户在房产平台复制房源链接，粘贴到本工具，自动解析价格/户型/地址等字段。</p>
          <p>📌 <strong>方案C：</strong>对接贝壳开放平台等API（需开发者资质）。</p>
        </div>
        <div style="padding:10px;background:var(--success-soft);border-radius:6px;margin:8px 0;">
          <p>✅ <strong>方案A已配置：</strong>定时任务 <code>每周一 09:00</code> 自动执行。<br>
          📅 最近一次更新：${localStorage.getItem('hh_rec_last_refresh') || '尚未执行过'}<br>
          📦 本地缓存：<strong>${SEED_HOUSES.length}</strong> 套房源（含通用占位图）</p>
        </div>
        <p>当前本地已内置 <strong>${SEED_HOUSES.length}</strong> 套南京真实风格房源数据可直接体验全部功能。点击下方按钮可立即触发一次"模拟刷新"（更新缓存的图片+随机调整价格），实际抓取任务会在每周一执行。</p>
        <p style="color:var(--text-3);font-size:12px;">（注：真实爬虫抓取涉及平台合规与反爬策略，定时任务执行时若遇到反爬验证码会自动跳过该批次。）</p>
      </div>`,
      size:'lg',
      footer:`<button class="btn btn-ghost" onclick="Utils.closeModal()">关闭</button>
        <button class="btn btn-accent" onclick="Utils.closeModal();RecommendMod.refreshPush()">🔄 立即模拟刷新</button>
        <button class="btn btn-primary" onclick="Utils.closeModal();RecommendMod.startManualImport()">📋 粘贴链接手动导入</button>`
    });
  }

  // 尝试调用贝壳开放平台 API 拉取成交案例
  async function requestFromBeike() {
    Utils.openModal({
      title: '🏠 调用贝壳开放平台 API',
      body: `<div style="font-size:13px;line-height:1.8;">
        <p>已检测到贝壳API配置，正在尝试拉取真实成交案例...</p>
        <div id="beikeProgress" style="margin-top:10px;padding:10px;background:var(--primary-soft);border-radius:6px;font-size:12.5px;">⏳ 正在获取 access_token...</div>
      </div>`,
      size:'md',
      footer:`<button class="btn btn-ghost" onclick="Utils.closeModal()">关闭</button>`
    });

    const progress = document.getElementById('beikeProgress');
    const samples = SEED_HOUSES.slice(0, 3);
    const results = [];
    for (const h of samples) {
      if (progress) progress.innerHTML = `🔎 查询 <strong>${h.communityName}</strong> 同小区成交案例...`;
      const r = await BeikeMod.dealCases({
        city: '南京',
        address: h.communityName,
        buildArea: h.area
      });
      results.push({ house: h, result: r });
    }

    let html = '';
    let successCount = 0;
    results.forEach(({ house, result }) => {
      if (result.ok && result.cases && result.cases.length) {
        successCount++;
        html += `<div style="margin:8px 0;padding:10px;background:var(--success-soft);border-radius:6px;">
          <div style="font-weight:600;color:var(--success);">✅ ${house.communityName} - 找到 ${result.cases.length} 套成交案例</div>
          ${result.cases.slice(0,3).map(c=>`<div style="font-size:12px;margin-top:4px;color:var(--text-2);">
            📅 ${c.transDate||'-'} · ${c.frame||'-'} · ${c.buildSize||'-'}㎡ ·
            <strong style="color:var(--primary)">${c.transPrice?Math.round(c.transPrice/10000)+'万':''}</strong>
            (${c.unitPrice?Math.round(c.unitPrice):'-'}元/㎡) · 挂牌${c.listDays||'-'}天
          </div>`).join('')}
        </div>`;
      } else {
        html += `<div style="margin:8px 0;padding:10px;background:var(--warn-soft);border-radius:6px;">
          <div style="font-weight:600;color:var(--warn);">⚠️ ${house.communityName} - ${result.err || '未找到成交案例'}</div>
        </div>`;
      }
    });

    if (successCount > 0) {
      html = `<div style="padding:10px;background:var(--primary-soft);border-radius:6px;margin-bottom:10px;">
        🎉 成功获取 ${successCount}/${results.length} 个小区的真实成交数据！数据已展示在下方。
      </div>` + html;
    } else {
      html = `<div style="padding:10px;background:var(--danger-soft);border-radius:6px;margin-bottom:10px;">
        ❌ 所有查询均失败。可能原因：① AppKey/AppSecret 错误；② 未开通"成交案例库"产品权限；③ 浏览器CORS限制。
        建议：在系统设置中点击"测试连接"排查，或改用"粘贴链接手动导入"。
      </div>` + html;
    }

    if (progress) {
      progress.innerHTML = html;
    }
    Utils.toast(successCount>0 ? `贝壳API成功获取${successCount}个小区数据` : '贝壳API调用失败，详见弹窗', successCount>0?'success':'warn');
  }
  function startManualImport() {
    Utils.openModal({title:'手动导入房源', body:`
      <p style="font-size:12.5px;margin-bottom:10px;">粘贴从贝壳/链家等平台复制的房源链接（或直接填写关键信息）：</p>
      <div class="form-grid">
        <div class="form-item full"><label>房源链接</label><input type="text" id="imp_url" placeholder="https://nj.ke.com/ershoufang/xxxxx.html"></div>
        <div class="form-item"><label>小区名称</label><input type="text" id="imp_comm"></div>
        <div class="form-item"><label>总价（万）</label><input type="number" id="imp_price"></div>
      </div>
      `, footer:`<button class="btn btn-ghost" onclick="Utils.closeModal()">取消</button>
        <button class="btn btn-primary" onclick="RecommendMod.doManualImport()">解析并创建记录</button>`});
  }
  function doManualImport() {
    const comm = document.getElementById('imp_comm').value.trim();
    const price = Number(document.getElementById('imp_price').value) || 0;
    if (!comm) { Utils.toast('至少填写小区名称','warn'); return; }
    const id = Store.saveRecord({communityName: comm, totalPrice: price, viewingDate: Utils.today(),
      source: '链接导入', summary:'手动粘贴导入的房源，待完善其他信息'});
    Utils.closeModal();
    RecordsMod.edit(id);
    Utils.toast('已创建，建议补充完整字段','success');
  }

  return { render, doFilter, resetFilter, renderList, toggleFav, toRecord, toPlan, refreshPush, requestOnline, startManualImport, doManualImport, viewDetail, toggleAdvFilter, resetAdvFilter };
})();
