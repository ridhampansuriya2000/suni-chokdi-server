const { getRoom } = require('../../core/roomManager');
const { createDeck, shuffleDeck, dealCards } = require('./engine/cards');
const { isValidCardPlay } = require('./engine/trumpRules');
const { determineTrickWinner, getCapturedMindis } = require('./engine/trick');
const { getTeamForSeat, getNextTurn, determineRoundWinner, createInitialGameState } = require('./engine/game');

// Extract non-sensitive state for a specific player
const getPublicStateForPlayer = (state, playerId, roomPlayers) => {
  if (!state) return null;
  const playerSeat = roomPlayers.indexOf(playerId);
  
  return {
    ...state,
    // Only send the hand of the requesting player
    hands: state.hands.map((hand, seat) => (seat === playerSeat ? hand : [])),
    // Hide trump card if not revealed
    trumpCard: state.trumpRevealed ? state.trumpCard : null,
    // Add seat info
    mySeat: playerSeat
  };
};

module.exports = (io, socket, playerId) => {
  const sendError = (message) => {
    socket.emit('error', { message });
  };

  const broadcastGameState = (roomId, room) => {
    room.players.forEach((pid) => {
      // Find the specific socket for this player to send them their specific hand
      const playerSockets = Array.from(io.sockets.sockets.values()).filter(s => s.handshake.query.playerId === pid || s.id === pid);
      
      playerSockets.forEach(s => {
        s.emit('mindi-game-state', getPublicStateForPlayer(room.mindiState, pid, room.players));
      });
    });
  };

  socket.on('mindi-start-game', ({ roomId }) => {
    const room = getRoom(roomId);
    if (!room || room.players.length !== 4) return sendError('Need exactly 4 players');
    if (room.playerX !== playerId) return sendError('Only host can start');

    const deck = shuffleDeck(createDeck());
    const hands = dealCards(deck, 4, 13);
    
    room.mindiState = createInitialGameState();
    room.mindiState.hands = hands;
    
    // Dealer is 0, first turn is 1 (Dealer's left)
    room.mindiState.dealer = 0;
    room.mindiState.currentTurn = 1;
    
    // Status is waiting for trump selection
    room.mindiState.status = 'selecting_trump';

    broadcastGameState(roomId, room);
  });

  socket.on('mindi-set-trump', ({ roomId, cardId }) => {
    const room = getRoom(roomId);
    if (!room || !room.mindiState) return sendError('Invalid room');
    if (room.mindiState.status !== 'selecting_trump') return sendError('Not selecting trump phase');
    
    const playerSeat = room.players.indexOf(playerId);
    if (playerSeat !== room.mindiState.currentTurn) return sendError('Not your turn to select trump');

    const hand = room.mindiState.hands[playerSeat];
    const cardIndex = hand.findIndex(c => c.id === cardId);
    
    if (cardIndex === -1) return sendError('Card not in hand');

    const card = hand.splice(cardIndex, 1)[0];
    
    room.mindiState.trumpCard = { card, seatIndex: playerSeat };
    room.mindiState.trumpSuit = card.suit;
    room.mindiState.trumpRevealed = false;
    
    // Now play begins, starting with the same person
    room.mindiState.status = 'playing';
    
    broadcastGameState(roomId, room);
  });

  socket.on('mindi-reveal-trump', ({ roomId }) => {
    const room = getRoom(roomId);
    if (!room || !room.mindiState || room.mindiState.status !== 'playing') return;
    
    room.mindiState.trumpRevealed = true;
    
    // The trump card goes back to the player's hand so they can play it later
    if (room.mindiState.trumpCard) {
       room.mindiState.hands[room.mindiState.trumpCard.seatIndex].push(room.mindiState.trumpCard.card);
    }

    io.to(roomId).emit('mindi-trump-revealed', { suit: room.mindiState.trumpSuit });
    broadcastGameState(roomId, room);
  });

  socket.on('mindi-play-card', ({ roomId, cardId }) => {
    const room = getRoom(roomId);
    if (!room || !room.mindiState || room.mindiState.status !== 'playing') return sendError('Game not active');
    
    const state = room.mindiState;
    const playerSeat = room.players.indexOf(playerId);
    
    if (playerSeat !== state.currentTurn) return sendError('Not your turn');

    const hand = state.hands[playerSeat];
    
    if (!isValidCardPlay(cardId, hand, state.currentTrick)) {
      return sendError('Invalid card play');
    }

    // Remove from hand
    const cardIndex = hand.findIndex(c => c.id === cardId);
    const card = hand.splice(cardIndex, 1)[0];

    // Add to trick
    state.currentTrick.push({ seatIndex: playerSeat, card });
    state.playedCards.push(card);

    if (state.currentTrick.length < 4) {
      // Trick not complete, next player
      state.currentTurn = getNextTurn(state.currentTurn);
      broadcastGameState(roomId, room);
    } else {
      // Trick is complete
      state.status = 'trick_complete';
      broadcastGameState(roomId, room); // Broadcast to show all 4 cards temporarily

      setTimeout(() => {
        // Determine winner
        const winningPlay = determineTrickWinner(state.currentTrick, state.trumpSuit, state.trumpRevealed);
        const winningSeat = winningPlay.seatIndex;
        const winningTeam = getTeamForSeat(winningSeat);

        // Score mindis
        const mindis = getCapturedMindis(state.currentTrick);
        state.capturedMindis[winningTeam].push(...mindis);
        state.tricksWon[winningTeam]++;

        // Clear trick
        state.currentTrick = [];
        state.currentTurn = winningSeat; // Winner starts next trick

        // Check if game over
        if (state.hands[0].length === 0 && state.hands[1].length === 0 && (!state.trumpCard || state.trumpRevealed)) {
          // If trump was never revealed and game is over, we should technically add it back, but if hands are 0 it's done.
          // Wait, if trump is not revealed, the person who holds it has 1 card left?
          // If someone hid a card, their hand size is 12. So at the end of trick 12, their hand is 0.
          // Trick 13 will only have 3 cards if trump is never played!
          // Let's force reveal trump if we reach the last trick.
        }

        // Proper game over check: all played cards = 52
        if (state.playedCards.length === 52 || (state.playedCards.length === 51 && !state.trumpRevealed)) {
           // Actually if trump is not revealed, that hidden card was never played.
           if (!state.trumpRevealed && state.trumpCard) {
               // The hidden card goes to the last trick winner implicitly, or just add it to their mindis if it's a 10.
               if (state.trumpCard.card.rank === '10') {
                   state.capturedMindis[winningTeam].push(state.trumpCard.card);
               }
           }
           state.status = 'finished';
           state.winner = determineRoundWinner(state.tricksWon, state.capturedMindis);
        } else {
           state.status = 'playing';
           // If someone has 0 cards and it's their turn, but someone else has a hidden trump, they need to force reveal
           if (state.hands[state.currentTurn].length === 0 && !state.trumpRevealed) {
               state.trumpRevealed = true;
               if (state.trumpCard) {
                   state.hands[state.trumpCard.seatIndex].push(state.trumpCard.card);
               }
           }
        }

        broadcastGameState(roomId, room);
      }, 2000);
    }
  });

  socket.on('mindi-request-restart', ({ roomId }) => {
    const room = getRoom(roomId);
    if (!room) return;
    room.restartRequests.add(playerId);
    if (room.restartRequests.size === room.players.length) {
      // Everyone accepted, restart
      room.restartRequests.clear();
      
      const deck = shuffleDeck(createDeck());
      const hands = dealCards(deck, 4, 13);
      
      room.mindiState = createInitialGameState();
      room.mindiState.hands = hands;
      room.mindiState.dealer = (room.mindiState.dealer + 1) % 4;
      room.mindiState.currentTurn = getNextTurn(room.mindiState.dealer);
      room.mindiState.status = 'selecting_trump';
      
      broadcastGameState(roomId, room);
    } else {
      socket.to(roomId).emit('mindi-restart-requested', { accepted: room.restartRequests.size, total: room.players.length });
    }
  });
};
