import { Pool } from 'pg';
import type { PoolConfig } from 'pg';

import {
  isAttendanceRecord,
  isAttendanceType,
  isGeofenceStatus,
} from '@/lib/validation';
import type { AttendanceRecord } from '@/types/attendance';

/**
 * Attendance storage.
 *
 * Records go to Postgres whenever `DATABASE_URL` is present, which is the
 * configuration that matters on Vercel - the filesystem there is read-only and
 * ephemeral, so an in-memory array would lose every punch on a cold start.
 * Without a connection string the store degrades to memory so local
 * development still works, but it says so out loud rather than losing data
 * quietly.
 */

/** Where punches are kept, and how durable that place is. */
export interface AttendanceStore {
  /** `false` means records vanish the moment this process exits. */
  readonly durable: boolean;
  insert(record: AttendanceRecord): Promise<void>;
  list(): Promise<AttendanceRecord[]>;
}

/** A row exactly as Postgres returns it: snake_case, timestamps as `Date`. */
type AttendanceRow = {
  id: string;
  employee_id: string;
  employee_name: string;
  type: string;
  latitude: number;
  longitude: number;
  distance_meters: number;
  status: string;
  created_at: Date | string;
};

/**
 * Module state parked on `globalThis` so a development hot-reload reuses the
 * same pool instead of leaking a new connection on every edit.
 */
interface AttendanceGlobals {
  pool?: Pool;
  schemaReady?: Promise<void>;
  memoryRecords?: AttendanceRecord[];
  warnedAboutMemory?: boolean;
}

const globals = globalThis as unknown as AttendanceGlobals;

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS attendance_records (
  seq BIGSERIAL,
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  employee_name TEXT NOT NULL,
  type TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  distance_meters INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
)`;

const CREATE_INDEX_SQL = `
CREATE INDEX IF NOT EXISTS attendance_records_seq_idx
ON attendance_records (seq DESC)`;

const INSERT_SQL = `
INSERT INTO attendance_records (
  id, employee_id, employee_name, type,
  latitude, longitude, distance_meters, status, created_at
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`;

// `seq` - not `created_at` - orders the recap, because punches taken in the
// same millisecond would otherwise come back in an arbitrary order.
const SELECT_SQL = `
SELECT id, employee_id, employee_name, type,
       latitude, longitude, distance_meters, status, created_at
FROM attendance_records
ORDER BY seq DESC`;

/** True when a Postgres connection string has been supplied. */
export function isDurableStorage(): boolean {
  const connectionString = process.env.DATABASE_URL;
  return connectionString !== undefined && connectionString.trim() !== '';
}

/**
 * Hosted providers require TLS, but Node only turns it on when the connection
 * string asks for it. When `sslmode` is missing and the host is not this
 * machine, enable TLS anyway so a pasted Neon or Vercel URL works unedited.
 */
function requiresImplicitTls(connectionString: string): boolean {
  if (connectionString.includes('sslmode=')) {
    return false;
  }

  try {
    const host = new URL(connectionString).hostname;
    return host !== 'localhost' && host !== '127.0.0.1' && host !== '::1';
  } catch {
    return false;
  }
}

function buildPoolConfig(connectionString: string): PoolConfig {
  const config: PoolConfig = {
    connectionString,
    // Serverless instances must not sit on a large pool of idle connections.
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  };

  if (requiresImplicitTls(connectionString)) {
    config.ssl = { rejectUnauthorized: false };
  }

  return config;
}

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (connectionString === undefined || connectionString.trim() === '') {
    throw new Error(
      'DATABASE_URL is not set. Add it to your Vercel project settings to persist attendance records.',
    );
  }
  return new Pool(buildPoolConfig(connectionString));
}

/**
 * Create the schema once per process, retrying on a later request if the
 * first attempt failed - a cached rejection would otherwise poison the
 * instance for good.
 */
function ensureSchema(pool: Pool): Promise<void> {
  let existing = globals.schemaReady;

  if (existing === undefined) {
    existing = (async () => {
      await pool.query(CREATE_TABLE_SQL);
      await pool.query(CREATE_INDEX_SQL);
    })();

    globals.schemaReady = existing;
    void existing.catch(() => {
      globals.schemaReady = undefined;
    });
  }

  return existing;
}

function toIsoTimestamp(value: Date | string): string {
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
}

/**
 * Convert a database row into the shared `AttendanceRecord` contract.
 *
 * The guards do the narrowing that a cast would otherwise do, so a corrupt or
 * hand-edited row surfaces as an explicit error instead of leaking a
 * wrong-shaped object into the recap table.
 */
function toRecord(row: AttendanceRow): AttendanceRecord {
  const type: unknown = row.type;
  const status: unknown = row.status;

  if (!isAttendanceType(type) || !isGeofenceStatus(status)) {
    throw new Error(`Stored attendance row ${row.id} has an unknown type/status.`);
  }

  const record: AttendanceRecord = {
    id: row.id,
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    type,
    latitude: row.latitude,
    longitude: row.longitude,
    distanceMeters: row.distance_meters,
    status,
    timestamp: toIsoTimestamp(row.created_at),
  };

  if (!isAttendanceRecord(record)) {
    throw new Error(`Stored attendance row ${row.id} failed validation.`);
  }

  return record;
}

function postgresStore(): AttendanceStore {
  const pool = globals.pool ?? createPool();
  globals.pool = pool;
  const ready = ensureSchema(pool);

  return {
    durable: true,
    async insert(record: AttendanceRecord): Promise<void> {
      await ready;
      await pool.query(INSERT_SQL, [
        record.id,
        record.employeeId,
        record.employeeName,
        record.type,
        record.latitude,
        record.longitude,
        record.distanceMeters,
        record.status,
        record.timestamp,
      ]);
    },
    async list(): Promise<AttendanceRecord[]> {
      await ready;
      const result = await pool.query<AttendanceRow>(SELECT_SQL);
      return result.rows.map(toRecord);
    },
  };
}

function memoryRecords(): AttendanceRecord[] {
  if (globals.memoryRecords === undefined) {
    globals.memoryRecords = [];
  }
  return globals.memoryRecords;
}

function warnAboutMemoryOnce(): void {
  if (globals.warnedAboutMemory === true) {
    return;
  }
  globals.warnedAboutMemory = true;
  console.warn(
    'DATABASE_URL is not set: attendance records are held in memory and are lost when this server restarts.',
  );
}

function memoryStore(): AttendanceStore {
  warnAboutMemoryOnce();

  return {
    durable: false,
    async insert(record: AttendanceRecord): Promise<void> {
      memoryRecords().unshift(record);
    },
    async list(): Promise<AttendanceRecord[]> {
      return [...memoryRecords()];
    },
  };
}

/** Resolve the store for the current environment. */
export function getStore(): AttendanceStore {
  return isDurableStorage() ? postgresStore() : memoryStore();
}
