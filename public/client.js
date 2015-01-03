// Touch events https://developer.mozilla.org/en-US/docs/Web/Guide/Events/Touch_events
// Drop Jquery http://toddmotto.com/is-it-time-to-drop-jquery-essentials-to-learning-javascript-from-a-jquery-background/

//setInterval(function () { window.href = "#" + Math.floor(Math.random() * 999) }, 10000)

// Start app
var socket = io()

var beep = new Audio("beep.mp3")
beep.volume = 0

// Keep device awake
//setInterval(function () { beep.play() }, 10000)

var username = ""
var team = 0

var team1Score = 0
var team2Score = 0

var lastWinner = 0

window.onload = function() {
	if ('addEventListener' in document) {
		document.addEventListener('DOMContentLoaded', function() {
			FastClick.attach(document.body);
		}, false);
	}

	// Start app
	init()
}

var currentScene = null
var sceneData = {
	join: ['#71A3AD', joinScene],
	waiting: ['#71A3AD', waitingScene],
	game: ['#71A3AD', gameScene],
	gameover: ['#71A3AD', gameoverScene]
}

function goToScene(scene) {
	if (!!currentScene) {
		document.querySelector( '#' + currentScene + '-scene' ).style.display = 'none'
	}

	document.querySelector( '#' + scene + '-scene' ).style.display = 'block'

	document.body.style.backgroundColor = sceneData[scene][0]

	sceneData[scene][1]()

	currentScene = scene
}

function init() {
	styling()

	var scenes = document.querySelectorAll( '.scene' )
	for (var i = 0; i < scenes.length; i++) {
		var scene = scenes[i]

		scene.style.display = 'none'
	}

	goToScene('join') // Init scene
}

function styling() {
	var buttons = document.querySelectorAll( '.button' )

	for (var i = 0; i < buttons.length; i++) {
		var button = buttons[i]

		function buttonDown(e) {
			e.target.classList.add('active')
		}

		function buttonUp(e) {
			e.target.classList.remove('active')
		}

		button.addEventListener('touchstart', function(e) {
			e.preventDefault()
			buttonDown(e)
		}, false)

		button.addEventListener('mousedown', function(e) {
			e.preventDefault()
			buttonDown(e)
		}, false)

		button.addEventListener('touchend', function(e) {
			e.preventDefault()
			buttonUp(e)
		}, false)

		button.addEventListener('mouseup', function(e) {
			e.preventDefault()
			buttonUp(e)
		}, false)
	}
}

socket.on('client id', function(data) {
	var clientID = document.querySelector( '#client-id' )
	clientID.innerHTML = data.clientID
})

/* Join scene */
function joinScene() {
	var usernameBox = document.querySelector( '#username' )
	var joinButton = document.querySelector( '#join-button' )

	function join() {
		if ((usernameBox.value || "").length < 3) {
			alert('Please choose a longer name.')
		} else {
			socket.emit('add user', usernameBox.value)
			username = usernameBox.value
		}
	}

	joinButton.addEventListener('touchend', join, false)
	joinButton.addEventListener('mouseup', join, false)
}

/* Waiting scene */
function waitingScene() {
	var t1Button = document.querySelector( '#team-one-button' )
	var t2Button = document.querySelector( '#team-two-button' )

	function switchTeam(team) {
		socket.emit('change team', team)
	}

	t1Button.addEventListener('touchend', function() { switchTeam(0) }, false)
	t1Button.addEventListener('mouseup', function() { switchTeam(0) }, false)

	t2Button.addEventListener('touchend', function() { switchTeam(1) }, false)
	t2Button.addEventListener('mouseup', function() { switchTeam(1) }, false)


	var startRoundButton = document.querySelector( '#start-button' )

	function startRound() {
		socket.emit('start game')
	}

	startRoundButton.addEventListener('touchend', startRound, false)
	startRoundButton.addEventListener('mouseup', startRound, false)
}

function switchTeamArrow(teamNum) {
	var teamArrow = document.querySelector( '#team-arrow' )

	teamArrow.classList.remove( 'red' )
	teamArrow.classList.remove( 'blue' )

	teamArrow.classList.add( (teamNum == 0) ? 'red' : 'blue' )
}

socket.on('set team', function(data) {
	goToScene('waiting')

	team = data.team

	switchTeamArrow(team)
})

socket.on('new teams', function(data) {
	var t = data.teams

	var string = ""
	for (var i = 0; i < t[0].length; i++) {
		string += t[0][i] + " : "
	}
	string += "<br />"
	for (var i = 0; i < t[1].length; i++) {
		string += t[1][i] + " : "
	}

	var members = document.querySelector( '#members' )
	members.innerHTML = string
})

socket.on('new round', function() {
	goToScene('game')
})

/* Game scene */
function gameScene() {
	var nextButton = document.querySelector( '#next-button' )
	var correctButton = document.querySelector( '#correct-button' )

	function nextPhrase() {
		socket.emit('next phrase')
	}

	function correctPhrase(e) {
		socket.emit('correct phrase')
	}

	nextButton.addEventListener('touchend', nextPhrase, false)
	nextButton.addEventListener('mouseup', nextPhrase, false)

	correctButton.addEventListener('touchend', correctPhrase, false)
	correctButton.addEventListener('mouseup', correctPhrase, false)
}

socket.on('clear phrase', function(data) {
	var phrase = document.querySelector( '#phrase' )
	phrase.innerHTML = '-'

	var gameScene = document.querySelector( '#game-scene' )
	gameScene.classList.add( 'hide-buttons' )
})

socket.on('new phrase', function(data) {
	var phrase = document.querySelector( '#phrase' )
	phrase.innerHTML = data.phrase

	var gameScene = document.querySelector( '#game-scene' )
	gameScene.classList.remove( 'hide-buttons' )

})

socket.on('new talker', function(data) {
	var talker = document.querySelector( '#current-talker' )

	talker.innerHTML = data.talker
})

socket.on('play beep', function(data) {
	beep.playbackRate = data.playbackRate
	beep.play()
})

/* Game over scene */
function gameoverScene() {
	var team1ScoreText = document.querySelector( '#gameover-scene #team-one-score' )
	var team2ScoreText = document.querySelector( '#gameover-scene #team-two-score' )

	team1ScoreText.innerHTML = team1Score
	team2ScoreText.innerHTML = team2Score

	console.log(team1Score + " : " + team2Score)
}

socket.on('round over', function(data) {
	lastWinner = data.winner
	team1Score = data.team1Points
	team2Score = data.team2Points

	goToScene('gameover')

	var newGameButton = document.querySelector( '#gameover-scene #new-game-button' )
	newGameButton.innerHTML = "New Round"

	function newRound() {
		socket.emit('start round')
		goToScene('game')

		newGameButton.removeEventListener('touchend', newRound, false)
		newGameButton.removeEventListener('mouseup', newRound, false)
	}

	newGameButton.addEventListener('touchend', newRound, false)
	newGameButton.addEventListener('mouseup', newRound, false)

})

socket.on('game over', function(data) {
	lastWinner = data.winner
	team1Score = data.team1Points
	team2Score = data.team2Points

	goToScene('gameover')

	var newGameButton = document.querySelector( '#gameover-scene #new-game-button' )
	newGameButton.innerHTML = "New Game"

	function newGame() {
		socket.emit('new game')
		newGameButton.removeEventListener('touchend', newGame, false)
		newGameButton.removeEventListener('mouseup', newGame, false)
	}

	newGameButton.addEventListener('touchend', newGame, false)
	newGameButton.addEventListener('mouseup', newGame, false)
})

socket.on('new game screen', function() {
	goToScene('waiting')
})


window.onerror = function(message, url, lineNumber) {
	socket.emit('client error', message, url, lineNumber)
	return true
}


