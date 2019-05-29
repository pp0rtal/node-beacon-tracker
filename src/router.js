const Promise = require('bluebird');

const config = require('../config');
const role = require('../src/role');
const utils = require('../lib/utils');
const logger = require('../lib/logger');
const receiver = require('./aggregator');

const HttpError = require('../lib/errors').HttpError;

module.exports = function(req, res) {
  return Promise.try(() => {
    const url = req.url;
    if (url.startsWith('/notify/') && role.amIMaster) {
      return notify(req)
        .tap(output => logger.log(`[200] ${req.url} ${output}`, logger.VERBOSE))
        .then(output => res.end(JSON.stringify(output)));
    }

    throw new HttpError(404, `Route ${req.url} unknown`);
  })
    .then(json => (res && res.end(JSON.stringify(json)) || json))
    .catch((e) => {
      const code = e.code || 500;
      logger.error(`[${code}] ${req.url} ${e.message}`);
      if (res) {
        res.writeHead(code, { 'content-type': 'application/json' });

        return res.end(JSON.stringify({ error: e.message }));
      }
    });
};

function notify(req) {
  return Promise.try(() => {
    const notifyUrl = req.url.replace(/^\/notify\//, '');
    const params = notifyUrl.split('/');

    // Transmitted /notify/apName/mac/rssi from slave
    if (Object.keys(config.accessPoints).includes(params[0])
      && utils.isMac(params[1])
      && utils.isNumeric(params[2])) {
      return receiver.slaveReport(params[0], params[1], parseFloat(params[2]));
    }

    throw new HttpError(400, `Route ${req.url} invalid`);
  });
}
