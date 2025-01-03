const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const Redis = require('ioredis');
const config = require('../config');

const redis = new Redis(config.redis.url);

const limiter = rateLimit({
    store: new RedisStore({
        client: redis,
        prefix: 'rate-limit:',
        points: config.rateLimit.max,
        duration: config.rateLimit.windowMs / 1000
    }),
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    message: {
        error: 'Too many requests, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

module.exports = limiter;
