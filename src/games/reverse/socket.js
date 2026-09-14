const { getRoom } = require('../../core/roomManager');
const { createDeck, shuffleDeck, TYPES } = require('./deck');
const { isCardPlayable, calculateRoundScore, getNextTurn, createInitialGameState } = require('./engine');
const { getBotDelayMs, botDelay, getBestColor, chooseBotCard } = require('./bot');

const getPublicStateForPlayer = (state, playerId, roomPlayers) => {
  if (!state) return null;
  const playerSeat = roomPlayers.indexOf(playerId);
  
  return {
    ...state,
    deckCount: state.deck.length,
    deck: undefined,
    // Only return lengths of opponents' hands
    hands: state.hands.map((hand, seat) => (seat === playerSeat ? hand : hand.length)),
    mySeat: playerSeat
  };
};

module.exports = (io, socket, playerId) => {
  const sendError = (message) => {
    if (socket) socket.emit('error', { message });
  };

  const broadcastGameState = (roomId, room) => {
    if (!room || !room.reverseState) return;
    room.players.forEach((pid) => {
      if (pid && pid.startsWith('bot_')) return;
      const playerSockets = Array.from(io.sockets.sockets.values()).filter(s => s.handshake.query.playerId === pid || s.id === pid);
      playerSockets.forEach(s => {
        s.emit('reverse-game-state', getPublicStateForPlayer(room.reverseState, pid, room.players));
      });
    });
  };

  const drawCardsFromDeck = (state, count) => {
    const drawn = [];
    for (let i = 0; i < count; i++) {
      if (state.deck.length === 0) {
        if (state.discardPile.length <= 1) break; // Not enough cards to reshuffle
        const topCard = state.discardPile.pop();
        state.deck = shuffleDeck(state.discardPile);
        state.discardPile = [topCard];
      }
      if (state.deck.length > 0) {
        drawn.push(state.deck.pop());
      }
    }
    return drawn;
  };

  const triggerBotTurnIfNeeded = (roomId, room) => {
    if (!room || !room.reverseState) return;
    const state = room.reverseState;
    if (state.status !== 'playing' && state.status !== 'color_selection') return;
    
    const currentSeat = state.currentTurn;
    const currentPlayerId = room.players[currentSeat];
    
    if (currentPlayerId && currentPlayerId.startsWith('bot_')) {
      setTimeout(() => {
        if (!room.reverseState || room.reverseState.currentTurn !== currentSeat) return;
        
        const difficulty = room.config?.botDifficulty || 'medium';

        if (state.status === 'color_selection' && state.pendingWildPlayer === currentSeat) {
           const bestColor = getBestColor(state.hands[currentSeat]);
           internalChooseColor(roomId, room, currentSeat, bestColor);
        } else if (state.status === 'playing') {
           const topCard = state.discardPile[state.discardPile.length - 1];
           const cardToPlay = chooseBotCard(state.hands[currentSeat], topCard, state.activeColor, difficulty);
           
           if (cardToPlay) {
               internalPlayCard(roomId, room, currentSeat, cardToPlay.id);
           } else {
               internalDrawCard(roomId, room, currentSeat);
           }
        }
      }, getBotDelayMs());
    }
  };
  
  const checkUnoPenalty = (roomId, room, seatIndex) => {
     // Bot auto-calls UNO
     const state = room.reverseState;
     const playerId = room.players[seatIndex];
     if (playerId && playerId.startsWith('bot_')) {
        if (!state.unoCallers.includes(seatIndex)) {
           state.unoCallers.push(seatIndex);
        }
        broadcastGameState(roomId, room);
     } else {
        // Human UNO window logic would go here. 
        // For MVP, we allow manual challenges anytime.
     }
  };

  const internalPlayCard = (roomId, room, playerSeat, cardId) => {
    const state = room.reverseState;
    if (state.status !== 'playing') return;
    if (playerSeat !== state.currentTurn) return;

    const hand = state.hands[playerSeat];
    const cardIndex = hand.findIndex(c => c.id === cardId);
    if (cardIndex === -1) return;
    
    const card = hand[cardIndex];
    const topCard = state.discardPile[state.discardPile.length - 1];
    
    if (!isCardPlayable(card, topCard, state.activeColor)) return;

    // Play card
    hand.splice(cardIndex, 1);
    state.discardPile.push(card);
    state.activeColor = card.color !== 'WILD' ? card.color : null;
    
    state.actionLog.push(`${room.players[playerSeat]} played ${card.color !== 'WILD' ? card.color + ' ' + card.value : card.value}`);

    // Check UNO
    if (hand.length === 1) {
        // Player must call uno
        state.unoCallers = state.unoCallers.filter(s => s !== playerSeat);
        checkUnoPenalty(roomId, room, playerSeat);
    }

    // Check Win
    if (hand.length === 0) {
        state.status = 'finished';
        state.winner = room.players[playerSeat];
        state.scores[state.winner] = (state.scores[state.winner] || 0) + calculateRoundScore(room.players.map((id, idx) => ({id, hand: state.hands[idx]})), state.winner);
        broadcastGameState(roomId, room);
        return;
    }

    // Resolve Actions
    let skipNext = false;

    if (card.type === TYPES.REVERSE) {
        if (room.players.length === 2) {
            skipNext = true; // In 2 player, reverse acts as skip
        } else {
            state.direction *= -1;
            state.actionLog.push(`Direction changed!`);
        }
    } else if (card.type === TYPES.SKIP) {
        skipNext = true;
    } else if (card.type === TYPES.DRAW_TWO) {
        const nextTarget = getNextTurn(state.currentTurn, room.players.length, state.direction, false);
        const drawn = drawCardsFromDeck(state, 2);
        state.hands[nextTarget].push(...drawn);
        state.actionLog.push(`${room.players[nextTarget]} drew 2 cards`);
        skipNext = true;
    }

    if (card.type === TYPES.WILD || card.type === TYPES.WILD_DRAW_FOUR) {
        state.status = 'color_selection';
        state.pendingWildPlayer = playerSeat;
        
        if (card.type === TYPES.WILD_DRAW_FOUR) {
            const nextTarget = getNextTurn(state.currentTurn, room.players.length, state.direction, false);
            const drawn = drawCardsFromDeck(state, 4);
            state.hands[nextTarget].push(...drawn);
            state.actionLog.push(`${room.players[nextTarget]} drew 4 cards`);
            skipNext = true;
        }
    }

    if (state.status !== 'color_selection') {
        state.currentTurn = getNextTurn(state.currentTurn, room.players.length, state.direction, skipNext);
    }
    
    broadcastGameState(roomId, room);
    triggerBotTurnIfNeeded(roomId, room);
  };

  const internalDrawCard = (roomId, room, playerSeat) => {
    const state = room.reverseState;
    if (state.status !== 'playing') return;
    if (playerSeat !== state.currentTurn) return;

    const drawn = drawCardsFromDeck(state, 1);
    if (drawn.length > 0) {
       state.hands[playerSeat].push(drawn[0]);
       state.actionLog.push(`${room.players[playerSeat]} drew a card`);
    }
    
    // In this basic version, drawing a card immediately ends the turn.
    state.currentTurn = getNextTurn(state.currentTurn, room.players.length, state.direction, false);
    broadcastGameState(roomId, room);
    triggerBotTurnIfNeeded(roomId, room);
  };

  const internalChooseColor = (roomId, room, playerSeat, color) => {
    const state = room.reverseState;
    if (state.status !== 'color_selection') return;
    if (playerSeat !== state.pendingWildPlayer) return;

    state.activeColor = color;
    state.status = 'playing';
    state.pendingWildPlayer = null;
    state.actionLog.push(`${room.players[playerSeat]} chose ${color}`);

    // Since skipNext was evaluated when card was played, if it was a Wild Draw Four, the skip is just skipping the next player's turn visually.
    // Wait, the turn progression wasn't completed for Wilds! We must progress it here.
    
    // We need to know if the played card was a +4 (which skips)
    const topCard = state.discardPile[state.discardPile.length - 1];
    let skipNext = (topCard.type === TYPES.WILD_DRAW_FOUR);

    state.currentTurn = getNextTurn(state.currentTurn, room.players.length, state.direction, skipNext);

    broadcastGameState(roomId, room);
    triggerBotTurnIfNeeded(roomId, room);
  };

  const internalCallUno = (roomId, room, playerSeat) => {
    const state = room.reverseState;
    if (state.hands[playerSeat].length <= 2) { // Allow calling slightly preemptively
       if (!state.unoCallers.includes(playerSeat)) {
           state.unoCallers.push(playerSeat);
       }
       state.actionLog.push(`${room.players[playerSeat]} called UNO!`);
       broadcastGameState(roomId, room);
    }
  };

  const internalChallengeUno = (roomId, room, challengerSeat, targetSeat) => {
    const state = room.reverseState;
    if (state.hands[targetSeat].length === 1 && !state.unoCallers.includes(targetSeat)) {
        const drawn = drawCardsFromDeck(state, 2);
        state.hands[targetSeat].push(...drawn);
        state.actionLog.push(`${room.players[targetSeat]} was caught and drew 2 cards`);
        broadcastGameState(roomId, room);
    }
  };

  if (!socket) return; 

  socket.on('reverse-start-game', ({ roomId }) => {
    const room = getRoom(roomId);
    if (!room) return sendError('Room not found');
    if (room.playerX !== playerId) return sendError('Only host can start');

    // Seat assignment for bots
    let finalPlayers = [...room.players];
    const mode = room.config?.mode || 'online';
    
    if (mode === 'bots') {
      const botCount = room.config?.botCount || 3;
      for(let i=1; i<=botCount; i++) {
         finalPlayers.push(`bot_${i}`);
      }
    }
    room.players = finalPlayers;

    const deck = shuffleDeck(createDeck());
    const hands = finalPlayers.map(() => []);
    
    // Deal 7 cards
    for (let i = 0; i < 7; i++) {
        for (let p = 0; p < finalPlayers.length; p++) {
            hands[p].push(deck.pop());
        }
    }
    
    // First top card (must be a number card if possible)
    let discardPile = [];
    while (deck.length > 0) {
        const c = deck.pop();
        if (c.type === TYPES.NUMBER) {
            discardPile.push(c);
            break;
        } else {
            deck.unshift(c); // Put back at bottom
        }
    }

    room.reverseState = createInitialGameState(finalPlayers);
    room.reverseState.deck = deck;
    room.reverseState.discardPile = discardPile;
    room.reverseState.hands = hands;
    room.reverseState.activeColor = discardPile[0].color;
    room.reverseState.currentTurn = 0;

    broadcastGameState(roomId, room);
    triggerBotTurnIfNeeded(roomId, room);
  });

  socket.on('reverse-play-card', ({ roomId, cardId }) => {
    const room = getRoom(roomId);
    if (!room || !room.reverseState) return sendError('Invalid room');
    const playerSeat = room.players.indexOf(playerId);
    internalPlayCard(roomId, room, playerSeat, cardId);
  });

  socket.on('reverse-draw-card', ({ roomId }) => {
    const room = getRoom(roomId);
    if (!room || !room.reverseState) return sendError('Invalid room');
    const playerSeat = room.players.indexOf(playerId);
    internalDrawCard(roomId, room, playerSeat);
  });

  socket.on('reverse-choose-color', ({ roomId, color }) => {
    const room = getRoom(roomId);
    if (!room || !room.reverseState) return sendError('Invalid room');
    const playerSeat = room.players.indexOf(playerId);
    internalChooseColor(roomId, room, playerSeat, color);
  });

  socket.on('reverse-call-uno', ({ roomId }) => {
    const room = getRoom(roomId);
    if (!room || !room.reverseState) return sendError('Invalid room');
    const playerSeat = room.players.indexOf(playerId);
    internalCallUno(roomId, room, playerSeat);
  });

  socket.on('reverse-challenge-uno', ({ roomId, targetSeat }) => {
    const room = getRoom(roomId);
    if (!room || !room.reverseState) return sendError('Invalid room');
    const playerSeat = room.players.indexOf(playerId);
    internalChallengeUno(roomId, room, playerSeat, targetSeat);
  });

  socket.on('reverse-request-restart', ({ roomId }) => {
    const room = getRoom(roomId);
    if (!room) return;
    room.restartRequests.add(playerId);
    
    const humanPlayers = room.players.filter(pid => !pid.startsWith('bot_'));
    
    if (room.restartRequests.size === humanPlayers.length) {
      room.restartRequests.clear();
      // Restart game logic
      // Call reverse-start-game logic basically
      socket.emit('reverse-start-game', { roomId }); // Mocking start game internally
    } else {
      socket.to(roomId).emit('reverse-restart-requested', { accepted: room.restartRequests.size, total: humanPlayers.length });
    }
  });
};
