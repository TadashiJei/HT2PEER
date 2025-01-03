const express = require('express');
const session = require('express-session');
const path = require('path');
const WebSocket = require('ws');
const http = require('http');
const jwt = require('jsonwebtoken');
const Redis = require('redis');
const dashboardRoutes = require('./dashboard');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Parse JSON bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'dashboard/views'));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Mount dashboard routes
app.use('/', dashboardRoutes);

// Redis client for room management
const redis = Redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
});

// Room management
const rooms = new Map();

// Connection handling
wss.on('connection', async (ws, req) => {
    let userId = null;
    let roomId = null;

    // Authenticate connection
    try {
        const token = req.headers['authorization'];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.userId;
    } catch (err) {
        ws.close(4001, 'Unauthorized');
        return;
    }

    // Message handling
    ws.on('message', async (message) => {
        const data = JSON.parse(message);

        switch (data.type) {
            case 'create_room':
                roomId = data.roomId;
                await handleCreateRoom(ws, roomId, userId);
                break;

            case 'join_room':
                roomId = data.roomId;
                await handleJoinRoom(ws, roomId, userId);
                break;

            case 'ice_candidate':
                handleIceCandidate(ws, roomId, userId, data);
                break;

            case 'offer':
                handleOffer(ws, roomId, userId, data);
                break;

            case 'answer':
                handleAnswer(ws, roomId, userId, data);
                break;

            case 'leave_room':
                handleLeaveRoom(ws, roomId, userId);
                break;
        }
    });

    // Handle disconnection
    ws.on('close', () => {
        if (roomId) {
            handleLeaveRoom(ws, roomId, userId);
        }
    });
});

// Room management functions
async function handleCreateRoom(ws, roomId, userId) {
    if (await redis.exists(`room:${roomId}`)) {
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Room already exists'
        }));
        return;
    }

    await redis.hSet(`room:${roomId}`, {
        host: userId,
        created: Date.now()
    });

    rooms.set(roomId, new Map([[userId, ws]]));

    ws.send(JSON.stringify({
        type: 'room_created',
        roomId
    }));
}

async function handleJoinRoom(ws, roomId, userId) {
    if (!await redis.exists(`room:${roomId}`)) {
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Room not found'
        }));
        return;
    }

    const room = rooms.get(roomId);
    room.set(userId, ws);

    // Notify other peers
    room.forEach((peer, peerId) => {
        if (peerId !== userId) {
            peer.send(JSON.stringify({
                type: 'peer_joined',
                peerId: userId
            }));
        }
    });
}

// WebRTC signaling functions
function handleIceCandidate(ws, roomId, userId, data) {
    const room = rooms.get(roomId);
    const targetPeer = room.get(data.targetId);

    if (targetPeer) {
        targetPeer.send(JSON.stringify({
            type: 'ice_candidate',
            candidate: data.candidate,
            fromId: userId
        }));
    }
}

function handleOffer(ws, roomId, userId, data) {
    const room = rooms.get(roomId);
    const targetPeer = room.get(data.targetId);

    if (targetPeer) {
        targetPeer.send(JSON.stringify({
            type: 'offer',
            offer: data.offer,
            fromId: userId
        }));
    }
}

function handleAnswer(ws, roomId, userId, data) {
    const room = rooms.get(roomId);
    const targetPeer = room.get(data.targetId);

    if (targetPeer) {
        targetPeer.send(JSON.stringify({
            type: 'answer',
            answer: data.answer,
            fromId: userId
        }));
    }
}

function handleLeaveRoom(ws, roomId, userId) {
    const room = rooms.get(roomId);
    if (!room) return;

    room.delete(userId);

    // Notify other peers
    room.forEach((peer, peerId) => {
        peer.send(JSON.stringify({
            type: 'peer_left',
            peerId: userId
        }));
    });

    // Clean up empty rooms
    if (room.size === 0) {
        rooms.delete(roomId);
        redis.del(`room:${roomId}`);
    }
}

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render('error', { 
        message: 'Something broke!',
        error: process.env.NODE_ENV === 'development' ? err : {}
    });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Signaling server running on port ${PORT}`);
});
