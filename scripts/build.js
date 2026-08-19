const fs = require('node:fs');
const path = require('node:path');
const source = path.join(__dirname, '..', 'public');
const destination = path.join(__dirname, '..', 'dist');
fs.rmSync(destination, { recursive: true, force: true });
fs.cpSync(source, destination, { recursive: true });
console.log('Built LeadEngine to dist/');
