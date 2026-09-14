"use client";

import { useMemo, useState } from "react";
import ParamSlider from "./ParamSlider";
import BankrollChart from "./BankrollChart";
import { SESSION_OPTIONS } from "@/lib/simulator";
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

export default function SimulatorPanel({ params, setParams, mc, pending, onRerun, trials }: Props) {
  const set = <K extends keyof SimParams>(k: K, v: SimParams[K]) => setParams({ ...params, [k]: v } as Required<SimParams>);

  const buyInCount = params.initialBankroll / params.buyIn;
  const target = params.targetBankroll;
  const bankrupt = mc.bustRate >= 0.5;

  // 破产率的粗略直觉：把资金换算成买入个数，个数越少越危险。
  // 这不是精确判据，只是给滑条旁边一句人话，真正的数字在右边指标卡里。
  const riskTag = useMemo(() => {
    if (buyInCount >= 30) return "资金很厚";
    if (buyInCount >= 20) return "够用但不宽裕";
    if (buyInCount >= 10) return "偏薄";
    return "很危险";
  }, [buyInCount]);

  return (
    <div className={styles.layout ?? ""} style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20, alignItems: "start" }}>
      {/* ── 参数区 ── */}
      <div>
        <div className="panel">
          <h2>参数</h2>

          <div className={styles.group}>
            <div className={styles.groupTitle}>资金</div>
            <ParamSlider
              label="起始资金"
              value={params.initialBankroll}
              min={1000}
              max={100000}
              step={1000}
              onChange={(v) => set("initialBankroll", v)}
              format={(v) => fmtMoney(v)}
              hint="你打算为这件事准备多少钱"
            />
            <ParamSlider
              label="每次买入"
              value={params.buyIn}
              min={100}
              max={5000}
              step={100}
              onChange={(v) => set("buyIn", v)}
              format={(v) => fmtMoney(v)}
              aside={`${buyInCount.toFixed(1)} 个买入 · ${riskTag}`}
              hint="一桌上带多少；决定能扛多少个买入的波动"
            />
            <ParamSlider
              label="目标资金"
              value={target}
              min={Math.round(params.initialBankroll * 1.1)}
              max={Math.round(params.initialBankroll * 5)}
              step={Math.round(params.initialBankroll * 0.05) || 100}
              onChange={(v) => set("targetBankroll", v)}
              format={(v) => fmtMoney(v)}
              aside={`${(target / params.initialBankroll).toFixed(1)}×`}
              hint="翻到多少算达标"
            />
          </div>

          <div className={styles.group}>
            <div className={styles.groupTitle}>牌技与波动</div>
            <ParamSlider
              label="胜率"
              value={params.winRate}
              min={0.45}
              max={0.65}
              step={0.01}
              onChange={(v) => set("winRate", v)}
              format={(v) => `${(v * 100).toFixed(0)}%`}
              hint="单场的赢面。长期盈利的唯一来源就是它 > 50%"
            />
            <ParamSlider
              label="波动程度"
              value={params.variance}
              min={5}
              max={30}
              step={1}
              onChange={(v) => set("variance", v)}
              format={(v) => String(v)}
              aside={`方差因子 ${(params.variance / 10).toFixed(1)}`}
              hint="数字越大单场输赢越极端；5 很稳，30 像坐过山车"
            />
          </div>

          <div className={styles.group} style={{ marginBottom: 0 }}>
            <div className={styles.groupTitle}>模拟设置</div>
            <div className={styles.field}>
              <span className={styles.fieldHead}>
                <span>模拟场次</span>
                <b>{params.sessions}</b>
              </span>
              <div className="row tight">
                {SESSION_OPTIONS.map((n) => (
                  <button
                    key={n}
                    className={`btn seg ${params.sessions === n ? "on" : ""}`}
                    onClick={() => set("sessions", n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <p className="small" style={{ marginBottom: 0 }}>
              每次读数跑 <b>{trials.toLocaleString()}</b> 条路径。
            </p>
          </div>
        </div>

        <button className="btn primary" style={{ width: "100%" }} onClick={onRerun} disabled={pending}>
          {pending ? <span className={styles.loading} /> : null}
          {pending ? "重算中…" : "重新模拟（换一组随机路径）"}
        </button>
      </div>

      {/* ── 结果区 ── */}
      <div>
        <div className="panel">
          <div className="row between" style={{ marginBottom: 12 }}>
            <h2 style={{ margin: 0 }}>资金曲线</h2>
            <span className="tiny">
              灰色是实际跑出来的随机路径 · 深蓝是 {mc.medianPath.length - 1} 场的中位数
            </span>
          </div>
          <BankrollChart
            samplePaths={mc.samplePaths}
            medianPath={mc.medianPath}
            p10Path={mc.p10Path}
            p90Path={mc.p90Path}
            target={target}
            initial={params.initialBankroll}
          />
        </div>

        <div className={styles.metrics}>
          <div className={`${styles.metric} ${mc.bustRate > 0.2 ? "bad" : mc.bustRate < 0.05 ? "good" : "neutral"}`}>
            <div className="k">破产概率</div>
            <div className="v">
              {fmtPct(mc.bustRate)}
              <small>/{mc.config.trials.toLocaleString()} 次</small>
            </div>
            <div className="d">
              {mc.bustCount.toLocaleString()} 条路径打光了
            </div>
          </div>

          <div className={`${styles.metric} ${mc.reachTargetRate > 0.5 ? "good" : "neutral"}`}>
            <div className="k">达成目标概率</div>
            <div className="v">{fmtPct(mc.reachTargetRate)}</div>
            <div className="d">摸到 {fmtMoney(target)} 以上</div>
          </div>

          <div className={styles.metric + " neutral"}>
            <div className="k">最大回撤（中位数）</div>
            <div className="v">
              {fmtPct(mc.medianMaxDrawdown, 0)}
            </div>
            <div className="d">90% 的人不超过 {fmtPct(mc.p90MaxDrawdown, 0)}</div>
          </div>

          <div className={styles.metric + " neutral"}>
            <div className="k">破产发生场次</div>
            <div className="v">
              {mc.medianBustSession === null ? "—" : `第 ${Math.round(mc.medianBustSession)} 场`}
            </div>
            <div className="d">
              {mc.medianBustSession === null ? "没有路径破产" : "破产路径的中位数"}
            </div>
          </div>
        </div>

        <div className="panel" style={{ marginTop: 17 }}>
          <h2>最终资金分布</h2>
          <table>
            <thead>
              <tr>
                <th>分位</th>
                <th className="num">最终资金</th>
                <th className="num">相对起始</th>
                <th>含义</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: "10% 分位", v: mc.p10Final, note: "运气差的那一成：跌到这里" },
                { label: "中位数", v: mc.medianFinal, note: "一半人在这以上" },
                { label: "均值", v: mc.meanFinal, note: "被少数大赢路径拉高，通常高于中位数" },
                { label: "90% 分位", v: mc.p90Final, note: "运气好的那一成：涨到这里" },
              ].map((row) => (
                <tr key={row.label}>
                  <td>{row.label}</td>
                  <td className="num">{fmtMoney(row.v)}</td>
                  <td className="num">
                    {row.v === 0 ? "—" : `${((row.v / params.initialBankroll - 1) * 100).toFixed(1)}%`}
                  </td>
                  <td className="tiny">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="note">
            均值 {fmtMoney(mc.meanFinal)} 明显高于中位数 {fmtMoney(mc.medianFinal)} —— 这是破产切断了下行：
            输光的人最多只能输到 0，赢的人可以一路涨上去，所以分布是右偏的。
            <b>看中位数比看均值更接近你的真实预期。</b>
          </div>
          {bankrupt && (
            <div className="note warn" style={{ marginTop: 9 }}>
              破产概率已经超过 50%。在这个参数下，「先输光离场」比「达到目标」更可能先发生 ——
              要么减少买入金额，要么换胜率更高的局，要么先备更厚的资金。
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
