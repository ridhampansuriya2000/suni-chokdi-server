const { generateId } = require('../utils/generateId');

// In-memory store for active rooms
// Room structure: { roomId, playerX, playerO, board, currentTurn, status, winner, disconnectTimeout }
const rooms = new Map();
const DISCONNECT_TIMEOUT_MS = 60000; // 60 seconds timeout before closing a room

const createRoom = (playerId, gameType = 'tictactoe', config = null) => {
  const roomId = generateId();
  
  let maxPlayers = 2;
  if (gameType === 'mindi') {
    maxPlayers = (!config || config.mode === '4_humans') ? 4 : 2;
  }

  const newRoom = {
    roomId,
    gameType,
    config,
    playerX: playerId, // Creator is always 'X'
    playerO: null,
    players: [playerId], // Track all players generically
    maxPlayers,
    board: Array(9).fill(null), // Legacy tic-tac-toe default, can be ignored by Bingo
    currentTurn: 'X', // 'X' always starts
    status: 'waiting', // waiting, playing, finished
    winner: null,
    disconnectTimeout: null,
    restartRequests: new Set(),
  };
  rooms.set(roomId, newRoom);
  return newRoom;
};

const getRoom = (roomId) => {
  return rooms.get(roomId);
};

const joinRoom = (roomId, playerId) => {
  const room = rooms.get(roomId);
  
  if (!room) return { error: 'ROOM_NOT_FOUND' };
  
  // Reconnect logic
  if (room.players.includes(playerId)) {
    if (room.disconnectTimeout) {
      clearTimeout(room.disconnectTimeout);
      room.disconnectTimeout = null;
    }
    return { success: true, room, reconnected: true };
  }

  // Join as new player
  if (room.players.length >= room.maxPlayers) {
    return { error: 'ROOM_FULL' };
  }

  room.players.push(playerId);
  if (!room.playerO) {
    room.playerO = playerId; // Legacy assignment for 2-player games
  }

  if (room.players.length === room.maxPlayers) {
    room.status = 'playing';
  }
  return { success: true, room, reconnected: false };
};

const cleanRoom = (roomId) => {
  const room = rooms.get(roomId);
  if (room && room.disconnectTimeout) {
    clearTimeout(room.disconnectTimeout);
  }
  rooms.delete(roomId);
};

const handleDisconnect = (roomId, playerId, callback) => {
  const room = rooms.get(roomId);
  if (!room) return;

  // Set timeout to destroy room if player doesn't reconnect
  room.disconnectTimeout = setTimeout(() => {
    cleanRoom(roomId);
    if (callback) callback();
  }, DISCONNECT_TIMEOUT_MS);
};

module.exports = {
  createRoom,
  getRoom,
  joinRoom,
  cleanRoom,
  handleDisconnect,
  rooms
};
