/* ============================================
   M8 财务计算工具集
   月供/全成本/议价/税费四大计算器
   ============================================ */
window.FinanceMod = (function() {
  let tab = 'monthly';

  function render() {
    const html = `
      <div class="page-header">
        <div>
          <h2><span class="emoji">💰</span>财务计算工具集</h2>
          <p class="page-desc">月供、全成本、议价参考、税费优化 — 搞清楚买房到底花多少钱。</p>
        </div>
      </div>

      <div class="sub-tabs" id="finTabs">
        <div class="sub-tab" data-t="monthly">🏦 月供计算器</div>
        <div class="sub-tab" data-t="full">💸 全成本计算器</div>
        <div class="sub-tab" data-t="bargain">💡 议价参考线</div>
        <div class="sub-tab" data-t="tax">📊 税费优化器</div>
      </div>

      <div id="finContent"></div>
    `;
    App.setContent(html);
    document.querySelectorAll('#finTabs .sub-tab').forEach(t => {
      if (t.dataset.t === tab) t.classList.add('active');
      t.addEventListener('click', () => {
        document.querySelectorAll('#finTabs .sub-tab').forEach(x=>x.classList.remove('active'));
        t.classList.add('active');
        tab = t.dataset.t;
        showTab();
      });
    });
    showTab();
  }

  function showTab() {
    const box = document.getElementById('finContent');
    if (tab === 'monthly') box.innerHTML = renderMonthly();
    else if (tab === 'full') box.innerHTML = renderFull();
    else if (tab === 'bargain') box.innerHTML = renderBargain();
    else box.innerHTML = renderTax();
  }

  // ========== 月供计算器 ==========
  function renderMonthly() {
    const exp = Store.getExpectation();
    return `<div class="grid-2">
      <div class="card">
        <div class="card-title">🏦 贷款参数</div>
        <div class="form-grid">
          <div class="form-item"><label>房屋总价（万元）</label><input type="number" id="m_price" value="${exp.budgetMax||150}" oninput="calcMonthly()"></div>
          <div class="form-item"><label>首付比例（%）</label><input type="number" id="m_downPct" value="30" min="0" max="100" oninput="calcMonthly()"></div>
          <div class="form-item"><label>首付金额（万元）</label><input type="number" id="m_down" value="${exp.downPayment||45}" oninput="calcMonthlyDown()"></div>
          <div class="form-item"><label>贷款金额（万元）</label><input type="number" id="m_loan" value="${exp.loanAmount||105}" oninput="calcMonthlyLoan()"></div>
          <div class="form-item"><label>贷款类型</label>
            <select id="m_type" onchange="updateRateHint();calcMonthly()">
              <option value="business">商业贷款</option>
              <option value="fund">公积金贷款</option>
              <option value="combo">组合贷款</option>
            </select>
          </div>
          <div class="form-item"><label>商贷年利率（%）</label><input type="number" id="m_rateB" step="0.01" value="3.45" oninput="calcMonthly()"></div>
          <div class="form-item" id="m_fundBox" style="display:none;"><label>公积金贷款（万元）</label><input type="number" id="m_loanF" value="50" oninput="calcMonthly()"></div>
          <div class="form-item" id="m_rateFBox" style="display:none;"><label>公积金利率（%）</label><input type="number" id="m_rateF" step="0.01" value="2.85" oninput="calcMonthly()"></div>
          <div class="form-item"><label>贷款年限（年）</label>
            <select id="m_years" onchange="calcMonthly()">
              ${[30,25,20,15,10,5].map(y=>`<option ${y===30?'selected':''}>${y}</option>`).join('')}
            </select>
          </div>
          <div class="form-item"><label>还款方式</label>
            <select id="m_method" onchange="calcMonthly()">
              <option value="equal">等额本息</option>
              <option value="principal">等额本金</option>
            </select>
          </div>
        </div>
        <div class="callout" style="margin-top:14px;">
          <div class="callout-title">小贴士</div>
          <p style="font-size:12px;">南京2026年首套商贷利率普遍为3.2-3.6%，公积金贷款利率2.85%（5年以上）。月供建议不超过家庭收入的30%。</p>
        </div>
      </div>
      <div id="m_result"></div>
    </div>`;
  }
  function updateRateHint() {
    const t = document.getElementById('m_type').value;
    document.getElementById('m_fundBox').style.display = (t==='combo'?'':'none');
    document.getElementById('m_rateFBox').style.display = (t==='fund'||t==='combo'?'':'none');
  }
  function calcMonthlyDown() {
    const price = +document.getElementById('m_price').value||0;
    const down = +document.getElementById('m_down').value||0;
    if (price>0) document.getElementById('m_downPct').value = Math.round(down/price*100);
    if (price>=down) document.getElementById('m_loan').value = (price-down).toFixed(1);
    calcMonthly();
  }
  function calcMonthlyLoan() {
    const price = +document.getElementById('m_price').value||0;
    const loan = +document.getElementById('m_loan').value||0;
    if (price>=loan) {
      const down = price - loan;
      document.getElementById('m_down').value = down.toFixed(1);
      if (price>0) document.getElementById('m_downPct').value = Math.round(down/price*100);
    }
    calcMonthly();
  }
  function calcMonthly() {
    updateRateHint();
    const price = +document.getElementById('m_price').value||0;
    const downPct = +document.getElementById('m_downPct').value||0;
    const years = +document.getElementById('m_years').value;
    const method = document.getElementById('m_method').value;
    const type = document.getElementById('m_type').value;
    let down = +document.getElementById('m_down').value||0;
    let loanB = +document.getElementById('m_loan').value||0;
    if (!down && price && downPct) down = price * downPct/100;
    if (!loanB && price) loanB = price - down;
    const rateB = (+document.getElementById('m_rateB').value||0)/100/12;
    const n = years*12;
    let monthly, totalInterest, totalPay, firstMonth=0, lastMonth=0, detailHtml='';

    if (type==='fund') {
      const loanF = loanB;
      const rateF = (+(document.getElementById('m_rateF').value||0))/100/12;
      const r = calcLoanOne(loanF, rateF, n, method);
      monthly = r.monthly; totalInterest = r.totalInterest; totalPay = r.totalPay;
      firstMonth = r.firstMonth; lastMonth = r.lastMonth;
    } else if (type==='combo') {
      const loanF = +document.getElementById('m_loanF').value||0;
      const bLoan = Math.max(0, loanB - loanF);
      const rateF = (+(document.getElementById('m_rateF').value||0))/100/12;
      const rb = calcLoanOne(bLoan, rateB, n, method);
      const rf = calcLoanOne(loanF, rateF, n, method);
      monthly = rb.monthly + rf.monthly;
      totalInterest = rb.totalInterest + rf.totalInterest;
      totalPay = rb.totalPay + rf.totalPay;
      firstMonth = rb.firstMonth + rf.firstMonth;
      lastMonth = rb.lastMonth + rf.lastMonth;
      detailHtml = `<div class="r-item"><div class="r-label">商贷月供</div><div class="r-value">${Utils.moneyFormat(Math.round(rb.monthly))}</div></div>
                    <div class="r-item"><div class="r-label">公积金月供</div><div class="r-value">${Utils.moneyFormat(Math.round(rf.monthly))}</div></div>`;
    } else {
      const r = calcLoanOne(loanB, rateB, n, method);
      monthly = r.monthly; totalInterest = r.totalInterest; totalPay = r.totalPay;
      firstMonth = r.firstMonth; lastMonth = r.lastMonth;
    }

    const exp = Store.getExpectation();
    const overPay = exp.monthlyPaymentMax && monthly > exp.monthlyPaymentMax;
    const html = `
      <div class="calc-result">
        <h4>${method==='equal'?'每月等额还款':'首月月供（逐月递减）'}</h4>
        <div class="big-num">${Utils.moneyFormat(Math.round(monthly))}<small style="font-size:14px;font-weight:400;opacity:0.8;">/月</small></div>
        ${overPay?`<div style="background:rgba(220,38,38,0.25);padding:6px 10px;border-radius:6px;font-size:12px;margin-bottom:10px;">⚠️ 已超过您期望的月供上限 ${Utils.moneyFormat(exp.monthlyPaymentMax)}，建议调整首付或总价预算</div>`:''}
        <div class="result-grid">
          <div class="r-item"><div class="r-label">首付金额</div><div class="r-value">${(down||0).toFixed(1)}万</div></div>
          <div class="r-item"><div class="r-label">贷款总额</div><div class="r-value">${loanB.toFixed(1)}万</div></div>
          <div class="r-item"><div class="r-label">利息总额</div><div class="r-value">${(totalInterest/10000).toFixed(1)}万</div></div>
          <div class="r-item"><div class="r-label">累计还款</div><div class="r-value">${(totalPay/10000).toFixed(1)}万</div></div>
          ${method==='principal'?`<div class="r-item"><div class="r-label">末月月供</div><div class="r-value">${Utils.moneyFormat(Math.round(lastMonth))}</div></div>`:''}
          <div class="r-item"><div class="r-label">本息比</div><div class="r-value">${loanB>0?(totalInterest/(loanB*10000)*100).toFixed(1):0}%</div></div>
          ${detailHtml}
        </div>
      </div>
      <div class="card" style="margin-top:16px;">
        <div class="card-title">📈 还款明细（前6期 + 后2期）</div>
        <table style="width:100%;font-size:12.5px;" class="compare-table">
          <thead><tr><th>期数</th><th>月供</th><th>本金</th><th>利息</th><th>剩余本金</th></tr></thead>
          <tbody>${renderLoanDetail(loanB*10000, type==='business'?rateB:type==='fund'?(+document.getElementById('m_rateF').value||0)/100/12:rateB, n, method, type)}</tbody>
        </table>
      </div>
    `;
    document.getElementById('m_result').innerHTML = html;
  }
  function calcLoanOne(loanWan, rateMonthly, n, method) {
    const P = loanWan*10000; // 元
    if (method==='equal') {
      if (rateMonthly===0) return {monthly: P/n, totalInterest:0, totalPay:P, firstMonth:P/n, lastMonth:P/n};
      const x = Math.pow(1+rateMonthly, n);
      const m = P*rateMonthly*x/(x-1);
      return { monthly: m, totalInterest: m*n-P, totalPay: m*n, firstMonth: m, lastMonth: m };
    } else {
      const monthlyPrincipal = P/n;
      const firstMonth = monthlyPrincipal + P*rateMonthly;
      const lastMonth = monthlyPrincipal + monthlyPrincipal*rateMonthly;
      const totalInterest = P*rateMonthly*(n+1)/2;
      return { monthly: firstMonth, totalInterest, totalPay: P+totalInterest, firstMonth, lastMonth };
    }
  }
  function renderLoanDetail(P, rate, n, method, type) {
    // 简化：只按商贷显示
    if (P<=0) return '<tr><td colspan="5" style="text-align:center;color:var(--text-3);">暂无数据</td></tr>';
    const rows = [];
    let principal = P;
    const monthlyP = P/n;
    const monthEq = (rate===0? P/n : P*rate*Math.pow(1+rate,n)/(Math.pow(1+rate,n)-1));
    const idxs = [];
    for (let i=1;i<=6;i++) idxs.push(i);
    if (n>8) { idxs.push('...'); for (let i=n-1;i<=n;i++) idxs.push(i); }
    else for (let i=7;i<=n;i++) idxs.push(i);
    let runningPrincipal = P;
    for (const idx of idxs) {
      if (idx==='...') { rows.push(`<tr><td colspan="5" style="text-align:center;color:var(--text-4);">…… 中间 ${n-8} 期省略 ……</td></tr>`); continue; }
      let m, ip, pp;
      if (method==='equal') {
        m = monthEq;
        ip = runningPrincipal * rate;
        pp = m - ip;
        runningPrincipal -= pp;
      } else {
        const leftMonths = n - (idx-1);
        ip = runningPrincipal * rate;
        pp = monthlyP;
        m = pp + ip;
        runningPrincipal -= pp;
      }
      rows.push(`<tr><td>${idx}</td><td>${Utils.moneyFormat(Math.round(m))}</td><td>${Utils.moneyFormat(Math.round(pp))}</td><td>${Utils.moneyFormat(Math.round(ip))}</td><td>${Utils.moneyFormat(Math.max(0,Math.round(runningPrincipal)))}</td></tr>`);
    }
    return rows.join('');
  }

  // ========== 全成本计算器 ==========
  function renderFull() {
    const exp = Store.getExpectation();
    return `<div class="grid-2">
      <div class="card">
        <div class="card-title">💸 各项成本输入</div>
        <div class="form-grid">
          <div class="form-item"><label>房屋总价（万元）</label><input type="number" id="f_price" value="${exp.budgetMax||150}" oninput="calcFull()"></div>
          <div class="form-item"><label>房屋类型</label><select id="f_type" onchange="calcFull()"><option value="new">新房</option><option value="old" selected>二手房</option></select></div>
          <div class="form-item"><label>是否首套房</label><select id="f_first" onchange="calcFull()"><option value="1" selected>是</option><option value="0">否</option></select></div>
          <div class="form-item"><label>建筑面积（㎡）</label><input type="number" id="f_area" value="${exp.areaMax||100}" oninput="calcFull()"></div>
          <div class="form-item"><label>是否电梯房</label><select id="f_elev" onchange="calcFull()"><option value="1" selected>是</option><option value="0">否</option></select></div>
          <div class="form-item"><label>满五唯一（二手房）</label><select id="f_51" onchange="calcFull()"><option value="0">否</option><option value="1">是</option></select></div>
          <div class="form-item"><label>是否满二（二手房）</label><select id="f_2" onchange="calcFull()"><option value="1" selected>是</option><option value="0">否</option></select></div>
          <div class="form-item"><label>中介费比例（%）</label><input type="number" id="f_agency" step="0.1" value="2.4" oninput="calcFull()"></div>
          <div class="form-item"><label>装修预算（万元）</label><input type="number" id="f_renov" value="${exp.renovationBudget||10}" oninput="calcFull()"></div>
          <div class="form-item"><label>物业费（元/㎡/月）</label><input type="number" id="f_propFee" step="0.1" value="2.0" oninput="calcFull()"></div>
        </div>
      </div>
      <div id="f_result"></div>
    </div>`;
  }
  function calcFull() {
    const price = +document.getElementById('f_price').value||0; // 万
    const isOld = document.getElementById('f_type').value === 'old';
    const isFirst = document.getElementById('f_first').value === '1';
    const area = +document.getElementById('f_area').value||0;
    const fiveOne = document.getElementById('f_51').value === '1';
    const fullTwo = document.getElementById('f_2').value === '1';
    const agencyPct = (+document.getElementById('f_agency').value||0)/100;
    const renov = +document.getElementById('f_renov').value||0;
    const propFee = +document.getElementById('f_propFee').value||0;

    // 契税
    let deedTaxRate = 0;
    const priceY = price;
    if (isOld) {
      // 二手房：首套90平以下1%，90平以上1.5%；二套90平1%/以上2%；三套+3%
      if (isFirst) deedTaxRate = area<=90?0.01:0.015;
      else deedTaxRate = area<=90?0.01:0.02;
    } else {
      // 新房
      if (isFirst) deedTaxRate = area<=90?0.01:0.015;
      else deedTaxRate = 0.03;
    }
    const deedTax = priceY * deedTaxRate;
    // 个人所得税（二手房）
    const incomeTax = isOld && !fiveOne ? priceY*0.01 : 0;
    // 增值税（二手房）
    const vat = isOld && !fullTwo ? priceY*0.053 : 0;
    // 中介费
    const agencyFee = priceY * agencyPct;
    // 维修基金（新房）
    const repairFund = isOld ? 0 : area*120/10000; // 120元/㎡
    // 评估费（二手房约0.1%）
    const assessFee = isOld ? priceY*0.001 : 0;
    // 工本费等
    const misc = 0.085 + (isOld?0.5:0);
    // 物业费（年）
    const propYear = area * propFee * 12 / 10000;

    const taxTotal = deedTax + incomeTax + vat + repairFund + assessFee + misc;
    const transactionTotal = agencyFee + taxTotal;
    const oneTimeTotal = priceY + transactionTotal + renov;
    const yearlyTotal = propYear;

    const html = `
      <div class="calc-result">
        <h4>真实一次性总支出</h4>
        <div class="big-num">${oneTimeTotal.toFixed(1)}<small style="font-size:14px;opacity:0.8;font-weight:400;">万元</small></div>
        <p style="font-size:12px;opacity:0.85;">其中房价 ${priceY.toFixed(1)}万 + 税费杂费 ${transactionTotal.toFixed(1)}万 + 装修 ${renov}万</p>
        <div class="result-grid">
          <div class="r-item"><div class="r-label">契税</div><div class="r-value">${deedTax.toFixed(2)}万 <small style="opacity:0.7;">(${(deedTaxRate*100).toFixed(1)}%)</small></div></div>
          <div class="r-item"><div class="r-label">${isOld?'个人所得税':'维修基金'}</div><div class="r-value">${(isOld?incomeTax:repairFund).toFixed(2)}万</div></div>
          <div class="r-item"><div class="r-label">${isOld?'增值税及附加':'评估/登记等'}</div><div class="r-value">${(isOld?vat:assessFee+misc).toFixed(2)}万</div></div>
          <div class="r-item"><div class="r-label">中介费</div><div class="r-value">${agencyFee.toFixed(2)}万</div></div>
          <div class="r-item"><div class="r-label">合计税费杂费</div><div class="r-value">${transactionTotal.toFixed(2)}万</div></div>
          <div class="r-item"><div class="r-label">年持有成本</div><div class="r-value">${yearlyTotal.toFixed(2)}万</div></div>
        </div>
      </div>
      <div class="card" style="margin-top:16px;">
        <div class="card-title">📋 成本占比</div>
        <div style="height:240px;" id="fullChart"></div>
      </div>
    `;
    document.getElementById('f_result').innerHTML = html;
    if (echarts) {
      const C = Utils.theme();
      const chart = echarts.init(document.getElementById('fullChart'));
      chart.setOption({
        tooltip:{trigger:'item', formatter:'{b}: {c}万 ({d}%)'},
        legend:{bottom:0, textStyle:{fontSize:11}},
        series:[{type:'pie', radius:['45%','70%'], avoidLabelOverlap:true,
          label:{formatter:'{b}\n{d}%', fontSize:11},
          data:[
            {value:priceY, name:'房价', itemStyle:{color:C.primary}},
            {value:agencyFee, name:'中介费', itemStyle:{color:C.accent}},
            {value:taxTotal, name:'税费杂费', itemStyle:{color:C.warn}},
            {value:renov, name:'装修', itemStyle:{color:C.success}},
          ]}]
      });
    }
  }

  // ========== 议价参考 ==========
  function renderBargain() {
    const exp = Store.getExpectation();
    const records = Store.getRecords();
    return `<div class="grid-2">
      <div class="card">
        <div class="card-title">💡 议价参数</div>
        <div class="form-grid">
          <div class="form-item"><label>小区名称</label>
            <input type="text" id="b_comm" list="b_comm_list" placeholder="选择或输入小区">
            <datalist id="b_comm_list">${records.map(r=>`<option value="${r.communityName}">`).join('')}</datalist>
          </div>
          <div class="form-item"><label>挂牌总价（万元）</label><input type="number" id="b_listPrice" value="${exp.budgetMax||150}" oninput="calcBargain()"></div>
          <div class="form-item"><label>小区近期成交均价（元/㎡）</label><input type="number" id="b_avgPrice" value="13500" placeholder="可参考同小区历史成交" oninput="calcBargain()"></div>
          <div class="form-item"><label>本房源建筑面积（㎡）</label><input type="number" id="b_area" value="${exp.areaMax||100}" oninput="calcBargain()"></div>
          <div class="form-item"><label>房龄（年）</label><input type="number" id="b_age" value="10" oninput="calcBargain()"></div>
          <div class="form-item"><label>楼层/装修/户型</label>
            <select id="b_condition" oninput="calcBargain()">
              <option value="1">一般（有硬伤）</option>
              <option value="1.02" selected>中等（正常水平）</option>
              <option value="1.05">较好（楼层好/精装修）</option>
              <option value="1.08">优秀（楼王/豪装）</option>
            </select>
          </div>
        </div>
        <div class="callout success" style="margin-top:14px;">
          <div class="callout-title">💡 议价建议参考</div>
          <p style="font-size:12px;">南京二手房普遍可谈空间：挂牌价的 3-8%。若房源挂时长超过3个月、卖家急需资金、房龄较老、存在明显硬伤，可向 8-10% 方向谈。新房一般优惠幅度较小，可争取装修、车位、物业费等赠送。</p>
        </div>
      </div>
      <div id="b_result"></div>
    </div>`;
  }
  function calcBargain() {
    const listP = +document.getElementById('b_listPrice').value||0;
    const avg = +document.getElementById('b_avgPrice').value||0;
    const area = +document.getElementById('b_area').value||0;
    const age = +document.getElementById('b_age').value||0;
    const cond = +document.getElementById('b_condition').value||1;
    const listUnit = area>0 ? listP*10000/area : 0;
    // 理论合理单价
    let reasonUnit = avg * cond;
    // 房龄调整
    if (age>15) reasonUnit *= 0.95;
    else if (age>20) reasonUnit *= 0.90;
    const reasonTotal = reasonUnit*area/10000;
    const diff = listP - reasonTotal;
    const diffPct = listP>0 ? diff/listP*100 : 0;

    let advice, color;
    if (diffPct > 8) { advice='挂牌价明显偏高，建议大胆砍价 8-12%'; color='tag-danger'; }
    else if (diffPct > 5) { advice='挂牌价偏高，建议砍价 5-8%'; color='tag-warn'; }
    else if (diffPct > 2) { advice='价格略高，可尝试砍价 3-5%'; color='tag-accent'; }
    else if (diffPct > -2) { advice='价格合理，可小幅度议价 1-3% 或争取中介费/家具附赠'; color='tag-primary'; }
    else if (diffPct > -5) { advice='价格偏低，性价比不错，建议尽快确认产权与房况'; color='tag-success'; }
    else { advice='价格明显偏低，⚠️ 请务必核实房源真实性与产权纠纷风险'; color='tag-danger'; }

    const html = `
      <div class="calc-result">
        <h4>评估结论</h4>
        <div style="margin-bottom:12px;"><span class="tag ${color}" style="font-size:14px;padding:4px 10px;">${advice}</span></div>
        <div class="big-num">合理总价 ≈ ${reasonTotal.toFixed(1)}<small style="font-size:14px;opacity:0.8;font-weight:400;">万元</small></div>
        <div class="result-grid">
          <div class="r-item"><div class="r-label">挂牌单价</div><div class="r-value">${Math.round(listUnit).toLocaleString()}元/㎡</div></div>
          <div class="r-item"><div class="r-label">合理单价</div><div class="r-value">${Math.round(reasonUnit).toLocaleString()}元/㎡</div></div>
          <div class="r-item"><div class="r-label">价差</div><div class="r-value">${diff.toFixed(1)}万 <small>(${diffPct>0?'+':''}${diffPct.toFixed(1)}%)</small></div></div>
          <div class="r-item"><div class="r-label">建议出价</div><div class="r-value">${(reasonTotal*0.95).toFixed(1)} - ${(reasonTotal*0.98).toFixed(1)}万</div></div>
        </div>
      </div>
      <div class="card" style="margin-top:16px;">
        <div class="card-title">📌 砍价策略</div>
        <ul style="font-size:13px;color:var(--text-2);line-height:2;padding-left:16px;">
          <li>首次出价建议在合理价基础上再降 3-5%，给双方留谈判空间</li>
          <li>强调"可快速付首付""满额首付"等优势，争取卖家降价</li>
          <li>了解卖家卖房原因（置换、急售、移民）针对性议价</li>
          <li>对比同小区近期真实成交价数据（可在贝壳/链家查询）</li>
          <li>除房价外，可争取：家具家电赠送、物业费补贴、维修基金过户等</li>
        </ul>
      </div>
    `;
    document.getElementById('b_result').innerHTML = html;
  }

  // ========== 税费优化器 ==========
  function renderTax() {
    return `<div class="card">
      <div class="card-title">📊 请输入房源参数（最多比较3套）</div>
      <table style="width:100%;" class="compare-table">
        <thead><tr><th>参数</th>
          ${[1,2,3].map(i=>`<th style="min-width:160px;">房源 ${i} <label style="margin-left:6px;"><input type="checkbox" id="t_en${i}" ${i===1?'checked':''} onchange="calcTax()">启用</label></th>`).join('')}
        </tr></thead>
        <tbody>
          <tr><th>总价（万元）</th>${[1,2,3].map(i=>`<td><input type="number" id="t_p${i}" value="${[138,120,150][i-1]}" style="width:100%;padding:6px;border:1px solid var(--border);border-radius:4px;" oninput="calcTax()"></td>`).join('')}</tr>
          <tr><th>房屋类型</th>${[1,2,3].map(i=>`<td><select id="t_t${i}" style="width:100%;padding:6px;border:1px solid var(--border);border-radius:4px;" onchange="calcTax()"><option value="new">新房</option><option value="old" selected>二手房</option></select></td>`).join('')}</tr>
          <tr><th>面积（㎡）</th>${[1,2,3].map(i=>`<td><input type="number" id="t_a${i}" value="${[98,92,110][i-1]}" style="width:100%;padding:6px;border:1px solid var(--border);border-radius:4px;" oninput="calcTax()"></td>`).join('')}</tr>
          <tr><th>是否首套</th>${[1,2,3].map(i=>`<td><select id="t_f${i}" style="width:100%;padding:6px;border:1px solid var(--border);border-radius:4px;" onchange="calcTax()"><option value="1" selected>是</option><option value="0">否</option></select></td>`).join('')}</tr>
          <tr><th>满二（二手）</th>${[1,2,3].map(i=>`<td><select id="t_2${i}" style="width:100%;padding:6px;border:1px solid var(--border);border-radius:4px;" onchange="calcTax()"><option value="1" selected>是</option><option value="0">否</option></select></td>`).join('')}</tr>
          <tr><th>满五唯一（二手）</th>${[1,2,3].map(i=>`<td><select id="t_w${i}" style="width:100%;padding:6px;border:1px solid var(--border);border-radius:4px;" onchange="calcTax()"><option value="0">否</option><option value="1" ${i===1?'selected':''}>是</option></select></td>`).join('')}</tr>
          <tr><th>中介费%（总）</th>${[1,2,3].map(i=>`<td><input type="number" id="t_ag${i}" step="0.1" value="2.4" style="width:100%;padding:6px;border:1px solid var(--border);border-radius:4px;" oninput="calcTax()"></td>`).join('')}</tr>
        </tbody>
      </table>
    </div>
    <div id="t_result" style="margin-top:16px;"></div>`;
  }
  function calcTax() {
    const results = [1,2,3].map(i => {
      const en = document.getElementById('t_en'+i).checked;
      if (!en) return null;
      const p = +document.getElementById('t_p'+i).value||0;
      const a = +document.getElementById('t_a'+i).value||0;
      const isOld = document.getElementById('t_t'+i).value === 'old';
      const first = document.getElementById('t_f'+i).value === '1';
      const full2 = document.getElementById('t_2'+i).value === '1';
      const w5 = document.getElementById('t_w'+i).value === '1';
      const ag = (+document.getElementById('t_ag'+i).value||0)/100;
      // 契税
      const deedR = !first ? 0.03 : (a<=90?0.01:0.015);
      const deed = p*deedR;
      const income = isOld && !w5 ? p*0.01 : 0;
      const vat = isOld && !full2 ? p*0.053 : 0;
      const repair = isOld ? 0 : a*120/10000;
      const agency = p*ag;
      const total = deed+income+vat+repair+agency+0.085;
      return {i, p, deed, deedR, income, vat, repair, agency, total};
    }).filter(Boolean);
    if (!results.length) { document.getElementById('t_result').innerHTML = ''; return; }
    // 最佳选择
    results.sort((a,b)=>a.total-b.total);
    const best = results[0];
    const html = `
      <div class="card">
        <div class="card-title">💰 税费对比结果</div>
        <div style="overflow-x:auto;">
        <table class="compare-table">
          <thead><tr><th>项目</th>${results.map(r=>`<th>房源 ${r.i}</th>`).join('')}</tr></thead>
          <tbody>
            <tr><th>房价</th>${results.map(r=>`<td class="${r.p===Math.min(...results.map(x=>x.p))?'best':''}">${r.p} 万</td>`).join('')}</tr>
            <tr><th>契税 (${(best.deedR*100).toFixed(1)}%)</th>${results.map(r=>`<td>${r.deed.toFixed(2)} 万</td>`).join('')}</tr>
            <tr><th>个人所得税</th>${results.map(r=>`<td style="${r.income===0?'color:var(--success);':''}">${r.income.toFixed(2)} 万 ${r.income===0?'✅满五唯一':''}</td>`).join('')}</tr>
            <tr><th>增值税及附加</th>${results.map(r=>`<td style="${r.vat===0?'color:var(--success);':''}">${r.vat.toFixed(2)} 万 ${r.vat===0?'✅满二':''}</td>`).join('')}</tr>
            <tr><th>维修基金</th>${results.map(r=>`<td>${r.repair.toFixed(2)} 万</td>`).join('')}</tr>
            <tr><th>中介费</th>${results.map(r=>`<td>${r.agency.toFixed(2)} 万</td>`).join('')}</tr>
            <tr style="background:var(--primary-soft);"><th>💡 合计税费+中介</th>${results.map(r=>`<td class="${r.i===best.i?'best':''}" style="font-weight:700;">${r.total.toFixed(2)} 万 (占比${(r.total/r.p*100).toFixed(1)}%)</td>`).join('')}</tr>
          </tbody>
        </table>
        </div>
        <div class="callout success" style="margin-top:14px;">
          <div class="callout-title">📌 推荐结论</div>
          <p style="font-size:13px;">从税费角度看，<strong>房源 ${best.i}</strong> 总成本最低（${best.total.toFixed(2)}万）。建议优先考虑<span style="color:var(--success)">满五唯一</span>的二手房，可免征个税${results.some(r=>r.vat===0)?'；满二可免征增值税':''}，税费差距最高可达 ${(Math.max(...results.map(r=>r.total))-Math.min(...results.map(r=>r.total))).toFixed(2)} 万元。</p>
        </div>
      </div>
    `;
    document.getElementById('t_result').innerHTML = html;
  }

  return { render, calcMonthly, calcMonthlyDown, calcMonthlyLoan, updateRateHint, calcFull, calcBargain, calcTax };
})();
