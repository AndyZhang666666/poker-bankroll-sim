// 校验 1/2：对照手算值。每一组都是不看代码、在纸上算就能得出预期值的极端情形。
// 用法：node scripts/check-model.mjs → results/model-check.json

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  mulberry32,
  simulatePath,
  runMonteCarlo,
  maxDrawdown,
  bustSession,
  expectedSessionProfit,
} from "../src/lib/simulator.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cases = [];
const check = (name, expected, actual, tol, note) => {
  const pass =
    expected === null || actual === null
      ? expected === actual
      : Math.abs(expected - actual) <= tol;
  cases.push({ name, expected, actual, tolerance: tol, pass, note });
};

const base = { initialBankroll: 10000, buyIn: 500, winRate: 0.52, variance: 10, sessions: 100 };

// ── A. 胜率 100%、方差 0 → 每场稳赢正好一个买入 ──────────────────────
// 100 场后 = 10000 + 500 × 100 = 60000，永不破产，回撤为 0。
{
  const p = { ...base, winRate: 1, variance: 0 };
  const path = simulatePath(p, mulberry32(1));
  check("胜率100%+方差0：100场后资金 = 10000 + 500×100 = 60000", 60000, path[100], 1e-9, "每场收益恒等于买入");
  check("同上：最大回撤 = 0", 0, maxDrawdown(path), 1e-12, "一路向上没有回撤");
  check("同上：不破产", null, bustSession(path), 0, "");
  const mc = runMonteCarlo(p, { trials: 200, seed: 7 });
  check("同上 · 蒙特卡洛：破产率 = 0", 0, mc.bustRate, 0, "");
  check("同上 · 蒙特卡洛：达标率(目标 20000) = 1", 1, mc.reachTargetRate, 0, "第 20 场就到 20000");
}

// ── B. 胜率 0%、方差 0 → 每场稳输一个买入 ────────────────────────────
// 10000 / 500 = 20 个买入。打完第 20 场资金 = 0，第 21 场判定 current(0) < buyIn → 破产标记。
// 但 path[20] 已经是 0，所以 bustSession 首次为 0 的下标是 20。
{
  const p = { ...base, winRate: 0, variance: 0 };
  const path = simulatePath(p, mulberry32(1));
  check("胜率0%+方差0：第 20 场后资金归零", 0, path[20], 1e-9, "20 个买入打完");
  check("同上：第 19 场后还剩一个买入 500", 500, path[19], 1e-9, "");
  check("同上：破产场次 = 20", 20, bustSession(path), 0, "首次为 0 的下标");
  check("同上：最大回撤 = 100%", 1, maxDrawdown(path), 1e-12, "从峰值 10000 跌到 0");
  const mc = runMonteCarlo(p, { trials: 200, seed: 7 });
  check("同上 · 蒙特卡洛：破产率 = 1", 1, mc.bustRate, 0, "");
  check("同上 · 蒙特卡洛：破产场次中位数 = 20", 20, mc.medianBustSession, 0, "所有路径都在第 20 场破产");
}

// ── C. 起始资金不够一次买入 → 第 1 场就破产 ─────────────────────────
{
  const p = { ...base, initialBankroll: 400 };
  const path = simulatePath(p, mulberry32(1));
  check("起始 400 < 买入 500：第 1 场即破产", 1, bustSession(path), 0, "没钱上桌");
}

// ── D. 单场期望收益的解析解 vs 大样本均值 ──────────────────────────
// E = 买入 × (2p−1) × (1 + f/2)。p=0.52, f=1 → 500 × 0.04 × 1.5 = 30。
// 用 200 万次单场抽样验证，标准误约 0.5，容差取 2。
{
  const p = { ...base };
  const analytic = expectedSessionProfit(p);
  check("单场期望收益解析解 = 500 × (2×0.52−1) × (1+0.5) = 30", 30, analytic, 1e-9, "");
  const rng = mulberry32(42);
  const N = 2_000_000;
  let sum = 0;
  const f = p.variance / 10;
  for (let i = 0; i < N; i++) {
    const win = rng() < p.winRate;
    const fl = rng() * f;
    sum += win ? p.buyIn * (1 + fl) : -p.buyIn * (1 + fl);
  }
  check("200 万次单场抽样均值 ≈ 解析解 30（容差 2）", analytic, sum / N, 2, "验证 rng 均匀性与公式实现一致");
}

// ── E. 确定性：同种子两次结果完全一致 ────────────────────────────────
{
  const a = runMonteCarlo(base, { trials: 300, seed: 123 });
  const b = runMonteCarlo(base, { trials: 300, seed: 123 });
  check("同种子两次 bustRate 完全一致", a.bustRate, b.bustRate, 0, "results/ 可复现的前提");
  check("同种子两次 medianFinal 完全一致", a.medianFinal, b.medianFinal, 0, "");
  const c = runMonteCarlo(base, { trials: 300, seed: 124 });
  check("换种子后 medianFinal 应不同", true, a.medianFinal !== c.medianFinal, 0, "确认种子真的生效");
}

// ── F. 单调性：买入越大破产率不降；胜率越高破产率不升 ─────────────────
{
  const seed = 2026;
  const r250 = runMonteCarlo({ ...base, buyIn: 250 }, { trials: 2000, seed }).bustRate;
  const r500 = runMonteCarlo({ ...base, buyIn: 500 }, { trials: 2000, seed }).bustRate;
  const r1000 = runMonteCarlo({ ...base, buyIn: 1000 }, { trials: 2000, seed }).bustRate;
  check("买入 250 → 500 → 1000，破产率单调不降", true, r250 <= r500 && r500 <= r1000, 0, `${r250} ≤ ${r500} ≤ ${r1000}`);
  const w50 = runMonteCarlo({ ...base, winRate: 0.5 }, { trials: 2000, seed }).bustRate;
  const w55 = runMonteCarlo({ ...base, winRate: 0.55 }, { trials: 2000, seed }).bustRate;
  const w60 = runMonteCarlo({ ...base, winRate: 0.6 }, { trials: 2000, seed }).bustRate;
  check("胜率 50% → 55% → 60%，破产率单调不升", true, w50 >= w55 && w55 >= w60, 0, `${w50} ≥ ${w55} ≥ ${w60}`);
}

// ── G. 破产后路径全为 0，且破产与达标互斥 ──────────────────────────
{
  const mc = runMonteCarlo({ ...base, initialBankroll: 2000, sessions: 300 }, { trials: 500, seed: 9, keepPaths: 500 });
  let ok = true;
  for (const path of mc.samplePaths) {
    const b = bustSession(path);
    if (b !== null) for (let i = b; i < path.length; i++) if (path[i] !== 0) ok = false;
  }
  check("破产后余下场次全部为 0", true, ok, 0, "500 条路径逐个检查");
  check("破产率 + 达标率 ≤ 1", true, mc.bustRate + mc.reachTargetRate <= 1 + 1e-12, 0, `${mc.bustRate} + ${mc.reachTargetRate}`);
}

const passed = cases.filter((c) => c.pass).length;
mkdirSync(resolve(ROOT, "results"), { recursive: true });
writeFileSync(
  resolve(ROOT, "results/model-check.json"),
  JSON.stringify({ generatedBy: "scripts/check-model.mjs", generatedAt: new Date().toISOString().slice(0, 10), summary: { total: cases.length, passed, failed: cases.length - passed }, cases }, null, 2) + "\n",
);
console.log(`手算校验：${passed}/${cases.length} 通过`);
for (const c of cases.filter((x) => !x.pass)) console.log(`  ✗ ${c.name}\n    预期 ${c.expected}，实际 ${c.actual}`);
if (passed < cases.length) process.exit(1);
