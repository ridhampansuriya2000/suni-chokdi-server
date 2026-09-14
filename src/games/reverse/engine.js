const { TYPES } = require('./deck');

// A card can be played if:
// 1. It is a Wild or Wild Draw Four.
// 2. Its color matches the current activeColor.
// 3. Its type and value matches the topCard's type and value (e.g. Red 5 on Blue 5, or Green Skip on Yellow Skip).
const isCardPlayable = (card, topCard, activeColor) => {
  if (card.type === TYPES.WILD || card.type === TYPES.WILD_DRAW_FOUR) {
    return true;
  }
  if (card.color === activeColor) {
    return true;
  }
  if (card.type === topCard.type && card.value === topCard.value) {
    return true;
  }
  return false;
};

// Check if a player has any playable cards
const getPlayableCards = (hand, topCard, activeColor) => {
  return hand.filter(card => isCardPlayable(card, topCard, activeColor));
};

const calculateRoundScore = (players, winnerId) => {
  const { getCardPoints } = require('./deck');
  let totalScore = 0;
  players.forEach(p => {
    if (p.id !== winnerId) {
      p.hand.forEach(card => {
        totalScore += getCardPoints(card);
      });
    }
  });
  return totalScore;
};

const getNextTurn = (currentIndex, numPlayers, direction, skip = false) => {
  let steps = skip ? 2 : 1;
  let next = (currentIndex + (direction * steps)) % numPlayers;
  if (next < 0) next += numPlayers;
  return next;
};

const createInitialGameState = (players) => {
  return {
    status: 'playing', // playing, color_selection, round_over
    deck: [],
    discardPile: [],
    currentTurn: 0,
    direction: 1, // 1 for clockwise, -1 for counter-clockwise
    activeColor: null, // RED, YELLOW, GREEN, BLUE
    winner: null,
    scores: {},
    unoCallers: new Set(),
    actionLog: [],
    drawPenalty: 0, // In case rules support stacking in the future, we keep this, but for now we apply immediately
    pendingWildPlayer: null // If a wild is played, this stores who needs to pick a color
  };
};

module.exports = {
  isCardPlayable,
  getPlayableCards,
  calculateRoundScore,
  getNextTurn,
  createInitialGameState
};
