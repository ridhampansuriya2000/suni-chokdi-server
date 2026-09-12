// Mindi Trump Rules

const getValidCards = (hand, currentTrick) => {
  if (currentTrick.length === 0) {
    // First player can play any card
    return hand;
  }

  const leadCard = currentTrick[0].card;
  const leadSuit = leadCard.suit;

  const hasLeadSuit = hand.some(card => card.suit === leadSuit);

  if (hasLeadSuit) {
    // Must follow suit
    return hand.filter(card => card.suit === leadSuit);
  }

  // Cannot follow suit, can play any card
  return hand;
};

// Check if a card play is valid
const isValidCardPlay = (cardId, hand, currentTrick) => {
  const card = hand.find(c => c.id === cardId);
  if (!card) return false;

  const validCards = getValidCards(hand, currentTrick);
  return validCards.some(vc => vc.id === cardId);
};

module.exports = {
  getValidCards,
  isValidCardPlay
};
