var Swarm = require('./swarm');
var rack = require('hat').rack(128, 16, 4);
var eos = require('end-of-stream');

module.exports = function *(ctx) {
  var id = rack(),
      swarm = Swarm(id);

  ctx.swarms[id] = ctx.state.swarm = swarm;
  ctx.response.status = 201;

  eos(swarm, function () {
    delete ctx.swarms[id];
  });
};
