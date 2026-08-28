/* ============================================
   M1 房源记录中心模块
   ============================================ */
window.RecordsMod = (function() {
  const ic = Utils.icon;   // SF Symbols 风格图标
  let curFilter = { prov:'', city:'', district:'', intention:'', kw:'' };

  // 兜底计算总体评分（针对老数据：overallRating=0/null 但有 dimRatings 时按均值计算）
  function resolveOverall(r) {
    if (!r) return 0;
    if (r.overallRating && r.overallRating > 0) return r.overallRating;
    const dim = r.dimRatings || {};
    const vals = Object.values(dim).filter(v => v && v > 0);
    if (!vals.length) return 0;
    return Math.round(vals.reduce((a,b)=>a+b,0) / vals.length);
  }

  function render() {
    renderList();
  }

  // 解析房源所在城市：优先记录自带 city，否则通过区域名反查全国城市字典（兼容旧数据）
  function resolveCity(r) {
    if (r && r.city && Store.CITIES[r.city]) return r.city;
    if (!r) return '';
    for (const c in Store.CITIES) {
      if ((Store.CITIES[c]||[]).includes(r.district)) return c;
    }
    return '';
  }

  function renderList() {
    let list = Store.getRecords();
    const f = curFilter;
    // 默认展示全部记录，筛选条件按需过滤（省市 → 区域 → 意向 → 关键词）
    if (f.city) list = list.filter(r => resolveCity(r) === f.city);
    if (f.district) list = list.filter(r => r.district === f.district);
    if (f.intention) list = list.filter(r => r.intention === f.intention);
    if (f.kw) list = list.filter(r => (r.communityName||'').includes(f.kw) || (r.address||'').includes(f.kw) || (r.summary||'').includes(f.kw));
    list = list.sort((a,b)=> (b.viewingDate||'').localeCompare(a.viewingDate||''));

    const html = `
      <div class="page-header">
        <div>
          <h2><span class="emoji">${ic('list')}</span>房源记录中心</h2>
          <p class="page-desc">每次看房后结构化记录房源信息和观后感，共 <strong>${list.length}</strong> 条记录。</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-ghost btn-sm" onclick="RecordsMod.quickAdd()">${ic('bolt',15)} 快速记录</button>
          <button class="btn btn-primary btn-sm" onclick="RecordsMod.edit()">${ic('plus',15)} 新增房源记录</button>
        </div>
      </div>

      <div class="filter-bar">
        <input type="text" placeholder="搜索小区/地址/总结..." id="fKw" value="${f.kw}">
        <select id="fProv" onchange="RecordsMod.onFltProv()" style="max-width:110px;">
          <option value="">全部省份</option>
          ${Object.keys(Store.PROVINCES).map(p=>`<option ${f.prov===p?'selected':''}>${p}</option>`).join('')}
        </select>
        <select id="fCity" onchange="RecordsMod.onFltCity()" style="max-width:120px;">
          <option value="">全部城市</option>
          ${f.prov ? (Store.PROVINCES[f.prov]||[]).map(c=>`<option ${f.city===c?'selected':''}>${c}</option>`).join('') : ''}
        </select>
        <select id="fDistrict">
          <option value="">全部区域</option>
          ${f.city ? (Store.CITIES[f.city]||[]).map(d=>`<option ${f.district===d?'selected':''}>${d}</option>`).join('') : ''}
        </select>
        <select id="fIntention">
          <option value="">全部意向</option>
          ${['强烈意向','比较有意向','一般','不太满意','直接排除'].map(i=>`<option ${f.intention===i?'selected':''}>${i}</option>`).join('')}
        </select>
        <button class="btn btn-primary btn-sm" onclick="RecordsMod.doFilter()">筛选</button>
        <button class="btn btn-ghost btn-sm" onclick="RecordsMod.clearFilter()">重置</button>
      </div>

      <div style="margin-top:4px;">
        ${list.length === 0 ? `
          <div class="empty-state">
            <div class="icon">${ic('inbox',54)}</div>
            <h4>${Store.getRecords().length ? '没有符合条件的房源记录' : '还没有房源记录'}</h4>
            <p>${Store.getRecords().length ? '可调整上方筛选条件，或点"重置"查看全部记录。' : '线下看房后，点右上角"新增房源记录"开始建立你的看房档案吧。'}</p>
            <button class="btn btn-primary btn-sm" onclick="RecordsMod.edit()">${ic('plus',15)} 新增记录</button>
          </div>
        ` : list.map(r => renderListItem(r)).join('')}
      </div>
    `;
    App.setContent(html);
  }

  // 省份变化：联动城市下拉并清空已选城市/区域
  function onFltProv() {
    curFilter.prov = document.getElementById('fProv').value;
    curFilter.city = '';
    curFilter.district = '';
    renderList();
  }
  // 城市变化：联动区域下拉并清空已选区域
  function onFltCity() {
    curFilter.city = document.getElementById('fCity').value;
    curFilter.district = '';
    renderList();
  }

  function renderListItem(r) {
    const exp = Store.getExpectation();
    const match = Utils.calcMatchScore(r, exp);
    const age = Utils.calcHouseAgeText(r.buildYear);
    return `
      <div class="list-item" onclick="RecordsMod.view('${r.id}')">
        <div class="list-cover">${Utils.matchRingHTML(match.score)}</div>
        <div class="list-content">
          <div class="list-title">
            ${r.communityName || '未命名房源'}
            <span class="tag tag-primary tag-sm">${resolveCity(r)?resolveCity(r)+'·':''}${r.district || '-'}</span>
            <span class="tag ${Utils.intentionTag(r.intention)} tag-sm">${Utils.intentionTextShort(r.intention)}</span>
            <span class="tag tag-sm">${r.propertyType || '-'}</span>
          </div>
          <div class="list-meta">
            <span>${ic('wallet',14)} ${Utils.formatWan(r.totalPrice)} <small style="color:var(--text-4)">(${r.unitPrice?r.unitPrice.toLocaleString()+'元/㎡':'-'})</small></span>
            <span>${ic('houses',14)} ${Utils.formatRooms(r.rooms)} · ${Utils.formatArea(r.area)}</span>
            <span>${ic('calendar',14)} ${r.viewingDate || '未填写日期'}</span>
            <span>${ic('star',14)} ${resolveOverall(r) || '-'}/5</span>
          </div>
          <div class="list-desc">
            <strong style="color:var(--primary)">匹配度 ${match.score}</strong> ·
            ${r.floor? `${r.floor.current}/${r.floor.total}层(${r.floor.zone||Utils.calcZone(r.floor.current,r.floor.total)})` : ''}
            ${r.hasElevator?' · 有电梯':''} · ${age?age+'房龄':''}
            ${r.orientation?' · '+r.orientation:''}
            ${r.summary ? ` · <em style="color:var(--text-3)">${r.summary}</em>` : ''}
          </div>
        </div>
        <div class="list-actions" onclick="event.stopPropagation()">
          <button class="btn btn-ghost btn-sm" onclick="RecordsMod.edit('${r.id}')">编辑</button>
          <button class="btn btn-danger btn-sm" onclick="RecordsMod.remove('${r.id}')">删除</button>
        </div>
      </div>
    `;
  }

  function doFilter() {
    curFilter.kw = document.getElementById('fKw').value.trim();
    curFilter.district = document.getElementById('fDistrict').value;
    curFilter.intention = document.getElementById('fIntention').value;
    renderList();
  }
  function clearFilter() {
    curFilter = { prov:'', city:'', district:'', intention:'', kw:'' };
    renderList();
  }

  // ============ 新增/编辑 ============
  function edit(id=null, quick=false) {
    const data = id ? Store.getRecord(id) : {};
    const title = id ? '编辑房源记录' : (quick ? '快速记录房源' : '新增房源记录');
    const body = renderEditForm(data, quick);
    Utils.openModal({
      title, body, size: 'lg',
      footer: `<button class="btn btn-ghost" onclick="Utils.closeModal()">取消</button>
        ${quick ? `<button class="btn btn-accent" onclick="RecordsMod.goFullEdit()">展开完整表单</button>` : ''}
        <button class="btn btn-primary" onclick="RecordsMod.doSave(${id?`'${id}'`:'null'})">保存</button>`,
      onOpen: () => afterOpenForm(data, quick),
    });
  }
  function quickAdd() { edit(null, true); }
  function goFullEdit() {
    const data = collectEditForm();
    Utils.closeModal();
    const savedId = Store.saveRecord(data);
    edit(savedId, false);
  }

  function renderEditForm(data, quick) {
    const d = data || {};
    const rooms = d.rooms || { bedrooms: '', livingRooms: '', bathrooms: '' };
    const floor = d.floor || { current: '', total: '' };
    const dim = d.dimRatings || { lighting:'', ventilation:'', noise:'', layout:'', facility:'', commute:'' };
    const basic = `
      <div class="form-section-title">${ic('pin')} 基本信息</div>
      <div class="form-grid">
        <div class="form-item">
          <label><span class="req">*</span>小区名称</label>
          <input type="text" data-field="communityName" placeholder="如：百家湖花园">
        </div>
        <div class="form-item">
          <label><span class="req">*</span>所在城市（省 → 市）</label>
          <div class="cascade-group">${Store.cityCascadeHTML(d.city || Store.getCity(), 'rec', { id: 'rec_city', onCity: 'RecordsMod.syncRecDistricts()', attrs: ' data-field="city"' })}</div>
        </div>
        <div class="form-item">
          <label><span class="req">*</span>所在区域</label>
          <select id="rec_district" data-field="district">
            <option value="">请选择</option>
            ${(Store.CITIES[d.city] || Store.getDistricts()).map(v=>`<option>${v}</option>`).join('')}
          </select>
        </div>
        <div class="form-item full">
          <label>详细地址（楼栋号可选填）</label>
          <input type="text" data-field="address" placeholder="具体楼栋号等">
        </div>
        <div class="form-item">
          <label>房屋类型</label>
          <select data-field="propertyType">
            <option value="">请选择</option>
            <option>新房</option><option>二手房</option>
          </select>
        </div>
        <div class="form-item">
          <label>看房日期</label>
          <input type="date" data-field="viewingDate">
        </div>
        <div class="form-item">
          <label>房源来源</label>
          <select data-field="source">
            <option value="">请选择</option>
            <option>中介推荐</option><option>自行发现</option>
            <option>线上筛选</option><option>朋友介绍</option>
          </select>
        </div>
      </div>
    `;
    const property = `
      <div class="form-section-title">${ic('houses')} 房源属性</div>
      <div class="form-grid-4">
        <div class="form-item"><label>室</label><input type="number" data-field="rooms.bedrooms" min="0"></div>
        <div class="form-item"><label>厅</label><input type="number" data-field="rooms.livingRooms" min="0"></div>
        <div class="form-item"><label>卫</label><input type="number" data-field="rooms.bathrooms" min="0"></div>
        <div class="form-item"><label>建筑面积（㎡）</label><input type="number" data-field="area" min="0"></div>
        <div class="form-item"><label>所在楼层</label><input type="number" data-field="floor.current" min="0"></div>
        <div class="form-item"><label>总楼层</label><input type="number" data-field="floor.total" min="0"></div>
        <div class="form-item">
          <label>朝向</label>
          <select data-field="orientation">
            <option value="">请选择</option>
            ${['南','东南','东','西南','西','西北','北','东北','南北通透'].map(v=>`<option>${v}</option>`).join('')}
          </select>
        </div>
        <div class="form-item">
          <label>南北通透</label>
          <select data-field="isNorthSouthTransparent">
            <option value="">-</option>
            <option value="true">是</option>
            <option value="false">否</option>
          </select>
        </div>
        <div class="form-item">
          <label>有无电梯</label>
          <select data-field="hasElevator">
            <option value="">-</option>
            <option value="true">是</option>
            <option value="false">否</option>
          </select>
        </div>
        <div class="form-item"><label>建成年代</label><input type="number" data-field="buildYear" min="1950" max="2100"></div>
        <div class="form-item">
          <label>装修情况</label>
          <select data-field="decoration">
            <option value="">-</option>
            <option>毛坯</option><option>简装</option><option>精装</option><option>豪装</option>
          </select>
        </div>
        <div class="form-item">
          <label>产权年限</label>
          <select data-field="propertyRights">
            <option value="">-</option>
            <option value="70">70年</option><option value="40">40年</option>
          </select>
        </div>
      </div>
      <div class="form-grid" style="margin-top:12px;">
        <div class="form-item">
          <label>总价（万元）</label>
          <input type="number" data-field="totalPrice" min="0" step="0.5" oninput="RecordsMod.autoPrice()">
        </div>
        <div class="form-item">
          <label>单价（元/㎡）</label>
          <input type="number" data-field="unitPrice" min="0" step="100" id="upInput" oninput="RecordsMod.autoTotal()">
        </div>
        <div class="form-item"><label>开发商（新房）</label><input type="text" data-field="developer"></div>
        <div class="form-item"><label>物业公司（二手房）</label><input type="text" data-field="propertyManagement"></div>
        <div class="form-item">
          <label>满五唯一（二手房）</label>
          <select data-field="isFiveYearUnique">
            <option value="">-</option>
            <option value="true">是</option>
            <option value="false">否</option>
          </select>
        </div>
      </div>
    `;
    const review = `
      <div class="form-section-title">${ic('chat')} 观后感评价</div>
      <div class="form-grid">
        <div class="form-item">
          <label>总体评分</label>
          ${Utils.renderStars(d.overallRating||0, 5, true, 'overallRating')}
          <input type="hidden" data-field="overallRating" value="${d.overallRating||0}">
        </div>
        <div class="form-item">
          <label>意向程度</label>
          <select data-field="intention">
            <option value="">请选择</option>
            <option>强烈意向</option><option>比较有意向</option>
            <option>一般</option><option>不太满意</option><option>直接排除</option>
          </select>
        </div>
        <div class="form-item">
          <label>后续计划</label>
          <select data-field="nextAction">
            <option value="">请选择</option>
            <option>纳入重点考虑</option><option>计划复看</option>
            <option>暂时观望</option><option>不再考虑</option>
          </select>
        </div>
        <div class="form-item full">
          <label>一句话总结（限50字）</label>
          <input type="text" data-field="summary" maxlength="50" placeholder="快速回顾用，如：采光好但临街噪音大">
        </div>
      </div>

      <div class="form-section-title">${ic('star')} 分维度评分</div>
      <div class="form-grid-3">
        ${[['采光','lighting'],['通风','ventilation'],['噪音','noise'],['户型设计','layout'],['周边配套','facility'],['通勤便利','commute']].map(([cn,en])=>`
          <div class="form-item">
            <label>${cn}</label>
            ${Utils.renderStars(dim[en]||0, 5, true, 'dimRatings.'+en)}
            <input type="hidden" data-field="dimRatings.${en}" value="${dim[en]||0}">
          </div>
        `).join('')}
      </div>

      <div class="form-grid" style="margin-top:12px;">
        <div class="form-item full">
          <label>${ic('sparkle',14)} 优势记录（亮点/满意之处）</label>
          <textarea data-field="pros" placeholder="如：户型方正、离地铁近、小区绿化好..."></textarea>
        </div>
        <div class="form-item full">
          <label>${ic('alert',14)} 缺点记录（硬伤/不满之处）</label>
          <textarea data-field="cons" placeholder="如：临街吵、楼龄老、水压不足..."></textarea>
        </div>
      </div>
    `;
    return `<div id="recEditForm">${basic}${quick ? '' : property}${review}</div>`;
  }

  function afterOpenForm(data, quick) {
    const d = data || {};
    const form = document.getElementById('recEditForm');
    Utils.fillForm(form, {
      ...d,
      rooms: d.rooms || {},
      floor: d.floor || {},
      dimRatings: d.dimRatings || {},
      isNorthSouthTransparent: d.isNorthSouthTransparent==null?'':String(d.isNorthSouthTransparent),
      hasElevator: d.hasElevator==null?'':String(d.hasElevator),
      isFiveYearUnique: d.isFiveYearUnique==null?'':String(d.isFiveYearUnique),
    });
    Utils.bindStars(form);
    bindCommunityAutoDistrict(form);
  }

  // 城市变更 → 联动重绘区域下拉
  function syncRecDistricts() {
    const city = document.getElementById('rec_city').value;
    const sel = document.getElementById('rec_district');
    if (!sel) return;
    sel.innerHTML = '<option value="">请选择</option>' + (Store.CITIES[city]||[]).map(v=>`<option>${v}</option>`).join('');
  }

  // 输入小区名后自动识别区域
  function bindCommunityAutoDistrict(form) {
    const nameInput = form.querySelector('[data-field="communityName"]');
    const distSelect = form.querySelector('[data-field="district"]');
    if (!nameInput || !distSelect) return;
    let _timer = null;
    nameInput.addEventListener('input', () => {
      clearTimeout(_timer);
      _timer = setTimeout(() => autoDetectDistrict(nameInput.value.trim(), distSelect), 500);
    });
    nameInput.addEventListener('blur', () => {
      clearTimeout(_timer);
      autoDetectDistrict(nameInput.value.trim(), distSelect);
    });
  }
  async function autoDetectDistrict(name, distSelect) {
    if (!name || name.length < 2) return;
    if (distSelect.value) return; // 已手动选过则不覆盖
    const srvKey = (localStorage.getItem('k_amap_srv')||'').trim();
    if (!srvKey) return; // 无Key无法识别
    const cityEl = document.getElementById('rec_city');
    const city = cityEl ? cityEl.value : Store.getCity();
    try {
      const url = `https://restapi.amap.com/v3/place/text?key=${encodeURIComponent(srvKey)}&keywords=${encodeURIComponent(name)}&city=${encodeURIComponent(city)}&citylimit=true&types=120200|120300&offset=1`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.status === '1' && data.pois && data.pois[0]) {
        const poi = data.pois[0];
        const district = (poi.adname||'').replace('区','').replace('县','');
        if (district) {
          const opts = [...distSelect.options];
          const match = opts.find(o => o.value === district || o.text === district);
          if (match) {
            distSelect.value = match.value;
            Utils.toast(`已自动识别区域：${district}`, 'info', 1500);
          }
        }
      }
    } catch(e) { /* 静默失败 */ }
  }

  function autoPrice() {
    const form = document.getElementById('recEditForm');
    const tp = Number(form.querySelector('[data-field="totalPrice"]').value) || 0;
    const area = Number(form.querySelector('[data-field="area"]').value) || 0;
    if (tp && area) {
      form.querySelector('[data-field="unitPrice"]').value = Math.round(tp * 10000 / area);
    }
  }
  function autoTotal() {
    const form = document.getElementById('recEditForm');
    const up = Number(form.querySelector('[data-field="unitPrice"]').value) || 0;
    const area = Number(form.querySelector('[data-field="area"]').value) || 0;
    if (up && area) {
      form.querySelector('[data-field="totalPrice"]').value = (up * area / 10000).toFixed(1);
    }
  }

  function collectEditForm() {
    const form = document.getElementById('recEditForm');
    const data = Utils.collectForm(form);
    ['isNorthSouthTransparent','hasElevator','isFiveYearUnique'].forEach(k => {
      if (data[k] === '') delete data[k];
      else if (data[k] !== undefined) data[k] = (data[k] === 'true');
    });
    ['totalPrice','unitPrice','area','buildYear','propertyRights','overallRating'].forEach(k => {
      if (data[k] === '' || data[k] == null) delete data[k];
      else data[k] = Number(data[k]);
    });
    if (data.rooms) {
      ['bedrooms','livingRooms','bathrooms'].forEach(k => {
        if (data.rooms[k]) data.rooms[k] = Number(data.rooms[k]);
        else delete data.rooms[k];
      });
      if (!Object.keys(data.rooms).length) delete data.rooms;
    }
    if (data.floor) {
      ['current','total'].forEach(k => {
        if (data.floor[k]) { data.floor[k] = Number(data.floor[k]); }
        else delete data.floor[k];
      });
      if (data.floor.current && data.floor.total && !data.floor.zone) {
        data.floor.zone = Utils.calcZone(data.floor.current, data.floor.total);
      }
      if (!Object.keys(data.floor).length) delete data.floor;
    }
    if (data.dimRatings) {
      Object.keys(data.dimRatings).forEach(k => {
        if (data.dimRatings[k]) data.dimRatings[k] = Number(data.dimRatings[k]);
        else delete data.dimRatings[k];
      });
      if (!Object.keys(data.dimRatings).length) delete data.dimRatings;
    }
    return data;
  }

  function doSave(id) {
    const form = document.getElementById('recEditForm');
    const data = collectEditForm();
    const pidEl = form && form.querySelector('[data-field="_planId"]');
    const planId = pidEl ? pidEl.value : null;
    delete data._planId;   // 内部来源标记，不写入记录
    if (!data.communityName) { Utils.toast('请填写小区名称','danger'); return; }
    if (!data.district) { Utils.toast('请选择所在区域','danger'); return; }
    if (id) data.id = id;
    // ===== 自动汇总总体评分 =====
    // 若用户没显式打总体分，但存在分维度评分，则按 6 维度均值自动补全
    if ((!data.overallRating || data.overallRating === 0) && data.dimRatings) {
      const vals = Object.values(data.dimRatings).filter(v => v && v > 0);
      if (vals.length) {
        const avg = vals.reduce((a,b)=>a+b,0) / vals.length;
        data.overallRating = Math.round(avg);
      }
    }
    const rid = Store.saveRecord(data);
    // 由看房计划"转房源记录"而来：记录保存成功后才回写计划为已转记录，绑定 recordId
    if (planId) {
      const plan = Store.getPlans().find(x => x.id === planId);
      if (plan && !plan.recordId) {
        plan.status = 'done';
        plan.recordId = rid;
        Store.savePlan(plan);
      }
    }
    Utils.closeModal();
    renderList();
    Utils.toast(id ? '已更新房源记录' : (planId ? '已新增房源记录，该计划已标记为完成' : '已新增房源记录'), 'success');
  }

  function remove(id) {
    Utils.openModal({
      title: '删除确认',
      body: '<p>确定删除这条房源记录？删除后无法恢复。</p>',
      footer: `<button class="btn btn-ghost" onclick="Utils.closeModal()">取消</button>
        <button class="btn btn-danger" onclick="RecordsMod.doRemove('${id}')">确认删除</button>`,
      size: 'sm',
    });
  }
  function doRemove(id) {
    Store.deleteRecord(id);
    Utils.closeModal();
    renderList();
    Utils.toast('已删除', 'success');
  }

  function view(id) {
    const r = Store.getRecord(id);
    if (!r) { Utils.toast('记录不存在', 'danger'); return; }
    const exp = Store.getExpectation();
    const match = Utils.calcMatchScore(r, exp);
    const advice = Utils.decisionAdvice(match.score, match.hasExpectation);
    const dim = r.dimRatings || {};

    // 避免模板字符串嵌套，先计算好显示文本
    const floorText = r.floor ? String(r.floor.current||'-')+'/'+String(r.floor.total||'-')+' ('+String(r.floor.zone||'-')+')' : '-';
    const buildText = r.buildYear ? (r.buildYear + ' (' + (Utils.calcHouseAgeText(r.buildYear)||'') + '房龄)') : '-';

    const html = `
      <div class="page-header">
        <div>
          <h2><span class="emoji">${ic('house')}</span>${r.communityName}
            <span class="tag tag-primary tag-sm">${resolveCity(r)?resolveCity(r)+'·':''}${r.district}</span>
            <span class="tag ${Utils.intentionTag(r.intention)} tag-sm">${r.intention||'-'}</span>
          </h2>
          <p class="page-desc">${r.address||'未填写地址'} · 看房日期：${r.viewingDate||'-'}</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-ghost btn-sm" onclick="App.navigate('records')">← 返回列表</button>
          <button class="btn btn-primary btn-sm" onclick="RecordsMod.edit('${r.id}')">${ic('edit',15)} 编辑</button>
        </div>
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="card-title">${ic('chart')} 综合评估</div>
          <div style="display:flex;align-items:center;gap:20px;">
            ${Utils.matchRingHTML(match.score)}
            <div style="flex:1;">
              <h4 style="font-size:15px;margin-bottom:6px;">
                <span class="tag ${advice.color}">${advice.level}</span>
              </h4>
              <p style="font-size:12.5px;color:var(--text-2);margin-bottom:10px;">${advice.desc}</p>
              <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;">
                ${Object.entries(match.detail).map(function(kv){
                  var k=kv[0],v=kv[1];
                  var names = {budget:'预算',layout:'户型',commute:'通勤',facility:'配套',impression:'观感',potential:'潜力'};
                  var color='var(--danger)'; if(v>=70)color='var(--success)'; else if(v>=50)color='var(--primary)'; else if(v>=30)color='var(--warn)';
                  return '<div style="font-size:11.5px;"><div style="color:var(--text-3)">'+names[k]+'</div><strong style="color:'+color+'">'+v+'</strong></div>';
                }).join('')}
              </div>
            </div>
          </div>
          <div style="height:240px;margin-top:10px;" id="radarView"></div>
          <details style="margin-top:8px;font-size:11.5px;color:var(--text-3);">
            <summary style="cursor:pointer;color:var(--primary);">${ic('book',14)} 评分标准与决策档位说明</summary>
            <div style="margin-top:8px;padding:10px;background:var(--primary-soft);border-radius:6px;line-height:1.7;">
              <strong>加权维度（总分 0-100）：</strong>预算 25% · 户型 20% · 通勤 15% · 配套 15% · 观感 15% · 潜力 10%<br>
              <strong>决策档位：</strong>
              <span style="color:#34C759;">≥85 强烈推荐</span> ·
              <span style="color:#0071E3;">70-84 推荐复看</span> ·
              <span style="color:#2997FF;">55-69 建议观望</span> ·
              <span style="color:#FF9F0A;">40-54 谨慎考虑</span> ·
              <span style="color:#FF3B30;">&lt;40 建议放弃</span>
            </div>
          </details>
        </div>

        <div class="card">
          <div class="card-title">${ic('tag')} 基本信息</div>
          <div class="grid-2" style="gap:10px;font-size:13px;">
            ${KV("小区", r.communityName)}${KV("城市", resolveCity(r)||'-')}${KV("区域", r.district)}${KV("类型", r.propertyType)}${KV("户型", Utils.formatRooms(r.rooms))}
            ${KV("面积", Utils.formatArea(r.area))}${KV("楼层", floorText)}
            ${KV("朝向", (r.orientation||'-')+(r.isNorthSouthTransparent?' · 南北通透':''))}
            ${KV("电梯", r.hasElevator==null?'-':(r.hasElevator?'有':'无'))}
            ${KV("建成", buildText)}
            ${KV("装修", r.decoration||'-')}
            ${KV("产权", r.propertyRights?r.propertyRights+'年':'-')}
            ${KV("满五唯一", r.isFiveYearUnique==null?'-':(r.isFiveYearUnique?'是':'否'))}
            ${KV("总价", Utils.formatWan(r.totalPrice))}
            ${KV("单价", r.unitPrice?r.unitPrice.toLocaleString()+'元/㎡':'-')}
            ${KV("开发商", r.developer||'-')}${KV("物业", r.propertyManagement||'-')}
            ${KV("来源", r.source||'-')}${KV("看房日期", r.viewingDate||'-')}
          </div>
        </div>

        <div class="card">
          <div class="card-title">${ic('chat')} 观后感评价</div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px;">
            <div><div style="font-size:12px;color:var(--text-3)">总体评分 <strong style="color:var(--primary)">${resolveOverall(r)||'0'}</strong>/5</div><div style="margin-top:4px;">${Utils.renderStars(resolveOverall(r))}</div></div>
            ${[['采光','lighting'],['通风','ventilation'],['噪音','noise'],['户型','layout'],['配套','facility'],['通勤','commute']].map(([cn,k])=>`
              <div><div style="font-size:12px;color:var(--text-3)">${cn}</div><div style="margin-top:4px;">${Utils.renderStars(dim[k]||0)}</div></div>
            `).join('')}
          </div>
          <div style="margin-bottom:10px;"><span class="tag" style="font-size:11.5px;">意向程度</span> <span class="tag ${Utils.intentionTag(r.intention)}" style="font-size:12px;margin-left:6px;">${r.intention||'-'}</span>
          <span class="tag" style="font-size:11.5px;margin-left:10px;">后续计划</span> <strong style="font-size:13px;margin-left:4px;">${r.nextAction||'-'}</strong></div>
          <div style="background:var(--primary-soft);padding:10px 12px;border-radius:6px;font-size:13px;margin:10px 0;">
            <strong>一句话总结：</strong>${r.summary||'（未填写）'}
          </div>
          ${r.pros?`<div style="margin:8px 0;"><div style="color:var(--success);font-weight:600;font-size:12.5px;">${ic('sparkle',14)} 优势</div><p style="font-size:13px;color:var(--text-2);margin-top:4px;">${r.pros}</p></div>`:''}
          ${r.cons?`<div style="margin:8px 0;"><div style="color:var(--warn);font-weight:600;font-size:12.5px;">${ic('alert',14)} 缺点</div><p style="font-size:13px;color:var(--text-2);margin-top:4px;">${r.cons}</p></div>`:''}
        </div>

        <div class="card">
          <div class="card-title">${ic('check')} 实地检查清单 ${r.checklist && Object.keys(r.checklist).length?'<span class="tag tag-success tag-sm">已填写</span>':''}</div>
          ${renderChecklistResult(r.checklist)}
          <div style="margin-top:10px;text-align:right;">
            <button class="btn btn-ghost btn-sm" onclick="RecordsMod.openChecklistFor('${r.id}')">去填写检查清单</button>
          </div>
        </div>
      </div>
    `;
    App.setContent(html);
    // 渲染雷达图（echarts 按需加载）
    Utils.ensureEcharts().then(() => {
      const C = Utils.theme();
      const chart = echarts.init(document.getElementById('radarView'));
      const dims = ['预算','户型','通勤','配套','观感','潜力'];
      const vals = dims.map((_,i)=>Object.values(match.detail)[i]||0);
      chart.setOption({
        tooltip:{},
        radar:{indicator:dims.map(n=>({name:n,max:100})),center:['50%','55%'],radius:100,
          axisName:{color:C.text2,fontSize:11}},
        series:[{type:'radar',data:[{name:'匹配度',value:vals,
          areaStyle:{opacity:0.3,color:C.primary},lineStyle:{color:C.primary,width:2},itemStyle:{color:C.accent}}]}]
      });
    }).catch(() => {});
  }

  function renderChecklistResult(cl) {
    if (!cl || !Object.keys(cl).length) {
      return `<div style="padding:20px;text-align:center;color:var(--text-3);font-size:13px;">暂未填写实地检查清单，看房时记得逐项检查哦。</div>`;
    }
    let ok=0, warn=0, bad=0, total=0;
    const rows = Object.entries(Store.DEFAULT_CHECKLIST).map(([cat, items])=>{
      const catResult = (cl[cat]||{});
      return `<div style="margin-bottom:10px;">
        <div style="font-weight:600;font-size:12.5px;color:var(--primary);margin-bottom:4px;">${cat}</div>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:4px;">
          ${items.map(it=>{
            const v = catResult[it]; total++;
            if (v==='ok') ok++; else if (v==='warn') warn++; else if (v==='bad') bad++;
            const stIcon = v==='ok'?ic('check',12):(v==='warn'?ic('alert',12):(v==='bad'?ic('x',12):'—'));
            return `<div style="font-size:12px;color:var(--text-2);">${stIcon} ${it}</div>`;
          }).join('')}
        </div>
      </div>`;
    }).join('');
    return `<div style="display:flex;gap:10px;margin-bottom:12px;font-size:12px;">
      <span class="tag tag-success">正常 ${ok}</span>
      <span class="tag tag-warn">有问题 ${warn}</span>
      <span class="tag tag-danger">不合格 ${bad}</span>
      <span class="tag">未查 ${total-ok-warn-bad}</span>
    </div>${rows}`;
  }

  function KV(k,v) {
    return `<div style="display:flex;gap:6px;"><span style="color:var(--text-3);flex-shrink:0;">${k}：</span><span style="flex:1;color:var(--text-1);">${v||'-'}</span></div>`;
  }

  // ============= 实地检查清单 · 记录内弹窗（原 M10 独立模块已移除，此功能保留在房源记录内） =============
  function openChecklistFor(recordId) {
    const r = Store.getRecord(recordId);
    const data = (r && r.checklist) ? r.checklist : {};
    const body = `
      <div style="margin-bottom:14px;">
        <div style="font-size:13px;margin-bottom:6px;">关联房源：<strong>${r?r.communityName:'-'}</strong> · ${r?r.district:''}</div>
      </div>
      <div id="modalChecklistBox">${renderChecklistItemsModal(data)}</div>
    `;
    Utils.openModal({title:'实地检查清单', body, size:'lg',
      footer:`<button class="btn btn-ghost" onclick="Utils.closeModal()">取消</button><button class="btn btn-primary" onclick="RecordsMod.saveModalCl('${recordId}')">保存</button>`});
    setTimeout(()=>document.querySelectorAll('#modalChecklistBox .ci-btn').forEach(b=>b.addEventListener('click',()=>{
      const box=b.parentElement;
      box.querySelectorAll('.ci-btn').forEach(x=>x.classList.remove('active'));
      if (b.dataset.val) b.classList.add('active');
    })), 20);
  }
  function renderChecklistItemsModal(data) {
    const cats = Store.DEFAULT_CHECKLIST;
    return Object.entries(cats).map(([cat, items])=>`
      <div style="margin-bottom:14px;">
        <div style="font-weight:600;color:var(--primary);padding:8px 10px;background:var(--primary-soft);border-radius:6px;margin-bottom:8px;">${ic('pin',14)} ${cat}</div>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;">
          ${items.map(it=>{
            const v = (data[cat]||{})[it];
            return `<div style="border:1px solid var(--border-light);padding:8px 10px;border-radius:6px;">
              <div style="font-size:12.5px;margin-bottom:5px;">${it}</div>
              <div class="ci-actions" data-ci="${cat}" data-item="${it}">
                <button class="ci-btn ok ${v==='ok'?'active':''}" data-val="ok">${ic('check',12)}</button>
                <button class="ci-btn warn ${v==='warn'?'active':''}" data-val="warn">${ic('alert',12)}</button>
                <button class="ci-btn bad ${v==='bad'?'active':''}" data-val="bad">${ic('x',12)}</button>
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
    if (r) view(recordId);
  }

  return { render, renderList, doFilter, clearFilter, onFltProv, onFltCity, edit, quickAdd, goFullEdit, doSave, remove, doRemove, view, autoPrice, autoTotal, renderChecklistResult, KV, syncRecDistricts, openChecklistFor, saveModalCl };
})();
