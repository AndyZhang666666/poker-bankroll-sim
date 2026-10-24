import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Poker Bankroll Simulator — 德州扑克筹码管理模拟器",
  description:
    "固定种子的合成波动实验：区分额度不足而停止、曾经达标与最终达标。参数本地运行，可导出模型假设与比较记录。",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
