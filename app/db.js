'use strict';

var exports = module.exports = {};
const pg = require('pg')
const fs = require('fs-extra')

// const dbUrl = 'pg://postgres:postgres@localhost:5432/postgres'
const dbUrl = 'postgres://chgssqfyikwunh:xJvzuQy4haharHUumG-ZusSnev@ec2-54-243-204-195.compute-1.amazonaws.com:5432/d2g4p6pr8ufehb'

const AUDIO_TABLE = 'AUDIO'

const CODE_DB_EXISTS = '42P04'
const CODE_TABLE_EXISTS = '42P07'
        
const open = (callback) => {
    pg.connect(dbUrl, (err, client, onDone) => {
        if(err) { console.error(err); onDone(); return; }
        // client.query(`CREATE DATABASE ${DB_NAME}`, (err) => {
        //     if(err && err.code != CODE_DB_EXISTS) {
        //         console.error(err) //unexpected error
        //         onDone()
        //         return
        //     }
        //     else if(err && err.code == CODE_DB_EXISTS) {
        //         console.log('database already exists')
        //     }
        //     else {
        //         console.log('database created successfully')
        //     }
            callback(client, onDone)
        // })
    })
}

exports.init = () => {
    open((client, onDone) => {
        // client.query(`DROP TABLE IF EXISTS ${AUDIO_TABLE}`, (err) => {
        //     if(err) { console.error(err); onDone(); return; }
        //     console.log('DB:: table dropped')
        // })

        //CREATE TABLE IF NOT EXISTS
        client.query(`CREATE TABLE ${AUDIO_TABLE}(name varchar(64) NOT NULL UNIQUE, data bytea)`, (err) => {
            const isRealErr = err && err.code != CODE_TABLE_EXISTS
            if(isRealErr) {
                console.error(err)
                onDone()
                return
            }
            console.log('DB:: table is created')
            fs.readdir('./public', (err, files) => {
                console.log('DB:: num public files: ' + files.length)
                files.forEach(name => {
                    fs.open(`./public/${name}`, 'r', (err, fd) => {
                        if (err) { console.log(err, err.message); onDone(); return; }
                        fs.readFile(fd, function(err, data) {
                            if (err) { console.log(err, err.message); onDone(); return; }
                            exports.insertAudio(name, data, ()=>{}, ()=>{})
                        })
                    })
                })
            })
        })
    })
}

exports.insertAudio = (name, data, onSuccess, onError) => {
    // console.log('data', data.length)
    open((client, onDone) => {
        client.query(`DELETE FROM ${AUDIO_TABLE} WHERE name='${name}'`, (err) => {
            if(err) { console.error(err); onDone(); onError(err); return; }
            console.log('deleted ' + name)

            client.query(`INSERT INTO ${AUDIO_TABLE}(name, data) values($1, $2)`, [name, data], (err) => {
                if(err) { console.error(err); onDone(); onError(err); return; }
                console.log('inserted ' + name)
                onDone()
                onSuccess()
            })
        });
    })

    fs.writeFile(name, data, (err) => {
      if (err) {
          console.error(err)
          return
      }
      console.log('It\'s saved!');
    });
}

exports.removeAudio = (name, onSuccess, onError) => {
    // console.log('data', data.length)
    open((client, onDone) => {
        client.query(`DELETE FROM ${AUDIO_TABLE} WHERE name='${name}'`, (err) => {
            if(err) { console.error(err); onDone(); onError(err); return; }
            console.log('deleted ' + name)
            onSuccess()
        });
    })

    fs.writeFile(name, data, (err) => {
      if (err) {
          console.error(err)
          return
      }
      console.log('It\'s saved!');
    });
}

exports.queryPlaylist = (callback) => {
    open((client, onDone) => {
        var query = client.query(`SELECT name FROM ${AUDIO_TABLE}`)
        query.on("end", (result) => {
            onDone()
            callback(result.rows.map(e => {
                return e.name
            }))

            // console.log(result.fields)
            // console.log(result.rows)
            // if(result.rows.length == 0) {
            //     onError({message:audioName + ' not found'})
            //     return
            // }
        })
    })
}

exports.selectAudio = (audioName, onSuccess, onError) => {
    open((client, onDone) => {
        var query = client.query(`SELECT * FROM ${AUDIO_TABLE} WHERE name='${audioName}'`)
        // query.on("row", function (row, result) {
        //     result.addRow(row)
        // })
        query.on("end", (result) => {
            onDone()

            // console.log(result.fields)
            // console.log(result.rows)
            if(result.rows.length == 0) {
                onError({message:audioName + ' not found'})
                return
            }

            let row = result.rows[0]
            onSuccess(row.data)
            // console.log(row.data.toString('utf8', 0, num));

            // fs.writeFile('message.mp3', row.data, (err) => {
            //   if (err) {
            //       console.error(err)
            //       return
            //   }
            //   console.log('It\'s saved!');
            // });
        })
        query.on("error", function (err) {
            onDone()
            onError(err)
        })
    })
}