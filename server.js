const WebSocket = require('ws');
const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });
const rooms = {};

console.log(`🚀 Servidor WebSocket rodando na porta ${PORT}`);

wss.on('connection', (ws) => {
    console.log('✅ Novo cliente conectado');
    
    let currentRoom = null;
    let playerName = null;
    
    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);
            
            if (message.type === 'join') {
                const roomName = message.room;
                playerName = message.player;
                
                if (currentRoom && rooms[currentRoom]) {
                    rooms[currentRoom] = rooms[currentRoom].filter(client => client !== ws);
                    console.log(`❌ ${playerName} saiu da sala ${currentRoom}`);
                }
                
                if (!rooms[roomName]) {
                    rooms[roomName] = [];
                }
                
                rooms[roomName].push(ws);
                currentRoom = roomName;
                
                console.log(`✅ ${playerName} entrou na sala ${roomName}`);
                
                ws.send(JSON.stringify({
                    type: 'joined',
                    room: roomName,
                    message: `Conectado na sala ${roomName}`
                }));
                
                broadcast(roomName, {
                    type: 'player_joined',
                    player: playerName
                }, ws);
            }
            
            else if (message.type === 'update') {
                if (!currentRoom) {
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: 'Você precisa entrar em uma sala primeiro'
                    }));
                    return;
                }
                
                message.player = playerName;
                broadcast(currentRoom, message, ws);
            }
            
        } catch (error) {
            console.error('❌ Erro ao processar mensagem:', error);
        }
    });
    
    ws.on('close', () => {
        if (currentRoom && rooms[currentRoom]) {
            rooms[currentRoom] = rooms[currentRoom].filter(client => client !== ws);
            console.log(`❌ ${playerName} desconectou da sala ${currentRoom}`);
            
            broadcast(currentRoom, {
                type: 'player_left',
                player: playerName
            }, null);
            
            if (rooms[currentRoom].length === 0) {
                delete rooms[currentRoom];
                console.log(`🗑️ Sala ${currentRoom} removida (vazia)`);
            }
        }
    });
    
    ws.on('error', (error) => {
        console.error('❌ Erro no cliente:', error);
    });
});

function broadcast(roomName, message, excludeClient) {
    if (!rooms[roomName]) return;
    
    const messageStr = JSON.stringify(message);
    
    rooms[roomName].forEach(client => {
        if (client === excludeClient) return;
        
        if (client.readyState === WebSocket.OPEN) {
            client.send(messageStr);
        }
    });
}