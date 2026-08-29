import { route, handleRequest } from './http-portable';
import { portableRuntime } from './portable-runtime';

route('GET', '/api/health', async () => {
  const checks: Record<string, unknown> = {
    runtime: 'portable',
    databaseConfigured: Boolean(process.env.SUPABASE_URL || process.env.POSTGREST_URL),
    secretsMode: 'environment',
    aiConfigured: Boolean(process.env.OPENAI_API_KEY),
    authVerifierConfigured: Boolean(process.env.AUTH_VERIFY_URL),
    productionActionsUnlocked: false,
  };

  if (checks.databaseConfigured) {
    try {
      await portableRuntime.db.list('ops-health', { limit: 1 });
      checks.databaseReachable = true;
    } catch (error) {
      checks.databaseReachable = false;
      checks.databaseError = error instanceof Error ? error.message : 'unknown';
    }
  }

  return Response.json(checks);
});

export { handleRequest };
