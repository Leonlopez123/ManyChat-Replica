// Spiegelt db/migrations/*.sql. Migrationen sind die Quelle der Wahrheit; dieses File nur für typisierte Queries.
import { pgTable, uuid, text, boolean, integer, timestamp, jsonb } from 'drizzle-orm/pg-core';

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

export const account = pgTable('account', {
  id: uuid('id').primaryKey().defaultRandom(),
  igUserId: text('ig_user_id').notNull(),
  username: text('username').notNull(),
  accessTokenEnc: text('access_token_enc').notNull(),
  tokenExpiresAt: ts('token_expires_at').notNull(),
  webhookSubscribedAt: ts('webhook_subscribed_at'),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

export const postScopes = ['single', 'all', 'next'] as const;
export type PostScope = (typeof postScopes)[number];

export const automations = pgTable('automations', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull().references(() => account.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  active: boolean('active').notNull().default(false),
  postScope: text('post_scope').$type<PostScope>().notNull().default('single'),
  mediaId: text('media_id'),
  mediaPermalink: text('media_permalink'),
  mediaThumbnailUrl: text('media_thumbnail_url'),
  activatedAt: ts('activated_at'),
  keywords: text('keywords').array().notNull().default([]),
  excludeKeywords: text('exclude_keywords').array().notNull().default([]),
  publicReplies: text('public_replies').array().notNull().default([]),
  openingText: text('opening_text').notNull(),
  openingButtonLabel: text('opening_button_label').notNull().default('Ja'),
  followGate: boolean('follow_gate').notNull().default(true),
  followPromptText: text('follow_prompt_text').notNull().default(''),
  followButtonLabel: text('follow_button_label').notNull().default('Erledigt'),
  maxFollowAttempts: integer('max_follow_attempts').notNull().default(3),
  deliverWhenGateExhausted: boolean('deliver_when_gate_exhausted').notNull().default(true),
  deliveryText: text('delivery_text').notNull(),
  deliveryUrl: text('delivery_url').notNull(),
  deliveryButtonLabel: text('delivery_button_label').notNull().default('Öffnen'),
  bonusText: text('bonus_text'),
  bonusUrl: text('bonus_url'),
  bonusButtonLabel: text('bonus_button_label').default('Zur Website'),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

export const contacts = pgTable('contacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull().references(() => account.id, { onDelete: 'cascade' }),
  igsid: text('igsid').notNull(),
  username: text('username'),
  firstName: text('first_name'),
  isFollower: boolean('is_follower'),
  followerCheckedAt: ts('follower_checked_at'),
  lastInteractionAt: ts('last_interaction_at'),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

export const runStatuses = ['commented', 'dm_sent', 'clicked', 'follow_pending', 'delivered', 'failed', 'expired'] as const;
export type RunStatus = (typeof runStatuses)[number];

export const runs = pgTable('runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  automationId: uuid('automation_id').notNull().references(() => automations.id, { onDelete: 'cascade' }),
  contactId: uuid('contact_id').notNull().references(() => contacts.id, { onDelete: 'cascade' }),
  commentId: text('comment_id').notNull(),
  mediaId: text('media_id').notNull(),
  commentText: text('comment_text').notNull(),
  status: text('status').$type<RunStatus>().notNull().default('commented'),
  followAttempts: integer('follow_attempts').notNull().default(0),
  publicReplyId: text('public_reply_id'),
  error: text('error'),
  dmSentAt: ts('dm_sent_at'),
  clickedAt: ts('clicked_at'),
  deliveredAt: ts('delivered_at'),
  windowExpiresAt: ts('window_expires_at'),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

export type EventKind = 'webhook_comment' | 'webhook_postback' | 'webhook_message' | 'send' | 'api_error' | 'token_refresh';

export const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  runId: uuid('run_id').references(() => runs.id, { onDelete: 'set null' }),
  kind: text('kind').$type<EventKind>().notNull(),
  dedupeKey: text('dedupe_key'),
  payload: jsonb('payload').notNull().default({}),
  createdAt: ts('created_at').notNull().defaultNow(),
});

export const linkClicks = pgTable('link_clicks', {
  id: uuid('id').primaryKey().defaultRandom(),
  runId: uuid('run_id').notNull().references(() => runs.id, { onDelete: 'cascade' }),
  target: text('target').$type<'delivery' | 'bonus'>().notNull(),
  clickedAt: ts('clicked_at').notNull().defaultNow(),
});

export type Account = typeof account.$inferSelect;
export type Automation = typeof automations.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type Run = typeof runs.$inferSelect;
