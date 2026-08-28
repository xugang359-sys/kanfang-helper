/* ============================================
   登录门户交互：模式切换 / 表单提交 / 登录守卫
   ============================================ */
window.AuthPage = (function() {
  let mode = 'login';

  function setMode(m) {
    mode = m;
    document.querySelectorAll('#authTabs .auth-tab').forEach(t => t.classList.toggle('on', t.dataset.mode === m));
    document.getElementById('nameField').style.display = m === 'register' ? '' : 'none';
    document.getElementById('cityField').style.display = m === 'register' ? '' : 'none';
    const quota = document.getElementById('authQuota');
    if (quota) quota.style.display = m === 'register' ? '' : 'none';
    document.getElementById('aSubmit').textContent = m === 'login' ? '登录' : '注册';
    document.getElementById('aFootPre').textContent = m === 'login' ? '还没有账号？' : '已有帐号，';
    document.getElementById('aSwitch').textContent = m === 'login' ? '立即注册' : '直接登录';
    document.getElementById('aSwitch').dataset.go = m === 'login' ? 'register' : 'login';
    document.getElementById('aPass').autocomplete = m === 'login' ? 'current-password' : 'new-password';
    // 标题随模式切换（Apple 官网式）
    const t = document.getElementById('authTitle');
    if (t) t.textContent = m === 'login' ? '欢迎回来' : '创建您的账号';
    // 切换模式时清空输入，避免登录凭据/注册信息互相串页
    document.querySelectorAll('#authForm input').forEach(inp => { if (inp.type !== 'checkbox') inp.value = ''; });
    const citySel = document.getElementById('aCity');
    if (citySel) citySel.value = '';
    const cityClear = document.getElementById('cityInputClear');
    if (cityClear) cityClear.hidden = true;
    hideErr();
  }

  // 城市下拉：按省份分组（数据源与系统内 Store.CITIES 一致，注册后绑定为默认城市）
  function renderCities() {
    const sel = document.getElementById('aCity');
    if (!sel || !window.Store || !Store.PROVINCES) return;
    sel.innerHTML = `<option value="" disabled selected>请选择所在城市</option>` +
      Object.entries(Store.PROVINCES).map(([prov, cities]) =>
        `<optgroup label="${prov}">${cities.map(c => `<option value="${c}">${c}</option>`).join('')}</optgroup>`
      ).join('');
  }

  // 城市自动补全输入框：输入时智能匹配城市，支持键盘导航
  const CityPicker = {
    init() {
      this.input = document.getElementById('cityInput');
      this.pop = document.getElementById('cityPop');
      this.clearBtn = document.getElementById('cityInputClear');
      this.sel = document.getElementById('aCity');
      if (!this.input || !this.pop) return;
      this.populateAll();
      this.input.addEventListener('input', () => this.onInput());
      this.input.addEventListener('focus', () => { this.onInput(); this.open(); });
      this.input.addEventListener('keydown', e => this.onKeyDown(e));
      this.input.addEventListener('blur', () => setTimeout(() => this.close(), 150));
      this.clearBtn.addEventListener('click', () => {
        this.input.value = '';
        this.clearBtn.hidden = true;
        this.sel.value = '';
        this.onInput();
        this.input.focus();
      });
      this.pop.addEventListener('mousedown', e => {
        const item = e.target.closest('.city-pop-item');
        if (item) { e.preventDefault(); this.choose(item.dataset.city); }
      });
      document.addEventListener('click', e => {
        if (!this.input.contains(e.target) && !this.pop.contains(e.target)) this.close();
      });
    },
    populateAll() {
      const all = [];
      Object.entries(Store.PROVINCES || {}).forEach(([prov, cities]) => {
        cities.forEach(c => all.push({ city: c, prov }));
      });
      this.allCities = all;
      this.renderList(all);
    },
    renderList(items) {
      this.pop.innerHTML = '';
      if (!items.length) {
        this.pop.innerHTML = '<div class="city-pop-empty">未找到匹配城市</div>';
        return;
      }
      // 按省份分组
      const groups = {};
      items.forEach(({ city, prov }) => {
        if (!groups[prov]) groups[prov] = [];
        groups[prov].push(city);
      });
      const html = Object.entries(groups).map(([prov, cities], gi) => {
        return `<div class="city-pop-group${gi ? ' is-sub' : ''}">${prov}</div>` +
          cities.map(c => `<div class="city-pop-item" data-city="${c}" role="option">${c}<svg class="city-pop-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg></div>`).join('');
      }).join('');
      this.pop.innerHTML = `<div class="city-pop-list">${html}</div>`;
      this.syncOn();
    },
    onInput() {
      const kw = this.input.value.trim();
      this.clearBtn.hidden = !kw;
      if (!kw) {
        this.sel.value = '';
        this.renderList(this.allCities);
        return;
      }
      const hits = this.allCities.filter(({ city, prov }) =>
        city.includes(kw) || prov.includes(kw)
      );
      this.renderList(hits);
      // 输入变化时清空已选值，防止用无效文本注册
      this.sel.value = '';
    },
    onKeyDown(e) {
      const items = this.pop.querySelectorAll('.city-pop-item');
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (!this.activeIdx) this.activeIdx = -1;
        this.activeIdx = (this.activeIdx + 1) % items.length;
        this.highlight(items);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (!this.activeIdx) this.activeIdx = items.length;
        this.activeIdx = (this.activeIdx - 1 + items.length) % items.length;
        this.highlight(items);
      } else if (e.key === 'Enter') {
        const highlighted = this.pop.querySelector('.city-pop-item.hover');
        if (highlighted) { e.preventDefault(); this.choose(highlighted.dataset.city); }
      } else if (e.key === 'Escape') {
        if (this.input.value) { this.input.value = ''; this.onInput(); }
        else this.close();
      }
    },
    highlight(items) {
      items.forEach((it, i) => it.classList.toggle('hover', i === this.activeIdx));
      const hovered = items[this.activeIdx];
      if (hovered) hovered.scrollIntoView({ block: 'nearest' });
    },
    open() { this.pop.classList.add('show'); },
    close() {
      // 失焦时验证：如果输入值不是有效城市，自动清空
      const val = this.input.value.trim();
      if (val) {
        const valid = this.allCities.some(({ city }) => city === val);
        if (!valid) {
          this.input.value = '';
          this.clearBtn.hidden = true;
          this.sel.value = '';
        }
      }
      this.pop.classList.remove('show');
      this.activeIdx = -1;
    },
    choose(city) {
      this.input.value = city;
      this.sel.value = city;
      this.clearBtn.hidden = false;
      this.close();
      this.input.blur();
    },
    set(city) {
      this.input.value = city;
      this.sel.value = city;
      this.clearBtn.hidden = false;
    },
    syncOn() {
      const items = this.pop.querySelectorAll('.city-pop-item');
      items.forEach(it => it.classList.toggle('on', it.dataset.city === this.sel.value));
    }
  };

  function showErr(msg) {
    const el = document.getElementById('aErr');
    el.textContent = msg;
    el.classList.add('show');
  }
  function hideErr() {
    const el = document.getElementById('aErr');
    el.textContent = '';
    el.classList.remove('show');
  }
  // 统一控制提交按钮忙碌/空闲态
  function setBusy(on, label) {
    const btn = document.getElementById('aSubmit');
    if (!btn) return;
    btn.disabled = on;
    btn.textContent = label;
  }

  async function submit(e) {
    e.preventDefault();
    const email = document.getElementById('aEmail').value;
    const pass  = document.getElementById('aPass').value;
    const name  = document.getElementById('aName').value;
    let city  = document.getElementById('aCity').value;
    // 城市兜底：隐藏下拉未写入（如输入完整城市名后未点选）时，若输入框为有效城市则自动补选
    if (mode === 'register') {
      const cv = document.getElementById('cityInput').value.trim();
      if (cv && CityPicker.allCities && CityPicker.allCities.some(({ city: c }) => c === cv)) {
        city = cv;
        document.getElementById('aCity').value = cv;
      }
    }
    if (mode === 'register' && !city) {
      showErr('请选择目前所在城市');
      return;
    }
    // 必填校验：通过后才进入服务端预验证与协议确认弹窗
    const vmsg = validateFields(email, pass, name, city);
    if (vmsg) { showErr(vmsg); return; }
    hideErr();
    // 服务端预验证：登录校验邮箱已注册且密码正确；注册校验邮箱未被占用（通过后才弹协议框）
    setBusy(true, '验证中…');
    const vr = await AuthMod.verify(email, pass, mode === 'register' ? 'register' : 'login');
    setBusy(false, mode === 'login' ? '登录' : '注册');
    if (!vr.ok) { showErr(vr.err); return; }
    // 未勾选同意时，弹 Apple 风格确认框；确认后自动勾选并继续
    const terms = document.getElementById('aTerms');
    if (terms && !terms.checked) {
      TermsConfirm.open(() => {
        terms.checked = true;
        doAuth(email, pass, name, city);
      });
      return;
    }
    await doAuth(email, pass, name, city);
  }

  // 必填字段校验（弹窗前置：先校验，后提示协议确认）
  function validateFields(email, pass, name, city) {
    const isReg = mode === 'register';
    if (isReg && !name.trim()) return '请输入昵称';
    if (!email.trim()) return '请输入邮箱信息';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return '请输入正确的邮箱格式';
    if (!pass) return '请输入密码';
    if (pass.length < 6) return '密码至少 6 位';
    return '';
  }

  async function doAuth(email, pass, name, city) {
    setBusy(true, mode === 'login' ? '正在登录...' : '正在注册...');
    hideErr();
    const res = mode === 'login'
      ? await AuthMod.login(email, pass)
      : await AuthMod.register(name, email, pass, city);
    if (!res.ok) {
      showErr(res.err);
      setBusy(false, mode === 'login' ? '登录' : '注册');
      return;
    }
    location.replace('index.html');
  }

  // 协议确认弹窗（Apple 风格 Alert：毛玻璃遮罩 + 居中卡片 + 弹簧入场）
  const TermsConfirm = {
    el: null, ok: null, cancel: null, onDone: null,
    init() {
      this.el = document.getElementById('termsMask');
      this.ok = document.getElementById('termsOk');
      this.cancel = document.getElementById('termsCancel');
      if (!this.el || !this.ok || !this.cancel) return;
      this.ok.addEventListener('click', () => {
        const fn = this.onDone;
        this.close();
        if (fn) fn();
      });
      this.cancel.addEventListener('click', () => this.close());
      document.addEventListener('keydown', (ev) => {
        if (this.el.hidden) return;
        if (ev.key === 'Escape') { ev.preventDefault(); this.close(); }
      });
    },
    open(onDone) {
      if (!this.el) { if (onDone) onDone(); return; }
      this.onDone = onDone;
      this.el.hidden = false;
      requestAnimationFrame(() => this.el.classList.add('show'));
      this.ok.focus();
    },
    close() {
      if (!this.el || this.el.hidden) return;
      this.el.classList.remove('show');
      this.onDone = null;
      setTimeout(() => { this.el.hidden = true; }, 220);
    }
  };

  // 密码可见性切换（Apple 官网式小眼睛）
  function bindPassToggle(btn, input) {
    if (!btn || !input) return;
    btn.addEventListener('click', () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.classList.toggle('showing', show);
      btn.setAttribute('aria-pressed', String(show));
      btn.setAttribute('aria-label', show ? '隐藏密码' : '显示密码');
      input.focus();
    });
  }
  function initPassToggle() {
    const btn = document.getElementById('aPassToggle');
    const input = document.getElementById('aPass');
    bindPassToggle(btn, input);
  }

  function boot() {
    // 已登录则直接进入系统
    if (AuthMod.isLoggedIn()) { location.replace('index.html'); return; }
    renderCities();
    CityPicker.init();
    TermsConfirm.init();
    initPassToggle();
    document.querySelectorAll('#authTabs .auth-tab').forEach(t => t.addEventListener('click', () => setMode(t.dataset.mode)));
    document.getElementById('aSwitch').addEventListener('click', () => setMode(document.getElementById('aSwitch').dataset.go));
    document.getElementById('authForm').addEventListener('submit', submit);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
