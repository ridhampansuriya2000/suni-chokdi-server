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

    socket.emit('player-joined', {
      roomId,
      player: playerSymbol,
      status: room.status,
      gameType: room.gameType
    });

    // We let the specific game sockets handle game-start emission because they have specific state structures.
    // E.g. TicTacToe needs to send `board`, Bingo needs to just say it's full.
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
      socket.leave(socket.roomId);
      socket.to(socket.roomId).emit('player-disconnected');
      socket.roomId = null;
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
