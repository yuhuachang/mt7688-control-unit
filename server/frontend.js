$(() => {
  "use strict";

  const lightConfig = {
    "B0": "客浴控制 45",
    "B1": "客浴控制 46",
    "B2": "展示櫃（未接）",
    "B3": "走廊（燒毀）",
    "B5": "客浴崁燈",
    "B7": "客浴燈條",
    "C0": "兒童房間照",
    "C1": "儲藏室燈",
    "C2": "主臥間照",
    "C3": "主浴崁燈",
    "C4": "主臥化妝台崁燈",
    "C5": "書房間照",
    "C6": "主臥床頭燈（左）（未接）",
    "C7": "主臥床頭燈（右）（未接）",
    "C8": "???",
    "C9": "???",
    "C10": "書房吊燈（未接）",
    "C11": "書房軌道燈（未接）",
    "C12": "主臥汙衣櫃崁燈（未接）",
    "C13": "主浴抽風機",
    "C14": "兒童房軌道燈（左）（未接）",
    "C15": "兒童房軌道燈（右）（未接）",
    "C16": "???",
    "C17": "主臥陽台崁燈",
    "C18": "???",
    "C19": "???"
  };

  let controls = {};

  const addButton = (key, text) => {
    let button = $('<div><img width="22px"><div class="btn-key">' + key + '</div><div class="btn-text">' + (text ? text : '') + '</div></div>');
    button.addClass('my-btn my-btn-1x1');
    button.on('click', () => {
      let payload = {
        "header": {
          "state change": true,
          "state sync": true
        },
        "web": {}
      };
      payload.web[key] = controls[key] ? !controls[key].state : true;

      log(key + ' click: ' + JSON.stringify(payload));
      fetch('/switch', {
        method: 'POST',
        body: JSON.stringify(payload)
      }).then(response => {
        return response.json();
      })
      .then(data => {
        console.log(data);
      });
    });
    $('#app').append(button);
    controls[key] = {
      state: false,
      control: button
    };
  };

  for (let i = 0; i < 32; i++) {
    let key = 'A' + i;
    addButton(key, lightConfig[key]);
  }
  for (let i = 0; i < 8; i++) {
    let key = 'B' + i;
    addButton(key, lightConfig[key]);
  }
  for (let i = 0; i < 24; i++) {
    let key = 'C' + i;
    addButton(key, lightConfig[key]);
  }

  const turnOn = (key) => {
    let button = controls[key].control;
    button.removeClass('my-btn-off').addClass('my-btn-on');
    let img = button.find('img');
    img.attr('src', 'light-on.png');
    img.attr('style', 'opacity: 1;');
  };

  const turnOff = (key) => {
    let button = controls[key].control;
    button.removeClass('my-btn-on').addClass('my-btn-off');
    let img = button.find('img');
    img.attr('src', 'light-off.png');
    img.attr('style', 'opacity: 0.4;');
  };

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
        log("Update latch state");

        Object.keys(state).forEach(key => {
          // log(key);
          if (controls.hasOwnProperty(key)) {
            controls[key].state = state[key];
          }
        });

        Object.keys(controls).forEach(key => {
          if (controls[key].state) {
            turnOn(key);
          } else {
            turnOff(key);
          }
        });
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
