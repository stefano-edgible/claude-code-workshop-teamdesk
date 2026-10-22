// Production entry: serves the built client files, and hands every other
// request to the Hono app that `vite build` put in dist/server (tRPC, the
// health check and SSR). Run it with `bun run start` after `bun run build`.
import { resolve, sep } from "node:path";
import { file as bunFile, serve } from "bun";

// Loaded by path, not imported, so typechecking works before the first build.
const { default: app } = (await import(
  resolve(import.meta.dir, "dist/server/server.js")
)) as {
  default: { fetch: (request: Request) => Response | Promise<Response> };
};

const CLIENT_DIR = resolve(import.meta.dir, "dist/client");
const port = Number(process.env.PORT ?? 3000);

serve({
  async fetch(request) {
    if (request.method === "GET" || request.method === "HEAD") {
      const path = resolve(CLIENT_DIR, `.${new URL(request.url).pathname}`);
      // Stay inside dist/client; the build's files are fingerprinted.
      if (path.startsWith(CLIENT_DIR + sep)) {
        const file = bunFile(path);
        if (await file.exists()) {
          return new Response(file, {
            headers: path.includes(`${sep}assets${sep}`)
              ? { "cache-control": "public, max-age=31536000, immutable" }
              : {},
          });
        }
      }
    }
    return app.fetch(request);
  },
  hostname: process.env.HOST ?? "0.0.0.0",
  port,
});

console.log(`teamdesk listening on :${port}`);
