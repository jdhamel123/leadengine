const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { handler } = require('../server');

test('serves the LeadEngine application', async () => {
  const server = http.createServer(handler).listen(0);
  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/`);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /LeadEngine/);
  server.close();
});

test('returns 404 for missing assets', async () => {
  const server = http.createServer(handler).listen(0);
  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/missing.js`);
  assert.equal(response.status, 404);
  server.close();
});
