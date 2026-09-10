const { getRoom } = require('../../core/roomManager');
const { getCompletedLines, validateBoard } = require('./logic');

module.exports = (io, socket, playerId) => {
  const sendError = (message) => {
    socket.emit('error', { message });
  };

  socket.on('bingo-board-ready', ({ roomId, board }) => {
    const room = getRoom(roomId);
    if (!room) return sendError('Invalid room');
    if (room.gameType !== 'bingo') return sendError('Not a Bingo room');

    if (!validateBoard(board)) {
      return sendError('Invalid board configuration');
    }

    // Determine player
    let playerSymbol = null;
    if (room.playerX === playerId) playerSymbol = 'X';
    else if (room.playerO === playerId) playerSymbol = 'O';

    if (!playerSymbol) return sendError('Not in this room');

    // Initialize Bingo-specific room properties if not present
    if (!room.bingoState) {
      room.bingoState = {
        boardX: null,
        boardO: null,
        calledNumbers: [],
        currentTurn: 'X',
        winner: null,
        status: 'setup' // 'setup', 'playing', 'finished'
      };
    }

    if (playerSymbol === 'X') room.bingoState.boardX = board;
    if (playerSymbol === 'O') room.bingoState.boardO = board;

    // Check if both are ready
    if (room.bingoState.boardX && room.bingoState.boardO) {
      room.bingoState.status = 'playing';
      io.to(roomId).emit('bingo-game-start', {
        currentTurn: room.bingoState.currentTurn,
        playerX: room.playerX,
        playerO: room.playerO
      });
    } else {
      // Just tell the other player this player is ready
      socket.to(roomId).emit('bingo-opponent-ready');
    }
  });

  socket.on('bingo-call-number', ({ roomId, number }) => {
    const room = getRoom(roomId);
    if (!room || room.gameType !== 'bingo' || !room.bingoState) return sendError('Invalid room');
    if (room.bingoState.status !== 'playing') return sendError('Game not active');

    let playerSymbol = null;
    if (room.playerX === playerId) playerSymbol = 'X';
    else if (room.playerO === playerId) playerSymbol = 'O';

    if (!playerSymbol) return sendError('Invalid player');
    if (room.bingoState.currentTurn !== playerSymbol) return sendError('Not your turn');

    if (typeof number !== 'number' || number < 1 || number > 25) return sendError('Invalid number');
    if (room.bingoState.calledNumbers.includes(number)) return sendError('Number already called');

    // Add number
    room.bingoState.calledNumbers.push(number);

    // Check Win
    const linesX = getCompletedLines(room.bingoState.boardX, room.bingoState.calledNumbers).count;
    const linesO = getCompletedLines(room.bingoState.boardO, room.bingoState.calledNumbers).count;

    if (linesX >= 5 && linesO >= 5) {
      room.bingoState.winner = 'Draw';
      room.bingoState.status = 'finished';
    } else if (linesX >= 5) {
      room.bingoState.winner = 'X';
      room.bingoState.status = 'finished';
    } else if (linesO >= 5) {
      room.bingoState.winner = 'O';
      room.bingoState.status = 'finished';
    } else {
      // Switch turn
      room.bingoState.currentTurn = room.bingoState.currentTurn === 'X' ? 'O' : 'X';
    }

    room.restartRequests.clear();

    io.to(roomId).emit('bingo-game-state', {
      calledNumbers: room.bingoState.calledNumbers,
      currentTurn: room.bingoState.currentTurn,
      winner: room.bingoState.winner,
      status: room.bingoState.status,
    });

    if (room.bingoState.status === 'finished') {
      // Send opponent's board at the very end
      io.to(roomId).emit('bingo-game-over', {
        boardX: room.bingoState.boardX,
        boardO: room.bingoState.boardO,
        winner: room.bingoState.winner
      });
    }
  });

  socket.on('bingo-accept-restart', ({ roomId }) => {
    const room = getRoom(roomId);
    if (!room || room.gameType !== 'bingo') return sendError('Invalid room');

    room.restartRequests.add(playerId);

    if (room.restartRequests.size === 2 || !room.playerO) {
      // Swap turns for fairness on restart
      if (room.playerO) {
        const temp = room.playerX;
        room.playerX = room.playerO;
        room.playerO = temp;
      }

      room.bingoState = {
        boardX: null,
        boardO: null,
        calledNumbers: [],
        currentTurn: 'X',
        winner: null,
        status: 'setup'
      };
      room.restartRequests.clear();

      io.to(roomId).emit('bingo-game-reset');
    }
  });
};
