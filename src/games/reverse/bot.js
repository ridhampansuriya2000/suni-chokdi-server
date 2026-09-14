const { TYPES } = require('./deck');
const { getPlayableCards } = require('./engine');

const COLORS = ['RED', 'YELLOW', 'GREEN', 'BLUE'];

// Delay bot actions to feel more human
const botDelay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const getBotDelayMs = () => {
  return Math.floor(Math.random() * (1600 - 800 + 1)) + 800; // 800ms - 1600ms
};

// Evaluate the best color to pick when playing a Wild
const getBestColor = (hand) => {
  const colorCounts = { RED: 0, YELLOW: 0, GREEN: 0, BLUE: 0 };
  hand.forEach(card => {
    if (card.color !== 'WILD') {
      colorCounts[card.color]++;
    }
  });
  
  // Return the color the bot has the most of
  let bestColor = 'RED';
  let max = -1;
  for (const [color, count] of Object.entries(colorCounts)) {
    if (count > max) {
      max = count;
      bestColor = color;
    }
  }
  return bestColor;
};

const chooseBotCard = (hand, topCard, activeColor, difficulty = 'medium') => {
  const playable = getPlayableCards(hand, topCard, activeColor);
  if (playable.length === 0) return null;

  if (difficulty === 'easy') {
    // Just pick a random playable card
    return playable[Math.floor(Math.random() * playable.length)];
  }

  // Medium / Hard Strategy:
  // 1. Try to play number cards matching the color first
  // 2. Try to play action cards matching the color
  // 3. Keep Wilds as a last resort
  
  let numberCards = [];
  let actionCards = [];
  let wilds = [];
  let wildDrawFours = [];
  
  playable.forEach(card => {
    if (card.type === TYPES.NUMBER) numberCards.push(card);
    else if (card.type === TYPES.WILD) wilds.push(card);
    else if (card.type === TYPES.WILD_DRAW_FOUR) wildDrawFours.push(card);
    else actionCards.push(card);
  });

  // Basic priority
  if (difficulty === 'medium') {
    if (numberCards.length > 0) return numberCards[Math.floor(Math.random() * numberCards.length)];
    if (actionCards.length > 0) return actionCards[Math.floor(Math.random() * actionCards.length)];
    if (wilds.length > 0) return wilds[0];
    if (wildDrawFours.length > 0) return wildDrawFours[0];
    return playable[0];
  }

  // Hard
  // Find highest value number card to get rid of points
  if (numberCards.length > 0) {
    numberCards.sort((a, b) => b.value - a.value);
    return numberCards[0];
  }
  
  // Play action cards to hurt opponents
  if (actionCards.length > 0) {
    return actionCards[0]; // TODO: sophisticated targeting
  }
  
  if (wilds.length > 0) return wilds[0];
  if (wildDrawFours.length > 0) return wildDrawFours[0];
  
  return playable[0];
};

module.exports = {
  getBotDelayMs,
  botDelay,
  getBestColor,
  chooseBotCard
};
