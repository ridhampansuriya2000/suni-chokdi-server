// Backend Bingo Logic

const getCompletedLines = (board, calledNumbers) => {
  if (!board || board.length !== 25) return { count: 0 };

  const calledSet = new Set(calledNumbers);
  let count = 0;

  const isCalled = (val) => calledSet.has(val);

  // Rows
  for (let r = 0; r < 5; r++) {
    let rowComplete = true;
    for (let c = 0; c < 5; c++) {
      if (!isCalled(board[r * 5 + c])) {
        rowComplete = false;
        break;
      }
    }
    if (rowComplete) count++;
  }

  // Columns
  for (let c = 0; c < 5; c++) {
    let colComplete = true;
    for (let r = 0; r < 5; r++) {
      if (!isCalled(board[r * 5 + c])) {
        colComplete = false;
        break;
      }
    }
    if (colComplete) count++;
  }

  // Diagonal 1
  let diag1Complete = true;
  for (let i = 0; i < 5; i++) {
    if (!isCalled(board[i * 5 + i])) {
      diag1Complete = false;
      break;
    }
  }
  if (diag1Complete) count++;

  // Diagonal 2
  let diag2Complete = true;
  for (let i = 0; i < 5; i++) {
    if (!isCalled(board[i * 5 + (4 - i)])) {
      diag2Complete = false;
      break;
    }
  }
  if (diag2Complete) count++;

  return { count };
};

const validateBoard = (board) => {
  if (!Array.isArray(board) || board.length !== 25) return false;
  const set = new Set();
  for (const num of board) {
    if (typeof num !== 'number' || num < 1 || num > 25) return false;
    if (set.has(num)) return false;
    set.add(num);
  }
  return true;
};

module.exports = {
  getCompletedLines,
  validateBoard
};
