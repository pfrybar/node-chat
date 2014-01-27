(function() {
    // TODO: check if jquery

    var timeout = 50 * 1000,
        route = '/channel',
        channel = {};

    jQuery.channel = channel;

    channel.new = function(callback) {
        var that = {};
        that.id = null;

        // should give channel a status

        $.ajax({
            url: route,
            type: 'POST',
            data: {
                method: 'new'
            }
        }).done(function(data) {
            if (data.success) {
                that.id = data.channel_id;
                callback(that);
            }
        }).fail(function() {
            // get params and handle error
        });

        that.open = function(success, error) {
            $.ajax({
                url: route,
                type: 'POST',
                timeout: timeout,
                data: {
                    method: 'open',
                    channel_id: that.id
                }
            }).done(function(messages) {
                for (var i=0, ii=messages.length; i<ii; i++) {
                    success(messages[i]);
                }

                that.open(success, error);
            }).fail(function(jqXHR, text, error2) {
                if (text === 'timeout') {
                    // timeout, re-open channel
                    that.open(success, error);
                } else {
                    error(jqXHR.status);
                }
            });
        };

        that.close = function() {
            $.ajax({
                url: route,
                type: 'POST',
                data: {
                    method: 'close',
                    channel_id: that.id
                }
            }).done(function() {
                // what to do here?
            }).fail(function(jqXHR, text, error) {
                // TODO: handle error
            });
        };

        that.timeout = function(value) {
            if (typeof value === 'undefined') {
                return timeout;
            }

            if (0 < value && value < 60) {
                timeout = value * 1000;
            } else {
                // error
            }
        };

        that.route = function(value) {
            if (typeof value === 'undefined') {
                return route;
            }

            route = value;
        };

        return that;
    };
})();
