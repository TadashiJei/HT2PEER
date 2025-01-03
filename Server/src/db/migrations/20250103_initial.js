exports.up = function(knex) {
    return knex.schema
        .createTable('users', table => {
            table.increments('id').primary();
            table.string('username').unique().notNullable();
            table.string('email').unique();
            table.string('password_hash').notNullable();
            table.integer('rating').defaultTo(1500);
            table.boolean('is_admin').defaultTo(false);
            table.timestamp('last_active');
            table.timestamps(true, true);
        })
        .createTable('matches', table => {
            table.increments('id').primary();
            table.string('room_id').notNullable();
            table.integer('host_id').references('id').inTable('users');
            table.string('game_mode').notNullable();
            table.string('status').defaultTo('pending');
            table.json('players');
            table.json('result');
            table.timestamps(true, true);
        })
        .createTable('match_history', table => {
            table.increments('id').primary();
            table.integer('match_id').references('id').inTable('matches');
            table.integer('player_id').references('id').inTable('users');
            table.integer('rating_change');
            table.json('stats');
            table.timestamps(true, true);
        })
        .createTable('leaderboard', table => {
            table.increments('id').primary();
            table.integer('user_id').references('id').inTable('users');
            table.integer('rating');
            table.integer('wins');
            table.integer('losses');
            table.timestamps(true, true);
        })
        .createTable('game_modes', table => {
            table.increments('id').primary();
            table.string('name').unique().notNullable();
            table.json('settings');
            table.boolean('is_active').defaultTo(true);
            table.timestamps(true, true);
        })
        .createTable('server_stats', table => {
            table.increments('id').primary();
            table.float('cpu_usage').notNullable();
            table.float('memory_usage').notNullable();
            table.timestamp('timestamp').notNullable();
            table.index('timestamp');
        })
        .createTable('user_activity_logs', table => {
            table.increments('id').primary();
            table.integer('user_id').references('id').inTable('users').onDelete('CASCADE');
            table.string('activity_type').notNullable();
            table.string('description').notNullable();
            table.json('metadata');
            table.timestamp('created_at').defaultTo(knex.fn.now());
            table.index(['user_id', 'activity_type']);
            table.index('created_at');
        })
        .createTable('game_stats', table => {
            table.increments('id').primary();
            table.integer('user_id').references('id').inTable('users').onDelete('CASCADE');
            table.integer('game_mode_id').references('id').inTable('game_modes');
            table.integer('matches_played').defaultTo(0);
            table.integer('wins').defaultTo(0);
            table.integer('losses').defaultTo(0);
            table.float('avg_score').defaultTo(0);
            table.float('avg_match_duration').defaultTo(0);
            table.float('best_score').defaultTo(0);
            table.timestamp('last_match_at');
            table.unique(['user_id', 'game_mode_id']);
        })
        .createTable('performance_metrics', table => {
            table.increments('id').primary();
            table.integer('user_id').references('id').inTable('users').onDelete('CASCADE');
            table.integer('game_mode_id').references('id').inTable('game_modes');
            table.string('metric_type').notNullable();
            table.float('value').notNullable();
            table.timestamp('recorded_at').defaultTo(knex.fn.now());
            table.index(['user_id', 'game_mode_id', 'metric_type']);
            table.index('recorded_at');
        });
};

exports.down = function(knex) {
    return knex.schema
        .dropTable('performance_metrics')
        .dropTable('game_stats')
        .dropTable('user_activity_logs')
        .dropTable('server_stats')
        .dropTable('game_modes')
        .dropTable('leaderboard')
        .dropTable('match_history')
        .dropTable('matches')
        .dropTable('users');
};
