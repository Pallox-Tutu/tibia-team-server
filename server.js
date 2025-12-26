const WebSocket = require('ws');
const PORT = process.env.PORT || 10000;

const wss = new WebSocket.Server({ port: PORT });
const rooms = {};

console.log(`🚀 WebSocket na porta ${PORT}`);

wss.on('connection', (ws) => {
  console.log('Cliente conectado');
  
  let currentRoom = null;
  let playerName = null;
  
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      
      if (msg.type === 'join') {
        currentRoom = msg.room;
        playerName = msg.player;
        
        if (!rooms[currentRoom]) rooms[currentRoom] = [];
        rooms[currentRoom].push(ws);
        
        console.log(`${playerName} -> ${currentRoom}`);
        
        ws.send(JSON.stringify({type: 'joined', room: currentRoom}));
        broadcast(currentRoom, {type: 'player_joined', player: playerName}, ws);
      }
      else if (msg.type === 'update') {
        if (currentRoom) {
          msg.player = playerName;
          broadcast(currentRoom, msg, ws);
        }
      }
    } catch (e) {
      console.error(e);
    }
  });
  
  ws.on('close', () => {
    if (currentRoom && rooms[currentRoom]) {
      rooms[currentRoom] = rooms[currentRoom].filter(c => c !== ws);
      console.log(`${playerName} saiu`);
    }
  });
});

function broadcast(room, msg, exclude) {
  if (!rooms[room]) return;
  const str = JSON.stringify(msg);
  rooms[room].forEach(c => {
    if (c !== exclude && c.readyState === WebSocket.OPEN) {
      c.send(str);
    }
  });
}
