const express = require('express')
const path = require('path')
const http = require('http')
const socketio = require('socket.io')
const Filter = require('bad-words')

const {addUser, removeUser, getUser, getUsersInRoom} = require('./utils/users')
const {generateMessage} = require('./utils/messages')

const app = express()
const server = http.createServer(app)
const io = socketio(server)

const port = process.env.PORT || 3000

app.use(express.static(path.join(__dirname, '../public')))
app.set(express.json())

io.on('connection', (socket) => {
    console.log('new web socket connection')
    

    socket.on('join', ({username, room}, callback) => {
        const {error, user} = addUser({id: socket.id, username, room})
        if (error) {
            return callback(error)
        }

        socket.join(user.room)
        socket.emit('message', generateMessage('Admin', 'Welcome!'))
        socket.broadcast.to(user.room).emit('message', generateMessage('Admin', `${user.username} has joined!`))
        io.to(user.room).emit('roomData', {
            room: user.room,
            users: getUsersInRoom(user.room)
        })

        callback()
    })

    socket.on('sendMessage', (msg, callback) => {
        const filter = new Filter()

        if (filter.isProfane(msg)) {
            return callback('Profanity is not allowed')
        }

        const user = getUser(socket.id)
        if (user) {
            io.to(user.room).emit('message', generateMessage(user.username, msg))
        }
        
        callback()
    })

    socket.on('sendLocation', ({latitude, longitude}, callback) => {
        const user = getUser(socket.id)
        if (user) {
            io.to(user.room).emit('locationMessage', generateMessage(user.username, 'http://google.com/maps?q=' + latitude + ',' + longitude))
        }
        callback()
    })

    socket.on('disconnect', () => {
        const user = removeUser(socket.id)
        if (user) {
            io.to(user.room).emit('message', generateMessage('Admin', 'User has left.'))
            io.to(user.room).emit('roomData', {
                room: user.room,
                users: getUsersInRoom(user.room)
            })
        }
    })
})

server.listen(port, ()=> {
    console.log('Server started on port 3000')
})