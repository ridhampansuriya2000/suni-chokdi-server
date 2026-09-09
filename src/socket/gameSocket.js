const { createRoom, getRoom, joinRoom, cleanRoom, handleDisconnect } = require('../game/roomManager');
const { getGameResult } = require('../game/gameLogic');

module.exports = (io) => {
  io.on('connection', (socket) => {
    // The client should ideally send a consistent playerId in the handshake or auth.
    // If not provided, we use the socket.id, though it breaks reconnection.
    const playerId = socket.handshake.query.playerId || socket.id;

    console.log(`Player connected: ${playerId} (Socket ID: ${socket.id})`);

    // Helper to send clean error messages
    const sendError = (message) => {
      socket.emit('error', { message });
    };

    socket.on('create-room', () => {
      const room = createRoom(playerId);
      socket.join(room.roomId);
      
      // Keep track of which room this socket is in
      socket.roomId = room.roomId;

      socket.emit('room-created', {
        roomId: room.roomId,
        player: 'X',
        status: room.status,
      });
    });

    socket.on('join-room', ({ roomId }) => {
      if (!roomId) return sendError('Invalid room ID');

      const result = joinRoom(roomId, playerId);
      
      if (result.error) {
        return sendError(result.error); // ROOM_NOT_FOUND or ROOM_FULL
      }

      socket.join(roomId);
      socket.roomId = roomId;

      const room = result.room;
      const playerSymbol = room.playerX === playerId ? 'X' : 'O';

      socket.emit('player-joined', {
        roomId,
        player: playerSymbol,
        status: room.status,
      });

      if (room.status === 'playing') {
        io.to(roomId).emit('game-start', {
          board: room.board,
          currentTurn: room.currentTurn,
          playerX: room.playerX,
          playerO: room.playerO,
        });
      }
      
      if (result.reconnected) {
        // Send current state to reconnected player
        socket.emit('game-state', {
          board: room.board,
          currentTurn: room.currentTurn,
          winner: room.winner,
          status: room.status,
        });
        socket.to(roomId).emit('player-reconnected', { player: playerSymbol });
      }
    });

    socket.on('make-move', ({ roomId, cellIndex }) => {
      const room = getRoom(roomId);

      if (!room) return sendError('Invalid room');
      if (room.status !== 'playing') return sendError('Game is not active or already finished');
      if (cellIndex < 0 || cellIndex > 8) return sendError('Invalid cell');
      if (room.board[cellIndex] !== null) return sendError('Occupied cell');

      // Verify player belongs to room and it's their turn
      let playerSymbol = null;
      if (room.playerX === playerId) playerSymbol = 'X';
      else if (room.playerO === playerId) playerSymbol = 'O';

      if (!playerSymbol) return sendError('Invalid player for this room');
      if (room.currentTurn !== playerSymbol) return sendError('Wrong turn');

      // Place symbol
      room.board[cellIndex] = playerSymbol;

      // Check win/draw
      const { winner, winningLine, draw } = getGameResult(room.board);

      if (winner) {
        room.status = 'finished';
        room.winner = winner;
        room.winningLine = winningLine;
      } else if (draw) {
        room.status = 'finished';
        room.winner = 'Draw';
        room.winningLine = null;
      } else {
        // Change turn
        room.currentTurn = room.currentTurn === 'X' ? 'O' : 'X';
      }

      // Clear restart requests upon a new move (if any existed before game finished)
      room.restartRequests.clear();

      // Broadcast state
      io.to(roomId).emit('game-state', {
        board: room.board,
        currentTurn: room.currentTurn,
        winner: room.winner,
        winningLine: room.winningLine,
        status: room.status,
      });

      if (room.status === 'finished') {
        io.to(roomId).emit('game-over', { winner: room.winner, winningLine: room.winningLine });
      }
    });

    socket.on('request-restart', ({ roomId }) => {
      const room = getRoom(roomId);
      if (!room) return sendError('Invalid room');
      
      room.restartRequests.add(playerId);
      socket.to(roomId).emit('restart-requested', { by: playerId });
    });

    socket.on('accept-restart', ({ roomId }) => {
      const room = getRoom(roomId);
      if (!room) return sendError('Invalid room');

      room.restartRequests.add(playerId);

      // If both accepted, reset
      if (room.restartRequests.size === 2 || !room.playerO) {
        room.board = Array(9).fill(null);
        room.currentTurn = 'X';
        room.winner = null;
        room.winningLine = null;
        room.status = 'playing';
        room.restartRequests.clear();

        io.to(roomId).emit('game-start', {
          board: room.board,
          currentTurn: room.currentTurn,
          playerX: room.playerX,
          playerO: room.playerO,
        });
      }
    });

    socket.on('decline-restart', ({ roomId }) => {
      const room = getRoom(roomId);
      if (!room) return sendError('Invalid room');
      
      room.restartRequests.clear();
      socket.to(roomId).emit('restart-declined');
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
          // Callback when room is destroyed after timeout
          io.to(socket.roomId).emit('room-closed', { reason: 'timeout' });
        });
      }
    });
  });
};
