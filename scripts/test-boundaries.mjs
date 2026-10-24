import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PARAMS,
  simulatePath,
  runMonteCarlo,
  mulberry32,
  stopSession,
  proportionInterval,
} from "../src/lib/simulator.js";
import { decodeDraft, editParam, snapshot } from "../src/lib/session.js";
import { ruinProbabilityAnalytic } from "../src/lib/analytic.js";
const base = { ...DEFAULT_PARAMS, sessions: 100 };
test("停止保留余额，并与归零分开", () => {
  const p = {
    ...base,
    initialBankroll: 150,
    buyIn: 100,
    variance: 0,
    sessions: 6,
  };
  const sequence = [0, 0, 1, 0, 1, 0];
  let i = 0;
  const path = simulatePath(p, () => sequence[i++]);
  assert.deepEqual(path, [150, 250, 150, 50, 50, 50, 50]);
  assert.equal(stopSession(path, 100), 3);
  assert.equal(i, 6);
  const mc = runMonteCarlo(
    { ...p, initialBankroll: 50 },
    { trials: 1, seed: 1 },
  );
  assert.equal(mc.bustRate, 1);
  assert.equal(mc.zeroRate, 0);
  assert.equal(mc.medianFinal, 50);
  assert.equal(mc.medianBustSession, 0);
});
test("曾经达标可以后来停止；最终达标不超过曾经达标", () => {
  const mc = runMonteCarlo(
    {
      ...base,
      initialBankroll: 150,
      buyIn: 100,
      variance: 0,
      targetBankroll: 200,
      sessions: 100,
    },
    { trials: 1000, seed: 9, keepPaths: 1000 },
  );
  assert.ok(mc.everReachTargetRate > mc.reachTargetRate);
  assert.ok(mc.bustRate + mc.everReachTargetRate > 1);
  assert.equal(
    mc.everReachTargetRate,
    mc.samplePaths.filter((p) => p.some((v) => v >= 200)).length / 1000,
  );
  assert.equal(
    mc.reachTargetRate,
    mc.samplePaths.filter((p) => p.at(-1) >= 200).length / 1000,
  );
});
test("逐场分位有序，末尾中位数与汇总完全一致", () => {
  const mc = runMonteCarlo(base, { trials: 151, seed: 17 });
  for (let s = 0; s < mc.medianPath.length; s++)
    assert.ok(
      mc.p10Path[s] <= mc.medianPath[s] && mc.medianPath[s] <= mc.p90Path[s],
    );
  assert.equal(mc.medianPath.at(-1), mc.medianFinal);
  assert.equal(mc.p10Path.at(-1), mc.p10Final);
  assert.equal(mc.p90Path.at(-1), mc.p90Final);
});
test("轻量摘要与完整轨迹使用相同随机过程", () => {
  const a = runMonteCarlo(base, { trials: 200, seed: 31, keepPaths: 0 }),
    b = runMonteCarlo(base, {
      trials: 200,
      seed: 31,
      keepPaths: 0,
      trajectories: false,
    });
  for (const k of [
    "bustRate",
    "reachTargetRate",
    "everReachTargetRate",
    "zeroRate",
    "medianFinal",
    "p10Final",
    "p90Final",
    "medianMaxDrawdown",
  ])
    assert.equal(a[k], b[k], k);
  assert.deepEqual(b.medianPath, []);
  assert.deepEqual(b.samplePaths, []);
});
test("同种子同输入完全可复现", () =>
  assert.deepEqual(
    runMonteCarlo(base, { trials: 25, seed: 0 }),
    runMonteCarlo(base, { trials: 25, seed: 0 }),
  ));
test("Wilson 区间不把零次或全部发生写成绝对确定", () => {
  assert.ok(proportionInterval(0, 100)[1] > 0.03);
  assert.ok(proportionInterval(100, 100)[0] < 0.97);
  assert.ok(
    Math.abs(
      proportionInterval(50, 100)[0] - (1 - proportionInterval(50, 100)[1]),
    ) < 1e-12,
  );
  assert.throws(() => proportionInterval(101, 100));
  assert.throws(() => proportionInterval(0, 0));
});
test("拒绝无效输入与可能阻塞浏览器的参数", () => {
  for (const [k, v] of [
    ["initialBankroll", 0],
    ["buyIn", 0],
    ["buyIn", NaN],
    ["winRate", Infinity],
    ["winRate", -1],
    ["variance", -1],
    ["sessions", 1.1],
    ["sessions", 2001],
    ["targetBankroll", null],
  ])
    assert.throws(() => runMonteCarlo({ ...base, [k]: v }));
  for (const options of [
    { trials: 0 },
    { trials: 10001 },
    { seed: -1 },
    { keepPaths: 1001 },
    { trajectories: "yes" },
  ])
    assert.throws(() => runMonteCarlo(base, options));
});
test("起始变化保留目标倍数，不产生目标低于起始的隐藏状态", () => {
  const p = editParam(DEFAULT_PARAMS, "initialBankroll", 100000);
  assert.equal(p.targetBankroll, 200000);
  assert.equal(p.targetBankroll / p.initialBankroll, 2);
  assert.throws(() => editParam(DEFAULT_PARAMS, "__proto__", 1));
});
test("草稿版本、损坏数据和额外字段有明确边界", () => {
  const raw = JSON.stringify({
    version: 1,
    params: { ...DEFAULT_PARAMS, extra: "discard" },
    seed: 0,
  });
  const d = decodeDraft(raw);
  assert.equal(d.seed, 0);
  assert.deepEqual(d.params, DEFAULT_PARAMS);
  assert.equal(decodeDraft("{"), null);
  for (const params of [
    { ...DEFAULT_PARAMS, winRate: null },
    { ...DEFAULT_PARAMS, targetBankroll: 1 },
    { ...DEFAULT_PARAMS, sessions: 2000 },
  ])
    assert.equal(
      decodeDraft(JSON.stringify({ version: 1, params, seed: 1 })),
      null,
    );
  assert.equal(
    decodeDraft(
      JSON.stringify({ version: 2, params: DEFAULT_PARAMS, seed: 1 }),
    ),
    null,
  );
});
test("导出包含种子、模型版本、两种达标定义与抽样区间的限制", () => {
  const mc = runMonteCarlo(base, { trials: 10, seed: 9 });
  const d = snapshot(mc);
  assert.equal(d.config.seed, 9);
  assert.equal(d.results.everReachTargetRate, mc.everReachTargetRate);
  assert.equal(d.results.terminalReachTargetRate, mc.reachTargetRate);
  assert.match(d.limits.join(" "), /不包含/);
});
test("解析近似在确定性极端与高负漂移下保持有限数", () => {
  assert.equal(
    ruinProbabilityAnalytic({ ...base, winRate: 1, variance: 0 }).prob,
    0,
  );
  assert.equal(
    ruinProbabilityAnalytic({ ...base, winRate: 0, variance: 0 }).prob,
    1,
  );
  for (const winRate of [0, 0.01, 0.45, 0.5, 0.65, 0.99, 1])
    for (const variance of [0, 5, 30]) {
      const p = ruinProbabilityAnalytic({
        ...base,
        initialBankroll: 100000,
        buyIn: 100,
        winRate,
        variance,
        sessions: 2000,
      }).prob;
      assert.ok(Number.isFinite(p) && p >= 0 && p <= 1);
    }
});
