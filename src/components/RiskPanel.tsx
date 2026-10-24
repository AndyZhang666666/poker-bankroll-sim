"use client";
import { useEffect, useMemo, useState } from "react";
import SensitivityChart from "./SensitivityChart";
import { runMonteCarlo } from "@/lib/simulator";
import { fmtMoney, fmtPct } from "@/lib/hooks";
import type { SimParams } from "@/lib/types";
type AxisKey = "buyIn" | "winRate" | "variance" | "sessions";
type Row = {
  v: number;
  stop: number;
  ever: number;
  terminal: number;
  median: number;
};
const AXES: Record<
  AxisKey,
  {
    label: string;
    values: (p: Required<SimParams>) => number[];
    fmt: (v: number) => string;
  }
> = {
  buyIn: {
    label: "基础额度",
    values: (p) => {
      const step = Math.max(50, Math.round(p.initialBankroll / 40 / 50) * 50);
      return Array.from(
        { length: Math.min(24, Math.floor(p.initialBankroll / 3 / step)) },
        (_, i) => (i + 1) * step,
      );
    },
    fmt: fmtMoney,
  },
  winRate: {
    label: "获胜概率假设",
    values: () => [
      0.44, 0.46, 0.48, 0.5, 0.52, 0.54, 0.56, 0.58, 0.6, 0.62, 0.64,
    ],
    fmt: (v) => fmtPct(v, 0),
  },
  variance: {
    label: "波动程度",
    values: () => Array.from({ length: 20 }, (_, i) => 5 + i),
    fmt: String,
  },
  sessions: {
    label: "模拟场次",
    values: () => [50, 100, 200, 300, 500, 700, 1000, 1500, 2000],
    fmt: String,
  },
};
export default function RiskPanel({
  params,
  trials,
}: {
  params: Required<SimParams>;
  trials: number;
}) {
  const [axisKey, setAxisKey] = useState<AxisKey>("buyIn");
  const sweepTrials = Math.max(400, Math.min(trials, 800)),
    axis = AXES[axisKey];
  const values = useMemo(
    () => AXES[axisKey].values(params),
    [axisKey, params.initialBankroll],
  );
  const key = JSON.stringify([axisKey, params, sweepTrials]);
  const [report, setReport] = useState<{ key: string; rows: Row[] } | null>(
      null,
    ),
    [progress, setProgress] = useState(0),
    [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    setProgress(0);
    setError("");
    async function scan() {
      try {
        const rows: Row[] = [];
        for (const v of values) {
          await new Promise((r) => setTimeout(r, 0));
          if (cancelled) return;
          const mc = runMonteCarlo(
            { ...params, [axisKey]: v },
            {
              trials: sweepTrials,
              seed: 20260914,
              keepPaths: 0,
              trajectories: false,
            },
          );
          rows.push({
            v,
            stop: mc.bustRate,
            ever: mc.everReachTargetRate,
            terminal: mc.reachTargetRate,
            median: mc.medianFinal,
          });
          setProgress(rows.length);
        }
        if (!cancelled) setReport({ key, rows });
      } catch (e) {
        if (!cancelled)
          setError(
            e instanceof Error ? e.message : "扫描失败，请重新选择参数。",
          );
      }
    }
    void scan();
    return () => {
      cancelled = true;
    };
  }, [key]);
  const rows = report?.key === key ? report.rows : null;
  const series = useMemo(
    () =>
      rows
        ? [
            {
              label: "额度不足而停止",
              data: rows.map((r) => r.stop * 100),
              color: "#1d5fbf",
            },
            {
              label: "曾经达标",
              data: rows.map((r) => r.ever * 100),
              color: "#283a46",
            },
            {
              label: "最终达标",
              data: rows.map((r) => r.terminal * 100),
              color: "#6b747b",
              dash: true,
            },
          ]
        : [],
    [rows],
  );
  function bracket(limit: number) {
    if (!rows) return null;
    for (let i = 1; i < rows.length; i++)
      if (rows[i - 1].stop < limit && rows[i].stop >= limit)
        return [rows[i - 1].v, rows[i].v];
    return null;
  }
  return (
    <div className="layout">
      <aside>
        <section className="panel">
          <h2>一次只改变一个假设</h2>
          <div className="row wrap" role="group" aria-label="扫描参数">
            {(Object.keys(AXES) as AxisKey[]).map((k) => (
              <button
                key={k}
                className={`btn seg ${axisKey === k ? "on" : ""}`}
                aria-pressed={axisKey === k}
                onClick={() => setAxisKey(k)}
              >
                {AXES[k].label}
              </button>
            ))}
          </div>
          <p className="small">
            其余参数沿用模拟器。每点 {sweepTrials} 条路径，种子固定为
            20260914。各点仍有抽样波动，不能看作精确预测。
          </p>
        </section>
        <section className="panel">
          <h2>门槛只报告采样区间</h2>
          {axisKey !== "buyIn" ? (
            <p className="small">
              切换到基础额度轴，查看停止比例首次从低于门槛升到门槛以上的相邻采样区间。
            </p>
          ) : !rows ? (
            <p role="status">等待扫描完成…</p>
          ) : (
            <>
              {[0.2, 0.5].map((n) => {
                const b = bracket(n);
                return (
                  <p key={n}>
                    {fmtPct(n, 0)} 门槛：
                    {b ? (
                      <strong>
                        {fmtMoney(b[0])}–{fmtMoney(b[1])}
                      </strong>
                    ) : (
                      "本次采样未观察到向上穿越"
                    )}
                  </p>
                );
              })}
              <p className="tiny">
                不在线性插值后伪装成精确的“安全额度”；未观察到穿越也不代表风险低。
              </p>
            </>
          )}
        </section>
        <section className="panel">
          <h2>为什么分成三条线？</h2>
          <p className="small">
            中途达到目标后，后续仍可能回落或停止。因此“曾经达标”可以与“后来停止”同时发生；“最终达标”一定不高于“曾经达标”。
          </p>
          <p className="small">
            比较的是合成模型的条件结果。输入的获胜概率或收益分布不可信时，增加模拟次数也不能解决模型误差。
          </p>
        </section>
      </aside>
      <div aria-busy={!rows && !error}>
        {error ? (
          <p role="alert">{error}</p>
        ) : !rows ? (
          <section className="panel" role="status">
            正在扫描 {progress} / {values.length} 个点…
            可以切换参数取消本轮扫描。
          </section>
        ) : (
          <>
            <section className="panel">
              <h2>结果如何随{axis.label}变化？</h2>
              <SensitivityChart
                labels={rows.map((r) => axis.fmt(r.v))}
                series={series}
                height={340}
                xTitle={axis.label}
                yTitle="模拟路径占比"
                ySuffix="%"
              />
            </section>
            <section className="panel">
              <h2>逐点核对</h2>
              <div
                className="tableScroll"
                role="region"
                aria-label="参数扫描明细"
                tabIndex={0}
              >
                <table style={{ minWidth: 540 }}>
                  <thead>
                    <tr>
                      <th>{axis.label}</th>
                      <th className="num">停止</th>
                      <th className="num">曾经达标</th>
                      <th className="num">最终达标</th>
                      <th className="num">最终中位数</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr
                        key={r.v}
                        className={r.v === params[axisKey] ? "best" : ""}
                      >
                        <td>{axis.fmt(r.v)}</td>
                        <td className="num">{fmtPct(r.stop)}</td>
                        <td className="num">{fmtPct(r.ever)}</td>
                        <td className="num">{fmtPct(r.terminal)}</td>
                        <td className="num">{fmtMoney(r.median)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="tiny">
                加粗行仅在采样点与当前输入精确相同时显示。表格在窄屏内可横向滚动，不扩大整页。
              </p>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
