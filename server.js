const express = require('express') //import express
const app = express()   //create express app
const cors = require('cors')    //import cors
const PORT = 8000
require('dotenv').config() //import dotenv
const MongoClient = require('mongodb').MongoClient //import mongo client
const connectionString = process.env.DB_STRING //set connection string

app.use(cors()) //set cors
app.use(express.json()) //set json


MongoClient.connect(connectionString, { useUnifiedTopology: true, useNewUrlParser: true }) //connect to mongo
    .then(client => { //if connected
        console.log('Connected to DB') //log connection
        const db = client.db('star-trek-api') //set db
        const infoCollection = db.collection('Alien Info') //set collection

        app.get('/', (req, res) => { //get request
            res.sendFile(__dirname + '/index.html') //send file
        })

        app.get('/api/:alienName', (req, res) => { //get request
            const aliensName = req.params.alienName.toLowerCase() //set alien name
            infoCollection.find({name: aliensName}).toArray() //find alien
            .then(results => { //if found
                console.log(results) //log results
                res.json(results[0]) //send results
            })
            .catch(error => console.error(error))
        })
    })
    .catch(error => console.error(error))

    app.listen(process.env.PORT || PORT, () => { //listen on port
    console.log(`Server is running on port ${PORT}.`); //log port
})