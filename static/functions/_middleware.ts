import { isAuthorized } from "../lib/basicAuth";

// Cloudflare Pages Functions middleware: runs before every request (pages and
// assets alike), so the exported template/therapist data is never served
// without the shared password. SITE_PASSWORD is set in the Pages project's
// environment variables — see docs/STATIC_DEPLOY.md. Unset means nobody gets in.
interface Env {
  SITE_PASSWORD?: string;
}

interface PagesContext {
  request: Request;
  env: Env;
  next: () => Promise<Response>;
}

export async function onRequest({ request, env, next }: PagesContext): Promise<Response> {
  if (isAuthorized(request.headers.get("Authorization"), env.SITE_PASSWORD ?? "")) {
    return next();
  }
  return new Response("需要密碼才能使用信件模板系統", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="framing", charset="UTF-8"',
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
