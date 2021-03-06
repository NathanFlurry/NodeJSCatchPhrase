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

var remainingPhrases = []

function initGame() {
	// Init lists
	var team = {
		points: 0,
		members: [],
		remainingMembers: []
	}

	teams = []
	teams[0] = JSON.parse(JSON.stringify(team)) // Duplicate object to remove references
	teams[1] = JSON.parse(JSON.stringify(team))

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
}

function startRound() {
	
	// Setup timer
	timeRemaining = Math.floor(Math.random() * 30) + 75

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
	if (remainingPhrases.length <= 2) {
		for (var i = 0; i < phrases.length; i++) {
			remainingPhrases.push(phrases[i])
		}
	}

	var index = Math.floor(Math.random() * remainingPhrases.length)
	var word = remainingPhrases.splice(index, 1)

	return word
}

function nextTalker() {
	if (typeof currentTalkerTeam !== 'undefined') {
		currentTalkerTeam = (currentTalkerTeam + 1) % 2
	} else {
		currentTalkerTeam = Math.round(Math.random())
	}

	var team = teams[currentTalkerTeam]

	if (team.remainingMembers.length <= 0) {
		console.log("\nRenewing members")
		for (var i = 0; i < team.members.length; i++) {
			team.remainingMembers.push(team.members[i])
		} 
	}

	var talkerIndex = Math.floor(Math.random() * team.remainingMembers.length)
	currentTalker = team.remainingMembers[talkerIndex]

	console.log("\nRemaining members: " + team.remainingMembers)

	var talkerClient = c(currentTalker)
	if (talkerClient == undefined || talkerClient == null) {
		console.log("Remaining members: " + team.remainingMembers + "\nTalker index: " + talkerIndex + "\nClient: " + talkerClient)
		return nextTalker()
	} else {
		talkerClient.emit('new phrase', {
			phrase: nextPhrase()
		})
		team.remainingMembers.splice(talkerIndex, 1)
	}

	return talkerClient.username
}

io.on('connection', function(socket){
	console.log("Socket with ID " + socket.id + " connected. This socket has a name of " + socket.username + ".")
	socket.emit('client id', {
		clientID: socket.id
	})

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

	socket.on('start game', function() {
		initGame()
		startRound()
		io.sockets.emit('new round', {
			talker: c(currentTalker).username,
			team: currentTalkerTeam
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

	socket.on('client error', function(message, url, lineNumber) {
		console.log("Client with username " + socket.username + " had error with message '" + message + "' at line number " + lineNumber + ".")
	})

	socket.on('disconnect', function() {
		// Remove from clients
		console.log(socket.id + " disconnected who had the name " + socket.username + ".")
		
		var index = clients.indexOf(socket.id)
		if (index >= 0) {
			clients.splice(index, 1)
		}
		io.sockets.emit('new teams', {
			teams: formulateTeamList()
		})
	})
})