import assert from "node:assert/strict";
import fs from "node:fs";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const url = process.env.TEST_URL || "http://127.0.0.1:8804/poker-bankroll-sim/";
const out = process.env.EVIDENCE_DIR || "/tmp/bankroll-browser";
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  channel: process.env.CHROME_CHANNEL || "chrome",
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  acceptDownloads: true,
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const input = async (name, value) =>
  page.getByRole("slider", { name, exact: true }).evaluate((e, v) => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    ).set.call(e, String(v));
    e.dispatchEvent(new Event("input", { bubbles: true }));
    e.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
const ready = () =>
  page
    .getByRole("button", { name: "导出本组比较", exact: true })
    .waitFor({ state: "visible" })
    .then(() =>
      page.waitForFunction(() => {
        const b = [...document.querySelectorAll("button")].find(
          (e) => e.textContent === "导出本组比较",
        );
        return b && !b.disabled;
      }),
    );
async function download(name) {
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出本组比较", exact: true }).click();
  const d = await downloading;
  await d.saveAs(out + "/" + name + ".json");
  return JSON.parse(fs.readFileSync(out + "/" + name + ".json", "utf8"));
}
try {
  await page.goto(url + "#not-a-tab");
  await page.waitForLoadState("networkidle");
  await ready();
  assert.ok(
    await page
      .getByRole("slider", { name: "起始资金", exact: true })
      .isVisible(),
  );
  await page.getByRole("button", { name: "恢复默认", exact: true }).click();
  await ready();
  const baseline = await download("default");
  assert.equal(baseline.params.initialBankroll, 10000);
  assert.equal(baseline.config.seed, 20260914);
  assert.ok(
    baseline.results.everReachTargetRate >=
      baseline.results.terminalReachTargetRate,
  );
  await input("起始资金", 100000);
  assert.equal(
    await page
      .getByRole("slider", { name: "目标资金", exact: true })
      .inputValue(),
    "200000",
  );
  assert.ok(
    await page
      .getByRole("button", { name: "导出本组比较", exact: true })
      .isDisabled(),
  );
  assert.match(await page.locator("[aria-busy]").innerText(), /上一组完整结果/);
  await ready();
  const updated = await download("updated");
  assert.equal(updated.params.initialBankroll, 100000);
  assert.equal(updated.params.targetBankroll, 200000);
  await page.reload();
  await page.waitForLoadState("networkidle");
  await ready();
  assert.equal(
    await page
      .getByRole("slider", { name: "起始资金", exact: true })
      .inputValue(),
    "100000",
  );
  await page
    .getByRole("button", { name: "换种子，看看另一组路径", exact: true })
    .click();
  await ready();
  assert.equal((await download("new-seed")).config.seed, 20260915);
  await page.getByRole("button", { name: "恢复默认", exact: true }).click();
  await ready();
  await input("起始资金", 1000);
  await input("每次基础额度", 5000);
  await ready();
  const stopped = await download("initially-stopped");
  assert.equal(stopped.results.stopRate, 1);
  assert.equal(stopped.results.zeroRate, 0);
  assert.equal(stopped.results.medianFinal, 1000);
  assert.equal(stopped.results.medianStopSession, 0);
  await page.getByRole("button", { name: "案例库", exact: true }).click();
  for (const name of ["保守型", "平衡型", "激进型"]) {
    await page
      .getByRole("button", { name: "载入" + name + "参数", exact: true })
      .click();
    await ready();
    await page.getByRole("button", { name: "案例库", exact: true }).click();
  }
  for (const tab of ["模拟器", "风险分析", "案例库", "方法与边界"]) {
    await page.getByRole("button", { name: tab, exact: true }).click();
    if (tab === "风险分析") {
      await page
        .getByRole("heading", { name: "逐点核对", exact: true })
        .waitFor();
      await page
        .getByRole("button", { name: "获胜概率假设", exact: true })
        .click();
      await page.getByRole("button", { name: "波动程度", exact: true }).click();
      await page
        .getByRole("heading", { name: "逐点核对", exact: true })
        .waitFor();
    }
    for (const width of [1440, 768, 390, 360]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.waitForFunction(
        () => document.documentElement.scrollWidth <= innerWidth,
        {},
        { timeout: 2000 },
      );
    }
  }
  await page.getByRole("button", { name: "恢复默认", exact: true }).click();
  await page.getByRole("button", { name: "模拟器", exact: true }).click();
  await ready();
  await page.screenshot({ path: out + "/mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.waitForTimeout(250);
  await page.screenshot({ path: out + "/desktop.png", fullPage: true });
  await page.evaluate(() =>
    localStorage.setItem("poker-bankroll:draft:v1", "{broken"),
  );
  await page.reload();
  await page.waitForLoadState("networkidle");
  await ready();
  assert.match(await page.locator("body").innerText(), /旧草稿无法恢复/);
  await page.evaluate(() => {
    location.hash = "about";
  });
  await page
    .getByRole("heading", { name: "模型先说明白", exact: true })
    .waitFor();
  await page.emulateMedia({ reducedMotion: "reduce" });
  const blocked = await browser.newContext();
  await blocked.addInitScript(() =>
    Object.defineProperty(window, "localStorage", {
      get() {
        throw Error("blocked");
      },
    }),
  );
  const p = await blocked.newPage();
  await p.goto(url);
  await p.waitForLoadState("networkidle");
  assert.match(
    await p.locator("body").innerText(),
    /本地存储不可用|草稿保存失败/,
  );
  await blocked.close();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: no-stale export, parameter/result binding, ratio preservation, snapshot provenance, seed/rerun, retained stop balance, all presets, cancellable scans, 4 tabs × 4 widths, draft recovery, hash fallback, reduced motion; no page errors.",
  );
} finally {
  await browser.close();
}
