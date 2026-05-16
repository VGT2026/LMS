import DatabaseHelper from '../utils/database';

export type AuditAction =
  | 'superadmin.admin.create'
  | 'superadmin.admin.deactivate'
  | 'superadmin.admin.activate'
  | 'user.role.update';

export class AuditLogModel {
  static async record(params: {
    actor_id: number;
    action: AuditAction | string;
    target_user_id?: number | null;
    metadata?: Record<string, unknown> | null;
  }): Promise<void> {
    try {
      const query = `
        INSERT INTO audit_logs (actor_id, action, target_user_id, metadata)
        VALUES (?, ?, ?, ?)
      `;
      await DatabaseHelper.insert(query, [
        params.actor_id,
        params.action,
        params.target_user_id ?? null,
        params.metadata ? JSON.stringify(params.metadata) : null,
      ]);
    } catch (err) {
      console.warn('[AuditLog] Failed to write audit log:', (err as Error)?.message ?? err);
    }
  }
}
