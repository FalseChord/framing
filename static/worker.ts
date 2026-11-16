import { isAuthorized } from "./lib/basicAuth";

// Cloudflare Worker in front of the static build. wrangler.jsonc sets
// assets.run_worker_first, so this runs before every request — pages and assets
// alike — and the exported template/therapist data is never served without the
// shared password. SITE_PASSWORD is a Worker secret (see docs/STATIC_DEPLOY.md);
// unset means nobody gets in.
interface Env {
  SITE_PASSWORD?: string;
  ASSETS: { fetch(request: Request): Promise<Response> };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (isAuthorized(request.headers.get("Authorization"), env.SITE_PASSWORD ?? "")) {
      return env.ASSETS.fetch(request);
    }
    return new Response("需要密碼才能使用信件模板系統", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="framing", charset="UTF-8"',
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  },
};
