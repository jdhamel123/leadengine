/**
 * Portable Postgres implementation of the database portion of the
 * MarginMatch platform contract.
 *
 * It intentionally stores records as JSONB so existing collection names
 * and record shapes survive the first migration unchanged.
 */

type RecordValue = Record<string, unknown>;

type PostgrestRow = {
  id: string;
  record: RecordValue;
};

const baseUrl = () => {
  const value = process.env.SUPABASE_URL || process.env.POSTGREST_URL;
  if (!value) throw new Error('SUPABASE_URL or POSTGREST_URL is required');
  return value.replace(/\/$/, '');
};

const serviceKey = () => {
  const value =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.POSTGREST_SERVICE_KEY;
  if (!value) throw new Error('Database service credential is required');
  return value;
};

async function request(path: string, init: RequestInit = {}) {
  const key = serviceKey();
  const response = await fetch(baseUrl() + path, {
    ...init,
    headers: {
      apikey: key,
      Authorization: 'Bearer ' + key,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(init.headers || {}),
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error('Postgres adapter request failed: ' + response.status + ' ' + body);
  }
  if (response.status === 204) return [];
  return response.json();
}

function encode(value: string) {
  return encodeURIComponent(value);
}

export const postgresDb = {
  async list<T extends RecordValue>(
    collection: string,
    options: RecordValue = {}
  ): Promise<{ items: Array<T & { id: string }> }> {
    const limit = Math.max(1, Math.min(1000, Number(options.limit || 100)));
    const rows = (await request(
      '/rest/v1/platform_records?collection=eq.' +
        encode(collection) +
        '&select=id,record&order=created_at.desc&limit=' +
        limit
    )) as PostgrestRow[];

    return {
      items: rows.map((row) => ({ ...(row.record as T), id: row.id })),
    };
  },

  async get<T extends RecordValue>(
    collection: string,
    ids: string[]
  ): Promise<Array<(T & { id: string }) | null>> {
    if (!ids.length) return [];
    const rows = (await request(
      '/rest/v1/platform_records?collection=eq.' + encode(collection) +
      '&id=in.(' + ids.map(encode).join(',') + ')' +
      '&select=id,record'
    )) as PostgrestRow[];
    const byId = new Map(rows.map((row) => [row.id, { ...(row.record as T), id: row.id }]));
    return ids.map((id) => byId.get(id) || null);
  },

  async add<T extends RecordValue>(
    collection: string,
    records: T[]
  ): Promise<string[]> {
    if (!records.length) return [];
    const rows = (await request('/rest/v1/platform_records', {
      method: 'POST',
      body: JSON.stringify(records.map((record) => ({ collection, record }))),
    })) as PostgrestRow[];
    return rows.map((row) => row.id);
  },

  async update<T extends RecordValue>(
    collection: string,
    records: Array<{ id: string; record: T }>
  ): Promise<boolean[]> {
    const results: boolean[] = [];
    for (const item of records) {
      const rows = (await request(
        '/rest/v1/platform_records?collection=eq.' +
          encode(collection) +
          '&id=eq.' +
          encode(item.id),
        {
          method: 'PATCH',
          body: JSON.stringify({ record: item.record }),
        }
      )) as PostgrestRow[];
      results.push(rows.length > 0);
    }
    return results;
  },

  async delete(collection: string, ids: string[]): Promise<boolean[]> {
    const results: boolean[] = [];
    for (const id of ids) {
      const rows = (await request(
        '/rest/v1/platform_records?collection=eq.' +
          encode(collection) +
          '&id=eq.' +
          encode(id),
        { method: 'DELETE' }
      )) as PostgrestRow[];
      results.push(rows.length > 0);
    }
    return results;
  },
};
