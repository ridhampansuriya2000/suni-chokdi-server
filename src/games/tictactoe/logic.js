const checkWinner = (board) => {
  const winLines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
    [0, 4, 8], [2, 4, 6]             // diagonals
  ];

  for (let i = 0; i < winLines.length; i++) {
    const [a, b, c] = winLines[i];
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { symbol: board[a], line: [a, b, c] };
    }
  }
  return null;
};

const isDraw = (board) => {
  return board.every((cell) => cell !== null);
};

const getGameResult = (board) => {
  const winData = checkWinner(board);
  if (winData) {
    return { winner: winData.symbol, winningLine: winData.line, draw: false };
  }
  if (isDraw(board)) {
    return { winner: null, winningLine: null, draw: true };
  }
  return { winner: null, winningLine: null, draw: false };
};

module.exports = { checkWinner, isDraw, getGameResult };
