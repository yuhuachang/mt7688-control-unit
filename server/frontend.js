$(() => {
  "use strict";

  let buttons = [];
  for (let i = 0; i < 24; i++) {
    let button = $('<div id="C' + i + '">Button A' + i + '</div>');
    button.addClass('btn btn-outline-primary');
    button.on('click', () => {
      console.log('button ' + i);

      // call server to change state
      fetch('/control/C/' + i)
        .then(response => {
          return response.json();
        })
        .then(data => {
          console.log(data);
        });
    });
    $('#app').append(button);
    buttons.push(button);
  }

  const log = msg => {
    let d = new Date();
    let dateStr = d.getFullYear()
      + '-' + ('0' + (d.getMonth() + 1)).slice(-2)
      + '-' + ('0' + d.getDate()).slice(-2)
      + ' ' + ('0' + d.getHours()).slice(-2)
      + ':' + ('0' + d.getMinutes()).slice(-2)
      + ':' + ('0' + d.getSeconds()).slice(-2)
      + '.' + d.getMilliseconds();

    $('#log').append($('<div>', {
      text: dateStr + ' ' + msg
    }));

    for (let i = $('#log').children().length - 1; i >= 0; i--) {
      if ($('#log').children().length - i >= 10) {
        $('#log').children()[i].remove();
      }
    }
  };

  // if user is running mozilla then use it's built-in WebSocket
  window.WebSocket = window.WebSocket || window.MozWebSocket;

  // if browser doesn't support WebSocket, just show some notification and exit
  if (!window.WebSocket) {
    content.html($('<p>', {
      text: "Sorry, but your browser doesn't support WebSockets."
    }));
    return;
  }

  // WebSocket connection to server
  let connection = undefined;

  // Connect to server
  const connect = (ip) => {

    connection = new WebSocket('ws://' + ip + ':' + port);

    connection.onopen = () => {
      let msg = 'Connected to ' + ip + ':' + port;
      $('#connStatus').text(msg);
      log(msg);
    };

    connection.onclose = () => {
      let msg = 'Connection lost';
      $('#connStatus').text(msg);
      log(msg);
      connection = undefined;
    };

    connection.onerror = (error) => {
      let msg = 'Connection error: ' + error.message;
      $('#connStatus').text(msg);
      log(msg);
    };

    connection.onmessage = (message) => {
      try {
        log('State: ' + message.data);
        let state = JSON.parse(message.data);

        // Update unit state
        const unit = 'C';
        if (state[unit] && state[unit]['latch']) {
          log("Update latch state");
          log(state[unit]['latch']);
          for (let i = 0; i < 24; i++) {
            const target = $('#' + unit + i);
            if (state[unit]['latch'][i]) {
              target.removeClass('btn-outline-primary').addClass('btn-primary');
            } else {
              target.removeClass('btn-primary').addClass('btn-outline-primary');
            }
          }
        } else {
          log("No latch state");
        }
      } catch (e) {
        $('#connStatus').text('Connection error: ' + e);
        log(e.message);
        return;
      }
    };

    console.log(connection);
  };

  // Run every second to recover the connection if connection is lost.
  setInterval(() => {
    // Ignore if connection is healthy.
    if (connection && connection.readyState === 1) return;

    // Iterate through all addresses and only connect to the one matching the request host info.
    for (let i = 0; i < addresses.length; i++) {
      if ((addresses[i] + ':' + port) === host) {
        if (!connection) {
          connect(addresses[i]);
        }
      }
    }
  }, 1000);
});
