var send = require('./lib/send');

module.exports = function (opts) {
  if (!opts) opts = {};

  var swarms = {};

  return serve;

  function *serve (next) {
    this.swarms = swarms;

    yield *next;

    if (this.response.body) return;
    if (404 !== this.response.status) return;

    yield *send(this, opts);
  }
};
