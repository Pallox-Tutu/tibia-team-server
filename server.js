const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

const rooms = {};
const pendingRequests = {};

// Cleanup old data
setInterval(() => {
  const now = Date.now();
  Object.keys(rooms).forEach(room => {
    Object.keys(rooms[room]).forEach(player => {
      if (now - rooms[room][player].timestamp > 10000) {
        delete rooms[room][player];
      }
    });
  });
}, 5000);

// POST /update - Envia e recebe dados
app.post('/update', (req, res) => {
  const { room, player, lastTalk, timestamp } = req.body;
  
  if (!room || !player) {
    return res.status(400).json({ error: 'Missing room or player' });
  }
  
  if (!rooms[room]) rooms[room] = {};
  
  // Salva dados do player
  rooms[room][player] = {
    player,
    lastTalk: lastTalk || '',
    timestamp: Date.now(),
    talkTimestamp: timestamp || 0
  };
  
  // Retorna dados de TODOS os players
  res.json({
    success: true,
    team: rooms[room]
  });
});

// GET /health
app.get('/health', (req, res) => {
  res.send('OK');
});

app.get('/', (req, res) => {
  res.send('Talk Sync Server - HTTP Mode');
});

app.listen(PORT, () => {
  console.log(`🚀 HTTP Server na porta ${PORT}`);
});
