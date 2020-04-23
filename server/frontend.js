$(() => {
  "use strict";

  let ipAddr = $('#ipAddr');

  $('#btnBlue').on('click', () => {
    console.log(connection);
    connection.send(JSON.stringify({ color: 'blue' }));
  });

  $('#btnGreen').on('click', () => {
    console.log(connection);
    connection.send(JSON.stringify({ color: 'green' }));
  });

  // server ip address
  ipAddr.text(ip);

  // if user is running mozilla then use it's built-in WebSocket
  window.WebSocket = window.WebSocket || window.MozWebSocket;

  // if browser doesn't support WebSocket, just show some notification and exit
  if (!window.WebSocket) {
    content.html($('<p>', {
      text: 'Sorry, but your browser doesn\'t support WebSockets.'
    }));
    return;
  }

  let connection = undefined;

  setInterval(() => {
    if (connection && connection.readyState === 1) return;

    connection = new WebSocket('ws://' + ip + ':8080');

    connection.onopen = () => {
      console.log('on open');
    };

    connection.onclose = () => {
      console.log('on close');
    };

    connection.onerror = (error) => {
      console.log('on error ', error);
    };

    connection.onmessage = (message) => {
      let json = undefined;
      try {
        json = JSON.parse(message.data);

        $('#target').css('color', json.color);
      } catch (e) {
        console.log('This doesn\'t look like a valid JSON: ', message.data);
        return;
      }

      // print every message from server
      console.log('JSON: ', json);
    };

    console.log(connection);
  }, 1000);
});