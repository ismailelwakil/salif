'use strict';

function readRaw(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let tooBig = false;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) { tooBig = true; return; }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (tooBig) reject(new Error('payload_too_large'));
      else resolve(Buffer.concat(chunks));
    });
    req.on('error', reject);
  });
}

function readBody(req, limit = 1024 * 200) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) { reject(new Error('payload_too_large')); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(new Error('bad_json')); }
    });
    req.on('error', reject);
  });
}

module.exports = { readRaw, readBody };
