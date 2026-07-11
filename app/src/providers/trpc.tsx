import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import superjson from "superjson";
import type { AppRouter } from "../../api/router";
import type { ReactNode } from "react";

export const trpc = createTRPCReact<AppRouter>();

const isDev = import.meta.env.DEV;

const queryClient = new QueryClient();
const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        }).then((res) => {
          if (isDev && !res.ok) {
            // 开发模式下静默处理非 2xx 响应（无后端服务器）
            return new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } });
          }
          return res;
        }).catch((err) => {
          if (isDev) {
            // 开发模式下静默处理 tRPC 网络错误（无后端服务器）
            return new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } });
          }
          throw err;
        });
      },
    }),
  ],
});

export function TRPCProvider({ children }: { children: ReactNode }) {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
