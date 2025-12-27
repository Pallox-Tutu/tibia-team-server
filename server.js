const WebSocket = require('ws');
const http = require('http');

const PORT = process.env.PORT || 10000;

// HTTP server (necessário pro Render)
const server = http.createServer((req, res) => {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('WebSocket Server Online');
});

// WebSocket server
const wss = new WebSocket.Server({ 
    server,
    perMessageDeflate: false,  // Desabilita compressão = mais rápido!
    clientTracking: true
});

const rooms = new Map();

console.log(`🚀 WebSocket Server - Porta ${PORT}`);

wss.on('connection', (ws) => {
    let currentRoom = null;
    let playerName = null;
    
    // CRITICAL: Envia IMEDIATAMENTE (sem buffer)
    if (ws._socket) {
        ws._socket.setNoDelay(true);
    }
    
    ws.on('message', (data) => {
        try {
            const msg = JSON.parse(data);
            
            if (msg.type === 'join') {
                currentRoom = msg.room;
                playerName = msg.player;
                
                if (!rooms.has(currentRoom)) {
                    rooms.set(currentRoom, new Map());
                }
                
                rooms.get(currentRoom).set(playerName, {
                    ws: ws,
                    lastUpdate: Date.now()
                });
                
                console.log(`✅ ${playerName} → ${currentRoom}`);
                
                ws.send(JSON.stringify({
                    type: 'joined', 
                    room: currentRoom
                }));
                
                // Envia lista de players na sala
                const playerList = [];
                rooms.get(currentRoom).forEach((member, name) => {
                    if (name !== playerName) {
                        playerList.push(name);
                    }
                });
                
                if (playerList.length > 0) {
                    ws.send(JSON.stringify({
                        type: 'room_state',
                        players: playerList
                    }));
                }
            }
            else if (msg.type === 'update') {
                if (!currentRoom) return;
                
                const room = rooms.get(currentRoom);
                if (!room) return;
                
                // Atualiza timestamp
                if (room.has(playerName)) {
                    room.get(playerName).lastUpdate = Date.now();
                }
                
                // Broadcast IMEDIATO
                const msgStr = JSON.stringify(msg);
                
                room.forEach((member, name) => {
                    if (name !== playerName && member.ws.readyState === WebSocket.OPEN) {
                        member.ws.send(msgStr);
                    }
                });
            }
        } catch (e) {
            console.error('Erro:', e);
        }
    });
    
    ws.on('close', () => {
        if (currentRoom && rooms.has(currentRoom)) {
            rooms.get(currentRoom).delete(playerName);
            console.log(`❌ ${playerName} saiu`);
            
            // Notifica outros
            const room = rooms.get(currentRoom);
            if (room) {
                room.forEach((member) => {
                    if (member.ws.readyState === WebSocket.OPEN) {
                        member.ws.send(JSON.stringify({
                            type: 'player_left',
                            player: playerName
                        }));
                    }
                });
            }
        }
    });
    
    ws.on('error', (err) => {
        console.error('WebSocket error:', err);
    });
});

// Cleanup de salas vazias e players inativos
setInterval(() => {
    const now = Date.now();
    
    rooms.forEach((room, roomName) => {
        room.forEach((member, playerName) => {
            // Remove se inativo por 30 segundos
            if (now - member.lastUpdate > 30000) {
                room.delete(playerName);
                console.log(`⏰ ${playerName} timeout`);
            }
        });
        
        // Remove sala vazia
        if (room.size === 0) {
            rooms.delete(roomName);
            console.log(`🗑️ Sala ${roomName} removida`);
        }
    });
}, 10000);

server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
