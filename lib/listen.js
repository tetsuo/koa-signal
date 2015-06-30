var create = require('./create');

module.exports = function *(ctx) {
  ctx.assert(ctx.accepts('text/event-stream'), 406);

  var match = /^\/+([a-z0-9]+)$/.exec(ctx.request.path);
  if (match) {
    if (!(ctx.state.swarm = ctx.swarms[match[1]]))
      ctx.throw(404);
  } else
    yield *create(ctx);

  ctx.req.setTimeout(Number.MAX_VALUE);
  ctx.type = 'text/event-stream; charset=utf-8';
  ctx.set('Cache-Control', 'no-cache');
  ctx.set('Connection', 'keep-alive');

  var swarm = ctx.state.swarm,
      peer = swarm.join();

  ctx.body = peer;

  peer.write({
    event: 'connect',
    data: {
      id: swarm.id, cid: peer.cid, token: peer.token
    }
  });

  if (peer !== swarm.initiator) {
    setImmediate(function () {
      swarm.initiator.write({
        event: 'join',
        data: { id: swarm.id, cid: peer.cid }
      });
    });
  }
};
