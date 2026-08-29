/**
 * Portable runtime pieces that do not depend on AppDeploy.
 *
 * This module is intentionally not the active runtime yet. It lets us build
 * and contract-test the replacement services before switching production.
 */
import { postgresDb } from './platform-postgres';
import { envSecrets } from './secrets-env';

export const portableRuntime = {
  db: postgresDb,
  secrets: envSecrets,
};
