const EloRating = require('elo-rating');
const { logger } = require('../utils/logger');
const db = require('../db');
const RoomService = require('./RoomService');
const { metrics } = require('../utils/metrics');

class MatchmakingService {
    constructor() {
        this.queue = new Map();
        this.matchingInterval = 5000; // 5 seconds
        this.ratingRange = 200; // Initial rating range
        this.maxRatingRange = 500; // Maximum rating range
        this.rangeIncreaseInterval = 50; // How much to increase range each check
        
        setInterval(() => this.processQueue(), this.matchingInterval);
    }

    async addToQueue(userId, gameMode = 'default') {
        const user = await db('users').where('id', userId).first();
        if (!user) {
            throw new Error('User not found');
        }

        const queueEntry = {
            userId,
            rating: user.rating,
            gameMode,
            joinTime: Date.now(),
            ratingRange: this.ratingRange
        };

        this.queue.set(userId, queueEntry);
        metrics.queueJoined(gameMode);
        logger.info(`User ${userId} joined matchmaking queue for ${gameMode}`);
        
        return queueEntry;
    }

    removeFromQueue(userId) {
        const wasInQueue = this.queue.delete(userId);
        if (wasInQueue) {
            metrics.queueLeft();
            logger.info(`User ${userId} left matchmaking queue`);
        }
        return wasInQueue;
    }

    async processQueue() {
        const entries = Array.from(this.queue.values());
        const matched = new Set();

        for (const entry of entries) {
            if (matched.has(entry.userId)) continue;

            const match = this.findMatch(entry, entries, matched);
            if (match) {
                matched.add(entry.userId);
                matched.add(match.userId);
                await this.createMatch(entry, match);
            } else {
                // Increase rating range for players waiting too long
                const waitTime = Date.now() - entry.joinTime;
                if (waitTime > this.matchingInterval) {
                    entry.ratingRange = Math.min(
                        entry.ratingRange + this.rangeIncreaseInterval,
                        this.maxRatingRange
                    );
                }
            }
        }
    }

    findMatch(entry, entries, matched) {
        return entries.find(other => 
            other.userId !== entry.userId &&
            !matched.has(other.userId) &&
            other.gameMode === entry.gameMode &&
            Math.abs(other.rating - entry.rating) <= entry.ratingRange
        );
    }

    async createMatch(player1, player2) {
        try {
            // Create room
            const roomId = `match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const room = await RoomService.createRoom(roomId, player1.userId, {
                gameMode: player1.gameMode,
                isRanked: true
            });

            // Create match record
            const match = await db('matches').insert({
                room_id: roomId,
                host_id: player1.userId,
                game_mode: player1.gameMode,
                status: 'starting',
                players: JSON.stringify([player1.userId, player2.userId])
            }).returning('*');

            // Remove players from queue
            this.removeFromQueue(player1.userId);
            this.removeFromQueue(player2.userId);

            // Notify players
            RoomService.notifyPlayers(roomId, {
                type: 'match_found',
                matchId: match[0].id,
                roomId,
                players: [player1.userId, player2.userId]
            });

            metrics.matchCreated(player1.gameMode);
            logger.info(`Created match ${match[0].id} between ${player1.userId} and ${player2.userId}`);

            return match[0];
        } catch (error) {
            logger.error('Error creating match:', error);
            this.removeFromQueue(player1.userId);
            this.removeFromQueue(player2.userId);
            throw error;
        }
    }

    async handleMatchResult(matchId, winner, loser) {
        const match = await db('matches').where('id', matchId).first();
        if (!match || match.status === 'completed') {
            return;
        }

        const winnerData = await db('users').where('id', winner).first();
        const loserData = await db('users').where('id', loser).first();

        const { playerRating: newWinnerRating, opponentRating: newLoserRating } = 
            EloRating.calculate(winnerData.rating, loserData.rating);

        // Update ratings
        await db.transaction(async trx => {
            // Update winner
            await trx('users')
                .where('id', winner)
                .update({ rating: newWinnerRating });

            await trx('match_history').insert({
                match_id: matchId,
                player_id: winner,
                rating_change: newWinnerRating - winnerData.rating,
                stats: JSON.stringify({ result: 'win' })
            });

            // Update loser
            await trx('users')
                .where('id', loser)
                .update({ rating: newLoserRating });

            await trx('match_history').insert({
                match_id: matchId,
                player_id: loser,
                rating_change: newLoserRating - loserData.rating,
                stats: JSON.stringify({ result: 'loss' })
            });

            // Update match
            await trx('matches')
                .where('id', matchId)
                .update({
                    status: 'completed',
                    result: JSON.stringify({
                        winner,
                        loser,
                        winnerRatingChange: newWinnerRating - winnerData.rating,
                        loserRatingChange: newLoserRating - loserData.rating
                    })
                });
        });

        metrics.matchCompleted(match.game_mode);
        logger.info(`Match ${matchId} completed. Winner: ${winner}, Loser: ${loser}`);
    }
}

module.exports = new MatchmakingService();
