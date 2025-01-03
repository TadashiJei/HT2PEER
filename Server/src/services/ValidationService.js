const { logger } = require('../utils/logger');
const { metrics } = require('../utils/metrics');

class ValidationService {
    constructor() {
        this.gameStates = new Map();
        this.stateValidators = new Map();
        this.anticheatRules = new Map();
    }

    registerGameMode(gameMode, validator, anticheatRules) {
        this.stateValidators.set(gameMode, validator);
        this.anticheatRules.set(gameMode, anticheatRules);
    }

    validateState(roomId, gameMode, state, previousState) {
        const validator = this.stateValidators.get(gameMode);
        if (!validator) {
            logger.warn(`No validator found for game mode: ${gameMode}`);
            return true;
        }

        try {
            // Basic validation
            if (!this.validateBasicRules(state)) {
                return false;
            }

            // Game-specific validation
            if (!validator(state, previousState)) {
                metrics.invalidStateDetected(gameMode);
                logger.warn(`Invalid game state detected in room ${roomId}`);
                return false;
            }

            // Anti-cheat validation
            if (!this.validateAnticheat(gameMode, state, previousState)) {
                metrics.cheatDetected(gameMode);
                logger.warn(`Potential cheating detected in room ${roomId}`);
                return false;
            }

            // Store valid state
            this.gameStates.set(roomId, state);
            return true;
        } catch (error) {
            logger.error(`Error validating state for room ${roomId}:`, error);
            return false;
        }
    }

    validateBasicRules(state) {
        // Check if state exists and has required properties
        if (!state || typeof state !== 'object') {
            return false;
        }

        // Validate timestamp
        if (!state.timestamp || state.timestamp > Date.now()) {
            return false;
        }

        // Validate player data
        if (!state.players || !Array.isArray(state.players)) {
            return false;
        }

        return true;
    }

    validateAnticheat(gameMode, state, previousState) {
        const rules = this.anticheatRules.get(gameMode);
        if (!rules) return true;

        for (const rule of rules) {
            if (!rule(state, previousState)) {
                return false;
            }
        }

        return true;
    }

    // Example anti-cheat rules
    static SpeedHackDetection(state, previousState) {
        if (!previousState) return true;

        const maxSpeed = 10; // units per second
        const timeDiff = (state.timestamp - previousState.timestamp) / 1000;

        for (const player of state.players) {
            const previousPlayer = previousState.players.find(p => p.id === player.id);
            if (previousPlayer) {
                const distance = Math.sqrt(
                    Math.pow(player.position.x - previousPlayer.position.x, 2) +
                    Math.pow(player.position.y - previousPlayer.position.y, 2)
                );
                
                const speed = distance / timeDiff;
                if (speed > maxSpeed) {
                    return false;
                }
            }
        }

        return true;
    }

    static WallHackDetection(state) {
        // Example implementation
        for (const player of state.players) {
            if (player.position.x < 0 || player.position.x > 1000 ||
                player.position.y < 0 || player.position.y > 1000) {
                return false;
            }
        }
        return true;
    }

    static RapidFireDetection(state, previousState) {
        if (!previousState) return true;

        const minFireInterval = 100; // milliseconds
        
        for (const player of state.players) {
            const previousPlayer = previousState.players.find(p => p.id === player.id);
            if (previousPlayer && player.lastShot && previousPlayer.lastShot) {
                if (player.lastShot - previousPlayer.lastShot < minFireInterval) {
                    return false;
                }
            }
        }

        return true;
    }
}

module.exports = new ValidationService();
