// Mindi Card Engine

const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
const ranks = [
  { rank: '2', value: 2 },
  { rank: '3', value: 3 },
  { rank: '4', value: 4 },
  { rank: '5', value: 5 },
  { rank: '6', value: 6 },
  { rank: '7', value: 7 },
  { rank: '8', value: 8 },
  { rank: '9', value: 9 },
  { rank: '10', value: 10 },
  { rank: 'J', value: 11 },
  { rank: 'Q', value: 12 },
  { rank: 'K', value: 13 },
  { rank: 'A', value: 14 }
];

const createDeck = () => {
  const deck = [];
  suits.forEach(suit => {
    ranks.forEach(({ rank, value }) => {
      deck.push({
        id: `${rank}_${suit}`,
        suit,
        rank,
        value
      });
    });
  });
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

const dealCards = (deck, numPlayers = 4, cardsPerPlayer = 13) => {
  const hands = Array(numPlayers).fill(null).map(() => []);
  let currentCard = 0;
  
  for (let c = 0; c < cardsPerPlayer; c++) {
    for (let p = 0; p < numPlayers; p++) {
      hands[p].push(deck[currentCard++]);
    }
  }
  
  return hands;
};

module.exports = {
  createDeck,
  shuffleDeck,
  dealCards
};
