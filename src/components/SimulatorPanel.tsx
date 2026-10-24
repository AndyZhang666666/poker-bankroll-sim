"use client";
import ParamSlider from "./ParamSlider";
import BankrollChart from "./BankrollChart";
import { SESSION_OPTIONS } from "@/lib/simulator";
import { editParam } from "@/lib/session";
import { fmtMoney, fmtPct } from "@/lib/hooks";
import type { MonteCarloResult, SimParams } from "@/lib/types";
import styles from "@/styles/Simulator.module.css";
interface Props {
  params: Required<SimParams>;
  setParams: (p: Required<SimParams>) => void;
  mc: MonteCarloResult;
  pending: boolean;
  onRerun: () => void;
  trials: number;
}
const ci = (v: number[]) => `${fmtPct(v[0])}–${fmtPct(v[1])}`;
export default function SimulatorPanel({
  params,
  setParams,
  mc,
  pending,
  onRerun,
  trials,
}: Props) {
  const set = (k: keyof SimParams, v: number) =>
    setParams(editParam(params, k, v));
  const resultParams = mc.params;
  return (
    <div className="layout">
      <aside>
        <section className="panel">
          <h2>输入假设</h2>
          <ParamSlider
            label="起始资金"
            value={params.initialBankroll}
            min={1000}
            max={100000}
            step={1000}
            onChange={(v) => set("initialBankroll", v)}
            format={fmtMoney}
            hint="合成单位，不表示真实账户；调整时保留目标倍数。"
          />
          <ParamSlider
            label="每次基础额度"
            value={params.buyIn}
            min={100}
            max={5000}
            step={100}
            onChange={(v) => set("buyIn", v)}
            format={fmtMoney}
            aside={`${(params.initialBankroll / params.buyIn).toFixed(1)} 个额度`}
            hint="不足这个额度时停止，剩余余额不会被清零。"
          />
          <ParamSlider
            label="目标资金"
            value={params.targetBankroll}
            min={Math.round(params.initialBankroll * 1.1)}
            max={params.initialBankroll * 5}
            step={Math.round(params.initialBankroll * 0.05)}
            onChange={(v) => set("targetBankroll", v)}
            format={fmtMoney}
            aside={`${(params.targetBankroll / params.initialBankroll).toFixed(1)}×`}
            hint="达到后仍继续模拟，用来区分曾经达标与最终达标。"
          />
          <ParamSlider
            label="单场获胜概率假设"
            value={params.winRate}
            min={0.45}
            max={0.65}
            step={0.01}
            onChange={(v) => set("winRate", v)}
            format={(v) => fmtPct(v, 0)}
            hint="人为输入，不是从真实牌局估计的胜率。"
          />
          <ParamSlider
            label="波动程度"
            value={params.variance}
            min={5}
            max={30}
            step={1}
            onChange={(v) => set("variance", v)}
            hint="控制均匀波动的幅度，不是真实收益的统计方差。"
          />
          <div role="group" aria-label="模拟场次">
            <p className="small">模拟场次 · {params.sessions}</p>
            <div className="row wrap">
              {SESSION_OPTIONS.map((n) => (
                <button
                  key={n}
                  className={`btn seg ${params.sessions === n ? "on" : ""}`}
                  aria-pressed={params.sessions === n}
                  onClick={() => set("sessions", n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </section>
        <button
          className="btn primary"
          style={{ width: "100%" }}
          onClick={onRerun}
          disabled={pending}
        >
          {pending ? "正在计算…" : "换种子，看看另一组路径"}
        </button>
        <p className="small">
          每组 {trials.toLocaleString()} 条随机路径。相同参数与种子可复现。
        </p>
      </aside>
      <div aria-busy={pending}>
        <section className="panel">
          <h2>同一假设下，结果会分散到哪里？</h2>
          <p className="small" role="status">
            {pending
              ? "输入已改变，正在重算；以下仍是上一组完整结果。"
              : "结果已更新。"}{" "}
            本组：起始 {fmtMoney(resultParams.initialBankroll)} · 基础额度{" "}
            {fmtMoney(resultParams.buyIn)} · 获胜{" "}
            {fmtPct(resultParams.winRate, 0)} · 波动 {resultParams.variance} ·{" "}
            {resultParams.sessions} 场 · 目标{" "}
            {fmtMoney(resultParams.targetBankroll)} · 种子 {mc.config.seed}
          </p>
          <BankrollChart
            samplePaths={mc.samplePaths}
            medianPath={mc.medianPath}
            p10Path={mc.p10Path}
            p90Path={mc.p90Path}
            target={resultParams.targetBankroll}
            buyIn={resultParams.buyIn}
          />
          <p className="tiny">
            灰线是前 10 条样本；蓝带是每个时点的 10%–90%
            分位，不是某条真实轨迹，也不是均值的置信区间。
          </p>
        </section>
        <section className="panel">
          <h2>达过目标，不等于守住目标</h2>
          <div className={styles.metrics}>
            {[
              {
                k: "额度不足而停止",
                v: mc.bustRate,
                d: `${mc.bustCount} / ${mc.config.trials} 条路径；区间 ${ci(mc.stopInterval)}`,
              },
              {
                k: "曾经达到目标",
                v: mc.everReachTargetRate,
                d: `包含途中达到后又回落；区间 ${ci(mc.everReachInterval)}`,
              },
              {
                k: "最终仍在目标以上",
                v: mc.reachTargetRate,
                d: `只看最后一场余额；区间 ${ci(mc.terminalReachInterval)}`,
              },
            ].map((m) => (
              <div className={styles.metric} key={m.k}>
                <div className={styles.metricLabel}>{m.k}</div>
                <div className={styles.metricValue}>{fmtPct(m.v)}</div>
                <div className={styles.metricDetail}>{m.d}</div>
              </div>
            ))}
          </div>
          <p className="tiny">
            区间为 95% Wilson
            抽样区间，仅描述本次有限随机样本的误差；不覆盖假设本身是否真实。余额归零的比例另为{" "}
            {fmtPct(mc.zeroRate)}。
          </p>
        </section>
        <section className="panel">
          <h2>最终分布与回撤</h2>
          <div
            className="tableScroll"
            tabIndex={0}
            role="region"
            aria-label="最终资金分位数表"
          >
            <table>
              <thead>
                <tr>
                  <th>统计量</th>
                  <th className="num">最终余额</th>
                  <th className="num">相对起始</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["10% 分位", mc.p10Final],
                  ["中位数", mc.medianFinal],
                  ["均值", mc.meanFinal],
                  ["90% 分位", mc.p90Final],
                ].map(([name, value]) => (
                  <tr key={name}>
                    <td>{name}</td>
                    <td className="num">{fmtMoney(Number(value))}</td>
                    <td className="num">
                      {(
                        (Number(value) / resultParams.initialBankroll - 1) *
                        100
                      ).toFixed(1)}
                      %
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="note">
            最大回撤中位数 {fmtPct(mc.medianMaxDrawdown)}，90% 分位{" "}
            {fmtPct(mc.p90MaxDrawdown)}。停止场次中位数{" "}
            {mc.medianBustSession === null
              ? "—（本组未出现停止）"
              : mc.medianBustSession === 0
                ? "0（开始时额度已不足）"
                : `第 ${mc.medianBustSession} 场`}
            ，只统计已停止的路径。
          </p>
          <p className="small">
            均值与中位数分别展示，不把模拟路径称作真实玩家。这个模型假设各场独立、无抽水，不用于财务预测或实际下注。
          </p>
        </section>
      </div>
    </div>
  );
}
