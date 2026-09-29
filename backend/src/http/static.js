'use strict';
const fs = require('fs');
const path = require('path');
const config = require('../config');
const { securityHeaders } = require('../security');

const PUBLIC_DIR = config.frontendDir;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
};

function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(String(pathname || '/').split('?')[0]);
  if (rel.includes('\0') || rel.split('/').some((part) => part.startsWith('.'))) {
    res.writeHead(404, securityHeaders());
    return res.end();
  }
  if (rel === '/') rel = '/index.html';
  const filePath = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!filePath.startsWith(PUBLIC_DIR + path.sep) && filePath !== PUBLIC_DIR) {
    res.writeHead(403, securityHeaders());
    return res.end();
  }
  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) {
      if (path.extname(rel)) {
        res.writeHead(404, securityHeaders());
        return res.end();
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', ...securityHeaders(), 'Cache-Control': 'no-cache' });
      return fs.createReadStream(path.join(PUBLIC_DIR, 'index.html')).pipe(res);
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      ...securityHeaders(),
      'Cache-Control': 'no-cache',
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

module.exports = { serveStatic };
