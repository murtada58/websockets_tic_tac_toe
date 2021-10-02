const DOMAIN =  "websockettictactoe.co.uk" // set to "127.0.0.1" or your servers ip if you want to host your own server you will need to change wss to ws as well unless you have a certificate
const PORT = "6789"

let websocket = new WebSocket(`wss://${DOMAIN}:${PORT}/`);

const users = document.getElementById("user-count");
const createGame = document.getElementById("create-game");
const leave = document.getElementById("leave");
const games = document.getElementById("active-games")
const lobbies = document.getElementById("lobbies");
const game = document.getElementById("game");
const turn = document.getElementById("turn");
const generalChatMessages = document.getElementById("general-chat-messages");
const generalChatInput = document.getElementById("general-chat-input");
const gameChatMessages = document.getElementById("game-chat-messages");
const gameChatInput = document.getElementById("game-chat-input");
const usernameInput = document.getElementById("username");
const usernameId = document.getElementById("user-id");

usernameInput.value = username;

for (i=0; i<9; i++)
{
    document.getElementById(i).onclick = function () {
        console.log(this.dataset.num);
        websocket.send(JSON.stringify({action: 'update', num: this.dataset.num}));
    }
}
createGame.onclick = () => {
    websocket.send(JSON.stringify({action: 'create'}));
    games.style.display = "none"
    game.style.display = "grid"
    createGame.style.display = "none"
    leave.style.display = "grid"
}

leave.onclick = () => {
    websocket.send(JSON.stringify({action: 'leave'}));
    games.style.display = "grid"
    game.style.display = "none"
    createGame.style.display = "grid"
    leave.style.display = "none"
}

usernameInput.onkeydown = function (event) {
    if (event.key == 'Enter')
    {
        console.log(this.value)
        if (this.value.length <= 16)
        {
            websocket.send(JSON.stringify({action: 'name_change', name: this.value}));
            alert(`username changed to ${this.value}`)
        }
        else
        {
            alert("Please choose a name no longer than 16 characters")
        }
    }
}

generalChatInput.onkeydown = function (event) {
    if (event.key == 'Enter')
    {
        console.log(this.value)
        websocket.send(JSON.stringify({action: 'message', chat:"general", message: this.value}));
        this.value = ""
    }
}

gameChatInput.onkeydown = function (event) {
    if (event.key == 'Enter')
    {
        console.log(this.value)
        websocket.send(JSON.stringify({action: 'message', chat:"game", message: this.value}));
        this.value = ""
    }
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

function addMessage(chat, messasgeContent, name, serverTime, color)
{ 
    const messageName = document.createElement("p");
    if (username + usernameId == name)
    {
        messageName.classList.add("message-name-stranger");
    }
    else 
    {
        messageName.classList.add("message-name-user");
    }

    messageName.textContent = name;
    messageName.style.color = color;

    const message = document.createElement("p");
    message.classList.add("message");
    message.textContent = messasgeContent;

    const messageTime = document.createElement("p");
    messageTime.classList.add("message-time");
    const localTime = new Intl.DateTimeFormat('en-US', {hour: 'numeric', minute: 'numeric', hour12: true}).format(new Date())
    messageTime.textContent = localTime;

    const messageContainer = document.createElement("div");
    messageContainer.classList.add("message-container");
    messageContainer.appendChild(messageName);
    messageContainer.appendChild(message);
    messageContainer.appendChild(messageTime);

    if (chat == "general")
    {
        generalChatMessages.appendChild(messageContainer)
        generalChatMessages.scrollTop = generalChatMessages.scrollHeight
    }
    else
    {
        gameChatMessages.appendChild(messageContainer)
        gameChatMessages.scrollTop = gameChatMessages.scrollHeight
    }
}

function clearLobbies(lobbies)
{
    while (lobbies.lastChild) {
        lobbies.removeChild(lobbies.lastChild);
    }
}

websocket.onmessage = function (event) {
    data = JSON.parse(event.data);
    const empty_message = document.createElement("h3")
    switch (data.type) {
        case 'id':
            

            break;

        case 'users':
            users.textContent = (
                data.count.toString() + " user" +
                (data.count == 1 ? "" : "s") + " currently online");
            break;
        
        case 'name':
            usernameId.textContent = data.id
            usernameInput.value = data.name;
            break;

        case 'lobby':
            clearLobbies(lobbies);
            let number_of_lobbies = 0;
            for (const [key, value] of Object.entries(data.lobbies))
            {
                number_of_lobbies++;
                addLobby(lobbies, key, value);
            }
            if (number_of_lobbies == 0)
            {
                const empty_message = document.createElement("h3")
                empty_message.textContent = "There are currently no active games"
                lobbies.appendChild(empty_message)
            }
            break;
        
        case 'message':
            addMessage(data.chat, data.message, data.name, data.time, data.color);
            break;

        case 'join':
            console.log("joined")
            games.style.display = "none"
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
            
            empty_message.textContent = "Enemy Joined"
            gameChatMessages.appendChild(empty_message)
            gameChatMessages.scrollTop = gameChatMessages.scrollHeight
            break;
            
        case 'enemy_leave':
            turn.textContent = "Enemy Left the game wait for someone else to join"
            empty_message.textContent = "Enemy left"
            gameChatMessages.appendChild(empty_message)
            gameChatMessages.scrollTop = gameChatMessages.scrollHeight
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
            else if (data.outcome == 'tie')
            {
                turn.textContent = "Tie, Click on any cell to restart"
            }
            else
            {
                turn.textContent = `You ${data.outcome}, Click on any cell to restart`
            }

            break;
        default:
            console.error("unsupported event", data);
    }
};