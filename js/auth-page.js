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
    document.getElementById('aSubmit').textContent = m === 'login' ? '登录' : '注册';
    document.getElementById('aSwitch').textContent = m === 'login' ? '立即注册' : '直接登录';
    document.getElementById('aSwitch').dataset.go = m === 'login' ? 'register' : 'login';
    document.getElementById('aPass').autocomplete = m === 'login' ? 'current-password' : 'new-password';
    // 标题区文案随模式切换（Apple 官网式）
    const t = document.getElementById('authTitle');
    const s = document.getElementById('authSub');
    if (t) t.textContent = m === 'login' ? '欢迎回来' : '创建您的账号';
    if (s) s.textContent = m === 'login' ? '登录后继续你的购房决策' : '新用户注册即送 20 次 AI 对话额度';
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

  async function submit(e) {
    e.preventDefault();
    const email = document.getElementById('aEmail').value;
    const pass  = document.getElementById('aPass').value;
    const name  = document.getElementById('aName').value;
    const city  = document.getElementById('aCity').value;
    const btn   = document.getElementById('aSubmit');
    if (mode === 'register' && !city) {
      showErr('请选择目前所在城市');
      CityPicker.open();
      return;
    }
    // 登录与注册均须勾选同意《服务条款》和《隐私政策》
    const terms = document.getElementById('aTerms');
    if (terms && !terms.checked) {
      showErr('请先阅读并同意《服务条款》和《隐私政策》');
      return;
    }
    btn.disabled = true;
    btn.textContent = mode === 'login' ? '正在登录...' : '正在注册...';
    hideErr();
    const res = mode === 'login'
      ? await AuthMod.login(email, pass)
      : await AuthMod.register(name, email, pass, city);
    if (!res.ok) {
      showErr(res.err);
      btn.disabled = false;
      btn.textContent = mode === 'login' ? '登录' : '注册';
      return;
    }
    location.replace('index.html');
  }

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
    initPassToggle();
    document.querySelectorAll('#authTabs .auth-tab').forEach(t => t.addEventListener('click', () => setMode(t.dataset.mode)));
    document.getElementById('aSwitch').addEventListener('click', () => setMode(document.getElementById('aSwitch').dataset.go));
    document.getElementById('authForm').addEventListener('submit', submit);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
