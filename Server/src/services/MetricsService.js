const prometheus = require('prom-client');
const config = require('../config');

class MetricsService {
    constructor() {
        this.register = new prometheus.Registry();
        
        // Counters
        this.connections = new prometheus.Counter({
            name: 'websocket_connections_total',
            help: 'Total number of WebSocket connections'
        });

        this.messages = new prometheus.Counter({
            name: 'websocket_messages_total',
            help: 'Total number of WebSocket messages',
            labelNames: ['type']
        });

        this.rooms = new prometheus.Gauge({
            name: 'active_rooms',
            help: 'Number of active rooms'
        });

        this.players = new prometheus.Gauge({
            name: 'active_players',
            help: 'Number of active players'
        });

        // Histograms
        this.messageSize = new prometheus.Histogram({
            name: 'message_size_bytes',
            help: 'Size of WebSocket messages in bytes',
            buckets: [64, 128, 256, 512, 1024, 2048, 4096]
        });

        this.latency = new prometheus.Histogram({
            name: 'message_latency_ms',
            help: 'Latency of WebSocket messages in milliseconds',
            buckets: [5, 10, 25, 50, 100, 250, 500, 1000]
        });

        // Register metrics
        this.register.registerMetric(this.connections);
        this.register.registerMetric(this.messages);
        this.register.registerMetric(this.rooms);
        this.register.registerMetric(this.players);
        this.register.registerMetric(this.messageSize);
        this.register.registerMetric(this.latency);

        // Setup collection interval
        if (config.metrics.enabled) {
            this.startCollection();
        }
    }

    startCollection() {
        setInterval(() => {
            this.collect();
        }, config.metrics.interval);
    }

    collect() {
        // Implement custom metrics collection
        // This could involve gathering data from other services
    }

    // Connection metrics
    connectionOpened() {
        this.connections.inc();
        this.players.inc();
    }

    connectionClosed() {
        this.players.dec();
    }

    // Room metrics
    roomCreated() {
        this.rooms.inc();
    }

    roomClosed() {
        this.rooms.dec();
    }

    // Message metrics
    messageReceived(type, size) {
        this.messages.inc({ type });
        this.messageSize.observe(size);
    }

    messageSent(type, size) {
        this.messages.inc({ type });
        this.messageSize.observe(size);
    }

    // Latency metrics
    recordLatency(ms) {
        this.latency.observe(ms);
    }

    // Get metrics
    async getMetrics() {
        return await this.register.metrics();
    }
}

module.exports = new MetricsService();
