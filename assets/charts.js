(function() {
  var style = getComputedStyle(document.documentElement);
  var accent = style.getPropertyValue('--accent').trim();
  var accent2 = style.getPropertyValue('--accent2').trim();
  var ink = style.getPropertyValue('--ink').trim();
  var muted = style.getPropertyValue('--muted').trim();
  var rule = style.getPropertyValue('--rule').trim();
  var bg2 = style.getPropertyValue('--bg2').trim();
  var warn = style.getPropertyValue('--warn').trim();

  // --- Chart: Dashboard Mockup ---
  var dashEl = document.getElementById('chart-dashboard');
  if (dashEl) {
    var dashChart = echarts.init(dashEl, null, { renderer: 'svg' });
    dashChart.setOption({
      animation: false,
      title: { text: '个人购房画像 · 示例', left: 'center', top: 10, textStyle: { color: ink, fontSize: 14, fontWeight: 700 } },
      tooltip: { trigger: 'item', appendToBody: true },
      legend: { bottom: 0, textStyle: { color: muted, fontSize: 12 } },
      grid: { left: '8%', right: '52%', top: '15%', bottom: '20%' },
      xAxis: { type: 'category', data: ['江宁', '浦口', '栖霞', '六合', '雨花台'], axisLine: { lineStyle: { color: rule } }, axisLabel: { color: muted, fontSize: 11 } },
      yAxis: { type: 'value', axisLine: { show: false }, axisLabel: { color: muted, fontSize: 11 }, splitLine: { lineStyle: { color: rule, type: 'dashed' } } },
      series: [
        {
          name: '已看', type: 'bar', barWidth: '30%',
          data: [5, 3, 2, 1, 2],
          itemStyle: { color: accent, borderRadius: [4, 4, 0, 0] }
        },
        {
          name: '意向', type: 'bar', barWidth: '30%',
          data: [2, 1, 1, 0, 1],
          itemStyle: { color: accent2, borderRadius: [4, 4, 0, 0] }
        },
        {
          name: '区域偏好',
          type: 'pie',
          radius: ['25%', '40%'],
          center: ['72%', '50%'],
          data: [
            { value: 35, name: '江宁', itemStyle: { color: accent } },
            { value: 25, name: '浦口', itemStyle: { color: accent2 } },
            { value: 20, name: '栖霞', itemStyle: { color: warn } },
            { value: 12, name: '雨花台', itemStyle: { color: '#8B5CF6' } },
            { value: 8, name: '六合', itemStyle: { color: muted } }
          ],
          label: { color: ink, fontSize: 11 }
        }
      ]
    });
    window.addEventListener('resize', function() { dashChart.resize(); });
  }

  // --- Chart: Priority Distribution ---
  var priEl = document.getElementById('chart-priority');
  if (priEl) {
    var priChart = echarts.init(priEl, null, { renderer: 'svg' });
    priChart.setOption({
      animation: false,
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, appendToBody: true },
      legend: { bottom: 0, textStyle: { color: muted, fontSize: 12 }, data: ['功能点数量', '优先级'] },
      grid: { left: 80, right: 50, top: 20, bottom: 60 },
      xAxis: {
        type: 'value',
        axisLine: { show: false },
        axisLabel: { color: muted, fontSize: 11 },
        splitLine: { lineStyle: { color: rule, type: 'dashed' } }
      },
      yAxis: {
        type: 'category',
        data: ['M11 流程导出', 'M10 看房辅助', 'M9 区位分析', 'M8 财务工具', 'M7 个人画像', 'M6 智能对比', 'M5 房源推荐', 'M4 待看提醒', 'M3 看房日程', 'M2 购房期望', 'M1 房源记录'],
        axisLine: { lineStyle: { color: rule } },
        axisLabel: { color: ink, fontSize: 12, fontWeight: 500 },
        axisTick: { show: false }
      },
      series: [{
        name: '功能点数量',
        type: 'bar',
        data: [
          { value: 4, itemStyle: { color: '#DBEAFE' } },
          { value: 2, itemStyle: { color: '#DBEAFE' } },
          { value: 4, itemStyle: { color: '#FEF3C7' } },
          { value: 4, itemStyle: { color: '#FEF3C7' } },
          { value: 6, itemStyle: { color: '#FEF3C7' } },
          { value: 6, itemStyle: { color: '#FEF3C7' } },
          { value: 6, itemStyle: { color: '#FEF3C7' } },
          { value: 6, itemStyle: { color: '#FEE2E2' } },
          { value: 6, itemStyle: { color: '#FEE2E2' } },
          { value: 14, itemStyle: { color: '#FEE2E2' } },
          { value: 25, itemStyle: { color: '#FEE2E2' } }
        ],
        barWidth: '55%',
        label: { show: true, position: 'right', color: ink, fontSize: 11, fontWeight: 600 }
      }]
    });
    window.addEventListener('resize', function() { priChart.resize(); });
  }

  // --- Mermaid Init ---
  if (typeof mermaid !== 'undefined') {
    mermaid.initialize({ startOnLoad: true, theme: 'neutral', securityLevel: 'loose' });
  }
})();
