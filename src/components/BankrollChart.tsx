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
  Filler,
} from "chart.js";
import styles from "@/styles/Simulator.module.css";

// 只注册用得到的模块：Chart.js 4 是 tree-shakable 的，全量注册会让 bundle 大一倍。
Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Filler);

interface Props {
  /** 保留的若干条随机路径 */
  samplePaths: number[][];
  medianPath: number[];
  p10Path: number[];
  p90Path: number[];
  target: number;
  initial: number;
  /** 图例里要标的破产线固定在 0；这个 prop 只是为了让父组件显式传，语义更清楚 */
  showBustLine?: boolean;
}

export default function BankrollChart({
  samplePaths,
  medianPath,
  p10Path,
  p90Path,
  target,
  initial,
  showBustLine = true,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const labels = medianPath.map((_, i) => String(i));

    // 只画 10% 分位带的填充（浅蓝），不画 90% 分位线 ——三条参考线加 10 条路径会糊成一团
    const bandFill = {
      labels,
      datasets: [
        {
          label: "__band",
          data: p10Path,
          borderWidth: 0,
          pointRadius: 0,
          fill: "+1" as const, // 填充到下一个 dataset
          backgroundColor: "rgba(43, 76, 126, 0.07)",
        },
      ],
    };

    const ghostDatasets = samplePaths.map((p, i) => ({
      label: `路径 ${i + 1}`,
      data: p,
      borderColor: "rgba(185, 195, 209, 0.62)",
      borderWidth: 1,
      pointRadius: 0,
      tension: 0.15,
      // 只有第一条显示在图例里，否则图例会被 10 条路径塞满
      hidden: false,
    }));

    const data = {
      labels,
      datasets: [
        ...bandFill.datasets,
        ...ghostDatasets,
        {
          label: "中位数路径",
          data: medianPath,
          borderColor: "#2b4c7e",
          borderWidth: 2.4,
          pointRadius: 0,
          tension: 0.15,
        },
        {
          label: "目标资金",
          data: labels.map(() => target),
          borderColor: "#2f7d4f",
          borderWidth: 1.4,
          borderDash: [6, 4],
          pointRadius: 0,
        },
        {
          label: "破产线",
          data: labels.map(() => 0),
          borderColor: "#c0392b",
          borderWidth: 1.4,
          borderDash: [6, 4],
          pointRadius: 0,
        },
      ],
    };

    // 图例只保留有意义的四项，鬼影路径不占位
    const legendLabels = {
      filter: (item: { text: string }) => !item.text.startsWith("路径"),
    };

    chartRef.current?.destroy();
    chartRef.current = new Chart(ctx, {
      type: "line",
      data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 600 },
        interaction: { mode: "index", intersect: false },
        scales: {
          x: {
            title: { display: true, text: "场次", font: { size: 11 }, color: "#a19b93" },
            ticks: { maxTicksLimit: 11, font: { size: 11 }, color: "#a19b93" },
            grid: { color: "#f2f0ec" },
          },
          y: {
            title: { display: true, text: "资金余额", font: { size: 11 }, color: "#a19b93" },
            ticks: {
              font: { size: 11 },
              color: "#a19b93",
              callback: (v: string | number) => Number(v).toLocaleString(),
            },
            grid: { color: "#f2f0ec" },
          },
        },
        plugins: {
          legend: {
            position: "top",
            align: "end",
            labels: { boxWidth: 14, boxHeight: 2, font: { size: 11 }, ...legendLabels },
          },
          tooltip: {
            filter: (item: { dataset: { label?: string } }) =>
              item.dataset.label !== "__band" && !String(item.dataset.label).startsWith("路径"),
            callbacks: {
              label: (c: { dataset: { label?: string }; parsed: { y: number } }) =>
                `${c.dataset.label}：${Math.round(c.parsed.y).toLocaleString()}`,
            },
          },
        },
      },
    });

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [samplePaths, medianPath, p10Path, p90Path, target, initial, showBustLine]);

  return (
    <div className={styles.chartWrap}>
      <canvas ref={canvasRef} />
    </div>
  );
}
