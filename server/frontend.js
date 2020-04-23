$(() => {
  "use strict";

  let buttons = [];
  for (let i = 0; i < 24; i++) {
    let button = $('<button id="btn' + i + '">Button ' + i + '</button>');
    button.on('click', () => {
      console.log('button ' + i);
    });
    $('#app').append(button);
    buttons.push(button);
  }

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
      $('#connStatus').text('Connected to ' + ip + ':' + port);
    };

    connection.onclose = () => {
      $('#connStatus').text('Connection lost');
      connection = undefined;
    };

    connection.onerror = (error) => {
      $('#connStatus').text('Connection error: ' + error);
    };

    connection.onmessage = (message) => {
      let json = undefined;
      try {
        json = JSON.parse(message.data);
        console.log('JSON: ', json);

        // Do something...
        $('#target').css('background-color', json.color);
      } catch (e) {
        $('#connStatus').text('Connection error: ' + e);
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
