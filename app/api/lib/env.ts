const IS_WORKER = typeof caches !== "undefined";

// 仅在 Node 运行时加载 .env（Cloudflare Workers 无文件系统，跳过 dotenv 以避免打包 fs）
if (!IS_WORKER) {
  await import("dotenv/config");
}

function required(name: string): string {
  const value = process.env[name];
  // Workers 下允许缺省（APP_ID/DATABASE_URL 以占位值部署，DB/鉴权按请求期失败，由前端静默吞错）；Node 生产则严格校验
  if (!value && !IS_WORKER && process.env.NODE_ENV === "production") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value ?? "";
}

export const env = {
  appId: required("APP_ID"),
  appSecret: required("APP_SECRET"),
  isProduction: process.env.NODE_ENV === "production",
  databaseUrl: required("DATABASE_URL"),
};
