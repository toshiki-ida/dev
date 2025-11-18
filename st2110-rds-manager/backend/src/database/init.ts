import sqlite3 from 'sqlite3';
import path from 'path';

const DB_PATH = path.join(__dirname, '../../database.sqlite');

export const initDatabase = (): Promise<sqlite3.Database> => {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('Database connection error:', err);
        reject(err);
        return;
      }
      console.log('Connected to SQLite database');

      // Create tables
      db.serialize(() => {
        // RDS Connections table
        db.run(`
          CREATE TABLE IF NOT EXISTS rds_connections (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            ip_address TEXT NOT NULL,
            port INTEGER NOT NULL,
            timeout INTEGER DEFAULT 30,
            enabled BOOLEAN DEFAULT 1,
            last_connected TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
          )
        `, (err) => {
          if (err) console.error('Error creating rds_connections table:', err);
          else console.log('rds_connections table ready');
        });

        // Schedules table
        db.run(`
          CREATE TABLE IF NOT EXISTS schedules (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            enabled BOOLEAN DEFAULT 1,
            task_type TEXT NOT NULL,
            source_rds TEXT NOT NULL,
            target_rds TEXT,
            node_filter TEXT,
            schedule_config TEXT NOT NULL,
            options TEXT,
            last_run TEXT,
            next_run TEXT,
            status TEXT DEFAULT 'pending',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (source_rds) REFERENCES rds_connections(id),
            FOREIGN KEY (target_rds) REFERENCES rds_connections(id)
          )
        `, (err) => {
          if (err) console.error('Error creating schedules table:', err);
          else console.log('schedules table ready');
        });

        // Logs table
        db.run(`
          CREATE TABLE IF NOT EXISTS logs (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            level TEXT NOT NULL,
            message TEXT NOT NULL,
            details TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
          )
        `, (err) => {
          if (err) console.error('Error creating logs table:', err);
          else console.log('logs table ready');
        });

        resolve(db);
      });
    });
  });
};

export const getDatabase = (): sqlite3.Database => {
  return new sqlite3.Database(DB_PATH);
};
