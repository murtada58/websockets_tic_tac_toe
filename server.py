#!/usr/bin/env python

import asyncio
import json
import logging
import pathlib
import ssl
import websockets
from datetime import datetime
import random

SERVER_IP = "176.58.109.37" # set to "localhost" or your servers ip if you want to host your own server
PORT = 6789

logging.basicConfig()

USERS = set()
USERS_DATA = {}
GAMES = {}

new_game_id = 1
new_user_id = 1

def update_event(game_id, user, turn):
    board = []
    for cell in GAMES[game_id]["board"]:
        if cell == "":
            board.append("")
        elif cell == user:
            board.append("X")
        else:
            board.append("O")

    if GAMES[game_id]["outcome"] == False:
        return json.dumps({"type": "update", "board": board, "turn": turn, "outcome": "false"})
    elif GAMES[game_id]["outcome"] == "tie":
        return json.dumps({"type": "update", "board": board, "turn": turn, "outcome": "tie"})
    elif GAMES[game_id]["outcome"] == user:
        return json.dumps({"type": "update", "board": board, "turn": turn, "outcome": "won"})
    else:
        return json.dumps({"type": "update", "board": board, "turn": turn, "outcome": "lost"})


def users_event():
    return json.dumps({"type": "users", "count": len(USERS)})

def game_event():
    lobbies = {name: len(GAMES[name]["users"]) for name in GAMES}
    return json.dumps({"type": "lobby", "lobbies": lobbies})

def join_event(turn):
    return json.dumps({"type": "join", "turn": turn})

def message_event(chat, message, name, time, color):
    return json.dumps({"type": "message", "chat":chat, "message":message, "name":name, "time":time, "color":color})

async def remove_from_game(websocket):
    if USERS_DATA[websocket]["game"] != None:
        if len(GAMES[USERS_DATA[websocket]["game"]]["users"]) < 2: # if only user in the game delete the game
            del GAMES[USERS_DATA[websocket]["game"]]
            USERS_DATA[websocket]["game"] = None
        else: # if another user still in the game keep the game but remove the disconnecting user
            for user in GAMES[USERS_DATA[websocket]["game"]]["users"]:
                if user != websocket:
                    try:
                        await user.send(json.dumps({"type": "enemy_leave"}))
                    except:
                        del GAMES[USERS_DATA[user]["game"]]
                        USERS_DATA[user]["game"] = None
            GAMES[USERS_DATA[websocket]["game"]]["users"].remove(websocket)
            USERS_DATA[websocket]["game"] = None
    

def validate(user, num):
    if USERS_DATA[user]["game"] not in GAMES:
        print("User not in game")
        return False
    elif len(GAMES[USERS_DATA[user]["game"]]["users"]) < 2:
        print("game still pending another player")
        return False
    elif GAMES[USERS_DATA[user]["game"]]["turn"] != user:
        print("not the current users turn")
        return False
    elif GAMES[USERS_DATA[user]["game"]]["board"][int(num)] != "":
        print("cell not empty")
        return False
    
    return True

def won(user, board):
    # check rows
    for i in range(3):
        enemy_count = 0
        user_count = 0
        for j in range(3):
            if board[j + (3*i)] == "":
                continue
            elif board[j + (3*i)] == user:
                user_count += 1
            else:
                enemy_count += 1

        if user_count >= 3:
            return "user"
        elif enemy_count >= 3:
            return "enemy"
    
    # check columns
    for i in range(3):
        enemy_count = 0
        user_count = 0
        for j in range(3):
            if board[i + (3*j)] == "":
                continue
            elif board[i + (3*j)] == user:
                user_count += 1
            else:
                enemy_count += 1

        if user_count >= 3:
            return "user"
        elif enemy_count >= 3:
            return "enemy"

    # check right diagonal
    enemy_count = 0
    user_count = 0
    for i in range(3):
        if board[4*i] == "":
            continue
        elif board[4*i] == user:
            user_count += 1
        else:
            enemy_count += 1

    if user_count >= 3:
        return "user"
    elif enemy_count >= 3:
        return "enemy"

    # check left diagonal
    enemy_count = 0
    user_count = 0
    for i in range(1, 4):
        if board[2*i] == "":
            continue
        elif board[2*i] == user:
            user_count += 1
        else:
            enemy_count += 1

    if user_count >= 3:
        return "user"
    elif enemy_count >= 3:
        return "enemy"
    
    return False


async def game(websocket, path):
    global new_game_id
    global new_user_id
    try:
        USERS.add(websocket)
        color = "#" + "".join(["0123456789ABCD"[random.randint(0, 13)] for _ in range(6)])
        USERS_DATA[websocket] = {"game": None, "name": "Guest", "id": f"#{new_user_id}", "color": color}
        new_user_id += 1
        websockets.broadcast(USERS, users_event())
        await websocket.send(game_event())
        await websocket.send(json.dumps({"type": "name", "name": USERS_DATA[websocket]["name"], "id": USERS_DATA[websocket]["id"]}))

        async for message in websocket:
            data = json.loads(message)
            if data["action"] == "name_change":
                USERS_DATA[websocket]["name"] = data["name"]
                await websocket.send(json.dumps({"type": "name", "name": USERS_DATA[websocket]["name"], "id": USERS_DATA[websocket]["id"]}))
                
            elif data["action"] == "message":
                time = datetime.now().strftime('%I:%M:%p')
                if data["chat"] == "general":
                    websockets.broadcast(USERS, message_event(data["chat"], data["message"], USERS_DATA[websocket]["name"] + USERS_DATA[websocket]["id"], time, USERS_DATA[websocket]["color"]))
                else:
                    if USERS_DATA[websocket]["game"] != None:
                        for user in GAMES[USERS_DATA[websocket]["game"]]["users"]:
                            await user.send(message_event(data["chat"], data["message"], USERS_DATA[websocket]["name"] + USERS_DATA[websocket]["id"], time, USERS_DATA[websocket]["color"]))  

            elif data["action"] == "create":
                if USERS_DATA[websocket]["game"] == None:
                    GAMES[str(new_game_id)] = {"users": {websocket}, "board": [""]*9, "turn": websocket, "outcome": False}
                    USERS_DATA[websocket]["game"] = str(new_game_id)
                    new_game_id += 1
                    websockets.broadcast(USERS, game_event())
                    await websocket.send(update_event(USERS_DATA[websocket]["game"], websocket, "wait"))  
                else:
                    print(f"User tried to create new game when they are already in a game {websocket}")

            elif data["action"] == "join":
                if data["name"] in GAMES and len(GAMES[data["name"]]["users"]) == 1:
                    GAMES[data["name"]]["users"].add(websocket)
                    USERS_DATA[websocket]["game"] = data["name"]
                    GAMES[USERS_DATA[websocket]["game"]]["outcome"] = False
                    GAMES[USERS_DATA[websocket]["game"]]["board"] = [""]*9
                    for user in GAMES[data["name"]]["users"]:
                        if user == websocket:
                            await user.send(join_event("enemy"))
                            await user.send(update_event(USERS_DATA[websocket]["game"], user, "enemy")) 
                        else:
                            GAMES[data["name"]]["turn"] = user
                            await user.send(join_event("you"))
                            await user.send(update_event(USERS_DATA[websocket]["game"], user, "you")) 
                     
                    websockets.broadcast(USERS, game_event())
                else:
                    print("user tried to join a game that doesnt exist or is full")
            
            elif data["action"] == "leave":
                await remove_from_game(websocket)
                websockets.broadcast(USERS, game_event())

            elif data["action"] == "update":
                if GAMES[USERS_DATA[websocket]["game"]]["outcome"] != False:
                    GAMES[USERS_DATA[websocket]["game"]]["outcome"] = False
                    GAMES[USERS_DATA[websocket]["game"]]["board"] = [""]*9
                    for user in GAMES[USERS_DATA[websocket]["game"]]["users"]:
                        if user == GAMES[USERS_DATA[websocket]["game"]]["turn"]:
                            await user.send(update_event(USERS_DATA[websocket]["game"], user, "you"))
                        else:
                            await user.send(update_event(USERS_DATA[websocket]["game"], user, "enemy"))
                
                elif validate(websocket, data["num"]):
                    GAMES[USERS_DATA[websocket]["game"]]["board"][int(data["num"])] = websocket
                    output = won(websocket, GAMES[USERS_DATA[websocket]["game"]]["board"])
                    if output == "user":
                        GAMES[USERS_DATA[websocket]["game"]]["outcome"] = websocket
                    elif output == "enemy":
                        print("this shouldnt be possible")
                    else:
                        GAMES[USERS_DATA[websocket]["game"]]["outcome"] = False
                        full = [False if cell == "" else True for cell in GAMES[USERS_DATA[websocket]["game"]]["board"]]
                        if all(full):
                            GAMES[USERS_DATA[websocket]["game"]]["outcome"] = "tie"
                    
                    for user in GAMES[USERS_DATA[websocket]["game"]]["users"]:
                        if user != websocket:
                            GAMES[USERS_DATA[websocket]["game"]]["turn"] = user
                            await user.send(update_event(USERS_DATA[websocket]["game"], user, "you"))
                        else:
                            await user.send(update_event(USERS_DATA[websocket]["game"], user, "enemy"))
            else:
                logging.error("unsupported event: %s", data)
    finally:
        USERS.remove(websocket)
        await remove_from_game(websocket)
        del USERS_DATA[websocket]
        websockets.broadcast(USERS, users_event())
        websockets.broadcast(USERS, game_event())

ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
cert = "/etc/letsencrypt/live/websockettictactoe.co.uk/fullchain.pem"
key = "/etc/letsencrypt/live/websockettictactoe.co.uk/privkey.pem"
ssl_context.load_cert_chain(cert, keyfile=key)

async def main():
    async with websockets.serve(game, SERVER_IP, PORT, ssl=ssl_context):
        await asyncio.Future()  # run forever


if __name__ == "__main__":
    asyncio.run(main())