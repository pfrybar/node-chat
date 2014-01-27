var events = require('events'),
    url = require('url'),
    qs = require('querystring'),
    uuid = require('node-uuid');

var DEBUG = false;
if (typeof GLOBAL.DEBUG !== "undefined") {
    DEBUG = GLOBAL.DEBUG;
}

var channels = {},
    timeout = 50 * 1000,
    route = '/channel';

var channel = new events.EventEmitter();

module.exports = channel;

channel.timeout = function(value) {
    if (typeof value === 'undefined') {
        return timeout;
    }

    if (0 < value && value < 60) {
        timeout = value * 1000;
    } else {
        // error
    }
};

channel.route = function(value) {
    if (typeof value === 'undefined') {
        return route;
    }

    route = value;
};

channel.new = function() {
    var that = {};

    that.id = uuid.v4();

    debug("Created new channel (" + that.id + ")");
    that.time = new Date().getTime();

    // can be one of: 'created', 'opened', 'sending', 'timeout', or 'closed'
    that.status = 'created';

    // message queue to store messages in case already sending message
    var queue = [],
        res = null;

    channels[that.id] = that;

    that.open = function(response) {
        res = response;
        res.on('close', function() {
            // timed out
            that.status = 'timeout';
            res = null;
            debug("Channel timed out (" + that.id + ")");
            that.time = new Date().getTime();
        });

        debug("Opened channel (" + that.id + ")");
        that.time = new Date().getTime();
        that.status = 'opened';

        channel.emit('open', that);

        if (queue.length > 0) {
            debug("Channel had waiting messages (" + that.id + ")");
            that.send(queue);
            queue = [];
        }
    };

    that.send = function(messages) {
        if (!Array.isArray(messages)) {
            messages = [messages];
        }

        if (that.status === 'opened') {
            debug("Sending messages (" + that.id + ")");
            that.time = new Date().getTime();
            that.status = 'sending';
            res.writeHead(200, {
                'Content-Type': 'application/json'
            });
            res.end(JSON.stringify(messages));
        } else if (that.status === 'closed') {
            // throw error
            debug("Trying to send messages to a closed channel (" + that.id + ")");
        } else {
            // add to queue
            debug("Channel not ready, queueing message(s) (" + that.id + ")");
            for (var i=0, ii=messages.length; i<ii; i++) {
                queue.push(messages[i]);
            }
        }                   
    };

    that.close = function() {
        if (res !== null) {
            res.writeHead(200, {
                'Content-Type': 'application/json'
            });

            // TODO: send signal that channel was closed
            res.end();
            res = null;
        }
        
        delete channels[that.id];

        debug("Closing channel (" + that.id + ")");
        channel.emit('close', that);
    };

    channel.emit('new', that);

    return that;
};

channel.handle = function(req, res) {
    // check if this is a request to route
    if (url.parse(req.url).pathname !== route) {
        return false;
    }

    // do the handling here
    if (req.method !== 'POST') {
        // error? return false?
        return false;
    }

    // get the body data
    var body = '';
    req.on('data', function(data) {
        body += data;
    })
    .on('end', function() {
        var params = qs.parse(body);

        if (params.method === 'new') {
            var chan = channel.new();

            // return success and channel id
            res.writeHead(200, {'Content-Type': 'application/json'});
            res.end(JSON.stringify({
                success: true,
                channel_id: chan.id
            }));
        } else if (params.method === 'open') {
            if (!channels[params.channel_id]) {
                // error
                return;
            }

            channels[params.channel_id].open(res);
        } else if (params.method === 'close') {
            if (!channels[params.channel_id]) {
                // error
                return;
            }

            channels[params.channel_id].close();

            // return success
            res.writeHead(200, {'Content-Type': 'application/json'});
            res.end(JSON.stringify({
                success: true
            }));
        } else {
            // error
            return;
        }
    });

    return true;
};

setInterval(function() {
    // loop through channels and kill ones that are inactive
    var time = new Date().getTime();

    debug("Cleaning up inactive channels at: " + time);

    var num = 0;
    for (var id in channels) {
        var channel = channels[id];
        if (channel.status !== 'opened') {
            if ((time - channel.time) >= (timeout * 2)) {
                // inactive
                debug("Closing channel due to inactivity (" + id + ")");
                channel.close();
            } else {
                num++;
            }
        } else {
            num++;
        }
    }

    debug("    " + num + " active channels remaining");
}, timeout * 2);

function debug(message) {
    if (DEBUG) {
        console.debug(message);
    }
}