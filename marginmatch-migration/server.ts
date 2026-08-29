import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleRequest as handlePortableApi } from './backend/portable-api';

const root = fileURLToPath(new URL('.', import.meta.url));
const dist = join(root, 'dist');
const port = Number(process.env.PORT || 3000);

const mime: Record<string,string> = {
  '.html':'text/html; charset=utf-8',
  '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8',
  '.json':'application/json; charset=utf-8',
  '.svg':'image/svg+xml',
  '.png':'image/png',
  '.jpg':'image/jpeg',
  '.jpeg':'image/jpeg',
  '.webp':'image/webp',
  '.ico':'image/x-icon',
  '.xml':'application/xml; charset=utf-8',
  '.txt':'text/plain; charset=utf-8',
  '.webmanifest':'application/manifest+json'
};

async function nodeToRequest(req: http.IncomingMessage) {
  const origin = 'http://' + (req.headers.host || 'localhost:' + port);
  const url = new URL(req.url || '/', origin);
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const headers = new Headers();
  for (const [key,value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) value.forEach(v=>headers.append(key,v));
    else if (value != null) headers.set(key,String(value));
  }
  return new Request(url, {
    method:req.method || 'GET',
    headers,
    body: ['GET','HEAD'].includes(req.method || 'GET') ? undefined : body
  });
}

async function sendWebResponse(res:http.ServerResponse, response:Response) {
  res.statusCode=response.status;
  response.headers.forEach((v,k)=>res.setHeader(k,v));
  const body=Buffer.from(await response.arrayBuffer());
  res.end(body);
}

async function serveStatic(pathname:string,res:http.ServerResponse) {
  let candidate = normalize(join(dist, pathname === '/' ? 'index.html' : pathname));
  if (!candidate.startsWith(dist)) {
    res.statusCode=400; res.end('Bad request'); return;
  }
  try {
    const s=await stat(candidate);
    if (s.isDirectory()) candidate=join(candidate,'index.html');
    const data=await readFile(candidate);
    res.setHeader('content-type',mime[extname(candidate)] || 'application/octet-stream');
    res.end(data);
  } catch {
    const html=await readFile(join(dist,'index.html'));
    res.setHeader('content-type','text/html; charset=utf-8');
    res.end(html);
  }
}

http.createServer(async (req,res)=>{
  try{
    const origin='http://' + (req.headers.host || 'localhost:' + port);
    const url=new URL(req.url || '/',origin);
    if(url.pathname.startsWith('/api/')){
      const request=await nodeToRequest(req);
      const response=await handlePortableApi(request);
      await sendWebResponse(res,response);
      return;
    }
    await serveStatic(url.pathname,res);
  }catch(error){
    console.error(error);
    res.statusCode=500;
    res.end('Internal server error');
  }
}).listen(port,()=>console.log('MarginMatch portable listening on '+port));
