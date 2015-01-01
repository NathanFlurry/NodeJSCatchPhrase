/* HTTP Setup */
var app = require('express')()
var http = require('http').Server(app)
var io = require('socket.io')(http)

var phrases = require('./phrases.js')

app.get('/', function(req, res){
	res.sendFile(__dirname + '/public/index.html');
})

app.get('/client.js', function(req, res){
	res.sendFile(__dirname + '/public/client.js');
})

app.get('/styles.css', function(req, res){
	res.sendFile(__dirname + '/public/styles.css');
})

app.get('/fastclick.js', function(req, res){
	res.sendFile(__dirname + '/public/fastclick.js');
})

app.get('/beep.mp3', function(req, res) {
	res.sendFile(__dirname + '/public/beep.mp3');
})

http.listen(3000, function(){
	console.log('listening on *:3000');
})

/* Socket */
var maxPoints = 7

var clients = []
function c(id) {
	return io.sockets.connected[id]
}

var timeRemaining = -1
var timer = setInterval(function() {
		timeRemaining--
		if (timeRemaining == 0) {
			endRound()
		}

		//io.sockets.emit('play beep')
	}, 1000)
var teams = []
var currentTalker = null
var currentTalkerTeam = null

initGame()

function initGame() {
	// Init lists
	var team = {
		points: 0,
		members: []
	}

	teams = []
	teams[0] = JSON.parse(JSON.stringify(team)) // Duplicate object to remove references
	teams[1] = JSON.parse(JSON.stringify(team))

}

function startRound() {
	// Put players on teams
	for (var i in clients) {
		var playerTeam
		if (c(clients[i]).team == 0) {
			playerTeam = 0
		} else {
			playerTeam = 1
		}
		teams[playerTeam].members.push(clients[i])
	}

	// Setup timer
	timeRemaining = Math.floor(Math.random() * 15) + 30

	io.sockets.emit('clear phrase')

	nextTalker()
}

function endRound() {
	var winningTeam = (currentTalkerTeam + 1) % 2
	teams[winningTeam].points++

	if (teams[winningTeam].points >= maxPoints && Math.abs(teams[0].points - teams[1].points) >= 2) {
		// Game over
		io.sockets.emit('game over', {
			winner: winningTeam,
			team1Points: teams[0].points,
			team2Points: teams[1].points
		})
		initGame()
	} else {
		io.sockets.emit('round over', {
			winner: winningTeam,
			team1Points: teams[0].points,
			team2Points: teams[1].points
		})
	}
}

function formulateTeamList() {
	var list = [[], []]
	for (var i in clients) {
		var client = c(clients[i])
		list[client.team].push(client.username)
	}
	return list
}

function countMembers(team) {
	var count = 0
	for (var i in clients) {
		var client = c(clients[i])
		if (client.team == team)
			count++
	}
	return count
}

function nextPhrase() {
	return phrases[Math.floor(Math.random() * phrases.length)]
}

function nextTalker() {
	var e = new Error('dummy')
	var stack = e.stack.replace(/^[^\(]+?[\n$]/gm, '')
		.replace(/^\s+at\s+/gm, '')
		.replace(/^Object.<anonymous>\s*\(/gm, '{anonymous}()@')
		.split('\n')

	if (typeof currentTalkerTeam !== 'undefined') {
		currentTalkerTeam = (currentTalkerTeam + 1) % 2
	} else {
		currentTalkerTeam = Math.round(Math.random())
	}

	var teamList = teams[currentTalkerTeam].members
	var talkerIndex = Math.floor(Math.random() * teamList.length)
	currentTalker = teamList[talkerIndex]

	var talkerClient = c(currentTalker)
	talkerClient.emit('new phrase', {
		phrase: nextPhrase()
	})

	return talkerClient.username
}

io.on('connection', function(socket){
	socket.on('add user', function(username) {
		// Add to clients
		clients.push(socket.id)

		// Add to socket session
		socket.username = username

		// Choose team
		socket.team = 0
		if (countMembers(0) > countMembers(1)) {
			socket.team = 1
		}

		socket.emit('set team', {
			team: socket.team
		})

		io.sockets.emit('new teams', {
			teams: formulateTeamList()
		})
	})

	socket.on('change team', function(team) {
		socket.team = team

		socket.emit('set team', {
			team: socket.team
		})

		io.sockets.emit('new teams', {
			teams: formulateTeamList()
		})
	})

	socket.on('start round', function() {
		startRound()
		io.sockets.emit('new round', {
			talker: c(currentTalker).username,
			team: currentTalkerTeam
		})
	})

	socket.on('new game', function() {
		initGame()
		io.sockets.emit('new game screen')
	})

	socket.on('next phrase', function() {
		if (socket.id == currentTalker) {
			socket.emit('new phrase', {
				phrase: nextPhrase()
			})
		}
	})

	socket.on('correct phrase', function() {
		if (socket.id == currentTalker) {
			io.sockets.emit('clear phrase')
			nextTalker()
			io.sockets.emit('new talker', {
				talker: c(currentTalker).username,
				team: currentTalkerTeam
			})
		}
	})

	socket.on('disconnect', function() {
		// Remove from clients
		console.log(socket.id + " disconnected.")
		clients.splice(clients.indexOf(socket.id), 1)
		io.sockets.emit('new teams', {
			teams: formulateTeamList()
		})
	})
})