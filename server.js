'use strict';

const express = require('express')
const SocketServer = require('ws').Server
const path = require('path')
const busboy = require('connect-busboy') //middleware for form/file upload
const fs = require('fs-extra')       //File System - for file manipulation
const multer = require('multer')
const DB = require('./app/db')

var storage =   multer.diskStorage({
  destination: function (req, file, callback) {
    console.log(file);
    callback(null, './public');
  },
  filename: function (req, file, callback) {
    console.log(file);
    callback(null, file.originalname);
  }
});
var upload = multer({ storage : storage}).single('audioFile');



//SERVER--------------------------------------------------------------------------
const PORT = process.env.PORT || 3000;
const INDEX = path.join(__dirname, 'index.html');

const app = express()
//app.use(busboy());
app.use(express.static('public'))
app.use("/dist", express.static('dist'))

app.route('/')
    .get((req, res) => {
        res.sendFile(INDEX)
    })

app.post('/upload', function(req,res){

    console.log(req.raw)
    upload(req,res,function(err) {
        if(err) {
            return res.end("Error uploading file.");
        }
        res.redirect("/");
        yellPlaylist()
    });

    /*
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
    */
});

app.get('/apps/:name', function(req, res){
    const name = req.params.name

    if(name == 'kindred') {
        res.writeHead(200, {
            'Content-Type': "application/json",
            'Cache-Control': 'no-cache'
        })
        res.end(JSON.stringify({
            version: '1.1.2',
            distPath: '/dist/Kindred-win32-x64.zip'
        }))
    }
    else {
        res.end(JSON.stringify({
            success: false,
            message: 'app with name "' + name + '" not found'
        }))
    }
});

app.post('/audio', function(req, res) {
    var postData = '';
    req.on('data', function (chunk) {
        postData += chunk
    })
    req.on('end', function() {
        postData = JSON.parse(postData)
        const name = postData.name
        const data = new Buffer(postData.data)
        DB.insertAudio(name, data, () => {
            res.end('success')
            yellPlaylist()
        }, () => {
            res.end('error')
        })
    });
})

app.get('/play/:name', (req, res) => {
    const name = req.params.name
    yellPlay(name)
    res.end('play message sent!')
})

const server = app.listen(PORT, () => {
    console.log(`Listening on ${ PORT }`)
});


//DATABASE--------------------------------------------------------------------------
DB.init()
app.get('/audio/:name', function(req, res){
    const name = req.params.name
    DB.selectAudio(name, (fileBytes) => {
        res.writeHead(200, {
            'Content-Type': "audio/mpeg",
            'Content-Disposition': `inline; filename="${name}"`,
            'Cache-Control': 'no-cache'
        })
        res.end(fileBytes);
    }, (err) => {
        res.end(err.message);
    })
});



//WEB SOCKET--------------------------------------------------------------------------
const wss = new SocketServer({ server });
var userCount = 0
var hangoutsCount = 0

wss.on('connection', (ws) => {
  console.log('Client connected');
  userCount++

  // setInterval(() => {
  //     wss.clients.forEach((client) => {
  //       whisperPlaylist(client)
  //     });
  //   }, 1000);
    whisperVersion(ws)
    whisperPlaylist(ws)
    yellUserCount()

    ws.on('close', () => {
        console.log('Client disconnected');
        userCount--
        yellUserCount()
    });

    ws.on('message', (message) => {
        console.log('onmessage: ', message)
        let json = JSON.parse(message)
        if(json.type == "play")
        {
            yellPlay(json.payload)
        }
        else if(json.type == "remove")
        {
            DB.removeAudio(json.payload, () => {
                yellPlaylist()
            }, (err) => {
                console.log('remove audio error', err)
            })
        }
        else if(json.type == "hangoutsJoin")
        {
            hangoutsCount++
            yellHangoutsCount()
        }
        else if(json.type == "hangoutsLeave")
        {
            hangoutsCount--
            yellHangoutsCount()
        }
    });
});


function whisperVersion(ws){
    ws.send(JSON.stringify(
    {
        'type':'version',
        'message': "1.1"
    }
    ))
}

function whisperPlaylist(ws){
    DB.queryPlaylist(playlist => {
        ws.send(JSON.stringify({
            'type':'playlist',
            'message': playlist
        }))
    })

    // fs.readdir(__dirname + '/public', (err, files) => {
    //     if(!files)
    //         files = []
    //     ws.send(JSON.stringify(
    //         {
    //             'type':'playlist',
    //             'message': files
    //         }
    //         ))
    // })
}

function yellPlaylist() {
    wss.clients.forEach((client) => {
        whisperPlaylist(client)
    });
}

function yellPlay(filename) {
    wss.clients.forEach((client) => {
        client.send(JSON.stringify(
            {
                'type':'play',
                'message': filename
            }))
    });
}

function yellUserCount() {
    wss.clients.forEach((ws) => {
        ws.send(JSON.stringify(
            {
                'type':'userCount',
                'message': userCount
            }
            ))
      });
}

function yellHangoutsCount() {
    wss.clients.forEach((ws) => {
        ws.send(JSON.stringify(
            {
                'type':'hangoutsCount',
                'message': hangoutsCount
            }
            ))
      });
}


