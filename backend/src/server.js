'use strict';
const http = require('http');
const { createApp } = require('./app');

function createServer() {
  return http.createServer(createApp());
}

module.exports = { createServer, createApp };
