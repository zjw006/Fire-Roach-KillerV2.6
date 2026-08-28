// Cloudflare Workers 全栈入口：静态资源（dist/public） + Hono/trpc API
// 由 wrangler.jsonc 的 main 指向，wrangler 打包；assets 静态站由 env.ASSETS 绑定承载。
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./api/router";
import { createContext } from "./api/context";

const app = new Hono();

app.use(bodyLimit({ maxSize: 50 * 1024 * 1024 }));
app.use("/api/trpc/*", async (c) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
  });
});
app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

export default {
  async fetch(request: Request, env: Record<string, any>): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      return app.fetch(request, env);
    }
    // Workers Static Assets：承载 dist/public，未配置项由 not_found_handling: single-page-application 兜底
    return env.ASSETS.fetch(request);
  },
};