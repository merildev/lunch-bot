const qs = require('querystring')
const AWS = require('aws-sdk')


const kmsEncryptedToken = process.env.kmsEncryptedToken
const validator = /^[a-zA-Z0-9 -+]+$/i
const restaurants = [
    'badolina',
    'bibimbap',
    'breakfast and burger',
    'grain',
    'japanese canteen',
    'k10',
    'leon',
    'purple thai',
    'thai express',
    'tortilla'
]

const COMMAND = {
    ADD: 'add ',
    EAT: 'eat',
    LIST: 'list',
    REMOVE: 'remove '
}
const EMPTY = 'The list is empty, please add a lunch place first'
const MAX_SIZE = 40
const MIN_SIZE = 3

let token = null
let last = null

function getText(commandText) {

    if (commandText.indexOf(COMMAND.ADD) === 0) {

        const restaurant = commandText.substr(COMMAND.ADD.length).toLowerCase()

        if (!validator.test(restaurant) || restaurant.length < MIN_SIZE || restaurant.length > MAX_SIZE) {

            return `${restaurant} is not a valid name.`
        }

        if (restaurants.indexOf(restaurant) !== -1) {

            return `${restaurant} already in the list!`
        }

        restaurants.push(restaurant)
        restaurants.sort()

        return `${restaurant} was successfully added to the list!`
    }

    if (commandText.indexOf(COMMAND.REMOVE) === 0) {

        const restaurant = commandText.substr(COMMAND.REMOVE.length).toLowerCase()

        if (!validator.test(restaurant) || restaurant.length < MIN_SIZE || restaurant.length > MAX_SIZE) {

            return `${restaurant} is not a valid name.`
        }

        if (restaurants.indexOf(restaurant) !== -1) {

            restaurants.splice(restaurants.indexOf(restaurant), 1)

            return `${restaurant} was successfully removed from the list!`
        }

        return `${restaurant} is not in the list.`
    }

    if (commandText.indexOf(COMMAND.EAT) === 0) {

        const restaurant = commandText.substr(3).toLowerCase()

        if (restaurants.length === 0) return EMPTY

        let miammiam = last

        while (miammiam === last) {
            miammiam = restaurants[Math.floor(Math.random() * restaurants.length)]
        }

        last = miammiam

        if (restaurants.indexOf(restaurant) === -1) {

            return `Today you will dine in...\n#### ${miammiam}\n:partyparrot:`
        }
    }

    if (commandText.indexOf(COMMAND.LIST) === 0) {

        if (restaurants.length === 0) return EMPTY

        return restaurants.reduce((acc, place) => {
            return `${acc}${place}\n`
        },'')
    }

    return '#### Command not found\nPlease use one of the following:\n_add_\n_remove_\n_eat_\n_list_'
}

function processEvent(event, callback) {
    const params = qs.parse(event.body)
    const requestToken = params.token

    if (requestToken !== token) {
        console.error(`Request token (${requestToken}) does not match expected`)
        return callback('Invalid request token')
    }

    callback(null, {
        response_type: 'in_channel',
        text: getText(params.text)
    })
}

exports.handler = (event, context, callback) => {
    const done = (err, res) => callback(null, {
        body: err ? (err.message || err) : JSON.stringify(res),
        headers: {
            'Content-Type': 'application/json'
        },
        statusCode: err ? '400' : '200'
    })

    if (token) {
        processEvent(event, done)
    } else if (kmsEncryptedToken && kmsEncryptedToken !== '<kmsEncryptedToken>') {
        const cipherText = {
            CiphertextBlob: new Buffer(kmsEncryptedToken, 'base64')
        }
        const kms = new AWS.KMS()

        kms.decrypt(cipherText, (err, data) => {
            if (err) {
                console.log('Decrypt error:', err)
                return done(err)
            }
            token = data.Plaintext.toString('ascii')
            processEvent(event, done)
        })
    } else {
        done('Token has not been set.')
    }
}
