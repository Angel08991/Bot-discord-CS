import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const dataDir = path.resolve(process.cwd(), 'data');
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'bot.sqlite'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS guild_config (
    guild_id TEXT PRIMARY KEY,
    config_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL,
    category TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    created_at TEXT NOT NULL,
    closed_at TEXT
  );
  CREATE TABLE IF NOT EXISTS ratings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    ticket_channel_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    rating INTEGER NOT NULL,
    comment TEXT DEFAULT '',
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS moderation_cases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    moderator_id TEXT NOT NULL,
    action TEXT NOT NULL,
    reason TEXT DEFAULT '',
    duration_seconds INTEGER DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS suggestions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    message_id TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS giveaways (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    message_id TEXT NOT NULL UNIQUE,
    host_id TEXT NOT NULL,
    prize TEXT NOT NULL,
    winners INTEGER NOT NULL,
    ends_at INTEGER NOT NULL,
    requirements_json TEXT NOT NULL DEFAULT '{}',
    ended INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS giveaway_entries (
    giveaway_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    entered_at TEXT NOT NULL,
    PRIMARY KEY (giveaway_id, user_id)
  );
  CREATE INDEX IF NOT EXISTS idx_tickets_guild_user_status ON tickets(guild_id, user_id, status);
  CREATE INDEX IF NOT EXISTS idx_ratings_guild ON ratings(guild_id);
  CREATE INDEX IF NOT EXISTS idx_moderation_guild_user ON moderation_cases(guild_id, user_id, id DESC);
  CREATE INDEX IF NOT EXISTS idx_suggestions_guild ON suggestions(guild_id, id DESC);
  CREATE INDEX IF NOT EXISTS idx_giveaways_ends ON giveaways(ends_at, ended);
  CREATE TABLE IF NOT EXISTS levels (
    guild_id TEXT NOT NULL, user_id TEXT NOT NULL, xp INTEGER NOT NULL DEFAULT 0, level INTEGER NOT NULL DEFAULT 0,
    last_xp_at INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (guild_id, user_id)
  );
  CREATE TABLE IF NOT EXISTS economy (
    guild_id TEXT NOT NULL, user_id TEXT NOT NULL, balance INTEGER NOT NULL DEFAULT 0, last_daily_at INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (guild_id, user_id)
  );
  CREATE TABLE IF NOT EXISTS reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT NOT NULL, channel_id TEXT NOT NULL, user_id TEXT NOT NULL, message TEXT NOT NULL, due_at INTEGER NOT NULL, sent INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS afk (
    guild_id TEXT NOT NULL, user_id TEXT NOT NULL, reason TEXT NOT NULL, since INTEGER NOT NULL, PRIMARY KEY (guild_id, user_id)
  );
  CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(due_at, sent);
`);

function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all().map(row => row.name);
  if (!columns.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

ensureColumn('tickets', 'claimed_by', 'TEXT');

export function getGuildConfig(guildId, defaults) {
  const row = db.prepare('SELECT config_json FROM guild_config WHERE guild_id = ?').get(guildId);
  if (!row) return structuredClone(defaults);
  try {
    return mergeConfig(structuredClone(defaults), JSON.parse(row.config_json));
  } catch {
    return structuredClone(defaults);
  }
}

function mergeConfig(base, override) {
  if (!override || typeof override !== 'object') return base;
  for (const [key, value] of Object.entries(override)) {
    if (value && typeof value === 'object' && !Array.isArray(value) && base[key] && typeof base[key] === 'object') {
      base[key] = mergeConfig(base[key], value);
    } else {
      base[key] = value;
    }
  }
  return base;
}

export function saveGuildConfig(guildId, config) {
  db.prepare(`
    INSERT INTO guild_config (guild_id, config_json, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(guild_id) DO UPDATE SET
      config_json = excluded.config_json,
      updated_at = excluded.updated_at
  `).run(guildId, JSON.stringify(config));
}

export function createTicket({ guildId, channelId, userId, category }) {
  return db.prepare(`
    INSERT INTO tickets (guild_id, channel_id, user_id, category, status, created_at)
    VALUES (?, ?, ?, ?, 'open', datetime('now'))
  `).run(guildId, channelId, userId, category);
}

export function getOpenTicketByUser(guildId, userId) {
  return db.prepare(`
    SELECT * FROM tickets WHERE guild_id = ? AND user_id = ? AND status = 'open' ORDER BY id DESC LIMIT 1
  `).get(guildId, userId);
}

export function getTicketByChannel(channelId) {
  return db.prepare('SELECT * FROM tickets WHERE channel_id = ?').get(channelId);
}

export function claimTicket(channelId, userId) {
  return db.prepare("UPDATE tickets SET claimed_by = ? WHERE channel_id = ? AND status = 'open'").run(userId, channelId);
}

export function closeTicket(channelId) {
  return db.prepare(`
    UPDATE tickets SET status = 'closed', closed_at = datetime('now') WHERE channel_id = ? AND status = 'open'
  `).run(channelId);
}

export function addRating({ guildId, ticketChannelId, userId, rating, comment }) {
  return db.prepare(`
    INSERT INTO ratings (guild_id, ticket_channel_id, user_id, rating, comment, created_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `).run(guildId, ticketChannelId, userId, rating, comment ?? '');
}

export function getRatingStats(guildId) {
  const row = db.prepare(`
    SELECT COUNT(*) AS count, COALESCE(AVG(rating), 0) AS average FROM ratings WHERE guild_id = ?
  `).get(guildId);
  return { count: row.count, average: Number(row.average).toFixed(2) };
}

export function addModerationCase({ guildId, userId, moderatorId, action, reason, durationSeconds = 0 }) {
  const result = db.prepare(`
    INSERT INTO moderation_cases (guild_id, user_id, moderator_id, action, reason, duration_seconds, created_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(guildId, userId, moderatorId, action, reason ?? '', durationSeconds);
  return result.lastInsertRowid;
}

export function getModerationCase(guildId, caseId) {
  return db.prepare('SELECT * FROM moderation_cases WHERE guild_id = ? AND id = ?').get(guildId, caseId);
}

export function getRecentModerationCases(guildId, limit = 20) {
  return db.prepare('SELECT * FROM moderation_cases WHERE guild_id = ? ORDER BY id DESC LIMIT ?').all(guildId, Math.max(1, Math.min(100, limit)));
}

export function getModerationCases(guildId, userId, limit = 10) {
  return db.prepare(`
    SELECT * FROM moderation_cases WHERE guild_id = ? AND user_id = ? ORDER BY id DESC LIMIT ?
  `).all(guildId, userId, Math.max(1, Math.min(50, limit)));
}

export function createSuggestion({ guildId, channelId, messageId, userId, content }) {
  const result = db.prepare(`
    INSERT INTO suggestions (guild_id, channel_id, message_id, user_id, content, status, created_at)
    VALUES (?, ?, ?, ?, ?, 'pending', datetime('now'))
  `).run(guildId, channelId, messageId, userId, content);
  return result.lastInsertRowid;
}

export function getSuggestionByMessage(messageId) {
  return db.prepare('SELECT * FROM suggestions WHERE message_id = ?').get(messageId);
}

export function updateSuggestionStatus(messageId, status) {
  return db.prepare('UPDATE suggestions SET status = ? WHERE message_id = ?').run(status, messageId);
}

export function createGiveaway({ guildId, channelId, messageId, hostId, prize, winners, endsAt, requirements = {} }) {
  const result = db.prepare(`
    INSERT INTO giveaways (guild_id, channel_id, message_id, host_id, prize, winners, ends_at, requirements_json, ended)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
  `).run(guildId, channelId, messageId, hostId, prize, winners, endsAt, JSON.stringify(requirements));
  return result.lastInsertRowid;
}

export function getGiveawayByMessage(messageId) {
  return db.prepare('SELECT * FROM giveaways WHERE message_id = ?').get(messageId);
}

export function getActiveGiveaways() {
  return db.prepare('SELECT * FROM giveaways WHERE ended = 0').all();
}

export function endGiveaway(giveawayId) {
  return db.prepare('UPDATE giveaways SET ended = 1 WHERE id = ? AND ended = 0').run(giveawayId);
}

export function addGiveawayEntry(giveawayId, userId) {
  return db.prepare(`
    INSERT OR IGNORE INTO giveaway_entries (giveaway_id, user_id, entered_at)
    VALUES (?, ?, datetime('now'))
  `).run(giveawayId, userId);
}

export function hasGiveawayEntry(giveawayId, userId) {
  return Boolean(db.prepare('SELECT 1 FROM giveaway_entries WHERE giveaway_id = ? AND user_id = ?').get(giveawayId, userId));
}

export function getGiveawayEntries(giveawayId) {
  return db.prepare('SELECT user_id FROM giveaway_entries WHERE giveaway_id = ?').all(giveawayId).map(r => r.user_id);
}

export function closeDatabase() {
  db.close();
}


export function getLevelProfile(guildId, userId) {
  return db.prepare(`INSERT INTO levels (guild_id,user_id) VALUES (?,?) ON CONFLICT(guild_id,user_id) DO NOTHING`).run(guildId,userId), db.prepare('SELECT * FROM levels WHERE guild_id = ? AND user_id = ?').get(guildId,userId);
}
export function addXP(guildId,userId,amount) {
  const p=getLevelProfile(guildId,userId); const xp=p.xp+amount; const level=Math.max(0,Math.floor(Math.sqrt(xp/100)));
  db.prepare('UPDATE levels SET xp=?, level=?, last_xp_at=? WHERE guild_id=? AND user_id=?').run(xp,level,Date.now(),guildId,userId); return { ...p, xp, level, leveledUp: level>p.level };
}
export function getLevelRank(guildId,userId) { const r=db.prepare('SELECT COUNT(*) AS rank FROM levels WHERE guild_id=? AND xp>(SELECT xp FROM levels WHERE guild_id=? AND user_id=?)').get(guildId,guildId,userId); return Number(r?.rank||0)+1; }
export function getLevelLeaderboard(guildId,limit=10) { return db.prepare('SELECT user_id,xp,level FROM levels WHERE guild_id=? ORDER BY xp DESC LIMIT ?').all(guildId,Math.max(1,Math.min(25,limit))); }
export function getEconomyUser(guildId,userId) { db.prepare(`INSERT INTO economy (guild_id,user_id) VALUES (?,?) ON CONFLICT(guild_id,user_id) DO NOTHING`).run(guildId,userId); return db.prepare('SELECT * FROM economy WHERE guild_id=? AND user_id=?').get(guildId,userId); }
export function addMoney(guildId,userId,amount) { getEconomyUser(guildId,userId); return db.prepare('UPDATE economy SET balance=balance+? WHERE guild_id=? AND user_id=?').run(amount,guildId,userId); }
export function getDailyCooldown(guildId,userId) { const p=getEconomyUser(guildId,userId); return Math.max(0,(24*60*60*1000)-(Date.now()-Number(p.last_daily_at||0))); }
export function setDailyClaim(guildId,userId) { getEconomyUser(guildId,userId); return db.prepare('UPDATE economy SET last_daily_at=? WHERE guild_id=? AND user_id=?').run(Date.now(),guildId,userId); }
export function getEconomyLeaderboard(guildId,limit=10) { return db.prepare('SELECT user_id,balance FROM economy WHERE guild_id=? ORDER BY balance DESC LIMIT ?').all(guildId,Math.max(1,Math.min(25,limit))); }
export function createReminder({guildId,channelId,userId,message,dueAt}) { return db.prepare('INSERT INTO reminders (guild_id,channel_id,user_id,message,due_at,sent) VALUES (?,?,?,?,?,0)').run(guildId,channelId,userId,message,dueAt); }
export function getDueReminders(now=Date.now()) { return db.prepare('SELECT * FROM reminders WHERE sent=0 AND due_at<=? ORDER BY due_at ASC').all(now); }
export function markReminderSent(id) { return db.prepare('UPDATE reminders SET sent=1 WHERE id=?').run(id); }
export function setAFK(guildId,userId,reason) { return db.prepare(`INSERT INTO afk (guild_id,user_id,reason,since) VALUES (?,?,?,?) ON CONFLICT(guild_id,user_id) DO UPDATE SET reason=excluded.reason,since=excluded.since`).run(guildId,userId,reason,Date.now()); }
export function getAFK(guildId,userId) { return db.prepare('SELECT * FROM afk WHERE guild_id=? AND user_id=?').get(guildId,userId); }
export function removeAFK(guildId,userId) { return db.prepare('DELETE FROM afk WHERE guild_id=? AND user_id=?').run(guildId,userId); }
