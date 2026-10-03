'use strict';

const { handle } = require('./server');
const text = require('./text');

const PORT = Number.parseInt(process.env.PORT || '8080', 10);
const HOST = '0.0.0.0';

const server = require('node:http').createServer((req, res) => {
  handle(req, res).catch(() => {
    try {
      if (!res.headersSent) res.writeHead(422, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: { code: 'validation_failed', message: 'The request could not be completed.' } }));
    } catch {
      try {
        res.destroy();
      } catch {
        /* the socket is already gone */
      }
    }
  });
});

server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;
server.maxHeadersCount = 100;
server.requestTimeout = 0;
server.on('clientError', (err, socket) => {
  if (!socket.writable || socket.writableEnded) return;
  const body = JSON.stringify({ error: { code: 'malformed_request', message: text.message('malformed_request') } });
  socket.end(
    'HTTP/1.1 400 Bad Request\r\n' +
      'Content-Type: application/json; charset=utf-8\r\n' +
      'Content-Length: ' + Buffer.byteLength(body) + '\r\n' +
      'Connection: close\r\n\r\n' +
      body,
  );
});

server.listen(PORT, HOST, () => {
  console.log('[tablekeeper] listening on ' + HOST + ':' + PORT);
});

function shutdown() {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

process.on('unhandledRejection', (reason) => {
  console.error('[tablekeeper] unhandled rejection: ' + (reason && reason.stack ? reason.stack : reason));
});

process.on('uncaughtException', (err) => {
  console.error('[tablekeeper] uncaught exception: ' + (err && err.stack ? err.stack : err));
});