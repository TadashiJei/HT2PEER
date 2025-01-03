const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const path = require('path');
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');
const { getDb, init } = require('../db');
const fs = require('fs');

const router = express.Router();

// Create sessions directory if it doesn't exist
const sessionsDir = path.join(__dirname, '../../data');
if (!fs.existsSync(sessionsDir)) {
    fs.mkdirSync(sessionsDir, { recursive: true });
}

// Initialize database before setting up routes
init().catch(error => {
    console.error('Failed to initialize database:', error);
    process.exit(1);
});

// Middleware setup
router.use(express.json());
router.use(express.urlencoded({ extended: true }));

// Session middleware
router.use(session({
    store: new SQLiteStore({
        db: 'sessions.db',
        dir: path.resolve(__dirname, '../../data'),
        table: 'sessions'
    }),
    secret: process.env.SESSION_SECRET || 'bfb7f80c-9b24-4250-bf2f-40052e883f82',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Middleware to ensure database is ready
const requireDb = async (req, res, next) => {
    try {
        await init(); // This will wait if the database is still initializing
        req.db = getDb();
        next();
    } catch (error) {
        console.error('Database not ready:', error);
        res.status(500).render('error', {
            message: 'Database not ready',
            error: process.env.NODE_ENV === 'development' ? error : {}
        });
    }
};

// Use database middleware for all routes
router.use(requireDb);

// Authentication middleware
const requireAuth = (req, res, next) => {
    if (!req.session.userId) {
        return res.redirect('/login');
    }
    next();
};

// Routes
router.get('/login', (req, res) => {
    if (req.session.userId) {
        return res.redirect('/dashboard');
    }
    res.render('login', { error: null });
});

router.post('/login', [
    body('username').trim().notEmpty(),
    body('password').notEmpty()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.render('login', { errors: errors.array() });
    }

    try {
        const { username, password } = req.body;
        
        const user = await req.db('users')
            .where({ username })
            .first();
            
        if (!user) {
            return res.render('login', { error: 'Invalid username or password' });
        }
        
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.render('login', { error: 'Invalid username or password' });
        }
        
        req.session.userId = user.id;
        req.session.isAdmin = user.is_admin;
        
        res.redirect('/dashboard');
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).render('login', { error: 'Internal server error' });
    }
});

router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// Root route
router.get('/', (req, res) => {
    if (req.session.userId) {
        res.redirect('/dashboard');
    } else {
        res.redirect('/login');
    }
});

router.get('/dashboard', requireAuth, async (req, res) => {
    try {
        const db = req.db;
        const [serverStats, recentMatches, activeUsers] = await Promise.all([
            // Get server stats
            db('server_stats')
                .orderBy('timestamp', 'desc')
                .first(),
            
            // Get recent matches
            db('matches')
                .join('match_players', 'matches.id', 'match_players.match_id')
                .join('users', 'match_players.user_id', 'users.id')
                .join('game_modes', 'matches.game_mode_id', 'game_modes.id')
                .select(
                    'matches.*',
                    'game_modes.name as game_mode',
                    db.raw('GROUP_CONCAT(users.username) as players')
                )
                .groupBy('matches.id')
                .orderBy('matches.created_at', 'desc')
                .limit(5),

            // Get active users
            db('users')
                .where('last_active', '>', db.raw('datetime("now", "-15 minutes")'))
                .count('* as count')
                .first()
        ]);

        const user = await db('users')
            .where('id', req.session.userId)
            .first();

        res.render('dashboard', {
            title: 'Dashboard',
            user,
            serverStats,
            recentMatches,
            activeUsers: activeUsers.count
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).render('error', { error: 'Error loading dashboard' });
    }
});

router.get('/gamemodes', requireAuth, async (req, res) => {
    try {
        const db = req.db;
        const gameModes = await db('game_modes')
            .select('*')
            .orderBy('name');
        res.render('gamemodes', { gameModes });
    } catch (error) {
        console.error('Game modes error:', error);
        res.render('error', { message: 'Error loading game modes' });
    }
});

router.get('/matches', requireAuth, async (req, res) => {
    try {
        const db = req.db;
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 10;
        const offset = (page - 1) * pageSize;

        const query = db('matches')
            .select(
                'matches.*',
                'game_modes.name as gameMode',
                db.raw('json_group_array(json_object("username", users.username, "score", match_players.score)) as players')
            )
            .leftJoin('game_modes', 'matches.game_mode_id', 'game_modes.id')
            .leftJoin('match_players', 'matches.id', 'match_players.match_id')
            .leftJoin('users', 'match_players.user_id', 'users.id')
            .groupBy('matches.id')
            .orderBy('matches.created_at', 'desc');

        // Apply filters
        if (req.query.gameMode) {
            query.where('matches.game_mode_id', req.query.gameMode);
        }
        if (req.query.status) {
            query.where('matches.status', req.query.status);
        }
        if (req.query.dateFrom) {
            query.where('matches.created_at', '>=', req.query.dateFrom);
        }
        if (req.query.dateTo) {
            query.where('matches.created_at', '<=', req.query.dateTo);
        }

        const [matches, total] = await Promise.all([
            query.limit(pageSize).offset(offset),
            db('matches').count('* as count').first()
        ]);

        // Parse players JSON string
        matches.forEach(match => {
            match.players = JSON.parse(match.players);
        });

        res.json({
            matches,
            total: total.count,
            page,
            pageSize
        });
    } catch (error) {
        console.error('Matches error:', error);
        res.status(500).json({ error: 'Error loading matches' });
    }
});

router.get('/leaderboard', requireAuth, async (req, res) => {
    try {
        const db = req.db;
        const gameModes = await db('game_modes')
            .select('*')
            .orderBy('name');
        res.render('leaderboard', { gameModes });
    } catch (error) {
        console.error('Leaderboard error:', error);
        res.render('error', { message: 'Error loading leaderboard' });
    }
});

router.get('/api/leaderboard', requireAuth, async (req, res) => {
    try {
        const db = req.db;
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 10;
        const offset = (page - 1) * pageSize;

        let query = db('users')
            .select(
                'users.id',
                'users.username',
                'users.rating',
                db.raw('COUNT(CASE WHEN match_players.is_winner = 1 THEN 1 END) as wins'),
                db.raw('COUNT(CASE WHEN match_players.is_winner = 0 THEN 1 END) as losses')
            )
            .leftJoin('match_players', 'users.id', 'match_players.user_id')
            .leftJoin('matches', 'match_players.match_id', 'matches.id')
            .groupBy('users.id');

        // Apply filters
        if (req.query.gameMode) {
            query.where('matches.game_mode_id', req.query.gameMode);
        }

        if (req.query.period) {
            const now = new Date();
            let startDate;

            switch (req.query.period) {
                case 'day':
                    startDate = new Date(now.setHours(0, 0, 0, 0));
                    break;
                case 'week':
                    startDate = new Date(now.setDate(now.getDate() - now.getDay()));
                    break;
                case 'month':
                    startDate = new Date(now.setDate(1));
                    break;
                default:
                    startDate = null;
            }

            if (startDate) {
                query.where('matches.created_at', '>=', startDate.toISOString());
            }
        }

        // Apply sorting
        switch (req.query.sortBy) {
            case 'wins':
                query.orderBy('wins', 'desc');
                break;
            case 'matches':
                query.orderBy(db.raw('wins + losses'), 'desc');
                break;
            default:
                query.orderBy('rating', 'desc');
        }

        const [players, total] = await Promise.all([
            query.limit(pageSize).offset(offset),
            db('users').count('* as count').first()
        ]);

        res.json({
            players,
            total: total.count,
            page,
            pageSize
        });
    } catch (error) {
        console.error('Leaderboard API error:', error);
        res.status(500).json({ error: 'Error loading leaderboard' });
    }
});

router.get('/users', requireAuth, async (req, res) => {
    try {
        res.render('users');
    } catch (error) {
        console.error('Users page error:', error);
        res.render('error', { message: 'Error loading users page' });
    }
});

router.get('/api/users', requireAuth, async (req, res) => {
    try {
        const db = req.db;
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 10;
        const offset = (page - 1) * pageSize;

        let query = db('users')
            .select(
                'users.*',
                db.raw('COUNT(DISTINCT matches.id) as matches_played')
            )
            .leftJoin('match_players', 'users.id', 'match_players.user_id')
            .leftJoin('matches', 'match_players.match_id', 'matches.id')
            .groupBy('users.id');

        // Apply filters
        if (req.query.status) {
            query.where('users.status', req.query.status);
        }
        if (req.query.role) {
            query.where('users.role', req.query.role);
        }
        if (req.query.search) {
            query.where(function() {
                this.where('users.username', 'like', `%${req.query.search}%`)
                    .orWhere('users.email', 'like', `%${req.query.search}%`);
            });
        }

        // Apply sorting
        switch (req.query.sort) {
            case 'last_active':
                query.orderBy('users.last_active', 'desc');
                break;
            case 'matches':
                query.orderBy('matches_played', 'desc');
                break;
            case 'rating':
                query.orderBy('users.rating', 'desc');
                break;
            default:
                query.orderBy('users.created_at', 'desc');
        }

        const [users, total] = await Promise.all([
            query.limit(pageSize).offset(offset),
            db('users').count('* as count').first()
        ]);

        res.json({
            users,
            total: total.count,
            page,
            pageSize
        });
    } catch (error) {
        console.error('Users API error:', error);
        res.status(500).json({ error: 'Error loading users' });
    }
});

router.get('/api/users/:id', requireAuth, async (req, res) => {
    try {
        const db = req.db;
        const user = await db('users')
            .where('id', req.params.id)
            .first();
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(user);
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Error getting user' });
    }
});

router.get('/api/users/:id/details', requireAuth, async (req, res) => {
    try {
        const db = req.db;
        const [
            user,
            basicStats,
            matches,
            ratingHistory,
            winRateHistory,
            activityLogs,
            gameStats,
            performanceMetrics
        ] = await Promise.all([
            // Basic user info (unchanged)
            db('users').where('id', req.params.id).first(),

            // Enhanced basic stats
            db('match_players')
                .where('user_id', req.params.id)
                .join('matches', 'match_players.match_id', 'matches.id')
                .select(
                    db.raw('COUNT(DISTINCT matches.id) as total_matches'),
                    db.raw('COUNT(CASE WHEN match_players.is_winner = 1 THEN 1 END) as wins'),
                    db.raw('COUNT(CASE WHEN match_players.is_winner = 0 THEN 1 END) as losses'),
                    db.raw('AVG(matches.duration) as avg_duration'),
                    db.raw('AVG(match_players.score) as avg_score'),
                    db.raw('MAX(match_players.score) as best_score'),
                    db.raw('AVG(match_players.rating_change) as avg_rating_change')
                )
                .first(),

            // Recent matches with more details
            db('matches')
                .join('match_players', 'matches.id', 'match_players.match_id')
                .join('game_modes', 'matches.game_mode_id', 'game_modes.id')
                .where('match_players.user_id', req.params.id)
                .select(
                    'matches.created_at',
                    'game_modes.name as game_mode',
                    'match_players.is_winner',
                    'match_players.rating_change',
                    'match_players.score',
                    'matches.duration',
                    db.raw('(SELECT COUNT(*) FROM match_players mp2 WHERE mp2.match_id = matches.id) as player_count')
                )
                .orderBy('matches.created_at', 'desc')
                .limit(20),

            // Rating history (last 30 days)
            db('match_players')
                .where('user_id', req.params.id)
                .join('matches', 'match_players.match_id', 'matches.id')
                .where('matches.created_at', '>', db.raw('datetime("now", "-30 days")'))
                .select(
                    'matches.created_at as date',
                    'match_players.rating_after as rating',
                    'match_players.rating_change'
                )
                .orderBy('matches.created_at'),

            // Enhanced win rate history (by game mode)
            db.raw(`
                WITH RECURSIVE dates(date) AS (
                    SELECT date('now', '-12 weeks')
                    UNION ALL
                    SELECT date(date, '+7 days')
                    FROM dates
                    WHERE date < date('now')
                )
                SELECT 
                    dates.date as period_start,
                    date(dates.date, '+7 days') as period_end,
                    gm.name as game_mode,
                    COUNT(DISTINCT m.id) as total_matches,
                    COALESCE(CAST(SUM(CASE WHEN mp.is_winner = 1 THEN 1 ELSE 0 END) AS FLOAT) / 
                        NULLIF(COUNT(mp.id), 0), 0) as win_rate,
                    AVG(mp.score) as avg_score
                FROM dates
                CROSS JOIN game_modes gm
                LEFT JOIN matches m ON m.created_at >= dates.date 
                    AND m.created_at < date(dates.date, '+7 days')
                    AND m.game_mode_id = gm.id
                LEFT JOIN match_players mp ON mp.match_id = m.id 
                    AND mp.user_id = ?
                GROUP BY dates.date, gm.id
                ORDER BY dates.date, gm.name
            `, [req.params.id]),

            // Activity logs
            db('user_activity_logs')
                .where('user_id', req.params.id)
                .orderBy('created_at', 'desc')
                .limit(50),

            // Game mode specific stats
            db('game_stats')
                .where('user_id', req.params.id)
                .join('game_modes', 'game_stats.game_mode_id', 'game_modes.id')
                .select(
                    'game_modes.name as game_mode',
                    'game_stats.*'
                ),

            // Performance metrics
            db('performance_metrics')
                .where('user_id', req.params.id)
                .where('recorded_at', '>', db.raw('datetime("now", "-30 days")'))
                .join('game_modes', 'performance_metrics.game_mode_id', 'game_modes.id')
                .select(
                    'game_modes.name as game_mode',
                    'performance_metrics.*'
                )
                .orderBy('recorded_at')
        ]);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            user,
            stats: {
                ...basicStats,
                rating: user.rating
            },
            matches,
            rating_history: ratingHistory,
            win_rate_history: winRateHistory,
            activity_logs: activityLogs,
            game_stats: gameStats,
            performance_metrics: performanceMetrics
        });
    } catch (error) {
        console.error('User details error:', error);
        res.status(500).json({ error: 'Error getting user details' });
    }
});

router.get('/api/users/:id/export', requireAuth, async (req, res) => {
    try {
        const db = req.db;
        const userId = req.params.id;
        const format = req.query.format || 'json';
        
        // Get all user data
        const userData = await db('users')
            .where('id', userId)
            .first();
            
        const matches = await db('matches')
            .join('match_players', 'matches.id', 'match_players.match_id')
            .join('game_modes', 'matches.game_mode_id', 'game_modes.id')
            .where('match_players.user_id', userId)
            .select(
                'matches.created_at',
                'game_modes.name as game_mode',
                'match_players.is_winner',
                'match_players.rating_change',
                'match_players.score',
                'matches.duration'
            )
            .orderBy('matches.created_at', 'desc');

        const stats = await db('game_stats')
            .where('user_id', userId)
            .join('game_modes', 'game_stats.game_mode_id', 'game_modes.id')
            .select('game_modes.name as game_mode', 'game_stats.*');

        const activityLogs = await db('user_activity_logs')
            .where('user_id', userId)
            .orderBy('created_at', 'desc');

        const data = {
            user: {
                username: userData.username,
                email: userData.email,
                role: userData.role,
                status: userData.status,
                created_at: userData.created_at,
                last_active: userData.last_active
            },
            stats,
            matches,
            activity_logs: activityLogs
        };

        if (format === 'csv') {
            const csv = await generateCSV(data);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=user_${userId}_data.csv`);
            res.send(csv);
        } else {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename=user_${userId}_data.json`);
            res.json(data);
        }
    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ error: 'Error exporting user data' });
    }
});

// Server stats collection
const os = require('os');

async function collectServerStats() {
    try {
        await init(); // Wait for database initialization
        const db = getDb();
        
        // Clean up old stats
        await db('server_stats')
            .where('timestamp', '<', db.raw("datetime('now', '-24 hours')"))
            .delete();

        // Collect server stats
        const stats = await getServerStats();
        if (!stats) {
            console.error('Error collecting server stats: No stats available');
            return;
        }
        console.log('Server stats collected:', stats);
    } catch (error) {
        console.error('Error collecting server stats:', error);
    }
}

// Collect stats every minute, but wait for initial database initialization
init().then(() => {
    setInterval(collectServerStats, 60000);
    collectServerStats(); // Initial collection
}).catch(error => {
    console.error('Failed to initialize stats collection:', error);
});

router.post('/api/users', requireAuth, async (req, res) => {
    try {
        const db = req.db;
        const { password, ...userData } = req.body;
        const passwordHash = await bcrypt.hash(password, 10);

        const [id] = await db('users').insert({
            ...userData,
            password_hash: passwordHash,
            created_at: new Date().toISOString(),
            last_active: new Date().toISOString()
        });

        res.json({ id });
    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ error: 'Error creating user' });
    }
});

router.put('/api/users/:id', requireAuth, async (req, res) => {
    try {
        const db = req.db;
        const { password, ...userData } = req.body;
        const updateData = { ...userData };

        if (password) {
            updateData.password_hash = await bcrypt.hash(password, 10);
        }

        await db('users')
            .where('id', req.params.id)
            .update(updateData);

        res.json({ success: true });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Error updating user' });
    }
});

router.delete('/api/users/:id', requireAuth, async (req, res) => {
    try {
        const db = req.db;
        await db('users')
            .where('id', req.params.id)
            .delete();

        res.json({ success: true });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Error deleting user' });
    }
});

// API Routes
router.get('/api/stats', requireAuth, async (req, res) => {
    try {
        const db = req.db;
        const stats = await db('server_stats')
            .orderBy('timestamp', 'desc')
            .first();
            
        res.json({
            cpu_usage: stats ? stats.cpu_usage : 0,
            memory_usage: stats ? stats.memory_usage : 0,
            timestamp: stats ? stats.timestamp : new Date().toISOString()
        });
    } catch (error) {
        console.error('Stats API error:', error);
        res.status(500).json({ error: 'Failed to fetch server stats' });
    }
});

router.post('/api/gamemodes', requireAuth, async (req, res) => {
    try {
        const db = req.db;
        const [id] = await db('game_modes').insert({
            name: req.body.name,
            parameters: JSON.stringify(req.body.parameters),
            is_active: req.body.is_active
        });
        res.json({ id });
    } catch (error) {
        console.error('Create game mode error:', error);
        res.status(500).json({ error: 'Error creating game mode' });
    }
});

router.put('/api/gamemodes/:id', requireAuth, async (req, res) => {
    try {
        const db = req.db;
        await db('game_modes')
            .where('id', req.params.id)
            .update({
                name: req.body.name,
                parameters: JSON.stringify(req.body.parameters),
                is_active: req.body.is_active
            });
        res.json({ success: true });
    } catch (error) {
        console.error('Update game mode error:', error);
        res.status(500).json({ error: 'Error updating game mode' });
    }
});

router.delete('/api/gamemodes/:id', requireAuth, async (req, res) => {
    try {
        const db = req.db;
        await db('game_modes')
            .where('id', req.params.id)
            .delete();
        res.json({ success: true });
    } catch (error) {
        console.error('Delete game mode error:', error);
        res.status(500).json({ error: 'Error deleting game mode' });
    }
});

router.post('/api/matches/:id/end', requireAuth, async (req, res) => {
    try {
        const db = req.db;
        await db('matches')
            .where('id', req.params.id)
            .update({
                status: 'completed',
                ended_at: new Date().toISOString()
            });
        res.json({ success: true });
    } catch (error) {
        console.error('End match error:', error);
        res.status(500).json({ error: 'Error ending match' });
    }
});

// Helper functions
async function getServerStats() {
    try {
        const db = getDb();
        const lastHour = new Date(Date.now() - 60 * 60 * 1000);

        // Get active users in the last hour
        const activeUsers = await db('users')
            .where('last_active', '>', lastHour)
            .count('* as count')
            .first();

        // Get total users
        const totalUsers = await db('users')
            .count('* as count')
            .first();

        // Get total matches
        const totalMatches = await db('matches')
            .count('* as count')
            .first();

        // Get active matches
        const activeMatches = await db('matches')
            .where('status', 'active')
            .count('* as count')
            .first();

        return {
            activeUsers: activeUsers?.count || 0,
            totalUsers: totalUsers?.count || 0,
            totalMatches: totalMatches?.count || 0,
            activeMatches: activeMatches?.count || 0,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        console.error('Error getting server stats:', error);
        return null;
    }
}

// Helper function to generate CSV
async function generateCSV(data) {
    const matches = data.matches.map(match => ({
        date: match.created_at,
        game_mode: match.game_mode,
        result: match.is_winner ? 'Won' : 'Lost',
        rating_change: match.rating_change,
        score: match.score,
        duration: match.duration
    }));

    const stats = data.stats.map(stat => ({
        game_mode: stat.game_mode,
        matches_played: stat.matches_played,
        wins: stat.wins,
        losses: stat.losses,
        avg_score: stat.avg_score,
        best_score: stat.best_score
    }));

    const csvData = {
        user: [data.user],
        matches,
        stats
    };

    let csv = '';
    
    // Add user info
    csv += 'User Information\n';
    csv += Object.keys(csvData.user[0]).join(',') + '\n';
    csv += Object.values(csvData.user[0]).join(',') + '\n\n';

    // Add matches
    csv += 'Match History\n';
    if (matches.length > 0) {
        csv += Object.keys(matches[0]).join(',') + '\n';
        csv += matches.map(match => Object.values(match).join(',')).join('\n') + '\n\n';
    }

    // Add stats
    csv += 'Game Mode Statistics\n';
    if (stats.length > 0) {
        csv += Object.keys(stats[0]).join(',') + '\n';
        csv += stats.map(stat => Object.values(stat).join(',')).join('\n');
    }

    return csv;
}

module.exports = router;
