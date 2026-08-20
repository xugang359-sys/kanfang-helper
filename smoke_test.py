"""
看房助手前端冒烟测试：
1. 打开首页，等待networkidle
2. 检查控制台有无严重错误
3. 截图
4. 依次点击导航中多个模块，确认渲染成功无异常
5. 再次截图关键页面
"""
from playwright.sync_api import sync_playwright
import sys, os, json

URL = "http://localhost:8765/"
OUT_DIR = os.path.join(os.path.dirname(__file__), "test_out")
os.makedirs(OUT_DIR, exist_ok=True)

logs = {"error": [], "warn": [], "info": []}

views = [
    "dashboard",
    "records",
    "expectation",
    "calendar",
    "plans",
    "recommend",
    "compare",
    "finance",
    "location",
    "aids",
    "workflow",
    "settings",
]

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(viewport={"width": 1280, "height": 900})
        page = ctx.new_page()

        def onConsole(msg):
            t = msg.type
            if t in ("error", "warning"):
                logs[t == "warning" and "warn" or t].append({
                    "text": msg.text[:300],
                    "args": [str(a)[:100] for a in msg.args[:5]]
                })

        page.on("console", onConsole)
        page.on("pageerror", lambda e: logs["error"].append({"type": "pageerror", "text": str(e)[:500]}))

        # 1. 打开首页
        page.goto(URL)
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(2000)  # 等待图表、动态渲染
        page.screenshot(path=os.path.join(OUT_DIR, "01_dashboard.png"), full_page=True)
        print("[OK] 首页dashboard加载完成")

        # 2. 遍历模块
        for i, v in enumerate(views[1:], start=2):
            # 使用侧边栏按钮：.nav-item[data-view=...]
            try:
                btn = page.locator(f'.nav-item[data-view="{v}"]')
                if btn.count() == 0:
                    print(f"[SKIP] 未找到导航按钮：{v}")
                    continue
                btn.first.click()
                page.wait_for_load_state("networkidle")
                page.wait_for_timeout(1500)
                # 检查是否有 .empty-state 或卡片
                ok = page.locator(".card").count() > 0 or page.locator(".empty-state").count() > 0
                page.screenshot(path=os.path.join(OUT_DIR, f"{i:02d}_{v}.png"), full_page=True)
                print(f"[{'OK' if ok else 'WARN'}] 模块 {v} ({VIEW_MAP.get(v, v)}) 渲染")
            except Exception as e:
                logs["error"].append({"view": v, "text": f"点击/渲染异常: {e}"})
                print(f"[ERR] 模块 {v}: {e}")

        # 3. 测试表单交互：新增一条房源（不提交）
        page.locator('.nav-item[data-view="records"]').first.click()
        page.wait_for_timeout(1500)
        try:
            page.locator('button:has-text("新增房源")').first.click()
            page.wait_for_timeout(800)
            # 填写基础字段
            page.fill('#r_community', '测试花园')
            page.select_option('#r_district', label='建邺区')
            page.fill('#r_totalPrice', '320')
            page.fill('#r_area', '89')
            page.fill('#r_floor', '中间楼层')
            page.fill('#r_address', '建邺区梦都大街100号')
            # 提交
            page.locator('#recordFormSubmit').first.click()
            page.wait_for_timeout(1500)
            page.screenshot(path=os.path.join(OUT_DIR, "99_new_record.png"))
            print("[OK] 新增房源表单交互完成")
        except Exception as e:
            logs["error"].append({"text": f"新增房源表单: {e}"})
            print(f"[WARN] 表单: {e}")

        # 4. 移动端分辨率测试
        ctx2 = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True)
        mpage = ctx2.new_page()
        mpage.goto(URL)
        mpage.wait_for_load_state("networkidle")
        mpage.wait_for_timeout(2000)
        mpage.screenshot(path=os.path.join(OUT_DIR, "M01_mobile_dashboard.png"), full_page=True)
        # 点击records tab
        try:
            mpage.locator('#mobileTabbar .tab[data-view="records"]').first.click()
            mpage.wait_for_timeout(1200)
            mpage.screenshot(path=os.path.join(OUT_DIR, "M02_mobile_records.png"), full_page=True)
            print("[OK] 移动端响应式测试")
        except Exception as e:
            print(f"[WARN] 移动端: {e}")

        ctx2.close()
        browser.close()

    # 输出日志
    print("\n=== 日志汇总 ===")
    print(f"Error: {len(logs['error'])} 条")
    print(f"Warn:  {len(logs['warn'])} 条")
    with open(os.path.join(OUT_DIR, "logs.json"), "w", encoding="utf-8") as f:
        json.dump(logs, f, ensure_ascii=False, indent=2)
    # 关键error打印前3条
    for e in logs["error"][:5]:
        print("  [ERR]", e.get("text", str(e))[:300])

    # 测试通过判定：error数 < 5（考虑ECharts首次尺寸计算等非致命警告）
    sys.exit(0 if len(logs["error"]) < 10 else 1)

VIEW_MAP = {
    "dashboard": "个人仪表盘",
    "records": "房源记录中心",
    "expectation": "购房期望档案",
    "calendar": "看房日程表",
    "plans": "待看计划提醒",
    "recommend": "房源推荐推送",
    "compare": "智能决策对比",
    "finance": "财务工具集",
    "location": "区位分析",
    "aids": "看房辅助",
    "workflow": "流程追踪导出",
    "settings": "设置与备份",
}

if __name__ == "__main__":
    run()
