/* ============================================
   M2 购房期望档案模块
   ============================================ */
window.ExpectationMod = (function() {
  const MUST_HAVES_OPTIONS = ['必须有电梯','必须南北通透','必须近地铁','必须有学区','不接受顶楼和一楼','必须人车分流','必须满五唯一'];
  const TARGET_DATE_OPTIONS = ['1个月内','3个月内','半年内','1年内','1年以上'];

  function render() {
    const exp = Store.getExpectation();
    const html = `
      <div class="page-header">
        <div>
          <h2><span class="emoji">🎯</span>购房期望档案</h2>
          <p class="page-desc">定义购房标准，作为房源筛选、推荐和对比的基准线。修改后所有模块自动联动更新。</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-ghost btn-sm" onclick="ExpectationMod.resetDefault()">恢复默认</button>
          <button class="btn btn-primary btn-sm" onclick="ExpectationMod.save()">💾 保存档案</button>
        </div>
      </div>

      <div class="card" id="expForm">
        <div class="card-title">💰 预算与财务</div>
        <div class="form-grid">
          <div class="form-item">
            <label>总价预算范围（万元）</label>
            <div style="display:flex;gap:8px;align-items:center;">
              <input type="number" data-field="budgetMin" min="0" placeholder="最低">
              <span>—</span>
              <input type="number" data-field="budgetMax" min="0" placeholder="最高">
            </div>
          </div>
          <div class="form-item">
            <label>首付能力（万元）</label>
            <input type="number" data-field="downPayment" min="0" placeholder="可用于首付的现金">
          </div>
          <div class="form-item">
            <label>是否需要贷款</label>
            <select data-field="needLoan">
              <option value="true">是</option>
              <option value="false">否</option>
            </select>
          </div>
          <div class="form-item">
            <label>贷款类型</label>
            <select data-field="loanType">
              <option>首套</option><option>二套</option>
            </select>
          </div>
          <div class="form-item">
            <label>贷款金额（万元）</label>
            <input type="number" data-field="loanAmount" min="0">
          </div>
          <div class="form-item">
            <label>月供承受上限（元/月）</label>
            <input type="number" data-field="monthlyPaymentMax" min="0">
          </div>
        </div>

        <div class="form-section-title">🏠 房型与面积</div>
        <div class="form-grid-4">
          <div class="form-item">
            <label>房型：室</label>
            <input type="number" data-field="roomsNeeded.bedrooms" min="1" max="10">
          </div>
          <div class="form-item">
            <label>厅</label>
            <input type="number" data-field="roomsNeeded.livingRooms" min="0" max="10">
          </div>
          <div class="form-item">
            <label>卫</label>
            <input type="number" data-field="roomsNeeded.bathrooms" min="0" max="10">
          </div>
          <div class="form-item">
            <label>房屋类型偏好</label>
            <select data-field="propertyPreference">
              <option>都接受</option><option>新房</option><option>二手房</option>
            </select>
          </div>
          <div class="form-item">
            <label>最小面积（㎡）</label>
            <input type="number" data-field="areaMin" min="0">
          </div>
          <div class="form-item">
            <label>最大面积（㎡）</label>
            <input type="number" data-field="areaMax" min="0">
          </div>
        </div>

        <div class="form-section-title">✅ 硬性要求（多选）</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;" id="mustHavesBox">
          ${MUST_HAVES_OPTIONS.map(v=>`<label style="display:flex;align-items:center;gap:6px;padding:8px 10px;border:1px solid var(--border);border-radius:6px;cursor:pointer;">
            <input type="checkbox" data-checkbox="mustHaves" value="${v}"> <span>${v}</span></label>`).join('')}
        </div>

        <div class="form-section-title">📍 区域与通勤</div>
        <div class="form-grid">
          <div class="form-item full">
            <label>意向区域（可多选，按优先级排列）</label>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:8px;" id="districtsBox">
              ${Store.DISTRICTS.map(d=>`<label style="display:flex;align-items:center;gap:5px;padding:6px 10px;border:1px solid var(--border);border-radius:6px;cursor:pointer;">
                <input type="checkbox" data-checkbox="preferredDistricts" value="${d}"> <span>${d}</span></label>`).join('')}
            </div>
          </div>
          <div class="form-item">
            <label>工作地点</label>
            <input type="text" data-field="workplace" placeholder="如：新街口XX大厦">
          </div>
          <div class="form-item">
            <label>伴侣工作地点（可选）</label>
            <input type="text" data-field="partnerWorkplace" placeholder="可选">
          </div>
          <div class="form-item">
            <label>可接受单程通勤时长（分钟）</label>
            <input type="number" data-field="maxCommuteTime" min="0" max="240">
          </div>
        </div>

        <div class="form-section-title">📅 时间与装修</div>
        <div class="form-grid">
          <div class="form-item">
            <label>预计购房时间</label>
            <select data-field="targetDate">
              ${TARGET_DATE_OPTIONS.map(o=>`<option>${o}</option>`).join('')}
            </select>
          </div>
          <div class="form-item">
            <label>期望入住时间</label>
            <input type="text" data-field="moveInDate" placeholder="如：婚后 / 年底前 / 2027年6月">
          </div>
          <div class="form-item">
            <label>装修预算（万元）</label>
            <input type="number" data-field="renovationBudget" min="0">
          </div>
          <div class="form-item full">
            <label>其他备注</label>
            <textarea data-field="notes" placeholder="如：需要老人居住方便、考虑未来二胎、层高要高于2.8米等"></textarea>
          </div>
        </div>

        <div class="form-section-title">⚖️ 智能评分权重（总和建议100）</div>
        <div id="weightsBox">
          <div class="weight-row">
            <div class="w-label">预算匹配</div>
            <input type="range" min="0" max="50" data-field="weights.budget">
            <div class="w-value"><span class="w-v">25</span>%</div>
          </div>
          <div class="weight-row">
            <div class="w-label">户型面积</div>
            <input type="range" min="0" max="50" data-field="weights.layout">
            <div class="w-value"><span class="w-v">20</span>%</div>
          </div>
          <div class="weight-row">
            <div class="w-label">通勤距离</div>
            <input type="range" min="0" max="50" data-field="weights.commute">
            <div class="w-value"><span class="w-v">15</span>%</div>
          </div>
          <div class="weight-row">
            <div class="w-label">配套教育</div>
            <input type="range" min="0" max="50" data-field="weights.facility">
            <div class="w-value"><span class="w-v">15</span>%</div>
          </div>
          <div class="weight-row">
            <div class="w-label">个人观后感</div>
            <input type="range" min="0" max="50" data-field="weights.impression">
            <div class="w-value"><span class="w-v">15</span>%</div>
          </div>
          <div class="weight-row">
            <div class="w-label">区域发展潜力</div>
            <input type="range" min="0" max="50" data-field="weights.potential">
            <div class="w-value"><span class="w-v">10</span>%</div>
          </div>
          <p style="text-align:right;color:var(--text-3);font-size:12px;margin-top:6px;">
            权重总计：<strong id="weightSum" style="color:var(--primary)">100</strong>%
          </p>
        </div>
      </div>
    `;
    App.setContent(html);
    Utils.fillForm(document.getElementById('expForm'), {
      ...exp, needLoan: exp.needLoan ? 'true' : 'false'
    });
    Utils.fillCheckboxes(document.getElementById('mustHavesBox'), 'mustHaves', exp.mustHaves || []);
    Utils.fillCheckboxes(document.getElementById('districtsBox'), 'preferredDistricts', exp.preferredDistricts || []);

    // 权重滑块联动
    document.querySelectorAll('#weightsBox input[type="range"]').forEach(r => {
      const vSpan = r.closest('.weight-row').querySelector('.w-v');
      vSpan.textContent = r.value;
      r.addEventListener('input', () => {
        vSpan.textContent = r.value;
        updateWeightSum();
      });
    });
    updateWeightSum();
  }

  function updateWeightSum() {
    let sum = 0;
    document.querySelectorAll('#weightsBox input[type="range"]').forEach(r => sum += Number(r.value));
    document.getElementById('weightSum').textContent = sum;
  }

  function save() {
    const form = document.getElementById('expForm');
    const data = Utils.collectForm(form);
    if (data.needLoan) data.needLoan = (data.needLoan === 'true');
    if (data.roomsNeeded) {
      data.roomsNeeded = {
        bedrooms: Number(data.roomsNeeded.bedrooms)||3,
        livingRooms: Number(data.roomsNeeded.livingRooms)||2,
        bathrooms: Number(data.roomsNeeded.bathrooms)||1,
      };
    }
    data.mustHaves = Utils.collectCheckboxes(form, 'mustHaves');
    data.preferredDistricts = Utils.collectCheckboxes(form, 'preferredDistricts');
    Store.saveExpectation(data);
    Utils.toast('购房期望档案已保存', 'success');
  }

  function resetDefault() {
    Utils.openModal({
      title: '确认恢复默认？',
      body: '<p>将恢复档案为推荐默认值，当前填写的内容将丢失。</p>',
      footer: `<button class="btn btn-ghost" onclick="Utils.closeModal()">取消</button>
        <button class="btn btn-danger" onclick="ExpectationMod.doReset()">确认恢复</button>`,
      size: 'sm',
    });
  }
  function doReset() {
    localStorage.removeItem(Store.KEYS.expectation);
    Utils.closeModal();
    render();
    Utils.toast('已恢复默认期望档案', 'success');
  }

  return { render, save, resetDefault, doReset };
})();
