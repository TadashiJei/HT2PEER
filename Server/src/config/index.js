require('dotenv').config();

module.exports = {
    server: {
        port: process.env.PORT || 3000,
        host: process.env.HOST || '0.0.0.0',
        cors: {
            origin: process.env.CORS_ORIGIN || '*',
            methods: ['GET', 'POST']
        }
    },
    redis: {
        url: process.env.REDIS_URL,
        options: {
            retry_strategy: function(options) {
                if (options.error && options.error.code === 'ECONNREFUSED') {
                    return new Error('Redis server refused connection');
                }
                if (options.total_retry_time > 1000 * 60 * 60) {
                    return new Error('Retry time exhausted');
                }
                if (options.attempt > 10) {
                    return undefined;
                }
                return Math.min(options.attempt * 100, 3000);
            }
        }
    },
    jwt: {
        secret: process.env.JWT_SECRET,
        expiresIn: '24h'
    },
    rooms: {
        maxPlayersPerRoom: 16,
        roomTimeout: 1000 * 60 * 60, // 1 hour
        cleanupInterval: 1000 * 60 * 5 // 5 minutes
    },
    metrics: {
        enabled: process.env.METRICS_ENABLED === 'true',
        interval: 1000 * 60 // 1 minute
    },
    rateLimit: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100 // limit each IP to 100 requests per windowMs
    },
    cache: {
        ttl: 1000 * 60 * 5 // 5 minutes
    }
};
