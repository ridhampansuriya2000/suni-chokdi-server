const getTeamForSeat = (seatIndex) => {
  // Seat 0 and 2 are Team A, Seat 1 and 3 are Team B
  return seatIndex % 2 === 0 ? 'Team A' : 'Team B';
};

const getNextTurn = (currentTurn) => {
  return (currentTurn + 1) % 4;
};

const determineRoundWinner = (tricksWon, mindisCaptured) => {
  const teamAMindis = mindisCaptured['Team A'].length;
  const teamBMindis = mindisCaptured['Team B'].length;
  
  if (teamAMindis > teamBMindis) return 'Team A';
  if (teamBMindis > teamAMindis) return 'Team B';
  
  // Tie in mindis (2-2), team with more tricks wins
  if (tricksWon['Team A'] > tricksWon['Team B']) return 'Team A';
  if (tricksWon['Team B'] > tricksWon['Team A']) return 'Team B';
  
  return 'Draw';
};

const createInitialGameState = () => ({
  status: 'waiting',
  players: [], // { id, name, seat, connected }
  hands: [[], [], [], []],
  currentTurn: 0,
  dealer: 0,
  
  currentTrick: [], // { seatIndex, card }
  
  trumpCard: null, // Hidden trump card { card, seatIndex }
  trumpSuit: null,
  trumpRevealed: false,
  
  playedCards: [],
  
  capturedMindis: {
    'Team A': [],
    'Team B': []
  },
  
  tricksWon: {
    'Team A': 0,
    'Team B': 0
  },
  
  winner: null
});

module.exports = {
  getTeamForSeat,
  getNextTurn,
  determineRoundWinner,
  createInitialGameState
};
