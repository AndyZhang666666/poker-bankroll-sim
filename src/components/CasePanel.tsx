"use client";
import data from "@/../results/verify.json";
import { PRESET_CASES } from "@/lib/presets";
import { fmtMoney, fmtPct } from "@/lib/hooks";
import type { SimParams } from "@/lib/types";
import styles from "@/styles/Simulator.module.css";
export default function CasePanel({
  onLoad,
}: {
  onLoad: (p: Required<SimParams>) => void;
}) {
  return (
    <div>
      <p className="note">
        3 组固定示例，每组 {data.config.trials.toLocaleString()} 条路径、种子{" "}
        {data.config.seed}
        ；结果在构建前生成，不在打开页面时重复运行。它们展示不同的假设组合，不是三个真实玩家，也不是独立验证集。
      </p>
      {PRESET_CASES.map((c, i) => {
        const r = data.cases[i];
        return (
          <section className={styles.case} key={c.id}>
            <h2>{c.name}</h2>
            <p className="small">
              起始 {fmtMoney(c.params.initialBankroll)} · 基础额度{" "}
              {fmtMoney(c.params.buyIn)} · 获胜假设{" "}
              {fmtPct(c.params.winRate, 0)} · 波动 {c.params.variance} ·{" "}
              {c.params.sessions} 场 · 目标 {fmtMoney(c.params.targetBankroll)}
            </p>
            <div
              className="tableScroll"
              role="region"
              aria-label={c.name + "结果"}
              tabIndex={0}
            >
              <table>
                <thead>
                  <tr>
                    <th>额度不足而停止</th>
                    <th>曾经达标</th>
                    <th>最终达标</th>
                    <th>最终余额中位数</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{r.bustRatePct}%</td>
                    <td>{r.everReachTargetRatePct}%</td>
                    <td>{r.reachTargetRatePct}%</td>
                    <td>{fmtMoney(r.medianFinal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="note">{c.comment}</p>
            <button className="btn" onClick={() => onLoad(c.params)}>
              载入{c.name}参数
            </button>
          </section>
        );
      })}
    </div>
  );
}
