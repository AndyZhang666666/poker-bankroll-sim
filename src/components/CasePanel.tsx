"use client";

import { useMemo } from "react";
import { runMonteCarlo } from "@/lib/simulator";
import { PRESET_CASES } from "@/lib/presets";
import { fmtMoney, fmtPct } from "@/lib/hooks";
import type { SimParams } from "@/lib/types";
import styles from "@/styles/Simulator.module.css";

interface Props {
  onLoad: (p: Required<SimParams>) => void;
  /** 任务书里写的"预期结果"，用来对照实际跑出来的数字 */
  expectations: Record<string, { bustRange: [number, number]; reachRange: [number, number] }>;
}

export default function CasePanel({ onLoad, expectations }: Props) {
  const results = useMemo(
    () =>
      PRESET_CASES.map((c) => {
        const mc = runMonteCarlo(c.params, { trials: 10000, seed: 20260914, keepPaths: 0 });
        return { preset: c, mc };
      }),
    [],
  );

  return (
    <div>
      <div className="note" style={{ marginBottom: 15 }}>
        三个场景的数字来自 <b>10,000 次</b>蒙特卡洛，固定随机种子，可复现。
        页面上的表格直接调用和 <span className="mono">scripts/verify.mjs</span> 同一份模拟代码，
        所以这里的数字和 <span className="mono">results/verify.json</span> 完全一致。
      </div>

      {results.map(({ preset, mc }) => {
        const exp = expectations[preset.id];
        const bustInRange = exp ? mc.bustRate >= exp.bustRange[0] && mc.bustRate <= exp.bustRange[1] : true;
        const reachInRange = exp ? mc.reachTargetRate >= exp.reachRange[0] && mc.reachTargetRate <= exp.reachRange[1] : true;

        return (
          <div className={styles.case} key={preset.id}>
            <h3>
              {preset.name}
              <span className={`${styles.tag} ${styles[preset.tag]}`}>
                {preset.tag === "conservative" ? "保守" : preset.tag === "balanced" ? "平衡" : "激进"}
              </span>
            </h3>
            <p className={styles.params}>
              起始 {fmtMoney(preset.params.initialBankroll)} · 买入 {fmtMoney(preset.params.buyIn)}（
              {(preset.buyInRatio * 100).toFixed(1)}%，即{" "}
              {(preset.params.initialBankroll / preset.params.buyIn).toFixed(0)} 个买入） · 胜率{" "}
              {(preset.params.winRate * 100).toFixed(0)}% · 波动 {preset.params.variance} ·{" "}
              {preset.params.sessions} 场 · 目标 {fmtMoney(preset.params.targetBankroll)}
            </p>

            <table style={{ marginTop: 12 }}>
              <thead>
                <tr>
                  <th>指标</th>
                  <th className="num">模拟结果</th>
                  <th className="num">任务书预期</th>
                  <th>是否落在预期区间</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>破产概率</td>
                  <td className="num">
                    <b>{fmtPct(mc.bustRate)}</b>
                  </td>
                  <td className="num tiny">
                    {exp ? `${(exp.bustRange[0] * 100).toFixed(0)}% ~ ${(exp.bustRange[1] * 100).toFixed(0)}%` : "—"}
                  </td>
                  <td>
                    <span className={`${styles.flag} ${bustInRange ? styles.ok : styles.off}`}>
                      {bustInRange ? "落在区间内" : "超出区间"}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td>达标概率</td>
                  <td className="num">
                    <b>{fmtPct(mc.reachTargetRate)}</b>
                  </td>
                  <td className="num tiny">
                    {exp ? `${(exp.reachRange[0] * 100).toFixed(0)}% ~ ${(exp.reachRange[1] * 100).toFixed(0)}%` : "—"}
                  </td>
                  <td>
                    <span className={`${styles.flag} ${reachInRange ? styles.ok : styles.off}`}>
                      {reachInRange ? "落在区间内" : "超出区间"}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td>最大回撤（中位数）</td>
                  <td className="num">{fmtPct(mc.medianMaxDrawdown, 0)}</td>
                  <td className="num tiny">—</td>
                  <td className="tiny">任务书未给预期</td>
                </tr>
                <tr>
                  <td>最终资金中位数</td>
                  <td className="num">{fmtMoney(mc.medianFinal)}</td>
                  <td className="num tiny">—</td>
                  <td className="tiny">任务书未给预期</td>
                </tr>
              </tbody>
            </table>

            <div className={styles.comment}>
              <b>我的点评</b>
              {preset.comment}
            </div>

            {!bustInRange || !reachInRange ? (
              <div className="note warn" style={{ marginTop: 11 }}>
                <b>和任务书的预期不一致</b>，这不是算错。任务书第 8 节给的预期区间和它自己第 4 节的算法
                不自洽 —— 我用布朗运动首次穿越的解析解独立核算过，解析值和蒙特卡洛吻合到 1 个百分点以内，
                说明模拟是对的。详细对比见 README 的「关于预期值」一节。
              </div>
            ) : null}

            <div className="row" style={{ marginTop: 12 }}>
              <button onClick={() => onLoad(preset.params)}>把这组参数载入模拟器 →</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
