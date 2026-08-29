# VPS quick start

The bootstrap script targets a fresh Ubuntu/Debian VPS and installs the complete
portable stack from the `marginmatch-migration` branch.

## One-command start

SSH into the VPS and run:

```bash
git clone --branch marginmatch-migration --single-branch https://github.com/jdhamel123/leadengine.git /opt/marginmatch
sudo bash /opt/marginmatch/marginmatch-migration/scripts/bootstrap-vps.sh
```

The script:

- installs Docker + Compose;
- enables the firewall for SSH/HTTP/HTTPS and temporary port 3000;
- generates strong database/storage/admin secrets locally on the VPS;
- never writes generated secrets to GitHub;
- builds the latest portable source;
- starts PostgreSQL, MinIO, MarginMatch, backups, scheduler and Caddy;
- waits for `/api/health`;
- prints temporary IP-based owner/test links.

Generated owner credentials are stored only at:

`/root/.marginmatch/owner-access.txt`

Do not paste that file into chat.

## First-boot safety

Production payments, outbound messaging and legacy portfolio traffic remain
locked. Add external service credentials only after the base stack is healthy.

## DNS cutover

Do not move a production domain during bootstrap. First validate through the
server IP or a temporary hostname, then use Migration Control and self-tests.
