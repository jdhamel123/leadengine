import { portableRuntime } from '../backend/portable-runtime';

export default {
  async fetch(_request: Request) {
    const body: Record<string, unknown> = {
      runtime: 'portable-vercel',
      databaseConfigured: Boolean(process.env.SUPABASE_URL || process.env.POSTGREST_URL),
      secretsMode: 'environment',
      aiConfigured: Boolean(process.env.OPENAI_API_KEY),
      authVerifierConfigured: Boolean(process.env.AUTH_VERIFY_URL),
      productionActionsUnlocked: false,
    };

    if (body.databaseConfigured) {
      try {
        await portableRuntime.db.list('ops-health', { limit: 1 });
        body.databaseReachable = true;
      } catch (error) {
        body.databaseReachable = false;
        body.databaseError = error instanceof Error ? error.message : 'unknown';
      }
    }

    return Response.json(body);
  },
};
