/* ============================================
   看房助手 · 本地静态服务器
   用法：双击 启动.bat 自动调用
   或命令行：node server.js
   如没有 Node.js，可用 启动.bat 里的 python 方案
   ============================================ */
const http = require('http');
const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { exec } = require('child_process');

const DEFAULT_PORT = 8765;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico':  'image/x-icon',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
  '.pdf':  'application/pdf',
  '.csv':  'text/csv; charset=utf-8',
  '.ttf':  'font/ttf',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.mp4':  'video/mp4',
};

function openBrowser(url) {
  const cmd = process.platform === 'win32' ? 'start'
            : process.platform === 'darwin' ? 'open'
            : 'xdg-open';
  try { exec(`${cmd} "" "${url}"`); } catch(e) {}
}

function tryListen(port) {
  const server = http.createServer((req, res) => {
    try {
      let url = decodeURIComponent(req.url.split('?')[0]);
      if (url === '/' || url === '') url = '/index.html';
      const filePath = path.normalize(path.join(ROOT, url));
      if (!filePath.startsWith(ROOT)) { res.writeHead(403, {'Content-Type':'text/plain; charset=utf-8'}); res.end('403 Forbidden'); return; }
      fs.readFile(filePath, (err, data) => {
        if (err) {
          if (err.code === 'ENOENT') {
            res.writeHead(404, {'Content-Type':'text/html; charset=utf-8'});
            res.end(`<!DOCTYPE html><meta charset="utf-8"><title>404</title>
              <body style="font-family:Microsoft YaHei,sans-serif;padding:40px;text-align:center;">
              <h2>404 - 文件不存在</h2>
              <p style="color:#888;">路径：${url}</p>
              <p><a href="/" style="color:#1E3A8A;">返回首页</a></p></body>`);
          } else {
            res.writeHead(500); res.end('500 Server Error');
          }
        } else {
          const ext = path.extname(filePath).toLowerCase();
          const mime = MIME[ext] || 'application/octet-stream';
          res.writeHead(200, {
            'Content-Type': mime,
            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
            'Access-Control-Allow-Origin': '*',
          });
          res.end(data);
        }
      });
    } catch(e) { res.writeHead(500); res.end('500'); }
  });

  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      console.log(`端口 ${port} 已被占用，尝试 ${port + 1} ...`);
      tryListen(port + 1);
    } else {
      console.error('服务器启动失败:', e.message);
      process.exit(1);
    }
  });

  server.listen(port, '0.0.0.0', () => {
    const localUrl = `http://localhost:${port}/`;
    const nets = os.networkInterfaces();
    const ips = [];
    for (const k in nets) nets[k].forEach(n => { if (n.family === 'IPv4' && !n.internal) ips.push(n.address); });
    console.log('\n========================================');
    console.log('  🏠 HOUSE HUNTER · 看房助手 启动成功！');
    console.log('========================================');
    console.log(`  本机访问：   ${localUrl}`);
    if (ips.length) console.log(`  局域网访问： http://${ips[0]}:${port}/`);
    console.log(`  项目目录：   ${ROOT}`);
    console.log('  关闭窗口即可停止服务');
    console.log('========================================\n');
    // 延迟 500ms 打开浏览器，确保服务就绪
    setTimeout(() => openBrowser(localUrl), 500);
  });
}

tryListen(DEFAULT_PORT);
