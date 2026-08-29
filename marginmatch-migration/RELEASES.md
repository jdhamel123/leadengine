# Portable release process

## Principles

Every release is immutable and versioned. Never deploy `latest` as the only
identifier for production.

Recommended tags:
- semantic version: `v0.1.0`
- commit tag: `sha-<shortsha>`

## Promotion

Set:
- `IMAGE_REPOSITORY`
- `RELEASE_STATE_DIR` (optional; defaults to `.release`)

Then:

`./scripts/promote-release.sh v0.1.0`

Promotion:
1. records the previous version;
2. pulls the requested image;
3. starts the app;
4. runs the deep self-test;
5. automatically rolls back on failure.

## Rollback

`./scripts/rollback-release.sh`

Rollback restores the previously recorded image and reruns deep health.

## Cutover discipline

Do not combine:
- database schema changes,
- live-payment unlock,
- external-message unlock,
- DNS cutover,
- and large application changes

into one release.

Make one reversible change at a time.
