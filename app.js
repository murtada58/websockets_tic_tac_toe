const DOMAIN =  "websockettictactoe.co.uk" // set to "127.0.0.1" or your servers ip if you want to host your own server
const PORT = "6789"

let websocket = new WebSocket(`wss://${DOMAIN}:${PORT}/`);

const users = document.getElementById("user-count");
const createGame = document.getElementById("create-game");
const leave = document.getElementById("leave");
const lobbies = document.getElementById("lobbies");
const game = document.getElementById("game");
const turn = document.getElementById("turn");

for (i=0; i<9; i++)
{
    document.getElementById(i).onclick = function () {
        console.log(this.dataset.num);
        websocket.send(JSON.stringify({action: 'update', num: this.dataset.num}));
    }
}
createGame.onclick = () => {
    websocket.send(JSON.stringify({action: 'create'}));
    lobbies.style.display = "none"
    game.style.display = "grid"
    createGame.style.display = "none"
    leave.style.display = "grid"
}

leave.onclick = () => {
    websocket.send(JSON.stringify({action: 'leave'}));
    lobbies.style.display = "block"
    game.style.display = "none"
    createGame.style.display = "grid"
    leave.style.display = "none"
}

function addLobby(lobbies, lobbyName, numberOfPlayers)
{
    const lobby = document.createElement("div");
    lobby.classList.add("lobby");
    lobby.dataset.name = lobbyName;

    const name = document.createElement("p")
    name.classList.add("lobby-name");
    name.textContent = `Lobby: ${lobbyName}`

    const users = document.createElement("p")
    users.classList.add("lobby-users");
    users.textContent = `Users: ${numberOfPlayers}/2`

    const button = document.createElement("p")
    button.classList.add("lobby-button");
    if (numberOfPlayers < 2)
    {
        button.classList.add("active")
        button.textContent = "Join"
    }
    else
    {
        button.classList.add("inactive")
        button.textContent = "Full"
    }
    button.onclick = () => {
        if (button.classList.contains("active"))
        {
            websocket.send(JSON.stringify({action: 'join', name: lobbyName}));
        }
    }


    lobby.appendChild(name);
    lobby.appendChild(users);
    lobby.appendChild(button);

    lobbies.appendChild(lobby);
}

function clearLobbies(lobbies)
{
    while (lobbies.lastChild) {
        lobbies.removeChild(lobbies.lastChild);
    }
}

websocket.onmessage = function (event) {
    data = JSON.parse(event.data);
    switch (data.type) {
        case 'users':
            users.textContent = (
                data.count.toString() + " user" +
                (data.count == 1 ? "" : "s") + " currently online");
            break;

        case 'lobby':
            clearLobbies(lobbies);
            for (const [key, value] of Object.entries(data.lobbies))
            {
                addLobby(lobbies, key, value)
            }
            break;

        case 'join':
            console.log("joined")
            lobbies.style.display = "none"
            game.style.display = "grid"
            createGame.style.display = "none"
            leave.style.display = "grid"
            if (data.turn == "you")
            {
                turn.textContent = "Your turn"
            }
            else
            {
                turn.textContent = "Enemy turn"
            }
            break;
            
        case 'enemy_leave':
            turn.textContent = "Enemy Left the game wait for someone else to join"
            break;

        case 'update':
            for (i=0; i<9; i++)
            {
                document.getElementById(i).textContent = data.board[i]
            }

            if (data.turn == "wait")
            {
                turn.textContent = "Waiting for someone to join"
            }
            else if (data.turn == "you")
            {
                turn.textContent = "Your turn"
            }
            else
            {
                turn.textContent = "Enemy turn"
            }

            if (data.outcome == 'false')
            {
                console.log(data.board)
            }
            else
            {
                turn.textContent = `You ${data.outcome}`
            }

            break;
        default:
            console.error("unsupported event", data);
    }
};