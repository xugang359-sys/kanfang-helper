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

  // Toast
  let toastTimer;
  function toast(msg, type='info', duration=1800) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.style.display = 'block';
    const colors = { info:'rgba(12,10,9,0.95)', success:'#16A34A', danger:'#DC2626', warn:'#D97706' };
    el.style.background = colors[type] || colors.info;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.style.display = 'none'; }, duration);
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
      new Notification(title, { body, icon: '🏡' });
      return true;
    }
    if (Notification.permission !== "denied") {
      Notification.requestPermission().then(p => {
        if (p === "granted") new Notification(title, { body, icon: '🏡' });
      });
    }
    return false;
  }

  // 计算房源匹配度（基于期望档案）
  function calcMatchScore(rec, exp) {
    if (!rec) return {score: 0, detail: {}};
    const w = (exp && exp.weights) || {};
    const detail = {};
    const hasExp = !!exp && (exp.budgetMin || exp.budgetMax || exp.areaMin || exp.areaMax
      || exp.roomsNeeded || (exp.preferredDistricts && exp.preferredDistricts.length)
      || (exp.mustHaves && exp.mustHaves.length));

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
    if (exp && exp.preferredDistricts && exp.preferredDistricts.length && rec.district) {
      // 即便不在优先区，也给到50保底，避免 40 直接拖垮
      commuteScore = exp.preferredDistricts.includes(rec.district) ? 100 : 50;
    }
    if (rec.dimRatings && rec.dimRatings.commute) {
      commuteScore = (commuteScore + (rec.dimRatings.commute / 5 * 100)) / 2;
    }
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
    if (rec.dimRatings && rec.dimRatings.facility) {
      facilityScore = (facilityScore + (rec.dimRatings.facility / 5 * 100)) / 2;
    }
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

    // 加权总分
    const weights = {
      budget: w.budget || 25, layout: w.layout || 20, commute: w.commute || 15,
      facility: w.facility || 15, impression: w.impression || 15, potential: w.potential || 10
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
      ? '<br/><span style="opacity:.78;font-size:12px;">📌 未配置期望档案，以下为基于房源自身观感的初评；配置"购房期望档案"后可获得精确匹配建议。</span>'
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
    const r = 28, c = 2 * Math.PI * r;
    const offset = c - (score / 100) * c;
    let color = '#DC2626';                         // <40 建议放弃：红
    if (score >= 85) color = '#16A34A';             // 强烈推荐：成功绿
    else if (score >= 70) color = '#1E3A8A';        // 推荐复看：深靛蓝
    else if (score >= 55) color = '#3B82F6';        // 建议观望：钴蓝
    else if (score >= 40) color = '#D4A24C';         // 谨慎考虑：钛金
    return `<div class="match-ring">
      <svg width="64" height="64"><circle cx="32" cy="32" r="${r}" stroke="#E2E8F0" stroke-width="6" fill="none"/>
      <circle cx="32" cy="32" r="${r}" stroke="${color}" stroke-width="6" fill="none"
        stroke-dasharray="${c}" stroke-dashoffset="${offset}" stroke-linecap="round"/></svg>
      <span>${score}</span>
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
    return fallback || '#1E3A8A';
  }
  // 主题颜色调色板：一次读取缓存，避免频繁DOM读取 · 深蓝奢华调色板
  let _THEME = null;
  function theme() {
    if (_THEME) return _THEME;
    _THEME = {
      primary:       cssColor('--primary',        '#1E3A8A'),
      primaryLight:  cssColor('--primary-light',  '#3B82F6'),
      accent:        cssColor('--accent',         '#D4A24C'),
      accentLight:   cssColor('--accent-light',   '#E9C478'),
      success:       cssColor('--success',        '#16A34A'),
      danger:        cssColor('--danger',         '#DC2626'),
      warn:          cssColor('--warn',           '#D97706'),
      text1:         cssColor('--text-1',         '#0F172A'),
      text2:         cssColor('--text-2',         '#334155'),
      text3:         cssColor('--text-3',         '#64748B'),
      text4:         cssColor('--text-4',         '#94A3B8'),
      border:        cssColor('--border',         '#E2E8F0'),
      borderLight:   cssColor('--border-light',   '#F1F5F9'),
      palette: ['#1E3A8A','#3B82F6','#D4A24C','#16A34A','#DC2626','#0EA5E9','#7C3AED','#0891B2','#65A30D','#9333EA','#E9C478','#2563EB']
    };
    return _THEME;
  }
  // 调用方式重置（例如主题切换时——目前暂只一套主题）
  function resetTheme() { _THEME = null; }

  return {
    formatWan, formatYuan, formatArea, formatRooms,
    calcHouseAge, calcHouseAgeText, calcZone,
    dateStr, today, formatDateCN, daysBetween, addDays, weekdayCN,
    moneyFormat, renderStars, bindStars,
    intentionTag, intentionTextShort,
    toast, openModal, closeModal,
    collectForm, fillForm, collectCheckboxes, fillCheckboxes,
    notify, calcMatchScore, decisionAdvice, matchRingHTML,
    downloadFile, readFileAsText,
    cssColor, theme, resetTheme,
  };
})();
