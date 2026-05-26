import { JobRole } from '../types';
import DatabaseHelper from '../utils/database';
import { tableHasColumn } from '../utils/mysqlSchema';

export class JobRoleModel {
  static async findById(id: number): Promise<JobRole | null> {
    const exists = await tableHasColumn('job_roles', 'id');
    if (!exists) return null;
    return DatabaseHelper.findOne<JobRole>(
      'SELECT id, title, description, salary_range, demand, growth, created_at, updated_at FROM job_roles WHERE id = ?',
      [id]
    );
  }
}
