const { createRoom, joinRoom, handleDisconnect } = require('./roomManager');

module.exports = (io, socket, playerId) => {
  const sendError = (message) => {
    socket.emit('error', { message });
  };

  socket.on('create-room', ({ gameType } = {}) => {
    // default to tictactoe if not specified
    const type = gameType || 'tictactoe';
    const room = createRoom(playerId, type);
    socket.join(room.roomId);
    socket.roomId = room.roomId;

    socket.emit('room-created', {
      roomId: room.roomId,
      player: 'X',
      status: room.status,
      gameType: room.gameType
    });
  });

  socket.on('join-room', ({ roomId }) => {
    if (!roomId) return sendError('Invalid room ID');
    const result = joinRoom(roomId, playerId);
    
    if (result.error) {
      return sendError(result.error);
    }

    socket.join(roomId);
    socket.roomId = roomId;

    const room = result.room;
    const playerSymbol = room.playerX === playerId ? 'X' : 'O';

    // Tell the joiner their info
    socket.emit('player-joined', {
      roomId,
      player: playerSymbol,
      status: room.status,
      gameType: room.gameType,
      players: room.players
    });

    // Notify/start based on game type
    if (!result.reconnected) {
      if (room.gameType === 'tictactoe') {
        // For TicTacToe: immediately start the game for both players
        io.to(roomId).emit('game-start', {
          board: room.board,
          currentTurn: room.currentTurn,
          playerX: room.playerX,
          playerO: room.playerO,
        });
      } else if (room.gameType === 'sos') {
        if (!room.sosState) {
          room.sosState = {
            board: Array(25).fill(null),
            scores: { X: 0, O: 0 },
            currentTurn: 'X',
            winner: null,
            status: 'playing'
          };
        }
        io.to(roomId).emit('sos-game-start', {
          board: room.sosState.board,
          currentTurn: room.sosState.currentTurn,
          scores: room.sosState.scores,
          playerX: room.playerX,
          playerO: room.playerO,
        });
      } else {
        // For Bingo and future games: just tell creator opponent arrived
        socket.to(roomId).emit('opponent-joined', {
          status: room.status,
          gameType: room.gameType,
          players: room.players
        });
      }
    } else {
      // Reconnect: notify opponent they are back
      socket.to(roomId).emit('player-reconnected');
    }
  });


  // WebRTC Signaling Events
  socket.on('webrtc-offer', ({ roomId, offer }) => {
    socket.to(roomId).emit('webrtc-offer', offer);
  });

  socket.on('webrtc-answer', ({ roomId, answer }) => {
    socket.to(roomId).emit('webrtc-answer', answer);
  });

  socket.on('webrtc-ice-candidate', ({ roomId, candidate }) => {
    socket.to(roomId).emit('webrtc-ice-candidate', candidate);
  });

  socket.on('voice-status', ({ roomId, isActive }) => {
    socket.to(roomId).emit('opponent-voice-status', { isActive });
  });

  socket.on('leave-room', () => {
    if (socket.roomId) {
      const leavingRoomId = socket.roomId;
      socket.leave(leavingRoomId);
      socket.to(leavingRoomId).emit('player-disconnected', { reason: 'left' });
      socket.roomId = null;
      // Clean room so it can't be rejoined
      const { cleanRoom } = require('./roomManager');
      cleanRoom(leavingRoomId);
    }
  });


  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${playerId}`);
    if (socket.roomId) {
      socket.to(socket.roomId).emit('player-disconnected');
      handleDisconnect(socket.roomId, playerId, () => {
        io.to(socket.roomId).emit('room-closed', { reason: 'timeout' });
      });
    }
  });
};
