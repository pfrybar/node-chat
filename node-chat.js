var DEBUG = GLOBAL.DEBUG = true;

var log4js = require('log4js'),
    path = require('path'),
    route = require('choreographer').router(),
    paperboy = require('paperboy'),
    url = require('url'),
    qs = require('querystring'),
    uuid = require('node-uuid'),
    http = require('http');

log4js.clearAppenders(); // remove default console logger
log4js.addAppender(log4js.consoleAppender(log4js.basicLayout));

// handle uncaught exceptions, otherwise node will halt on errors
process.on('uncaughtException', function (error) {
    console.error(error);
});

var channelFactory = require('./channel.js'),
    pub = path.join(path.dirname(__filename), 'public'),
    channels = {},
    usernames = {};

channelFactory.on('new', function(channel) {
    channels[channel.id] = {
        channel: channel
    };
});

channelFactory.on('close', function(channel) {
    var username = channels[channel.id].username;
    delete channels[channel.id];

    if (typeof username !== 'undefined') {
        // loop over all channels
        for (var id in channels) {
            var chan = channels[id].channel;
            chan.send({
                method: 'leave',
                username: username
            });
        }

        delete usernames[username];
    }
});

// main page (index.html)
var index = function(req, res) {
    // change req url (trick paperboy into delivering home page)
    req.url = '/index.html';
    paperboy.deliver(pub, req, res);
};

route.get('/', index)
    .get('/home', index)
    .get('/index', index)
    .get('/index.html', index);

route.get('/ping', function(req, res) {
    res.writeHead(200, {'Cache-Control': 'no-cache'});
    res.end();
});

route.get('/users', function(req, res) {
    var users = [];
    for (var user in usernames) {
        users.push(user);
    }

    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify(users));
});

route.post('/message', function(req, res) {
    var body = '';
    req.on('data', function(data) {
        body += data;
    })
    .on('end', function() {
        var params = qs.parse(body);

        // loop over all channels
        for (var id in channels) {
            var channel = channels[id].channel;
            channel.send({
                method: 'message',
                username: params.username,
                message: params.message
            });
        }

        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({
            success: true
        }));
    });
});

route.post('/username', function(req, res) {
    var body = '';
    req.on('data', function(data) {
        body += data;
    })
    .on('end', function() {
        var params = qs.parse(body);

        var username = params.username;
        var channelId = params.channel_id;

        // TODO: test these two

        if (usernames[username]) {
            res.writeHead(400);
            res.end();
            return;
        }

        usernames[username] = true;
        channels[channelId].username = username;

        // loop over all channels
        for (var id in channels) {
            var channel = channels[id].channel;

            if (channels[id].username === username) {
                continue;
            }

            channel.send({
                method: 'join',
                username: username
            });
        }

        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({
            success: true
        }));
    });
});

route.notFound(function(req, res) {
    // try to serve up static content
    paperboy.deliver(pub, req, res)
        // .addHeader('Expires', 300)
        .otherwise(function() {
            res.writeHead(404, {'Content-Type': 'text/plain'});
            res.end("Error, file not found");
        });
});

console.info('    routes created');

var server;
if (DEBUG) {
    server = http.createServer(function(req, res) {
	// debug hit
	console.debug(req.method + ' ' + req.url + ' from ' + req.headers['x-forwarded-for']);

        // check if channel request
        if (channelFactory.handle(req, res)) {
            return;
        }

	route.apply(this, arguments);
    });
} else {
    server = http.createServer(function(req, res) {
        // check if channel request
        if (channelFactory.handle(req, res)) {
            return;
        }

	route.apply(this, arguments);
    });
}

server.listen(8001, function() {
    console.info('    server started, listening on port 8001');
    console.info('node initialization complete');
});
