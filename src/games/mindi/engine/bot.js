const { getValidCards } = require('./trumpRules');
const { determineTrickWinner } = require('./trick');

// Simple heuristic bot for Mindi
const chooseBotCard = (gameState, botSeat) => {
  const hand = gameState.hands[botSeat];
  const currentTrick = gameState.currentTrick;
  
  const validCards = getValidCards(hand, currentTrick);
  
  if (validCards.length === 1) {
    return validCards[0];
  }

  // If leading a trick
  if (currentTrick.length === 0) {
    const nonTens = validCards.filter(c => c.rank !== '10');
    if (nonTens.length > 0) {
      nonTens.sort((a, b) => b.value - a.value);
      return nonTens[0];
    }
    return validCards[0];
  }

  // If following
  const isTrumpRevealed = gameState.trumpRevealed;
  const trumpSuit = gameState.trumpSuit;

  const currentWinnerPlay = determineTrickWinner(currentTrick, trumpSuit, isTrumpRevealed);
  const currentWinnerSeat = currentWinnerPlay.seatIndex;
  
  // Team A: 0, 2. Team B: 1, 3
  const isPartnerWinning = (currentWinnerSeat % 2) === (botSeat % 2);
  
  if (isPartnerWinning) {
    const myTens = validCards.filter(c => c.rank === '10');
    if (myTens.length > 0) {
       return myTens[0];
    }
    validCards.sort((a, b) => a.value - b.value);
    return validCards[0];
  } else {
    const beatingCards = validCards.filter(c => {
      const mockTrick = [...currentTrick, { seatIndex: botSeat, card: c }];
      const winner = determineTrickWinner(mockTrick, trumpSuit, isTrumpRevealed);
      return winner.seatIndex === botSeat;
    });

    if (beatingCards.length > 0) {
      beatingCards.sort((a, b) => a.value - b.value);
      return beatingCards[0];
    } else {
      const nonTens = validCards.filter(c => c.rank !== '10');
      if (nonTens.length > 0) {
        nonTens.sort((a, b) => a.value - b.value);
        return nonTens[0];
      }
      return validCards[0];
    }
  }
};

const chooseTrumpCard = (gameState, botSeat) => {
  const hand = gameState.hands[botSeat];
  // Simplest strategy: hide the lowest card.
  const sorted = [...hand].sort((a, b) => a.value - b.value);
  return sorted[0];
};

module.exports = {
  chooseBotCard,
  chooseTrumpCard
};
