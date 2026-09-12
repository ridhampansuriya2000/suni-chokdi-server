// Trick Winner Logic

const determineTrickWinner = (trick, trumpSuit, trumpRevealed) => {
  // trick is array of { seatIndex, card } played in order
  const leadSuit = trick[0].card.suit;

  let highestTrump = null;
  let highestLead = null;

  trick.forEach((play) => {
    const card = play.card;
    
    // Trump only wins if it has been revealed
    if (trumpRevealed && trumpSuit && card.suit === trumpSuit) {
      if (!highestTrump || card.value > highestTrump.card.value) {
        highestTrump = play;
      }
    } else if (card.suit === leadSuit) {
      if (!highestLead || card.value > highestLead.card.value) {
        highestLead = play;
      }
    }
  });

  return highestTrump || highestLead;
};

const getCapturedMindis = (trick) => {
  return trick.filter(play => play.card.rank === '10').map(play => play.card);
};

module.exports = {
  determineTrickWinner,
  getCapturedMindis
};
