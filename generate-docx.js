const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, LevelFormat, HeadingLevel,
  BorderStyle, WidthType, ShadingType, PageNumber, PageBreak,
  VerticalAlign
} = require('docx');

const CJK = { ascii: 'Arial', hAnsi: 'Arial', eastAsia: 'Microsoft YaHei' };
const thinBorder = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
const borders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };
const headerFill = { fill: 'E8EDF5', type: ShadingType.CLEAR };
const accentFill = { fill: 'EBF0FB', type: ShadingType.CLEAR };

function cell(text, opts = {}) {
  const runs = Array.isArray(text)
    ? text
    : [new TextRun({ text: String(text || ''), font: CJK, size: 20, ...(opts.runProps || {}) })];
  return new TableCell({
    borders,
    width: opts.width ? { size: opts.width, type: WidthType.DXA } : undefined,
    shading: opts.fill,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [new Paragraph({ children: runs, spacing: { before: 0, after: 0 } })],
    verticalAlign: VerticalAlign.CENTER
  });
}

function headerCell(text, width) {
  return cell(text, { width, fill: headerFill, runProps: { bold: true } });
}

function makeTable(headers, rows, widths) {
  const totalWidth = 9026;
  const colWidths = widths || headers.map(() => Math.floor(totalWidth / headers.length));
  const headerRow = new TableRow({
    cantSplit: true,
    children: headers.map((h, i) => headerCell(h, colWidths[i]))
  });
  const dataRows = rows.map(row =>
    new TableRow({
      cantSplit: true,
      children: row.map((c, i) => cell(c, { width: colWidths[i] }))
    })
  );
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: colWidths,
    rows: [headerRow, ...dataRows]
  });
}

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 200 },
    children: [new TextRun({ text, font: CJK, bold: true, size: 32 })]
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 160 },
    children: [new TextRun({ text, font: CJK, bold: true, size: 26 })]
  });
}

function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 120 },
    children: [new TextRun({ text, font: CJK, bold: true, size: 22 })]
  });
}

function p(text) {
  return new Paragraph({
    spacing: { before: 60, after: 60 },
    children: [new TextRun({ text, font: CJK, size: 21 })]
  });
}

function bold(text) {
  return new Paragraph({
    spacing: { before: 60, after: 60 },
    children: [new TextRun({ text, font: CJK, size: 21, bold: true })]
  });
}

function note(text) {
  return new Paragraph({
    spacing: { before: 80, after: 80 },
    shading: accentFill,
    children: [new TextRun({ text: '[注] ' + text, font: CJK, size: 20, italics: true })]
  });
}

function spacer() {
  return new Paragraph({ spacing: { before: 80, after: 80 }, children: [new TextRun({ text: '' })] });
}

const children = [];

// === Cover ===
children.push(new Paragraph({
  spacing: { before: 2000, after: 200 },
  alignment: AlignmentType.CENTER,
  children: [new TextRun({ text: 'PRD · V1.0 · 2026年8月', font: CJK, size: 20 })]
}));
children.push(new Paragraph({
  spacing: { before: 100, after: 100 },
  alignment: AlignmentType.CENTER,
  children: [new TextRun({ text: '南京看房记录工具', font: CJK, bold: true, size: 48 })]
}));
children.push(new Paragraph({
  spacing: { before: 0, after: 400 },
  alignment: AlignmentType.CENTER,
  children: [new TextRun({ text: '产品需求文档', font: CJK, bold: true, size: 36 })]
}));
children.push(new Paragraph({
  spacing: { before: 100, after: 100 },
  alignment: AlignmentType.CENTER,
  children: [new TextRun({ text: '面向南京首次购房刚需用户，提供看房记录、日程管理、', font: CJK, size: 22 })]
}));
children.push(new Paragraph({
  spacing: { before: 0, after: 600 },
  alignment: AlignmentType.CENTER,
  children: [new TextRun({ text: '智能对比、决策推荐的全流程数字化工具', font: CJK, size: 22 })]
}));
children.push(new Paragraph({
  spacing: { before: 200, after: 200 },
  alignment: AlignmentType.CENTER,
  children: [new TextRun({ text: '功能模块 11个  |  功能点 50+  |  核心模块 7个  |  拓展模块 4个', font: CJK, size: 20 })]
}));
children.push(new Paragraph({ children: [new PageBreak()] }));

// === 文档概览 ===
children.push(h1('文档概览'));
children.push(h2('需求背景'));
children.push(p('用户为南京本地人，即将结婚，首次购房。需要在各区域线下看房过程中，有一个工具帮助其系统化记录房源信息、管理看房日程、对比分析房源、获得智能推荐，最终辅助做出购房决策。当前市面上的房产App（如贝壳、链家）主要面向房源展示，缺少面向购房者的个人看房管理 + 决策辅助工具。'));
children.push(h2('目标用户'));
children.push(makeTable(['用户类型', '描述'], [
  ['主要用户', '南京本地首次购房的刚需用户，预算100-150万，需三房有电梯，对购房流程不熟悉，需要系统化辅助'],
  ['次要用户', '有改善需求的二次购房用户，或非南京本地但在南京购房的用户，需求类似但预算和偏好不同']
]));
children.push(spacer());
children.push(h2('产品定位'));
children.push(p('个人购房决策助手 — 不是房源平台，而是购房者的私人看房管家。核心价值：记录 → 整理 → 分析 → 决策。'));
children.push(h2('模块清单与优先级'));
children.push(makeTable(
  ['模块', '名称', '类型', '优先级', '核心价值'],
  [
    ['M1', '房源记录中心', '核心', 'P0', '结构化记录每次看房的房源信息和观后感'],
    ['M2', '购房期望档案', '核心', 'P0', '定义预算/贷款/房型/硬性要求等购房标准'],
    ['M3', '看房日程表', '核心', 'P0', '日历视图展示已看/计划看房安排'],
    ['M4', '待看计划与提醒', '核心', 'P0', '计划下次看房，到期前提醒准备'],
    ['M5', '房源推荐与推送', '核心', 'P1', '按区域筛选推荐房源，每月推送更新'],
    ['M6', '智能决策对比', '核心', 'P1', '多房源对比+联网分析+决策建议'],
    ['M7', '个人画像仪表盘', '核心', 'P1', '期望/统计/偏好一览'],
    ['M8', '财务计算工具集', '拓展', 'P1', '月供/全成本/议价/税费计算'],
    ['M9', '区位分析工具集', '拓展', 'P1', '通勤/学区/配套/房价趋势'],
    ['M10', '看房辅助工具', '拓展', 'P2', '对比矩阵+实地检查清单'],
    ['M11', '流程追踪与导出', '拓展', 'P2', '购房流程进度+数据导出']
  ]
));

// === M1 ===
children.push(h1('M1 房源记录中心'));
children.push(p('核心数据入口 — 每次看房后结构化记录房源信息和观后感。[P0]'));
children.push(h2('房源信息卡（参考贝壳字段）'));
children.push(makeTable(['#', '字段', '说明'], [
  ['1', '小区名称', '文本输入，支持搜索联想（南京小区库）'],
  ['2', '所在区域', '下拉选择：鼓楼/玄武/建邺/秦淮/雨花台/栖霞/江宁/浦口/六合/溧水/高淳'],
  ['3', '详细地址', '文本输入，可选填具体楼栋号'],
  ['4', '房屋类型', '单选：新房 / 二手房'],
  ['5', '户型', '室/厅/卫选择器（如3室2厅1卫）'],
  ['6', '建筑面积', '数字输入（㎡）'],
  ['7', '楼层信息', '所在楼层/总楼层（如8/18），自动判断高/中/低区'],
  ['8', '朝向', '南/东南/东/西/北等，标记是否南北通透'],
  ['9', '有无电梯', '是/否，电梯品牌可选填'],
  ['10', '建成年代', '年份选择，自动计算房龄'],
  ['11', '总价/单价', '数字输入，自动算单价或总价'],
  ['12', '装修情况', '毛坯/简装/精装/豪装'],
  ['13', '开发商/物业', '文本输入（新房填开发商，二手房填物业）'],
  ['14', '产权年限', '70年/40年，满二/满五状态（二手房）'],
  ['15', '看房日期', '日期选择，关联看房日程'],
  ['16', '房源来源', '中介推荐/自行发现/线上筛选/朋友介绍']
]));
children.push(spacer());
children.push(h2('观后感评价卡'));
children.push(makeTable(['#', '字段', '说明'], [
  ['1', '总体评分', '1-5星打分（整体印象）'],
  ['2', '分维度评分', '采光/通风/噪音/户型/配套/通勤 各1-5分'],
  ['3', '优势记录', '自由文本，记录亮点和满意之处'],
  ['4', '缺点记录', '自由文本，记录硬伤和不满之处'],
  ['5', '意向程度', '单选：强烈意向 / 比较有意向 / 一般 / 不太满意 / 直接排除'],
  ['6', '后续计划', '单选：纳入重点考虑 / 计划复看 / 暂时观望 / 不再考虑'],
  ['7', '一句话总结', '限50字，快速回顾用（如"采光好但临街噪音大，再看看"）'],
  ['8', '照片上传', '支持上传多张照片（客厅/卧室/厨房/卫生间/外景），可添加标注'],
  ['9', '实地检查清单', '标准化检查项打勾（详见M10）']
]));
children.push(note('设计要点：房源信息卡和观后感卡分两部分填写，降低单次输入负担。支持"快速记录模式"（只填小区名+意向+一句话总结）和"完整记录模式"两种。'));

// === M2 ===
children.push(h1('M2 购房期望档案'));
children.push(p('可编辑的个人购房偏好档案，作为筛选和推荐的基准。[P0]'));
children.push(h2('期望档案字段'));
children.push(makeTable(['#', '字段', '说明'], [
  ['1', '购房预算', '总价范围（最低-最高，如100-150万）'],
  ['2', '首付能力', '可用于首付的现金总额'],
  ['3', '贷款需求', '是否需要贷款 / 贷款金额 / 首套还是二套'],
  ['4', '月供承受上限', '每月可接受的最大还款额'],
  ['5', '房型需求', '室/厅/卫选择，如3室2厅'],
  ['6', '面积需求', '面积范围（如80-120㎡）'],
  ['7', '房屋类型偏好', '新房 / 二手房 / 都接受'],
  ['8', '硬性要求', '多选：必须有电梯 / 必须南北通透 / 必须近地铁 / 必须有学区 / 不接受顶楼和一楼 等'],
  ['9', '意向区域', '多选南京各区，可标注优先级'],
  ['10', '通勤要求', '工作地点 + 可接受通勤时长（如≤45分钟）'],
  ['11', '购房时间', '预计购房时间（如3个月内/半年内/1年内）'],
  ['12', '入住时间', '期望入住时间（如婚后/年底前）'],
  ['13', '装修预算', '是否需要装修及预算范围'],
  ['14', '其他备注', '自由文本，补充特殊需求']
]));
children.push(note('联动逻辑：期望档案是整个工具的"基准线" — M5推荐房源时按此筛选、M6对比时按此打分、M7画像时按此展示。修改期望档案后，所有联动模块自动更新。'));

// === M3 ===
children.push(h1('M3 看房日程表'));
children.push(p('日历视图展示已看和计划看房安排，点击可查看详情。[P0]'));
children.push(makeTable(['#', '功能', '说明'], [
  ['1', '月视图日历', '标准月历，标注已看房/计划看房日期，不同颜色区分'],
  ['2', '周视图列表', '本周看房安排一览，按时间排序'],
  ['3', '日期点击钻取', '点击某天，展开该天看过的所有房源列表，点击房源进入详情'],
  ['4', '看房统计条', '日历上方显示：本月已看X套、计划看Y套、累计看Z套'],
  ['5', '按区域聚合', '"这周末江宁看房"自动归组，同日多房源按区域排序'],
  ['6', '时间线视图', '纵向时间线，按时间倒序展示所有看房记录，支持筛选']
]));
children.push(note('交互说明：日历默认月视图。已看日期标绿点+数字（当天看了几套），计划看房日期标蓝点。今日高亮。点击日期弹出当天房源缩略列表，再点击进入房源详情页。'));

// === M4 ===
children.push(h1('M4 待看计划与提醒'));
children.push(p('计划下次看房，到期前自动提醒准备。[P0]'));
children.push(makeTable(['#', '功能', '说明'], [
  ['1', '创建看房计划', '日期+区域+目标小区列表+备注（如"联系中介小王"）'],
  ['2', '计划列表', '按日期排序，区分"即将到来"/"已完成"/"已过期"'],
  ['3', '提前提醒', '计划日前1天推送提醒："明天计划去江宁看3个小区，请准备"'],
  ['4', '看房准备清单', '提醒附带：带手机充电宝/穿舒适鞋子/带卷尺/记事本/查好路线等'],
  ['5', '计划转记录', '看完后一键将计划转为房源记录，自动填充日期和区域'],
  ['6', '提醒方式', '浏览器通知 + 微信/短信推送（可选）']
]));

// === M5 ===
children.push(h1('M5 房源推荐与推送'));
children.push(p('按区域筛选推荐房源，基于期望档案匹配，每月更新推送。[P1]'));
children.push(makeTable(['#', '功能', '说明'], [
  ['1', '区域筛选器', '按南京各区/板块筛选（如江宁百家湖、浦口桥北、栖霞尧化门）'],
  ['2', '多条件筛选', '价格/户型/面积/房龄/电梯/装修等组合筛选'],
  ['3', '期望匹配推荐', '基于M2期望档案自动匹配房源，标记匹配度（如"匹配度92%"）'],
  ['4', '每月推送', '每月推送新增/降价房源摘要（通过通知或消息中心），月内可手动触发刷新'],
  ['5', '收藏与一键记录', '推荐房源可收藏或一键创建为看房计划'],
  ['6', '数据来源', '接入贝壳/链家/安居客等平台公开数据（需评估爬虫合规性或API对接）']
]));
children.push(note('技术难点说明：每月推送需要后端定时任务抓取房源数据。建议方案：①使用TRAE定时任务（cron调度，每月1次）抓取贝壳/链家公开页面数据；②或引导用户手动粘贴链接，工具自动解析；③或对接房产平台开放API（如可用）。月内用户也可手动触发刷新获取最新数据。'));

// === M6 ===
children.push(h1('M6 智能决策对比'));
children.push(p('多房源对比 + 联网发展分析 + AI决策建议，告诉你该怎么选。[P1]'));
children.push(makeTable(['#', '功能', '说明'], [
  ['1', '意向房源对比矩阵', '选择2-5个有意向的房源，横向对比价格/户型/面积/楼层/朝向/房龄/电梯/配套/通勤等全部字段'],
  ['2', '期望匹配度评分', '每个房源对比M2期望档案，逐项打分（如预算匹配100%、户型匹配90%、通勤匹配60%），加权汇总总匹配度'],
  ['3', '个人观后感汇总', '将该房源的优势/缺点/评分/意向度集中展示，辅助回顾'],
  ['4', '联网区域发展分析', '联网搜索该房源所在板块的规划信息（如地铁新线、商业配套规划、产业引入等），评估未来升值潜力'],
  ['5', 'AI决策建议', '基于期望匹配度+观后感+区域发展+财务测算，给出"建议下手"/"建议复看"/"建议放弃"的明确建议，并说明理由'],
  ['6', '决策报告', '生成可分享的对比决策报告（HTML/PDF），包含对比矩阵、评分雷达图、AI建议']
]));
children.push(note('评分模型设计：匹配度评分 = 预算匹配(25%) + 户型面积(20%) + 通勤距离(15%) + 配套教育(15%) + 个人观后感(15%) + 区域发展潜力(10%)。权重可在设置中调整。'));

// === M7 ===
children.push(h1('M7 个人画像仪表盘'));
children.push(p('购房计划全貌一览 — 期望、统计、偏好可视化。[P1]'));
children.push(makeTable(['#', '功能', '说明'], [
  ['1', '期望概览卡', '一句话展示购房标准："预算150万内 | 三房 | 有电梯 | 江宁/浦口 | 半年内"'],
  ['2', '看房统计', '已看X套、计划看Y套、重点关注Z套；按区域/户型/价位分布图'],
  ['3', '区域偏好分析', '哪个区域看最多/意向最高，自动分析偏好'],
  ['4', '意向房源排行', '按匹配度+评分排序的意向房源TOP5'],
  ['5', '购房进度条', '从"需求确认→看房中→对比中→决策中→签约"的进度展示'],
  ['6', '预算执行情况', '预算范围 vs 看过房源的价格分布，判断是否需调整预期']
]));

// === M8 ===
children.push(h1('M8 财务计算工具集'));
children.push(p('月供/全成本/议价/税费四大计算器，买房到底花多少钱。[P1] [拓展]'));
children.push(makeTable(['#', '功能', '说明'], [
  ['1', '月供计算器', '输入总价/首付比例/贷款类型(商贷/公积金/组合贷)/利率/年限，输出月供+利息总额+累计还款。支持等额本息/等额本金切换'],
  ['2', '全成本计算器', '房价+契税+中介费+维修基金+评估费+物业费(年)+装修预算=真实总支出。对比新房vs二手房全成本'],
  ['3', '议价参考线', '输入小区名，查询同小区历史成交均价，对比当前挂牌价，给出合理出价区间和砍价建议（如"低于挂牌价5-8%可谈"）'],
  ['4', '税费优化器', '输入满二/满五状态、是否唯一住房，自动计算契税+个税+增值税，对比不同房源的税费差异，推荐最优选择']
]));
children.push(note('与M6联动：财务计算结果自动同步到M6智能对比模块，作为决策建议的输入因子。例如月供超过承受上限的房源会自动降权。'));

// === M9 ===
children.push(h1('M9 区位分析工具集'));
children.push(p('通勤/学区/配套/房价趋势四大区位分析工具。[P1] [拓展]'));
children.push(makeTable(['#', '功能', '说明'], [
  ['1', '通勤时间分析', '输入你和伴侣的公司地址+小区地址，调用地图API计算地铁/公交/自驾通勤时间，标注是否在可接受范围内'],
  ['2', '学区查询', '输入小区名，查询对口小学和中学，标注是否名校分校。展示学区评级'],
  ['3', '周边配套地图', '以小区为中心，地图展示1km/2km/3km圈内的医院/商场/菜市场/地铁站/公园，标注距离'],
  ['4', '区域房价趋势', '按板块展示近12个月二手房均价走势折线图，标注涨跌幅，辅助判断买入时机']
]));
children.push(note('技术依赖：通勤分析和周边配套地图依赖地图服务（如高德/百度地图API），需申请API Key。学区数据可对接南京教育局公开数据或手动维护。房价趋势数据需定期抓取或对接第三方数据源。'));

// === M10 ===
children.push(h1('M10 看房辅助工具'));
children.push(p('对比矩阵 + 实地检查清单，看房时的得力助手。[P2] [拓展]'));
children.push(makeTable(['#', '功能', '说明'], [
  ['1', '多房源对比矩阵', '选择2-5个房源，自动生成横向对比表格，高亮最优项和最差项。支持自定义对比维度和权重'],
  ['2', '实地检查清单', '标准化看房检查表，分7大类别']
]));
children.push(spacer());
children.push(h2('实地检查清单明细'));
children.push(makeTable(['检查类别', '具体检查项'], [
  ['房屋主体', '墙面裂缝、天花板渗水、地板平整度、门窗密封性'],
  ['采光通风', '各房间采光时长、南北通风测试、暗卫暗厨检查'],
  ['噪音测试', '临街/铁路/高架噪音、楼间隔音、电梯井噪音'],
  ['水电燃气', '水压测试、电路负荷、燃气位置、地暖/空调状态'],
  ['公区配套', '电梯品牌/速度、楼道整洁、消防通道、车位情况'],
  ['小区环境', '绿化率感受、物业态度、人车分流、安防门禁'],
  ['周边环境', '步行到地铁时间、菜市场距离、施工工地、高架桥']
]));
children.push(p('每项支持：✅正常 / ⚠️有问题（可拍照记录）/ ❌不合格 / — 未检查'));

// === M11 ===
children.push(h1('M11 流程追踪与数据导出'));
children.push(p('购房全流程进度追踪 + 数据导出分享。[P2] [拓展]'));
children.push(makeTable(['#', '功能', '说明'], [
  ['1', '购房流程进度条', '从"需求确认→线上筛选→实地看房→对比决策→贷款预审→签约交易→过户缴税→物业交接→装修入住"9步进度追踪'],
  ['2', '下一步提示', '根据当前进度，提示下一步该做什么、需要准备什么材料'],
  ['3', '数据导出', '导出看房记录为PDF（给家人看）或Excel（自行分析），包含房源信息+观后感+对比结果'],
  ['4', '决策报告导出', '导出M6智能对比的决策报告，含对比矩阵+评分+AI建议']
]));

// === 数据模型 ===
children.push(h1('数据模型设计'));
children.push(h2('房源记录 (HouseRecord) 字段定义'));
children.push(makeTable(['字段名', '类型', '说明'], [
  ['id', 'string (UUID)', '记录唯一ID'],
  ['userId', 'string', '用户ID'],
  ['communityName', 'string', '小区名称'],
  ['district', 'enum', '区域（鼓楼/玄武/建邺...）'],
  ['address', 'string', '详细地址'],
  ['propertyType', 'enum', '新房/二手房'],
  ['rooms', 'object', '{bedrooms, livingRooms, bathrooms}'],
  ['area', 'number', '建筑面积(㎡)'],
  ['floor', 'object', '{current, total, zone}'],
  ['orientation', 'enum', '朝向（南/东南/东/...）'],
  ['isNorthSouthTransparent', 'boolean', '是否南北通透'],
  ['hasElevator', 'boolean', '是否有电梯'],
  ['buildYear', 'number', '建成年代'],
  ['totalPrice', 'number', '总价（万元）'],
  ['unitPrice', 'number', '单价（元/㎡）'],
  ['decoration', 'enum', '毛坯/简装/精装/豪装'],
  ['developer', 'string', '开发商'],
  ['propertyManagement', 'string', '物业公司'],
  ['propertyRights', 'number', '产权年限（70/40）'],
  ['isFiveYearUnique', 'boolean', '满五唯一（二手房）'],
  ['viewingDate', 'date', '看房日期'],
  ['source', 'enum', '房源来源'],
  ['overallRating', 'number', '总体评分(1-5)'],
  ['dimRatings', 'object', '分维度评分{lighting, ventilation, noise, layout, facility, commute}'],
  ['pros', 'text', '优势记录'],
  ['cons', 'text', '缺点记录'],
  ['intention', 'enum', '意向程度'],
  ['nextAction', 'enum', '后续计划'],
  ['summary', 'string', '一句话总结（限50字）'],
  ['photos', 'array', '照片数组[{url, tag, note}]'],
  ['checklist', 'object', '实地检查清单结果'],
  ['createdAt', 'datetime', '记录创建时间'],
  ['updatedAt', 'datetime', '最后更新时间']
]));
children.push(spacer());
children.push(h2('购房期望 (Expectation) 字段定义'));
children.push(makeTable(['字段名', '类型', '说明'], [
  ['id', 'string', '档案ID'],
  ['userId', 'string', '用户ID'],
  ['budgetMin', 'number', '预算下限（万）'],
  ['budgetMax', 'number', '预算上限（万）'],
  ['downPayment', 'number', '首付能力（万）'],
  ['needLoan', 'boolean', '是否需要贷款'],
  ['loanAmount', 'number', '贷款金额（万）'],
  ['loanType', 'enum', '首套/二套'],
  ['monthlyPaymentMax', 'number', '月供上限（元）'],
  ['roomsNeeded', 'object', '{bedrooms, livingRooms, bathrooms}'],
  ['areaMin', 'number', '最小面积'],
  ['areaMax', 'number', '最大面积'],
  ['propertyPreference', 'enum', '新房/二手房/都接受'],
  ['mustHaves', 'array', '硬性要求列表'],
  ['preferredDistricts', 'array', '意向区域列表'],
  ['workplace', 'string', '工作地点'],
  ['partnerWorkplace', 'string', '伴侣工作地点'],
  ['maxCommuteTime', 'number', '可接受通勤时长（分钟）'],
  ['targetDate', 'enum', '预计购房时间'],
  ['moveInDate', 'string', '期望入住时间'],
  ['renovationBudget', 'number', '装修预算（万）'],
  ['notes', 'text', '其他备注']
]));

// === 技术方案 ===
children.push(h1('技术方案建议'));
children.push(h2('技术选型建议'));
children.push(makeTable(['层级', '方案', '理由'], [
  ['前端框架', '原生HTML/CSS/JS 或 Vue3 CDN版', '轻量，无需构建，可直接在浏览器运行'],
  ['数据存储', 'localStorage（P0）+ 后端JSON（P1）', 'P0纯本地运行零依赖，P1增加后端同步和多设备支持'],
  ['后端服务', 'TRAE托管（Node.js/Python）', 'AI分析、定时任务、房源数据抓取'],
  ['地图服务', '高德地图 JS API', '免费额度充足，通勤计算+周边配套'],
  ['AI分析', 'TRAE内置大模型', '房源对比分析、区域发展评估、决策建议'],
  ['推送通知', '浏览器Notification API + TRAE定时任务', '看房提醒、每月房源推送'],
  ['数据导出', 'jsPDF + SheetJS', 'PDF导出给家人，Excel导出自用']
]));
children.push(spacer());
children.push(h2('分阶段实施建议'));
children.push(makeTable(['阶段', '内容', '说明'], [
  ['Phase 1：本地可用版 (P0)', '纯前端HTML/CSS/JS + localStorage', '实现M1房源记录、M2期望档案、M3日程表、M4待看提醒。无需后端，打开浏览器即用'],
  ['Phase 2：智能增强版 (P1)', '接入TRAE后端', '实现M5房源推荐、M6智能对比（AI分析）、M7个人画像、M8财务工具、M9区位分析（地图API）'],
  ['Phase 3：完善拓展版 (P2)', '按需迭代', '实现M10对比矩阵+检查清单、M11流程追踪+数据导出。优化交互体验，增加数据同步和分享功能']
]));

// === 开发优先级 ===
children.push(h1('开发优先级与里程碑'));
children.push(h2('Phase 1 — 核心可用版（P0，建议2周内完成）'));
children.push(makeTable(['模块', '功能点', '交付物'], [
  ['M1 房源记录', '房源信息卡 + 观后感卡', '新增/编辑/删除房源记录'],
  ['M2 购房期望', '期望档案表单', '可编辑的偏好档案'],
  ['M3 看房日程', '月视图日历 + 日期钻取', '日历展示看房记录'],
  ['M4 待看提醒', '创建计划 + 提醒', '计划列表 + 浏览器通知']
]));
children.push(spacer());
children.push(h2('Phase 2 — 智能增强版（P1，建议3-4周完成）'));
children.push(makeTable(['模块', '功能点', '交付物'], [
  ['M5 房源推荐', '区域筛选 + 期望匹配', '推荐列表 + 收藏功能'],
  ['M6 智能对比', '对比矩阵 + 期望匹配度 + AI建议', '对比报告 + 决策建议'],
  ['M7 个人画像', '统计 + 偏好分析 + 仪表盘', '可视化仪表盘'],
  ['M8 财务工具', '月供/全成本/议价/税费计算器', '四大财务计算器'],
  ['M9 区位分析', '通勤/学区/配套/趋势', '地图集成 + 趋势图']
]));
children.push(spacer());
children.push(h2('Phase 3 — 完善拓展版（P2，按需迭代）'));
children.push(makeTable(['模块', '功能点', '交付物'], [
  ['M10 看房辅助', '对比矩阵 + 实地检查清单', '看房标准化工具'],
  ['M11 流程导出', '进度追踪 + PDF/Excel导出', '流程管理 + 数据导出']
]));
children.push(note('下一步行动：需求文档确认后，建议立即启动 Phase 1 开发。Phase 1 为纯前端实现，无需后端，用户打开浏览器即可使用，能快速满足"线下看房实时记录"的核心痛点。Phase 2/3 按需迭代。'));
children.push(spacer());
children.push(h2('非功能性需求'));
children.push(makeTable(['类别', '要求'], [
  ['性能', '页面加载<2s，记录保存<500ms，日历渲染<1s'],
  ['数据安全', '本地数据加密存储，后端数据传输HTTPS，不泄露用户隐私'],
  ['离线可用', 'P0模块完全离线可用，无需网络'],
  ['响应式', '适配手机/平板/桌面，手机优先（看房时用手机记录）'],
  ['浏览器兼容', 'Chrome/Edge/Safari/Firefox 最新版'],
  ['数据备份', '支持手动导出JSON备份，防止数据丢失']
]));

// === Footer ===
children.push(spacer());
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { before: 400 },
  children: [new TextRun({ text: '本需求文档基于用户购房实际需求梳理，结合南京2026年房地产市场现状和首次购房常见痛点编写。', font: CJK, size: 18, italics: true })]
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  children: [new TextRun({ text: 'Generated by Trae Work · 2026年8月', font: CJK, size: 18, italics: true })]
}));

// === Build Document ===
const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: CJK, size: 21 }
      }
    },
    paragraphStyles: [
      {
        id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 32, bold: true, font: CJK, color: '1A2744' },
        paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0, keepNext: false, keepLines: false }
      },
      {
        id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 26, bold: true, font: CJK, color: '3B5BDB' },
        paragraph: { spacing: { before: 280, after: 160 }, outlineLevel: 1, keepNext: false, keepLines: false }
      },
      {
        id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 22, bold: true, font: CJK, color: '2BAE66' },
        paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 2, keepNext: false, keepLines: false }
      }
    ]
  },
  sections: [{
    properties: {
      page: {
        size: { width: 11906, height: 16838 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
      }
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: '南京看房记录工具 PRD', font: CJK, size: 16, color: '999999' })]
        })]
      })
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: '第 ', font: CJK, size: 16, color: '999999' }),
            new TextRun({ children: [PageNumber.CURRENT], font: CJK, size: 16, color: '999999' }),
            new TextRun({ text: ' 页', font: CJK, size: 16, color: '999999' })
          ]
        })]
      })
    },
    children
  }]
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('e:\\trae\\个人\\house-hunter-prd\\南京看房记录工具-PRD需求文档.docx', buffer);
  console.log('DOCX generated successfully');
});
