$(() => {
  "use strict";

  $('#btnBlue').on('click', () => {
    console.log(connection);
    connection.send(JSON.stringify({ color: 'blue' }));
  });

  $('#btnGreen').on('click', () => {
    console.log(connection);
    connection.send(JSON.stringify({ color: 'green' }));
  });

  // if user is running mozilla then use it's built-in WebSocket
  window.WebSocket = window.WebSocket || window.MozWebSocket;

  // if browser doesn't support WebSocket, just show some notification and exit
  if (!window.WebSocket) {
    content.html($('<p>', {
      text: "Sorry, but your browser doesn't support WebSockets."
    }));
    return;
  }

  let connection = undefined;

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

        $('#target').css('background-color', json.color);
      } catch (e) {
        $('#connStatus').text('Connection error: ' + e);
        return;
      }

      // print every message from server
      console.log('JSON: ', json);
    };

    console.log(connection);
  };

  setInterval(() => {
    if (connection && connection.readyState === 1) return;
    for (let i = 0; i < addresses.length; i++) {
      if ((addresses[i] + ':' + port) === host) {
        connect(addresses[i]);
      }
      if (connection && connection.readyState === 1) break;
    }
  }, 1000);
});
