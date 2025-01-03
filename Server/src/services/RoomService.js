const Redis = require('ioredis');
const config = require('../config');
const { logger } = require('../utils/logger');
const { RoomError } = require('../utils/errors');
const { metrics } = require('../utils/metrics');

class RoomService {
    constructor() {
        this.redis = new Redis(config.redis.url, config.redis.options);
        this.rooms = new Map();
        this.setupCleanup();
    }

    async createRoom(roomId, hostId, options = {}) {
        const roomKey = `room:${roomId}`;
        
        const exists = await this.redis.exists(roomKey);
        if (exists) {
            throw new RoomError('Room already exists');
        }

        const room = {
            id: roomId,
            host: hostId,
            created: Date.now(),
            players: [hostId],
            options: {
                maxPlayers: options.maxPlayers || config.rooms.maxPlayersPerRoom,
                gameMode: options.gameMode || 'default',
                isPrivate: options.isPrivate || false,
                ...options
            },
            state: 'waiting'
        };

        await this.redis.hset(roomKey, 'data', JSON.stringify(room));
        await this.redis.expire(roomKey, config.rooms.roomTimeout / 1000);

        this.rooms.set(roomId, new Map([[hostId, null]]));
        metrics.roomCreated();

        return room;
    }

    async joinRoom(roomId, playerId, connection) {
        const roomKey = `room:${roomId}`;
        const roomData = await this.redis.hget(roomKey, 'data');
        
        if (!roomData) {
            throw new RoomError('Room not found');
        }

        const room = JSON.parse(roomData);
        
        if (room.players.length >= room.options.maxPlayers) {
            throw new RoomError('Room is full');
        }

        if (!this.rooms.has(roomId)) {
            this.rooms.set(roomId, new Map());
        }

        const roomConnections = this.rooms.get(roomId);
        roomConnections.set(playerId, connection);

        room.players.push(playerId);
        await this.redis.hset(roomKey, 'data', JSON.stringify(room));
        
        metrics.playerJoined(roomId);

        return {
            room,
            peers: Array.from(roomConnections.keys()).filter(id => id !== playerId)
        };
    }

    async leaveRoom(roomId, playerId) {
        const roomConnections = this.rooms.get(roomId);
        if (!roomConnections) return;

        roomConnections.delete(playerId);
        
        const roomKey = `room:${roomId}`;
        const roomData = await this.redis.hget(roomKey, 'data');
        
        if (roomData) {
            const room = JSON.parse(roomData);
            room.players = room.players.filter(id => id !== playerId);

            if (room.players.length === 0) {
                await this.redis.del(roomKey);
                this.rooms.delete(roomId);
                metrics.roomClosed(roomId);
            } else {
                if (room.host === playerId) {
                    room.host = room.players[0];
                }
                await this.redis.hset(roomKey, 'data', JSON.stringify(room));
                metrics.playerLeft(roomId);
            }

            return room;
        }
    }

    async getRoomState(roomId) {
        const roomKey = `room:${roomId}`;
        const roomData = await this.redis.hget(roomKey, 'data');
        return roomData ? JSON.parse(roomData) : null;
    }

    async updateRoomState(roomId, state) {
        const roomKey = `room:${roomId}`;
        const roomData = await this.redis.hget(roomKey, 'data');
        
        if (roomData) {
            const room = JSON.parse(roomData);
            room.state = state;
            await this.redis.hset(roomKey, 'data', JSON.stringify(room));
            return room;
        }
        return null;
    }

    getConnectedPeers(roomId) {
        const room = this.rooms.get(roomId);
        return room ? Array.from(room.entries()) : [];
    }

    setupCleanup() {
        setInterval(async () => {
            const now = Date.now();
            for (const [roomId, room] of this.rooms.entries()) {
                const state = await this.getRoomState(roomId);
                if (state && (now - state.created > config.rooms.roomTimeout)) {
                    logger.info(`Cleaning up inactive room: ${roomId}`);
                    await this.redis.del(`room:${roomId}`);
                    this.rooms.delete(roomId);
                    metrics.roomClosed(roomId, 'timeout');
                }
            }
        }, config.rooms.cleanupInterval);
    }
}

module.exports = new RoomService();
