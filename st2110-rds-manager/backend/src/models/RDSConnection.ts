import { getDatabase } from '../database/init';
import { RDSConnection, RDSConnectionDB } from '../types';
import { v4 as uuidv4 } from 'uuid';

export class RDSConnectionModel {
  // Convert DB row to application object
  private static fromDB(row: RDSConnectionDB): RDSConnection {
    return {
      id: row.id,
      name: row.name,
      ipAddress: row.ip_address,
      port: row.port,
      timeout: row.timeout,
      enabled: Boolean(row.enabled),
      lastConnected: row.last_connected,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // Convert application object to DB row
  private static toDB(conn: Partial<RDSConnection>): Partial<RDSConnectionDB> {
    const db: any = {};
    if (conn.id) db.id = conn.id;
    if (conn.name) db.name = conn.name;
    if (conn.ipAddress) db.ip_address = conn.ipAddress;
    if (conn.port !== undefined) db.port = conn.port;
    if (conn.timeout !== undefined) db.timeout = conn.timeout;
    if (conn.enabled !== undefined) db.enabled = conn.enabled ? 1 : 0;
    if (conn.lastConnected) db.last_connected = conn.lastConnected;
    return db;
  }

  // Get all RDS connections
  static async getAll(): Promise<RDSConnection[]> {
    return new Promise((resolve, reject) => {
      const db = getDatabase();
      db.all<RDSConnectionDB>(
        'SELECT * FROM rds_connections ORDER BY created_at DESC',
        [],
        (err, rows) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(rows.map(this.fromDB));
        }
      );
    });
  }

  // Get RDS connection by ID
  static async getById(id: string): Promise<RDSConnection | null> {
    return new Promise((resolve, reject) => {
      const db = getDatabase();
      db.get<RDSConnectionDB>(
        'SELECT * FROM rds_connections WHERE id = ?',
        [id],
        (err, row) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(row ? this.fromDB(row) : null);
        }
      );
    });
  }

  // Create new RDS connection
  static async create(conn: Omit<RDSConnection, 'id' | 'createdAt' | 'updatedAt'>): Promise<RDSConnection> {
    return new Promise((resolve, reject) => {
      const db = getDatabase();
      const id = uuidv4();
      const now = new Date().toISOString();

      db.run(
        `INSERT INTO rds_connections (id, name, ip_address, port, timeout, enabled, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, conn.name, conn.ipAddress, conn.port, conn.timeout, conn.enabled ? 1 : 0, now, now],
        function (err) {
          if (err) {
            reject(err);
            return;
          }
          resolve({
            id,
            ...conn,
            createdAt: now,
            updatedAt: now,
          });
        }
      );
    });
  }

  // Update RDS connection
  static async update(id: string, conn: Partial<RDSConnection>): Promise<RDSConnection | null> {
    return new Promise((resolve, reject) => {
      const db = getDatabase();
      const now = new Date().toISOString();

      const updates: string[] = [];
      const values: any[] = [];

      if (conn.name !== undefined) {
        updates.push('name = ?');
        values.push(conn.name);
      }
      if (conn.ipAddress !== undefined) {
        updates.push('ip_address = ?');
        values.push(conn.ipAddress);
      }
      if (conn.port !== undefined) {
        updates.push('port = ?');
        values.push(conn.port);
      }
      if (conn.timeout !== undefined) {
        updates.push('timeout = ?');
        values.push(conn.timeout);
      }
      if (conn.enabled !== undefined) {
        updates.push('enabled = ?');
        values.push(conn.enabled ? 1 : 0);
      }
      if (conn.lastConnected !== undefined) {
        updates.push('last_connected = ?');
        values.push(conn.lastConnected);
      }

      updates.push('updated_at = ?');
      values.push(now);
      values.push(id);

      db.run(
        `UPDATE rds_connections SET ${updates.join(', ')} WHERE id = ?`,
        values,
        async function (err) {
          if (err) {
            reject(err);
            return;
          }
          if (this.changes === 0) {
            resolve(null);
            return;
          }
          const updated = await RDSConnectionModel.getById(id);
          resolve(updated);
        }
      );
    });
  }

  // Delete RDS connection
  static async delete(id: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const db = getDatabase();
      db.run('DELETE FROM rds_connections WHERE id = ?', [id], function (err) {
        if (err) {
          reject(err);
          return;
        }
        resolve(this.changes > 0);
      });
    });
  }

  // Update last connected timestamp
  static async updateLastConnected(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const db = getDatabase();
      const now = new Date().toISOString();
      db.run(
        'UPDATE rds_connections SET last_connected = ?, updated_at = ? WHERE id = ?',
        [now, now, id],
        (err) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        }
      );
    });
  }
}
