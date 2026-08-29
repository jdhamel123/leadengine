# Migration snapshot format

A snapshot is JSON:

```json
{
  "version": 1,
  "exportedAt": "ISO-8601 timestamp",
  "collections": {
    "orders": [{"id":"uuid","orderNumber":"..."}],
    "customer-leads": []
  }
}
```

The import preserves UUID record IDs when present. This matters because existing
records reference one another by ID.

## Required cutover sequence

1. Export source snapshot without changing source data.
2. Import into an empty or migration-only portable database.
3. Run reconciliation. Every collection must match both record count and SHA-256
   canonical-content hash.
4. Run portable self-tests and workflow tests.
5. Freeze writes briefly for final delta transfer or keep the old runtime live
   until a verified delta method exists.
6. Take a portable pre-cutover snapshot.
7. Move one brand/domain.
8. Preserve the original source and the portable pre-cutover snapshot for rollback.

Do not delete the AppDeploy source database as part of migration.
