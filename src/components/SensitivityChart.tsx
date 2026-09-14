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
  BarController,
  BarElement,
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
  BarController,
  BarElement,
);

export interface Series {
  label: string;
  data: number[];
  color: string;
  /** bar 还是 line，默认 line */
  type?: "line" | "bar";
  /** 挂到哪个 y 轴，默认左边 */
  axis?: "y" | "y1";
  dash?: boolean;
  fill?: boolean;
}

interface Props {
  labels: string[];
  series: Series[];
  height?: number;
  xTitle?: string;
  yTitle?: string;
  y1Title?: string;
  /** y 轴刻度后缀，如 "%" */
  ySuffix?: string;
}

// 敏感性分析用的通用图：既要画破产率（左轴，%），又要画最终资金（右轴，元）。
// 两个量纲差两个数量级，必须双轴，否则资金那条线会贴着底边。
export default function SensitivityChart({
  labels,
  series,
  height = 300,
  xTitle,
  yTitle,
  y1Title,
  ySuffix = "",
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;

    const datasets = series.map((s) => ({
      label: s.label,
      data: s.data,
      borderColor: s.color,
      backgroundColor: s.type === "bar" ? `${s.color}26` : "transparent",
      borderWidth: s.type === "bar" ? 1.2 : 2,
      borderDash: s.dash ? [5, 4] : undefined,
      pointRadius: s.type === "bar" ? 0 : 3,
      pointBackgroundColor: s.color,
      fill: s.fill ?? false,
      tension: 0.2,
      type: s.type ?? "line",
      yAxisID: s.axis ?? "y",
    }));

    chartRef.current?.destroy();
    chartRef.current = new Chart(ctx, {
      type: "line",
      data: { labels, datasets: datasets as never },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 600 },
        interaction: { mode: "index", intersect: false },
        scales: {
          x: {
            title: xTitle ? { display: true, text: xTitle, font: { size: 11 }, color: "#a19b93" } : undefined,
            ticks: { font: { size: 11 }, color: "#a19b93" },
            grid: { color: "#f2f0ec" },
          },
          y: {
            position: "left",
            title: yTitle ? { display: true, text: yTitle, font: { size: 11 }, color: "#a19b93" } : undefined,
            ticks: {
              font: { size: 11 },
              color: "#a19b93",
              callback: (v: string | number) => `${Number(v).toFixed(0)}${ySuffix}`,
            },
            grid: { color: "#f2f0ec" },
          },
          y1: y1Title
            ? {
                position: "right",
                title: { display: true, text: y1Title, font: { size: 11 }, color: "#a19b93" },
                ticks: {
                  font: { size: 11 },
                  color: "#a19b93",
                  callback: (v: string | number) => Number(v).toLocaleString(),
                },
                grid: { drawOnChartArea: false },
              }
            : undefined,
        },
        plugins: {
          legend: {
            position: "top",
            align: "end",
            labels: { boxWidth: 14, boxHeight: 2, font: { size: 11 } },
          },
          tooltip: {
            callbacks: {
              label: (c: { dataset: { label?: string; yAxisID?: string }; parsed: { y: number } }) => {
                const v = c.parsed.y;
                const suffix = c.dataset.yAxisID === "y1" ? "" : ySuffix;
                return `${c.dataset.label}：${suffix ? v.toFixed(1) : Math.round(v).toLocaleString()}${suffix}`;
              },
            },
          },
        },
      },
    });

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [labels, series, xTitle, yTitle, y1Title, ySuffix]);

  return (
    <div style={{ position: "relative", height }}>
      <canvas ref={canvasRef} />
    </div>
  );
}
