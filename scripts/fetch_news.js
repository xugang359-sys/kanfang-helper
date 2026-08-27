#!/usr/bin/env node
/* ============================================
   房产资讯月度归档脚本
   用法：
     node scripts/fetch_news.js --key 你的天行Key            # 默认城市(南京) + 全国
     node scripts/fetch_news.js --key xxx --city 南京,上海    # 指定城市
     node scripts/fetch_news.js --key xxx --year 2026 --from 1 --to 8
     node scripts/fetch_news.js --out data/news-archive.json
   Key 优先级：--key 参数 > 环境变量 TIANAPI_KEY > data/news-key.txt
   说明：天行 generalnews 无法按历史月份检索，本脚本用房产核心词搜索
   实时资讯，并按发布时间归档到今年各月（尽力回填，不伪造数据）。
   建议每月底运行一次，将当月真实资讯追加归档。
   ============================================ */
'use strict';
const fs = require('fs');
const path = require('path');

const API = 'https://apis.tianapi.com/generalnews/index';
const YEAR = 2026;             // 归档年份（今年）
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

// 分类 → 搜索词（全国维度词；local/project 会额外拼城市）
const CATS = {
  national: { label: '国家政策', kws: ['房贷利率', '公积金', '楼市调控', '保障房'] },
  market:   { label: '市场动态', kws: ['房价', '楼市成交', '二手房', '土地拍卖'] },
  local:    { label: '地方政策', kws: ['楼市新政', '购房补贴'] },
  project:  { label: '楼盘资讯', kws: ['楼盘开盘', '新楼盘'] },
};

// 房产相关性强词：标题/描述命中任一词才算房产资讯（排除误伤）
const STRONG_WORDS = [
  '房价', '楼市', '楼盘', '房贷', '房地产', '房产', '住宅', '二手房', '新房',
  '租赁', '租金', '住房', '土地', '限购', '限售', '公积金', '契税', '房产税',
  '保障房', '安置房', '商品房', '成交', '房企', '物业', '贷款', '购房', '买房',
  '开发商', '交付', '开盘', '加推', '小区', '城中村', '旧改', '棚改', '租售',
];

// 文章正文抓取（Node 直连，无 CORS 限制）
async function fetchArticle(url, timeout = 6000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'zh-CN' }, signal: ctrl.signal });
    if (!res.ok) return '';
    const html = await res.text();
    const ps = [];
    // 提取 <p> 段落文本（含 <article>/正文区域）
    const body = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ');
    const re = /<p[^>]*>([\s\S]*?)<\/p>/gi;
    let m;
    // 段落级清洗：跳过明显无关的站内推荐/生活杂项段落（不含任何房产强词）
    const IRRELEVANT = /中医|养生|妙招|美食|旅游|股市|基金|A股|涨停|测评|广告|热门推荐|相关阅读|点击查看/;
    while ((m = re.exec(body)) && ps.length < 12) {
      const t2 = m[1].replace(/<[^>]+>/g, '').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
      if (t2.length > 20 && !(IRRELEVANT.test(t2) && !STRONG_WORDS.some(w => t2.includes(w)))) ps.push(t2);
    }
    return ps.join('\n').slice(0, 1200);
  } catch (e) {
    return '';
  } finally {
    clearTimeout(t);
  }
}

// 并发池：控制同时进行的任务数
async function mapLimit(arr, limit, fn) {
  const results = new Array(arr.length);
  let i = 0;
  const workers = Array(Math.min(limit, arr.length)).fill(0).map(async () => {
    while (i < arr.length) {
      const idx = i++;
      results[idx] = await fn(arr[idx], idx);
    }
  });
  await Promise.all(workers);
  return results;
}

// 天行接口请求（带限流保护：请求间隔 + 频率受限重试）
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function tianapi(key, word, num = 50, retry = 3) {
  const url = `${API}?key=${encodeURIComponent(key)}&num=${num}&word=${encodeURIComponent(word)}`;
  for (let i = 0; i < retry; i++) {
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (!data) return [];
      // 130=频率超限 / 150=次数不足：等待后重试
      if (data.code === 130 || data.code === 150) {
        console.log(`  ⚠️ 接口限流(${data.code})，1.5s 后重试(${i + 1}/${retry})...`);
        await sleep(1500);
        continue;
      }
      if (data.code !== 200) return [];
      const list = (data.result && (data.result.list || data.result.newslist)) || data.newslist || [];
      return list.map(n => ({
        title: (n.title || '').trim(),
        summary: (n.description || '').trim(),
        url: n.url || '',
        source: n.source || '天行数据',
        time: n.ctime || '',
      })).filter(x => x.title);
    } catch (e) {
      if (i === retry - 1) return [];
      await sleep(1000);
    }
  }
  return [];
}

// 房产相关性过滤 + 目标年份/月份过滤
function isRealEstate(item) {
  const text = item.title + ' ' + item.summary;
  return STRONG_WORDS.some(w => text.includes(w));
}
function inTargetYear(time) {
  return typeof time === 'string' && time.startsWith(String(YEAR) + '-');
}
function monthOf(time) {
  const m = /^(\d{4})-(\d{2})/.exec(time || '');
  return m ? `${m[1]}-${m[2]}` : '';
}

// 抓取并归档一批（补正文、去重）
async function archiveItems(items, cat, city, tag) {
  const seen = new Set();
  const out = [];
  const uniq = items.filter(it => {
    const k = it.url || it.title;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const withBody = await mapLimit(uniq, 5, async it => {
    let body = '';
    if (it.url && it.url.startsWith('http')) body = await fetchArticle(it.url);
    return { ...it, body };
  });
  withBody.forEach((it, idx) => {
    const m = monthOf(it.time);
    if (!m) return;
    const content = it.body || it.summary || `（原文未获取到正文，可点击查看原文）${it.title}`;
    out.push({
      id: `${cat}_${m}_${idx}_${city || 'cn'}`,
      cat, month: m, city: city || '',
      title: it.title, summary: it.summary || content.slice(0, 100),
      content, url: it.url, source: it.source, time: it.time,
      tags: tag ? [tag] : [],
    });
  });
  return out;
}

// 主流程
async function main() {
  const args = process.argv.slice(2);
  let key = '', cities = [], out = path.join(__dirname, '..', 'data', 'news-archive.json');
  // 默认归档当年 1 月 ~ 当前月（每月底运行即"年初~当月"）
  let from = 1, to = new Date().getMonth() + 1;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--key') { key = args[i + 1]; i++; }
    else if (args[i] === '--city') { cities = (args[i + 1] || '').split(/[,，]/).map(s => s.trim()).filter(Boolean); i++; }
    else if (args[i] === '--out') { out = args[i + 1]; i++; }
    else if (args[i] === '--from') { from = Number(args[i + 1]) || 1; i++; }
    else if (args[i] === '--to') { to = Number(args[i + 1]) || 12; i++; }
  }
  // Key 优先级：参数 > 环境变量 > data/news-key.txt
  if (!key && process.env.TIANAPI_KEY) key = process.env.TIANAPI_KEY;
  if (!key) {
    try { key = fs.readFileSync(path.join(__dirname, '..', 'data', 'news-key.txt'), 'utf8').trim(); } catch (e) {}
  }
  if (!key) {
    console.error('❌ 缺少天行 Key。请用 --key 传入，或设置环境变量 TIANAPI_KEY，或写入 data/news-key.txt');
    process.exit(1);
  }

  const cityList = cities.length ? cities : ['南京'];
  const archive = { _meta: { source: '天行数据·实时资讯按月归档（脚本月末运行）', year: YEAR, generatedAt: new Date().toISOString(), cities: cityList }, national: {}, market: {}, local: {}, project: {} };

  for (const cat of Object.keys(CATS)) {
    const def = CATS[cat];
    const needCity = (cat === 'local' || cat === 'project');
    const pool = needCity ? cityList : [''];
    for (const city of pool) {
      const all = [];
      for (const w of def.kws) {
        const word = city ? `${city}${w}` : w;
        try {
          const items = await tianapi(key, word);
          all.push(...items.filter(isRealEstate).filter(it => inTargetYear(it.time)));
          console.log(`  [${cat}] "${word}" → ${items.length} 条（命中房产 ${all.length}）`);
        } catch (e) {
          console.log(`  [${cat}] "${word}" 请求失败：${e.message}`);
        }
        await sleep(600); // 请求间隔，避免触发天行 QPS 限流
      }
      const monthItems = await archiveItems(all, cat, city, def.kws[0]);
      const bucket = needCity ? archive[cat][city] || (archive[cat][city] = {}) : archive[cat];
      for (const it of monthItems) {
        const mm = it.month;
        if (mm >= `${YEAR}-${String(from).padStart(2, '0')}` && mm <= `${YEAR}-${String(to).padStart(2, '0')}`) {
          (bucket[mm] || (bucket[mm] = [])).push(it);
        }
      }
      console.log(`  [${cat}] ${city || '全国'} 归档 ${monthItems.length} 条`);
    }
  }

  // 每类每月按时间倒序、限 6 条
  const trim = obj => {
    Object.keys(obj).forEach(k => {
      if (typeof obj[k] === 'object' && obj[k] !== null) {
        if (Array.isArray(obj[k])) obj[k] = obj[k].sort((a, b) => (b.time || '').localeCompare(a.time || '')).slice(0, 6);
        else trim(obj[k]);
      }
    });
  };
  trim(archive.national); trim(archive.market); trim(archive.local); trim(archive.project);

  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(archive, null, 2), 'utf8');
  const cnt = Object.keys(archive.national).length + Object.keys(archive.market).length;
  console.log(`✅ 归档完成 → ${out}`);
  console.log(`   国家政策 ${cnt} 个月 · 市场动态 ${cnt} 个月 · 城市维度已按城市归档`);
}

main().catch(e => { console.error('❌ 脚本异常：', e); process.exit(1); });
