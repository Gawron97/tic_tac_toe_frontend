import { makeAutoObservable, runInAction } from "mobx";
import { api } from "../api";
import { BoardOfNumbers, Room, SquareValue } from "../types";


class Store {

    username = '';
    gameInProgress = false;
    room: Room | null = null;
    isYourTurn = false;
    board: SquareValue[][] = this.resetBoard();
    isGameOver = false;
    isWinner: boolean | null = null;

    constructor() {
        makeAutoObservable(this);
    }

    saveRoomDataToLocalStorage() {
        const dataToStore = {
            username: this.username,
            room: this.room
        }
        localStorage.setItem('roomData', JSON.stringify(dataToStore));
    }

    getRoomDataFromLocalStorage() {
        const roomData = localStorage.getItem('roomData');
        if (roomData) {
            return JSON.parse(roomData);
        } else {
            return null
        }
    }

    async chooseRoom() {
        const userRoom = this.getRoomDataFromLocalStorage();
        if (userRoom && !this.username) { // this when user is refreshing site
            this.username = userRoom.username;
            try {
                const response = await api.getRoom(userRoom.room.roomName);
                this.startWebSocketConnection();
                this.restoreBoard(response.fields);
                runInAction(() => {
                    this.room = {
                        roomName: response.roomName,
                        freeSlots: response.freeSlots,
                        player1: response.player1,
                        player2: response.player2
                    };
                    this.updatePlayerTurnFromRoom();
                    console.log('is your turn?', this.isYourTurn);
                });
                return;
            } catch (error) {
                console.error("Nie udało się przywrócić pokoju:", error);
            }
        }
        store.chooseRoomForGame(); // this when user is logging for playing, searching for room
    }

    updateRoom(room: Room) {
        this.room = room;
        this.updatePlayerTurnFromRoom();
    }

    updatePlayerTurnFromRoom() {
        if (this.username === this.room?.player1.name) {
            this.isYourTurn = this.room.player1.starting;
        } else if (this.username === this.room?.player2.name) {
            this.isYourTurn = this.room.player2.starting;
        } else {
            this.isYourTurn = false;
        }
    }

    setGameOver(winner: boolean, draw: boolean) {
        this.isGameOver = true;
        this.gameInProgress = false;
        this.isWinner = draw ? null : winner;
    }

    resetGame() {
        store.resetBoard()
        store.isGameOver = false;
        store.gameInProgress = false;
        store.isWinner = null;
    }

    resetBoard() {
        const board = Array(3).fill(null);
        for (let i = 0; i < 3; i++) {
            board[i] = Array(3).fill(null);
        }
        return board
    }

    get yourSymbol() {
        if (this.username === this.room?.player1.name) {
            return 'X';
        } else if (this.username === this.room?.player2.name) {
            return 'O';
        } else {
            return null;
        }
    }

    get opponentSymbol() {
        if (this.yourSymbol === null) {
            return null;
        }
        return this.yourSymbol === 'X' ? 'O' : 'X';
    }

    restoreBoard(board: BoardOfNumbers) {
        console.log(board);
        this.updateEntireBoard(board);
        this.startRound();
    }

    startWebSocketConnection() {
        api.webSocket.startConnection();
    }

    sendMove(i: number, j: number) {
        this.isYourTurn = false;
        this.board[i][j] = this.yourSymbol;
        api.webSocket.sendMove(i, j);
    }

    updateEntireBoard(board: BoardOfNumbers) {
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                this.board[i][j] = board[i][j] === 1 ? "X" : board[i][j] === 2 ? "O" : null;
            }
        }
    }

    startRound() {
        this.gameInProgress = true;
        this.isYourTurn = true;
        this.isWinner = null;
        this.isGameOver = false;
    }

    async chooseRoomForGame() {
        try {
            await this.startWebSocketConnection();
            await new Promise(resolve => setTimeout(resolve, 1000));
    
            const response = await api.chooseRoomForPlayer(this.username);
            runInAction(() => {
                this.room = response;
                this.saveRoomDataToLocalStorage();
            });
            return true;
        } catch (error) {
            console.error('Błąd:', error);
            return error;
        }
    }

    deletePlayerFromRoom(roomName: string, username: string) {
        try {
            api.deletePlayerFromRoom(roomName, username);
            this.resetStore()
            return true;
        } catch (error) {
            return error;
        }
    }

    resetStore() {
        this.username = '';
        this.gameInProgress = false;
        this.room = null;
        this.isYourTurn = false;
        this.board = this.resetBoard();
        this.isGameOver = false;
        this.isWinner = null;
        api.webSocket.disconnect();
    }
}

export const store = new Store();
