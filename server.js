// ==========================================
// SERVIDOR HTTP + WEBSOCKET PARA TEAM HUNT
// ==========================================

const WebSocket = require('ws');
const http = require('http');
const url = require('url');

const PORT = process.env.PORT || 8080;

// Armazena dados dos players por sala
// Estrutura: { "sala1": { "player1": {data}, "player2": {data} } }
const rooms = {};

// ==========================================
// SERVIDOR HTTP
// ==========================================

const server = http.createServer((req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    const parsedUrl = url.parse(req.url, true);
    
    // ==========================================
    // ENDPOINT: HEALTHCHECK
    // ==========================================
    if (parsedUrl.pathname === '/health') {
        res.writeHead(200, {'Content-Type': 'text/plain'});
        res.end('OK');
        return;
    }
    
    // ==========================================
    // ENDPOINT: POST /api/update
    // Recebe dados do player e retorna dados dos outros
    // ==========================================
    if (parsedUrl.pathname === '/api/update' && req.method === 'POST') {
        let body = '';
        
        req.on('data', chunk => {
            body += chunk.toString();
        });
        
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const room = data.room;
                const player = data.player;
                
                if (!room || !player) {
                    res.writeHead(400, {'Content-Type': 'application/json'});
                    res.end(JSON.stringify({error: 'Missing room or player'}));
                    return;
                }
                
                // Cria sala se não existir
                if (!rooms[room]) {
                    rooms[room] = {};
                    console.log(`📁 Nova sala criada: ${room}`);
                }
                
                // Salva/atualiza dados do player
                rooms[room][player] = {
                    ...data,
                    lastUpdate: Date.now()
                };
                
                console.log(`📊 ${player} @ ${room}: HP ${data.hpPercent}% | Pos ${data.position.x},${data.position.y},${data.position.z}`);
                
                // Remove players inativos (mais de 10 segundos sem update)
                const now = Date.now();
                Object.keys(rooms[room]).forEach(p => {
                    if (now - rooms[room][p].lastUpdate > 10000) {
                        console.log(`⏰ ${p} timeout, removendo...`);
                        delete rooms[room][p];
                    }
                });
                
                // Retorna dados de TODOS os players da sala (incluindo o próprio)
                const teamData = rooms[room];
                
                res.writeHead(200, {'Content-Type': 'application/json'});
                res.end(JSON.stringify({
                    success: true,
                    team: teamData,
                    playerCount: Object.keys(teamData).length
                }));
                
            } catch (error) {
                console.error('❌ Erro ao processar:', error);
                res.writeHead(500, {'Content-Type': 'application/json'});
                res.end(JSON.stringify({error: 'Internal server error'}));
            }
        });
        
        return;
    }
    
    // ==========================================
    // ENDPOINT: GET /api/rooms
    // Lista todas as salas ativas
    // ==========================================
    if (parsedUrl.pathname === '/api/rooms' && req.method === 'GET') {
        const roomList = Object.keys(rooms).map(roomName => ({
            room: roomName,
            players: Object.keys(rooms[roomName]).length,
            playerNames: Object.keys(rooms[roomName])
        }));
        
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({rooms: roomList}));
        return;
    }
    
    // ==========================================
    // ENDPOINT: GET /api/room/:name
    // Retorna dados de uma sala específica
    // ==========================================
    if (parsedUrl.pathname.startsWith('/api/room/') && req.method === 'GET') {
        const roomName = parsedUrl.pathname.split('/')[3];
        
        if (rooms[roomName]) {
            res.writeHead(200, {'Content-Type': 'application/json'});
            res.end(JSON.stringify({
                room: roomName,
                players: rooms[roomName]
            }));
        } else {
            res.writeHead(404, {'Content-Type': 'application/json'});
            res.end(JSON.stringify({error: 'Room not found'}));
        }
        return;
    }
    
    // Rota não encontrada
    res.writeHead(404, {'Content-Type': 'text/plain'});
    res.end('Not Found');
});

// ==========================================
// WEBSOCKET SERVER (para compatibilidade futura)
// ==========================================

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    console.log('✅ WebSocket cliente conectado');
    
    let currentRoom = null;
    let playerName = null;
    
    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);
            
            if (message.type === 'join') {
                currentRoom = message.room;
                playerName = message.player;
                
                if (!rooms[currentRoom]) {
                    rooms[currentRoom] = {};
                }
                
                console.log(`✅ ${playerName} entrou via WebSocket na sala ${currentRoom}`);
                
                ws.send(JSON.stringify({
                    type: 'joined',
                    room: currentRoom
                }));
            }
            
        } catch (error) {
            console.error('❌ Erro WebSocket:', error);
        }
    });
    
    ws.on('close', () => {
        console.log('❌ WebSocket cliente desconectado');
    });
});

// ==========================================
// INICIAR SERVIDOR
// ==========================================

server.listen(PORT, () => {
    console.log(`🚀 Servidor HTTP rodando na porta ${PORT}`);
    console.log(`📡 WebSocket disponível na mesma porta`);
    console.log(`🌐 Endpoints:`);
    console.log(`   POST /api/update - Enviar/receber dados do team`);
    console.log(`   GET  /api/rooms  - Listar salas ativas`);
    console.log(`   GET  /health     - Healthcheck`);
});
