var inherits = require('util').inherits;
var Transform = require('stream').Transform;

module.exports = Peer;
inherits(Peer, Transform);

function Peer (cid, token) {
  if (!(this instanceof Peer)) return new Peer(cid, token);
  Transform.call(this, { objectMode: true });
  
  this.cid = cid;
  this.token = token;
  this.isInitiator = false;
}

Peer.prototype._transform = function (row, enc, cb) {
  this.push(serialize(row));
  cb();
};

Peer.prototype.destroy = function (err) {
  if (this._destroyed) return;

  this._destroyed = true;
  var self = this;

  process.nextTick(function () {
    if (err)
      self.write(serialize({ event: 'error', data: { message: err.message } }));
    self.emit('end');
    self.emit('close');
  });
};

function serialize (row) {
  var s = '';
  if (row.event)
    s += 'event: ' + row.event + '\n';
  s += 'data: ' + JSON.stringify(row.data) + '\n\n';
  return s;
}
