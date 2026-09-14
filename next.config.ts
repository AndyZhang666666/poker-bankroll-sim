import type { NextConfig } from "next";

// GitHub Pages 静态导出。全部计算在浏览器端完成，没有服务端。
// basePath 必须等于仓库名，否则 Pages 上 _next/ 资源全 404。
const repo = "poker-bankroll-sim";

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  basePath: `/${repo}`,
  assetPrefix: `/${repo}/`,
  trailingSlash: true,
};

export default nextConfig;
