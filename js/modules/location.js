/* ============================================
   M9 区位分析工具集
   通勤/学区/配套/房价趋势
   ============================================ */
window.LocationMod = (function() {
  let tab = 'commute';

  // ===== 高德 API 辅助 =====
  function getAmapKey() {
    return {
      js:  (localStorage.getItem('k_amap_js')  || '').trim(),
      srv: (localStorage.getItem('k_amap_srv') || '').trim()
    };
  }
  function amapConfigured() { return !!getAmapKey().srv; }

  // 高德地理编码：地址 → 坐标
  async function geocode(address, city='南京') {
    const key = getAmapKey().srv;
    if (!key) return null;
    const url = `https://restapi.amap.com/v3/geocode/geo?key=${encodeURIComponent(key)}&address=${encodeURIComponent(address)}&city=${encodeURIComponent(city)}`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (data.status === '1' && data.geocodes && data.geocodes[0]) {
        return data.geocodes[0].location; // "lng,lat"
      }
    } catch(e) { console.error('geocode err', e); }
    return null;
  }

  // 高德路径规划：driving/transit
  async function routePlan(origin, destination, mode='driving') {
    const key = getAmapKey().srv;
    if (!key) return null;
    const url = mode === 'driving'
      ? `https://restapi.amap.com/v3/direction/driving?key=${encodeURIComponent(key)}&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&strategy=10`
      : `https://restapi.amap.com/v3/direction/transit/integrated?key=${encodeURIComponent(key)}&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&city=南京&cityd=南京`;
    try {
      const res = await fetch(url);
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

  // 高德 POI 周边搜索
  async function searchAround(location, types, radius=3000) {
    const key = getAmapKey().srv;
    if (!key || !location) return [];
    const url = `https://restapi.amap.com/v3/place/around?key=${encodeURIComponent(key)}&location=${encodeURIComponent(location)}&types=${encodeURIComponent(types)}&radius=${radius}&offset=10&extensions=all`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (data.status === '1' && data.pois) {
        return data.pois.map(p => ({ name: p.name, distance: p.distance, address: p.address||'', location: p.location||'' }));
      }
    } catch(e) { console.error('around err', e); }
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
      // 8秒超时：防止 script 标签加载卡住不返回
      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        _amapPromise = null;
        reject(new Error('高德SDK加载超时（8秒），请检查JS Key或网络'));
        try { delete window[cb]; } catch(e) {}
      }, 8000);
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
    const keyStatus = k.srv
      ? `<span class="tag tag-success tag-sm">✓ 高德API已接入</span>`
      : `<span class="tag tag-warn tag-sm">未配置高德Key（模拟模式）</span>`;
    const html = `
      <div class="page-header">
        <div>
          <h2><span class="emoji">🗺️</span>区位分析工具集</h2>
          <p class="page-desc">通勤/学区/配套/房价趋势四大区位分析工具 ${keyStatus}</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-accent btn-sm" onclick="LocationMod.applyMapKey()">🌐 接入高德地图API</button>
        </div>
      </div>

      <div class="sub-tabs" id="locTabs">
        <div class="sub-tab" data-t="commute">🚗 通勤时间分析</div>
        <div class="sub-tab" data-t="school">🎓 学区查询</div>
        <div class="sub-tab" data-t="facility">🏥 周边配套地图</div>
        <div class="sub-tab" data-t="distance">📏 距离测算</div>
        <div class="sub-tab" data-t="trend">📈 区域房价趋势</div>
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
    else { box.innerHTML = renderTrend(); renderTrendChart(); }
    // 绑定智能补全（所有带 data-autocomplete 的输入框）
    bindAutocomplete();
  }

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
  async function fetchInputTips(keyword, poiType='') {
    if (!keyword || keyword.length < 1) return [];
    const cacheKey = keyword + '|' + poiType;
    if (_acCache[cacheKey]) return _acCache[cacheKey];
    const key = getAmapKey().srv;
    if (!key) {
      // 本地降级：从已有房源记录和板块数据中匹配
      const records = Store.getRecords();
      const local = records.map(r=>r.communityName).filter(n=>n && n.includes(keyword));
      const districts = Object.keys(DISTRICT_DATA).filter(d=>d.includes(keyword));
      const result = [...new Set([...local, ...districts])].slice(0, 8).map(n=>({name:n, district:'', address:''}));
      _acCache[cacheKey] = result;
      return result;
    }
    try {
      const url = `https://restapi.amap.com/v3/place/text?key=${encodeURIComponent(key)}&keywords=${encodeURIComponent(keyword)}&city=南京&citylimit=true&types=${encodeURIComponent(poiType)}&offset=8`;
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
      const container = document.createElement('div');
      container.className = 'ac-dropdown';
      container.style.cssText = 'position:absolute;left:0;top:100%;margin-top:2px;z-index:9999;background:#fff;border:1px solid var(--border-light);border-radius:6px;box-shadow:0 6px 16px rgba(0,0,0,0.14);max-height:240px;overflow-y:auto;display:none;min-width:100%;width:max-content;max-width:360px;';
      // 确保 input 的父级有 position:relative
      const parent = input.parentElement;
      parent.style.position = parent.style.position || 'relative';
      parent.appendChild(container);

      let _timer = null;
      input.addEventListener('input', () => {
        clearTimeout(_timer);
        _timer = setTimeout(async () => {
          const kw = input.value.trim();
          if (!kw) { container.style.display='none'; return; }
          const tips = await fetchInputTips(kw, poiType);
          if (!tips.length) { container.style.display='none'; return; }
          container.innerHTML = tips.map(t => `
            <div class="ac-item" style="padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--bg-2);font-size:12.5px;" data-name="${t.name}" data-loc="${t.location||''}">
              <div style="color:var(--text-1);font-weight:500;">${t.name}</div>
              ${t.address?`<div style="color:var(--text-3);font-size:11px;margin-top:2px;">${t.district||''} ${t.address}</div>`:''}
            </div>`).join('');
          container.style.display = 'block';
          container.querySelectorAll('.ac-item').forEach(item => {
            item.addEventListener('mousedown', (e) => {
              e.preventDefault();
              input.value = item.dataset.name;
              if (item.dataset.loc) input.dataset.loc = item.dataset.loc;
              container.style.display = 'none';
              input.dispatchEvent(new Event('ac-selected'));
            });
          });
        }, 250);
      });
      input.addEventListener('blur', () => {
        setTimeout(()=>container.style.display='none', 200);
      });
    });
  }

  // ===== 通勤分析 =====
  function renderCommute() {
    const exp = Store.getExpectation();
    const districts = Object.keys(DISTRICT_DATA);
    return `<div class="grid-2">
      <div class="card">
        <div class="card-title">🚗 输入通勤参数</div>
        <div class="form-grid">
          <div class="form-item full"><label>我的工作地点</label>
            <input type="text" id="c_work" value="${exp.workplace||''}" placeholder="如：新街口地铁站 / 软件谷" data-autocomplete data-poi-type="${POI_TYPES.work}"></div>
          <div class="form-item full"><label>伴侣工作地点（可选）</label>
            <input type="text" id="c_part" value="${exp.partnerWorkplace||''}" placeholder="如：仙林大学城" data-autocomplete data-poi-type="${POI_TYPES.work}"></div>
          <div class="form-item"><label>房源所在小区</label>
            <select id="c_district" onchange="LocationMod.setSuggestedCommunity()">
              ${districts.map(d=>`<option>${d}</option>`).join('')}
            </select></div>
          <div class="form-item"><label>或具体小区名</label>
            <input type="text" id="c_community" placeholder="如：百家湖花园" data-autocomplete data-poi-type="${POI_TYPES.community}"></div>
          <div class="form-item full"><label>可接受通勤时长上限：${exp.maxCommuteTime||45} 分钟 <a onclick="App.navigate('expectation')" style="color:var(--primary);cursor:pointer;text-decoration:underline;">修改</a></label></div>
        </div>
        <div style="text-align:right;margin-top:10px;">
          <button class="btn btn-primary" onclick="LocationMod.calcCommute()">🔍 分析通勤</button>
        </div>
        <div class="callout" style="margin-top:12px;">
          <div class="callout-title">🌐 技术说明</div>
          <p style="font-size:12px;">生产环境可接入<strong>高德地图Web服务API</strong>（direction/driving、direction/transit），输入两地地址即可获取精确的驾车/地铁通勤时长与距离。免费额度为每日30万次调用，个人使用完全够用。本模块已预留接口，申请Key填入设置即可使用。</p>
        </div>
      </div>
      <div id="c_result" class="card">
        <div class="empty-state" style="padding:20px;"><div class="icon">🚗</div>
          <h4>点击"分析通勤"查看结果</h4>
          <p>基于南京各板块到市中心/各CBD的平均通勤数据进行模拟分析，结果仅供参考。</p></div>
      </div>
    </div>`;
  }
  function setSuggestedCommunity() {
    const d = document.getElementById('c_district').value;
    const seed = RecommendMod;
    const example = (SEED_HOUSES_FALLBACK() || []).find(h=>h.district===d);
    if (example) document.getElementById('c_community').value = example.communityName;
  }
  // 避免依赖，写一个内联的
  function SEED_HOUSES_FALLBACK() {
    return [
      {communityName:'百家湖花园',district:'江宁'},{communityName:'桥北新村',district:'浦口'},
      {communityName:'仙林湖万达茂',district:'栖霞'},{communityName:'铁心桥龙湖春江郦城',district:'雨花台'},
      {communityName:'龙江银城花园',district:'鼓楼'},{communityName:'河西南招商雍和府',district:'建邺'},
      {communityName:'红山新城尚华府',district:'玄武'},{communityName:'大校场金基望樾府',district:'秦淮'},
      {communityName:'雄州龙池湖畔',district:'六合'}
    ];
  }
  async function calcCommute() {
    const work = (document.getElementById('c_work').value||'').trim() || '新街口';
    const part = (document.getElementById('c_part').value||'').trim();
    const district = document.getElementById('c_district').value;
    const community = (document.getElementById('c_community').value||'').trim() || district+'某小区';
    const exp = Store.getExpectation();
    const limit = exp.maxCommuteTime || 45;
    const useReal = amapConfigured();

    // 显示加载
    document.getElementById('c_result').innerHTML = `
      <div class="empty-state" style="padding:30px;">
        <div style="font-size:24px;">${useReal?'🌐':'📊'}</div>
        <h4>${useReal?'正在调用高德API规划路径...':'计算中...'}</h4>
        <p style="font-size:12.5px;color:var(--text-3);">${useReal?'从 '+community+' 到 '+work+' 的真实驾车/地铁路径':'基于本地模拟数据'}</p>
      </div>`;

    let subway, drive, driveDist='', subwayDist='';
    let dataSource = '';

    if (useReal) {
      // 真实调用：先地理编码，再路径规划
      const originLoc = await geocode(community, '南京');
      const destLoc = await geocode(work, '南京');
      if (originLoc && destLoc) {
        const driveRes = await routePlan(originLoc, destLoc, 'driving');
        const subwayRes = await routePlan(originLoc, destLoc, 'transit');
        drive = driveRes ? driveRes.duration : null;
        subway = subwayRes ? subwayRes.duration : null;
        if (driveRes) driveDist = ` · ${driveRes.distance}km`;
        if (subwayRes) subwayDist = ` · ${subwayRes.distance}km`;
        dataSource = '🌐 数据来源：高德地图路径规划API（实时）';
        if (drive == null && subway == null) {
          Utils.toast('高德API未返回有效路径，已回退本地模拟','warn');
          return _calcCommuteLocal(work, part, district, community, exp, limit);
        }
        // 缺失项用本地估算补全
        if (drive == null) drive = Math.round((subway||40) * 0.9);
        if (subway == null) subway = Math.round(drive * 1.1);
      } else {
        Utils.toast('地址解析失败，已回退本地模拟','warn');
        return _calcCommuteLocal(work, part, district, community, exp, limit);
      }
    } else {
      return _calcCommuteLocal(work, part, district, community, exp, limit);
    }

    const subwayOK = subway <= limit, driveOK = drive <= limit;
    let partHtml = '';
    if (part) {
      // 伴侣简化：使用相同的预估值
      const ps = Math.max(5, subway + Math.round(Math.random()*10-5));
      partHtml = `<div class="r-item"><div class="r-label">💑 伴侣地铁通勤（至${part}）</div><div class="r-value" style="${ps<=limit?'':'color:var(--danger)'}">${ps} 分钟 ${ps<=limit?'✅':'⚠️超出'}</div></div>`;
    }

    let advice, color;
    if (subwayOK && driveOK) { advice='通勤在可接受范围，该板块可达性良好'; color='tag-success'; }
    else if (subwayOK || driveOK) { advice='一种方式可接受，另一种超出；建议优先选地铁/自驾更优方案'; color='tag-primary'; }
    else { advice='两种通勤方式均超出上限，长期居住需考虑时间成本与疲劳度'; color='tag-danger'; }

    document.getElementById('c_result').innerHTML = `
      <div class="calc-result" style="background:linear-gradient(135deg,var(--primary),var(--accent));">
        <h4>通勤分析结果 ${useReal?'<span style="font-size:11px;background:rgba(255,255,255,0.2);padding:2px 6px;border-radius:4px;margin-left:6px;">🌐 实时</span>':''}</h4>
        <div class="big-num" style="font-size:20px;">${community} → ${work}</div>
        <div class="result-grid">
          <div class="r-item"><div class="r-label">🟢 地铁（公交+步行）</div><div class="r-value" style="${subwayOK?'':'color:var(--danger)'}">${subway} 分钟${subwayDist} ${subwayOK?'✅':'⚠️超出'}</div></div>
          <div class="r-item"><div class="r-label">🚗 自驾</div><div class="r-value" style="${driveOK?'':'color:var(--danger)'}">${drive} 分钟${driveDist} ${driveOK?'✅':'⚠️超出'}</div></div>
          <div class="r-item"><div class="r-label">🚴 骑行/公交</div><div class="r-value">${Math.round(subway*1.2)} 分钟</div></div>
          ${partHtml}
        </div>
      </div>
      <div style="margin-top:14px;"><span class="tag ${color}" style="padding:4px 10px;font-size:12px;">💡 ${advice}</span></div>
      <div style="margin-top:8px;font-size:11.5px;color:var(--text-3);">${dataSource}</div>
    `;
  }

  // 本地模拟（高德未配置/调用失败时回退）
  function _calcCommuteLocal(work, part, district, community, exp, limit) {
    const commuteBase = {
      '鼓楼':{subway:15,drive:20}, '玄武':{subway:18,drive:22}, '建邺':{subway:22,drive:28},
      '秦淮':{subway:20,drive:25}, '雨花台':{subway:28,drive:30}, '江宁':{subway:40,drive:35},
      '栖霞':{subway:35,drive:32}, '浦口':{subway:45,drive:40}, '六合':{subway:70,drive:60},
      '溧水':{subway:80,drive:70}, '高淳':{subway:100,drive:90}
    };
    const info = commuteBase[district] || {subway:40, drive:35};
    let subway = info.subway, drive = info.drive;
    let shift = 0;
    if (/仙林|栖霞/.test(work)) shift = district==='栖霞'?-15:(district==='江宁'?10:0);
    else if (/江北|浦口|高新区/.test(work)) shift = district==='浦口'?-15:5;
    else if (/软件谷|铁心桥|雨花/.test(work)) shift = district==='雨花台'?-10:(district==='江宁'?-5:10);
    else if (/江宁|百家湖|九龙湖/.test(work)) shift = district==='江宁'?-12:5;
    subway += shift; drive += shift;
    subway = Math.max(5, subway); drive = Math.max(5, drive);
    const subwayOK = subway <= limit, driveOK = drive <= limit;

    let partHtml = '';
    if (part) {
      let shift2 = 0;
      if (/仙林|栖霞/.test(part)) shift2 = district==='栖霞'?-15:5;
      const ps = Math.max(5, subway+shift2);
      partHtml = `<div class="r-item"><div class="r-label">伴侣地铁通勤</div><div class="r-value" style="${ps<=limit?'':'color:var(--danger)'}">${ps} 分钟 ${ps<=limit?'✅':'⚠️超出'}</div></div>`;
    }

    let advice, color;
    if (subwayOK && driveOK) { advice='通勤在可接受范围，该板块可达性良好'; color='tag-success'; }
    else if (subwayOK || driveOK) { advice='一种方式可接受，另一种超出；建议优先选地铁/自驾更优方案'; color='tag-primary'; }
    else { advice='两种通勤方式均超出上限，长期居住需考虑时间成本与疲劳度'; color='tag-danger'; }

    document.getElementById('c_result').innerHTML = `
      <div class="calc-result" style="background:linear-gradient(135deg,var(--primary),var(--accent));">
        <h4>通勤分析结果 <span style="font-size:11px;background:rgba(255,255,255,0.2);padding:2px 6px;border-radius:4px;margin-left:6px;">📊 本地模拟</span></h4>
        <div class="big-num" style="font-size:20px;">${community} → ${work}</div>
        <div class="result-grid">
          <div class="r-item"><div class="r-label">🟢 地铁（推荐）</div><div class="r-value" style="${subwayOK?'':'color:var(--danger)'}">${subway} 分钟 ${subwayOK?'✅':'⚠️超出'}</div></div>
          <div class="r-item"><div class="r-label">🚗 自驾</div><div class="r-value" style="${driveOK?'':'color:var(--danger)'}">${drive} 分钟 ${driveOK?'✅':'⚠️超出'}</div></div>
          <div class="r-item"><div class="r-label">🚴 骑行/公交</div><div class="r-value">${Math.round(subway*1.2)} 分钟</div></div>
          ${partHtml}
        </div>
      </div>
      <div style="margin-top:14px;"><span class="tag ${color}" style="padding:4px 10px;font-size:12px;">💡 ${advice}</span></div>
      <div style="margin-top:8px;font-size:11.5px;color:var(--text-3);">📊 数据来源：本地模拟（基于南京各板块平均通勤时长） · 如需真实路径请配置高德API Key</div>
    `;
  }
  function applyMapKey() { App.navigate('settings'); }

  // ===== 学区查询 =====
  function renderSchool() {
    const records = Store.getRecords();
    const districts = Object.keys(DISTRICT_DATA);
    return `<div class="card">
      <div class="card-title">🎓 学区查询</div>
      <div class="form-grid">
        <div class="form-item">
          <label>按板块查询</label>
          <select id="s_dist">
            <option value="">— 选择板块 —</option>
            ${districts.map(d=>`<option>${d}</option>`).join('')}
          </select>
        </div>
        <div class="form-item">
          <label>或关联房源记录</label>
          <select id="s_rec">
            <option value="">— 选择房源记录 —</option>
            ${records.map(r=>`<option value="${r.id}">${r.communityName} · ${r.district||''}</option>`).join('')}
          </select>
        </div>
        <div class="form-item full">
          <label>或输入具体小区名查询周边配套距离</label>
          <input type="text" id="s_comm" placeholder="如：百家湖花园 / 龙江银城花园" data-autocomplete data-poi-type="${POI_TYPES.community}">
        </div>
      </div>
      <div style="margin-top:10px;"><button class="btn btn-primary" onclick="LocationMod.querySchool()">🔍 查询学区</button></div>
      <div id="s_result" style="margin-top:14px;"></div>
    </div>`;
  }
  async function querySchool() {
    let dist = document.getElementById('s_dist').value;
    const recId = document.getElementById('s_rec').value;
    const commInput = document.getElementById('s_comm').value.trim();
    let commName = commInput;
    if (!dist && recId) {
      const r = Store.getRecord(recId);
      if (r) { dist = r.district; commName = commName || r.communityName; }
    }
    if (!dist && !commName) { Utils.toast('请选择板块、房源或输入小区名','warn'); return; }
    if (!dist && commName) {
      // 尝试通过POI搜索推断区域
      const srvKey = getAmapKey().srv;
      if (srvKey) {
        try {
          const url = `https://restapi.amap.com/v3/place/text?key=${encodeURIComponent(srvKey)}&keywords=${encodeURIComponent(commName)}&city=南京&citylimit=true&types=120200|120300&offset=1`;
          const res = await fetch(url);
          const data = await res.json();
          if (data.status === '1' && data.pois && data.pois[0]) {
            dist = (data.pois[0].adname||'').replace('区','').replace('县','');
          }
        } catch(e) {}
      }
      if (!dist) dist = '江宁'; // 兜底
    }
    const d = DISTRICT_DATA[dist] || DISTRICT_DATA['江宁'];
    // 模拟评级
    const rate = ['顶级','优秀','良好','较好','一般'][Math.min(4, ['鼓楼','玄武','建邺','秦淮','栖霞','雨花台','江宁','浦口','六合','溧水','高淳'].indexOf(dist))];
    const rateColor = ['顶级','优秀'].includes(rate)?'tag-success':(rate==='良好'?'tag-primary':'tag-warn');

    // 如果有具体小区名，查询周边配套距离
    let facilityDistHtml = '';
    if (commName) {
      facilityDistHtml = await fetchFacilityDistances(commName);
    }

    document.getElementById('s_result').innerHTML = `
      <div style="background:#fff;border:1px solid var(--border-light);border-radius:10px;padding:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <h3 style="font-size:16px;">📍 ${dist} 学区概况${commName?` · ${commName}`:''}</h3>
          <span class="tag ${rateColor} tag-sm">学区评级：${rate}</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
          <div style="padding:10px;background:var(--primary-soft);border-radius:8px;">
            <h4 style="font-size:13px;color:var(--primary);margin-bottom:4px;">🏫 小学学区</h4>
            <p style="font-size:12.5px;color:var(--text-2);line-height:1.8;">${d.school}</p>
          </div>
          <div style="padding:10px;background:var(--accent-soft);border-radius:8px;">
            <h4 style="font-size:13px;color:var(--accent);margin-bottom:4px;">🚇 交通配套</h4>
            <p style="font-size:12.5px;color:var(--text-2);line-height:1.8;">${d.subway}</p>
          </div>
          <div style="padding:10px;background:var(--success-soft);border-radius:8px;">
            <h4 style="font-size:13px;color:var(--success);margin-bottom:4px;">🏥 医疗配套</h4>
            <p style="font-size:12.5px;color:var(--text-2);line-height:1.8;">${d.hospital}</p>
          </div>
          <div style="padding:10px;background:var(--warn-soft);border-radius:8px;">
            <h4 style="font-size:13px;color:var(--warn);margin-bottom:4px;">🛍️ 商业配套</h4>
            <p style="font-size:12.5px;color:var(--text-2);line-height:1.8;">${d.mall}</p>
          </div>
        </div>
        <div style="margin-top:10px;">
          <h4 style="font-size:13px;margin:10px 0 6px;">🌳 休闲配套</h4>
          <p style="font-size:12.5px;color:var(--text-2);">${d.park}</p>
          <h4 style="font-size:13px;margin:10px 0 6px;">🏭 产业支撑</h4>
          <p style="font-size:12.5px;color:var(--text-2);">${d.industry}</p>
          <h4 style="font-size:13px;margin:10px 0 6px;">📈 房价基准 & 升值潜力</h4>
          <p style="font-size:12.5px;color:var(--text-2);">二手房挂牌基准价约 <strong style="color:var(--accent)">${d.basePrice.toLocaleString()}元/㎡</strong>，综合升值潜力评估：<strong class="tag tag-success tag-sm">${d.potential}</strong></p>
        </div>
        ${facilityDistHtml}
      </div>
    `;
  }

  // 查询小区到周边配套设施的距离
  async function fetchFacilityDistances(commName) {
    const srvKey = getAmapKey().srv;
    if (!srvKey) return '<div style="margin-top:14px;padding:10px;background:var(--bg-2);border-radius:8px;font-size:12px;color:var(--text-3);">📌 配置高德API Key后可查询小区到周边配套设施的精确距离</div>';
    // 先获取小区坐标
    let commLoc = null;
    try {
      const geoUrl = `https://restapi.amap.com/v3/place/text?key=${encodeURIComponent(srvKey)}&keywords=${encodeURIComponent(commName)}&city=南京&citylimit=true&types=120200|120300&offset=1`;
      const geoRes = await fetch(geoUrl);
      const geoData = await geoRes.json();
      if (geoData.status === '1' && geoData.pois && geoData.pois[0] && geoData.pois[0].location) {
        commLoc = geoData.pois[0].location;
      }
    } catch(e) {}
    if (!commLoc) return '';
    // 搜索周边各类配套
    const facilityTypes = [
      { label:'🏫 最近学校', type:'141200|141205', icon:'🏫' },
      { label:'🏥 最近医院', type:'090100', icon:'🏥' },
      { label:'🛍️ 最近商场', type:'060100', icon:'🛍️' },
      { label:'🚇 最近地铁站', type:'150500', icon:'🚇' },
      { label:'🌳 最近公园', type:'110101', icon:'🌳' },
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
        <h4 style="font-size:13px;color:var(--text-1);margin-bottom:8px;">📏 ${commName} 周边配套距离</h4>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;">
          ${valid.map(r => `
            <div style="padding:8px 10px;background:#fff;border-radius:6px;border:1px solid var(--border-light);">
              <div style="font-size:12px;color:var(--text-3);">${r.label}</div>
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
  function renderFacility() {
    return `<div class="card">
      <div class="card-title">🏥 周边配套地图（以小区为中心3KM范围）</div>
      <div class="form-grid">
        <div class="form-item"><label>小区名称</label><input id="f_comm" placeholder="输入小区名或点击下方示例" data-autocomplete data-poi-type="${POI_TYPES.community}"></div>
        <div class="form-item"><label>所在区域</label>
          <select id="f_dist">
            ${Object.keys(DISTRICT_DATA).map(d=>`<option>${d}</option>`).join('')}
          </select>
        </div>
      </div>
      <p style="font-size:12.5px;color:var(--text-3);margin:8px 0;">💡 示例：
        ${['百家湖花园','桥北新村','仙林湖万达茂','龙江银城花园'].map(n=>`<a style="color:var(--primary);cursor:pointer;margin-right:12px;" onclick="document.getElementById('f_comm').value='${n}';LocationMod.showFacility();">${n}</a>`).join('')}
      </p>
      <button class="btn btn-primary btn-sm" onclick="LocationMod.showFacility()">🗺️ 显示配套</button>
      <div id="f_result" style="margin-top:14px;"></div>
      <div class="callout warn" style="margin-top:14px;">
        <div class="callout-title">🌐 真实地图实现方案</div>
        <p style="font-size:12px;"><strong>高德/百度地图 JS API：</strong>申请Web端Key，加载地图 → 按小区名 Geocoding → 调用 place/search?keywords=地铁站 并按半径检索 → 展示Marker与步行距离。API免费额度可充分满足个人使用。"周边配套地图"占位页面后续可无缝接入真实地图组件。</p>
      </div>
    </div>`;
  }
  async function showFacility() {
    const comm = document.getElementById('f_comm').value.trim() || '示例小区';
    const dist = document.getElementById('f_dist').value;
    const useReal = amapConfigured();

    document.getElementById('f_result').innerHTML = `
      <div class="empty-state" style="padding:30px;">
        <div style="font-size:24px;">${useReal?'🌐':'🏥'}</div>
        <h4>${useReal?'正在调用高德API搜索周边POI...':'加载中...'}</h4>
        <p style="font-size:12.5px;color:var(--text-3);">${useReal?'真实数据来源：高德地点搜索API':'本地模拟数据'}</p>
      </div>`;

    let data = [];
    let dataSource = '';
    let centerLoc = null;  // 小区坐标，供后续地图渲染使用
    let allPois = [];      // 所有 POI（含坐标），供地图标注

    if (useReal) {
      centerLoc = await geocode(comm, '南京');
      if (!centerLoc) {
        Utils.toast('小区地址解析失败，已回退本地模拟','warn');
        data = _facilityMockData();
        dataSource = '📊 数据来源：本地模拟（地址解析失败）';
      } else {
        // 高德 POI 类型码：地铁站150500/医院090100/超市060100/学校141200/商场060100/公园110100/银行160100/餐饮050000
        const categories = [
          { cat:'🚇 地铁站', types:'150500', color:'#1677FF', icon:'metro' },
          { cat:'🏥 医院/诊所', types:'090100', color:'#F5222D', icon:'hospital' },
          { cat:'🛒 商超/菜场', types:'060101,060400', color:'#FA8C16', icon:'cart' },
          { cat:'🎓 学校/幼儿园', types:'141200,141205', color:'#722ED1', icon:'school' },
          { cat:'🛍️ 商场/影院', types:'060100,080600', color:'#EB2F96', icon:'mall' },
          { cat:'🌳 公园/绿地', types:'110101', color:'#52C41A', icon:'park' },
          { cat:'🏦 银行/ATM', types:'160100', color:'#13C2C2', icon:'bank' },
        ];
        const results = await Promise.all(categories.map(async c => {
          const pois = await searchAround(centerLoc, c.types, 3000);
          // 保留坐标供地图标注
          pois.forEach(p => {
            if (p.location) allPois.push({ ...p, cat: c.cat, color: c.color });
          });
          return {
            category: c.cat,
            count: pois.length,
            names: pois.slice(0,5).map(p => `${p.name}(${Math.round(Number(p.distance)||0)}m)`),
            distance: '<3km'
          };
        }));
        data = results.filter(r => r.count > 0);
        if (!data.length) {
          Utils.toast('周边未搜索到POI，已回退本地模拟','warn');
          data = _facilityMockData();
          dataSource = '📊 数据来源：本地模拟（API未返回结果）';
        } else {
          dataSource = '🌐 数据来源：高德地点搜索API（真实POI） · 地图组件由高德JS API渲染';
        }
      }
    } else {
      data = _facilityMockData();
      dataSource = '📊 数据来源：本地模拟数据 · 如需真实POI请配置高德API Key';
    }

    const totalScore = Math.round(75 + Math.random()*15);
    // 地图容器：有 JS Key 时显示真实地图，否则显示静态占位图
    const hasJsKey = !!(localStorage.getItem('k_amap_js')||'').trim();
    const mapPlaceholder = hasJsKey
      ? `<div id="facilityMap" style="height:380px;border-radius:8px;overflow:hidden;border:1px solid var(--border-light);background:#f5f5f5;position:relative;">
           <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:var(--text-3);font-size:13px;">🗺️ 地图加载中...</div>
         </div>`
      : `<div style="height:280px;background:linear-gradient(135deg,#EFF6FF,#FEF3C7);border-radius:8px;margin:10px 0;display:flex;align-items:center;justify-content:center;color:var(--text-3);font-size:13px;position:relative;overflow:hidden;">
           <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:120px;height:120px;border-radius:50%;background:rgba(30,58,138,0.08);border:2px dashed rgba(30,58,138,0.3);"></div>
           <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:240px;height:240px;border-radius:50%;background:rgba(30,58,138,0.04);border:2px dashed rgba(30,58,138,0.15);"></div>
           <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:360px;height:360px;border-radius:50%;background:rgba(30,58,138,0.02);border:1px dashed rgba(30,58,138,0.1);"></div>
           <div style="position:relative;z-index:1;text-align:center;">
             <div style="font-size:28px;">🏠</div>
             <strong>${comm}</strong><br/>
             <small>📍 接入高德 JS Key 后显示真实交互式地图</small>
           </div>
         </div>`;

    document.getElementById('f_result').innerHTML = `
      <div style="border:1px solid var(--border-light);border-radius:10px;padding:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px;">
          <h3 style="font-size:15px;">📍 ${comm}${dist?' · '+dist:''} 3KM生活圈 ${useReal?'<span style="font-size:11px;background:var(--success-soft);color:var(--success);padding:2px 6px;border-radius:4px;margin-left:6px;">🌐 实时</span>':''}</h3>
          <div style="display:flex;align-items:center;gap:8px;">
            配套便利度：${Utils.matchRingHTML(totalScore)}
          </div>
        </div>
        ${mapPlaceholder}
        <div style="margin-top:10px;font-size:11.5px;color:var(--text-3);">${dataSource}</div>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-top:10px;">
          ${data.map(f=>`<div style="padding:8px 10px;background:#fff;border:1px solid var(--border-light);border-radius:6px;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <strong style="font-size:12.5px;">${f.category}</strong>
              <span class="tag tag-sm tag-success">${f.count}处</span>
            </div>
            <div style="font-size:11.5px;color:var(--text-2);margin-top:4px;line-height:1.7;">${f.names.join(' · ')}</div>
            <div style="font-size:11px;color:var(--primary);margin-top:2px;">覆盖范围 ${f.distance}</div>
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
          mapBox.innerHTML = `<div style="padding:30px;text-align:center;color:var(--text-3);">⚠️ 地图加载失败：${e.message}<br/>可改用静态图：<a href="${staticMapUrl(centerLoc)}" target="_blank">查看小区位置卫星图</a></div>`;
        }
      }
    }
  }

  // ===== 距离测算（小区 → 任意目标：商场/医院/学校/地铁） =====
  function renderDistance() {
    const records = Store.getRecords();
    const html = `
      <div class="card">
        <div class="card-title">📏 距离测算（小区 → 任意目标）</div>
        <p style="font-size:12.5px;color:var(--text-3);margin-bottom:12px;">输入小区名和目标地点（商场/医院/学校/地铁站等），自动调用高德API计算真实驾车/步行距离与时间。支持从下拉列表快速选择已记录的房源作为起点。</p>
        <div class="form-grid">
          <div class="form-item full"><label>起点（小区）</label>
            <input type="text" id="d_from" placeholder="如：百家湖花园 / 龙江银城花园" data-autocomplete data-poi-type="${POI_TYPES.community}">
          </div>
          <div class="form-item full"><label>终点（商场/医院/学校/地铁...）</label>
            <input type="text" id="d_to" placeholder="如：景枫KINGMO / 鼓楼医院 / 仙林小学" data-autocomplete data-poi-type="">
          </div>
          <div class="form-item"><label>出行方式</label>
            <select id="d_mode">
              <option value="driving">🚗 驾车</option>
              <option value="walking" selected>🚶 步行</option>
              <option value="transit">🚇 公交+地铁</option>
              <option value="bicycling">🚴 骑行</option>
            </select>
          </div>
          <div class="form-item" style="display:flex;align-items:flex-end;">
            <button class="btn btn-primary" onclick="LocationMod.calcDistance()">🔍 计算距离</button>
          </div>
        </div>
        ${records.length ? `
          <div style="margin-top:12px;padding:10px;background:var(--bg-2);border-radius:6px;font-size:12.5px;">
            <strong style="color:var(--text-2);">📌 快速选择已记录房源作为起点：</strong>
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;">
              ${records.slice(0,6).map(r=>`<span class="tag tag-sm" style="cursor:pointer;background:var(--primary-soft);color:var(--primary);" onclick="document.getElementById('d_from').value='${r.communityName}';">${r.communityName}</span>`).join('')}
            </div>
          </div>` : ''}
        <div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap;">
          <span style="font-size:11.5px;color:var(--text-3);">常用目标快捷：</span>
          ${[
            {n:'🛍️ 商场', t:'060100'},
            {n:'🏥 医院', t:'090100'},
            {n:'🎓 学校', t:'141200'},
            {n:'🚇 地铁站', t:'150500'},
            {n:'🌳 公园', t:'110101'},
          ].map(x=>`<span class="tag tag-sm" style="cursor:pointer;" onclick="document.getElementById('d_to').dataset.poiType='${x.t}';document.getElementById('d_to').focus();">${x.n}</span>`).join('')}
        </div>
        <div id="d_result" style="margin-top:14px;">
          <div class="empty-state" style="padding:24px;"><div class="icon">📏</div>
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
    if (!from || !to) { Utils.toast('请填写起点和终点','warn'); return; }
    const useReal = amapConfigured();
    const resultBox = document.getElementById('d_result');

    resultBox.innerHTML = `<div class="empty-state" style="padding:30px;"><div style="font-size:24px;">${useReal?'🌐':'📏'}</div>
      <h4>${useReal?'正在调用高德API计算路径...':'计算中...'}</h4>
      <p style="font-size:12.5px;color:var(--text-3);">${from} → ${to}（${mode==='driving'?'驾车':mode==='walking'?'步行':mode==='transit'?'公交':mode==='bicycling'?'骑行':'-'}）</p></div>`;

    if (!useReal) {
      // 本地降级：估算直线距离（板块间平均距离）
      const distRecord = _estimateDistance(from, to);
      const walkTime = Math.round(distRecord / 60); // 5km/h = 12min/km
      resultBox.innerHTML = `
        <div style="padding:16px;background:linear-gradient(135deg,var(--primary),var(--accent));color:#fff;border-radius:10px;">
          <div style="font-size:11.5px;opacity:0.9;">📊 本地估算（未配置高德Key）</div>
          <h4 style="font-size:15px;margin:6px 0;">${from} → ${to}</h4>
          <div style="display:flex;gap:24px;margin-top:10px;font-size:13px;">
            <div><strong style="font-size:18px;">${distRecord}</strong> km<br/><span style="opacity:0.85;">估算直线距离</span></div>
            <div><strong style="font-size:18px;">${walkTime}</strong> 分钟<br/><span style="opacity:0.85;">步行估算</span></div>
          </div>
        </div>
        <p style="margin-top:10px;font-size:11.5px;color:var(--text-3);">⚠️ 未配置高德API Key，仅返回粗略估算。配置 Key 后可获取真实路径距离。</p>
        <button class="btn btn-accent btn-sm" style="margin-top:8px;" onclick="App.navigate('settings')">去配置高德Key</button>
      `;
      return;
    }

    // 真实调用：地理编码 + 路径规划
    const originLoc = await geocode(from, '南京');
    const destLoc = await geocode(to, '南京');
    if (!originLoc || !destLoc) {
      resultBox.innerHTML = `<div style="padding:16px;background:var(--danger-soft);color:var(--danger);border-radius:10px;">
        ⚠️ 地址解析失败：${!originLoc?'起点':'终点'} "${!originLoc?from:to}" 未找到坐标，请改用更准确的名称。
      </div>`;
      return;
    }

    let result = null;
    if (mode === 'walking') {
      // 步行：调用 walking 路径规划
      const url = `https://restapi.amap.com/v3/direction/walking?key=${encodeURIComponent(getAmapKey().srv)}&origin=${encodeURIComponent(originLoc)}&destination=${encodeURIComponent(destLoc)}`;
      try {
        const res = await fetch(url); const data = await res.json();
        if (data.status==='1' && data.route && data.route.paths && data.route.paths[0]) {
          const p = data.route.paths[0];
          result = { distance: (Number(p.distance)/1000).toFixed(2), duration: Math.round(Number(p.duration)/60) };
        }
      } catch(e) {}
    } else if (mode === 'bicycling') {
      const url = `https://restapi.amap.com/v4/direction/bicycling?key=${encodeURIComponent(getAmapKey().srv)}&origin=${encodeURIComponent(originLoc)}&destination=${encodeURIComponent(destLoc)}`;
      try {
        const res = await fetch(url); const data = await res.json();
        if (data.data && data.data.paths && data.data.paths[0]) {
          const p = data.data.paths[0];
          result = { distance: (Number(p.distance)/1000).toFixed(2), duration: Math.round(Number(p.duration)/60) };
        }
      } catch(e) {}
    } else {
      // driving / transit 复用 routePlan
      const r = await routePlan(originLoc, destLoc, mode);
      if (r) result = { distance: String(r.distance), duration: r.duration };
    }

    if (!result) {
      resultBox.innerHTML = `<div style="padding:16px;background:var(--warn-soft);color:var(--warn);border-radius:10px;">
        ⚠️ 路径规划失败，请尝试更换出行方式或目标名称。
      </div>`;
      return;
    }

    const straightDist = _haversine(originLoc, destLoc);
    const modeLabel = mode==='driving'?'驾车':mode==='walking'?'步行':mode==='transit'?'公交+地铁':mode==='bicycling'?'骑行':'-';
    const speed = mode==='driving'?35:mode==='walking'?5:mode==='transit'?20:mode==='bicycling'?15:20;
    resultBox.innerHTML = `
      <div style="padding:16px;background:linear-gradient(135deg,var(--primary),var(--accent));color:#fff;border-radius:10px;">
        <div style="font-size:11.5px;opacity:0.9;">🌐 高德API实时数据 · ${modeLabel}</div>
        <h4 style="font-size:15px;margin:6px 0;">${from} → ${to}</h4>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:12px;">
          <div><strong style="font-size:22px;">${result.distance}</strong><span style="font-size:12px;opacity:0.85;"> km</span><br/><span style="opacity:0.85;font-size:11.5px;">路径距离</span></div>
          <div><strong style="font-size:22px;">${result.duration}</strong><span style="font-size:12px;opacity:0.85;"> 分</span><br/><span style="opacity:0.85;font-size:11.5px;">预计耗时</span></div>
          <div><strong style="font-size:22px;">${straightDist}</strong><span style="font-size:12px;opacity:0.85;"> km</span><br/><span style="opacity:0.85;font-size:11.5px;">直线距离</span></div>
        </div>
      </div>
      <div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap;">
        <span class="tag tag-primary tag-sm">🛣️ 路径系数 ${(Number(result.distance)/Number(straightDist)||0).toFixed(2)}</span>
        <span class="tag tag-success tag-sm">⚡ 平均时速 ${Math.round(Number(result.distance)/(result.duration/60))} km/h</span>
        ${Number(result.distance)<2?'<span class="tag tag-success tag-sm">✅ 步行可达</span>':Number(result.distance)<5?'<span class="tag tag-primary tag-sm">🚴 骑行友好</span>':'<span class="tag tag-warn tag-sm">🚗 建议驾车</span>'}
      </div>
      <p style="margin-top:10px;font-size:11.5px;color:var(--text-3);">🌐 数据来源：高德路径规划API（${modeLabel}模式）</p>
      <div id="distMap" style="margin-top:14px;height:420px;border-radius:10px;border:1px solid var(--border-light);background:#f2f4f8;overflow:hidden;position:relative;">
        <div id="distMapLoading" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--text-3);font-size:13px;pointer-events:none;">🗺️ 正在加载路径地图…</div>
      </div>
    `;
    // 异步渲染地图（marker + 路径连线），10秒超时兜底
    let mapTimer = setTimeout(() => {
      const loadingEl = document.getElementById('distMapLoading');
      const mapBox = document.getElementById('distMap');
      if (loadingEl && loadingEl.parentElement === mapBox) {
        mapBox.innerHTML = '<div style="padding:24px;color:var(--text-3);font-size:12.5px;text-align:center;">⏱️ 地图加载超时，可能是高德JS Key未配置或网络受限。<br/>请到【系统设置】检查高德Key配置，或尝试使用静态地图模式。</div>';
      }
    }, 10000);
    renderDistMap(originLoc, destLoc, from, to, mode).then(() => {
      clearTimeout(mapTimer);
      const loadingEl = document.getElementById('distMapLoading');
      if (loadingEl) loadingEl.remove();
    }).catch(() => {
      clearTimeout(mapTimer);
      const box = document.getElementById('distMap');
      if (box) box.innerHTML = '<div style="padding:24px;color:var(--text-3);font-size:12.5px;">📌 地图渲染失败，请检查高德JS Key配置。</div>';
    });
  }

  // ===== 距离测算·交互式地图与路径连线 =====
  async function renderDistMap(originLoc, destLoc, fromName, toName, mode) {
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
               onerror="this.parentElement.innerHTML='<div style=\\'padding:24px;color:var(--text-3);font-size:12.5px;\\'>📌 静态地图加载失败，请检查高德Key配置。</div>'">
          <div style="position:absolute;left:10px;bottom:8px;background:rgba(255,255,255,.85);padding:4px 8px;border-radius:6px;font-size:11.5px;">🔲 静态地图（配置 JS Key 可使用交互地图）</div>
        </div>`;
      } else {
        box.innerHTML = `<div style="padding:24px;color:var(--text-3);font-size:12.5px;">📌 建议在【系统设置】中配置高德 Web端 JS Key，即可显示交互地图与真实路径连线。<br/><button class="btn btn-accent btn-sm" style="margin-top:10px;" onclick="App.navigate('settings')">去配置 Key</button></div>`;
      }
      return;
    }

    // 有 JS Key：加载高德 JS SDK 并渲染交互地图
    let AMap = null;
    try { AMap = await loadAmapSDK(); } catch(e) {
      const box = document.getElementById('distMap');
      if (box) box.innerHTML = `<div style="padding:24px;color:var(--text-3);font-size:12.5px;">📌 高德SDK加载失败：${e.message||e}<br/><button class="btn btn-accent btn-sm" style="margin-top:10px;" onclick="App.navigate('settings')">检查 Key 配置</button></div>`;
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
        content: `<div style="background:#F5222D;color:#fff;padding:4px 10px;border-radius:14px;font-size:12px;font-weight:600;box-shadow:0 2px 8px rgba(245,34,45,.35);white-space:nowrap;border:2px solid #fff;">🏁 ${fromName}</div>`,
        offset: new AMap.Pixel(-40, -14), anchor: 'center'
      }),
      new AMap.Marker({
        position: [dlng, dlat],
        content: `<div style="background:#1677FF;color:#fff;padding:4px 10px;border-radius:14px;font-size:12px;font-weight:600;box-shadow:0 2px 8px rgba(22,119,255,.35);white-space:nowrap;border:2px solid #fff;">🎯 ${toName}</div>`,
        offset: new AMap.Pixel(-40, -14), anchor: 'center'
      })
    ]);

    // 超时保护：8秒后如果路径还没画出来，至少画一条直线并自动适配视野
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
    }, 8000);

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
        new AMap.Transfer({ map, city: '南京', hideMarkers: true, autoFitView: true })
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

  // 简单距离估算（板块级，未配置Key时用）
  function _estimateDistance(from, to) {
    // 用板块中心点估算
    const centers = {
      '江宁':[118.85,31.95],'浦口':[118.62,32.06],'栖霞':[118.86,32.15],
      '雨花台':[118.78,31.99],'鼓楼':[118.77,32.07],'玄武':[118.79,32.05],
      '建邺':[118.73,32.00],'秦淮':[118.79,32.02],'六合':[119.02,32.37],
      '溧水':[119.03,31.65],'高淳':[118.88,31.33]
    };
    const findLoc = (name) => {
      for (const d in centers) if (name.includes(d)) return centers[d];
      return [118.80, 32.05]; // 默认市中心
    };
    const [x1,y1] = findLoc(from);
    const [x2,y2] = findLoc(to);
    return _haversine(x1+','+y1, x2+','+y2);
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
      content: `<div style="background:#F5222D;color:#fff;padding:4px 10px;border-radius:14px;font-size:12px;font-weight:600;box-shadow:0 2px 8px rgba(245,34,45,0.4);white-space:nowrap;border:2px solid #fff;">🏠 ${comm}</div>`,
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
  function _facilityMockData() {
    const templateFacility = (category, count, names, distance) => ({category, count, names, distance});
    return [
      templateFacility('🚇 地铁站', 3, ['百家湖站(约580m)','胜太路站(约900m)','小龙湾站(约1.2km)'], '<1.5km'),
      templateFacility('🏥 医院/诊所', 4, ['江宁医院(约1.5km)','社区卫生中心(约350m)','同仁医院(约2.5km)','康复诊所(约800m)'], '<3km'),
      templateFacility('🛒 商超/菜场', 5, ['大型菜场(约400m)','永辉超市(约700m)','苏果便利(约250m)','盒马鲜生(约1.1km)','社区团购点(约150m)'], '<1km'),
      templateFacility('🎓 学校/幼儿园', 4, ['小区内幼儿园(约200m)','百家湖小学(约800m)','初中(约1.2km)','早教中心(约500m)'], '<1.5km'),
      templateFacility('🛍️ 商场/影院', 3, ['景枫KINGMO(约1.0km)','21世纪太阳城(约1.1km)','万达影城(约1.2km)'], '<1.5km'),
      templateFacility('🌳 公园/绿地', 2, ['百家湖公园(约500m)','城市休闲广场(约300m)'], '<1km'),
      templateFacility('🏦 银行/ATM', 5, ['工商银行(约200m)','建设银行(约300m)','农业银行(约450m)','招商银行ATM','南京银行(约700m)'], '<1km'),
    ];
  }

  // ===== 区域房价趋势 =====
  function renderTrend() {
    const districts = Object.keys(DISTRICT_DATA);
    return `<div class="card">
      <div class="card-title">📈 近12个月南京各板块二手房均价走势（元/㎡）<span style="font-weight:400;font-size:11.5px;color:var(--text-3);">（模拟数据，生产环境可对接每月抓取任务）</span></div>
      <div style="margin-bottom:10px;display:flex;gap:6px;flex-wrap:wrap;">
        ${districts.map((d,i)=>{
          const colors = ['#1E3A8A','#3B82F6','#D4A24C','#16A34A','#DC2626','#0EA5E9','#7C3AED','#0891B2','#65A30D','#9333EA','#E9C478'];
          return `<label style="display:flex;align-items:center;gap:4px;padding:3px 8px;border:1px solid var(--border);border-radius:20px;cursor:pointer;font-size:11.5px;">
            <input type="checkbox" id="trend_${d}" ${['江宁','浦口','鼓楼','河西'].includes(d)?'checked':''} onchange="LocationMod.renderTrendChart()">
            <span style="width:10px;height:10px;border-radius:2px;background:${colors[i%11]};display:inline-block;"></span>${d}</label>`;
        }).join('')}
      </div>
      <div style="height:360px;" id="trendChart"></div>
      <div style="margin-top:10px;" id="trendTable"></div>
    </div>`;
  }
  function renderTrendChart() {
    const el = document.getElementById('trendChart');
    if (!el) { console.warn('renderTrendChart: #trendChart 不存在'); return; }
    if (typeof echarts === 'undefined' || !echarts) {
      console.warn('renderTrendChart: echarts 未加载，尝试延迟重试');
      setTimeout(renderTrendChart, 500);
      return;
    }
    try {
      const sel = Object.keys(DISTRICT_DATA).filter(d => document.getElementById('trend_'+d)?.checked);
      if (!sel.length) { Utils.toast('至少选择1个板块','warn'); return; }
      const months = [];
      const today = new Date();
      for (let i=11;i>=0;i--) {
        const d = new Date(today.getFullYear(), today.getMonth()-i, 1);
        months.push(`${d.getFullYear()%100}.${String(d.getMonth()+1).padStart(2,'0')}`);
      }
      const colors = ['#1E3A8A','#3B82F6','#D4A24C','#16A34A','#DC2626','#0EA5E9','#7C3AED','#0891B2','#65A30D','#9333EA','#E9C478'];
      const all = Object.keys(DISTRICT_DATA);
      const series = sel.map(d=>{
        const base = DISTRICT_DATA[d].basePrice;
        const seed = all.indexOf(d);
        const data = months.map((_,i)=>{
          const r = (Math.sin(seed*1.1+i*0.7)+Math.cos(seed*0.3+i*0.4))*0.01;
          const trend = (i/11)*0.04;
          return Math.round(base * (1 + r + trend - 0.02 + i*0.003));
        });
        return { name:d, type:'line', smooth:true, data, showSymbol:false, itemStyle:{color:colors[seed%11]}, endLabel:{show:true,formatter:'{b} {c}', fontSize:10} };
      });

      // 容器可能尚未完成布局，echarts.init 前确保有尺寸
      const w = el.offsetWidth, h = el.offsetHeight;
      if (w === 0 || h === 0) {
        console.warn('renderTrendChart: 容器尺寸为 0，延迟重试', {w, h});
        setTimeout(renderTrendChart, 200);
        return;
      }
      const chart = echarts.init(el);
      chart.setOption({
        tooltip:{trigger:'axis', valueFormatter:v=>v.toLocaleString()+'元/㎡'},
        legend:{top:0, type:'scroll', textStyle:{fontSize:11}},
        grid:{left:50,right:60,top:30,bottom:30},
        xAxis:{type:'category', data:months, axisLabel:{fontSize:10}},
        yAxis:{type:'value', axisLabel:{formatter:v=>(v/1000).toFixed(0)+'k'}},
        series
      });

      // 表格数据
      const tableRows = sel.map(d=>{
        const s = series.find(x=>x.name===d);
        const first = s.data[0], last = s.data[11], max = Math.max(...s.data), min = Math.min(...s.data);
        const pct = ((last-first)/first*100).toFixed(2);
        return `<tr><th>${d}</th>
          <td>${first.toLocaleString()}</td>
          <td>${last.toLocaleString()}</td>
          <td style="color:${Number(pct)>=0?'var(--success)':'var(--danger)'};font-weight:600;">${Number(pct)>=0?'+':''}${pct}%</td>
          <td>${max.toLocaleString()}</td>
          <td>${min.toLocaleString()}</td>
          <td>${DISTRICT_DATA[d].potential}</td>
        </tr>`;
      }).join('');
      document.getElementById('trendTable').innerHTML = `
        <h4 style="font-size:13px;margin:10px 0 6px;">📊 年度涨跌幅统计</h4>
        <div style="overflow-x:auto;"><table class="compare-table">
          <thead><tr><th>板块</th><th>去年同期</th><th>本月均价</th><th>年涨跌幅</th><th>最高</th><th>最低</th><th>潜力评级</th></tr></thead>
          <tbody>${tableRows}</tbody>
        </table></div>
        <p style="font-size:12px;color:var(--text-3);margin-top:6px;">💡 模拟数据仅供演示。真实场景可由TRAE定时任务每月1日抓取各板块公开成交均价，存入本地JSON后使用同一张图展示。</p>
      `;
    } catch(e) {
      console.error('renderTrendChart 渲染失败:', e.message, e.stack);
    }
  }

  return { render, setSuggestedCommunity, calcCommute, querySchool, showFacility, calcDistance, renderTrendChart, applyMapKey };
})();
