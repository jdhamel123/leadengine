/**
 * Tiny standards-based HTTP router for the independent runtime.
 * Uses Request/Response so it can be adapted to common serverless hosts.
 */
export type Handler = (request: Request, params: Record<string,string>) =>
  Promise<Response> | Response;

type Route = { method: string; path: string; handler: Handler };
const routes: Route[] = [];

export function route(method: string, path: string, handler: Handler) {
  routes.push({ method: method.toUpperCase(), path, handler });
}

function matchPath(pattern: string, actual: string) {
  const a = actual.split('/').filter(Boolean);
  const p = pattern.split('/').filter(Boolean);
  if (a.length !== p.length) return null;
  const params: Record<string,string> = {};
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(':')) params[p[i].slice(1)] = decodeURIComponent(a[i]);
    else if (p[i] !== a[i]) return null;
  }
  return params;
}

export async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  for (const r of routes) {
    if (r.method !== request.method.toUpperCase()) continue;
    const params = matchPath(r.path, url.pathname);
    if (!params) continue;
    try {
      return await r.handler(request, params);
    } catch (error) {
      if (error instanceof Response) return error;
      console.error(error);
      return Response.json({ error: 'Internal server error' }, { status: 500 });
    }
  }
  return Response.json({ error: 'Not found' }, { status: 404 });
}

export const json = (value: unknown, status = 200) =>
  Response.json(value, { status });
