/* ============================================
   语音识别引擎 · 讯飞语音听写（流式版）v2 直连
   纯前端实现：getUserMedia 录音 → 16kHz/16bit PCM 分帧
   → WebSocket wss://iat-api.xfyun.cn/v2/iat 实时识别
   零后端依赖（WebSocket 不受 CORS 限制）
   免费额度：讯飞开放平台每日 500 次（需实名认证），单次最长 60 秒
   配置入口：设置 → 联网 API 配置 → 语音识别（讯飞）
   ============================================ */
window.VoiceMod = (function() {
  const HOST = 'iat-api.xfyun.cn';
  const URL_BASE = 'wss://' + HOST + '/v2/iat';

  // 讯飞三要素：AppID / APIKey / APISecret（管理员在设置中配置，全局共享）
  const keys = () => {
    const k = Utils.getApiKeys();
    return { appId: k.xfAppId, apiKey: k.xfApiKey, apiSecret: k.xfApiSecret };
  };
  function available() {
    const k = keys();
    return !!(k.appId && k.apiKey && k.apiSecret);
  }

  // ===== 鉴权：生成带签名的 WebSocket 地址（HMAC-SHA256，RFC 规范） =====
  async function buildAuthUrl() {
    const k = keys();
    const date = new Date().toUTCString();
    const signatureOrigin = 'host: ' + HOST + '\ndate: ' + date + '\nGET /v2/iat HTTP/1.1';
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(k.apiSecret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(signatureOrigin));
    const signature = btoa(String.fromCharCode.apply(null, new Uint8Array(sigBuf)));
    const authorizationOrigin = 'api_key="' + k.apiKey + '", algorithm="hmac-sha256", headers="host date request-line", signature="' + signature + '"';
    const authorization = btoa(unescape(encodeURIComponent(authorizationOrigin)));
    return URL_BASE + '?authorization=' + encodeURIComponent(authorization) +
      '&date=' + encodeURIComponent(date) + '&host=' + HOST;
  }

  // ===== 状态 =====
  let ws = null, stream = null, audioCtx = null, processor = null;
  let firstSent = false;     // 首帧（status=0）是否已发送
  let finalSent = false;     // 结束帧（status=2）是否已发送
  let bySn = {};             // sn -> 该片段文本（wpgs 按帧号动态修正）
  let maxSn = 0;             // 已收到的最大 sn 序号
  let limitTimer = null;     // 单次识别时长限制计时器（讯飞上限 60s）
  let resultCB = null, endCB = null, errorCB = null, limitCB = null;

  function isActive() { return !!ws && ws.readyState === WebSocket.OPEN; }

  // ===== 录音采集：重采样到 16kHz、16bit、单声道 PCM =====
  function startCapture(onChunk) {
    // 开启降噪/回声消除/自动增益，显著提升识别准确率（尤其环境嘈杂时）
    return navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    }).then(s => {
      stream = s;
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(s);
      const rate = audioCtx.sampleRate;
      // ScriptProcessor：2048 缓冲 → 约 40ms/帧，识别更实时（讯飞官方 Web 示例同款方案）
      processor = audioCtx.createScriptProcessor(2048, 1, 1);
      source.connect(processor);
      // 必须连接到 destination 才会被拉取触发 onaudioprocess（Web Audio 拉模型）；
      // 不写 outputBuffer 即保持静音输出，既保证音频上传、又不会产生回声
      processor.connect(audioCtx.destination);
      processor.onaudioprocess = (ev) => {
        if (!ev.inputBuffer) return;
        const data = ev.inputBuffer.getChannelData(0);
        // 线性插值重采样到 16000Hz，再转 Int16
        const outLen = Math.floor(data.length * 16000 / rate);
        const out = new Int16Array(outLen);
        for (let i = 0; i < outLen; i++) {
          const pos = i * rate / 16000;
          const i0 = Math.floor(pos), i1 = Math.min(i0 + 1, data.length - 1);
          const frac = pos - i0;
          let v = data[i0] * (1 - frac) + data[i1] * frac;
          v = v < -1 ? -1 : v > 1 ? 1 : v;
          out[i] = v < 0 ? v * 0x8000 : v * 0x7FFF;
        }
        onChunk(new Uint8Array(out.buffer));
      };
      if (audioCtx.state === 'suspended') audioCtx.resume();
    });
  }

  function stopCapture() {
    try { if (processor) { processor.disconnect(); processor.onaudioprocess = null; } } catch(e) {}
    try { if (stream) stream.getTracks().forEach(t => t.stop()); } catch(e) {}
    try { if (audioCtx) audioCtx.close(); } catch(e) {}
    processor = null; stream = null; audioCtx = null;
  }

  // ===== 帧发送 =====
  function toBase64(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(bin);
  }
  // 单帧约 2.7KB 原始（4096 输入样本重采样），base64 后 <4KB，满足讯飞每帧 <8KB 限制
  function sendFrame(status, audioBytes) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const payload = {
      common: { app_id: keys().appId },
      // wpgs 动态修正：词级实时返回，边说边出字，延迟感知最低（讯飞已免费开放）
      // vad_eos=10000（10s，官方 demo 值）：停顿 10s 才断句，避免说话中正常停顿被误判中断
      business: { language: 'zh_cn', domain: 'iat', accent: 'mandarin', vad_eos: 10000, dwa: 'wpgs' },
      data: {
        status,
        format: 'audio/L16;rate=16000',
        encoding: 'raw',
        audio: audioBytes ? toBase64(audioBytes) : ''
      }
    };
    ws.send(JSON.stringify(payload));
  }

  // ===== 结果解析（wpgs 模式） =====
  // 讯飞 wpgs 语义（实测确认）：
  //   pgs='rpl' + rg=[a,b]：本次 text 是「第 a 帧到第 b 帧」的合并结果，仅替换该范围；
  //     a>1 表示前面已有定稿的句子（不会被后续修正），不能全文替换，否则会清空前面的句子。
  //   pgs='apd'：追加一个新片段（新 sn）。
  // 因此按 sn 序号维护片段字典，rg 范围替换后再按序号拼接，保证多句不丢、不重复。
  function joinBySn() {
    let s = '';
    for (let i = 1; i <= maxSn; i++) if (bySn[i]) s += bySn[i];
    return s;
  }
  function parseResult(json) {
    if (json.code !== 0) {
      const msg = { 10105: '鉴权失败：AppID/APIKey/APISecret 有误', 10160: '讯飞流量不足或并发超限', 11200: '音频流超时', 11201: '音频格式错误' }[json.code];
      if (errorCB) errorCB(new Error(msg || ('讯飞错误码 ' + json.code)));
      return;
    }
    const res = (json.data && json.data.result) || {};
    if (!res.ws) return;
    // 每帧词序列；每个词取置信度最高的候选（sc 越大越可信）
    const text = res.ws.map(w => {
      const cw = w.cw || [];
      const best = cw.reduce((a, b) => (a.sc >= b.sc ? a : b), cw[0]);
      return best ? best.w : '';
    }).join('');
    const sn = res.sn != null ? res.sn : 1;
    maxSn = Math.max(maxSn, sn);
    if (res.pgs === 'rpl' && res.rg && res.rg.length >= 2) {
      const a = res.rg[0], b = res.rg[1];
      for (let i = a; i <= b; i++) delete bySn[i]; // 清空被替换范围
      bySn[a] = text;                              // 在起始帧号写入合并结果
    } else {
      bySn[sn] = (bySn[sn] || '') + text;          // apd / 首帧：追加
    }
    if (resultCB) resultCB(joinBySn());
  }

  // ===== 对外：开始识别 =====
  // 连接与采集并行进行（互不阻塞），都就绪后立即开始发帧，减少点击后的等待
  function start(opts) {
    resultCB = opts.onResult || null;
    endCB = opts.onEnd || null;
    errorCB = opts.onError || null;
    limitCB = opts.onLimit || null;
    if (!available()) return Promise.reject(new Error('未配置讯飞语音识别'));
    firstSent = false; finalSent = false; bySn = {}; maxSn = 0;

    const onChunk = chunk => {
      if (finalSent) return;
      if (!firstSent) { sendFrame(0, chunk); firstSent = true; }
      else sendFrame(1, chunk);
    };
    return Promise.all([
      buildAuthUrl().then(url => new Promise((resolve, reject) => {
        ws = new WebSocket(url);
        ws.onopen = resolve;
        ws.onerror = () => reject(new Error('语音服务连接失败'));
        ws.onmessage = ev => { try { parseResult(JSON.parse(ev.data)); } catch(e) {} };
        ws.onclose = () => {
          // 用户未主动停止（未发送结束帧）却连接关闭 → 意外中断，提示用户
          if (!finalSent && errorCB) errorCB(new Error('识别已中断，请重试'));
          finishSession();
        };
      })),
      startCapture(onChunk)
    ]).then(() => {
      // 讯飞单次识别最长 60s：55s 时自动停止并回调，提示用户再次点击继续
      limitTimer = setTimeout(() => {
        if (finalSent) return;
        stop();
        if (limitCB) limitCB();
      }, 55000);
    });
  }

  // ===== 对外：停止识别 =====
  // 立即关闭麦克风（采集即停，按钮可马上恢复），随后发结束帧等待最终结果补全
  function stop() {
    if (finalSent) return;
    finalSent = true;
    stopCapture();
    try { sendFrame(2, null); } catch(e) {}
    // 服务端返回最终结果后 onclose 收尾；兜底 3s 强制结束（给足服务端返回最后一句的时间）
    setTimeout(finishSession, 3000);
  }

  // ===== 收尾 =====
  function finishSession() {
    clearTimeout(limitTimer);
    stopCapture();
    const cb = endCB;
    resultCB = null; endCB = null; errorCB = null; limitCB = null;
    if (ws && ws.readyState !== WebSocket.CLOSED && ws.readyState !== WebSocket.CLOSING) {
      try { ws.close(); } catch(e) {}
    }
    ws = null;
    if (cb) cb();
  }

  // ===== 配置校验（设置页「测试连接」用） =====
  async function test() {
    if (!available()) throw new Error('请先填写 AppID / APIKey / APISecret');
    await buildAuthUrl();
    return '配置正确，已生成签名连接（实际识别效果请到 AI 助手中测试）';
  }

  return { available, isActive, start, stop, test };
})();
