require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const coreSocket = require('./core/socket');
const tictactoeSocket = require('./games/tictactoe/socket');
const bingoSocket = require('./games/bingo/socket');
const sosSocket = require('./games/sos/socket');
const mindiSocket = require('./games/mindi/socket');

const app = express();
const server = http.createServer(app);

// Allow FRONTEND_URL or default to localhost:3000
const rawFrontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
const cleanUrl = rawFrontendUrl.endsWith('/') ? rawFrontendUrl.slice(0, -1) : rawFrontendUrl;
const allowedOrigins = [cleanUrl, cleanUrl + '/'];

app.use(cors({ origin: allowedOrigins }));

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"]
  }
});

// Setup socket logic
io.on('connection', (socket) => {
  const playerId = socket.handshake.query.playerId || socket.id;
  console.log(`Player connected: ${playerId} (Socket ID: ${socket.id})`);

  coreSocket(io, socket, playerId);
  tictactoeSocket(io, socket, playerId);
  bingoSocket(io, socket, playerId);
  sosSocket(io, socket, playerId);
  mindiSocket(io, socket, playerId);
});

// Simple root endpoint
app.get('/', (req, res) => {
  res.send('Suni Chokdi Socket Server Running');
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`🚀 Suni Chokdi Server running on http://localhost:${PORT}`);
  console.log(`Accepted Frontend Origins: ${allowedOrigins.join(', ')}`);
});
