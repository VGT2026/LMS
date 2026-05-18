import DatabaseHelper from '../utils/database';

export interface TenantRow {
  id: number;
  name: string;
  slug: string | null;
  is_active: boolean | number;
  created_at?: Date | string;
  updated_at?: Date | string;
}

export class TenantModel {
  static async findById(id: number): Promise<TenantRow | null> {
    return DatabaseHelper.findOne<TenantRow>(
      'SELECT id, name, slug, is_active, created_at, updated_at FROM tenants WHERE id = ?',
      [id]
    );
  }

  static async findBySlug(slug: string): Promise<TenantRow | null> {
    return DatabaseHelper.findOne<TenantRow>(
      'SELECT id, name, slug, is_active, created_at, updated_at FROM tenants WHERE slug = ?',
      [slug.toLowerCase()]
    );
  }

  static async create(data: { name: string; slug?: string | null; is_active?: boolean }): Promise<TenantRow> {
    const slug = data.slug?.trim().toLowerCase() || null;
    const result = await DatabaseHelper.insert(
      'INSERT INTO tenants (name, slug, is_active) VALUES (?, ?, ?)',
      [data.name.trim(), slug, data.is_active !== false ? 1 : 0]
    );
    const row = await this.findById(result.insertId!);
    if (!row) throw new Error('Failed to load created tenant');
    return row;
  }

  static async findAll(activeOnly = false): Promise<TenantRow[]> {
    const where = activeOnly ? 'WHERE is_active = TRUE' : '';
    return DatabaseHelper.findMany<TenantRow>(
      `SELECT id, name, slug, is_active, created_at, updated_at FROM tenants ${where} ORDER BY name ASC`
    );
  }

  static slugify(name: string): string {
    return name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
  }

  static async createUniqueFromName(name: string): Promise<TenantRow> {
    const base = this.slugify(name) || 'org';
    let slug = base;
    let i = 0;
    while (await this.findBySlug(slug)) {
      i += 1;
      slug = `${base}-${i}`;
    }
    return this.create({ name: name.trim(), slug, is_active: true });
  }
}
