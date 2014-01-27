$(document).ready(function() {
    var heartbeatInt = 30 * 1000;

    // open channel and start listening to messages right away
    var content = $('#content');
    var messages = $('<div id="messages" class="messages-read">');
    content.append(messages);

    messages.jScrollPane({
        hideFocus: true,
        maintainPosition: true,
        stickToBottom: true
    });

    /*
    messages.bind('jsp-scroll-y', function(event, scrollPositionY, isAtTop, isAtBottom) {
        if (isAtBottom) {
            if (messages.hasClass('messages-unread')) {
                messages.removeClass('messages-unread')
                    .addClass('messages-read');
            }
        }
    });
    */

    var channel = $.channel.new(function(channel) {
        channel.open(function(message) {
            if (message.method === 'message') {
                appendMessage('<b>' + message.username + '</b>: ' + message.message);
            } else if (message.method === 'join') {
                appendMessage('<b>' + message.username + '</b> has joined');
            } else if (message.method === 'leave') {
                appendMessage('<b>' + message.username + '</b> has left');
            }
        }, function(status) {
            // error, most likely lost connectivity
            if (status === 200 || status === 500) {
                return;
            }

            setTimeout(function() {
                appendMessage('...disconnected (looks like you lost network connectivity)');
                $('button').attr('disabled', 'disabled');
                $('input').attr('disabled', 'disabled');
            }, 5000);
        });
    });

    // fire off ajax request to find current users
    $.ajax({
        url: '/users'
    }).done(function(users) {
        for (var i=0, ii=users.length; i<ii; i++) {
            users[i] = '<b>' + users[i] + '</b>';
        }

        var message;
        if (users.length > 0) {
            message = "Users online: " + users.join(', ');
        } else {
            message = "No users online";
        }

        appendMessage(message);
    });

    // select username
    var username;
    var loginDiv = $('<div><br />Choose a nickname:<br /></div>');
    content.append(loginDiv);

    var loginInput = $('<input type="text">');
    loginDiv.append(loginInput);

    loginDiv.append('<br />');

    var loginButton = $('<button>Start</button>');
    loginDiv.append(loginButton);

    setTimeout(function() {
        loginInput.focus();
    }, 100);

    // submit on enter
    loginInput.bind('keypress', function(e) {
        if (e.which === 13) {
            loginButton.click();
        }
    });

    loginButton.click(function() {
        if (loginInput.val() === '') {
            return;
        }

        if (channel.id === null) {
            alert('Channel not ready yet, please reload the page');
            return;
        }

        // check if username is being used
        username = loginInput.val();
        $.ajax({
            url: '/username',
            type: 'POST',
            data: {
                username: username,
                channel_id: channel.id
            }
        }).done(function(data) {
            loginDiv.remove();

            content.append('user: <b>' + username + '</b><br />');
            content.append('<br />Send message:<br />');

            var sendInput = $('<input type="text"><br />');
            content.append(sendInput);

            setTimeout(function() {
                sendInput.focus();
            }, 100);

            var sendButton = $('<button>Send</button>');
            sendButton.click(function() {
                if (sendInput.val() === '') {
                    return;
                }

                $.ajax({
                    type: 'post',
                    url: '/message',
                    data: {
                        username: username,
                        message: sendInput.val()
                    }
                });
                sendInput.val('');
            });
            content.append(sendButton);

            // submit on enter
            sendInput.bind('keypress', function(e) {
                if (e.which === 13) {
                    sendButton.click();
                }
            });
        }).error(function() {
            // should check type, assume it's because username is used
            alert('Username (' + username + ') already in use');
            username = null;
            loginInput.val('');
        });
    });

    var scrollable = false;
    function appendMessage(message) {
        var api = messages.data('jsp');

        api.getContentPane()
            .append(message + '<br />');

        api.reinitialise();

        if (!scrollable && api.getIsScrollableV()) {
            // special case where it doesn't stick to bottom when
            // the scroll bars appear for the first time

            // note: also had to make a slight change in jScrollPane source,
            // changed line 855 from > to >=
            api.scrollToBottom(false);
            api.reinitialise();
            scrollable = true;
        }

        setUnreadInterval();

        /*
        // if not at bottom, change message border to green
        if (scrollable && api.getPercentScrolledY() !== 1) {
            if (messages.hasClass('messages-read')) {
                messages.removeClass('messages-read')
                    .addClass('messages-unread');
            }
        }
        */
    }

    $(window).unload(function() {
        if (channel.id !== null) {
            channel.close();
        }
    });

    var windowFocused = true;
    var newMessage = false;
    var intervalId = -1;
    $(window).focus(function() {
        windowFocused = true;
        removeUnreadInterval();
    });

    $(window).blur(function() {
        windowFocused = false;
    });

    var titleFlag = true;
    function setUnreadInterval() {
        if (windowFocused || newMessage) {
            return;
        }

        newMessage = true;
        intervalId = setInterval(function() {
            if (titleFlag) {
                document.title = 'Node Chat';
            } else {
                document.title = 'New Message';
            }
            titleFlag = !titleFlag;
        }, 2000);
        document.title = 'New Message';
    }

    function removeUnreadInterval() {
        if (!newMessage) {
            return;
        }

        newMessage = false;
        titleFlag = true;
        clearInterval(intervalId);
        intervalId = -1;
        setTimeout(function() {
            document.title = 'Node Chat';
        }, 300);
    }

    // set heartbeat interval
//    var heartbeatId = setInterval(heartbeat, heartbeatInt);
//    heartbeat();
    function heartbeat() {
        $.ajax({
            url: '/ping',
            timeout: 5000
        }).error(function() {
            alert('Looks like you lost internet connectivity, please reload');
            clearInterval(heartbeatId);
        });
    }
});
