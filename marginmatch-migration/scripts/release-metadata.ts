import {writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const version=process.env.RELEASE_VERSION||process.argv[2]||'dev';
const commit=process.env.GIT_COMMIT||process.env.GITHUB_SHA||'unknown';
const builtAt=new Date().toISOString();
const payload={version,commit,builtAt,runtime:'marginmatch-portable'};
const checksum=createHash('sha256').update(JSON.stringify(payload)).digest('hex');
await writeFile('dist/release.json',JSON.stringify({...payload,checksum},null,2));
console.log(JSON.stringify({...payload,checksum}));
