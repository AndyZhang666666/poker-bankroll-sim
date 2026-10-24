"use client";
import { useEffect, useRef } from "react";
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import styles from "@/styles/Simulator.module.css";
Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend,
  Filler,
);
interface Props {
  samplePaths: number[][];
  medianPath: number[];
  p10Path: number[];
  p90Path: number[];
  target: number;
  buyIn: number;
}
export default function BankrollChart({
  samplePaths,
  medianPath,
  p10Path,
  p90Path,
  target,
  buyIn,
}: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const labels = medianPath.map((_, i) => String(i));
    const chart = new Chart(ref.current, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "10%–90% 逐场分位带",
            data: p10Path,
            borderWidth: 0,
            pointRadius: 0,
            fill: "+1",
            backgroundColor: "rgba(29,95,191,.10)",
          },
          {
            label: "90% 分位上界",
            data: p90Path,
            borderWidth: 0,
            pointRadius: 0,
            fill: false,
          },
          ...samplePaths.map((p, i) => ({
            label: `路径 ${i + 1}`,
            data: p,
            borderColor: "rgba(110,125,140,.22)",
            borderWidth: 1,
            pointRadius: 0,
            tension: 0,
          })),
          {
            label: "逐场中位数",
            data: medianPath,
            borderColor: "#1d5fbf",
            borderWidth: 2.5,
            pointRadius: 0,
            tension: 0,
          },
          {
            label: "目标",
            data: labels.map(() => target),
            borderColor: "#283a46",
            borderWidth: 1.5,
            borderDash: [7, 4],
            pointRadius: 0,
          },
          {
            label: "停止门槛",
            data: labels.map(() => buyIn),
            borderColor: "#6b747b",
            borderWidth: 1.5,
            borderDash: [2, 3],
            pointRadius: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: matchMedia("(prefers-reduced-motion: reduce)").matches
            ? 0
            : 200,
        },
        interaction: { mode: "index", intersect: false },
        scales: {
          x: {
            title: { display: true, text: "模拟场次", color: "#58636b" },
            ticks: { maxTicksLimit: 8, color: "#58636b" },
            grid: { display: false },
          },
          y: {
            min: 0,
            title: { display: true, text: "合成筹码单位", color: "#58636b" },
            ticks: {
              color: "#58636b",
              callback: (v) => Number(v).toLocaleString(),
            },
            grid: { color: "#edf0f2" },
          },
        },
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              boxWidth: 18,
              font: { size: 12 },
              color: "#414c55",
              filter: (i) =>
                !i.text.startsWith("路径") && i.text !== "90% 分位上界",
            },
          },
          tooltip: {
            filter: (i) => !String(i.dataset.label).startsWith("路径"),
            callbacks: {
              label: (c) =>
                `${c.dataset.label}：${Math.round(c.parsed.y).toLocaleString()}`,
            },
          },
        },
      },
    });
    return () => chart.destroy();
  }, [samplePaths, medianPath, p10Path, p90Path, target, buyIn]);
  return (
    <div className={styles.chartWrap}>
      <canvas
        ref={ref}
        role="img"
        aria-label="资金轨迹、中位数和逐场10%至90%分位带；完整摘要见下方表格。"
      />
    </div>
  );
}
