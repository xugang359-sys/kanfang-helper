# HOUSE HUNTER · 看房助手 启动指南

> 发给朋友时，请把**整个项目文件夹**一起发送（不要只发 index.html！）

---

## 🚀 最快启动方式（推荐）

### 第一步：安装运行环境（二选一即可，装过就跳过）

**方案 A：Python 3（最简单，5分钟搞定）**
1. 打开 https://www.python.org/downloads/windows/
2. 下载「Latest Python 3 Release」
3. 安装时 **一定要勾选** `☑ Add Python.exe to PATH`（最下面那个框）
4. 一路默认安装完成

**方案 B：Node.js（同样简单）**
1. 打开 https://nodejs.org/zh-cn/
2. 下载「LTS」版本（长期支持版）
3. 一路默认安装完成

### 第二步：双击启动！

在项目文件夹里找到 `启动.bat`，直接**双击运行**。

- 启动成功后会自动打开浏览器访问 `http://localhost:8765/`
- 看到浏览器页面正常显示 = 成功
- 要关闭工具：直接关掉黑色的命令行窗口即可

---

## ❓ 常见问题

### Q1：双击 index.html 打开后样式全乱了？
**答：** 浏览器出于安全策略，`file://` 协议下会拒绝加载 CSS/JS 子资源。**一定要用 `启动.bat`**，它会启动一个本地 HTTP 服务器，才能正常加载样式。

### Q2：双击启动.bat 后提示"未检测到 Node.js 或 Python"？
**答：** 说明还没装运行环境，按上方「第一步」装 Python 或 Node.js 任一即可。装完后**重新双击** `启动.bat`。

### Q3：启动成功但字体显示很丑？
**答：** 这是网络问题导致 Google Fonts 加载失败。工具会自动回退到项目自带的本地备用字体 + 系统字体，功能不受影响。如果想要最完美的字体效果，连个能访问谷歌的网络刷新一次即可。

### Q4：点击「AI 决策分析」提示"未配置 AI Key"？
**答：** AI 大模型 Key 需要手动在工具里配置。如果分享者给了数据备份文件（.json），可以这样导入：
1. 打开工具 → 点击顶部导航「设置备份」
2. 点「导入JSON备份」选择备份文件
3. 导入完成后 AI Key、高德地图 Key、房源数据会一并恢复

### Q5：地图显示空白 / 没有真实地图？
**答：** 高德地图 Key 需要导入备份（同上Q4）。未配置 Key 时使用占位图，功能正常但无真实地图。

### Q6：黑窗口端口显示 8766 或 8767？
**答：** 正常现象。如果 8765 端口被占用，工具会自动往后找可用端口，浏览器会自动打开正确地址。

---

## 🔧 进阶：手动启动方式

如果 `.bat` 启动失败，也可以手动启动服务器：

**方法一：Python 手动启动**
在项目文件夹空白处 **按住 Shift + 右键** → 选「在终端中打开」或「在此处打开 PowerShell 窗口」，输入：
```
python -m http.server 8765
```
然后浏览器访问 `http://localhost:8765/`。

**方法二：Node.js 手动启动**
同上打开终端，输入：
```
node server.js
```
自动打开浏览器。

---

## 📦 打包给朋友时的文件清单

**以下文件和文件夹必须一起发送（一个都不能少）：**

```
看房助手项目/
├── 启动.bat                    ← 双击它！（最重要）
├── server.js                    ← 本地服务器脚本
├── README_启动指南.md           ← 本文件
├── index.html                   ← 主页面
├── css/
│   └── style.css                ← 页面样式
├── js/
│   ├── app.js                   ← 主逻辑
│   ├── store.js                 ← 数据存储
│   ├── utils.js                 ← 工具函数
│   └── modules/                 ← 12个功能模块
│       ├── dashboard.js         ← 仪表盘
│       ├── records.js           ← 房源记录
│       ├── expectation.js       ← 期望档案
│       ├── calendar.js          ← 看房日程
│       ├── plans.js             ← 待看计划
│       ├── recommend.js         ← 房源推荐
│       ├── compare.js           ← 决策对比（AI分析）
│       ├── finance.js           ← 财务计算
│       ├── location.js          ← 区位分析
│       ├── aids.js              ← 看房辅助
│       ├── workflow.js          ← 流程导出
│       └── settings.js          ← 设置备份
├── _shared/
│   ├── js/
│   │   ├── echarts.min.js       ← 图表库
│   │   └── mermaid.min.js       ← 流程图库
│   └── fonts/                   ← 本地备用字体
│       ├── IBMPlexSerif-Bold.ttf
│       ├── IBMPlexSerif-Regular.ttf
│       ├── WorkSans-Bold.ttf
│       └── WorkSans-Regular.ttf
└── assets/
    └── charts.js
```

**可选附加文件（推荐一起发）：**
- `看房助手备份_xxx.json`  → 如果要把你的房源记录、AI Key、配置一起给朋友，记得在「设置备份」里导出这个文件一并发送。

---

## 📞 启动失败了怎么办？

按顺序检查：
1. ✅ 装了 Python 或 Node.js 吗？ → 打开 cmd 输入 `python --version` 或 `node --version` 验证
2. ✅ 整个文件夹都复制过来了吗？ → 不能只拿 index.html，css/js/_shared 缺一不可
3. ✅ 安装 Python 时勾选了 "Add to PATH" 吗？ → 没勾的话重装一次
4. ✅ 浏览器打开的地址是 `http://localhost:xxxx/` 而不是 `file://...` 吗？ → 用启动.bat 就不会有这个问题

如果都不行，把黑窗口里的文字截图发过来，帮你排查。
