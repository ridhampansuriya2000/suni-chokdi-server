const { generateId } = require('../../utils/generateId');

const COLORS = ['RED', 'YELLOW', 'GREEN', 'BLUE'];
const TYPES = {
  NUMBER: 'NUMBER',
  SKIP: 'SKIP',
  REVERSE: 'REVERSE',
  DRAW_TWO: 'DRAW_TWO',
  WILD: 'WILD',
  WILD_DRAW_FOUR: 'WILD_DRAW_FOUR'
};

const createDeck = () => {
  let deck = [];
  
  COLORS.forEach(color => {
    // 0 is only one per color
    deck.push({ id: generateId(), color, type: TYPES.NUMBER, value: 0 });
    
    // 1-9 are two per color
    for (let i = 1; i <= 9; i++) {
      deck.push({ id: generateId(), color, type: TYPES.NUMBER, value: i });
      deck.push({ id: generateId(), color, type: TYPES.NUMBER, value: i });
    }
    
    // Action cards: two per color
    for (let i = 0; i < 2; i++) {
      deck.push({ id: generateId(), color, type: TYPES.SKIP, value: 'SKIP' });
      deck.push({ id: generateId(), color, type: TYPES.REVERSE, value: 'REVERSE' });
      deck.push({ id: generateId(), color, type: TYPES.DRAW_TWO, value: '+2' });
    }
  });

  // Wilds: 4 each
  for (let i = 0; i < 4; i++) {
    deck.push({ id: generateId(), color: 'WILD', type: TYPES.WILD, value: 'WILD' });
    deck.push({ id: generateId(), color: 'WILD', type: TYPES.WILD_DRAW_FOUR, value: '+4' });
  }

  return deck;
};

const shuffleDeck = (deck) => {
  const newDeck = [...deck];
  for (let i = newDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
  }
  return newDeck;
};

const getCardPoints = (card) => {
  if (card.type === TYPES.NUMBER) return card.value;
  if (card.type === TYPES.SKIP || card.type === TYPES.REVERSE || card.type === TYPES.DRAW_TWO) return 20;
  if (card.type === TYPES.WILD || card.type === TYPES.WILD_DRAW_FOUR) return 50;
  return 0;
};

module.exports = {
  createDeck,
  shuffleDeck,
  getCardPoints,
  COLORS,
  TYPES
};
