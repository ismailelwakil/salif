'use strict';
const config = require('./config');
const { createServer } = require('./server');

const server = createServer();
server.listen(config.port, config.host, () => {
  console.log('سلف backend on http://' + config.host + ':' + config.port);
});
