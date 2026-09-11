const { getRoom } = require('../../core/roomManager');
const { getNewSOSCount } = require('./logic');

module.exports = (io, socket, playerId) => {
  const sendError = (message) => {
    socket.emit('error', { message });
  };

  socket.on('sos-start-game', ({ roomId }) => {
    const room = getRoom(roomId);
    if (!room || room.status !== 'playing') return;
    
    // Initialize SOS specific state if not present
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
  });

  socket.on('sos-make-move', ({ roomId, cellIndex, symbol }) => {
    const room = getRoom(roomId);

    if (!room || !room.sosState) return sendError('Invalid room');
    if (room.sosState.status !== 'playing') return sendError('Game is not active or already finished');
    if (cellIndex < 0 || cellIndex > 24) return sendError('Invalid cell');
    if (room.sosState.board[cellIndex] !== null) return sendError('Occupied cell');
    if (symbol !== 'S' && symbol !== 'O') return sendError('Invalid symbol');

    let playerSymbol = null;
    if (room.playerX === playerId) playerSymbol = 'X';
    else if (room.playerO === playerId) playerSymbol = 'O';

    if (!playerSymbol) return sendError('Invalid player for this room');
    if (room.sosState.currentTurn !== playerSymbol) return sendError('Wrong turn');

    // Create a copy of the old board
    const oldBoard = [...room.sosState.board];
    
    // Apply move
    room.sosState.board[cellIndex] = symbol;

    // Check for SOS
    const newCount = getNewSOSCount(oldBoard, room.sosState.board);

    if (newCount > 0) {
      room.sosState.scores[playerSymbol] += newCount;
      // Player gets another turn
    } else {
      // Change turn
      room.sosState.currentTurn = room.sosState.currentTurn === 'X' ? 'O' : 'X';
    }

    // Check if board is full
    const isBoardFull = !room.sosState.board.includes(null);
    if (isBoardFull) {
      room.sosState.status = 'finished';
      if (room.sosState.scores.X > room.sosState.scores.O) {
        room.sosState.winner = 'X';
      } else if (room.sosState.scores.O > room.sosState.scores.X) {
        room.sosState.winner = 'O';
      } else {
        room.sosState.winner = 'Draw';
      }
    }

    room.restartRequests.clear();

    // Broadcast state
    io.to(roomId).emit('sos-game-state', {
      board: room.sosState.board,
      currentTurn: room.sosState.currentTurn,
      scores: room.sosState.scores,
      winner: room.sosState.winner,
      status: room.sosState.status,
    });

    if (room.sosState.status === 'finished') {
      io.to(roomId).emit('sos-game-over', { winner: room.sosState.winner, scores: room.sosState.scores });
    }
  });

  socket.on('sos-request-restart', ({ roomId }) => {
    const room = getRoom(roomId);
    if (!room) return sendError('Invalid room');
    
    room.restartRequests.add(playerId);
    socket.to(roomId).emit('sos-restart-requested', { by: playerId });
  });

  socket.on('sos-accept-restart', ({ roomId }) => {
    const room = getRoom(roomId);
    if (!room || !room.sosState) return sendError('Invalid room');

    room.restartRequests.add(playerId);

    if (room.restartRequests.size === 2 || !room.playerO) {
      // Swap players
      if (room.playerO) {
        const temp = room.playerX;
        room.playerX = room.playerO;
        room.playerO = temp;
      }

      room.sosState = {
        board: Array(25).fill(null),
        scores: { X: 0, O: 0 },
        currentTurn: 'X',
        winner: null,
        status: 'playing'
      };
      
      room.restartRequests.clear();

      io.to(roomId).emit('sos-game-start', {
        board: room.sosState.board,
        currentTurn: room.sosState.currentTurn,
        scores: room.sosState.scores,
        playerX: room.playerX,
        playerO: room.playerO,
      });
    }
  });

  socket.on('sos-decline-restart', ({ roomId }) => {
    const room = getRoom(roomId);
    if (!room) return sendError('Invalid room');
    
    room.restartRequests.clear();
    socket.to(roomId).emit('sos-restart-declined');
  });
};
