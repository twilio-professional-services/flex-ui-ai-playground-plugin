import { SyncClient, SyncMap, SyncDocument, SyncList } from 'twilio-sync';

export type SyncObjectType = 'doc' | 'list' | 'map';

export interface SyncObjectMetadata {
  syncObjectType: SyncObjectType;
  syncObjectName: string;
}

export interface TrackedSyncObject {
  type: SyncObjectType;
  data?: any;  // For documents
  items?: any[];  // For lists
  mapItems?: Record<string, any>;  // For maps
  syncObject: SyncDocument | SyncList | SyncMap;
}

export type MapTrackingMode = 'metadata' | 'direct';

export interface TrackedMap {
  mapName: string;
  syncMap: SyncMap;
  mode: MapTrackingMode;  // How this map is being tracked
  mapData: Record<string, SyncObjectMetadata>;  // Used in metadata mode
  mapItems: Record<string, any>;  // Used in direct mode
  syncObjects: Record<string, TrackedSyncObject>;  // Used in metadata mode
}

export interface SyncToReduxState {
  trackedMaps: Record<string, {
    mapName: string;
    mode: MapTrackingMode;
    mapData: Record<string, SyncObjectMetadata>;  // Metadata about other sync objects
    mapItems: Record<string, any>;  // Direct map data
    syncObjects: Record<string, {
      type: SyncObjectType;
      data?: any;
      items?: any[];
      mapItems?: Record<string, any>;
    }>;
  }>;
  connectionState: 'connected' | 'connecting' | 'disconnected' | 'error';
  error: string | null;
}
