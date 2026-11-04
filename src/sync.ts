/** Contract for a future remote adapter. No network sync is performed in V0.1. */
export interface SyncRecord<T> {
  id: string;
  updatedAt: string;
  deletedAt: string | null;
  payload: T;
}

export interface SyncAdapter<T> {
  pull(since: string | null): Promise<{ records: SyncRecord<T>[]; cursor: string }>;
  push(records: SyncRecord<T>[]): Promise<{ acceptedIds: string[] }>;
}
