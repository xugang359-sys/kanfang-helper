/* ============================================
   M3 看房日程表模块（集成原待看计划+消息提醒）
   ============================================ */
window.CalendarMod = (function() {
  const ic = Utils.icon;   // SF Symbols 风格图标
  const PREP_LIST = ['带手机充电宝','穿舒适鞋子','带卷尺','带记事本/纸笔','提前查好路线','确认中介联系方式','带上身份证','准备好问题清单'];
  let curDate = new Date();
  let curView = 'month'; // month / week / year / timeline

  // ============= 主渲染入口 =============
  function render() {
    curDate = new Date();
    renderCalendar();
  }

  function renderCalendar() {
    Store.updatePlanStatus();
    const year = curDate.getFullYear(), month = curDate.getMonth();
    const records = Store.getRecords();
    const plans = Store.getPlans();

    // 统计卡片数据
    const stats = _calcStats(records, plans, year, month);

    const html = `
      <div class="page-header">
        <div>
          <h2><span class="emoji">${ic('calendar')}</span>看房日程表</h2>
          <p class="page-desc">日历展示已看/计划看房安排，点击日期查看与编辑。</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-ghost btn-sm" id="notifyToggleBtn" onclick="CalendarMod.toggleNotify()">${Store.getSettings().enableNotification?ic('bellOff',15)+' 关闭提醒':ic('bell',15)+' 开启提醒'}</button>
          <button class="btn btn-primary btn-sm" onclick="CalendarMod.edit()">${ic('plus',15)} 新建看房计划</button>
        </div>
      </div>

      <div class="grid-4" style="margin-bottom:18px;">
        <div class="stat-card blue">
          <div class="stat-icon">${ic('house')}</div>
          <div class="stat-label">${curView==='year'?'本年':'本月'}已看房</div>
          <div class="stat-value">${stats.recordsCount}</div>
          <div class="stat-sub">套房源</div>
        </div>
        <div class="stat-card orange">
          <div class="stat-icon">${ic('list')}</div>
          <div class="stat-label">${curView==='year'?'本年':'本月'}计划看</div>
          <div class="stat-value">${stats.plansCount}</div>
          <div class="stat-sub">套待看</div>
        </div>
        <div class="stat-card green">
          <div class="stat-icon">${ic('check')}</div>
          <div class="stat-label">累计已看</div>
          <div class="stat-value">${records.length + plans.filter(p=>p.status==='done' && !p.recordId).length}</div>
          <div class="stat-sub">套房源</div>
        </div>
        <div class="stat-card red">
          <div class="stat-icon">${ic('alert')}</div>
          <div class="stat-label">已过期计划</div>
          <div class="stat-value">${stats.expiredCount}</div>
          <div class="stat-sub">未及时完成</div>
        </div>
      </div>

      <div class="sub-tabs" id="viewTabs" style="margin-bottom:12px;">
        <div class="sub-tab ${curView==='month'?'active':''}" data-v="month">${ic('calendar',15)} 月视图</div>
        <div class="sub-tab ${curView==='week'?'active':''}" data-v="week">${ic('list',15)} 周视图</div>
        <div class="sub-tab ${curView==='year'?'active':''}" data-v="year">${ic('grid',15)} 年视图</div>
        <div class="sub-tab ${curView==='timeline'?'active':''}" data-v="timeline">${ic('refresh',15)} 时间线</div>
      </div>

      <div id="calContent" class="card">
        ${curView === 'month' ? renderMonthView(year, month, records, plans)
          : curView === 'week' ? renderWeekView(records, plans)
          : curView === 'year' ? renderYearView(year, records, plans)
          : renderTimeline(records, plans)}
      </div>
    `;
    App.setContent(html);
    // 绑定视图切换
    document.querySelectorAll('#viewTabs .sub-tab').forEach(t => {
      t.addEventListener('click', () => { curView = t.dataset.v; renderCalendar(); });
    });
  }

  // ============= 统计 =============
  function _calcStats(records, plans, year, month) {
    if (curView === 'year') {
      const yStart = `${year}-01-01`, yEnd = `${year}-12-31`;
      const recordsY = records.filter(r => r.viewingDate && r.viewingDate >= yStart && r.viewingDate <= yEnd);
      const doneY = plans.filter(p => p.status === 'done' && !p.recordId && p.date && p.date >= yStart && p.date <= yEnd);
      const plansY = plans.filter(p => p.date && p.date >= yStart && p.date <= yEnd && p.status === 'pending');
      const expiredY = plans.filter(p => p.status === 'expired' && p.date && p.date >= yStart && p.date <= yEnd);
      return { recordsCount: recordsY.length + doneY.length, plansCount: plansY.length, expiredCount: expiredY.length };
    }
    const mStart = `${year}-${String(month+1).padStart(2,'0')}-01`;
    const mEnd = `${year}-${String(month+1).padStart(2,'0')}-31`;
    const recordsM = records.filter(r => r.viewingDate && r.viewingDate >= mStart && r.viewingDate <= mEnd);
    const doneM = plans.filter(p => p.status === 'done' && !p.recordId && p.date && p.date >= mStart && p.date <= mEnd);
    const plansM = plans.filter(p => p.date && p.date >= mStart && p.date <= mEnd && p.status === 'pending');
    const expiredM = plans.filter(p => p.status === 'expired' && p.date && p.date >= mStart && p.date <= mEnd);
    return { recordsCount: recordsM.length + doneM.length, plansCount: plansM.length, expiredCount: expiredM.length };
  }

  // ============= 月视图 =============
  function renderMonthView(year, month, records, plans) {
    const first = new Date(year, month, 1);
    const startWeekday = first.getDay();
    const daysInMonth = new Date(year, month+1, 0).getDate();
    const today = Utils.today();
    const toolbar = `
      <div class="calendar-toolbar">
        <h3>
          <button class="btn btn-ghost btn-sm" onclick="CalendarMod.prevMonth()">‹</button>
          ${year}年 ${month+1}月
          <button class="btn btn-ghost btn-sm" onclick="CalendarMod.nextMonth()">›</button>
          <button class="btn btn-accent btn-sm" style="margin-left:10px;" onclick="CalendarMod.goToday()">今天</button>
        </h3>
        <div class="tools">
          <span class="tag tag-success"><span style="background:var(--success);width:6px;height:6px;border-radius:50%;display:inline-block;margin-right:4px;"></span>已看房</span>
          <span class="tag tag-accent"><span style="background:var(--accent);width:6px;height:6px;border-radius:50%;display:inline-block;margin-right:4px;"></span>计划看</span>
        </div>
      </div>
    `;
    const heads = ['日','一','二','三','四','五','六'].map((d,i)=>`<div class="cal-head" style="${i===0||i===6?'color:#E0564F;':''}">${d}</div>`).join('');
    let cells = '';
    // 前补齐
    for (let i = 0; i < startWeekday; i++) {
      const d = new Date(year, month, i - startWeekday + 1);
      cells += `<div class="cal-cell other-month" onclick="CalendarMod.goDate('${Utils.dateStr(d)}')">
        <div class="date-num">${d.getDate()}</div></div>`;
    }
    // 当月
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const recordsDay = records.filter(r => r.viewingDate === dateStr);
      const donePlansDay = plans.filter(p => p.date === dateStr && p.status === 'done' && !p.recordId);
      const plansDay = plans.filter(p => p.date === dateStr && p.status === 'pending');
      const expiredDay = plans.filter(p => p.date === dateStr && p.status === 'expired');
      const isToday = dateStr === today;
      const viewedCount = recordsDay.length + donePlansDay.length;   // 记录 + 已完成计划 = 已看
      cells += `<div class="cal-cell ${isToday?'today':''}" onclick="CalendarMod.dayDetail('${dateStr}')">
        <div class="date-num">${d}</div>
        <div class="cal-markers">
          ${Array(Math.min(viewedCount,3)).fill('<span class="cal-dot done"></span>').join('')}
          ${plansDay.slice(0,3).map(()=>`<span class="cal-dot plan"></span>`).join('')}
          ${expiredDay.slice(0,2).map(()=>`<span class="cal-dot" style="background:var(--danger);"></span>`).join('')}
        </div>
        <div>
          ${viewedCount?`<span class="cal-badge done">看${viewedCount}</span>`:''}
          ${plansDay.length?`<span class="cal-badge plan">待${plansDay.length}</span>`:''}
        </div>
      </div>`;
    }
    // 后补齐
    const totalCells = startWeekday + daysInMonth;
    const rem = (7 - totalCells % 7) % 7;
    for (let i = 1; i <= rem; i++) {
      const d = new Date(year, month+1, i);
      cells += `<div class="cal-cell other-month" onclick="CalendarMod.goDate('${Utils.dateStr(d)}')">
        <div class="date-num">${i}</div></div>`;
    }
    return toolbar + `<div class="calendar-grid">${heads}${cells}</div>`;
  }

  // ============= 周视图 =============
  function renderWeekView(records, plans) {
    const now = new Date(curDate);
    const dayOfWeek = now.getDay();
    const monday = new Date(now); monday.setDate(now.getDate() - (dayOfWeek===0?6:dayOfWeek-1));
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday); d.setDate(monday.getDate()+i);
      dates.push(Utils.dateStr(d));
    }
    const toolbar = `
      <div class="calendar-toolbar">
        <h3>
          <button class="btn btn-ghost btn-sm" onclick="CalendarMod.prevWeek()">‹ 上周</button>
          ${dates[0].slice(5).replace('-','/')} - ${dates[6].slice(5).replace('-','/')}
          <button class="btn btn-ghost btn-sm" onclick="CalendarMod.nextWeek()">下周 ›</button>
          <button class="btn btn-accent btn-sm" style="margin-left:10px;" onclick="CalendarMod.goToday()">今天</button>
        </h3>
      </div>
    `;
    const list = dates.map(ds => _renderWeekDay(ds, records, plans)).join('');
    return toolbar + list;
  }

  function _renderWeekDay(ds, records, plans) {
    const recs = records.filter(r => r.viewingDate === ds);
    const donePlans = plans.filter(p => p.date === ds && p.status === 'done' && !p.recordId);
    const pls = plans.filter(p => p.date === ds && p.status === 'pending');
    const isToday = ds === Utils.today();
    const dt = new Date(ds);
    const weekName = Utils.weekdayCN(ds);
    return `<div style="border:1px solid var(--border-light);border-radius:8px;overflow:hidden;margin-bottom:12px;">
      <div style="padding:10px 14px;background:${isToday?'var(--primary-soft)':'var(--bg-soft)'};color:${isToday?'var(--primary)':'var(--text-2)'};display:flex;justify-content:space-between;align-items:center;">
        <strong>${dt.getMonth()+1}月${dt.getDate()}日 ${weekName}${isToday?' <span style="font-weight:600;">· 今天</span>':''}</strong>
        <button class="btn btn-sm ${isToday?'btn-ghost':'btn-primary'}" onclick="CalendarMod.dayDetail('${ds}')" style="color:${isToday?'':'#fff'}">查看详情 →</button>
      </div>
      <div style="padding:12px 14px;">
        ${pls.length ? `<div style="margin-bottom:10px;"><div style="font-size:12px;color:var(--accent);font-weight:600;margin-bottom:4px;">${ic('list',14)} 计划看房 (${pls.length})</div>
          ${pls.map(p=>`<div style="padding:6px 10px;background:var(--accent-soft);border-left:3px solid var(--accent);border-radius:6px;margin-bottom:4px;font-size:13px;cursor:pointer;" onclick="CalendarMod.view('${p.id}')">
            <strong>${p.city?p.city+'·':''}${p.district}</strong> · ${p.targets?p.targets.join('、'):'待确认'}${p.note?' · <span style="color:var(--text-3)">'+p.note+'</span>':''}
          </div>`).join('')}</div>` : ''}
        ${(recs.length || donePlans.length) ? `<div><div style="font-size:12px;color:var(--success);font-weight:600;margin-bottom:4px;">${ic('check',14)} 已看房 (${recs.length+donePlans.length})</div>
          ${recs.map(r=>`<div style="padding:6px 10px;background:var(--success-soft);border-radius:6px;margin-bottom:4px;font-size:13px;cursor:pointer;" onclick="RecordsMod.view('${r.id}')">
            ${ic('house',14)} <strong>${r.communityName}</strong> <span class="tag tag-sm">${r.district}</span> <span style="color:var(--text-3)">${Utils.formatWan(r.totalPrice)}</span> ${Utils.renderStars(r.overallRating||0)}
          </div>`).join('')}
          ${donePlans.map(p=>`<div style="padding:6px 10px;background:var(--success-soft);border-left:3px solid var(--success);border-radius:6px;margin-bottom:4px;font-size:13px;cursor:pointer;" onclick="CalendarMod.view('${p.id}')">
            ${ic('list',14)} <strong>${p.city?p.city+'·':''}${p.district}</strong> · ${p.targets?p.targets.join('、'):'待确认'} ${p.recordId?'<span class="tag tag-primary tag-sm">已转记录</span>':'<span class="tag tag-success tag-sm">已完成</span>'}
          </div>`).join('')}
        </div>` : ''}
        ${!recs.length && !pls.length && !donePlans.length ? `<div style="text-align:center;color:var(--text-4);font-size:12.5px;padding:12px;">当日暂无看房安排</div>` : ''}
      </div>
    </div>`;
  }

  // ============= 年视图 =============
  function renderYearView(year, records, plans) {
    const today = Utils.today();
    const toolbar = `
      <div class="calendar-toolbar">
        <h3>
          <button class="btn btn-ghost btn-sm" onclick="CalendarMod.prevYear()">‹</button>
          ${year}年 看房年历
          <button class="btn btn-ghost btn-sm" onclick="CalendarMod.nextYear()">›</button>
          <button class="btn btn-accent btn-sm" style="margin-left:10px;" onclick="CalendarMod.goToday()">今年</button>
        </h3>
        <div class="tools">
          <span class="tag tag-success"><span style="background:var(--success);width:6px;height:6px;border-radius:50%;display:inline-block;margin-right:4px;"></span>已看房</span>
          <span class="tag tag-accent"><span style="background:var(--accent);width:6px;height:6px;border-radius:50%;display:inline-block;margin-right:4px;"></span>计划看</span>
          <span class="tag tag-danger"><span style="background:var(--danger);width:6px;height:6px;border-radius:50%;display:inline-block;margin-right:4px;"></span>已过期</span>
        </div>
      </div>
    `;
    // 12个月迷你日历
    const months = [];
    for (let m = 0; m < 12; m++) {
      months.push(_renderMiniMonth(year, m, records, plans, today));
    }
    return toolbar + `<div class="year-grid">${months.join('')}</div>`;
  }

  function _renderMiniMonth(year, month, records, plans, today) {
    const first = new Date(year, month, 1);
    const startWeekday = first.getDay();
    const daysInMonth = new Date(year, month+1, 0).getDate();
    const mStr = String(month+1).padStart(2,'0');
    const mStart = `${year}-${mStr}-01`, mEnd = `${year}-${mStr}-31`;
    const recM = records.filter(r => r.viewingDate && r.viewingDate >= mStart && r.viewingDate <= mEnd);
    const doneM = plans.filter(p => p.status === 'done' && !p.recordId && p.date && p.date >= mStart && p.date <= mEnd);
    const planM = plans.filter(p => p.date && p.date >= mStart && p.date <= mEnd && p.status === 'pending');
    const expM = plans.filter(p => p.date && p.date >= mStart && p.date <= mEnd && p.status === 'expired');
    const heads = ['日','一','二','三','四','五','六'].map((d,i)=>`<div class="mini-head" style="${i===0||i===6?'color:#E0564F;':''}">${d}</div>`).join('');
    let cells = '';
    for (let i = 0; i < startWeekday; i++) cells += `<div class="mini-cell other"></div>`;
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${mStr}-${String(d).padStart(2,'0')}`;
      const recCnt = records.filter(r => r.viewingDate === dateStr).length + plans.filter(p => p.date === dateStr && p.status === 'done' && !p.recordId).length;
      const planCnt = plans.filter(p => p.date === dateStr && p.status === 'pending').length;
      const expCnt = plans.filter(p => p.date === dateStr && p.status === 'expired').length;
      const isToday = dateStr === today;
      let bg = '#fff';
      if (recCnt && planCnt) bg = 'linear-gradient(135deg,var(--success-soft) 50%,var(--accent-soft) 50%)';
      else if (recCnt) bg = 'var(--success-soft)';
      else if (planCnt) bg = 'var(--accent-soft)';
      else if (expCnt) bg = 'var(--danger-soft)';
      cells += `<div class="mini-cell ${isToday?'today':''}" style="background:${bg};" onclick="CalendarMod.dayDetail('${dateStr}')" title="${dateStr}：已看${recCnt} / 待看${planCnt} / 过期${expCnt}">${d}</div>`;
    }
    const totalCells = startWeekday + daysInMonth;
    const rem = (7 - totalCells % 7) % 7;
    for (let i = 0; i < rem; i++) cells += `<div class="mini-cell other"></div>`;
    return `<div class="mini-month">
      <div class="mini-title" onclick="CalendarMod.jumpToMonth(${month})">${month+1}月 <span style="font-size:11px;color:var(--text-3);font-weight:400;">看${recM.length + doneM.length}·待${planM.length}·过${expM.length}</span></div>
      <div class="mini-grid">${heads}${cells}</div>
    </div>`;
  }

  // ============= 时间线 =============
  function renderTimeline(records, plans) {
    const toolbar = `<div class="calendar-toolbar"><h3>${ic('refresh')} 看房全时间线</h3><div class="tools"><span style="font-size:12px;color:var(--text-3);">共 ${records.length + plans.filter(p=>p.status==='done' && !p.recordId).length} 条已看 · ${plans.filter(p=>p.status==='pending').length} 条待看计划 · ${plans.filter(p=>p.status==='expired').length} 条已过期</span></div></div>`;
    const all = [];
    records.forEach(r => all.push({date: r.viewingDate || '1970-01-01', type: 'record', data: r}));
    plans.filter(p => !p.recordId).forEach(p => all.push({date: p.date, type: 'plan', data: p}));
    all.sort((a,b) => b.date.localeCompare(a.date));
    const list = all.length ? `<div class="timeline">${all.map(item => _renderTimelineItem(item)).join('')}</div>` : `<div class="empty-state"><div class="icon">${ic('inbox',54)}</div><h4>暂无记录</h4><p>看房记录和计划会按时间顺序展示在这里。</p></div>`;
    return toolbar + list;
  }

  function _renderTimelineItem(item) {
    const isToday = item.date === Utils.today();
    const past = item.date < Utils.today();
    if (item.type === 'record') {
      const r = item.data;
      return `<div class="tl-item">
        <div class="tl-date">${item.date} ${Utils.weekdayCN(item.date)}${isToday?' <span class="tag tag-accent tag-sm">今天</span>':''}</div>
        <div class="tl-content" style="cursor:pointer;" onclick="RecordsMod.view('${r.id}')">
          <div style="font-weight:600;">${ic('house',14)} ${r.communityName} <span class="tag tag-primary tag-sm">${r.district}</span></div>
          <div style="font-size:12.5px;color:var(--text-3);margin-top:3px;">${Utils.formatRooms(r.rooms)} · ${Utils.formatArea(r.area)} · ${Utils.formatWan(r.totalPrice)} · 评分${r.overallRating||'-'}星</div>
          ${r.summary?`<div style="font-size:12.5px;color:var(--text-2);margin-top:4px;padding:6px 8px;background:var(--primary-soft);border-radius:4px;">${ic('note',13)} ${r.summary}</div>`:''}
        </div>
      </div>`;
    }
    const p = item.data;
    const tag = p.recordId?'tag-primary':(p.status==='done'?'tag-success':(past?'tag-danger':'tag-accent'));
    const label = p.recordId?'已转记录':(p.status==='done'?'已完成':(past?'已过期':'计划中'));
    return `<div class="tl-item">
      <div class="tl-date">${item.date} ${Utils.weekdayCN(item.date)}${isToday?' <span class="tag tag-accent tag-sm">今天</span>':''} <span class="tag ${tag} tag-sm">${label}</span></div>
      <div class="tl-content" style="cursor:pointer;" onclick="CalendarMod.view('${p.id}')">
        <div style="font-weight:600;">${ic('list',14)} ${p.city?p.city+'·':''}${p.district}看房计划</div>
        <div style="font-size:12.5px;color:var(--text-3);margin-top:3px;">目标：${p.targets?p.targets.join('、'):'待确认'}${p.note?' · '+p.note:''}</div>
      </div>
    </div>`;
  }

  // ============= 视图切换 =============
  function changeView(v) { curView = v; renderCalendar(); }
  function prevMonth() { curDate = new Date(curDate.getFullYear(), curDate.getMonth()-1, 1); if (curView==='year') curView='month'; renderCalendar(); }
  function nextMonth() { curDate = new Date(curDate.getFullYear(), curDate.getMonth()+1, 1); if (curView==='year') curView='month'; renderCalendar(); }
  function prevWeek() { curDate = new Date(curDate.getTime() - 7*86400000); renderCalendar(); }
  function nextWeek() { curDate = new Date(curDate.getTime() + 7*86400000); renderCalendar(); }
  function prevYear() { curDate = new Date(curDate.getFullYear()-1, 0, 1); renderCalendar(); }
  function nextYear() { curDate = new Date(curDate.getFullYear()+1, 0, 1); renderCalendar(); }
  function jumpToMonth(m) { curDate = new Date(curDate.getFullYear(), m, 1); curView = 'month'; renderCalendar(); }
  function goToday() { curDate = new Date(); renderCalendar(); }
  function goDate(ds) {
    curDate = new Date(ds);
    if (curView === 'timeline') dayDetail(ds);
    else renderCalendar();
  }

  // ============= 日期详情（含点击删除） =============
  function dayDetail(ds) {
    const records = Store.getRecords().filter(r => r.viewingDate === ds);
    const plans = Store.getPlans().filter(p => p.date === ds);
    const activePlans = plans.filter(p => !p.recordId);   // 已转记录的由"已看房"承载，不再计入计划区
    const html = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
        <div style="font-size:14px;color:var(--text-2);">${ic('calendar',14)} ${ds} ${Utils.weekdayCN(ds)}</div>
        <button class="btn btn-primary btn-sm" onclick="CalendarMod.edit(null,'${ds}')">${ic('plus',15)} 为这天加计划</button>
      </div>
      ${activePlans.length ? `<div style="margin-bottom:16px;"><h4 style="margin-bottom:8px;font-size:14px;color:var(--accent);">${ic('list',14)} 看房计划 (${activePlans.length})</h4>
        ${activePlans.map(p=>`<div style="padding:10px;background:var(--accent-soft);border-left:3px solid var(--accent);border-radius:8px;margin-bottom:6px;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
            <div style="flex:1;">
              <strong>${p.city?p.city+'·':''}${p.district}</strong> ${p.recordId?'<span class="tag tag-primary tag-sm">已转记录</span>':(p.status==='expired'?'<span class="tag tag-danger tag-sm">已过期</span>':(p.status==='done'?'<span class="tag tag-success tag-sm">已完成</span>':'<span class="tag tag-accent tag-sm">待看</span>'))}<br>
              <span style="font-size:12.5px;color:var(--text-3);">目标：${p.targets?p.targets.join('、'):'待确认'}${p.note?' · '+p.note:''}</span>
            </div>
            <div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end;">
              ${p.status!=='done'?`<button class="btn btn-success btn-sm" onclick="CalendarMod.markDone('${p.id}')">完成</button>`:''}
              ${p.status==='expired'?`<button class="btn btn-accent btn-sm" onclick="CalendarMod.reactivate('${p.id}')">恢复</button>`:''}
              <button class="btn btn-primary btn-sm" onclick="CalendarMod.view('${p.id}')">详情</button>
              <button class="btn btn-danger btn-sm" onclick="CalendarMod.confirmDeletePlan('${p.id}','${ds}')">${ic('trash',15)}</button>
            </div>
          </div>
        </div>`).join('')}</div>`:''}
      ${records.length ? `<div><h4 style="margin-bottom:8px;font-size:14px;color:var(--success);">${ic('check',14)} 已看房 (${records.length})</h4>
        ${records.map(r=>`<div style="padding:10px;background:var(--success-soft);border-radius:8px;margin-bottom:6px;cursor:pointer;" onclick="Utils.closeModal();setTimeout(()=>RecordsMod.view('${r.id}'),60);">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div><strong>${r.communityName}</strong> <span class="tag tag-sm">${r.district}</span> · ${Utils.formatRooms(r.rooms)} · ${Utils.formatWan(r.totalPrice)} ${Utils.renderStars(r.overallRating||0)}</div>
            <span class="tag tag-success tag-sm">查看详情 →</span>
          </div>
          ${r.summary?`<div style="font-size:12.5px;color:var(--text-2);margin-top:4px;">${ic('note',13)} ${r.summary}</div>`:''}
        </div>`).join('')}</div>`:''}
      ${!records.length && !activePlans.length ? `<div class="empty-state" style="padding:24px;"><div class="icon">${ic('smile',54)}</div><p>当日暂无安排，享受轻松的一天吧！</p></div>`:''}
    `;
    Utils.openModal({title: `${ds} 看房安排`, body: html, size: 'lg'});
  }

  function confirmDeletePlan(id, ds) {
    Utils.openModal({
      title:'删除该计划？', body:`<p>将删除 <strong style="color:var(--danger);">${ds}</strong> 的看房计划，不可恢复。</p>`,
      footer:`<button class="btn btn-ghost" onclick="Utils.closeModal()">取消</button>
        <button class="btn btn-danger" onclick="CalendarMod.doDeletePlan('${id}','${ds}')">删除</button>`,
      size:'sm'
    });
  }
  function doDeletePlan(id, ds) {
    Store.deletePlan(id);
    Utils.closeModal();
    Utils.toast('已删除该计划','success');
    // 刷新日详情弹窗
    setTimeout(()=>dayDetail(ds), 80);
  }

  // ============= 计划编辑/查看（迁移自 plans.js） =============
  function edit(id=null, preDate=null) {
    const d = id ? Store.getPlans().find(p=>p.id===id) : { date: preDate||Utils.today(), city: Store.getDefaultCity(), district:'', targets:[], note:'', prepItems:[...PREP_LIST.map(p=>({label:p,checked:false}))] };
    const body = `
      <div id="planForm">
        <div class="form-grid">
          <div class="form-item">
            <label><span class="req">*</span>看房日期</label>
            <input type="date" data-field="date" value="${d.date||''}">
          </div>
          <div class="form-item">
            <label><span class="req">*</span>所在城市（省 → 市）</label>
            <div class="cascade-group plan-cascade">${Store.cityCascadeHTML(d.city||Store.getDefaultCity(), 'plan', { id: 'plan_city', onCity: 'CalendarMod.syncPlanDistricts()', attrs: ' data-field="city"' })}</div>
          </div>
          <div class="form-item">
            <label><span class="req">*</span>目标区域</label>
            <select id="plan_district" data-field="district">
              <option value="">请选择</option>
              ${(d.city && Store.CITIES[d.city] ? Store.CITIES[d.city] : Store.getDistricts()).map(v=>`<option ${d.district===v?'selected':''}>${v}</option>`).join('')}
            </select>
          </div>
          <div class="form-item full">
            <label>目标小区</label>
            <input type="text" id="targetsInput" placeholder="如：百家湖花园" value="${(d.targets&&d.targets[0])||''}">
          </div>
          <div class="form-item full">
            <label>备注（中介联系方式、注意事项等）</label>
            <textarea data-field="note" placeholder="如：联系中介小王 138****1234">${d.note||''}</textarea>
          </div>
          <div class="form-item full">
            <label>${ic('bag',14)} 准备清单（提醒时展示）</label>
            <div id="prepBox" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px;margin-top:6px;">
              ${PREP_LIST.map((it,idx)=>`<label style="display:flex;align-items:center;gap:6px;padding:6px 10px;border:1px solid var(--border-light);border-radius:6px;cursor:pointer;">
                <input type="checkbox" data-prep="${idx}" ${((d.prepItems||PREP_LIST.map(x=>({label:x,checked:false})))[idx]||{}).checked?'checked':''}> <span>${it}</span></label>`).join('')}
            </div>
          </div>
        </div>
      </div>
    `;
    Utils.openModal({
      title: id ? '编辑看房计划' : '新建看房计划', body,
      footer: `<button class="btn btn-ghost" onclick="Utils.closeModal()">取消</button>
        <button class="btn btn-primary" onclick="CalendarMod.doSave(${id?`'${id}'`:''})">保存</button>`,
    });
    const f = document.getElementById('planForm');
    Utils.fillForm(f, d);
  }

  // 城市变更 → 联动重绘目标区域下拉
  function syncPlanDistricts() {
    const city = document.getElementById('plan_city').value;
    const sel = document.getElementById('plan_district');
    if (!sel) return;
    sel.innerHTML = '<option value="">请选择</option>' + (Store.CITIES[city]||[]).map(v=>`<option>${v}</option>`).join('');
  }

  function doSave(id) {
    const form = document.getElementById('planForm');
    const data = Utils.collectForm(form);
    const target = document.getElementById('targetsInput').value.trim();
    data.targets = target ? [target] : [];   // 一次只可录入一个目标小区
    const prepItems = PREP_LIST.map((label, i) => {
      const c = document.querySelector(`[data-prep="${i}"]`);
      return { label, checked: c ? c.checked : false };
    });
    data.prepItems = prepItems;
    if (!data.date) { Utils.toast('请选择日期','danger'); return; }
    if (!data.city) { Utils.toast('请选择城市','danger'); return; }
    if (!data.district) { Utils.toast('请选择区域','danger'); return; }
    if (id) data.id = id;
    Store.savePlan(data);
    Utils.closeModal();
    Utils.toast(id ? '已更新计划' : '已创建计划', 'success');
    renderCalendar();
  }

  function view(id) {
    const p = Store.getPlans().find(x=>x.id===id);
    if (!p) return;
    const today = Utils.today();
    const days = Utils.daysBetween(today, p.date);
    const html = `
      <div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <div>
            <h3 style="margin-bottom:4px;">${ic('pin',14)} ${p.city?p.city+'·':''}${p.district} 看房计划 ${p.recordId?'<span class="tag tag-primary tag-sm" style="margin-left:6px;">已转房源记录</span>':''}</h3>
            <p style="color:var(--text-3);font-size:13px;">${p.date} ${Utils.weekdayCN(p.date)}
              ${days===0?'<span class="tag tag-accent tag-sm" style="margin-left:8px;">今天！</span>':(days>0?`<span class="tag tag-accent tag-sm" style="margin-left:8px;">还有${days}天</span>`:'')}
            </p>
          </div>
          <div>
            ${p.status!=='done'?`<button class="btn btn-success btn-sm" onclick="CalendarMod.markDone('${id}')">标记完成</button>`:''}
            ${p.status!=='done'?`<button class="btn btn-ghost btn-sm" onclick="Utils.closeModal();CalendarMod.edit('${id}')">编辑</button>`:''}
            <button class="btn btn-danger btn-sm" onclick="CalendarMod.remove('${id}')">${ic('trash',15)} 删除</button>
          </div>
        </div>

        ${p.targets&&p.targets.length?`<div class="card" style="margin-bottom:12px;padding:14px;">
          <div class="card-title" style="margin-bottom:10px;">${ic('houses')} 目标小区 (${p.targets.length})</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            ${p.targets.map(t=>`<span class="tag tag-accent tag-sm" style="font-size:12px;">${t}</span>`).join('')}
          </div>
        </div>`:''}

        ${p.note?`<div class="card" style="margin-bottom:12px;padding:14px;">
          <div class="card-title" style="margin-bottom:8px;">${ic('note')} 备注</div>
          <p style="font-size:13px;">${p.note}</p>
        </div>`:''}

        <div class="card" style="padding:14px;">
          <div class="card-title" style="margin-bottom:10px;">${ic('bag')} 看房准备清单</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px;">
            ${(p.prepItems||[]).map((it,i)=>`<label style="display:flex;align-items:center;gap:6px;padding:6px 10px;border:1px solid var(--border-light);border-radius:6px;cursor:pointer;opacity:${it.checked?1:0.7};background:${it.checked?'var(--success-soft)':'#fff'};">
              <input type="checkbox" ${it.checked?'checked':''} ${p.status==='done'?'disabled':''} onchange="CalendarMod.togglePrep('${id}',${i},this.checked)"> <span>${it.label}</span></label>`).join('')}
          </div>
          <div style="margin-top:12px;text-align:right;">
            ${p.recordId
              ? `<button class="btn btn-primary btn-sm" onclick="Utils.closeModal();RecordsMod.view('${p.recordId}')">${ic('note',15)} 查看已转房源记录</button>`
              : `<button class="btn btn-primary btn-sm" onclick="CalendarMod.convertToRecord('${id}')">${ic('note',15)} ${p.status==='done'?'转房源记录':'看完了？一键转房源记录'}</button>`}
          </div>
        </div>
      </div>
    `;
    Utils.openModal({ title: '看房计划详情', body: html, size: 'lg' });
  }

  function togglePrep(id, i, checked) {
    const list = Store.getPlans();
    const p = list.find(x=>x.id===id);
    if (p && p.prepItems) { p.prepItems[i].checked = checked; Store.savePlan(p); }
  }

  function markDone(id) {
    const list = Store.getPlans();
    const p = list.find(x=>x.id===id);
    if (p) { p.status = 'done'; Store.savePlan(p); Utils.closeModal(); Utils.toast('已标记为完成','success'); renderCalendar(); }
  }
  function reactivate(id) {
    const list = Store.getPlans();
    const p = list.find(x=>x.id===id);
    if (p) { p.status = 'pending'; Store.savePlan(p); Utils.toast('已恢复为待看状态','success'); renderCalendar(); }
  }
  function remove(id) {
    Utils.openModal({title:'删除确认',body:'<p>删除该看房计划？</p>',footer:`<button class="btn btn-ghost" onclick="Utils.closeModal()">取消</button><button class="btn btn-danger" onclick="CalendarMod.doRemove('${id}')">删除</button>`,size:'sm'});
  }
  function doRemove(id) { Store.deletePlan(id); Utils.closeModal(); Utils.toast('已删除','success'); renderCalendar(); }

  // 看房计划 → 房源记录：打开"新增房源记录"表单并预填该小区，
  // 仅当记录表单保存成功后才回写计划为"已转记录"（通过表单内 _planId 标记联动）
  function convertToRecord(id) {
    const p = Store.getPlans().find(x=>x.id===id);
    if (!p) return;
    if (p.recordId) { Utils.closeModal(); RecordsMod.view(p.recordId); return; }   // 已转记录：直接打开对应记录
    const targetName = (p.targets && p.targets[0]) || '';
    Utils.closeModal();
    setTimeout(() => {
      RecordsMod.edit(null);
      const form = document.getElementById('recEditForm');
      if (!form) return;
      const h = document.createElement('input');
      h.type = 'hidden'; h.dataset.field = '_planId'; h.value = id;
      form.appendChild(h);
      // 默认带出目标小区及相关信息
      const comm = form.querySelector('[data-field="communityName"]');
      if (comm) comm.value = targetName;
      const city = p.city || Store.getCity();
      const provEl = form.querySelector('.cascade-prov');
      const cityEl = form.querySelector('[data-field="city"]');
      if (provEl && cityEl) {
        provEl.value = Store.getProvinceOfCity(city);
        Store.onProvChange(provEl);
        cityEl.value = city;
        RecordsMod.syncRecDistricts();
      }
      const district = form.querySelector('[data-field="district"]');
      if (district && p.district) district.value = p.district;
      const date = form.querySelector('[data-field="viewingDate"]');
      if (date) date.value = p.date || Utils.today();
      const source = form.querySelector('[data-field="source"]');
      if (source) source.value = '中介推荐';
    }, 60);
  }

  // ============= 消息提醒（迁移自 plans.js） =============
  function toggleNotify() {
    const s = Store.getSettings();
    if (s.enableNotification) {
      Store.saveSettings({ enableNotification: false });
      _updateNotifyBtn(false);
      Utils.toast('已关闭看房提醒','warn');
    } else {
      if (!("Notification" in window)) { Utils.toast('当前浏览器不支持通知','danger'); return; }
      if (Notification.permission === 'granted') {
        Store.saveSettings({ enableNotification: true });
        _updateNotifyBtn(true);
        Utils.toast('已开启看房提醒','success');
        Utils.notify('看房助手提醒已开启', '创建看房计划后，到期前会自动提醒您准备。');
      } else {
        Notification.requestPermission().then(p => {
          if (p === 'granted') {
            Store.saveSettings({ enableNotification: true });
            _updateNotifyBtn(true);
            Utils.toast('已开启看房提醒','success');
            Utils.notify('看房助手提醒已开启', '创建看房计划后，到期前会自动提醒您准备。');
          } else {
            Utils.toast('未授权通知权限，无法开启提醒','warn');
          }
        });
      }
    }
  }

  function _updateNotifyBtn(enabled) {
    const btn = document.getElementById('notifyToggleBtn');
    if (btn) btn.innerHTML = enabled ? ic('bellOff',15)+' 关闭提醒' : ic('bell',15)+' 开启提醒';
  }

  function checkReminders() {
    Store.updatePlanStatus();
    const s = Store.getSettings();
    if (!s.enableNotification) return;
    const plans = Store.getPlans().filter(p=>p.status==='pending');
    const today = Utils.today();
    const beforeDays = s.remindBeforeDays || 1;
    const remindedIds = JSON.parse(localStorage.getItem('hh_reminded_ids') || '[]');
    plans.forEach(p => {
      const d = Utils.daysBetween(today, p.date);
      if (d <= beforeDays && d >= 0 && !remindedIds.includes(p.id)) {
        remindedIds.push(p.id);
        Utils.notify(`${d===0?'今天':'还有'+d+'天'}看房计划`, `${p.city?p.city+'·':''}${p.district||'指定区域'}${p.targets?' · 目标：'+p.targets.join('、'):''}\n${p.note||'记得提前准备哦'}`);
      }
    });
    localStorage.setItem('hh_reminded_ids', JSON.stringify(remindedIds));
  }

  return {
    render, renderCalendar, changeView,
    prevMonth, nextMonth, prevWeek, nextWeek, prevYear, nextYear, jumpToMonth, goToday, goDate,
    dayDetail, confirmDeletePlan, doDeletePlan,
    edit, doSave, syncPlanDistricts, view, markDone, reactivate, remove, doRemove, convertToRecord, togglePrep,
    toggleNotify, checkReminders
  };
})();
