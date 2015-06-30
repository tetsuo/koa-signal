var hat = require('hat');
var PassThrough = require('stream').PassThrough;
var inherits = require('util').inherits;
var eos = require('end-of-stream');
var Peer = require('./peer');

module.exports = Swarm;
inherits(Swarm, PassThrough);

function Swarm (id) {
  if (!(this instanceof Swarm)) return new Swarm(id);
  PassThrough.call(this, { objectMode: true });

  this.setMaxListeners(Infinity);

  this.id = id;
  this.initiator = null;
  this._rack = hat.rack(128, 16, 4);
  this.peers = {};
  this.tokens = [];
}

Swarm.prototype.join = function () {
  var self = this,
      token = this._rack(),
      peer = Peer(this._rack(), token);

  if (!this.initiator) {
    peer.isInitiator = true;
    this.initiator = peer;
  }

  this.peers[peer.cid] = peer;
  this.tokens.push(token);

  this.pipe(peer);

  eos(peer, function () {
    delete self.peers[peer.cid];
    self.tokens.splice(self.tokens.indexOf(peer.token), 1);

    if (peer.isInitiator) {
      self.initiator = null;
      self._destroyed = true;
      process.nextTick(function () {
        self.emit('end');
        self.emit('close');
      });
      return;
    }

    if (!self.initiator) return;

    self.initiator.write({
      event: 'leave',
      data: { id: self.id, cid: peer.cid }
    });
  });

  return peer;
};
