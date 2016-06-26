'use strict';

const express = require('express');
const SocketServer = require('ws').Server;
const path = require('path');
const busboy = require('connect-busboy'); //middleware for form/file upload
const fs = require('fs-extra');       //File System - for file manipulation

const PORT = process.env.PORT || 3000;
const INDEX = path.join(__dirname, 'index.html');

//Server
const app = express()
app.use(busboy());
app.use(express.static('public'))

app.route('/')
    .get((req, res) => {
        res.sendFile(INDEX)
    })

app.route('/upload')
    .post(function (req, res, next) {

        var fstream;
        req.pipe(req.busboy);
        req.busboy.on('file', function (fieldname, file, filename) {
            console.log("Uploading: " + filename);

            if (!fs.existsSync(__dirname + '/public/')){
                fs.mkdirSync(__dirname + '/public/');
            }

            //Path where image will be uploaded
            fstream = fs.createWriteStream(__dirname + '/public/' + filename);
            file.pipe(fstream);
            fstream.on('close', function () {    
                console.log("Upload Finished of " + filename);              
                res.redirect('back');           //where to go next
                wss.clients.forEach((client) => {
                    sendFileList(client)
                  });
            });
        });
    });

const server = app.listen(PORT, () => {
    console.log(`Listening on ${ PORT }`)
});

function sendFileList(ws){
    fs.readdir(__dirname + '/public', (err, files) => {

        if(!files)
            files = []

        ws.send(JSON.stringify(
            {
                'type':'playlist',
                'message': files
            }
            ))
    })
}

//Web Socket
const wss = new SocketServer({ server });

wss.on('connection', (ws) => {
  console.log('Client connected');

  // setInterval(() => {
  //     wss.clients.forEach((client) => {
  //       sendFileList(client)
  //     });
  //   }, 1000);
  sendFileList(ws)

  ws.on('close', () => console.log('Client disconnected'));

  ws.on('message', (message) => {
        console.log('message: ', message)
        let json = JSON.parse(message)
        console.log(json)
        if(json.type == "play")
        {
            wss.clients.forEach((client) => {
                client.send(message)
            });
            
        }
    });
});