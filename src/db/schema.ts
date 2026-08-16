import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, text, doublePrecision, timestamp } from 'drizzle-orm/pg-core';

// Define the 'users' table
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Define the 'positions' table
export const positions = pgTable('positions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  symbol: text('symbol').notNull(),
  side: text('side').notNull(),
  entryPrice: doublePrecision('entry_price').notNull(),
  currentPrice: doublePrecision('current_price').notNull(),
  quantity: doublePrecision('quantity').notNull(),
  takeProfitPrice: doublePrecision('take_profit_price'),
  dailyOpen: doublePrecision('daily_open'),
  openedAt: text('opened_at').notNull(),
  unrealizedPnlUsdt: doublePrecision('unrealized_pnl_usdt'),
  unrealizedPnlPct: doublePrecision('unrealized_pnl_pct'),
  exchange: text('exchange'),
});

// Define the 'trade_history' table
export const tradeHistory = pgTable('trade_history', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  symbol: text('symbol').notNull(),
  side: text('side').notNull(),
  entryPrice: doublePrecision('entry_price').notNull(),
  exitPrice: doublePrecision('exit_price').notNull(),
  quantity: doublePrecision('quantity').notNull(),
  pnlPct: doublePrecision('pnl_pct').notNull(),
  pnlUsdt: doublePrecision('pnl_usdt').notNull(),
  dailyOpen: doublePrecision('daily_open'),
  openedAt: text('opened_at').notNull(),
  closedAt: text('closed_at').notNull(),
  durationSec: integer('duration_sec'),
  exchange: text('exchange'),
});

export const usersRelations = relations(users, ({ many }) => ({
  positions: many(positions),
  tradeHistory: many(tradeHistory),
}));
