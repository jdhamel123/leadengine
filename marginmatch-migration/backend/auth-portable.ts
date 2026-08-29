/**
 * Conservative portable auth helpers.
 * No request is treated as authenticated unless a verified bearer token
 * resolver is configured by the host.
 */
export type PortableUser = { id: string; email?: string };

export async function resolveUser(request: Request): Promise<PortableUser | null> {
  const auth = request.headers.get('authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;

  const verifierUrl = process.env.AUTH_VERIFY_URL;
  if (!verifierUrl) return null;

  const response = await fetch(verifierUrl, {
    headers: { authorization: auth },
  });
  if (!response.ok) return null;

  const data = await response.json() as Record<string, unknown>;
  if (!data.id) return null;
  return {
    id: String(data.id),
    email: data.email ? String(data.email) : undefined,
  };
}

export async function requireUser(request: Request): Promise<PortableUser> {
  const user = await resolveUser(request);
  if (!user) throw new Response('Unauthorized', { status: 401 });
  return user;
}

export async function requireAdmin(request: Request): Promise<PortableUser> {
  const user = await requireUser(request);
  const allowlist = String(process.env.ADMIN_EMAIL_ALLOWLIST || '')
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  if (!user.email || !allowlist.includes(user.email.toLowerCase())) {
    throw new Response('Forbidden', { status: 403 });
  }
  return user;
}
