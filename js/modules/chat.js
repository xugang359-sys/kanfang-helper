/* ============================================
   AI 购房助手 · ChatGPT 风格对话界面
   全局悬浮按钮入口 + 独立菜单页面
   支持多会话：新建 / 回看 / 删除对话记录
   ============================================ */
window.ChatMod = (function() {
  const ic = Utils.icon;
  // 会话存储按账号隔离：每个注册用户只读取/写入自己的操作记录（本地 key 以邮箱区分）
  function curEmail() {
    try { return (window.AuthMod && AuthMod.currentUser() && AuthMod.currentUser().email) || 'guest'; }
    catch(e) { return 'guest'; }
  }
  function storeKey() { return 'house_hunter_chat_sessions_' + curEmail(); }
  function activeKey() { return 'house_hunter_chat_active_' + curEmail(); }
  let messages = [];     // 当前会话的消息
  let sessions = [];     // 全部会话 [{id,title,createdAt,updatedAt,messages}]
  let activeId = null;   // 当前会话 id
  let historyOpen = false; // 历史记录面板是否展开
  let sending = false;

  // 系统提示词 — 让AI扮演购房顾问角色
  const ASSISTANT_NAME = '贾维斯';
  const SYSTEM_PROMPT = `你是"${ASSISTANT_NAME}"，用户的专属 AI 购房管家。你的职责：
1. 帮用户分析房源优劣势、对比多套房、解读周边配套
2. 基于用户提供的购房期望和已看房源数据，给出个性化建议
3. 回答购房流程、贷款、税费、学区等问题
4. 回复要求：语言简洁专业，用中文；内容紧凑，多用短句；分点一律用「-」或「1.」列表形式，不要逐行堆叠短句；不要使用 emoji；段落之间最多空一行，不要留大段空白
5. 如果用户的问题超出购房领域，礼貌引导回购房话题
6. 不提供具体的法律/金融承诺，建议用户咨询专业人士`;

  // 快捷问题（含城市占位 {{city}}，点击时按右上角设置的省份/城市动态生成）
  const QUICK_PROMPTS = [
    { icon: 'house',   text: '帮我分析已看房源',  prompt: '根据我已记录的房源数据，帮我分析哪套最值得考虑，优劣势分别是什么？' },
    { icon: 'map',     text: '推荐适合的板块',     prompt: '根据我的购房预算和通勤需求，推荐几个适合的{{city}}板块并分析原因？' },
    { icon: 'calc',    text: '贷款方案怎么选',     prompt: '首套房贷款，等额本息和等额本金哪个更划算？帮我分析利弊。' },
    { icon: 'sparkle', text: '买房流程是什么',     prompt: '{{city}}买房的完整流程是什么？从看房到领证每一步要注意什么？' },
  ];
  // 按右上角当前城市生成具体提问
  function quickPrompt(q) {
    return q.prompt.replace(/\{\{city\}\}/g, Store.getCity());
  }

  // ===== 会话存储 =====
  function genId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function makeTitle(msgs) {
    const first = (msgs || []).find(m => m.role === 'user');
    const raw = (first ? first.content : '').trim().replace(/\s+/g, ' ');
    return raw ? (raw.length > 24 ? raw.slice(0, 24) + '…' : raw) : '新对话';
  }

  function loadSessions() {
    try { sessions = JSON.parse(localStorage.getItem(storeKey()) || '[]'); }
    catch(e) { sessions = []; }
    if (!Array.isArray(sessions)) sessions = [];
    // 迁移旧版单会话数据（旧 key 是浏览器全局共享，仅首次进入新账号时兜底迁移一次）
    if (!sessions.length) {
      try {
        const old = JSON.parse(localStorage.getItem('house_hunter_chat_history') || 'null');
        if (Array.isArray(old) && old.length) {
          sessions = [{ id: genId(), title: makeTitle(old), createdAt: Date.now(), updatedAt: Date.now(), messages: old }];
          localStorage.removeItem('house_hunter_chat_history');
        }
      } catch(e) {}
    }
    // 恢复当前会话（优先上次活跃，否则最后一个）
    const lastActive = localStorage.getItem(activeKey());
    activeId = sessions.find(s => s.id === lastActive) ? lastActive : (sessions.length ? sessions[sessions.length - 1].id : null);
    const cur = activeSession();
    messages = cur ? cur.messages : [];
  }

  function activeSession() {
    return sessions.find(s => s.id === activeId) || null;
  }

  function saveSessions() {
    // 把当前 messages 同步回会话
    const cur = activeSession();
    if (cur) {
      cur.messages = messages;
      cur.updatedAt = Date.now();
      // 空标题或仍为占位标题时，用首条用户消息自动生成
      if (!cur.title || cur.title === '新对话') {
        const t = makeTitle(messages);
        if (t !== '新对话') cur.title = t;
      }
    }
    // 清理：仅保留当前会话与有对话内容的会话（未输入内容的空"新对话"不累积为记录）
    sessions = sessions.filter(s => s.id === activeId || (s.messages && s.messages.length > 0));
    localStorage.setItem(storeKey(), JSON.stringify(sessions));
    if (activeId) localStorage.setItem(activeKey(), activeId);
  }

  function relTime(ts) {
    if (!ts) return '';
    const d = new Date(ts), now = new Date();
    const pad = n => String(n).padStart(2, '0');
    if (d.toDateString() === now.toDateString()) return '今天 ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    const yest = new Date(now); yest.setDate(now.getDate() - 1);
    if (d.toDateString() === yest.toDateString()) return '昨天';
    if (d.getFullYear() === now.getFullYear()) return (d.getMonth() + 1) + '-' + d.getDate();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  // 聊天是否可用：普通注册用户走后端代理（服务端统一维护 Key，按次计费），无需本地 Key；仅管理员需要本地 Key
  function chatEnabled() {
    if (window.AuthMod && AuthMod.isLoggedIn() && !AuthMod.isAdmin()) return true;
    return !!(Utils.getApiKeys() || {}).llm;
  }

  // ===== 渲染 =====
  function render() {
    loadSessions();
    const hasLLM = chatEnabled();
    const welcomeHTML = `
      <div class="chat-welcome">
        <div class="chat-welcome-icon">${ic('sparkle', 48)}</div>
        <h2>Hi，我叫${ASSISTANT_NAME}！</h2>
        <p>你的专属 AI 购房管家，问我任何购房问题——房源分析、板块对比、贷款计算、购房流程</p>
        <div class="chat-quick-grid">
          ${QUICK_PROMPTS.map((q, i) => `
            <button class="chat-quick-card" onclick="ChatMod.sendQuick(${i})">
              <span class="chat-quick-icon">${ic(q.icon, 20)}</span>
              <span class="chat-quick-text">${q.text}</span>
            </button>
          `).join('')}
        </div>
      </div>
    `;

    const messagesHTML = messages.length === 0 ? welcomeHTML :
      messages.map(m => renderMessage(m)).join('');

    const html = `
      <div class="chat-page">
        <div class="chat-container">
          <div class="chat-header">
            <div class="chat-header-left">
              <div class="chat-header-info">
                <span class="chat-header-avatar">${ic('sparkle', 22)}</span>
                <div>
                  <div class="chat-header-title">${ASSISTANT_NAME}</div>
                  <div class="chat-header-sub">${hasLLM ? '已连接 · 你的专属购房管家' : '未配置 API · 点击设置'}</div>
                </div>
              </div>
            </div>
            <div class="chat-header-right">
              <button class="chat-quota-pill" id="chatQuota" onclick="ChatMod.openRechargeModal()" title="AI 对话剩余额度 · 点击查看 / 充值">
                <span class="chat-quota-ico">${ic('bolt', 13)}</span>
                <span class="chat-quota-txt">额度加载中…</span>
              </button>
              <!-- 清空按钮始终渲染（无消息时禁用），避免动态插入导致顶栏按钮位置跳变 -->
              <button class="btn btn-ghost btn-sm chat-clear-btn" id="chatClearBtn" onclick="ChatMod.clearHistory()" ${messages.length === 0 ? 'disabled' : ''} title="清空当前对话">${ic('trash', 14)} 清空</button>
              <button class="chat-icon-btn" onclick="ChatMod.newSession()" title="新建对话">${ic('plus', 18)}</button>
              <button class="chat-icon-btn" onclick="ChatMod.toggleSider()" title="对话记录">${ic('menu', 18)}</button>
            </div>
          </div>

          <div class="chat-body" id="chatBody">
            ${messagesHTML}
          </div>

          <div class="chat-input-area">
            <div class="chat-input-row">
              <textarea id="chatInput" class="chat-input" placeholder="问我任何购房问题…  (Enter 发送, Shift+Enter 换行)"
                rows="1" oninput="ChatMod.autoResize(this)" onkeydown="ChatMod.onKeydown(event)"></textarea>
              <button class="chat-send-btn" id="chatSendBtn" onclick="ChatMod.sendFromInput()" ${!hasLLM ? 'disabled' : ''}>
                ${ic('send', 20)}
              </button>
            </div>
          </div>

          ${drawerHTML()}
        </div>
      </div>
    `;
    App.setContent(html);
    syncDrawer();
    renderQuota();
  }

  // ===== 额度展示（头部徽章） =====
  // 读取后端实时额度并刷新头部徽章；额度低时高亮警示
  async function renderQuota() {
    const el = document.getElementById('chatQuota');
    if (!el) return;
    const q = await Utils.fetchQuota();
    if (!q) return;
    const txt = el.querySelector('.chat-quota-txt');
    if (!txt) return;
    if (q.unlimited) {
      txt.textContent = '无限额度';
      el.classList.remove('low', 'out');
    } else {
      txt.textContent = '剩余 ' + q.remain + ' 次';
      el.classList.toggle('low', q.remain > 0 && q.remain <= 5);
      el.classList.toggle('out', q.remain <= 0);
    }
  }

  // 对话后 / 充值成功后同步刷新本页徽章与右上角徽章
  function refreshQuotaAll() {
    renderQuota();
    if (window.App && typeof App.refreshTopbarQuota === 'function') App.refreshTopbarQuota();
  }

  // 对话记录面板：对话面板内部从右侧弹出的覆盖层
  function drawerHTML() {
    return `
      <aside class="chat-history ${historyOpen ? 'open' : ''}">
        <div class="chat-sider-head">
          <span class="chat-sider-head-title">对话记录</span>
          <button class="chat-icon-btn" onclick="ChatMod.toggleSider()" title="收起">${ic('x', 16)}</button>
        </div>
        <button class="chat-new-btn" onclick="ChatMod.newSession()">${ic('plus', 16)} 新建对话</button>
        <div class="chat-sider-list"></div>
      </aside>
    `;
  }

  function syncDrawer() {
    const drawer = document.querySelector('.chat-container .chat-history');
    if (!drawer) return;
    // 按更新时间分组：今天 / 最近 7 天 / 更早
    const groups = [
      { label: '今天', items: [] },
      { label: '最近 7 天', items: [] },
      { label: '更早', items: [] },
    ];
    const now = Date.now(), day = 86400000;
    // 仅展示有对话内容的会话（未输入/未开始对话的空会话不记录）
    const shown = sessions.filter(s => s.messages && s.messages.length > 0);
    shown.forEach(s => {
      const ts = s.updatedAt || s.createdAt || 0;
      const diff = now - ts;
      const g = diff <= day ? groups[0] : diff <= 7 * day ? groups[1] : groups[2];
      g.items.push(s);
    });
    groups.forEach(g => g.items.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)));
    const listHTML = groups.map(g => {
      if (!g.items.length) return '';
      return `<div class="chat-sider-group">${g.label}</div>` + g.items.map(siderItem).join('');
    }).join('');
    drawer.querySelector('.chat-sider-list').innerHTML =
      shown.length ? listHTML : '<div class="chat-sider-empty">暂无对话记录，点击上方「新建对话」开始</div>';
    drawer.classList.toggle('open', historyOpen);
  }

  function closeDrawer() {
    historyOpen = false;
    const drawer = document.querySelector('.chat-container .chat-history');
    if (drawer) drawer.classList.remove('open');
  }

  // 对话记录面板打开时：点击面板外任意位置自动收起（面板内操作与开关按钮不误触）
  document.addEventListener('click', (e) => {
    if (!historyOpen) return;
    const drawer = document.querySelector('.chat-container .chat-history');
    if (!drawer) return;
    if (drawer.contains(e.target)) return;                    // 面板内部操作不关闭
    if (e.target.closest('[onclick*="toggleSider"]')) return; // 对话记录开关按钮不误触
    closeDrawer();
  });

  function siderItem(s) {
    return `
      <button class="chat-sider-item ${s.id === activeId ? 'active' : ''}" onclick="ChatMod.switchSession('${s.id}')">
        <span class="chat-sider-item-title">${escapeHTML(s.title)}</span>
        <span class="chat-sider-item-meta">
          <span class="chat-sider-item-time">${relTime(s.updatedAt)}</span>
          <span class="chat-sider-del" title="删除该对话" onclick="event.stopPropagation();ChatMod.delSession('${s.id}')">${ic('trash', 12)}</span>
        </span>
      </button>
    `;
  }

  // ===== 会话操作 =====
  function toggleSider() {
    historyOpen = !historyOpen;
    syncDrawer();
  }

  function newSession() {
    const id = genId();
    sessions.push({ id, title: '新对话', createdAt: Date.now(), updatedAt: Date.now(), messages: [] });
    activeId = id;
    messages = [];
    historyOpen = false; // 新建后收起对话记录面板
    saveSessions();
    render();
  }

  function switchSession(id) {
    const s = sessions.find(x => x.id === id);
    if (!s) return;
    activeId = id;
    messages = s.messages;
    historyOpen = false; // 切换会话后收起对话记录面板
    saveSessions();
    render();
  }

  function delSession(id) {
    const s = sessions.find(x => x.id === id);
    if (!s) return;
    Utils.openModal({
      title: '删除该对话？', size: 'sm',
      body: `<p style="font-size:13px;color:var(--text-2);">将删除对话「${escapeHTML(s.title)}」，此操作不可撤销。</p>`,
      footer: `<button class="btn btn-ghost" onclick="Utils.closeModal()">取消</button>
        <button class="btn btn-danger" onclick="ChatMod.doDelSession('${id}')">删除</button>`
    });
  }

  function doDelSession(id) {
    sessions = sessions.filter(x => x.id !== id);
    if (activeId === id) {
      activeId = sessions.length ? sessions[sessions.length - 1].id : null;
      const cur = activeSession();
      messages = cur ? cur.messages : [];
    }
    saveSessions();
    Utils.closeModal();
    render();
    Utils.toast('对话已删除', 'success');
  }

  function renderMessage(m) {
    if (m.role === 'user') {
      return `
        <div class="chat-msg chat-msg-user">
          <div class="chat-msg-bubble chat-msg-bubble-user">${escapeHTML(m.content)}</div>
        </div>
      `;
    }
    if (m.role === 'assistant') {
      return `
        <div class="chat-msg chat-msg-ai">
          <span class="chat-msg-avatar">${ic('sparkle', 18)}</span>
          <div class="chat-msg-content">
            <div class="chat-msg-name">${ASSISTANT_NAME}</div>
            <div class="chat-msg-bubble chat-msg-bubble-ai">${formatMarkdown(m.content)}</div>
          </div>
        </div>
      `;
    }
    if (m.role === 'error') {
      return `
        <div class="chat-msg chat-msg-ai">
          <span class="chat-msg-avatar">${ic('alert', 18)}</span>
          <div class="chat-msg-content">
            <div class="chat-msg-name">${ASSISTANT_NAME}</div>
            <div class="chat-msg-bubble chat-msg-bubble-error">${escapeHTML(m.content)}</div>
          </div>
        </div>
      `;
    }
    return '';
  }

  function renderTyping() {
    return `
      <div class="chat-msg chat-msg-ai" id="chatTyping">
        <span class="chat-msg-avatar">${ic('sparkle', 18)}</span>
        <div class="chat-msg-content">
          <div class="chat-msg-name">${ASSISTANT_NAME}</div>
          <div class="chat-msg-bubble chat-msg-bubble-ai chat-typing">
            <span class="chat-typing-dot"></span>
            <span class="chat-typing-dot"></span>
            <span class="chat-typing-dot"></span>
          </div>
        </div>
      </div>
    `;
  }

  async function send(text) {
    if (sending) return;
    const content = (text || '').trim();
    if (!content) return;

    // 未登录：AI 对话按账号计费，必须先登录
    if (!window.AuthMod || !AuthMod.isLoggedIn()) {
      Utils.toast('请先登录后使用 AI 对话', 'warn');
      location.replace('login.html');
      return;
    }
    // 普通用户强制走后端代理（额度计费、不泄露 Key）；管理员才需要本地 Key 或全局配置
    if (AuthMod.isAdmin()) {
      const keys = Utils.getApiKeys();
      if (!keys.llm) {
        Utils.toast('请先在系统设置中配置 AI 大模型 API', 'warn');
        App.navigate('settings');
        return;
      }
    }

    // 无当前会话时自动新建（保证首条消息也产生对话记录）
    if (!activeId || !activeSession()) {
      const id = genId();
      sessions.push({ id, title: '新对话', createdAt: Date.now(), updatedAt: Date.now(), messages: [] });
      activeId = id;
    }

    sending = true;
    updateSendBtn();

    // 添加用户消息
    messages.push({ role: 'user', content });
    saveSessions();
    appendToDOM({ role: 'user', content });
    clearInput();

    // 显示 typing 指示器
    appendTyping();

    // 构建上下文
    const contextData = Utils.collectContextForAI();
    // 项目规则：用户未明确指定城市/区域时，以右上角设置的省份/城市为默认参考
    const city = Store.getCity();
    const prov = Store.getProvinceOfCity(city);
    const cityRule = `\n\n【用户当前所在地区】省份：${prov}，城市：${city}。\n规则：如果用户没有明确指定城市或区域，请以上述省份/城市为默认参考给出回答；如果用户明确提到了其他城市/区域，则优先遵循用户指定的地区。`;
    const systemMsg = { role: 'system', content: SYSTEM_PROMPT + cityRule + (contextData ? '\n\n以下是用户当前数据，供你参考：\n' + contextData : '') };
    const apiMessages = [systemMsg, ...messages.filter(m => m.role !== 'error').slice(-20)];

    // 调用大模型
    const r = await Utils.callLLM(apiMessages, { max_tokens: 2000, temperature: 0.7 });

    removeTyping();
    if (r.ok) {
      messages.push({ role: 'assistant', content: r.reply });
      saveSessions();
      appendToDOM({ role: 'assistant', content: r.reply });
      refreshQuotaAll(); // 成功对话扣减 1 次额度，刷新头部与右上角徽章
    } else {
      const errMsg = r.err || 'AI 回复失败，请稍后重试';
      messages.push({ role: 'error', content: errMsg });
      saveSessions();
      appendToDOM({ role: 'error', content: errMsg });
      // 额度用尽：记录错误消息并弹出充值引导
      if (r.code === 'QUOTA_EXCEEDED') {
        setTimeout(() => openRechargeModal(), 350);
      }
    }

    // 显示/隐藏清空按钮
    refreshHeader();
    sending = false;
    updateSendBtn();
  }

  function sendFromInput() {
    const input = document.getElementById('chatInput');
    if (!input) return;
    send(input.value);
  }

  // 便捷问题：点击时按右上角当前城市动态生成提问并发送
  function sendQuick(i) {
    const q = QUICK_PROMPTS[i];
    if (!q) return;
    send(quickPrompt(q));
  }

  function clearHistory() {
    Utils.openModal({
      title: '清空当前对话？', size: 'sm',
      body: '<p style="font-size:13px;color:var(--text-2);">将删除当前这条对话记录，此操作不可撤销。</p>',
      footer: `<button class="btn btn-ghost" onclick="Utils.closeModal()">取消</button>
        <button class="btn btn-danger" onclick="ChatMod.doClear()">确认清空</button>`
    });
  }

  function doClear() {
    if (activeId) sessions = sessions.filter(x => x.id !== activeId);
    activeId = sessions.length ? sessions[sessions.length - 1].id : null;
    const cur = activeSession();
    messages = cur ? cur.messages : [];
    saveSessions();
    Utils.closeModal();
    render();
    Utils.toast('对话已清空', 'success');
  }

  // ===== 额度与充值 =====
  // 打开充值中心弹窗：额度展示 / 卡密兑换 / 人工充值申请
  async function openRechargeModal() {
    let q = {};
    try {
      const r = await SyncMod.api('quota');
      if (r && r.ok && r.quota) q = r.quota;
    } catch(e) {}
    const used = q.used || 0;
    const extra = q.extra || 0;
    const freeTotal = q.freeTotal || 0;
    const remain = (q.remain != null) ? q.remain : Math.max(0, freeTotal + extra - used);

    Utils.openModal({
      title: 'AI 对话额度',
      size: 'md',
      body: `
        <div class="recharge-wrap">
          <p class="recharge-tip">AI 对话按条计费，每发送一条消息消耗 1 次额度。余额不足时，可通过卡密兑换或提交人工充值申请（支持支付宝 / 微信转账，管理员审批后到账）。</p>
          <div class="quota-grid">
            <div class="quota-cell"><em>${used}</em><span>已用</span></div>
            <div class="quota-cell"><em>${extra}</em><span>充值</span></div>
            <div class="quota-cell"><em>${freeTotal}</em><span>免费</span></div>
            <div class="quota-cell quota-remain"><em>${remain}</em><span>剩余</span></div>
          </div>
          <div class="recharge-sec">
            <div class="recharge-sec-t">卡密兑换</div>
            <div class="recharge-code-row">
              <input id="rcCode" class="input" placeholder="请输入 16 位兑换码，如 XXXX-XXXX-XXXX-XXXX" maxlength="19">
              <button class="btn btn-primary" id="rcRedeemBtn">兑换</button>
            </div>
          </div>
          <div class="recharge-sec">
            <div class="recharge-sec-t">人工充值申请</div>
            <p class="recharge-note">转账后请填写下方信息提交申请，管理员审批通过后额度自动到账。</p>
            <div class="recharge-form">
              <div class="form-row">
                <input id="rcName" class="input" placeholder="你的称呼 / 昵称">
                <input id="rcContact" class="input" placeholder="联系方式（支付宝 / 微信 / 手机）">
              </div>
              <div class="form-row">
                <input id="rcAmount" class="input" type="number" min="1" placeholder="期望充值次数（如 50）">
              </div>
              <textarea id="rcNote" class="input" rows="2" placeholder="备注（选填，如转账流水号）"></textarea>
              <button class="btn btn-primary btn-block" id="rcReqBtn">提交申请</button>
            </div>
          </div>
        </div>
      `,
      footer: `<button class="btn btn-ghost" onclick="Utils.closeModal()">关闭</button>`,
      onOpen: () => {
        const codeEl = document.getElementById('rcCode');
        const redeemBtn = document.getElementById('rcRedeemBtn');
        const reqBtn = document.getElementById('rcReqBtn');
        redeemBtn.onclick = async () => {
          const code = (codeEl.value || '').trim().toUpperCase();
          if (!code) return Utils.toast('请输入兑换码', 'warn');
          redeemBtn.disabled = true;
          const r = await SyncMod.api('quota/redeem', { code }, 'POST');
          redeemBtn.disabled = false;
          if (r.ok) {
            Utils.toast('兑换成功，额度已到账', 'success');
            Utils.closeModal();
            refreshQuotaAll();
            setTimeout(() => openRechargeModal(), 250);
          } else {
            Utils.toast(r.err || '兑换失败，请检查兑换码', 'error');
          }
        };
        reqBtn.onclick = async () => {
          const name = (document.getElementById('rcName').value || '').trim();
          const contact = (document.getElementById('rcContact').value || '').trim();
          const amount = parseInt(document.getElementById('rcAmount').value, 10);
          const note = (document.getElementById('rcNote').value || '').trim();
          if (!name) return Utils.toast('请填写称呼', 'warn');
          if (!contact) return Utils.toast('请填写联系方式', 'warn');
          if (!amount || amount <= 0) return Utils.toast('请填写期望充值次数', 'warn');
          reqBtn.disabled = true;
          const r = await SyncMod.api('quota/request', { name, contact, note, amount }, 'POST');
          reqBtn.disabled = false;
          if (r.ok) {
            Utils.toast('申请已提交，请等待管理员审批', 'success');
            Utils.closeModal();
          } else {
            Utils.toast(r.err || '提交失败，请稍后重试', 'error');
          }
        };
      }
    });
  }

  // ===== DOM 辅助 =====
  function appendToDOM(msg) {
    const body = document.getElementById('chatBody');
    if (!body) return;
    // 如果是第一条消息（welcome还在），先清空
    if (body.querySelector('.chat-welcome')) body.innerHTML = '';
    body.insertAdjacentHTML('beforeend', renderMessage(msg));
    scrollToBottom();
  }

  function appendTyping() {
    const body = document.getElementById('chatBody');
    if (!body) return;
    if (body.querySelector('.chat-welcome')) body.innerHTML = '';
    body.insertAdjacentHTML('beforeend', renderTyping());
    scrollToBottom();
  }

  function removeTyping() {
    const el = document.getElementById('chatTyping');
    if (el) el.remove();
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      const body = document.getElementById('chatBody');
      if (body) body.scrollTop = body.scrollHeight;
    });
  }

  function updateSendBtn() {
    const btn = document.getElementById('chatSendBtn');
    if (!btn) return;
    btn.disabled = sending || !Utils.getApiKeys().llm;
    btn.classList.toggle('sending', sending);
  }

  function refreshHeader() {
    // 清空按钮始终渲染占位，这里只切换禁用态，避免增删节点导致顶栏按钮位置跳变
    const btn = document.getElementById('chatClearBtn');
    if (btn) btn.disabled = messages.length === 0;
  }

  function clearInput() {
    const input = document.getElementById('chatInput');
    if (input) { input.value = ''; autoResize(input); }
  }

  function autoResize(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }

  function onKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendFromInput();
    }
  }

  // ===== 工具函数 =====
  function escapeHTML(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  // 简易 Markdown 渲染（加粗/列表/代码块/段落）
  // 核心原则：单换行并入同一段落（避免行间大间距），分点走紧凑列表，空行才是段落分隔
  function formatMarkdown(text) {
    let s = escapeHTML(text);
    // 代码块：先提取保护，避免内部内容被后续正则破坏
    const codeBlocks = [];
    s = s.replace(/```([\s\S]*?)```/g, (_, code) => {
      codeBlocks.push(code.trim());
      return '%%CB' + codeBlocks.length + '%%';
    });
    // 行内代码
    s = s.replace(/`([^`]+)`/g, '<code class="chat-inline-code">$1</code>');
    // 加粗
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // 逐行构建：普通文本归入段落（空格连接），列表行归入 <ul>/<li>
    const out = [];
    let para = [];   // 当前段落文本行
    let list = null; // 当前列表 ['ul'|'ol', [items]]

    const flushPara = () => {
      if (para.length) { out.push('<p>' + para.join(' ') + '</p>'); para = []; }
    };
    const flushList = () => {
      if (list) {
        out.push('<' + list[0] + '>' + list[1].map(i => '<li>' + i + '</li>').join('') + '</' + list[0] + '>');
        list = null;
      }
    };

    for (const rawLine of s.split('\n')) {
      const line = rawLine.trim();
      // 空行 → 段落/列表分隔
      if (!line) { flushPara(); flushList(); continue; }
      // 代码块占位行
      if (/^%%CB\d+%%$/.test(line)) { flushPara(); flushList(); out.push(line); continue; }
      // 列表项
      const ul = line.match(/^[-•]\s+(.+)$/);
      const ol = line.match(/^(\d+)[.)、]\s+(.+)$/);
      if (ul || ol) {
        flushPara();
        if (!list) list = ['ul', []];
        list[1].push(ul ? ul[1] : ol[2]);
        continue;
      }
      // 普通文本行：并入当前段落，用空格连接（单换行不再产生大行距）
      flushList();
      para.push(line);
    }
    flushPara();
    flushList();

    // 恢复代码块
    return out.join('').replace(/%%CB(\d+)%%/g, (_, i) => '<pre class="chat-code">' + codeBlocks[+i - 1] + '</pre>');
  }

  // ===== 悬浮按钮 =====
  function renderFab() {
    try {
      if (window.App && App.curView === 'chat') return '';
    } catch(e) {}
    return `
      <div class="chat-fab-wrap" id="chatFabWrap">
        <div class="chat-fab-pop" id="chatFabPop" aria-hidden="true">
          <div class="chat-fab-pop-head">
            <span class="chat-fab-pop-avatar">${ic('sparkle', 18)}</span>
            <div>
              <div class="chat-fab-pop-title">贾维斯 · AI 购房管家</div>
              <div class="chat-fab-pop-sub">24h 在线 · 随时解答购房问题</div>
            </div>
          </div>
          <button type="button" class="chat-fab-pop-quota" id="fabQuota" onclick="ChatMod.gotoChat()" title="点击进入 AI 对话">
            <span class="fab-quota-ico">${ic('bolt', 13)}</span>
            <span class="fab-quota-txt">额度加载中…</span>
            <span class="fab-quota-go">${ic('chevron', 12)}</span>
          </button>
          <div class="chat-fab-pop-acts">
            <button type="button" class="fab-act" onclick="ChatMod.gotoChat()">
              <span class="fab-act-ico">${ic('send', 15)}</span><span>AI 对话</span>
            </button>
            <button type="button" class="fab-act" onclick="ChatMod.gotoChat(true)">
              <span class="fab-act-ico">${ic('menu', 15)}</span><span>历史记录</span>
            </button>
          </div>
          <i class="chat-fab-pop-arrow" aria-hidden="true"></i>
        </div>
        <button class="chat-fab" onclick="App.navigate('chat')" title="贾维斯 · AI 购房管家">${ic('sparkle', 26)}</button>
      </div>
    `;
  }

  // ===== 悬浮按钮浮层：hover 展示额度状态 + 快捷入口 =====
  let fabTimer = null;
  function showFabPop() {
    const pop = document.getElementById('chatFabPop');
    if (!pop) return;
    if (fabTimer) clearTimeout(fabTimer);
    pop.classList.add('show');
    pop.setAttribute('aria-hidden', 'false');
    renderFabQuota();
  }
  function hideFabPop(immediate) {
    const pop = document.getElementById('chatFabPop');
    if (!pop) return;
    const doHide = () => {
      pop.classList.remove('show');
      pop.setAttribute('aria-hidden', 'true');
    };
    if (immediate) doHide();
    else { if (fabTimer) clearTimeout(fabTimer); fabTimer = setTimeout(doHide, 180); }
  }
  // 浮层内额度：实时读取后端，低额度警示
  async function renderFabQuota() {
    const el = document.getElementById('fabQuota');
    if (!el) return;
    const q = await Utils.fetchQuota();
    if (!q) return;
    const txt = el.querySelector('.fab-quota-txt');
    if (!txt) return;
    if (q.unlimited) {
      txt.textContent = '无限额度 · 随时可用';
      el.classList.remove('low', 'out');
    } else {
      txt.textContent = '剩余 ' + q.remain + ' 次';
      el.classList.toggle('low', q.remain > 0 && q.remain <= 5);
      el.classList.toggle('out', q.remain <= 0);
    }
  }
  // 浮层快捷入口：进入 AI 购房页，可选同时展开对话记录面板
  function gotoChat(openHistory) {
    if (openHistory) historyOpen = true;
    if (window.App && typeof App.navigate === 'function') App.navigate('chat');
    else if (openHistory) historyOpen = false;
  }
  function initFab() {
    const wrap = document.getElementById('chatFabWrap');
    if (!wrap) return;
    wrap.addEventListener('mouseenter', showFabPop);
    wrap.addEventListener('mouseleave', () => hideFabPop(false));
    document.addEventListener('click', e => { if (!wrap.contains(e.target)) hideFabPop(true); }, { passive: true });
  }

  return { render, send, sendQuick, sendFromInput, clearHistory, doClear, autoResize, onKeydown, renderFab,
           toggleSider, newSession, switchSession, delSession, doDelSession, closeDrawer, openRechargeModal,
           refreshQuotaAll, initFab, showFabPop, hideFabPop, gotoChat };
})();
