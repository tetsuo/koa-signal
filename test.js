var test = require('tap').test;
var send = require('./lib/send');
var http = require('http');
var koa = require('koa');
var _request = require('request');
var ssejson = require('ssejson');

var app = koa(),
    swarms = {};

app.use(function *() {
  this.swarms = swarms;
  yield *send(this, {});
}).on('error', function () {});

var server = http.createServer(app.callback());

test('setup', function (t) {
  server.listen(6767, function () { t.end() });
});

test(function (t) {
  var req = request(),
      swarm, peer;

  req
    .on('response', function (res) {
      t.equal(res.statusCode, 201);
      t.equal(res.headers['content-type'],
              'text/event-stream; charset=utf-8');
    })
    .pipe(ssejson.parse('connect'))
    .on('data', function (data) {
      t.equal(Object.keys(swarms).length, 1);
      t.ok('string' === typeof data.id);
      swarm = swarms[data.id];
      t.equal(Object.keys(swarm.peers).length, 1);
      peer = swarm.peers[data.cid];
      t.equal(swarm.initiator, peer);
      t.ok(peer.isInitiator);
      t.equal(data.token, peer.token);
      swarm.on('close', function () {
        t.equal(swarm.initiator, null);
        t.ok(swarm._destroyed);
        t.ok(peer._destroyed);
        t.equal(Object.keys(swarm.peers).length, 0);
        t.equal(swarm.tokens.length, 0);
        t.equal(Object.keys(swarms).length, 0);
        request(swarm.id)
          .on('response', function (res) {
            t.equal(res.statusCode, 404);
            t.end();
          });
      });
      req.abort();
    });
});

test(function (t) {
  var req0 = request(), req1, req2,
      peer0, peer1, peer2;

  req0
    .pipe(ssejson.parse('connect'))
    .on('data', function (data0) {
      peer0 = swarms[data0.id].peers[data0.cid];
      req1 = request(data0.id);
      req1
        .pipe(ssejson.parse('connect'))
        .on('data', function (data1) {
          t.equal(data0.id, data1.id);
          t.notEqual(data0.token, data1.token);
          t.notEqual(data0.cid, data1.cid);
          var swarm = swarms[data1.id];
          swarm.on('close', function () {
            t.equal(Object.keys(swarms).length, 0);
            t.equal(Object.keys(swarm.peers).length, 0);
            t.equal(swarm.tokens.length, 0);
            t.ok(peer0._destroyed);
            t.ok(peer1._destroyed);
            t.ok(peer2._destroyed);
            t.equal(swarm.initiator, null);
            t.end();
          });
          peer1 = swarms[data1.id].peers[data1.cid];
          t.equal(Object.keys(swarms).length, 1);
          t.equal(Object.keys(swarm.peers).length, 2);
          t.notOk(peer1.isInitiator);
          t.ok(peer0.isInitiator);
          t.equal(swarm.initiator, peer0);
          req2 = request(data1.id);
          req2
            .pipe(ssejson.parse('connect'))
            .on('data', function (data2) {
              t.equal(data1.id, data2.id);
              t.equal(Object.keys(swarm.peers).length, 3);
              t.ok(-1 !== swarm.tokens.indexOf(data2.token));
              peer2 = swarms[data2.id].peers[data2.cid];
              peer2.on('close', function () {
                t.equal(Object.keys(swarm.peers).length, 1);
                t.notOk(swarm.peers.hasOwnProperty(data2.cid));
              });
              peer1.on('close', function () {
                t.equal(Object.keys(swarm.peers).length, 2);
                t.ok(peer1._destroyed);
                t.ok(swarm.peers.hasOwnProperty(data2.cid));
                t.notOk(swarm.peers.hasOwnProperty(data1.cid));
                req2.abort();
              });
              req1.abort();
            });
        });
    });

    req0
      .pipe(ssejson.parse('join'))
      .on('data', function (data) {
        if (!peer2) {
          t.equal(data.cid, peer1.cid);
          t.equal(Object.keys(swarms[data.id].peers).length, 2);
        } else {
          t.equal(data.cid, peer2.cid);
          t.equal(Object.keys(swarms[data.id].peers).length, 3);
        }
      });

    req0
      .pipe(ssejson.parse('leave'))
      .on('data', function (data) {
        if (Object.keys(swarms[data.id].peers).length === 1) {
          t.equal(data.cid, peer2.cid);
          req0.abort();
        } else if (Object.keys(swarms[data.id].peers).length === 2) {
          t.equal(data.cid, peer1.cid);
        }
      });
});

test(function (t) {
  var queen = request(),
      len = 10;
  
  t.plan(52);

  function fn (id) {
    for (var i = 0; i < len; ++ i) {
      var req = request(id),
          peer, cid, swarm;

      req
        .pipe(ssejson.parse('connect'))
        .on('data', function (data) {
          cid = data.cid;
          swarm = swarms[data.id];
          peer = swarm.peers[cid];
        });

      req
        .on('end', function () {
          t.notOk(swarm.peers.hasOwnProperty(cid));
          t.ok(peer._destroyed);
          t.equal(Object.keys(swarms).length, 0);
          t.ok(swarm._destroyed);
        });
    }
  }

  queen
    .pipe(ssejson.parse('connect'))
    .on('data', function (data) {
      fn(data.id);
      setTimeout(function () {
        t.ok(swarms[data.id]);
        queen.on('end', function () {
          t.notOk(swarms[data.id]);
        }).abort();
      }, 200);
    });

  queen
    .pipe(ssejson.parse('join'))
    .on('data', function () {
      t.ok(true);
    });

});

test(function (t) {
  var req0 = request(), i = 0;
  t.plan(6);
  function cb (x, res) {
    t.equal(res.statusCode, x, x);
    if (++ i > 5) req0.abort();
  }
  req0
    .pipe(ssejson.parse('connect'))
    .on('data', function (data) {
      request(null, 1).on('response', cb.bind(null, 404));
      request('555', 1).on('response', cb.bind(null, 404));
      request(data.id, { token: 555 })
        .on('response', cb.bind(null, 401));
      request(data.id, { token: data.token })
        .on('response', cb.bind(null, 400));
      request(data.id, { data: new Buffer(15 * 1000),
              token: data.token })
        .on('response', cb.bind(null, 413));
      request(data.id, { data: 555, token: data.token, cid: 555 })
        .on('response', cb.bind(null, 404));
    });
});

test(function (t) {
  var req0 = request(), id, token, next = '555';

  t.plan(5);

  req0
    .pipe(ssejson.parse('connect'))
    .on('data', function (data) {
      id = data.id, token = data.token;

      var cid;

      var req1 = request(data.id)

      req1
        .pipe(ssejson.parse('connect'))
        .on('data', function (data) {
          cid = data.cid;
        });

      req1
        .pipe(ssejson.parse('signal'))
        .on('data', function (data) {
          t.equal(data.x, next);
        });

      setTimeout(function () {
        request(data.id)
          .pipe(ssejson.parse('signal'))
          .on('data', function (data) {
            t.equal(data.x, '555');
            next = '777';
            request(id, {
              token: data.token, cid: cid,
              data: { x: 777 }
            }).on('response', function (res) {
              t.equal(res.statusCode, 200);
              req0.abort();
            });
          });
      }, 200);
    });

  req0
    .pipe(ssejson.parse('signal'))
    .on('data', function (data) {
      t.equal(data.x, '555');
    });

  req0
    .pipe(ssejson.parse('join'))
    .on('data', function (data) {
      if (swarms[id].tokens.length === 3)
        request(id, { token: token, data: { x: 555, token: token } });
    });
});

test(function (t) {
  var req0 = request(), req1, token, id;

  t.plan(1);

  req0
    .pipe(ssejson.parse('connect'))
    .on('data', function (data) {
      id = data.id, token = data.token;
      req1 = request(data.id);
    });

  req0
    .pipe(ssejson.parse('join'))
    .on('data', function (data) {
      req1.abort();
    });

  req0
    .pipe(ssejson.parse('leave'))
    .on('data', function (data) {
      request(id, { token: token,
              data: { x: 555 }, cid: data.cid })
        .on('response', function (res) {
          t.equal(res.statusCode, 404);
          req0.abort();
        });
    });
});

test('cleanup', function (t) {
  server.close(function () { t.end() });
});

function request (id, form) {
  var url = 'http://localhost:6767';
  if (id) url += '/' + id;
  if (form) {
    return _request.post({ url: url, form: form });
  }
  else
    return _request({ url: url });
}