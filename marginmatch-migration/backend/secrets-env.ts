/**
 * Standard environment-backed secrets adapter.
 * This is portable across common Node/serverless hosts.
 */

export const envSecrets = {
  async readSecret(name: string): Promise<string> {
    const value = process.env[name];
    if (!value) throw new Error('Missing required secret: ' + name);
    return value;
  },

  async listSecretNames(): Promise<string[]> {
    return Object.keys(process.env).filter((key) => Boolean(process.env[key]));
  },
};
