require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const gameSocket = require('./games/tictactoe/socket');

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
gameSocket(io);

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
