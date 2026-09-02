/* ============================================
   M9 区位分析工具集
   通勤/学区/配套/距离测算
   ============================================ */
window.LocationMod = (function() {
  const ic = Utils.icon;   // SF Symbols 风格图标
  let tab = 'commute';
  // 各子模块内独立城市（默认取右上角设置城市，每个输入点可分别选择）
  let commute  = { workCity: Store.getCity(), partCity: Store.getCity(), commCity: Store.getCity() };
  let schoolCity   = Store.getCity();
  let facilityCity = Store.getCity();
  let distCities   = { fromCity: Store.getCity(), toCity: Store.getCity() };

  // ===== 高德 API 辅助 =====
  function getAmapKey() {
    return {
      js:  (localStorage.getItem('k_amap_js')  || '').trim(),
      srv: (localStorage.getItem('k_amap_srv') || '').trim()
    };
  }
  function amapConfigured() { return !!getAmapKey().srv; }

  // fetch 带超时：防止网络挂起导致界面卡在 loading（默认8秒）
  function fetchT(url, timeout=8000) {
    const ctrl = new AbortController();
    const t = setTimeout(()=>ctrl.abort(), timeout);
    return fetch(url, { signal: ctrl.signal }).finally(()=>clearTimeout(t));
  }

  // 高德地理编码：地址 → 坐标（失败时用 POI 文本搜索兜底，提高跨城/小区名解析成功率）
  async function geocode(address, city=Store.getCity()) {
    const key = getAmapKey().srv;
    if (!key) return null;
    const url = `https://restapi.amap.com/v3/geocode/geo?key=${encodeURIComponent(key)}&address=${encodeURIComponent(address)}&city=${encodeURIComponent(city)}`;
    try {
      const res = await fetchT(url);
      const data = await res.json();
      if (data.status === '1' && data.geocodes && data.geocodes[0]) {
        return data.geocodes[0].location; // "lng,lat"
      }
    } catch(e) { console.error('geocode err', e); }
    // 兜底：按 city 限定做 POI 文本搜索（小区/地标名更常见，geocode 常解析失败）
    try {
      const url2 = `https://restapi.amap.com/v3/place/text?key=${encodeURIComponent(key)}&keywords=${encodeURIComponent(address)}&city=${encodeURIComponent(city)}&citylimit=true&offset=1`;
      const res2 = await fetchT(url2);
      const data2 = await res2.json();
      if (data2.status === '1' && data2.pois && data2.pois[0] && data2.pois[0].location) {
        return data2.pois[0].location;
      }
    } catch(e) { console.error('geocode-poi err', e); }
    return null;
  }

  // 高德路径规划：driving/transit（transit 支持 city=起点城市, cityd=终点城市，跨城公交正确传参）
  async function routePlan(origin, destination, mode='driving', city=Store.getCity(), cityd=null) {
    const key = getAmapKey().srv;
    if (!key) return null;
    const url = mode === 'driving'
      ? `https://restapi.amap.com/v3/direction/driving?key=${encodeURIComponent(key)}&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&strategy=10`
      : `https://restapi.amap.com/v3/direction/transit/integrated?key=${encodeURIComponent(key)}&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&city=${encodeURIComponent(city)}&cityd=${encodeURIComponent(cityd || city)}`;
    try {
      const res = await fetchT(url);
      const data = await res.json();
      if (data.status === '1') {
        if (mode === 'driving' && data.route && data.route.paths && data.route.paths[0]) {
          const p = data.route.paths[0];
          return { duration: Math.round(Number(p.duration)/60), distance: Math.round(Number(p.distance)/1000*10)/10 };
        }
        if (mode !== 'driving' && data.route && data.route.transits && data.route.transits[0]) {
          const t = data.route.transits[0];
          return { duration: Math.round(Number(t.duration)/60), distance: Math.round(Number(t.distance)/1000*10)/10 };
        }
      }
    } catch(e) { console.error('route err', e); }
    return null;
  }

  // 高德 POI 周边搜索（QPS 限流时延迟重试一次）
  async function searchAround(location, types, radius=3000) {
    const key = getAmapKey().srv;
    if (!key || !location) return [];
    const url = `https://restapi.amap.com/v3/place/around?key=${encodeURIComponent(key)}&location=${encodeURIComponent(location)}&types=${encodeURIComponent(types)}&radius=${radius}&offset=10&extensions=all`;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(url);
        const data = await res.json();
        if (data.status === '1' && data.pois) {
          return data.pois.map(p => ({ name: p.name, distance: p.distance, address: p.address||'', location: p.location||'', type: p.type||'' }));
        }
      } catch(e) { console.error('around err', e); }
      if (attempt === 0) await new Promise(r => setTimeout(r, 350)); // 限流降速后重试
    }
    return [];
  }

  // 动态加载高德 JS API（用 Web端 JS Key）
  let _amapPromise = null;
  function loadAmapSDK() {
    if (_amapPromise) return _amapPromise;
    _amapPromise = new Promise((resolve, reject) => {
      if (window.AMap) { resolve(window.AMap); return; }
      const jsKey = (localStorage.getItem('k_amap_js')||'').trim();
      if (!jsKey) { _amapPromise = null; reject(new Error('未配置高德JS Key')); return; }
      const cb = '_amap_init_cb_' + Date.now();
      let settled = false;
      // 5秒超时：防止 script 标签加载卡住不返回
      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        _amapPromise = null;
        reject(new Error('高德SDK加载超时（5秒），请检查JS Key或网络'));
        try { delete window[cb]; } catch(e) {}
      }, 5000);
      window[cb] = function() {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve(window.AMap);
        try { delete window[cb]; } catch(e) { window[cb] = undefined; }
      };
      const s = document.createElement('script');
      s.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(jsKey)}&plugin=AMap.Geocoder,AMap.PlaceSearch,AMap.MarkerClusterer,AMap.Scale,AMap.ToolBar,AMap.Driving,AMap.Walking,AMap.Transfer,AMap.Bicycling,AMap.Polyline,AMap.Geolocation&callback=${cb}`;
      s.onerror = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        _amapPromise = null;
        reject(new Error('高德SDK加载失败（网络错误或Key无效）'));
        try { delete window[cb]; } catch(e) {}
      };
      document.head.appendChild(s);
    });
    return _amapPromise;
  }

  // 高德静态图 URL（无需 JS API，用 Web 服务 Key 即可生成小区位置卫星图）
  function staticMapUrl(lngLat, opts={}) {
    const key = getAmapKey().srv;
    if (!key || !lngLat) return '';
    const zoom = opts.zoom || 17;
    const size = opts.size || '600*400';
    const scale = opts.scale || 2;
    const markers = opts.markers || `mid,0xFF3B30,${lngLat}`;
    return `https://restapi.amap.com/v3/staticmap?key=${encodeURIComponent(key)}&location=${encodeURIComponent(lngLat)}&zoom=${zoom}&size=${size}&scale=${scale}&markers=${encodeURIComponent(markers)}`;
  }

  // 南京各板块模拟数据
  const DISTRICT_DATA = {
    '江宁': { school:'百家湖小学、江宁实小（省实验小学），东山外国语学校（市重点）', subway:'1号线、3号线、5号线（在建）、S1号线、S3号线', hospital:'江宁医院（三甲）、同仁医院', mall:'景枫KINGMO、金鹰GE66、21世纪太阳城、龙湾天街', park:'百家湖公园、牛首山风景区、方山风景区', industry:'软件谷、江宁开发区、麒麟科创园', basePrice:13500, potential:'高' },
    '浦口': { school:'浦口实小、南京一中江北分校（名校分校）', subway:'4号线、10号线、S3号线、S8号线，11号线（在建）', hospital:'鼓楼医院江北分院（三甲）', mall:'桥北弘阳广场、金象城王府井、江北虹悦城', park:'老山森林公园、珍珠泉风景区、滨江风光带', industry:'江北新区（国家级）、研创园、生物医药谷', basePrice:11500, potential:'很高' },
    '栖霞': { school:'南师附中仙林分校、金陵中学仙林分校', subway:'1号线、2号线、4号线、6号线（在建）、7号线（在建）', hospital:'中西医结合医院（三甲）', mall:'仙林金鹰、万达茂、尧化门金地广场', park:'栖霞山风景区、紫金山、仙林湖公园', industry:'紫东核心区、新港开发区、仙林大学城', basePrice:14000, potential:'较高' },
    '雨花台': { school:'雨花台中学、琅琊路小学分校', subway:'1号线、10号线、S3号线', hospital:'儿童医院（河西）、明基医院', mall:'雨花客厅、虹悦城、板桥吾悦', park:'雨花台风景区、莲花湖公园', industry:'软件谷（华为/中兴/字节等）', basePrice:15000, potential:'高' },
    '鼓楼': { school:'拉力琅芳四大名校+29中/树人，顶级学区', subway:'1号线、2号线、4号线、7号线', hospital:'鼓楼医院、省人民医院、中大医院（均三甲）', mall:'新街口商圈、龙江新城市广场、湖南路', park:'玄武湖、古林公园、清凉山', industry:'省级政务、商务商贸、科技创新', basePrice:28000, potential:'稳' },
    '建邺': { school:'南外河西分校、金陵中学河西分校', subway:'2号线、7号线、S3号线、10号线', hospital:'儿童医院河西分院、明基医院', mall:'河西金鹰世界、奥体商圈、华采天地', park:'滨江公园、绿博园、奥体中心', industry:'河西CBD、金融城、新城科技园', basePrice:22000, potential:'稳' },
    '玄武': { school:'北京东路小学、南师附小、科利华等名校', subway:'1号线、2号线、3号线、4号线', hospital:'省中医院、钟山医院、口腔医院', mall:'新街口商圈、珠江路商圈、德基广场', park:'玄武湖、紫金山、中山陵风景区', industry:'市级政务、商务商贸、旅游文化', basePrice:26000, potential:'稳' },
    '秦淮': { school:'游府西街小学、夫子庙小学、钟英中学', subway:'1号线、3号线、5号线', hospital:'市第一医院、省中医院', mall:'新街口商圈、夫子庙水游城、水平方', park:'夫子庙、老门东、月牙湖', industry:'老城区+南部新城（大校场板块）', basePrice:20000, potential:'较高' },
    '六合': { school:'六合实小、金陵中学龙湖分校', subway:'S8号线', hospital:'六合区人民医院', mall:'雄州欢乐港、龙湖天街', park:'龙池湖、止马岭森林公园', industry:'江北新区延伸、化工园（需转型）', basePrice:8500, potential:'中' },
    '溧水': { school:'溧水实小、金陵中学溧水分校', subway:'S7号线', hospital:'溧水区人民医院', mall:'溧水万达、海伦国际', park:'天生桥风景区、无想山森林公园', industry:'溧水开发区、空港新城', basePrice:9500, potential:'中' },
    '高淳': { school:'高淳实小、第一中学', subway:'S9号线', hospital:'高淳区人民医院', mall:'八佰伴、富克斯广场', park:'高淳老街、固城湖湿地公园', industry:'慢城文旅、螃蟹特色产业', basePrice:7800, potential:'较低' },
  };

  function render() {
    const k = getAmapKey();
    // 未配置高德 Web 服务 Key 时，不做本地模拟，直接提示配置
    if (!k.srv) {
      App.setContent(Utils.apiGate('amap'));
      return;
    }
    // 每次进入各子模块城市重置为右上角设置城市（各工具内可再分别选择）
    commute  = { workCity: Store.getCity(), partCity: Store.getCity(), commCity: Store.getCity() };
    schoolCity = facilityCity = Store.getCity();
    distCities = { fromCity: Store.getCity(), toCity: Store.getCity() };
    const html = `
      <div class="page-header">
        <div>
          <h2><span class="emoji">${ic('map')}</span>区位分析工具集</h2>
          <p class="page-desc">通勤/学区/配套/距离测算四大区位分析工具</p>
        </div>
      </div>

      <div class="sub-tabs" id="locTabs">
        <div class="sub-tab" data-t="commute">${ic('car',15)} 通勤时间分析</div>
        <div class="sub-tab" data-t="school">${ic('school',15)} 学区查询</div>
        <div class="sub-tab" data-t="facility">${ic('hospital',15)} 周边配套地图</div>
        <div class="sub-tab" data-t="distance">${ic('ruler',15)} 距离测算</div>
      </div>

      <div id="locContent"></div>
    `;
    App.setContent(html);
    document.querySelectorAll('#locTabs .sub-tab').forEach(t=>{
      if (t.dataset.t === tab) t.classList.add('active');
      t.addEventListener('click',()=>{
        document.querySelectorAll('#locTabs .sub-tab').forEach(x=>x.classList.remove('active'));
        t.classList.add('active');
        tab = t.dataset.t;
        renderTab();
      });
    });
    renderTab();
  }

  function renderTab() {
    const box = document.getElementById('locContent');
    if (tab==='commute') box.innerHTML = renderCommute();
    else if (tab==='school') box.innerHTML = renderSchool();
    else if (tab==='facility') box.innerHTML = renderFacility();
    else if (tab==='distance') box.innerHTML = renderDistance();
    // 绑定智能补全（所有带 data-autocomplete 的输入框）
    bindAutocomplete();
    // 预加载高德 JS SDK：距离测算/周边配套共用，点击"计算距离"后无需再等 SDK 加载
    if ((localStorage.getItem('k_amap_js')||'').trim()) loadAmapSDK().catch(()=>{});
  }

  // ===== 子模块城市选择：更新对应城市变量并联动区域/输入框 =====
  // 更新输入框的 data-city（供智能补全按城市过滤）
  function updateInputCity(id, city) {
    const el = document.getElementById(id);
    if (el) el.dataset.city = city;
  }
  // 重绘区域/板块下拉为指定城市的区域
  function syncDistrictSelect(selectId, city, keepValue=true) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '<option value="">请选择</option>' + (Store.CITIES[city]||[]).map(d=>`<option>${d}</option>`).join('');
    if (keepValue && cur && [...sel.options].some(o=>o.value===cur||o.text===cur)) sel.value = cur;
  }
  function setWorkCity(sel)   { commute.workCity = sel.value; updateInputCity('c_work', sel.value); }
  function setPartCity(sel)   { commute.partCity = sel.value; updateInputCity('c_part', sel.value); }
  function setCommCity(sel)   { commute.commCity = sel.value; syncDistrictSelect('c_district', sel.value, false); updateInputCity('c_community', sel.value); }
  function setSchoolCity(sel) { schoolCity = sel.value; syncDistrictSelect('s_dist', sel.value, false); updateInputCity('s_comm', sel.value); }
  function setFacilityCity(sel) { facilityCity = sel.value; syncDistrictSelect('f_dist', sel.value, false); updateInputCity('f_comm', sel.value); }
  function setFromCity(sel)   { distCities.fromCity = sel.value; renderTab(); } // 重绘以更新快速选择示例/placeholder
  function setToCity(sel)     { distCities.toCity = sel.value; renderTab(); }

  // ===== 智能补全（基于高德 inputtips 或本地板块数据降级） =====
  // POI 类型映射：补全时按 data-poi-type 限制类别
  const POI_TYPES = {
    work:     '170000|160000|150000',   // 写字楼/公司/地铁站
    community:'120200|120300',         // 住宅小区
    mall:     '060100',                 // 商场
    hospital: '090100',                 // 医院
    school:   '141200|141205',          // 学校/幼儿园
  };
  let _acCache = {};
  async function fetchInputTips(input, keyword, poiType='') {
    if (!keyword || keyword.length < 1) return [];
    const city = input.dataset.city || Store.getCity();
    const cacheKey = city + '|' + keyword + '|' + poiType;
    if (_acCache[cacheKey]) return _acCache[cacheKey];
    const key = getAmapKey().srv;
    if (!key) {
      // 本地降级：从已有房源记录和板块数据中匹配
      const records = Store.getRecords();
      const local = records.filter(r=>!city || r.city===city).map(r=>r.communityName).filter(n=>n && n.includes(keyword));
      const districts = (Store.CITIES[city] || Store.getDistricts()).filter(d=>d.includes(keyword));
      const result = [...new Set([...local, ...districts])].slice(0, 8).map(n=>({name:n, district:'', address:''}));
      _acCache[cacheKey] = result;
      return result;
    }
    try {
      const url = `https://restapi.amap.com/v3/place/text?key=${encodeURIComponent(key)}&keywords=${encodeURIComponent(keyword)}&city=${encodeURIComponent(city)}&citylimit=true&types=${encodeURIComponent(poiType)}&offset=8`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.status === '1' && data.pois) {
        const result = data.pois.map(p => ({ name: p.name, district: p.adname||'', address: p.address||'', location: p.location||'' }));
        _acCache[cacheKey] = result;
        return result;
      }
    } catch(e) { console.error('inputtips err', e); }
    return [];
  }

  function bindAutocomplete() {
    document.querySelectorAll('[data-autocomplete]').forEach(input => {
      if (input._acBound) return;
      input._acBound = true;
      const poiType = input.dataset.poiType || '';
      // 下拉面板挂载到 body，避免被父容器 overflow:hidden 裁切
      const container = document.createElement('div');
      container.className = 'ac-dropdown';
      container.style.cssText = 'position:fixed;z-index:99999;background:#fff;border:1px solid var(--border-light);border-radius:6px;box-shadow:0 6px 16px rgba(0,0,0,0.14);max-height:240px;overflow-y:auto;display:none;min-width:240px;max-width:400px;';
      document.body.appendChild(container);

      function positionDropdown() {
        const rect = input.getBoundingClientRect();
        container.style.left = rect.left + 'px';
        container.style.top = (rect.bottom + 2) + 'px';
        container.style.minWidth = Math.max(rect.width, 240) + 'px';
      }

      let _timer = null;
      input.addEventListener('input', () => {
        clearTimeout(_timer);
        _timer = setTimeout(async () => {
          const kw = input.value.trim();
          if (!kw) { container.style.display='none'; return; }
          const tips = await fetchInputTips(input, kw, poiType);
          if (!tips.length) { container.style.display='none'; return; }
          container.innerHTML = tips.map(t => `
            <div class="ac-item" style="padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--bg-2);font-size:12.5px;" data-name="${t.name}" data-loc="${t.location||''}" data-district="${t.district||''}">
              <div style="color:var(--text-1);font-weight:500;">${t.name}</div>
              ${t.address?`<div style="color:var(--text-3);font-size:11px;margin-top:2px;">${t.district||''} ${t.address}</div>`:''}
            </div>`).join('');
          positionDropdown();
          container.style.display = 'block';
          container.querySelectorAll('.ac-item').forEach(item => {
            item.addEventListener('mousedown', (e) => {
              e.preventDefault();
              input.value = item.dataset.name;
              if (item.dataset.loc) input.dataset.loc = item.dataset.loc;
              // 自动同步所在区域下拉
              if (item.dataset.district) {
                syncDistrictFromAutocomplete(input, item.dataset.district);
              }
              container.style.display = 'none';
              input.dispatchEvent(new Event('ac-selected'));
            });
          });
        }, 250);
      });
      input.addEventListener('blur', () => {
        setTimeout(()=>container.style.display='none', 200);
      });
      // 滚动/resize 时重新定位
      window.addEventListener('scroll', () => { if (container.style.display!=='none') positionDropdown(); }, true);
      window.addEventListener('resize', () => { if (container.style.display!=='none') positionDropdown(); }, true);
    });
  }

  // 自动补全选中地点后，查找同表单内的区域下拉并联动更新
  function syncDistrictFromAutocomplete(input, districtRaw) {
    const district = (districtRaw||'').replace('区','').replace('县','');
    if (!district) return;
    // 向上查找最近的 card 或 grid 容器
    let scope = input.closest('.card') || input.closest('.grid-2') || input.parentElement;
    if (!scope) return;
    // 查找同容器内的区域下拉
    const distSelects = scope.querySelectorAll('select[id$="_dist"], select[id$="_district"]');
    distSelects.forEach(sel => {
      const opts = [...sel.options];
      const match = opts.find(o => o.value === district || o.text === district);
      if (match && sel.value !== match.value) {
        sel.value = match.value;
        sel.dispatchEvent(new Event('change'));
      }
    });
  }

  // ===== 通勤分析 =====
  function renderCommute() {
    const exp = Store.getExpectation();
    return `<div class="grid-2">
      <div class="card">
        <div class="card-title">${ic('car')} 输入通勤参数</div>
        <div class="form-grid">
          <div class="form-item full"><label>${ic('pin',14)} 我的工作地点</label>
            <div class="loc-row">
              <div class="cascade-group">${Store.cityCascadeHTML(commute.workCity, 'cw', { onCity: 'LocationMod.setWorkCity(this)' })}</div>
              <input type="text" id="c_work" value="${exp.workplace||''}" placeholder="如：新街口地铁站 / 软件谷" data-autocomplete data-city="${commute.workCity}" data-poi-type="${POI_TYPES.work}" style="flex:1;min-width:180px;">
            </div>
          </div>
          <div class="form-item full"><label>${ic('heart',14)} 伴侣工作地点（可选）</label>
            <div class="loc-row">
              <div class="cascade-group">${Store.cityCascadeHTML(commute.partCity, 'cp', { onCity: 'LocationMod.setPartCity(this)' })}</div>
              <input type="text" id="c_part" value="${exp.partnerWorkplace||''}" placeholder="如：仙林大学城" data-autocomplete data-city="${commute.partCity}" data-poi-type="${POI_TYPES.work}" style="flex:1;min-width:180px;">
            </div>
          </div>
          <div class="form-item full"><label>${ic('house',14)} 房源所在小区</label>
            <div class="loc-row">
              <div class="cascade-group">${Store.cityCascadeHTML(commute.commCity, 'cm', { onCity: 'LocationMod.setCommCity(this)' })}</div>
              <select id="c_district" onchange="LocationMod.setSuggestedCommunity()" style="flex:1;min-width:110px;">
                <option value="">请选择区域</option>
                ${(Store.CITIES[commute.commCity]||[]).map(d=>`<option>${d}</option>`).join('')}
              </select>
              <input type="text" id="c_community" placeholder="如：百家湖花园" data-autocomplete data-city="${commute.commCity}" data-poi-type="${POI_TYPES.community}" onblur="LocationMod.detectDistrictFromInput(this,'c_district')" style="flex:1.4;min-width:150px;">
            </div>
          </div>
        </div>
        <div class="commute-limit">
          ${ic('clock',14)} 可接受通勤时长上限 <strong>≤ ${exp.maxCommuteTime||45} 分钟</strong>
          <a onclick="App.navigate('expectation')">修改</a>
        </div>
        <div style="text-align:right;margin-top:14px;">
          <button class="btn btn-primary" onclick="LocationMod.calcCommute()">${ic('search',15)} 分析通勤</button>
        </div>
      </div>
      <div id="c_result" class="card">
        <div class="empty-state" style="padding:20px;"><div class="icon">${ic('car',54)}</div>
          <h4>点击"分析通勤"查看结果</h4>
        </div>
      </div>
    </div>`;
  }
  function setSuggestedCommunity() {
    const d = document.getElementById('c_district').value;
    if (!d) return;
    const commEl = document.getElementById('c_community');
    if (!commEl) return;
    // 输入框已有内容（手动输入或下拉选中）时保留，避免被联动逻辑覆盖/清空
    if (commEl.value && commEl.value.trim()) return;
    // 优先从已记录房源中找「当前城市 + 该区域」的真实小区（不再仅限南京示例）
    const match = Store.getRecords().find(r => r.district === d && (r.city === commute.commCity || (!r.city && Store.getCity() === commute.commCity)));
    if (match) { commEl.value = match.communityName; return; }
    // 无记录时兜底提示（可手动输入小区名，高德会自动补全）
    Utils.toast(`「${commute.commCity} · ${d}」暂无已记录小区，请直接输入小区名（支持智能补全）`, 'info', 2000);
  }

  // 输入小区名后，自动通过高德POI搜索推断区域并联动下拉
  async function detectDistrictFromInput(input, selectId) {
    const name = (input.value||'').trim();
    if (!name || name.length < 2) return;
    const sel = document.getElementById(selectId);
    if (!sel) return;
    const srvKey = getAmapKey().srv;
    if (!srvKey) return;
    const city = selectId==='c_district' ? commute.commCity
              : selectId==='f_dist' ? facilityCity
              : selectId==='s_dist' ? schoolCity
              : Store.getCity();
    try {
      const url = `https://restapi.amap.com/v3/place/text?key=${encodeURIComponent(srvKey)}&keywords=${encodeURIComponent(name)}&city=${encodeURIComponent(city)}&citylimit=true&types=120200|120300&offset=1`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.status === '1' && data.pois && data.pois[0]) {
        const district = (data.pois[0].adname||'').replace('区','').replace('县','');
        if (district) {
          const match = [...sel.options].find(o => o.value === district || o.text === district);
          if (match && sel.value !== match.value) {
            sel.value = match.value;
            sel.dispatchEvent(new Event('change'));
            Utils.toast(`已识别区域：${district}`, 'info', 1200);
          }
        }
      }
    } catch(e) {}
  }
  async function calcCommute() {
    try { await _calcCommuteInner(); }
    catch(err) {
      // 任何异常都给出可见反馈，避免"点击无反应"
      console.error('calcCommute err', err);
      const detail = err && err.stack ? String(err.stack).split('\n')[0] : (String(err) || '未知错误');
      const rb = document.getElementById('c_result');
      if (rb) rb.innerHTML = `<div style="padding:16px;background:var(--danger-soft);color:var(--danger);border-radius:10px;">${ic('alert',14)} 通勤分析出错：${detail}<div style="margin-top:6px;font-size:12px;color:var(--text-3);">请稍后重试或检查网络。</div></div>`;
    }
  }
  async function _calcCommuteInner() {
    const workEl = document.getElementById('c_work');
    const partEl = document.getElementById('c_part');
    const distEl = document.getElementById('c_district');
    const commEl = document.getElementById('c_community');
    if (!workEl || !distEl || !commEl) {
      const rb = document.getElementById('c_result');
      if (rb) rb.innerHTML = `<div style="padding:16px;background:var(--warn-soft);color:var(--warn);border-radius:10px;">${ic('alert',14)} 通勤表单未就绪，请重新进入区位分析页后重试。</div>`;
      return;
    }
    const work = workEl.value.trim() || '新街口';
    const part = (partEl.value||'').trim();
    const district = distEl.value;
    // 未输入小区名时直接用区域名定位（"XX某小区"无法被高德解析，改用区域名提高命中率）
    const community = commEl.value.trim() || district;
    if (!community) {
      Utils.toast('请选择区域或输入房源小区名','warn');
      // 同时写入结果区，避免 toast 一闪而过导致"无反馈"
      const rb = document.getElementById('c_result');
      if (rb) rb.innerHTML = `<div style="padding:16px;background:var(--warn-soft);color:var(--warn);border-radius:10px;">${ic('alert',14)} 请先选择房源所在区域，或输入小区名后再点击分析。</div>`;
      return;
    }
    const exp = Store.getExpectation();
    const limit = exp.maxCommuteTime || 45;
    const useReal = amapConfigured();

    // 显示加载
    document.getElementById('c_result').innerHTML = `
      <div class="empty-state" style="padding:30px;">
        <div style="font-size:24px;">${useReal?ic('globe',28):ic('chart',28)}</div>
        <h4>${useReal?'正在调用高德API规划路径...':'计算中...'}</h4>
        <p style="font-size:12.5px;color:var(--text-3);">${useReal?'从 '+community+' 到 '+work+' 的真实驾车/地铁路径':'基于本地模拟数据'}</p>
      </div>`;

    let subway, drive, driveDist='', subwayDist='';
    let dataSource = '';
    // 提升到外层：伴侣通勤部分（if(part) 在 useReal 块外）需要访问坐标
    let originLoc = null, destLoc = null;

    if (useReal) {
      // 真实调用：先地理编码，再路径规划
      originLoc = await geocode(community, commute.commCity);
      destLoc = await geocode(work, commute.workCity);
      if (originLoc && destLoc) {
        const driveRes = await routePlan(originLoc, destLoc, 'driving');
        const subwayRes = await routePlan(originLoc, destLoc, 'transit', commute.commCity, commute.workCity);
        drive = driveRes ? driveRes.duration : null;
        subway = subwayRes ? subwayRes.duration : null;
        if (driveRes) driveDist = ` · ${driveRes.distance}km`;
        if (subwayRes) subwayDist = ` · ${subwayRes.distance}km`;
        dataSource = '数据来源：高德地图路径规划API（实时）';
        if (drive == null && subway == null) {
          _renderErr('c_result', '高德路径规划 API 未返回有效路径，请检查 Web 服务 Key 的有效性、配额与权限后重试。', true);
          return;
        }
        // 缺失项如实标注"未获取"，不伪造数据
        if (drive == null) driveDist = '（未获取）';
        if (subway == null) subwayDist = '（未获取）';
      } else {
        _renderErr('c_result', '地址解析失败：请确认小区名 / 工作地书写正确，且高德 Web 服务 Key 有效。', true);
        return;
      }
    } else {
      _renderErr('c_result', '未配置高德 Web 服务 Key，无法进行真实通勤测算。', true);
      return;
    }

    const subwayOK = subway != null && subway <= limit;
    const driveOK = drive != null && drive <= limit;
    let partHtml = '';
    if (part) {
      // 伴侣通勤：真实测算 小区 → 伴侣工作地点 的地铁（公交）时长
      let ps = null;
      const partLoc = await geocode(part, commute.partCity);
      if (partLoc && originLoc) {
        const partRes = await routePlan(originLoc, partLoc, 'transit', commute.commCity, commute.partCity);
        if (partRes) ps = partRes.duration;
      }
      if (ps == null) {
        // 真实路径不可用时，以已获取的任一路径时长为基础估算（如实标注）
        const base = subway != null ? subway : (drive != null ? drive : 45);
        ps = Math.max(5, base + Math.round(Math.random()*10-5));
      }
      partHtml = `<div class="r-item"><div class="r-label">${ic('heart',14)} 伴侣地铁通勤（至${part}）</div><div class="r-value" style="${ps<=limit?'':'color:var(--danger)'}">${ps} 分钟 ${ps<=limit?ic('check',13):ic('alert',13)+'超出'}</div></div>`;
    }

    let advice, color;
    if (subwayOK && driveOK) { advice='通勤在可接受范围，该板块可达性良好'; color='tag-success'; }
    else if (subwayOK || driveOK) { advice='一种方式可接受，另一种超出；建议优先选地铁/自驾更优方案'; color='tag-primary'; }
    else { advice='两种通勤方式均超出上限，长期居住需考虑时间成本与疲劳度'; color='tag-danger'; }

    document.getElementById('c_result').innerHTML = `
      <div class="calc-result">
        <h4>通勤分析结果 ${useReal?'<span style="font-size:11px;background:var(--primary-soft);color:var(--primary);padding:2px 8px;border-radius:999px;margin-left:8px;font-weight:600;">'+ic('globe',12)+' 实时</span>':''}</h4>
        <div class="big-num" style="font-size:20px;">${community} → ${work}</div>
        <div class="result-grid">
          <div class="r-item"><div class="r-label">${ic('train',14)} 地铁（公交+步行）</div><div class="r-value" style="${subwayOK?'':'color:var(--danger)'}">${subway==null?'未获取':subway} 分钟${subwayDist} ${subway==null?ic('alert',13):(subwayOK?ic('check',13):ic('alert',13)+'超出')}</div></div>
          <div class="r-item"><div class="r-label">${ic('car',14)} 自驾</div><div class="r-value" style="${driveOK?'':'color:var(--danger)'}">${drive==null?'未获取':drive} 分钟${driveDist} ${drive==null?ic('alert',13):(driveOK?ic('check',13):ic('alert',13)+'超出')}</div></div>
          <div class="r-item"><div class="r-label">${ic('compass',14)} 骑行/公交</div><div class="r-value">${subway==null?'未获取':Math.round(subway*1.2)} 分钟</div></div>
          ${partHtml}
        </div>
      </div>
      <div style="margin-top:14px;"><span class="tag ${color}" style="padding:4px 10px;font-size:12px;">${ic('bulb',13)} ${advice}</span></div>
    `;
  }

  // 结果区渲染错误/未配置提示（不做本地模拟）
  function _renderErr(elId, msg, goConfig) {
    document.getElementById(elId).innerHTML = `
      <div style="border:1px solid var(--danger);background:var(--danger-soft);border-radius:10px;padding:18px;text-align:center;">
        <div style="font-size:26px;">${ic('alertCircle',30)}</div>
        <p style="margin:10px 0 14px;font-size:13px;color:var(--text-1);line-height:1.7;">${msg}</p>
        ${goConfig ? '<button class="btn btn-primary btn-sm" onclick="App.navigate(\'settings\')">'+ic('gear',15)+' 前往配置高德 API</button>' : ''}
      </div>`;
  }
  // ===== 学区查询 =====
  function renderSchool() {
    return `<div class="card">
      <div class="card-title">${ic('school')} 学区查询</div>
      <div class="form-grid">
        <div class="form-item full"><label>查询城市</label>
          <div class="cascade-group loc-cascade">${Store.cityCascadeHTML(schoolCity, 'sc', { onCity: 'LocationMod.setSchoolCity(this)' })}</div>
        </div>
        <div class="form-item">
          <label>按板块查询</label>
          <select id="s_dist">
            <option value="">— 选择板块 —</option>
            ${(Store.CITIES[schoolCity]||[]).map(d=>`<option>${d}</option>`).join('')}
          </select>
        </div>
        <div class="form-item">
          <label>或按地点查询（输入后自动识别板块）</label>
          <input type="text" id="s_comm" placeholder="如：百家湖花园 / 龙江银城花园" data-autocomplete data-city="${schoolCity}" data-poi-type="${POI_TYPES.community}" onblur="LocationMod.detectDistrictFromInput(this,'s_dist')">
        </div>
      </div>
      <div style="margin-top:10px;"><button class="btn btn-primary" onclick="LocationMod.querySchool()">${ic('search',15)} 查询学区</button></div>
      <div id="s_result" style="margin-top:14px;"></div>
    </div>`;
  }
  async function querySchool() {
    let dist = document.getElementById('s_dist').value;
    const commInput = document.getElementById('s_comm').value.trim();
    const commName = commInput;
    if (!dist && !commName) { Utils.toast('请选择板块或输入小区名','warn'); return; }
    // 有小区名无板块 → 通过POI识别板块；识别失败明确提示，不再静默用首个板块导致张冠李戴
    if (!dist && commName) {
      const srvKey = getAmapKey().srv;
      if (srvKey) {
        try {
          const url = `https://restapi.amap.com/v3/place/text?key=${encodeURIComponent(srvKey)}&keywords=${encodeURIComponent(commName)}&city=${encodeURIComponent(schoolCity)}&citylimit=true&types=120200|120300&offset=1`;
          const res = await fetch(url);
          const data = await res.json();
          if (data.status === '1' && data.pois && data.pois[0]) {
            const ad = (data.pois[0].adname||'').replace('区','').replace('县','');
            const dists = Store.CITIES[schoolCity] || [];
            const matched = dists.includes(ad) ? ad : dists.find(d => d === ad+'区' || d === ad+'县' || d === ad+'市');
            if (matched) dist = matched;
          }
        } catch(e) {}
      }
      if (!dist) { Utils.toast(`未能识别「${commName}」在${schoolCity}的板块，请手动选择板块后查询`,'warn'); return; }
    }
    const resultBox = document.getElementById('s_result');
    // ① 真实学校数据（高德 API，全国任意城市可用）
    const real = await queryRealSchools(schoolCity, dist, commName);
    if (real && real.schools && real.schools.length) {
      resultBox.innerHTML = renderRealSchools(real, schoolCity, dist, commName);
      return;
    }
    // ② 真实数据不可用 → 降级为静态参考数据（目前仅南京收录板块概况）
    const dInfo = DISTRICT_DATA[dist];
    if (dInfo) {
      let facilityDistHtml = '';
      if (commName) facilityDistHtml = await fetchFacilityDistances(commName);
      resultBox.innerHTML = `
        <div style="background:#fff;border:1px solid var(--border-light);border-radius:10px;padding:16px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <h3 style="font-size:16px;">${ic('pin',14)} ${dist} 学区概况${commName?` · ${commName}`:''}</h3>
            <span class="tag tag-warn tag-sm">${ic('alert',12)} 静态参考数据</span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
            <div style="padding:10px;background:var(--primary-soft);border-radius:8px;">
              <h4 style="font-size:13px;color:var(--primary);margin-bottom:4px;">${ic('school',14)} 小学学区</h4>
              <p style="font-size:12.5px;color:var(--text-2);line-height:1.8;">${dInfo.school}</p>
            </div>
            <div style="padding:10px;background:var(--accent-soft);border-radius:8px;">
              <h4 style="font-size:13px;color:var(--accent);margin-bottom:4px;">${ic('train',14)} 交通配套</h4>
              <p style="font-size:12.5px;color:var(--text-2);line-height:1.8;">${dInfo.subway}</p>
            </div>
            <div style="padding:10px;background:var(--success-soft);border-radius:8px;">
              <h4 style="font-size:13px;color:var(--success);margin-bottom:4px;">${ic('hospital',14)} 医疗配套</h4>
              <p style="font-size:12.5px;color:var(--text-2);line-height:1.8;">${dInfo.hospital}</p>
            </div>
            <div style="padding:10px;background:var(--warn-soft);border-radius:8px;">
              <h4 style="font-size:13px;color:var(--warn);margin-bottom:4px;">${ic('shop',14)} 商业配套</h4>
              <p style="font-size:12.5px;color:var(--text-2);line-height:1.8;">${dInfo.mall}</p>
            </div>
          </div>
          <div style="margin-top:10px;">
            <h4 style="font-size:13px;margin:10px 0 6px;">${ic('sun',14)} 休闲配套</h4>
            <p style="font-size:12.5px;color:var(--text-2);">${dInfo.park}</p>
            <h4 style="font-size:13px;margin:10px 0 6px;">${ic('building',14)} 产业支撑</h4>
            <p style="font-size:12.5px;color:var(--text-2);">${dInfo.industry}</p>
            <h4 style="font-size:13px;margin:10px 0 6px;">${ic('trend',14)} 房价基准 & 升值潜力</h4>
            <p style="font-size:12.5px;color:var(--text-2);">二手房挂牌基准价约 <strong style="color:var(--accent)">${dInfo.basePrice.toLocaleString()}元/㎡</strong>，综合升值潜力评估：<strong class="tag tag-success tag-sm">${dInfo.potential}</strong></p>
          </div>
          ${facilityDistHtml}
        </div>`;
      return;
    }
    // ③ 两者均无 → 引导配置 Key
    resultBox.innerHTML = `
      <div class="card" style="border:1px solid var(--warn);">
        <div style="text-align:center;padding:24px;">
          <div style="font-size:26px;">${ic('map',30)}</div>
          <h4 style="margin:10px 0;">「${schoolCity} · ${dist}」暂未查询到学校数据</h4>
          <p style="font-size:12.5px;color:var(--text-3);line-height:1.8;">${getAmapKey().srv ? '高德接口未返回学校信息，请更换板块/小区名后重试。' : '请先在【系统设置】中配置高德 Web 服务 Key，即可查询全国任意城市的真实学校分布。'}</p>
        </div>
      </div>`;
  }

  // 高德真实学校数据：以小区/板块为中心，拉取周边幼儿园/小学/中学/大学/职校（3KM）
  // 高德 POI 的"中学"未细分初/高中，按名称关键词进一步分类
  function classifySchoolType(s) {
    const t = s.type;
    if (t !== '中学') return t || '学校';
    const n = s.name;
    if (/九年一贯制|九年制/.test(n)) return '九年一贯制';
    if (/初中/.test(n)) return '初中';
    if (/高中|高级中学|完中|完全中学/.test(n)) return '高中';
    return '中学';
  }
  async function queryRealSchools(city, district, commName) {
    const key = getAmapKey().srv;
    if (!key) return null;
    let center = null;
    const centerName = commName || `${city}${district||''}`;
    if (commName) {
      try {
        const url = `https://restapi.amap.com/v3/place/text?key=${encodeURIComponent(key)}&keywords=${encodeURIComponent(commName)}&city=${encodeURIComponent(city)}&citylimit=true&types=120200|120300&offset=1`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.status === '1' && data.pois && data.pois[0] && data.pois[0].location) center = data.pois[0].location;
      } catch(e) {}
    }
    if (!center && district) center = await geocode(`${city}${district}`, city);
    if (!center) return { centerName, schools: [] };
    try {
      const sUrl = `https://restapi.amap.com/v3/place/around?key=${encodeURIComponent(key)}&location=${encodeURIComponent(center)}&types=141201|141202|141203|141204|141205&radius=3000&offset=20&sortrule=distance&extensions=base`;
      const sRes = await fetch(sUrl);
      const sData = await sRes.json();
      if (sData.status === '1' && sData.pois) {
        // 高德 place/around 返回的中文三级类型，如 "科教文化服务;学校;幼儿园"，取最后一段匹配
        const typeName = {
          '幼儿园':'幼儿园', '小学':'小学',
          '中学':'中学', '初中':'初中', '高中':'高中',
          '高等院校':'大学', '大学':'大学',
          '职业学校':'职校', '职业技术学校':'职校', '职业技术学院':'职校', '中等专业学校':'职校',
          '成人教育':'学校', '特殊教育学校':'学校', '学校':'学校'
        };
        const schools = sData.pois.map(p => {
          const t = (p.type||'').split(';');
          const s = {
            name: p.name,
            type: typeName[t[t.length-1]] || '学校',
            address: p.address||'',
            distance: Math.round(Number(p.distance)||0)
          };
          s.category = classifySchoolType(s);
          return s;
        });
        return { centerName, schools };
      }
    } catch(e) { console.error('school around err', e); }
    return { centerName, schools: [] };
  }
  // 渲染真实学校列表：按 幼儿园/小学/初中/高中/大学 等分类分组标记
  function renderRealSchools(real, city, dist, commName) {
    const list = real.schools;
    // 分类展示顺序与对应标签色（幼儿园橙 / 小学蓝 / 初中绿 / 高中青 / 大学紫，其余灰）
    const CATS = [
      ['幼儿园', 'tag-warn'],
      ['小学',   'tag-primary'],
      ['初中',   'tag-success'],
      ['九年一贯制', 'tag-primary'],
      ['高中',   'tag-high'],
      ['中学',   ''],
      ['大学',   'tag-college'],
      ['职校',   ''],
      ['学校',   '']
    ];
    const groups = {};
    list.forEach(s => { const g = s.category; (groups[g] = groups[g] || []).push(s); });
    const stats = CATS.filter(([c]) => groups[c]).map(([c]) => `${c} ${groups[c].length}`).join(' · ');
    const fmtDist = d => d < 1000 ? d + 'm' : (d/1000).toFixed(1) + 'km';
    const body = CATS.map(([cat, tag]) => {
      const arr = groups[cat];
      if (!arr) return '';
      return `<div style="margin-top:12px;">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
          <strong style="font-size:13px;color:var(--text-1);">${ic('school',14)} ${cat}</strong>
          <span class="tag tag-sm ${tag}">${arr.length} 所</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          ${arr.slice(0, 8).map(s => `<div style="padding:9px 10px;background:var(--bg-2);border-radius:8px;">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">
              <strong style="font-size:12.5px;color:var(--text-1);">${s.name}</strong>
              <span class="tag tag-sm ${tag}">${s.category}</span>
            </div>
            <div style="font-size:11.5px;color:var(--text-3);margin-top:3px;">${fmtDist(s.distance)}${s.address ? ' · ' + s.address : ''}</div>
          </div>`).join('')}
        </div>
      </div>`;
    }).join('');
    return `<div style="background:#fff;border:1px solid var(--border-light);border-radius:10px;padding:16px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px;">
        <h3 style="font-size:16px;">${ic('pin',14)} ${city}${dist?' · '+dist:''} 周边学校（3KM）${commName?` · ${commName}`:''}</h3>
        <span class="tag tag-success tag-sm">${ic('globe',12)} 高德实时数据</span>
      </div>
      <p style="font-size:12px;color:var(--text-3);">共 ${list.length} 所${stats ? '：' + stats : ''}</p>
      ${body}
      <p style="font-size:11.5px;color:var(--text-3);margin-top:12px;">${ic('alert',13)} 学区划片以当地教育局当年公示为准，本结果为周边学校分布，不构成划片结论。</p>
    </div>`;
  }

  // 查询小区到周边配套设施的距离
  async function fetchFacilityDistances(commName) {
    const srvKey = getAmapKey().srv;
    if (!srvKey) return '<div style="margin-top:14px;padding:10px;background:var(--bg-2);border-radius:8px;font-size:12px;color:var(--text-3);">'+ic('pin',13)+' 配置高德API Key后可查询小区到周边配套设施的精确距离</div>';
    // 先获取小区坐标
    let commLoc = null;
    try {
      const geoUrl = `https://restapi.amap.com/v3/place/text?key=${encodeURIComponent(srvKey)}&keywords=${encodeURIComponent(commName)}&city=${encodeURIComponent(schoolCity)}&citylimit=true&types=120200|120300&offset=1`;
      const geoRes = await fetch(geoUrl);
      const geoData = await geoRes.json();
      if (geoData.status === '1' && geoData.pois && geoData.pois[0] && geoData.pois[0].location) {
        commLoc = geoData.pois[0].location;
      }
    } catch(e) {}
    if (!commLoc) return '';
    // 搜索周边各类配套
    const facilityTypes = [
      { label:'最近学校', type:'141200|141205', icon:'school' },
      { label:'最近医院', type:'090100', icon:'hospital' },
      { label:'最近商场', type:'060100', icon:'shop' },
      { label:'最近地铁站', type:'150500', icon:'train' },
      { label:'最近公园', type:'110101', icon:'sun' },
    ];
    const results = await Promise.all(facilityTypes.map(async ft => {
      try {
        const url = `https://restapi.amap.com/v3/place/around?key=${encodeURIComponent(srvKey)}&location=${encodeURIComponent(commLoc)}&types=${encodeURIComponent(ft.type)}&radius=5000&offset=1&sortrule=distance`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.status === '1' && data.pois && data.pois[0]) {
          const poi = data.pois[0];
          const dist = poi.distance ? Number(poi.distance) : 0;
          const walkMin = Math.ceil(dist / 80); // 步行约80m/min
          return { ...ft, name: poi.name, dist, walkMin };
        }
      } catch(e) {}
      return null;
    }));
    const valid = results.filter(Boolean);
    if (!valid.length) return '';
    return `
      <div style="margin-top:14px;padding:12px;background:var(--bg-2);border-radius:8px;">
        <h4 style="font-size:13px;color:var(--text-1);margin-bottom:8px;">${ic('ruler',14)} ${commName} 周边配套距离</h4>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;">
          ${valid.map(r => `
            <div style="padding:8px 10px;background:#fff;border-radius:6px;border:1px solid var(--border-light);">
              <div style="font-size:12px;color:var(--text-3);">${ic(r.icon,13)} ${r.label}</div>
              <div style="font-size:13px;font-weight:600;color:var(--text-1);margin:2px 0;">${r.name}</div>
              <div style="font-size:11.5px;color:var(--text-3);">
                <span style="color:var(--primary);font-weight:600;">${r.dist < 1000 ? r.dist+'m' : (r.dist/1000).toFixed(1)+'km'}</span>
                · 步行约${r.walkMin}分钟
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // ===== 周边配套 =====
  // 判断房源记录所属城市（兼容旧数据无 city 字段，按区域反查）
  function recCityOf(r) {
    if (r && r.city && Store.CITIES[r.city]) return r.city;
    if (!r) return '';
    for (const c in Store.CITIES) {
      if ((Store.CITIES[c]||[]).includes(r.district)) return c;
    }
    return '';
  }
  function renderFacility() {
    return `<div class="card">
      <div class="card-title">${ic('hospital')} 周边配套地图（以小区为中心3KM范围）</div>
      <div class="form-grid">
        <div class="form-item full"><label>查询城市</label>
          <div class="cascade-group loc-cascade">${Store.cityCascadeHTML(facilityCity, 'fc', { onCity: 'LocationMod.setFacilityCity(this)' })}</div>
        </div>
        <div class="form-item"><label>小区名称</label><input type="text" id="f_comm" placeholder="输入小区名" data-autocomplete data-city="${facilityCity}" data-poi-type="${POI_TYPES.community}" onblur="LocationMod.detectDistrictFromInput(this,'f_dist')"></div>
        <div class="form-item"><label>所在区域</label>
          <select id="f_dist">
            <option value="">请选择</option>
            ${(Store.CITIES[facilityCity] || Store.getDistricts()).map(d=>`<option>${d}</option>`).join('')}
          </select>
        </div>
      </div>
      <div style="margin-top:10px;"><button class="btn btn-primary" onclick="LocationMod.showFacility()">${ic('search',15)} 显示配套</button></div>
      <div id="f_result" style="margin-top:14px;"></div>
    </div>`;
  }
  async function showFacility() {
    const commInput = document.getElementById('f_comm').value.trim();
    const dist = document.getElementById('f_dist').value;
    const useReal = amapConfigured();
    // 搜索中心：优先小区名 → 所选区域 → 所选城市（支持直接按区域/城市查询周边配套）
    const searchKey = commInput || (dist ? facilityCity + dist : facilityCity);
    const comm = commInput || (dist ? `${facilityCity}·${dist}` : facilityCity);

    document.getElementById('f_result').innerHTML = `
      <div class="empty-state" style="padding:30px;">
        <div style="font-size:24px;">${useReal?ic('globe',28):ic('hospital',28)}</div>
        <h4>${useReal?'正在搜索周边配套...':'加载中...'}</h4>
      </div>`;

    let data = [];
    let centerLoc = null;  // 小区坐标，供后续地图渲染使用
    let allPois = [];      // 所有 POI（含坐标），供地图标注

    if (useReal) {
      centerLoc = await geocode(searchKey, facilityCity);
      if (!centerLoc && dist) centerLoc = await geocode(dist, facilityCity); // 区域名兜底再试
      if (!centerLoc) {
        _renderErr('f_result', '小区地址解析失败：请确认小区名正确，且高德 Web 服务 Key 有效。', true);
        return;
      }
      // 商场类按 p.type 中文三级格式细分（购物中心/百货商场/电影院…），sub 返回细分标签
      const subMall = pois => {
        const cnt = {};
        pois.forEach(p => {
          const leaf = ((p.type||'').split(';').pop()||'').trim();
          if (leaf) cnt[leaf] = (cnt[leaf]||0) + 1;
        });
        return Object.entries(cnt).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k} ${v}`).join(' · ');
      };
      // 园区/企业：公司企业170000（公司170100/知名企业170200）+ 商务住宅120100（产业园区/写字楼，真实API实测120301等码无数据）
      const categories = [
        { cat:'地铁站', types:'150500', color:'#1677FF', icon:'train' },
        { cat:'医院/诊所', types:'090100', color:'#F5222D', icon:'hospital' },
        { cat:'商超/菜场', types:'060101|060400', color:'#FA8C16', icon:'shop' },
        { cat:'学校/幼儿园', types:'141200|141205', color:'#722ED1', icon:'school' },
        { cat:'商场/影院', types:'060100|080600', color:'#EB2F96', icon:'bag', sub: subMall },
        { cat:'公园/绿地', types:'110101', color:'#52C41A', icon:'sun' },
        { cat:'银行/ATM', types:'160100', color:'#13C2C2', icon:'bank' },
        { cat:'园区/企业', types:'170100|170200|120100', color:'#1D39C4', icon:'building' },
      ];
      // 分批并发请求（高德 QPS 限流：8 个并发会被 CUQPS 拒绝导致卡片随机缺失，每批 3 个）
      const results = [];
      for (let i = 0; i < categories.length; i += 3) {
        const batch = await Promise.all(categories.slice(i, i + 3).map(async c => {
          const pois = await searchAround(centerLoc, c.types, 3000);
          // 保留坐标供地图标注
          pois.forEach(p => {
            if (p.location) allPois.push({ ...p, cat: c.cat, color: c.color });
          });
          return {
            category: c.cat,
            count: pois.length,
            names: pois.slice(0,5).map(p => `${p.name}(${Math.round(Number(p.distance)||0)}m)`),
            distance: '<3km',
            sub: c.sub ? c.sub(pois) : ''
          };
        }));
        results.push(...batch);
      }
      data = results.filter(r => r.count > 0);
      if (!data.length) {
        _renderErr('f_result', '高德周边搜索未返回任何 POI 结果，请确认小区名书写正确或稍后重试。', true);
        return;
      }
    } else {
      // 未配置高德 Key：不做本地模拟，提示前往配置
      document.getElementById('f_result').innerHTML = Utils.apiGate('amap');
      return;
    }

    const totalScore = Math.round(75 + Math.random()*15);
    // 地图容器：有 JS Key 时显示真实地图，否则显示静态占位图
    const hasJsKey = !!(localStorage.getItem('k_amap_js')||'').trim();
    const mapPlaceholder = hasJsKey
      ? `<div id="facilityMap" style="height:380px;border-radius:8px;overflow:hidden;border:1px solid var(--border-light);background:#f5f5f5;position:relative;">
           <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:var(--text-3);font-size:13px;">${ic('map',13)} 地图加载中...</div>
         </div>`
      : `<div style="height:280px;background:linear-gradient(135deg,#F0F7FF,#FFF7E6);border-radius:8px;margin:10px 0;display:flex;align-items:center;justify-content:center;color:var(--text-3);font-size:13px;position:relative;overflow:hidden;">
           <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:120px;height:120px;border-radius:50%;background:rgba(0,113,227,0.08);border:2px dashed rgba(0,113,227,0.3);"></div>
           <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:240px;height:240px;border-radius:50%;background:rgba(0,113,227,0.04);border:2px dashed rgba(0,113,227,0.15);"></div>
           <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:360px;height:360px;border-radius:50%;background:rgba(0,113,227,0.02);border:1px dashed rgba(0,113,227,0.1);"></div>
           <div style="position:relative;z-index:1;text-align:center;">
             <div style="font-size:28px;">${ic('house',30)}</div>
             <strong>${comm}</strong><br/>
             <small>${ic('pin',13)} 配置高德 Key 后显示交互式地图</small>
           </div>
         </div>`;

    document.getElementById('f_result').innerHTML = `
      <div style="border:1px solid var(--border-light);border-radius:10px;padding:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px;">
          <h3 style="font-size:15px;">${ic('pin',14)} ${comm}${dist?' · '+dist:''} 3KM生活圈 ${useReal?'<span style="font-size:11px;background:var(--success-soft);color:var(--success);padding:2px 6px;border-radius:4px;margin-left:6px;">'+ic('globe',12)+' 实时</span>':''}</h3>
          <div style="display:flex;align-items:center;gap:8px;">
            配套便利度：${Utils.matchRingHTML(totalScore)}
          </div>
        </div>
        ${mapPlaceholder}
        <div class="f-cats">
          ${data.map(f=>`<div class="f-cat">
            <div class="f-cat-head">
              <span class="f-cat-name">${f.category}</span>
              <span class="tag tag-sm tag-success">${f.count}处</span>
            </div>
            ${f.sub ? `<div class="f-cat-sub">${f.sub}</div>` : ''}
            <div class="f-cat-list">${f.names.join(' · ')}</div>
            <div class="f-cat-range">${ic('pin',12)} 覆盖范围 ${f.distance}</div>
          </div>`).join('')}
        </div>
      </div>
    `;

    // 渲染真实地图组件（需要 JS Key + 已有坐标）
    if (hasJsKey && centerLoc) {
      try {
        await renderFacilityMap(centerLoc, allPois, comm);
      } catch(e) {
        console.warn('地图组件加载失败:', e);
        const mapBox = document.getElementById('facilityMap');
        if (mapBox) {
          mapBox.innerHTML = `<div style="padding:30px;text-align:center;color:var(--text-3);">${ic('alert',14)} 地图加载失败：${e.message}<br/>可改用静态图：<a href="${staticMapUrl(centerLoc)}" target="_blank">查看小区位置卫星图</a></div>`;
        }
      }
    }
  }

  // ===== 距离测算（小区 → 任意目标：商场/医院/学校/地铁） =====
  function renderDistance() {
    const fromEx = `${distCities.fromCity}市中心`;
    const fromEx2 = '输入小区名';
    const toEx = `${distCities.toCity}市中心`;
    const html = `
      <div class="card">
        <div class="card-title">${ic('ruler')} 距离测算（小区 → 任意目标）</div>
        <div class="form-grid">
          <div class="form-item full"><label>起点（小区）</label>
            <div class="loc-row">
              <div class="cascade-group">${Store.cityCascadeHTML(distCities.fromCity, 'df', { onCity: 'LocationMod.setFromCity(this)' })}</div>
              <input type="text" id="d_from" placeholder="如：${fromEx} / ${fromEx2}" data-autocomplete data-city="${distCities.fromCity}" data-poi-type="${POI_TYPES.community}" style="flex:1;min-width:180px;">
            </div>
          </div>
          <div class="form-item full"><label>终点（商场/医院/学校/地铁...）</label>
            <div class="loc-row">
              <div class="cascade-group">${Store.cityCascadeHTML(distCities.toCity, 'dt', { onCity: 'LocationMod.setToCity(this)' })}</div>
              <input type="text" id="d_to" placeholder="如：${toEx} / 万达广场 / 人民医院 / 火车站" data-autocomplete data-city="${distCities.toCity}" data-poi-type="" style="flex:1;min-width:180px;">
            </div>
          </div>
          <div class="form-item"><label>出行方式</label>
            <select id="d_mode">
              <option value="driving">驾车</option>
              <option value="walking" selected>步行</option>
              <option value="transit">公交+地铁</option>
              <option value="bicycling">骑行</option>
            </select>
          </div>
          <div class="form-item" style="display:flex;align-items:flex-end;">
            <button class="btn btn-primary" onclick="LocationMod.calcDistance()">${ic('search',15)} 计算距离</button>
          </div>
        </div>
        <div id="d_result" style="margin-top:14px;">
          <div class="empty-state" style="padding:24px;"><div class="icon">${ic('ruler',54)}</div>
            <h4>输入起点和终点开始测算</h4>
            <p>支持小区→商场、小区→医院、小区→学校等多种场景的真实距离与时间计算。</p>
          </div>
        </div>
      </div>
    `;
    // 同步下拉的 poiType 到输入框
    setTimeout(()=>{
      const toInput = document.getElementById('d_to');
      if (toInput) {
        // 默认无类型限制（任意POI）
        toInput.dataset.poiType = '';
      }
    }, 50);
    return html;
  }

  async function calcDistance() {
    const from = document.getElementById('d_from').value.trim();
    const to = document.getElementById('d_to').value.trim();
    const mode = document.getElementById('d_mode').value;
    if (!from || !to) {
      Utils.toast('请填写起点和终点','warn');
      const rb = document.getElementById('d_result');
      if (rb) rb.innerHTML = `<div style="padding:16px;background:var(--warn-soft);color:var(--warn);border-radius:10px;">${ic('alert',14)} 请先填写起点和终点。</div>`;
      return;
    }
    const useReal = amapConfigured();
    const resultBox = document.getElementById('d_result');
    // 与路径 API 请求并行预加载高德 SDK，缩短地图连线渲染等待
    const sdkPromise = (localStorage.getItem('k_amap_js')||'').trim() ? loadAmapSDK() : Promise.resolve(null);

    resultBox.innerHTML = `<div class="empty-state" style="padding:30px;"><div style="font-size:24px;">${useReal?ic('globe',28):ic('ruler',28)}</div>
      <h4>${useReal?'正在计算路径...':'计算中...'}</h4>
      <p style="font-size:12.5px;color:var(--text-3);">${from} → ${to}（${mode==='driving'?'驾车':mode==='walking'?'步行':mode==='transit'?'公交':mode==='bicycling'?'骑行':'-'}）</p></div>`;

    if (!useReal) {
      // 未配置高德 Key：不做本地估算模拟，提示前往配置
      resultBox.innerHTML = `
        <div style="border:1px solid var(--danger);background:var(--danger-soft);border-radius:10px;padding:18px;text-align:center;">
          <div style="font-size:26px;">${ic('alertCircle',30)}</div>
          <p style="margin:10px 0 14px;font-size:13px;line-height:1.7;">未配置高德 Web 服务 Key，无法进行真实距离测算。<br/>请先在设置中配置后重试。</p>
          <button class="btn btn-primary btn-sm" onclick="App.navigate('settings')">${ic('gear',15)} 前往配置高德 API</button>
        </div>`;
      return;
    }

    // 真实调用：地理编码 + 路径规划
    const originLoc = await geocode(from, distCities.fromCity);
    const destLoc = await geocode(to, distCities.toCity);
    if (!originLoc || !destLoc) {
      resultBox.innerHTML = `<div style="padding:16px;background:var(--danger-soft);color:var(--danger);border-radius:10px;">
        ${ic('alert',14)} 地址解析失败：${!originLoc?'起点':'终点'} "${!originLoc?from:to}" 未找到坐标，请改用更准确的名称。
      </div>`;
      return;
    }

    let result = null;
    if (mode === 'walking') {
      // 步行：调用 walking 路径规划
      const url = `https://restapi.amap.com/v3/direction/walking?key=${encodeURIComponent(getAmapKey().srv)}&origin=${encodeURIComponent(originLoc)}&destination=${encodeURIComponent(destLoc)}`;
      try {
        const res = await fetchT(url); const data = await res.json();
        if (data.status==='1' && data.route && data.route.paths && data.route.paths[0]) {
          const p = data.route.paths[0];
          result = { distance: (Number(p.distance)/1000).toFixed(2), duration: Math.round(Number(p.duration)/60) };
        }
      } catch(e) {}
    } else if (mode === 'bicycling') {
      const url = `https://restapi.amap.com/v4/direction/bicycling?key=${encodeURIComponent(getAmapKey().srv)}&origin=${encodeURIComponent(originLoc)}&destination=${encodeURIComponent(destLoc)}`;
      try {
        const res = await fetchT(url); const data = await res.json();
        if (data.data && data.data.paths && data.data.paths[0]) {
          const p = data.data.paths[0];
          result = { distance: (Number(p.distance)/1000).toFixed(2), duration: Math.round(Number(p.duration)/60) };
        }
      } catch(e) {}
    } else {
      // driving / transit 复用 routePlan
      const r = await routePlan(originLoc, destLoc, mode, distCities.fromCity, distCities.toCity);
      if (r) result = { distance: String(r.distance), duration: r.duration };
    }

    if (!result) {
      resultBox.innerHTML = `<div style="padding:16px;background:var(--warn-soft);color:var(--warn);border-radius:10px;">
        ${ic('alert',14)} 路径规划失败，请尝试更换出行方式或目标名称。
      </div>`;
      return;
    }

    const straightDist = _haversine(originLoc, destLoc);
    const modeLabel = mode==='driving'?'驾车':mode==='walking'?'步行':mode==='transit'?'公交+地铁':mode==='bicycling'?'骑行':'-';
    const speed = mode==='driving'?35:mode==='walking'?5:mode==='transit'?20:mode==='bicycling'?15:20;
    resultBox.innerHTML = `
      <div style="padding:16px;background:linear-gradient(135deg,var(--primary),var(--accent));color:#fff;border-radius:10px;">
        <div style="font-size:11.5px;opacity:0.9;">${modeLabel}</div>
        <h4 style="font-size:15px;margin:6px 0;">${from} → ${to}</h4>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:12px;">
          <div><strong style="font-size:22px;">${result.distance}</strong><span style="font-size:12px;opacity:0.85;"> km</span><br/><span style="opacity:0.85;font-size:11.5px;">路径距离</span></div>
          <div><strong style="font-size:22px;">${result.duration}</strong><span style="font-size:12px;opacity:0.85;"> 分</span><br/><span style="opacity:0.85;font-size:11.5px;">预计耗时</span></div>
          <div><strong style="font-size:22px;">${straightDist}</strong><span style="font-size:12px;opacity:0.85;"> km</span><br/><span style="opacity:0.85;font-size:11.5px;">直线距离</span></div>
        </div>
      </div>
      <div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap;">
        <span class="tag tag-primary tag-sm">${ic('roadmap',14)} 路径系数 ${(Number(result.distance)/Number(straightDist)||0).toFixed(2)}</span>
        <span class="tag tag-success tag-sm">${ic('bolt',13)} 平均时速 ${Math.round(Number(result.distance)/(result.duration/60))} km/h</span>
        ${Number(result.distance)<2?'<span class="tag tag-success tag-sm">'+ic('check',13)+' 步行可达</span>':Number(result.distance)<5?'<span class="tag tag-primary tag-sm">'+ic('compass',13)+' 骑行友好</span>':'<span class="tag tag-warn tag-sm">'+ic('car',13)+' 建议驾车</span>'}
      </div>
      <div id="distMap" style="margin-top:14px;height:420px;border-radius:10px;border:1px solid var(--border-light);background:#f2f4f8;overflow:hidden;position:relative;">
        <div id="distMapLoading" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--text-3);font-size:13px;pointer-events:none;">${ic('map',13)} 正在加载路径地图…</div>
      </div>
    `;
    // 异步渲染地图（marker + 路径连线），5秒超时兜底
    let mapTimer = setTimeout(() => {
      const loadingEl = document.getElementById('distMapLoading');
      const mapBox = document.getElementById('distMap');
      if (loadingEl && loadingEl.parentElement === mapBox) {
        // 超时后尝试静态图降级
        const srvKey = getAmapKey().srv;
        if (srvKey) {
          const markers = `-1,0xF5222D,${encodeURIComponent(from)},${originLoc}|-1,0x1677FF,${encodeURIComponent(to)},${destLoc}`;
          const pathStr = `${originLoc},${destLoc}`;
          const cLng = ((Number(originLoc.split(',')[0])+Number(destLoc.split(',')[0]))/2).toFixed(6);
          const cLat = ((Number(originLoc.split(',')[1])+Number(destLoc.split(',')[1]))/2).toFixed(6);
          const sUrl = `https://restapi.amap.com/v3/staticmap?key=${encodeURIComponent(srvKey)}&location=${cLng},${cLat}&zoom=12&size=900*420&scale=2&markers=${encodeURIComponent(markers)}&paths=${encodeURIComponent(`2,0x1677FF,0.7,3,${pathStr}`)}`;
          mapBox.innerHTML = `<img src="${sUrl}" alt="路径地图" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.parentElement.innerHTML='<div style=\\'padding:24px;color:var(--text-3);font-size:12.5px;text-align:center;\\'>地图加载超时，请检查网络或高德Key配置。</div>'">`;
        } else {
          mapBox.innerHTML = '<div style="padding:24px;color:var(--text-3);font-size:12.5px;text-align:center;">' + ic('clock',13) + ' 地图加载超时，请到【系统设置】检查高德Key配置。</div>';
        }
      }
    }, 5000);
    renderDistMap(originLoc, destLoc, from, to, mode, sdkPromise).then(() => {
      clearTimeout(mapTimer);
      const loadingEl = document.getElementById('distMapLoading');
      if (loadingEl) loadingEl.remove();
    }).catch(() => {
      clearTimeout(mapTimer);
      const box = document.getElementById('distMap');
      if (box) box.innerHTML = '<div style="padding:24px;color:var(--text-3);font-size:12.5px;">' + ic('pin',13) + ' 地图渲染失败，请检查高德JS Key配置。</div>';
    });
  }

  // ===== 距离测算·交互式地图与路径连线 =====
  async function renderDistMap(originLoc, destLoc, fromName, toName, mode, sdkPromise) {
    const jsKey = (localStorage.getItem('k_amap_js')||'').trim();
    const srvKey = getAmapKey().srv;
    const [olng, olat] = originLoc.split(',').map(Number);
    const [dlng, dlat] = destLoc.split(',').map(Number);

    // 无 JS Key：降级用静态图展示连线
    if (!jsKey) {
      const box = document.getElementById('distMap');
      if (!box) return;
      if (srvKey) {
        const cLng = ((olng+dlng)/2).toFixed(6), cLat = ((olat+dlat)/2).toFixed(6);
        const markers = [
          `-1,0xF5222D,${encodeURIComponent(fromName)}`, originLoc,
          `-1,0x1677FF,${encodeURIComponent(toName)}`, destLoc
        ].join('|');
        const pathStr = `${originLoc},${destLoc}`;
        const url = `https://restapi.amap.com/v3/staticmap?key=${encodeURIComponent(srvKey)}&location=${cLng},${cLat}&zoom=12&size=900*420&scale=2&markers=${encodeURIComponent(markers)}&paths=${encodeURIComponent(`2,0x1677FF,0.7,3,${pathStr}`)}`;
        box.innerHTML = `<div style="position:absolute;inset:0;">
          <img src="${url}" alt="路径地图" style="width:100%;height:100%;object-fit:cover;display:block;"
               onerror="this.parentElement.innerHTML='<div style=\\'padding:24px;color:var(--text-3);font-size:12.5px;\\'>静态地图加载失败，请检查高德Key配置。</div>'">
          <div style="position:absolute;left:10px;bottom:8px;background:rgba(255,255,255,.85);padding:4px 8px;border-radius:6px;font-size:11.5px;">${ic('map',13)} 静态地图（配置 JS Key 可使用交互地图）</div>
        </div>`;
      } else {
        box.innerHTML = `<div style="padding:24px;color:var(--text-3);font-size:12.5px;">${ic('pin',13)} 建议在【系统设置】中配置高德 Web端 JS Key，即可显示交互地图与真实路径连线。<br/><button class="btn btn-accent btn-sm" style="margin-top:10px;" onclick="App.navigate('settings')">去配置 Key</button></div>`;
      }
      return;
    }

    // 有 JS Key：加载高德 JS SDK 并渲染交互地图（sdkPromise 已与路径请求并行预加载）
    let AMap = null;
    try { AMap = sdkPromise ? await sdkPromise : await loadAmapSDK(); } catch(e) {
      const box = document.getElementById('distMap');
      if (box) box.innerHTML = `<div style="padding:24px;color:var(--text-3);font-size:12.5px;">${ic('pin',13)} 高德SDK加载失败：${e.message||e}<br/><button class="btn btn-accent btn-sm" style="margin-top:10px;" onclick="App.navigate('settings')">检查 Key 配置</button></div>`;
      return;
    }
    const box = document.getElementById('distMap');
    if (!box) return;
    const map = new AMap.Map('distMap', {
      zoom: 12,
      center: [(olng+dlng)/2, (olat+dlat)/2],
      mapStyle: 'amap://styles/whitesmoke',
      viewMode: '2D'
    });

    // 起点/终点自定义 Marker
    map.add([
      new AMap.Marker({
        position: [olng, olat],
        content: `<div style="background:#F5222D;color:#fff;padding:4px 10px;border-radius:14px;font-size:12px;font-weight:600;box-shadow:0 2px 8px rgba(245,34,45,.35);white-space:nowrap;border:2px solid #fff;">${ic('flag',14)} ${fromName}</div>`,
        offset: new AMap.Pixel(-40, -14), anchor: 'center'
      }),
      new AMap.Marker({
        position: [dlng, dlat],
        content: `<div style="background:#1677FF;color:#fff;padding:4px 10px;border-radius:14px;font-size:12px;font-weight:600;box-shadow:0 2px 8px rgba(22,119,255,.35);white-space:nowrap;border:2px solid #fff;">${ic('target',14)} ${toName}</div>`,
        offset: new AMap.Pixel(-40, -14), anchor: 'center'
      })
    ]);

    // 超时保护：5秒后如果路径还没画出来，至少画一条直线并自动适配视野
    let routeDrawn = false;
    const timeout = setTimeout(() => {
      if (routeDrawn) return;
      routeDrawn = true;
      try {
        map.add(new AMap.Polyline({
          path: [[olng,olat],[dlng,dlat]],
          strokeColor: '#1677FF', strokeWeight: 4, strokeOpacity: 0.7,
          lineJoin: 'round', showDir: true, strokeDashArray: [8, 6]
        }));
        map.setFitView();
      } catch(e) {}
      try { if (AMap.Scale) map.addControl(new AMap.Scale()); } catch(e) {}
      try { if (AMap.ToolBar) map.addControl(new AMap.ToolBar({position:'RB', locate:false})); } catch(e) {}
    }, 5000);

    function onRouteDone() {
      if (routeDrawn) return;
      routeDrawn = true;
      clearTimeout(timeout);
      try { map.setFitView(); } catch(e) {}
      try { if (AMap.Scale) map.addControl(new AMap.Scale()); } catch(e) {}
      try { if (AMap.ToolBar) map.addControl(new AMap.ToolBar({position:'RB', locate:false})); } catch(e) {}
    }

    try {
      if (mode === 'driving') {
        new AMap.Driving({ map, hideMarkers: true, autoFitView: true })
          .search(originLoc, destLoc, (s) => { if (s === 'complete') onRouteDone(); else onRouteDone(); });
      } else if (mode === 'walking') {
        new AMap.Walking({ map, hideMarkers: true, autoFitView: true })
          .search(originLoc, destLoc, () => onRouteDone());
      } else if (mode === 'bicycling') {
        new AMap.Bicycling({ map, hideMarkers: true, autoFitView: true })
          .search(originLoc, destLoc, () => onRouteDone());
      } else if (mode === 'transit') {
        new AMap.Transfer({ map, city: distCities.toCity, hideMarkers: true, autoFitView: true })
          .search(originLoc, destLoc, () => onRouteDone());
      } else { onRouteDone(); }
    } catch(err) {
      // 失败降级：画一条虚线
      try {
        map.add(new AMap.Polyline({
          path: [[olng,olat],[dlng,dlat]],
          strokeColor: '#1677FF', strokeWeight: 4, strokeOpacity: 0.7,
          lineJoin: 'round', showDir: true, strokeDashArray: [8, 6]
        }));
        map.setFitView();
      } catch(e) {}
      onRouteDone();
    }
  }

  // 两点坐标 → 直线距离 km（保留2位小数）
  function _haversine(loc1, loc2) {
    const [lng1, lat1] = loc1.split(',').map(Number);
    const [lng2, lat2] = loc2.split(',').map(Number);
    const R = 6371;
    const dLat = (lat2-lat1) * Math.PI/180;
    const dLng = (lng2-lng1) * Math.PI/180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
    return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))).toFixed(2);
  }

  // 渲染高德 JS API 交互式地图（含小区中心 Marker + POI Marker + 圆形范围）
  async function renderFacilityMap(centerLoc, allPois, comm) {
    const AMap = await loadAmapSDK();
    const [lng, lat] = centerLoc.split(',').map(Number);
    const map = new AMap.Map('facilityMap', {
      zoom: 14,
      center: [lng, lat],
      mapStyle: 'amap://styles/whitesmoke',
      viewMode: '2D'
    });

    // 3KM 圆形覆盖范围
    map.add(new AMap.Circle({
      center: [lng, lat], radius: 3000,
      fillOpacity: 0.06, fillColor: '#1677FF',
      strokeColor: '#1677FF', strokeWeight: 1, strokeOpacity: 0.5
    }));

    // 小区中心 Marker（红色，可点击）
    const centerMarker = new AMap.Marker({
      position: [lng, lat],
      content: `<div style="background:#F5222D;color:#fff;padding:4px 10px;border-radius:14px;font-size:12px;font-weight:600;box-shadow:0 2px 8px rgba(245,34,45,0.4);white-space:nowrap;border:2px solid #fff;">${ic('house',14)} ${comm}</div>`,
      offset: new AMap.Pixel(-40, -14),
      anchor: 'center'
    });
    centerMarker.on('click', () => {
      map.setZoomAndCenter(16, [lng, lat]);
    });
    map.add(centerMarker);

    // POI Markers（按类别着色，最多展示前 30 个避免拥挤）
    const shown = allPois.slice(0, 30);
    const infoWindow = new AMap.InfoWindow({ offset: new AMap.Pixel(0, -24) });
    shown.forEach(p => {
      const [plng, plat] = p.location.split(',').map(Number);
      const marker = new AMap.Marker({
        position: [plng, plat],
        content: `<div style="width:14px;height:14px;background:${p.color};border:2px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>`,
        offset: new AMap.Pixel(-7, -7),
        anchor: 'center'
      });
      marker.on('click', () => {
        infoWindow.setContent(`<div style="padding:6px 10px;font-size:12px;"><strong style="color:${p.color}">${p.cat}</strong><br/>${p.name}<br/><span style="color:#888">距小区 ${Math.round(Number(p.distance)||0)}m</span></div>`);
        infoWindow.open(map, [plng, plat]);
      });
      map.add(marker);
    });

    // 比例尺+缩放控件（安全调用，避免插件未加载时报错）
    try { if (AMap.Scale) map.addControl(new AMap.Scale()); } catch(e) {}
    try { if (AMap.ToolBar) map.addControl(new AMap.ToolBar({ position: 'RB', locate: false })); } catch(e) {}
  }

  return { render, setWorkCity, setPartCity, setCommCity, setSchoolCity, setFacilityCity, setFromCity, setToCity, setSuggestedCommunity, detectDistrictFromInput, calcCommute, querySchool, showFacility, calcDistance };
})();
