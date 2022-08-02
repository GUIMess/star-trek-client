const express = require('express') //import express
const app = express()   //create express app
const cors = require('cors')    //import cors
const PORT = 8000
require('dotenv').config() //import dotenv
console.log(process.env)
const MongoClient = require('mongodb').MongoClient //import mongo client


app.use(cors()) //set cors
app.use(express.json()) //set json

// const aliens = {
//     'humans': {
//         'speciesName': 'Humans',
//         'homeworld': 'Earth',
//         'features': 'Rounded ears, hair on head and face (sometimes)',
//         'interestingFact': 'Founded the United Federation of Planets after first contact with the Vulcans',
//         'notableExamples': "James T. Kirk, Zephram Cochran, Abraham Lincoln",
//         'image': 'https://static.wikia.nocookie.net/aliens/images/6/68/The_City_on_the_Edge_of_Forever.jpg'
//     },
//     'vulcans': {
//         'speciesName': 'Vulcans',
//         'homeworld': 'Vulcan',
//         'features': 'Pointed ears, upward-curving eyebrows',
//         'interestingFact': 'Practice an extreme form of emotional regulation that focuses on logic above all else, pioneered by a Vulcan named Surak',
//         'notableExamples': "Spock, T'Pol, Sarek",
//         'image': 'https://static.wikia.nocookie.net/aliens/images/7/75/Vulcans-FirstContact.jpg'
//     },
//     'klingons': {
//         'speciesName': 'Klingons',
//         'homeworld': "Qo'noS",
//         'features': 'Large stature, pronounced ridges on the forehead, stylized facial hair',
//         'interestingFact': 'Highly skilled in weapons and battle. Their facial ridges were lost as the result of a virus in 2154, but were subsequently restored by 2269.',
//         'notableExamples': "Worf, Kor, Kang",
//         'image': 'https://static.wikia.nocookie.net/aliens/images/7/74/Kruge.jpg'
//     },
//     'romulans': {
//         'speciesName': 'Romulans',
//         'homeworld': "Romulus",
//         'features': 'Pointed ears, upward-curving eyebrows,green tinge to the skin, diagonal smooth forehead ridges (sometimes)',
//         'interestingFact': 'Share a common ancestory with Vulcans, though none of the emotional discipline. Romulus has a sister planet, Remus, on which the Remans are seen as lesser beings.',
//         'notableExamples': "Pardek, Tal'aura, Narissa",
//         'image': 'https://static.wikia.nocookie.net/aliens/images/1/1d/Zzzd7.jpg'
//     },
//     'borg': {
//         'speciesName': '(The) Borg',
//         'homeworld': 'unknown (Delta Quadrant)',
//         'features': 'pale skin, numerous interior and exterior biological modifications',
//         'interestingFact': 'No single genetic lingeage, species propagates by assimilating individuals via nanotechnology, led by a hive mind guided by a single "queen" individual. DO NOT APPROACH unless under specific diplomatic orders from Starfleet Command.',
//         'notableExamples': "Borg Queen, Seven of Nine, Locutus",
//         'image': 'https://static.wikia.nocookie.net/aliens/images/7/76/Borg.jpg'
//     },
//     'gorn': {
//         'speciesName': 'Gorn',
//         'homeworld': 'unknown (Alpha Quadrant)',
//         'features': 'scaly green skin, large, iridescent eyes, powerful build, sharp teeth',
//         'interestingFact': 'Extremely militaristic and driven to conquer, but also possess advanced scientific knowledge allowing for superior bio-weapons.',
//         'notableExamples': "Gorn Captain",
//         'image': 'https://static.wikia.nocookie.net/aliens/images/9/9b/Gorn.jpg'
//     },
//     'trill': {
//         'speciesName': 'Trill',
//         'homeworld': 'Trill',
//         'features': 'Outward appearance similar to humans, aside from distinct dark pigment marks running symmetrically down both sides of the face and body',
//         'interestingFact': 'Some Trill are willin hosts to a long-lived invertibrate symbiote that merges with the host to create a distinct personality.',
//         'notableExamples': "Jadzia Dax, Ezri Dax, Curzon Dax",
//         'image': 'https://static.wikia.nocookie.net/aliens/images/4/42/EzriDax.jpg'
//     }
// }

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