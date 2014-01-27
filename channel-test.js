
GLOBAL.DEBUG = true;

var http = require('http'),
    channelFactory = require('./channel.js');

// create channel
var channel = channelFactory.createChannel(),
    timeout = 3000;

// create the temporary server
http.createServer(function(req, res) {
    channel.send('test1');
    channel.send('test2');
    channel.send('test3');
    channel.open(res);
}).listen(7777);

var req = http.request({
    host: 'localhost',
    port: 7777

}, function(res) {
    res.on('data', function(chunk) {
        console.log('BODY: ' + chunk);
    });
})
.on('error', function(e) {
    console.log("Got error: " + e.message);
});

req.setTimeout(timeout, function() {
    req.abort();
});
req.end();
