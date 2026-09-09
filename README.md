# Suni Chokdi - Multiplayer Server

This is the standalone Node.js, Express, and Socket.io backend for the **Suni Chokdi** online multiplayer game.

## What this server does
It acts as the authoritative game server managing real-time multiplayer Tic-Tac-Toe games. It handles in-memory room management, turn validation, win/draw calculation, and reconnection, entirely independent of the frontend implementation. 

## Installation

```bash
npm install
```

## Environment Variables

Copy the `.env.example` file to `.env`:
```bash
cp .env.example .env
```
Inside `.env`, you can configure:
- `PORT`: The port the server runs on (default `3001`).
- `FRONTEND_URL`: The URL of your Next.js application allowed by CORS (default `http://localhost:3000`).

## Development

To start the server with auto-reload (using nodemon):
```bash
npm run dev
```

To start normally in production:
```bash
npm start
```

## API & Socket Events

### Health Endpoint
`GET /health`
Returns `{ "status": "ok" }`. Useful for production deployment health checks.

### Socket Connection
The Next.js frontend should connect to the server like this:

```javascript
import { io } from "socket.io-client";

// For reconnection support, provide a stable user identifier
// E.g., from localStorage or a simple random session ID.
const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001", {
  query: { playerId: "user-unique-id-123" } 
});
```

### Client to Server Events (Emitted by Frontend)

1. **`create-room`**
   - Payload: None.
   - Action: Generates a new 6-character room ID, joins the player as 'X'.

2. **`join-room`**
   - Payload: `{ roomId: "A7K92P" }`
   - Action: Joins an existing room as player 'O'.

3. **`make-move`**
   - Payload: `{ roomId: "A7K92P", cellIndex: 4 }`
   - Action: Places a piece on the board if the move is valid and it's the player's turn.

4. **`restart-game`**
   - Payload: `{ roomId: "A7K92P" }`
   - Action: Requests a game restart. Both players must request this to restart.

5. **`leave-room`**
   - Payload: None.
   - Action: Leaves the current room manually.

### Server to Client Events (Listened to by Frontend)

1. **`room-created`**
   - Payload: `{ roomId: "A7K92P", player: "X", status: "waiting" }`

2. **`player-joined`**
   - Payload: `{ roomId: "A7K92P", player: "O", status: "playing" }`

3. **`game-start`**
   - Payload: `{ board: [null, null...], currentTurn: "X", playerX: "id", playerO: "id" }`
   - Triggered when the second player joins or after a successful restart.

4. **`game-state`**
   - Payload: `{ board: [...], currentTurn: "X"|"O", winner: "X"|"O"|"Draw"|null, status: "playing"|"finished" }`
   - Sent after every successful move.

5. **`game-over`**
   - Payload: `{ winner: "X"|"O"|"Draw" }`

6. **`player-disconnected`** / **`player-reconnected`**
   - Emitted to the other player when one disconnects/reconnects.

7. **`room-closed`**
   - Payload: `{ reason: "timeout" }`
   - Sent if the opponent disconnected and failed to reconnect within 60 seconds.

8. **`error`**
   - Payload: `{ message: "Invalid room" }`

## Production Deployment

You can deploy this server to standard Node.js hosting platforms:
- **Render** (Recommended): Create a new "Web Service", connect your repo, set the build command to `npm install` and start command to `npm start`.
- **Railway / Heroku / DigitalOcean App Platform**: Works similarly.

Make sure you configure the environment variables (`PORT` and `FRONTEND_URL`) correctly in your hosting provider's dashboard.

For the Next.js Frontend deployment (e.g. on Vercel):
- Add the `NEXT_PUBLIC_SOCKET_URL` environment variable pointing to the deployed Node.js backend URL (e.g., `https://suni-chokdi-server.onrender.com`).
