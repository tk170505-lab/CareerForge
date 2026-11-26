import { run } from '../config/db.js';

export function logActivity({ userId = null, action, entityType = null, entityId = null, details = null, ipAddress = null }) {
  try {
    run(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES (?, ?, ?, ?, ?, ?)`,
      userId,
      action,
      entityType,
      entityId,
      details,
      ipAddress
    );
  } catch (err) {
    console.error('Activity log error:', err.message);
  }
}
