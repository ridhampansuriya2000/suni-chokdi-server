const getSOSLines = (board) => {
  if (!board || board.length !== 25) return [];

  const lines = [];
  const addLine = (i1, i2, i3) => {
    if (board[i1] === 'S' && board[i2] === 'O' && board[i3] === 'S') {
      lines.push([i1, i2, i3]);
    }
  };

  // Rows (5 rows, 3 possible SOS per row)
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 3; c++) {
      addLine(r * 5 + c, r * 5 + c + 1, r * 5 + c + 2);
    }
  }

  // Columns (5 cols, 3 possible SOS per col)
  for (let c = 0; c < 5; c++) {
    for (let r = 0; r < 3; r++) {
      addLine(r * 5 + c, (r + 1) * 5 + c, (r + 2) * 5 + c);
    }
  }

  // Diagonals (Top-Left to Bottom-Right)
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      addLine(r * 5 + c, (r + 1) * 5 + c + 1, (r + 2) * 5 + c + 2);
    }
  }

  // Diagonals (Top-Right to Bottom-Left)
  for (let r = 0; r < 3; r++) {
    for (let c = 2; c < 5; c++) {
      addLine(r * 5 + c, (r + 1) * 5 + c - 1, (r + 2) * 5 + c - 2);
    }
  }

  return lines;
};

const getNewSOSCount = (oldBoard, newBoard) => {
  const oldLines = getSOSLines(oldBoard);
  const newLines = getSOSLines(newBoard);
  return newLines.length - oldLines.length;
};

module.exports = {
  getSOSLines,
  getNewSOSCount
};
