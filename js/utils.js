/* ============================================
   通用工具函数
   ============================================ */
window.Utils = (function() {

  // 格式化数字：万/元显示
  function formatWan(n) {
    if (n == null || isNaN(n)) return '-';
    return Number(n).toFixed(n % 1 === 0 ? 0 : 1) + '万';
  }
  function formatYuan(n) {
    if (n == null || isNaN(n)) return '-';
    return Math.round(Number(n)).toLocaleString('zh-CN') + '元';
  }
  function formatArea(n) {
    if (n == null || isNaN(n)) return '-';
    return Number(n).toFixed(1) + '㎡';
  }

  // 户型格式化
  function formatRooms(r) {
    if (!r) return '-';
    return `${r.bedrooms||0}室${r.livingRooms||0}厅${r.bathrooms||0}卫`;
  }

  // 计算房龄
  function calcHouseAge(year) {
    if (!year) return null;
    const age = new Date().getFullYear() - Number(year);
    return age < 0 ? 0 : age;
  }
  function calcHouseAgeText(year) {
    const age = calcHouseAge(year);
    return age == null ? '-' : `${age}年`;
  }

  // 楼层区域判断
  function calcZone(cur, total) {
    if (!cur || !total) return '-';
    const ratio = cur / total;
    if (ratio <= 0.33) return '低区';
    if (ratio <= 0.66) return '中区';
    return '高区';
  }

  // 日期工具 · 全部按本地时区格式化（彻底修复 UTC+8 时区 toISOString 跨日错一天 BUG）
  function dateStr(d) {
    const dt = (d == null) ? new Date()
           : (typeof d === 'string') ? new Date(d)
           : d;
    if (isNaN(dt.getTime())) return '';
    const y = dt.getFullYear();
    const m = String(dt.getMonth()+1).padStart(2,'0');
    const day = String(dt.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }
  function today() { return dateStr(new Date()); }
  function formatDateCN(d) {
    if (!d) return '';
    const dt = typeof d === 'string' ? new Date(d) : d;
    return `${dt.getFullYear()}年${dt.getMonth()+1}月${dt.getDate()}日`;
  }
  function daysBetween(a, b) {
    // 统一转成当地 0 点，避免 DST 造成 1 小时误差导致 daysBetween 错一天
    const d1 = new Date(typeof a==='string'?a:dateStr(a));
    const d2 = new Date(typeof b==='string'?b:dateStr(b));
    d1.setHours(0,0,0,0); d2.setHours(0,0,0,0);
    return Math.round((d2 - d1) / 86400000);
  }
  function addDays(d, n) {
    const dt = (typeof d === 'string') ? new Date(d) : new Date(d);
    dt.setDate(dt.getDate() + n);
    return dateStr(dt);
  }
  function weekdayCN(d) {
    const names = ['周日','周一','周二','周三','周四','周五','周六'];
    const dt = typeof d === 'string' ? new Date(d) : d;
    return names[dt.getDay()];
  }

  // 金额格式化
  function moneyFormat(n, unit='元') {
    if (n == null || isNaN(n)) return '-';
    return Number(n).toLocaleString('zh-CN', {maximumFractionDigits: 2}) + unit;
  }

  // 星级渲染
  function renderStars(n, max=5, interactive=false, name='') {
    let html = `<div class="stars" ${interactive ? `data-input="${name}"` : ''}>`;
    for (let i = 1; i <= max; i++) {
      html += `<span class="star ${i <= n ? 'active' : ''}" ${interactive ? `data-v="${i}"` : ''}>★</span>`;
    }
    html += '</div>';
    return html;
  }

  // 标签颜色映射
  function intentionTag(i) {
    const map = {
      '强烈意向': 'tag-success', '比较有意向': 'tag-primary',
      '一般': 'tag-warn', '不太满意': 'tag-accent', '直接排除': 'tag-danger'
    };
    return map[i] || '';
  }
  function intentionTextShort(i) {
    return i || '-';
  }

  // Toast · Apple 系统风格（深色毛玻璃胶囊 + 类型图标 + spring 入场 / 快速淡出）
  let toastTimer;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function toast(msg, type='info', duration=1800) {
    const el = document.getElementById('toast');
    if (!el) return;
    const t = (type === 'success' || type === 'danger' || type === 'warn') ? type : 'info';
    const ICONS = { info: 'info', success: 'checkCircle', danger: 'xCircle', warn: 'alert' };
    el.className = 'toast toast-' + t;
    el.innerHTML = '<span class="toast-ic">' + icon(ICONS[t], 14) + '</span><span>' + esc(msg) + '</span>';
    el.style.display = 'flex';
    void el.offsetWidth; // 强制重排，保证连续调用也能重放入场动画
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.classList.remove('show');
      el.classList.add('hide');
      setTimeout(() => { el.style.display = 'none'; el.classList.remove('hide'); }, 200);
    }, duration);
  }

  // 模态框
  function openModal({title='', body='', footer='', size='', onOpen=null}) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = body;
    document.getElementById('modalFooter').innerHTML = footer;
    const box = document.getElementById('modalBox');
    box.className = 'modal' + (size ? ' ' + size : '');
    document.getElementById('modalMask').style.display = 'flex';
    if (onOpen) setTimeout(onOpen, 10);
  }
  function closeModal() {
    document.getElementById('modalMask').style.display = 'none';
    document.getElementById('modalBody').innerHTML = '';
    document.getElementById('modalFooter').innerHTML = '';
  }

  // 表单收集（通过data-field收集）
  function collectForm(container) {
    const result = {};
    container.querySelectorAll('[data-field]').forEach(el => {
      const key = el.dataset.field;
      let val;
      if (el.type === 'checkbox') val = el.checked;
      else if (el.type === 'radio') { if (el.checked) val = el.value; else return; }
      else if (el.tagName === 'SELECT') val = el.value;
      else if (el.type === 'number') val = el.value === '' ? null : Number(el.value);
      else val = el.value;
      if (val !== undefined) {
        const keys = key.split('.');
        let cur = result;
        for (let i = 0; i < keys.length - 1; i++) {
          if (!cur[keys[i]]) cur[keys[i]] = {};
          cur = cur[keys[i]];
        }
        cur[keys[keys.length-1]] = val;
      }
    });
    return result;
  }

  // 填充表单
  function fillForm(container, data) {
    container.querySelectorAll('[data-field]').forEach(el => {
      const key = el.dataset.field;
      const keys = key.split('.');
      let v = data;
      for (const k of keys) { if (v == null) break; v = v[k]; }
      if (v == null) return;
      if (el.type === 'checkbox') el.checked = !!v;
      else if (el.type === 'radio') el.checked = (el.value === String(v));
      else el.value = (typeof v === 'object') ? JSON.stringify(v) : v;
    });
  }

  // 多选框（checkbox组）收集
  function collectCheckboxes(container, name) {
    return Array.from(container.querySelectorAll(`input[type="checkbox"][data-checkbox="${name}"]:checked`)).map(c => c.value);
  }
  function fillCheckboxes(container, name, values=[]) {
    container.querySelectorAll(`input[type="checkbox"][data-checkbox="${name}"]`).forEach(c => {
      c.checked = values.includes(c.value);
    });
  }

  // 浏览器通知
  function notify(title, body='') {
    if (!("Notification" in window)) return false;
    if (Notification.permission === "granted") {
      new Notification(title, { body });
      return true;
    }
    if (Notification.permission !== "denied") {
      Notification.requestPermission().then(p => {
        if (p === "granted") new Notification(title, { body });
      });
    }
    return false;
  }

  // 计算房源匹配度（基于期望档案）
  function calcMatchScore(rec, exp) {
    if (!rec) return {score: 0, detail: {}};
    const w = (exp && exp.weights) || {};
    const detail = {};
    const prefAreas = (exp && typeof Store.getPreferredAreas === 'function') ? Store.getPreferredAreas() : [];
    const hasExp = !!(exp && (exp.budgetMin || exp.budgetMax || exp.areaMin || exp.areaMax
      || exp.roomsNeeded || prefAreas.length
      || (exp.mustHaves && exp.mustHaves.length)));

    // 预算匹配 (25%)
    let budgetScore = 0;
    if (rec.totalPrice && exp && exp.budgetMin && exp.budgetMax) {
      if (rec.totalPrice >= exp.budgetMin && rec.totalPrice <= exp.budgetMax) budgetScore = 100;
      else if (rec.totalPrice < exp.budgetMin) budgetScore = 80;
      else {
        const over = (rec.totalPrice - exp.budgetMax) / exp.budgetMax;
        // 降低惩罚系数：超10%得50分，超30%得30分，超50%得10分
        budgetScore = Math.max(10, 60 - over * 100);
      }
    } else if (!hasExp) {
      // 无期望档案时给一个中性分，避免所有记录全被判"建议放弃"
      budgetScore = 60;
    } else budgetScore = 50;
    detail.budget = Math.round(budgetScore);

    // 户型面积匹配 (20%)
    let layoutScore = 0;
    const rRooms = rec.rooms || {}, eRooms = (exp && exp.roomsNeeded) || {};
    const roomMatch = (rRooms.bedrooms||0) >= (eRooms.bedrooms||0) ? 100
      : (rRooms.bedrooms >= ((eRooms.bedrooms||0)-1) ? 60 : 30);
    let areaMatch = !hasExp ? 60 : 50;
    if (rec.area && exp && exp.areaMin && exp.areaMax) {
      if (rec.area >= exp.areaMin && rec.area <= exp.areaMax) areaMatch = 100;
      else if (rec.area < exp.areaMin) areaMatch = Math.max(30, 100 - (exp.areaMin - rec.area) * 2);
      else areaMatch = 80;
    }
    layoutScore = (roomMatch + areaMatch) / 2;
    // 当完全没有期望时，用实际面积/房间数的"绝对值善意评分"
    if (!hasExp) {
      const rooms = (rRooms.bedrooms||0) + (rRooms.livingRooms||0);
      layoutScore = Math.min(100, 50 + rooms * 8 + ((rec.area||0) >= 80 ? 15 : 0));
    }
    detail.layout = Math.round(layoutScore);

    // 通勤匹配 (15%)
    let commuteScore = !hasExp ? 60 : 50;
    if (prefAreas.length && rec.district) {
      // 命中任一意向城市的意向区域得满分；即便不在优先区，也给到50保底
      const inArea = prefAreas.some(a => (a.districts||[]).includes(rec.district));
      commuteScore = inArea ? 100 : 50;
    }
    const dr = rec.dimRatings || {};
    // 兼容 dimRatings 对象{commute:4}与历史数组[预算,户型,通勤,配套,观感,潜力]两种结构
    const dimVal = (k, idx) => {
      const v = Array.isArray(dr) ? dr[idx] : dr[k];
      return (typeof v === 'number' && isFinite(v)) ? v : null;
    };
    const cv = dimVal('commute', 2);
    if (cv != null) commuteScore = (commuteScore + (cv / 5 * 100)) / 2;
    detail.commute = Math.round(commuteScore);

    // 配套/硬性要求 (15%)
    let facilityScore = !hasExp ? 70 : 60;
    if (exp && exp.mustHaves && exp.mustHaves.length) {
      let ok = 0;
      exp.mustHaves.forEach(req => {
        if (req === '必须有电梯' && rec.hasElevator) ok++;
        else if (req === '必须南北通透' && rec.isNorthSouthTransparent) ok++;
        else if (req === '必须近地铁' && rec.facilityNearMetro) ok++;
        else if (req === '不接受顶楼和一楼' && rec.floor && rec.floor.current !== 1
                 && (!rec.floor.total || rec.floor.current !== rec.floor.total)) ok++;
        else if (req === '必须有学区') { ok++; } // 暂无数据，视作满足避免被卡
      });
      // 避免 0/N=0 直接打趴下；按比例 + 保底20
      facilityScore = Math.max(20, (ok / exp.mustHaves.length) * 100);
    }
    const fv = dimVal('facility', 3);
    if (fv != null) facilityScore = (facilityScore + (fv / 5 * 100)) / 2;
    detail.facility = Math.round(facilityScore);

    // 个人观后感 (15%)
    let impressionScore = 55;
    if (rec.overallRating) impressionScore = rec.overallRating / 5 * 100;
    if (rec.dimRatings) {
      const dims = ['lighting','ventilation','noise','layout'];
      const vals = dims.map(d => rec.dimRatings[d]).filter(v => v != null && v > 0);
      if (vals.length) {
        const avg = vals.reduce((a,b)=>a+b,0) / vals.length / 5 * 100;
        impressionScore = (impressionScore + avg) / 2;
      }
    }
    // 如果有记录意向，再拉高/拉低一档
    if (rec.intention) {
      const bonus = { '强烈意向': 10, '比较有意向': 5, '一般': 0, '不太满意': -8, '直接排除': -20 };
      impressionScore = Math.max(0, Math.min(100, impressionScore + (bonus[rec.intention] || 0)));
    }
    detail.impression = Math.round(impressionScore);

    // 区域潜力 (10%)
    let potentialScore = 60;
    if (rec.buildYear) {
      const age = calcHouseAge(rec.buildYear);
      if (age <= 5) potentialScore = 100;
      else if (age <= 10) potentialScore = 85;
      else if (age <= 15) potentialScore = 72;
      else if (age <= 20) potentialScore = 58;
      else if (age <= 30) potentialScore = 45;
      else potentialScore = 35;
    } else {
      potentialScore = !hasExp ? 60 : 55;
    }
    detail.potential = Math.round(potentialScore);

    // 加权总分（weights 可能来自 range 输入保存成字符串，统一转数字防御）
    const weights = {
      budget: Number(w.budget) || 25, layout: Number(w.layout) || 20, commute: Number(w.commute) || 15,
      facility: Number(w.facility) || 15, impression: Number(w.impression) || 15, potential: Number(w.potential) || 10
    };
    const totalW = (weights.budget||0) + (weights.layout||0) + (weights.commute||0)
                 + (weights.facility||0) + (weights.impression||0) + (weights.potential||0) || 1;
    let totalScore = (
      detail.budget * weights.budget +
      detail.layout * weights.layout +
      detail.commute * weights.commute +
      detail.facility * weights.facility +
      detail.impression * weights.impression +
      detail.potential * weights.potential
    ) / totalW;

    // 防御 NaN / 边界
    if (!isFinite(totalScore)) totalScore = 0;
    totalScore = Math.max(0, Math.min(100, Math.round(totalScore)));

    // 如果完全没期望档案，自动基于观后感给予"最低保障分"（避免一堆 40 以下的建议放弃）
    if (!hasExp && totalScore < 45 && impressionScore >= 40) {
      totalScore = Math.max(totalScore, Math.round(45 + (impressionScore - 40) * 0.4));
    }

    return { score: totalScore, detail, hasExpectation: hasExp };
  }

  // 决策建议 · 5 档评判（综合匹配度加权总分 0-100）
  // 接受一个可选的 hasExp 参数，未配置期望档案时文案会额外说明
  function decisionAdvice(score, hasExp) {
    const unconfiguredNote = hasExp === false
      ? '<br/><span style="opacity:.78;font-size:12px;">' + icon('pin',12) + ' 未配置期望档案，以下为基于房源自身观感的初评；配置"购房期望档案"后可获得精确匹配建议。</span>'
      : '';
    if (score >= 82) return { level: '强烈推荐', color: 'tag-success',
      desc: '综合匹配度极高，六大维度均表现优秀。预算、户型、通勤等核心项高度契合期望，建议果断下手或加快推进流程。' + unconfiguredNote };
    if (score >= 68) return { level: '推荐复看', color: 'tag-primary',
      desc: '整体匹配良好，个别维度（如配套或观感）需二次确认。建议安排复看，重点核实短板项后决策。' + unconfiguredNote };
    if (score >= 52) return { level: '建议观望', color: 'tag-warn',
      desc: '有亮点但存在明显短板。可作为备选，与其他房源横向对比后再定。' + unconfiguredNote };
    if (score >= 38) return { level: '谨慎考虑', color: 'tag-accent',
      desc: '多项指标低于预期。需重新评估核心诉求是否可妥协，或调整期望档案后重新匹配。' + unconfiguredNote };
    return { level: '建议放弃', color: 'tag-danger',
      desc: '综合匹配度过低，核心硬性要求未满足。建议优先考虑其他房源，避免时间成本浪费。' + unconfiguredNote };
  }

  // 渲染匹配度圆环 · 5 档色阶与 decisionAdvice 对齐
  function matchRingHTML(score) {
    // 历史脏数据兜底：异常值得分按 0 展示，避免圆环/数字为 NaN
    if (!isFinite(score) || score == null) score = 0;
    score = Math.max(0, Math.min(100, Math.round(score)));
    const r = 28, c = 2 * Math.PI * r;
    const offset = c - (score / 100) * c;
    let color = '#FF3B30';                         // <40 建议放弃：红
    if (score >= 85) color = '#34C759';             // 强烈推荐：成功绿
    else if (score >= 70) color = '#0071E3';        // 推荐复看：Apple 蓝
    else if (score >= 55) color = '#2997FF';        // 建议观望：亮蓝
    else if (score >= 40) color = '#FF9F0A';        // 谨慎考虑：橙金
    return `<div class="match-ring">
      <svg width="64" height="64" viewBox="0 0 64 64"><g transform="rotate(-90 32 32)">
      <circle cx="32" cy="32" r="${r}" stroke="#E8E8ED" stroke-width="6" fill="none"/>
      <circle cx="32" cy="32" r="${r}" stroke="${color}" stroke-width="6" fill="none"
        stroke-dasharray="${c}" stroke-dashoffset="${offset}" stroke-linecap="round"/>
      </g></svg>
      <span style="color:${color};font-size:18px;font-family:var(--font-num)">${score}</span>
    </div>`;
  }

  // 绑定星级评分交互
  function bindStars(container) {
    container.querySelectorAll('.stars[data-input]').forEach(box => {
      const name = box.dataset.input;
      const input = document.querySelector(`input[data-field="${name}"]`);
      box.querySelectorAll('.star').forEach(s => {
        s.addEventListener('click', () => {
          const v = Number(s.dataset.v);
          box.querySelectorAll('.star').forEach((st, i) => st.classList.toggle('active', i < v));
          if (input) input.value = v;
        });
      });
    });
  }

  // 下载文件
  function downloadFile(filename, content, mime='application/json') {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  // 读取文件
  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsText(file);
    });
  }

  // 读取CSS变量实际颜色值（用于echarts canvas内颜色，canvas不支持CSS变量）
  function cssColor(varName, fallback) {
    try {
      const v = getComputedStyle(document.body).getPropertyValue(varName).trim();
      if (v) return v;
    } catch(e){}
    return fallback || '#0071E3';
  }
  // 主题颜色调色板：一次读取缓存，避免频繁DOM读取 · Apple 调色板
  let _THEME = null;
  function theme() {
    if (_THEME) return _THEME;
    _THEME = {
      primary:       cssColor('--primary',        '#0071E3'),
      primaryLight:  cssColor('--primary-light',  '#2997FF'),
      accent:        cssColor('--accent',         '#FF9F0A'),
      accentLight:   cssColor('--accent-light',   '#FFC95C'),
      success:       cssColor('--success',        '#34C759'),
      danger:        cssColor('--danger',         '#FF3B30'),
      warn:          cssColor('--warn',           '#FF9F0A'),
      text1:         cssColor('--text-1',         '#1D1D1F'),
      text2:         cssColor('--text-2',         '#424245'),
      text3:         cssColor('--text-3',         '#6E6E73'),
      text4:         cssColor('--text-4',         '#86868B'),
      border:        cssColor('--border',         '#D2D2D7'),
      borderLight:   cssColor('--border-light',   '#E8E8ED'),
      palette: ['#0071E3','#34C759','#FF9F0A','#FF3B30','#5E5CE6','#64D2FF','#FF2D55','#0A84FF','#BF5AF2','#FFD60A','#AC8E68','#2997FF']
    };
    return _THEME;
  }
  // 调用方式重置（例如主题切换时——目前暂只一套主题）
  function resetTheme() { _THEME = null; }

  // ========== API 配置状态（供各模块判断"需要配置"而非本地模拟） ==========
  function getApiKeys() {
    const g = k => (localStorage.getItem(k) || '').trim();
    return {
      amapJs:  g('k_amap_js'),
      amapSrv: g('k_amap_srv'),
      news:    g('k_news_api'),
      llm:     g('k_llm_api'),
      llmModel:g('k_llm_model'),
      xfAppId:  g('k_xf_appid'),
      xfApiKey: g('k_xf_apikey'),
      xfApiSecret: g('k_xf_apisecret')
    };
  }
  function apiConfigured(name) {
    const k = getApiKeys();
    if (name === 'amap')   return !!k.amapSrv;
    if (name === 'amapJs') return !!k.amapJs;
    if (name === 'news')   return !!k.news;
    if (name === 'llm')    return !!k.llm;
    if (name === 'voice')  return !!(k.xfAppId && k.xfApiKey && k.xfApiSecret);
    return false;
  }
  function apiStatus() {
    const k = getApiKeys();
    return [
      { id:'amap', label:'高德地图', icon:'map', configured: !!k.amapSrv },
      { id:'news', label:'新闻资讯', icon:'news', configured: !!k.news },
      { id:'llm',  label:'AI 大模型', icon:'cpu', configured: !!k.llm },
      { id:'voice', label:'语音识别', icon:'mic', configured: !!(k.xfAppId && k.xfApiKey && k.xfApiSecret) },
    ];
  }
  // 渲染"需要配置 API"的空状态门槛卡片
  function apiGate(name, opts={}) {
    const map = {
      amap:  { icon:'map', title:'需要配置「高德地图 API」',
        desc:'区位分析（通勤测算 / 学区查询 / 周边配套 / 距离测算）依赖高德地图 Web 服务 Key 获取真实数据。' },
    };
    const m = map[name] || map.amap;
    return `<div class="card api-gate">
      <div class="api-gate-icon">${icon(m.icon)}</div>
      <h3>${m.title}</h3>
      <p>${m.desc}${opts.extra || ''}</p>
      <div class="api-gate-actions">
        <button class="btn btn-primary btn-sm" onclick="App.navigate('settings')">${icon('gear',15)} 前往配置</button>
        ${opts.manual || ''}
      </div>
    </div>`;
  }

  // ========== AI 大模型调用层 ==========
  // 解析 LLM 配置：支持 openai: / deepseek: / glm: / trae: 前缀
  function parseLLMConfig() {
    const k = getApiKeys();
    const raw = k.llm;
    if (!raw) return null;
    const idx = raw.indexOf(':');
    let provider = 'openai', key = raw;
    if (idx > 0 && /^[a-z]+$/i.test(raw.slice(0, idx))) {
      provider = raw.slice(0, idx).toLowerCase();
      key = raw.slice(idx + 1);
    }
    const cfg = {
      'trae':     { base: '/api/llm',     model: k.llmModel || 'trae-gpt-4o' },
      'openai':   { base: 'https://api.openai.com/v1', model: k.llmModel || 'gpt-4o-mini' },
      'deepseek': { base: 'https://api.deepseek.com/v1', model: k.llmModel || 'deepseek-v4-flash' },
      'glm':      { base: 'https://open.bigmodel.cn/api/paas/v4', model: k.llmModel || 'glm-4-flash' },
    }[provider] || { base: 'https://api.openai.com/v1', model: k.llmModel || 'gpt-4o-mini' };
    // 模型名统一小写（各平台模型名均区分大小写且为小写，避免 deepseek-V4-flash 这类 400 报错）
    return { provider, key, base: cfg.base, model: String(cfg.model).trim().toLowerCase() };
  }

  // 统一 LLM 调用（OpenAI 兼容格式）
  // 后端 AI 代理调用（普通用户平台模式 / trae: 前缀，Key 由服务端持有）
  async function proxyChat(messages, opts, key, model) {
    try {
      const t = (window.SyncMod && SyncMod.getToken()) || '';
      const res = await fetch('/api/llm/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) },
        body: JSON.stringify({ messages, model, key, ...opts })
      });
      const data = await res.json();
      if (data.ok && data.reply) return { ok: true, reply: data.reply };
      return { ok: false, err: data.err || '后端AI代理返回异常', code: data.code };
    } catch (e) {
      return { ok: false, err: '后端连接失败：' + (e.message || e) };
    }
  }

  // 拉取当前登录账号的 AI 对话额度（右上角 / AI购房页徽章共用）
  // 返回 { freeTotal, used, extra, remain, total, unlimited } 或 null
  async function fetchQuota() {
    try {
      const t = (window.SyncMod && SyncMod.getToken && SyncMod.getToken()) || '';
      const res = await fetch('/api/quota', {
        headers: t ? { Authorization: 'Bearer ' + t } : {}
      });
      const d = await res.json();
      return (d && d.ok && d.quota) ? d.quota : null;
    } catch (e) { return null; }
  }

  async function callLLM(messages, opts = {}) {
    const isNormalUser = window.AuthMod && AuthMod.isLoggedIn() && !AuthMod.isAdmin();
    // 普通用户强制走后端代理（额度计费、Key 不泄露），忽略本地残留 Key
    if (isNormalUser) {
      return proxyChat(messages, opts, '', '');
    }
    const cfg = parseLLMConfig();
    if (!cfg) return { ok: false, err: '未配置 AI 大模型 API Key，请在系统设置 → 联网API配置中配置' };

    // trae 走后端代理（Key 不暴露）
    if (cfg.provider === 'trae') {
      return proxyChat(messages, opts, cfg.key, cfg.model);
    }

    // 其他平台直接从前端调（用户自行承担Key风险）
    try {
      const res = await fetch(cfg.base + '/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + cfg.key
        },
        body: JSON.stringify({
          model: cfg.model,
          messages,
          stream: opts.stream || false,
          temperature: opts.temperature ?? 0.7,
          max_tokens: opts.max_tokens || 2000
        })
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        return { ok: false, err: `API返回 ${res.status}: ${errText.slice(0,200)}` };
      }
      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content || '';
      return { ok: true, reply };
    } catch (e) {
      return { ok: false, err: '网络错误：' + (e.message || e) + '（可能是CORS，建议使用trae前缀走后端代理）' };
    }
  }

  // 收集当前用户数据作为AI上下文
  function collectContextForAI() {
    const parts = [];
    const exp = Store.getExpectation();
    if (exp && exp.budgetMax) {
      parts.push(`【购房期望】预算${exp.budgetMin||0}-${exp.budgetMax||0}万，意向区域：${(exp.districts||[]).join('、')||'未指定'}，户型：${exp.layout||'未指定'}，通勤目标：${exp.commuteDest||'未指定'}（${exp.commuteMax||0}分钟内）`);
    }
    const records = Store.getRecords();
    if (records.length) {
      parts.push(`【已看房源${records.length}套】` + records.slice(0, 8).map(r =>
        `${r.communityName||'未命名'}(${r.district||'?'}) ${r.totalPrice||'?'}万 ${r.layout||''} 评分${r.overallRating||0}/5`
      ).join('；'));
    }
    const wf = Store.getWorkflow();
    const curStep = wf.steps.find(s => s.status === 'doing');
    if (curStep) parts.push(`【当前购房进度】第${curStep.idx}步：${curStep.title}`);
    return parts.join('\n');
  }

  // ========== Apple SF Symbols 风格线性图标库 ==========
  // 统一 24×24 viewBox、stroke 1.8、round 端点；语义命名，供各模块渲染结构图标
  const ICON_PATHS = {
    chart:      '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    trend:      '<path d="m3 17 6-6 4 4 8-8"/><path d="M14 7h7v7"/>',
    target:     '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    house:      '<path d="M3 9.5 12 3l9 6.5V21a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1V9.5Z"/>',
    houses:     '<path d="M3 21h18M5 21V8.5L12 3l7 5.5V21"/><path d="M10 21v-5h4v5"/>',
    wallet:     '<path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>',
    coin:       '<circle cx="12" cy="12" r="9"/><path d="M14 8.5a2.5 2.5 0 0 0-4 2 2.5 2.5 0 0 0 4 2 2.5 2.5 0 0 1 4 2 2.5 2.5 0 0 1-4 2"/>',
    money:      '<path d="M12 2v20M17 5.5H9a3.5 3.5 0 0 0 0 7h6a3.5 3.5 0 0 1 0 7H7"/>',
    bank:       '<path d="M3 9.5 12 3l9 6.5v1.5H3V9.5Z"/><path d="M5 21h14M6 12v6M10 12v6M14 12v6M18 12v6"/>',
    list:       '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
    star:       '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3Z"/>',
    starFill:   '<path d="M12 2.5 14.9 8.4l6.5.9-4.7 4.6 1.1 6.5-5.8-3.1-5.8 3.1 1.1-6.5-4.7-4.6 6.5-.9L12 2.5Z"/>',
    pin:        '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    map:        '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z"/><path d="M9 4v14M15 6v14"/>',
    compass:    '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z"/>',
    rocket:     '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09Z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2Z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
    trophy:     '<path d="M6 9a6 6 0 0 0 12 0V3H6v6Z"/><path d="M6 5H3v2a3 3 0 0 0 3 3M18 5h3v2a3 3 0 0 1-3 3"/><path d="M12 15v4M8 21h8"/>',
    key:        '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.5 12.5 10-10M15 8l3 3M18 5l3 3"/>',
    ruler:      '<path d="m14 3 7 7-11 11-7-7L14 3Z"/><path d="m9.5 7.5 1.5 1.5M12.5 5 14 6.5M6 13l1.5 1.5"/>',
    elevator:   '<path d="M7 21V7a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v14M3 21h18M10 5V3h4v2"/>',
    car:        '<path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11"/><path d="M4 11h16a1 1 0 0 1 1 1v4h-2a2 2 0 1 1-4 0H9a2 2 0 1 1-4 0H3v-4a1 1 0 0 1 1-1Z"/>',
    train:      '<rect x="4" y="3" width="16" height="14" rx="3"/><path d="M4 11h16M8 21l-2 2M16 21l2 2M9 7h6M9 15h.01M15 15h.01"/>',
    school:     '<path d="m22 9-10-5L2 9l10 5 10-5Z"/><path d="M6 11.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5M22 9v5"/>',
    hospital:   '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M12 8v6M9 11h6"/>',
    shop:       '<path d="M3 9 5 3h14l2 6a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0ZM5 9v12h14V9"/>',
    calendar:   '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    camera:     '<path d="M14.5 4h-5L7.5 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3.5L14.5 4Z"/><circle cx="12" cy="13" r="3.5"/>',
    clock:      '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
    bell:       '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    bellOff:    '<path d="M13.7 21a2 2 0 0 1-3.4 0"/><path d="M6 8a6 6 0 0 0-.5 2.7c0 4.3-1.5 6.3-1.5 6.3h12.4"/><path d="M17 8a6 6 0 0 0-9.3-4.9M3 3l18 18"/>',
    bolt:       '<path d="M13 2 3 14h7l-1 8 11-14h-7V2Z"/>',
    plus:       '<path d="M12 5v14M5 12h14"/>',
    edit:       '<path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3Z"/>',
    trash:      '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
    inbox:      '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z"/>',
    search:     '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    check:      '<path d="M20 6 9 17l-5-5"/>',
    checkCircle:'<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 5-5"/>',
    alert:      '<path d="M12 3 1.8 21h20.4L12 3Z"/><path d="M12 9v5M12 17.5h.01"/>',
    alertCircle:'<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5h.01"/>',
    x:          '<path d="M18 6 6 18M6 6l12 12"/>',
    xCircle:    '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6m0-6-6 6"/>',
    question:   '<circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/>',
    info:       '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5h.01"/>',
    smile:      '<circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/>',
    sun:        '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    chat:       '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"/>',
    note:       '<path d="M4 4h16v13l-3 3H4V4Z"/><path d="M8 9h8M8 13h5"/>',
    doc:        '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z"/><path d="M14 2v6h6M9 13h6M9 17h6"/>',
    download:   '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    print:      '<path d="M6 9V3h12v6"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8" rx="1"/>',
    news:       '<path d="M4 5h16v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5Z"/><path d="M8 9h8M8 13h5M8 17h8"/>',
    bookmark:   '<path d="M19 21V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16l7-4 7 4Z"/>',
    refresh:    '<path d="M21 12a9 9 0 1 1-2.6-6.4M21 3v6h-6"/>',
    flag:       '<path d="M4 22V3h15l-2.2 4L19 11H4"/>',
    roadmap:    '<path d="M4 5h16M4 12h16M4 19h16"/><circle cx="9" cy="5" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="9" cy="19" r="2"/>',
    scale:      '<path d="M12 3v18M8 21h8M12 3 5 8l-2 3a3 3 0 0 0 6 0L7 8l5-5ZM12 3l7 5 2 3a3 3 0 0 1-6 0l2-3-5-5Z"/>',
    calc:       '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h.01M12 19h.01M16 19h.01"/>',
    bulb:       '<path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.4 1 2.3h6c0-.9.4-1.8 1-2.3A7 7 0 0 0 12 2Z"/>',
    percent:    '<path d="M19 5 5 19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
    sparkle:    '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z"/>',
    cpu:        '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2"/>',
    chat:       '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10Z"/>',
    send:       '<path d="m22 2-7 20-4-9-9-4 20-7Z"/>',
    users:      '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    shield:     '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>',
    gear:       '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/>',
    palette:    '<path d="M12 3a9 9 0 0 0 0 18c1.5 0 2-1 2-2 0-1.5-1-2-1-3s1-2 2-2h2a4 4 0 0 0 4-4c0-3.9-4-7-9-7Z"/><circle cx="7.5" cy="10.5" r="1"/><circle cx="12" cy="7.5" r="1"/><circle cx="16.5" cy="10.5" r="1"/>',
    db:         '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>',
    heart:      '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z"/>',
    send:       '<path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z"/>',
    save:       '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
    tool:       '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
    globe:      '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18Z"/>',
    arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    arrowLeft:  '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    link:       '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
    arrowDown:  '<path d="M12 5v14M6 13l6 6 6-6"/>',
    arrowUp:    '<path d="M12 19V5M6 11l6-6 6 6"/>',
    chevron:    '<path d="m6 9 6 6 6-6"/>',
    tag:        '<path d="M12.6 2.6 21 11a2 2 0 0 1 0 2.8l-7.2 7.2a2 2 0 0 1-2.8 0L2.6 12.6A2 2 0 0 1 2 11.2V4a2 2 0 0 1 2-2h7.2a2 2 0 0 1 1.4.6Z"/><circle cx="7.5" cy="7.5" r="1"/>',
    menu:       '<path d="M3 6h18M3 12h18M3 18h18"/>',
    grid:       '<rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2"/>',
    award:      '<circle cx="12" cy="8" r="6"/><path d="M15.5 13 17 22l-5-3-5 3 1.5-9"/>',
    building:   '<rect x="4" y="2" width="16" height="20" rx="1"/><path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01"/>',
    phone:      '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
    mic:        '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/>',
    bag:        '<path d="M6 7V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2"/><rect x="3" y="7" width="18" height="14" rx="2"/><path d="M9 11v2a3 3 0 0 0 6 0v-2"/>',
    book:       '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15Z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
    filter:     '<path d="M22 3H2l8 9.5V19l4 2v-8.5L22 3Z"/>',
    eye:        '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    ban:        '<circle cx="12" cy="12" r="9"/><path d="m5.5 5.5 13 13"/>',
    quote:      '<path d="M10 11H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v6c0 2-1.5 3.5-4 4M18 11h-4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v6c0 2-1.5 3.5-4 4"/>',
  };

  // 生成 Apple 风格线性 SVG 图标（SF Symbols 风格）
  function icon(name, size, cls='') {
    const p = ICON_PATHS[name];
    if (!p) return '';
    const s = size || 16;
    return `<svg class="ic ${cls}" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  }

  // 按需加载 echarts（约 334KB gzip）：首屏 DOM 先渲染，图表渲染前动态注入，避免阻塞
  let echartsPromise = null;
  function ensureEcharts() {
    if (window.echarts) return Promise.resolve();
    if (echartsPromise) return echartsPromise;
    echartsPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'js/vendor/echarts.min.js';
      s.onload = () => resolve();
      s.onerror = () => { echartsPromise = null; reject(new Error('echarts 加载失败')); };
      document.head.appendChild(s);
    });
    return echartsPromise;
  }

  return {
    formatWan, formatYuan, formatArea, formatRooms,
    esc,
    calcHouseAge, calcHouseAgeText, calcZone,
    dateStr, today, formatDateCN, daysBetween, addDays, weekdayCN,
    moneyFormat, renderStars, bindStars,
    intentionTag, intentionTextShort,
    toast, openModal, closeModal,
    collectForm, fillForm, collectCheckboxes, fillCheckboxes,
    notify, calcMatchScore, decisionAdvice, matchRingHTML,
    downloadFile, readFileAsText,
    cssColor, theme, resetTheme,
    getApiKeys, apiConfigured, apiStatus, apiGate,
    parseLLMConfig, callLLM, collectContextForAI, fetchQuota,
    ensureEcharts,
    icon,
  };
})();
