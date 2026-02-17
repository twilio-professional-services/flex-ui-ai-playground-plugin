import { SyncClient, SyncMap, SyncDocument, SyncList, SyncMapItem } from 'twilio-sync';
import * as Flex from '@twilio/flex-ui';
import { Store } from 'redux';
import {
  setConnectionState,
  setError,
  addTrackedMap,
  removeTrackedMap,
  updateMapData,
  removeMapItem,
  updateDirectMapItem,
  updateSyncDocument,
  updateSyncList,
  updateSyncMap,
} from './state/syncToReduxSlice';
import { TrackedMap, SyncObjectMetadata, TrackedSyncObject, MapTrackingMode } from './types';

class SyncToReduxService {
  private syncClient: SyncClient | null = null;
  private manager: Flex.Manager | null = null;
  private store: Store<any> | null = null;
  private trackedMaps: Map<string, TrackedMap> = new Map();
  private initialized = false;
  private reduxNamespace: string = 'flex-sync'; // Default namespace

  // Internal index-keyed storage for list items, enabling incremental
  // updates from Sync events without re-fetching the entire list.
  // Key: "mapName::objectKey", Value: Map<listIndex, itemData>
  private listIndexMaps: Map<string, Map<number, any>> = new Map();

  /**
   * Initialize the SyncToRedux service
   * @param reduxNamespace - The Redux namespace where syncToRedux state is registered (default: 'flex-sync')
   */
  async initialize(reduxNamespace?: string): Promise<void> {
    if (this.initialized) {
      console.warn('[SyncToRedux] Already initialized');
      return;
    }

    if (reduxNamespace) {
      this.reduxNamespace = reduxNamespace;
    }

    try {
      this.manager = Flex.Manager.getInstance();
      this.store = this.manager.store;

      // Initialize SyncClient with Flex token
      this.syncClient = new SyncClient(this.manager.user.token);

      // Setup token refresh listener
      this.manager.events.addListener('tokenUpdated', (payload: any) => {
        console.log('[SyncToRedux] Token updated, refreshing Sync client');
        if (this.syncClient && payload.token) {
          this.syncClient.updateToken(payload.token);
        }
      });

      // Setup connection state listeners
      this.syncClient.on('connectionStateChanged', (state: string) => {
        console.log('[SyncToRedux] Connection state changed:', state);
        this.dispatch(setConnectionState(state as any));
      });

      this.syncClient.on('connectionError', (error: any) => {
        console.error('[SyncToRedux] Connection error:', error);
        this.dispatch(setError(error.message || 'Connection error'));
      });

      this.initialized = true;
      console.log('[SyncToRedux] Service initialized successfully');
    } catch (error) {
      console.error('[SyncToRedux] Initialization failed:', error);
      this.dispatch(setError(error instanceof Error ? error.message : 'Initialization failed'));
      throw error;
    }
  }

  private dispatch(action: any): void {
    if (this.store) {
      this.store.dispatch(action);
    }
  }

  /**
   * Track a Sync Map
   * @param mapName - The name/SID of the Sync Map
   * @param mode - Tracking mode: 'metadata' (map contains references to other sync objects) or 'direct' (map contains data directly)
   *               If not specified, will auto-detect based on map items
   */
  async trackSync(mapName: string, mode?: MapTrackingMode): Promise<void> {
    if (!this.syncClient) {
      throw new Error('[SyncToRedux] Service not initialized. Call initialize() first.');
    }

    if (this.trackedMaps.has(mapName)) {
      console.warn(`[SyncToRedux] Map "${mapName}" is already being tracked`);
      return;
    }

    try {
      console.log(`[SyncToRedux] Starting to track map: ${mapName}`);

      // Open or create Sync Map
      const syncMap = await this.syncClient.map({ id: mapName, mode: 'open_or_create' });

      // Read all existing map items (with pagination)
      const items = await this.getAllMapItems(syncMap);
      console.log(`[SyncToRedux] Found ${items.length} existing items in map "${mapName}"`);

      // Auto-detect mode if not specified
      let trackingMode = mode;
      if (!trackingMode) {
        trackingMode = this.detectMapMode(items);
        console.log(`[SyncToRedux] Auto-detected mode for "${mapName}": ${trackingMode}`);
      }

      // Dispatch action to add tracked map to Redux
      this.dispatch(addTrackedMap({ mapName, mode: trackingMode }));

      // Create tracked map object
      const trackedMap: TrackedMap = {
        mapName,
        syncMap,
        mode: trackingMode,
        mapData: {},
        mapItems: {},
        syncObjects: {},
      };

      this.trackedMaps.set(mapName, trackedMap);

      // Add map event listeners BEFORE processing existing items to avoid
      // a race condition where items added during setup would be missed.
      // The dedup guard in openSyncObject prevents double-processing if an
      // item appears in both the initial read and a concurrent event.
      if (trackingMode === 'metadata') {
        this.addMetadataModeListeners(mapName, syncMap);
      } else {
        this.addDirectModeListeners(mapName, syncMap);
      }

      // Process items based on mode
      if (trackingMode === 'metadata') {
        await this.setupMetadataMode(mapName, trackedMap, items);
      } else {
        await this.setupDirectMode(mapName, trackedMap, items);
      }

      console.log(`[SyncToRedux] Successfully tracking map: ${mapName} (mode: ${trackingMode})`);
    } catch (error) {
      console.error(`[SyncToRedux] Failed to track map "${mapName}":`, error);
      this.dispatch(setError(error instanceof Error ? error.message : 'Failed to track map'));
      throw error;
    }
  }

  private detectMapMode(items: SyncMapItem[]): MapTrackingMode {
    if (items.length === 0) {
      // Default to metadata mode for empty maps
      return 'metadata';
    }

    // Check if first item looks like metadata
    const firstItem = items[0];
    const data = firstItem.data;

    if (data && typeof data === 'object' && 'syncObjectType' in data && 'syncObjectName' in data) {
      return 'metadata';
    }

    return 'direct';
  }

  private async setupMetadataMode(mapName: string, trackedMap: TrackedMap, items: SyncMapItem[]): Promise<void> {
    for (const item of items) {
      const metadata = item.data as SyncObjectMetadata;
      trackedMap.mapData[item.key] = metadata;

      // Update Redux with map data
      this.dispatch(updateMapData({ mapName, key: item.key, value: metadata }));

      // Open and track the referenced Sync object
      await this.openSyncObject(mapName, item.key, metadata);
    }
  }

  private async setupDirectMode(mapName: string, trackedMap: TrackedMap, items: SyncMapItem[]): Promise<void> {
    for (const item of items) {
      trackedMap.mapItems[item.key] = item.data;

      // Update Redux with map item
      this.dispatch(updateDirectMapItem({ mapName, key: item.key, value: item.data }));
    }
  }

  private addMetadataModeListeners(mapName: string, syncMap: SyncMap): void {
    syncMap
      .on('itemAdded', async (event: any) => {
        if (!event.isLocal) {
          const metadata = event.item.data as SyncObjectMetadata;

          const tracked = this.trackedMaps.get(mapName);
          if (tracked) {
            tracked.mapData[event.item.key] = metadata;
          }

          this.dispatch(updateMapData({ mapName, key: event.item.key, value: metadata }));
          await this.openSyncObject(mapName, event.item.key, metadata);
        }
      })
      .on('itemUpdated', async (event: any) => {
        if (!event.isLocal) {
          const metadata = event.item.data as SyncObjectMetadata;

          const tracked = this.trackedMaps.get(mapName);
          if (tracked) {
            tracked.mapData[event.item.key] = metadata;
          }

          this.dispatch(updateMapData({ mapName, key: event.item.key, value: metadata }));

          // Open sync object if not already tracked (handles case where
          // itemAdded was missed but a subsequent update catches it)
          if (tracked && !tracked.syncObjects[event.item.key]) {
            await this.openSyncObject(mapName, event.item.key, metadata);
          }
        }
      })
      .on('itemRemoved', async (event: any) => {
        // Close and cleanup the referenced sync object
        const tracked = this.trackedMaps.get(mapName);
        if (tracked && tracked.syncObjects[event.key]) {
          const syncObj = tracked.syncObjects[event.key];
          syncObj.syncObject.removeAllListeners();
          await syncObj.syncObject.close();
          this.listIndexMaps.delete(`${mapName}::${event.key}`);
          delete tracked.syncObjects[event.key];
          delete tracked.mapData[event.key];
        }

        this.dispatch(removeMapItem({ mapName, key: event.key }));
      });
  }

  private addDirectModeListeners(mapName: string, syncMap: SyncMap): void {
    syncMap
      .on('itemAdded', (event: any) => {
        if (!event.isLocal) {
          const tracked = this.trackedMaps.get(mapName);
          if (tracked) {
            tracked.mapItems[event.item.key] = event.item.data;
          }

          this.dispatch(updateDirectMapItem({ mapName, key: event.item.key, value: event.item.data }));
        }
      })
      .on('itemUpdated', (event: any) => {
        if (!event.isLocal) {
          const tracked = this.trackedMaps.get(mapName);
          if (tracked) {
            tracked.mapItems[event.item.key] = event.item.data;
          }

          this.dispatch(updateDirectMapItem({ mapName, key: event.item.key, value: event.item.data }));
        }
      })
      .on('itemRemoved', (event: any) => {
        const tracked = this.trackedMaps.get(mapName);
        if (tracked) {
          delete tracked.mapItems[event.key];
        }

        this.dispatch(removeMapItem({ mapName, key: event.key }));
      });
  }

  // Derive a sorted data array from the index map for Redux dispatch
  private sortedListItems(indexMap: Map<number, any>): any[] {
    return Array.from(indexMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([, data]) => data);
  }

  private listKey(mapName: string, key: string): string {
    return `${mapName}::${key}`;
  }

  private async openSyncObject(mapName: string, key: string, metadata: SyncObjectMetadata): Promise<void> {
    if (!this.syncClient) {
      throw new Error('[SyncToRedux] SyncClient not initialized');
    }

    const tracked = this.trackedMaps.get(mapName);
    if (!tracked) {
      console.warn(`[SyncToRedux] Map "${mapName}" not found when opening sync object`);
      return;
    }

    // Skip if this sync object is already tracked (prevents double-opens from race conditions)
    if (tracked.syncObjects[key]) {
      return;
    }

    try {
      console.log(`[SyncToRedux] Opening ${metadata.syncObjectType} "${metadata.syncObjectName}" for map "${mapName}"`);

      if (metadata.syncObjectType === 'doc') {
        const doc = await this.syncClient.document({ id: metadata.syncObjectName, mode: 'open_or_create' });

        // Store the tracked object
        tracked.syncObjects[key] = {
          type: 'doc',
          data: doc.data,
          syncObject: doc,
        };

        // Dispatch initial data to Redux
        this.dispatch(updateSyncDocument({ mapName, key, data: doc.data }));

        // Document updated events carry the full new data — no read needed
        doc.on('updated', (event: any) => {
          if (!event.isLocal) {
            const tracked = this.trackedMaps.get(mapName);
            if (tracked && tracked.syncObjects[key]) {
              tracked.syncObjects[key].data = event.data;
            }

            this.dispatch(updateSyncDocument({ mapName, key, data: event.data }));
          }
        });

      } else if (metadata.syncObjectType === 'list') {
        const list = await this.syncClient.list({ id: metadata.syncObjectName, mode: 'open_or_create' });

        // Load all existing items and build the index map for incremental updates
        const indexMap = new Map<number, any>();
        let page = await list.getItems({ pageSize: 100 });
        for (const item of page.items as any[]) {
          indexMap.set(item.index, item.data);
        }
        while (page.hasNextPage) {
          page = await page.nextPage();
          for (const item of page.items as any[]) {
            indexMap.set(item.index, item.data);
          }
        }
        this.listIndexMaps.set(this.listKey(mapName, key), indexMap);

        const items = this.sortedListItems(indexMap);

        // Store the tracked object
        tracked.syncObjects[key] = {
          type: 'list',
          items,
          syncObject: list,
        };

        // Dispatch initial data to Redux
        this.dispatch(updateSyncList({ mapName, key, items }));

        // List events carry the item data — update the index map incrementally, no read needed
        const lk = this.listKey(mapName, key);

        list
          .on('itemAdded', (event: any) => {
            const idxMap = this.listIndexMaps.get(lk);
            if (!idxMap) return;
            idxMap.set(event.item.index, event.item.data);
            const updatedItems = this.sortedListItems(idxMap);

            const t = this.trackedMaps.get(mapName);
            if (t?.syncObjects[key]) {
              t.syncObjects[key].items = updatedItems;
            }
            this.dispatch(updateSyncList({ mapName, key, items: updatedItems }));
          })
          .on('itemUpdated', (event: any) => {
            const idxMap = this.listIndexMaps.get(lk);
            if (!idxMap) return;
            idxMap.set(event.item.index, event.item.data);
            const updatedItems = this.sortedListItems(idxMap);

            const t = this.trackedMaps.get(mapName);
            if (t?.syncObjects[key]) {
              t.syncObjects[key].items = updatedItems;
            }
            this.dispatch(updateSyncList({ mapName, key, items: updatedItems }));
          })
          .on('itemRemoved', (event: any) => {
            const idxMap = this.listIndexMaps.get(lk);
            if (!idxMap) return;
            idxMap.delete(event.index);
            const updatedItems = this.sortedListItems(idxMap);

            const t = this.trackedMaps.get(mapName);
            if (t?.syncObjects[key]) {
              t.syncObjects[key].items = updatedItems;
            }
            this.dispatch(updateSyncList({ mapName, key, items: updatedItems }));
          });

      } else if (metadata.syncObjectType === 'map') {
        // Maps referenced from metadata mode are always tracked in direct mode
        // (no nested metadata - keep it simple)
        const map = await this.syncClient.map({ id: metadata.syncObjectName, mode: 'open_or_create' });

        // Get all map items for initial load
        const rawItems = await this.getAllMapItems(map);
        const mapItems: Record<string, any> = {};
        rawItems.forEach(item => {
          mapItems[item.key] = item.data;
        });

        // Store the tracked object
        tracked.syncObjects[key] = {
          type: 'map',
          mapItems,
          syncObject: map,
        };

        // Dispatch initial data to Redux
        this.dispatch(updateSyncMap({ mapName, key, mapItems }));

        // Map events carry item data — update mapItems directly, no re-read needed
        map
          .on('itemAdded', (event: any) => {
            const t = this.trackedMaps.get(mapName);
            if (t?.syncObjects[key]) {
              const mi = t.syncObjects[key].mapItems || {};
              mi[event.item.key] = event.item.data;
              t.syncObjects[key].mapItems = mi;
              this.dispatch(updateSyncMap({ mapName, key, mapItems: { ...mi } }));
            }
          })
          .on('itemUpdated', (event: any) => {
            const t = this.trackedMaps.get(mapName);
            if (t?.syncObjects[key]) {
              const mi = t.syncObjects[key].mapItems || {};
              mi[event.item.key] = event.item.data;
              t.syncObjects[key].mapItems = mi;
              this.dispatch(updateSyncMap({ mapName, key, mapItems: { ...mi } }));
            }
          })
          .on('itemRemoved', (event: any) => {
            const t = this.trackedMaps.get(mapName);
            if (t?.syncObjects[key]) {
              const mi = t.syncObjects[key].mapItems || {};
              delete mi[event.key];
              t.syncObjects[key].mapItems = mi;
              this.dispatch(updateSyncMap({ mapName, key, mapItems: { ...mi } }));
            }
          });
      }

    } catch (error) {
      console.error(`[SyncToRedux] Failed to open sync object "${metadata.syncObjectName}":`, error);
      this.dispatch(setError(error instanceof Error ? error.message : 'Failed to open sync object'));
    }
  }

  private async getAllMapItems(map: SyncMap): Promise<SyncMapItem[]> {
    const result: SyncMapItem[] = [];
    let page = await map.getItems({ pageSize: 100 });
    result.push(...page.items);

    while (page.hasNextPage) {
      page = await page.nextPage();
      result.push(...page.items);
    }

    return result;
  }

  async untrackSync(mapName: string): Promise<void> {
    const tracked = this.trackedMaps.get(mapName);
    if (!tracked) {
      console.warn(`[SyncToRedux] Map "${mapName}" is not being tracked`);
      return;
    }

    try {
      console.log(`[SyncToRedux] Untracking map: ${mapName}`);

      // Remove all sync object listeners and close them
      for (const [key, syncObj] of Object.entries(tracked.syncObjects)) {
        syncObj.syncObject.removeAllListeners();
        await syncObj.syncObject.close();
        this.listIndexMaps.delete(this.listKey(mapName, key));
      }

      // Remove map listeners and close it
      tracked.syncMap.removeAllListeners();
      await tracked.syncMap.close();

      // Remove from tracking
      this.trackedMaps.delete(mapName);

      // Update Redux
      this.dispatch(removeTrackedMap({ mapName }));

      console.log(`[SyncToRedux] Successfully untracked map: ${mapName}`);
    } catch (error) {
      console.error(`[SyncToRedux] Failed to untrack map "${mapName}":`, error);
      this.dispatch(setError(error instanceof Error ? error.message : 'Failed to untrack map'));
      throw error;
    }
  }

  // Public method to get connection state
  getConnectionState(): string | null {
    return this.syncClient ? this.syncClient.connectionState : null;
  }

  // Public method to check if a map is being tracked
  isTracking(mapName: string): boolean {
    return this.trackedMaps.has(mapName);
  }

  // Public method to get all tracked map names
  getTrackedMapNames(): string[] {
    return Array.from(this.trackedMaps.keys());
  }

  // Public method to get the Redux namespace
  getReduxNamespace(): string {
    return this.reduxNamespace;
  }
}

// Export singleton instance
const syncToReduxService = new SyncToReduxService();

// Expose for debugging in browser console
if (typeof window !== 'undefined') {
  (window as any).SyncToReduxService = syncToReduxService;
}

export default syncToReduxService;
