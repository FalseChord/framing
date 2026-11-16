import { isAuthorized } from "./lib/basicAuth";
import { d1TemplateStore, handleTemplateApi, type D1Like } from "./lib/templateApi";

// Cloudflare Worker in front of the static build. wrangler.jsonc sets
// assets.run_worker_first, so this runs before every request — pages, assets and
// /api alike — and nothing is served without the shared password. SITE_PASSWORD
// is a Worker secret (see docs/STATIC_DEPLOY.md); unset means nobody gets in.
interface Env {
  SITE_PASSWORD?: string;
  ASSETS: { fetch(request: Request): Promise<Response> };
  DB: D1Like;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (!isAuthorized(request.headers.get("Authorization"), env.SITE_PASSWORD ?? "")) {
      return new Response("需要密碼才能使用信件模板系統", {
        status: 401,
        headers: {
          "WWW-Authenticate": 'Basic realm="framing", charset="UTF-8"',
          "Content-Type": "text/plain; charset=utf-8",
        },
      });
    }
    const apiResponse = await handleTemplateApi(request, d1TemplateStore(env.DB));
    return apiResponse ?? env.ASSETS.fetch(request);
  },
};
