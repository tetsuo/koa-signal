var listen = require('./listen');
var parse = require('co-body');

module.exports = function *(ctx, opts) {
  if ('POST' !== ctx.request.method)
    return yield *listen(ctx);

  var match = /^\/+([a-z0-9]+)$/.exec(ctx.request.path);
  ctx.assert(match, 404);

  var swarm = ctx.swarms[match[1]];
  ctx.assert(swarm, 404);

  var limit = opts.limit || '10kb',
      body = yield parse(ctx, { limit: limit });

  ctx.assert(body.token && (~swarm.tokens.indexOf(body.token)), 401);
  ctx.assert(body.data, 400);

  var stream = swarm;

  if (body.cid) {
    stream = swarm.peers[body.cid];
    ctx.assert(stream, 404);
  }
  
  stream.write({ event: 'signal', data: body.data });

  ctx.response.status = 200;
};
