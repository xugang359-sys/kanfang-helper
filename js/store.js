/* ============================================
   数据存储层 - localStorage
   管理所有核心数据实体，提供CRUD接口
   ============================================ */
window.Store = (function() {
  const PREFIX = 'house_hunter_';
  const KEYS = {
    expectation: PREFIX + 'expectation',
    records: PREFIX + 'records',
    plans: PREFIX + 'plans',
    settings: PREFIX + 'settings',
    workflow: PREFIX + 'workflow',
    favorites: PREFIX + 'favorites',
    notifications: PREFIX + 'notifications',
  };

  // 本地时区安全的 YYYY-MM-DD 格式化（避免 UTC+8 跨日错一天 BUG）
  function _dateStr(d) {
    const dt = (d == null) ? new Date() : (typeof d === 'string') ? new Date(d) : d;
    if (isNaN(dt.getTime())) return '';
    return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
  }

  // 默认南京区域
  const DISTRICTS = ['鼓楼','玄武','建邺','秦淮','雨花台','栖霞','江宁','浦口','六合','溧水','高淳'];
  const DISTRICTS_SUB = {
    '江宁': ['百家湖','东山','九龙湖','秣陵','禄口','汤山','麒麟'],
    '浦口': ['桥北','高新区','江浦','桥林','汤泉'],
    '栖霞': ['尧化门','仙林','迈皋桥','马群','燕子矶'],
    '雨花台': ['铁心桥','板桥','西善桥','雨花新村'],
    '鼓楼': ['龙江','新街口','鼓楼滨江','江东'],
    '玄武': ['新街口','玄武门','红山','孝陵卫'],
    '建邺': ['河西','奥体','江心洲','南苑'],
    '秦淮': ['新街口','夫子庙','大校场','瑞金路'],
    '六合': ['雄州','龙池','葛塘'],
    '溧水': ['永阳','柘塘'],
    '高淳': ['淳溪','古柏'],
  };

  // 默认购房期望
  const DEFAULT_EXPECTATION = {
    budgetMin: 100, budgetMax: 150,
    downPayment: 45,
    needLoan: true, loanAmount: 105, loanType: '首套',
    monthlyPaymentMax: 6000,
    roomsNeeded: { bedrooms: 3, livingRooms: 2, bathrooms: 1 },
    areaMin: 80, areaMax: 120,
    propertyPreference: '都接受',
    mustHaves: ['必须有电梯'],
    preferredDistricts: ['江宁', '浦口'],
    workplace: '', partnerWorkplace: '',
    maxCommuteTime: 45,
    targetDate: '半年内', moveInDate: '年底前',
    renovationBudget: 10,
    notes: '',
    // 评分权重
    weights: {
      budget: 25, layout: 20, commute: 15, facility: 15, impression: 15, potential: 10
    }
  };

  // 默认看房检查清单
  const DEFAULT_CHECKLIST = {
    '房屋主体': ['墙面裂缝','天花板渗水','地板平整度','门窗密封性'],
    '采光通风': ['各房间采光时长','南北通风测试','暗卫暗厨检查'],
    '噪音测试': ['临街/铁路/高架噪音','楼间隔音','电梯井噪音'],
    '水电燃气': ['水压测试','电路负荷','燃气位置','地暖/空调状态'],
    '公区配套': ['电梯品牌/速度','楼道整洁','消防通道','车位情况'],
    '小区环境': ['绿化率感受','物业态度','人车分流','安防门禁'],
    '周边环境': ['步行到地铁时间','菜市场距离','施工工地','高架桥'],
  };

  // 默认工作流
  const DEFAULT_WORKFLOW = {
    currentStep: 0,
    steps: ['需求确认','线上筛选','实地看房','对比决策','贷款预审','签约交易','过户缴税','物业交接','装修入住'],
    stepNotes: {},
    startDate: null
  };

  function uuid() {
    return 'id_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch(e) { return fallback; }
  }
  function write(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  }

  // ========== 期望档案 ==========
  function getExpectation() {
    const data = read(KEYS.expectation, null);
    return data ? { ...DEFAULT_EXPECTATION, ...data, roomsNeeded: {...DEFAULT_EXPECTATION.roomsNeeded, ...(data.roomsNeeded||{})}, weights: {...DEFAULT_EXPECTATION.weights, ...(data.weights||{})}, mustHaves: data.mustHaves||[], preferredDistricts: data.preferredDistricts||[] } : {...DEFAULT_EXPECTATION};
  }
  function saveExpectation(data) {
    write(KEYS.expectation, {...getExpectation(), ...data});
  }

  // ========== 房源记录 ==========
  function getRecords() {
    return read(KEYS.records, []);
  }
  function getRecord(id) {
    return getRecords().find(r => r.id === id);
  }
  function saveRecord(data) {
    const list = getRecords();
    const now = new Date().toISOString();
    if (data.id) {
      const idx = list.findIndex(r => r.id === data.id);
      if (idx >= 0) { list[idx] = { ...list[idx], ...data, updatedAt: now }; }
    } else {
      data.id = uuid();
      data.createdAt = now;
      data.updatedAt = now;
      list.unshift(data);
    }
    write(KEYS.records, list);
    return data.id;
  }
  function deleteRecord(id) {
    write(KEYS.records, getRecords().filter(r => r.id !== id));
  }

  // ========== 看房计划 ==========
  function getPlans() {
    return read(KEYS.plans, []);
  }
  function savePlan(data) {
    const list = getPlans();
    const now = new Date().toISOString();
    if (data.id) {
      const idx = list.findIndex(p => p.id === data.id);
      if (idx >= 0) list[idx] = { ...list[idx], ...data, updatedAt: now };
    } else {
      data.id = uuid();
      data.createdAt = now;
      data.status = 'pending'; // pending / done / expired
      list.unshift(data);
    }
    write(KEYS.plans, list);
    return data.id;
  }
  function deletePlan(id) {
    write(KEYS.plans, getPlans().filter(p => p.id !== id));
  }
  function updatePlanStatus() {
    const list = getPlans();
    const today = _dateStr(new Date());
    let changed = false;
    list.forEach(p => {
      if (p.status === 'pending' && p.date < today) {
        p.status = 'expired'; changed = true;
      }
    });
    if (changed) write(KEYS.plans, list);
  }

  // ========== 收藏 ==========
  function getFavorites() { return read(KEYS.favorites, []); }
  function toggleFavorite(houseData) {
    const list = getFavorites();
    const idx = list.findIndex(f => f.id === houseData.id);
    if (idx >= 0) list.splice(idx, 1);
    else list.unshift({...houseData, favAt: new Date().toISOString()});
    write(KEYS.favorites, list);
    return idx < 0;
  }

  // ========== 工作流 ==========
  function getWorkflow() {
    const d = read(KEYS.workflow, null);
    if (!d) return {...DEFAULT_WORKFLOW, startDate: _dateStr(new Date())};
    return {...DEFAULT_WORKFLOW, ...d, steps: DEFAULT_WORKFLOW.steps, stepNotes: d.stepNotes || {}};
  }
  function saveWorkflow(data) {
    write(KEYS.workflow, {...getWorkflow(), ...data});
  }

  // ========== 设置 ==========
  function getSettings() {
    return read(KEYS.settings, {
      enableNotification: false,
      remindBeforeDays: 1,
      theme: 'light',
    });
  }
  function saveSettings(data) {
    write(KEYS.settings, {...getSettings(), ...data});
  }

  // ========== 导入导出 ==========
  function exportAll() {
    return {
      version: '1.0',
      exportAt: new Date().toISOString(),
      expectation: getExpectation(),
      records: getRecords(),
      plans: getPlans(),
      workflow: getWorkflow(),
      favorites: getFavorites(),
      settings: getSettings(),
    };
  }
  function importAll(data, overwrite=true) {
    if (overwrite) {
      if (data.expectation) write(KEYS.expectation, data.expectation);
      if (data.records) write(KEYS.records, data.records);
      if (data.plans) write(KEYS.plans, data.plans);
      if (data.workflow) write(KEYS.workflow, data.workflow);
      if (data.favorites) write(KEYS.favorites, data.favorites);
      if (data.settings) write(KEYS.settings, data.settings);
    } else {
      // merge records/plans
      const existingRecords = getRecords();
      const existingIds = new Set(existingRecords.map(r => r.id));
      (data.records || []).forEach(r => { if (!existingIds.has(r.id)) existingRecords.push(r); });
      write(KEYS.records, existingRecords);
    }
  }
  function clearAll() {
    Object.values(KEYS).forEach(k => localStorage.removeItem(k));
  }

  // ========== 示例数据（首次使用） ==========
  function seedDemoIfEmpty() {
    if (getRecords().length === 0 && !localStorage.getItem(KEYS.expectation)) {
      saveExpectation(DEFAULT_EXPECTATION);
      const demoRecords = [
        {
          communityName: '百家湖花园', district: '江宁', address: '江宁区双龙大道',
          propertyType: '二手房', rooms: {bedrooms:3, livingRooms:2, bathrooms:1},
          area: 98, floor: {current:8, total:18, zone:'中区'}, orientation: '南',
          isNorthSouthTransparent: true, hasElevator: true, buildYear: 2010,
          totalPrice: 138, unitPrice: 14082, decoration: '精装',
          developer: '', propertyManagement: '百家湖物业', propertyRights: 70,
          isFiveYearUnique: true,
          viewingDate: '2026-08-15', source: '中介推荐',
          overallRating: 4,
          dimRatings: {lighting:5, ventilation:4, noise:3, layout:4, facility:4, commute:3},
          pros: '户型方正，采光好，靠近地铁', cons: '临街稍吵，楼龄较大',
          intention: '比较有意向', nextAction: '计划复看',
          summary: '地铁口精装三房，采光好但临街吵',
          photos: [], checklist: {}
        },
        {
          communityName: '桥北新村', district: '浦口', address: '浦口区桥北板块',
          propertyType: '二手房', rooms: {bedrooms:3, livingRooms:1, bathrooms:1},
          area: 92, floor: {current:5, total:6, zone:'低区'}, orientation: '东南',
          isNorthSouthTransparent: false, hasElevator: false, buildYear: 2008,
          totalPrice: 105, unitPrice: 11413, decoration: '简装',
          propertyManagement: '新村物业', propertyRights: 70, isFiveYearUnique: false,
          viewingDate: '2026-08-10', source: '线上筛选',
          overallRating: 3,
          dimRatings: {lighting:3, ventilation:2, noise:4, layout:3, facility:3, commute:2},
          pros: '总价低，小区成熟', cons: '无电梯，通勤远',
          intention: '一般', nextAction: '暂时观望',
          summary: '总价低但无电梯且通勤远',
          photos: [], checklist: {}
        }
      ];
      demoRecords.forEach(r => saveRecord(r));

      savePlan({
        date: _dateStr(new Date(Date.now()+86400000*3)),
        district: '江宁', targets: ['江宁一号','九龙湖花园'],
        note: '联系中介小王，看两个小区',
      });
    }
  }

  return {
    KEYS, DISTRICTS, DISTRICTS_SUB, DEFAULT_CHECKLIST,
    uuid,
    getExpectation, saveExpectation,
    getRecords, getRecord, saveRecord, deleteRecord,
    getPlans, savePlan, deletePlan, updatePlanStatus,
    getFavorites, toggleFavorite,
    getWorkflow, saveWorkflow,
    getSettings, saveSettings,
    exportAll, importAll, clearAll,
    seedDemoIfEmpty,
  };
})();
