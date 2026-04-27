/**
 * Digest Logging Utility
 * Handles persistent logging of all digest send attempts to digest_logs table
 */

const { supabaseAdmin } = require('./supabase');

/**
 * Log a digest send attempt
 * @param {Object} params
 * @param {string} params.type - 'admin' or 'user'
 * @param {string} params.recipient - email address
 * @param {string} params.status - 'sent', 'failed', or 'pending'
 * @param {string} params.userId - user UUID (optional, null for admin digest)
 * @param {string} params.errorMsg - error message (optional, null if success)
 * @returns {Promise<Object>} - { ok: boolean, error?: string }
 */
async function logDigestAttempt({ type, recipient, status, userId = null, errorMsg = null }) {
  try {
    if (!['admin', 'user'].includes(type)) {
      throw new Error(`Invalid type: ${type}`);
    }
    if (!['sent', 'failed', 'pending'].includes(status)) {
      throw new Error(`Invalid status: ${status}`);
    }
    if (!recipient || typeof recipient !== 'string') {
      throw new Error('recipient is required');
    }

    const { data, error } = await supabaseAdmin
      .from('digest_logs')
      .insert({
        type,
        recipient,
        status,
        user_id: userId || null,
        error_msg: errorMsg || null,
      })
      .select('id');

    if (error) {
      console.error(`[digestLogging] Insert error: ${error.message}`);
      return { ok: false, error: error.message };
    }

    return { ok: true, logId: data?.[0]?.id };
  } catch (err) {
    console.error(`[digestLogging] ${err.message}`);
    return { ok: false, error: err.message };
  }
}

/**
 * Query digest logs with filters
 * @param {Object} filters
 * @param {string} filters.type - 'admin', 'user', or null (all)
 * @param {string} filters.status - 'sent', 'failed', 'pending', or null (all)
 * @param {string} filters.startDate - ISO date string (inclusive)
 * @param {string} filters.endDate - ISO date string (inclusive)
 * @param {number} filters.limit - max results (default 50, max 500)
 * @param {number} filters.offset - pagination offset (default 0)
 * @returns {Promise<Object>} - { ok: boolean, total: number, logs: Array, error?: string }
 */
async function queryDigestLogs(filters = {}) {
  try {
    const {
      type = null,
      status = null,
      startDate = null,
      endDate = null,
      limit = 50,
      offset = 0,
    } = filters;

    // Validate pagination
    const pageSize = Math.min(Math.max(1, parseInt(limit, 10) || 50), 500);
    const pageOffset = Math.max(0, parseInt(offset, 10) || 0);

    // Build query
    let query = supabaseAdmin
      .from('digest_logs')
      .select('*', { count: 'exact' });

    // Apply filters
    if (type && ['admin', 'user'].includes(type)) {
      query = query.eq('type', type);
    }

    if (status && ['sent', 'failed', 'pending'].includes(status)) {
      query = query.eq('status', status);
    }

    if (startDate) {
      query = query.gte('created_at', startDate);
    }

    if (endDate) {
      // Add 1 day to endDate to include full day (until 23:59:59)
      const end = new Date(endDate);
      end.setDate(end.getDate() + 1);
      query = query.lt('created_at', end.toISOString());
    }

    // Pagination and sort
    query = query
      .order('created_at', { ascending: false })
      .range(pageOffset, pageOffset + pageSize - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error(`[digestLogging] Query error: ${error.message}`);
      return { ok: false, error: error.message };
    }

    return {
      ok: true,
      total: count || 0,
      limit: pageSize,
      offset: pageOffset,
      logs: data || [],
    };
  } catch (err) {
    console.error(`[digestLogging] ${err.message}`);
    return { ok: false, error: err.message };
  }
}

module.exports = { logDigestAttempt, queryDigestLogs };
