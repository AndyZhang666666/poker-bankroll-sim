// 校验 2/2：三个预设场景各跑 10,000 次蒙特卡洛，输出 results/verify.json。
// README 里的所有数字都从这个文件来，不手写。
// 用法：node scripts/verify.mjs

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runMonteCarlo, expectedSessionProfit } from "../src/lib/simulator.js";
import { PRESET_CASES } from "../src/lib/presets.js";
import { ruinProbabilityAnalytic, normalCdf } from "../src/lib/analytic.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TRIALS = 10_000;
const SEED = 20260914;

const pct = (x) => Number((x * 100).toFixed(2));
const money = (x) => Number(x.toFixed(2));

const t0 = Date.now();
const results = PRESET_CASES.map((preset) => {
  const mc = runMonteCarlo(preset.params, { trials: TRIALS, seed: SEED, keepPaths: 0 });
  const analytic = ruinProbabilityAnalytic(preset.params);
  return {
    id: preset.id,
    name: preset.name,
    params: preset.params,
    buyInCount: Math.floor(preset.params.initialBankroll / preset.params.buyIn),
    expectedSessionProfit: money(expectedSessionProfit(preset.params)),
    bustRatePct: pct(mc.bustRate),
    // 布朗运动首次穿越 0 的解析解，用来独立交叉核对蒙特卡洛。
    // 两者吻合 = 模拟没写错；不吻合就说明随机性实现或判定逻辑有问题。
    bustRateAnalyticPct: pct(analytic.prob),
    bustRateDiffPctPoints: pct(Math.abs(mc.bustRate - analytic.prob)),
    reachTargetRatePct: pct(mc.reachTargetRate),
    medianMaxDrawdownPct: pct(mc.medianMaxDrawdown),
    p90MaxDrawdownPct: pct(mc.p90MaxDrawdown),
    medianBustSession: mc.medianBustSession,
    bustCount: mc.bustCount,
    medianFinal: money(mc.medianFinal),
    meanFinal: money(mc.meanFinal),
    p10Final: money(mc.p10Final),
    p90Final: money(mc.p90Final),
  };
});

// 敏感性分析：固定平衡型的其他参数，单独扫买入金额和胜率，看破产率怎么变。
// 这是整个项目最有信息量的一张表 —— 买入从 250 涨到 1000，破产率不是线性上升的。
const balanced = PRESET_CASES.find((c) => c.id === "case2_balanced").params;
const sweepBuyIn = [250, 400, 500, 700, 1000].map((buyIn) => {
  const mc = runMonteCarlo({ ...balanced, buyIn }, { trials: TRIALS, seed: SEED, keepPaths: 0 });
  return {
    buyIn,
    buyInCount: Math.floor(balanced.initialBankroll / buyIn),
    bustRatePct: pct(mc.bustRate),
    reachTargetRatePct: pct(mc.reachTargetRate),
    medianFinal: money(mc.medianFinal),
  };
});
const sweepWinRate = [0.48, 0.5, 0.52, 0.55, 0.6].map((winRate) => {
  const mc = runMonteCarlo({ ...balanced, winRate }, { trials: TRIALS, seed: SEED, keepPaths: 0 });
  return {
    winRatePct: pct(winRate),
    bustRatePct: pct(mc.bustRate),
    reachTargetRatePct: pct(mc.reachTargetRate),
    medianFinal: money(mc.medianFinal),
  };
});

const payload = {
  generatedBy: "scripts/verify.mjs",
  generatedAt: new Date().toISOString().slice(0, 10),
  config: { trials: TRIALS, seed: SEED, note: "同一种子下结果完全可复现" },
  elapsedMs: Date.now() - t0,
  cases: results,
  sensitivity: { buyIn: sweepBuyIn, winRate: sweepWinRate },
};

mkdirSync(resolve(ROOT, "results"), { recursive: true });
writeFileSync(resolve(ROOT, "results/verify.json"), JSON.stringify(payload, null, 2) + "\n");

// 同时按任务书要求把三个场景各写一份独立 JSON，方便外部脚本单独引用。
for (const r of results) {
  writeFileSync(
    resolve(ROOT, `results/${r.id}.json`),
    JSON.stringify(
      {
        generatedBy: "scripts/verify.mjs",
        generatedAt: payload.generatedAt,
        trials: TRIALS,
        seed: SEED,
        ...r,
      },
      null,
      2,
    ) + "\n",
  );
}

console.log(`三场景 × ${TRIALS} 次，耗时 ${payload.elapsedMs}ms\n`);
for (const r of results) {
  console.log(`${r.name}（${r.buyInCount} 个买入，胜率 ${r.params.winRate * 100}%，方差 ${r.params.variance}）`);
  console.log(`  破产率 ${r.bustRatePct}%  达标率 ${r.reachTargetRatePct}%  回撤中位数 ${r.medianMaxDrawdownPct}%`);
  console.log(`  最终资金中位数 ${r.medianFinal}（10% 分位 ${r.p10Final} / 90% 分位 ${r.p90Final}）\n`);
}
console.log("买入敏感性：", sweepBuyIn.map((s) => `${s.buyIn}→${s.bustRatePct}%`).join("  "));
console.log("胜率敏感性：", sweepWinRate.map((s) => `${s.winRatePct}%→${s.bustRatePct}%`).join("  "));
