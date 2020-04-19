//
// To enable ECMAScript 2015 features, use the following command to run:
//   node --harmony app.js
//
// Author: Yu-Hua Chang
//
"use strict";
process.title = 'node-app';

////////////////////////////////////////////////////////////////////////////////
// Settings
const HTTP_PORT = 8080;

////////////////////////////////////////////////////////////////////////////////
// Import libraries
const http = require('http');
const url = require('url');
const SerialPort = require("serialport").SerialPort;
const fs = require('fs');

////////////////////////////////////////////////////////////////////////////////
// Request Queue
const requestQueue = [];

////////////////////////////////////////////////////////////////////////////////
// open serial port to MCU
const serial = new SerialPort("/dev/ttyS0", {
  baudrate: 57600
});

function sendSerial(buffer, response) {
  console.log('request: 0x%s 0x%s 0x%s',
    buffer[0].toString(16), buffer[1].toString(16), buffer[2].toString(16));

  serial.write(buffer, (err) => {
    if (err) {
      console.error(err);
      response.setHeader("Access-Control-Allow-Origin", "*");
      response.writeHead(400, {'Content-Type': 'text/plain'});
      response.write('500 Internal Error\n');
      response.end();
      requestQueue.pop();
      return console.log('Error on write: ', err.message);
    }
    console.log('confirm request: 0x%s 0x%s 0x%s',
      buffer[0].toString(16), buffer[1].toString(16), buffer[2].toString(16));
  });
}
////////////////////////////////////////////////////////////////////////////////
// http server to server the static pages
const server = http.createServer((request, response) => {

//   // device is handling the previous command
//   if (requestQueue.length > 0) {
//     response.setHeader("Access-Control-Allow-Origin", "*");
//     response.writeHead(423, {'Content-Type': 'text/plain'});
//     response.write('423 Locked\n');
//     response.end();
//     return;
//   }

//   // lock
//   requestQueue.push({
//     'func': undefined, // test mode on/off, read/write
//     'target': undefined, // array of pin + on/off pair
//     'response': response
//   });

  // collect request body chunk
  let body = [];
  request.on('error', (err) => {
    console.error(err);
  }).on('data', (chunk) => {
    body.push(chunk);
  }).on('end', () => {
    body = Buffer.concat(body).toString();

    // determine function by request method.
    if (request.method === 'GET') {

//       // retrieve pin id from url
//       let req = request.url.split('/');
//       if (req.length == 2 && req[1] === 'test') {
//         // turn on test mode
//         requestQueue[0].func = {
//           testMode: true,
//           writeMode: false
//         };
//       } else {
//         // read one pin
//         requestQueue[0].func = {
//           testMode: false,
//           writeMode: false
//         };
//       }

    } else if (request.method === 'POST') {

//       // write
//       requestQueue[0].func = {
//         testMode: false,
//         writeMode: true
//       };
      try {
        // requestQueue[0].target = JSON.parse(body);
        let x = JSON.parse(body);
        console.log(x);

      } catch (err) {
        console.error(err);
        // response.setHeader("Access-Control-Allow-Origin", "*");
        response.writeHead(400, {'Content-Type': 'text/plain'});
        response.write('400 Bad Request\n');
        response.end();
        // requestQueue.pop();
        return;
      }
    } else if (request.method === 'OPTIONS') {
      // handle preflight
      console.log('preflight header', request.headers);
      // response.setHeader("Connection", "keep-alive");
      response.setHeader("Access-Control-Allow-Origin", "*");
      response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      // response.setHeader("Access-Control-Max-Age", "86400");
      response.writeHead(204, {'Content-Type': 'text/plain'});
      response.write('204 No Content\n');
      response.end();
      // requestQueue.pop();
      return;
    } else {
      //response.setHeader("Access-Control-Allow-Origin", "*");
      response.writeHead(405, {'Content-Type': 'text/plain'});
      response.write('405 Method Not Allowed\n');
      response.end();
      // requestQueue.pop();
      return;
    }

//     // processing request from queue
//     if (requestQueue[0].func === undefined) {
//       response.setHeader("Access-Control-Allow-Origin", "*");
//       response.writeHead(404, {'Content-Type': 'text/plain'});
//       response.write('404 Not Found\n');
//       response.end();
//       requestQueue.pop();
//       return;
//     } else {

//       // prepare the binary data to be sent to MCU.
//       let buffer = new Buffer(3);

//       if (requestQueue[0].func.testMode) {
//         // test mode on
//         console.log('test mode on');
//         buffer[0] = 0x00;
//         buffer[1] = 0x00;
//         buffer[2] = 0x02;
//       } else {
//         if (requestQueue[0].func.writeMode) {
//           // write mode
//           console.log('write mode');
//           buffer[0] = 0x00;
//           for (let i = 0; i < 8; i++) {
//             buffer[0] |= requestQueue[0].target['' + i] ? 0x01 << (7 - i) : 0x00;
//           }
//           buffer[1] = 0x00;
//           for (let i = 0; i < 8; i++) {
//             buffer[1] |= requestQueue[0].target['' + (i + 8)] ? 0x01 << (7 - i) : 0x00;
//           }
//           buffer[2] = 0x00;
//           for (let i = 0; i < 4; i++) {
//             buffer[2] |= requestQueue[0].target['' + (i + 16)] ? 0x01 << (7 - i) : 0x00;
//           }
//           buffer[2] |= 0x01;
//         } else {
//           // read mode
//           console.log('read mode');
//           buffer[0] = 0x00;
//           buffer[1] = 0x00;
//           buffer[2] = 0x00;
//         }
//       }

//       sendSerial(buffer, response);
    // }
  });
});

////////////////////////////////////////////////////////////////////////////////
// run server
serial.on('open', (err) => {
  if (err) {
    console.log('serial port opened has error:', err);
    return;
  }
  console.log('serial port opened.');

  // Listen http port.
  // server.listen(HTTP_PORT, () => {
  //   console.log("%s HTTP Server listening on %s", new Date(), HTTP_PORT);
  // });
});

serial.on('error', (err) => {
  console.log('SerialPort Error: ', err.message);
});

// process the response from MCU
serial.on('data', (data) => {
  console.log('Receive data from MCU: %s %s %s', data[0].toString(16), data[1].toString(16), data[2].toString(16));

  if (requestQueue.length > 0) {
    requestQueue[0].response.setHeader("Access-Control-Allow-Origin", "*");
    requestQueue[0].response.writeHead(200, {'Content-Type': 'application/json'});

    let result = {};
    for (let i = 0; i < 8; i++) {
      result['' + i] = data[0] >> (7 - i) & 0x01 == 0x01 ? true : false;
    }
    for (let i = 0; i < 8; i++) {
      result['' + (i + 8)] = data[1] >> (7 - i) & 0x01 == 0x01 ? true : false;
    }
    for (let i = 0; i < 4; i++) {
      result['' + (i + 16)] = data[2] >> (7 - i) & 0x01 == 0x01 ? true : false;
    }
    requestQueue[0].response.write(JSON.stringify(result));
    requestQueue[0].response.end();

    // unlock
    let req = requestQueue.pop();
  }
});
