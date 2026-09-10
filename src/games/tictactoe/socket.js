const { createRoom, getRoom, joinRoom, cleanRoom, handleDisconnect } = require('../../core/roomManager');
const { getGameResult } = require('./logic');

module.exports = (io, socket, playerId) => {
  const sendError = (message) => {
    socket.emit('error', { message });
  };

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
      
      // Swap starting players so they alternate
      if (room.playerO) {
        const temp = room.playerX;
        room.playerX = room.playerO;
        room.playerO = temp;
      }

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
};
