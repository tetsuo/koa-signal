var koa = require('koa');
var signal = require('./');
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
