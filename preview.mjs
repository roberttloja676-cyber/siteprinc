import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import worker from './dist/server/index.js';

const port = Number(process.env.ESTONADO_PORT || 4318);
const origin = `http://127.0.0.1:${port}`;

createServer(async (incoming, outgoing) => {
  try {
    const method = incoming.method;
    const body = method === 'GET' || method === 'HEAD' ? {} : { body: Readable.toWeb(incoming), duplex: 'half' };
    const request = new Request(origin + incoming.url, { method, headers: incoming.headers, ...body });
    const response = await worker.fetch(request, process.env);
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    if (response.body) await pipeline(Readable.fromWeb(response.body), outgoing);
    else outgoing.end();
  } catch {
    if (!outgoing.headersSent) outgoing.writeHead(500);
    outgoing.end();
  }
}).listen(port, '127.0.0.1', () => console.log(`Local: ${origin}`));
