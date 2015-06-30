# koa-signal

http+sse signalling middleware for koa.

# example

```js
var koa = require('koa');
var signal = require('koa-signal');
var http = require('http');
var request = require('request');
var ssejson = require('ssejson');

var app = koa();
app.use(signal());

http
  .createServer(app.callback())
  .listen(6767, function () {
    var initiator = request({ url: 'http://localhost:6767' }),
        token, id;

    initiator
      .pipe(ssejson.parse('connect'))
      .on('data', function (data) {
        token = data.token;
        id = data.id;

        request({ url: 'http://localhost:6767/' + id })
          .pipe(ssejson.parse('signal'))
          .on('data', function (data) {
            console.log(data.greeting);
          });
      });

    initiator
      .pipe(ssejson.parse('join'))
      .on('data', function (data) {
        request.post({
          url: 'http://localhost:6767/' + id,
          form: {
            token: token,
            data: {
              greeting: 'hello ' + data.cid
            }
          }
        });
      });
  });
```

# api

## var serve = signal(opts={})

Returns a [koa](https://github.com/koajs/koa) middleware.

- `limit` is the only option which is a number or string representing the size limit of a POST body `(default: 10kb)`

# http api

## GET /

Creates a new swarm and starts a [Server-Sent Events (SSE)](http://dev.w3.org/html5/eventsource/) stream to deliver messages sent to this channel. `Accept` header must be present and must contain `text/event-stream` as per the SSE spec.

When a new swarm is created, it is assigned an `id` by the server and the first connection becomes the initiator peer. Since initiator is the queen of this swarm; when it leaves, all connections are closed and the swarm is destroyed.

For every new connection, server pushes a `connect` event first:

```
$ curl -H "Accept: text/event-stream" "http://localhost:6767"

event: connect
data: {
  "id":"ad80064444fd865343aaa149047146b6",
  "cid":"65fc72d741f70ec889971104c6c2bbad",
  "token":"0148d3cd0343887fe5a5897613a1362f"
}
```

Where `id` is the swarm id, `cid` is client id and `token` is a secret to be sent along with a POST request to authenticate this peer against this swarm.

## GET /:id

Starts a SSE stream to deliver messages sent to the swarm specified by `id`.

```
$ curl -H "Accept: text/event-stream" \
  "http://localhost:6767/ad80064444fd865343aaa149047146b6

event: connect
data: {
  "id":"ad80064444fd865343aaa149047146b6",
  "cid":"1083f91d7a308b8f0d3a0249e22f371e",
  "token":"fd25eb7dd55741bbfef5078b93918696"
}
```

When a new peer joins a swarm, the initiator also receives a `join` event which contains the `cid` of this peer. Likewise when the peer closes the connection, the initiator receives a `leave` event.

## POST /:id

Pushes a broadcast (or direct) `signal` event to the swarm specified by `id`. Message body can be either a json or form.

- Event data to be sent must be in `data` parameter
- The secret that authenticates a peer must be sent within parameter `token`
- Optional `cid` parameter can be used to send a signal to a specific peer. Though initiator is the only peer that is being pushed `join` and `leave` events, this is applicable for requests made by any peer.

```
$ curl -H "Content-Type: application/json" -X POST \
  -d '{ "data": { "boom": "boom" }, "token": "fd25eb7dd55741bbfef5078b93918696" }' \
  "http://localhost:6767/ad80064444fd865343aaa149047146b6"
```

sends this:

```
event: signal
data: {"boom":"boom"}
```

# license

mit