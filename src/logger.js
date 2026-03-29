const crypto = require('crypto');

const LOG_RETENTION_DAYS = parseInt(process.env.LOG_RETENTION_DAYS, 10) || 30;

/**
 * Enterprise-grade logging service with database persistence.
 * Logs are stored in the audit_logs table and automatically cleaned
 * after LOG_RETENTION_DAYS (configurable via .env, default 30).
 * Feature data (houses, answers, settings, etc.) is never touched.
 */
class Logger {
  constructor() {
    this._getDb = null; // set after init
  }

  /**
   * Initialise the logger with the database accessor.
   * Must be called once after initDb().
   */
  init(getDbFn) {
    this._getDb = getDbFn;
  }

  // ── Core persistence ──────────────────────────────────────────────

  async _persist(level, category, event, details, meta) {
    if (!this._getDb) return;
    const db = await this._getDb();
    try {
      await db.prepare(
        `INSERT INTO audit_logs (id, level, category, event, details, ip_address, user_agent, duration_ms, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      ).run(
        crypto.randomUUID(),
        level,
        category,
        event,
        typeof details === 'string' ? details : JSON.stringify(details),
        (meta && meta.ip) || null,
        (meta && meta.ua) || null,
        (meta && meta.duration) != null ? meta.duration : null
      );
    } catch (err) {
      // Fallback to console – never let logging crash the app
      console.error('[Logger] Failed to persist log:', err.message);
    } finally {
      await db.close();
    }
  }

  // ── Public API ────────────────────────────────────────────────────

  async info(category, event, details, meta) {
    await this._persist('info', category, event, details, meta);
  }

  async warn(category, event, details, meta) {
    await this._persist('warn', category, event, details, meta);
  }

  async error(category, event, details, meta) {
    console.error(`[${new Date().toISOString()}] ERROR ${category}/${event}:`, details);
    await this._persist('error', category, event, details, meta);
  }

  async audit(category, event, details, meta) {
    await this._persist('audit', category, event, details, meta);
  }

  // ── Convenience shortcuts ─────────────────────────────────────────

  /** Log a quiz answer being saved */
  async quizAnswer(houseId, questionId, optionId, meta) {
    await this.audit('quiz', 'answer_saved', { houseId, questionId, optionId }, meta);
  }

  /** Log a batch of quiz answers (group save) */
  async quizGroupSave(houseId, groupId, answerCount, meta) {
    await this.audit('quiz', 'group_saved', { houseId, groupId, answerCount }, meta);
  }

  /** Log report generation (export, AI, PDF) with duration */
  async reportGenerated(type, houseId, durationMs, meta) {
    await this.audit('report', 'generated', { type, houseId, durationMs }, { ...meta, duration: durationMs });
  }

  /** Log image upload */
  async imageUploaded(houseId, questionId, filename, meta) {
    await this.audit('upload', 'image_uploaded', { houseId, questionId, filename }, meta);
  }

  /** Log page view / user interaction */
  async pageView(path, meta) {
    await this.info('navigation', 'page_view', { path }, meta);
  }

  /** Log an application error */
  async appError(statusCode, message, stack, meta) {
    await this.error('app', 'error', { statusCode, message, stack: (stack || '').substring(0, 1000) }, meta);
  }

  // ── Log cleanup ───────────────────────────────────────────────────

  /**
   * Delete audit_logs older than LOG_RETENTION_DAYS.
   * Does NOT touch any feature tables (houses, answers, settings …).
   */
  async cleanup() {
    if (!this._getDb) return 0;
    const db = await this._getDb();
    try {
      const result = await db.prepare(
        `DELETE FROM audit_logs WHERE created_at < datetime('now', '-' || ? || ' days')`
      ).run(LOG_RETENTION_DAYS);
      const deleted = result.changes || 0;
      if (deleted > 0) {
        console.log(`[Logger] Cleaned up ${deleted} audit log(s) older than ${LOG_RETENTION_DAYS} day(s).`);
      }
      return deleted;
    } catch (err) {
      console.error('[Logger] Cleanup failed:', err.message);
      return 0;
    } finally {
      await db.close();
    }
  }
}

// Singleton instance
const logger = new Logger();

module.exports = { logger, LOG_RETENTION_DAYS };
