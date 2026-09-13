const { getRoom } = require('../../core/roomManager');
const { createDeck, shuffleDeck, dealCards } = require('./engine/cards');
const { isValidCardPlay } = require('./engine/trumpRules');
const { determineTrickWinner, getCapturedMindis } = require('./engine/trick');
const { getTeamForSeat, getNextTurn, determineRoundWinner, createInitialGameState } = require('./engine/game');
const { chooseBotCard, chooseTrumpCard } = require('./engine/bot');

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
    if (socket) socket.emit('error', { message });
  };

  const broadcastGameState = (roomId, room) => {
    room.players.forEach((pid) => {
      if (pid && pid.startsWith('bot_')) return;
      // Find the specific socket for this player to send them their specific hand
      const playerSockets = Array.from(io.sockets.sockets.values()).filter(s => s.handshake.query.playerId === pid || s.id === pid);
      
      playerSockets.forEach(s => {
        s.emit('mindi-game-state', getPublicStateForPlayer(room.mindiState, pid, room.players));
      });
    });
  };

  const triggerBotTurnIfNeeded = (roomId, room) => {
    if (!room || !room.mindiState) return;
    const state = room.mindiState;
    if (state.status === 'finished' || state.status === 'trick_complete') return;
    
    const currentSeat = state.currentTurn;
    const currentPlayerId = room.players[currentSeat];
    
    if (currentPlayerId && currentPlayerId.startsWith('bot_')) {
      setTimeout(() => {
        if (!room.mindiState || room.mindiState.currentTurn !== currentSeat) return;
        
        if (state.status === 'selecting_trump') {
          const cardToHide = chooseTrumpCard(state, currentSeat);
          if (cardToHide) {
             internalSetTrump(roomId, room, currentSeat, cardToHide.id);
          }
        } else if (state.status === 'playing') {
          const cardToPlay = chooseBotCard(state, currentSeat);
          if (cardToPlay) {
             internalPlayCard(roomId, room, currentSeat, cardToPlay.id);
          }
        }
      }, 1500);
    }
  };

  const internalSetTrump = (roomId, room, playerSeat, cardId) => {
    const state = room.mindiState;
    if (state.status !== 'selecting_trump') return;
    
    if (playerSeat !== state.currentTurn) return;

    const hand = state.hands[playerSeat];
    const cardIndex = hand.findIndex(c => c.id === cardId);
    if (cardIndex === -1) return;

    const card = hand.splice(cardIndex, 1)[0];
    
    state.trumpCard = { card, seatIndex: playerSeat };
    state.trumpSuit = card.suit;
    state.trumpRevealed = false;
    
    state.status = 'playing';
    
    broadcastGameState(roomId, room);
    triggerBotTurnIfNeeded(roomId, room);
  };

  const internalPlayCard = (roomId, room, playerSeat, cardId) => {
    const state = room.mindiState;
    if (state.status !== 'playing') return;
    if (playerSeat !== state.currentTurn) return;

    const hand = state.hands[playerSeat];
    if (!isValidCardPlay(cardId, hand, state.currentTrick)) return;

    const cardIndex = hand.findIndex(c => c.id === cardId);
    const card = hand.splice(cardIndex, 1)[0];

    state.currentTrick.push({ seatIndex: playerSeat, card });
    state.playedCards.push(card);

    if (state.currentTrick.length < 4) {
      state.currentTurn = getNextTurn(state.currentTurn);
      broadcastGameState(roomId, room);
      triggerBotTurnIfNeeded(roomId, room);
    } else {
      state.status = 'trick_complete';
      broadcastGameState(roomId, room);

      setTimeout(() => {
        const winningPlay = determineTrickWinner(state.currentTrick, state.trumpSuit, state.trumpRevealed);
        const winningSeat = winningPlay.seatIndex;
        const winningTeam = getTeamForSeat(winningSeat);

        const mindis = getCapturedMindis(state.currentTrick);
        state.capturedMindis[winningTeam].push(...mindis);
        state.tricksWon[winningTeam]++;

        state.currentTrick = [];
        state.currentTurn = winningSeat;

        if (state.playedCards.length === 52 || (state.playedCards.length === 51 && !state.trumpRevealed)) {
           if (!state.trumpRevealed && state.trumpCard) {
               if (state.trumpCard.card.rank === '10') {
                   state.capturedMindis[winningTeam].push(state.trumpCard.card);
               }
           }
           state.status = 'finished';
           state.winner = determineRoundWinner(state.tricksWon, state.capturedMindis);
        } else {
           state.status = 'playing';
           if (state.hands[state.currentTurn].length === 0 && !state.trumpRevealed) {
               state.trumpRevealed = true;
               if (state.trumpCard) {
                   state.hands[state.trumpCard.seatIndex].push(state.trumpCard.card);
               }
           }
        }

        broadcastGameState(roomId, room);
        triggerBotTurnIfNeeded(roomId, room);
      }, 2000);
    }
  };

  if (!socket) return; // For mock/testing or internal calls if we ever do that

  socket.on('mindi-start-game', ({ roomId }) => {
    const room = getRoom(roomId);
    if (!room) return sendError('Room not found');
    if (room.players.length !== room.maxPlayers) return sendError('Need more players');
    if (room.playerX !== playerId) return sendError('Only host can start');

    // Seat assignment based on config
    let finalPlayers = [...room.players];
    const mode = room.config?.mode || '4_humans';
    
    if (mode === '2_humans_team') {
      // Humans are Team A (0, 2). Bots are Team B (1, 3).
      finalPlayers = [room.players[0], 'bot_1', room.players[1], 'bot_2'];
    } else if (mode === '2_humans_mixed') {
      // Human 1: 0 (Team A). Human 2: 1 (Team B). Bot 1: 2 (Team A). Bot 2: 3 (Team B).
      finalPlayers = [room.players[0], room.players[1], 'bot_1', 'bot_2'];
    }
    
    room.players = finalPlayers;

    const deck = shuffleDeck(createDeck());
    const hands = dealCards(deck, 4, 13);
    
    room.mindiState = createInitialGameState();
    room.mindiState.hands = hands;
    room.mindiState.dealer = 0;
    room.mindiState.currentTurn = 1;
    room.mindiState.status = 'selecting_trump';

    broadcastGameState(roomId, room);
    triggerBotTurnIfNeeded(roomId, room);
  });

  socket.on('mindi-set-trump', ({ roomId, cardId }) => {
    const room = getRoom(roomId);
    if (!room || !room.mindiState) return sendError('Invalid room');
    const playerSeat = room.players.indexOf(playerId);
    if (playerSeat === -1 || playerSeat !== room.mindiState.currentTurn) return sendError('Not your turn');
    internalSetTrump(roomId, room, playerSeat, cardId);
  });

  socket.on('mindi-reveal-trump', ({ roomId }) => {
    const room = getRoom(roomId);
    if (!room || !room.mindiState || room.mindiState.status !== 'playing') return;
    
    room.mindiState.trumpRevealed = true;
    
    if (room.mindiState.trumpCard) {
       room.mindiState.hands[room.mindiState.trumpCard.seatIndex].push(room.mindiState.trumpCard.card);
    }

    io.to(roomId).emit('mindi-trump-revealed', { suit: room.mindiState.trumpSuit });
    broadcastGameState(roomId, room);
  });

  socket.on('mindi-play-card', ({ roomId, cardId }) => {
    const room = getRoom(roomId);
    if (!room || !room.mindiState) return sendError('Invalid room');
    const playerSeat = room.players.indexOf(playerId);
    if (playerSeat === -1 || playerSeat !== room.mindiState.currentTurn) return sendError('Not your turn');
    internalPlayCard(roomId, room, playerSeat, cardId);
  });

  socket.on('mindi-request-restart', ({ roomId }) => {
    const room = getRoom(roomId);
    if (!room) return;
    room.restartRequests.add(playerId);
    
    // Check if all HUMANS have requested restart
    const humanPlayers = room.players.filter(pid => !pid.startsWith('bot_'));
    
    if (room.restartRequests.size === humanPlayers.length) {
      room.restartRequests.clear();
      
      const deck = shuffleDeck(createDeck());
      const hands = dealCards(deck, 4, 13);
      
      room.mindiState = createInitialGameState();
      room.mindiState.hands = hands;
      room.mindiState.dealer = (room.mindiState.dealer + 1) % 4;
      room.mindiState.currentTurn = getNextTurn(room.mindiState.dealer);
      room.mindiState.status = 'selecting_trump';
      
      broadcastGameState(roomId, room);
      triggerBotTurnIfNeeded(roomId, room);
    } else {
      socket.to(roomId).emit('mindi-restart-requested', { accepted: room.restartRequests.size, total: humanPlayers.length });
    }
  });
};
