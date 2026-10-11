/**
 * Backup / restore helpers (web only).
 *
 * All app data lives in AsyncStorage (localStorage on web) under a small,
 * fixed set of keys. A backup is a single JSON document containing every
 * key, so it can be written to any file the user chooses and restored later.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../constants';

const BACKUP_FORMAT = 'forest-focus-backup';
const BACKUP_VERSION = 1;

/** Keys that make up a complete backup. */
const BACKUP_KEYS: string[] = [
  STORAGE_KEYS.SESSIONS,
  STORAGE_KEYS.SETTINGS,
  STORAGE_KEYS.ACTIVE_SESSION,
  STORAGE_KEYS.LEVEL_DATA,
];

export interface BackupPayload {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  data: Record<string, unknown>;
}

export type SaveResult = 'saved' | 'downloaded' | 'cancelled';

// ─── Export ──────────────────────────────────────────────────────────

function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

/** Collect all persisted app data into a single backup payload. */
export async function createBackup(): Promise<BackupPayload> {
  const entries = await AsyncStorage.multiGet(BACKUP_KEYS);
  const data: Record<string, unknown> = {};
  for (const [key, raw] of entries) {
    data[key] = raw == null ? null : safeParse(raw);
  }
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  };
}

/** Human-readable, sortable backup file name. */
export function buildBackupFilename(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp =
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `forest-focus-backup-${stamp}.json`;
}

// Minimal typing for the File System Access API (Chromium only).
interface SaveFilePickerOptions {
  suggestedName?: string;
  types?: { description?: string; accept: Record<string, string[]> }[];
}
interface FileSystemFileHandleLike {
  createWritable: () => Promise<{
    write: (data: string) => Promise<void>;
    close: () => Promise<void>;
  }>;
}
interface WindowWithSavePicker extends Window {
  showSaveFilePicker?: (
    options?: SaveFilePickerOptions,
  ) => Promise<FileSystemFileHandleLike>;
}

/**
 * Save the backup to a file.
 *
 * On browsers that support the File System Access API the user picks the
 * exact location; otherwise we fall back to a normal download.
 */
export async function saveBackupFile(
  payload: BackupPayload,
): Promise<SaveResult> {
  const json = JSON.stringify(payload, null, 2);
  const filename = buildBackupFilename();
  const win = window as WindowWithSavePicker;

  if (typeof win.showSaveFilePicker === 'function') {
    try {
      const handle = await win.showSaveFilePicker({
        suggestedName: filename,
        types: [
          { description: 'JSON backup', accept: { 'application/json': ['.json'] } },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(json);
      await writable.close();
      return 'saved';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return 'cancelled';
      }
      // Any other failure: fall through to the download fallback.
    }
  }

  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}

// ─── Import ──────────────────────────────────────────────────────────

/** Open the OS file picker and resolve with the chosen file (or null). */
export function pickBackupFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.style.display = 'none';
    input.addEventListener('change', () => {
      resolve(input.files && input.files[0] ? input.files[0] : null);
      input.remove();
    });
    // Resolve null if the picker is dismissed without a selection.
    window.addEventListener(
      'focus',
      () => {
        setTimeout(() => {
          if (!input.isConnected) return;
          resolve(input.files && input.files[0] ? input.files[0] : null);
          input.remove();
        }, 500);
      },
      { once: true },
    );
    document.body.appendChild(input);
    input.click();
  });
}

function isBackupPayload(value: unknown): value is BackupPayload {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Partial<BackupPayload>;
  return (
    payload.format === BACKUP_FORMAT &&
    typeof payload.version === 'number' &&
    !!payload.data &&
    typeof payload.data === 'object'
  );
}

/**
 * Restore app data from a backup document. Returns the number of keys that
 * were written so callers can report the result.
 */
export async function restoreBackupFromText(text: string): Promise<number> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('The selected file is not valid JSON.');
  }

  if (!isBackupPayload(parsed)) {
    throw new Error('This file is not a Forest Focus backup.');
  }

  const pairs: [string, string][] = [];
  for (const key of BACKUP_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(parsed.data, key)) continue;
    pairs.push([key, JSON.stringify(parsed.data[key])]);
  }

  if (pairs.length === 0) {
    throw new Error('The backup contains no data to restore.');
  }

  await AsyncStorage.multiSet(pairs);
  return pairs.length;
}
