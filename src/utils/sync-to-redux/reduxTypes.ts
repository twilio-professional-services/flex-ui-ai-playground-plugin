/**
 * Redux state shape for SyncToRedux data
 * This is the state structure managed by the SyncToRedux library
 */
export interface SyncToReduxState {
  /** Connection state of the Sync client */
  connectionState: string | null;
  /** Error message if any */
  error: string | null;
  /** Tracked Sync maps keyed by map name */
  trackedMaps: Record<string, TrackedMapState>;
}

/**
 * State for a single tracked Sync map
 */
export interface TrackedMapState {
  /** Tracking mode: metadata or direct */
  mode: 'metadata' | 'direct';
  /** Map data (for metadata mode) */
  mapData: Record<string, unknown>;
  /** Direct map items (for direct mode) */
  mapItems: Record<string, unknown>;
  /** Sync objects referenced by this map */
  syncObjects: Record<string, SyncObjectState>;
}

/**
 * State for a tracked Sync object (doc, list, or map)
 */
export interface SyncObjectState {
  type: 'doc' | 'list' | 'map';
  data?: unknown;
  items?: unknown[];
  mapItems?: Record<string, unknown>;
}
