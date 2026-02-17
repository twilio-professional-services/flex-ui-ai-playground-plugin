import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { SyncToReduxState, SyncObjectMetadata, MapTrackingMode } from '../types';

const initialState: SyncToReduxState = {
  trackedMaps: {},
  connectionState: 'disconnected',
  error: null,
};

const syncToReduxSlice = createSlice({
  name: 'syncToRedux',
  initialState,
  reducers: {
    setConnectionState(state, action: PayloadAction<'connected' | 'connecting' | 'disconnected' | 'error'>) {
      state.connectionState = action.payload;
    },
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    },
    addTrackedMap(state, action: PayloadAction<{ mapName: string; mode: MapTrackingMode }>) {
      state.trackedMaps[action.payload.mapName] = {
        mapName: action.payload.mapName,
        mode: action.payload.mode,
        mapData: {},
        mapItems: {},
        syncObjects: {},
      };
    },
    removeTrackedMap(state, action: PayloadAction<{ mapName: string }>) {
      delete state.trackedMaps[action.payload.mapName];
    },
    updateMapData(state, action: PayloadAction<{ mapName: string; key: string; value: SyncObjectMetadata }>) {
      const { mapName, key, value } = action.payload;
      if (state.trackedMaps[mapName]) {
        state.trackedMaps[mapName].mapData[key] = value;
      }
    },
    removeMapItem(state, action: PayloadAction<{ mapName: string; key: string }>) {
      const { mapName, key } = action.payload;
      if (state.trackedMaps[mapName]) {
        // For metadata mode
        delete state.trackedMaps[mapName].mapData[key];
        delete state.trackedMaps[mapName].syncObjects[key];
        // For direct mode
        delete state.trackedMaps[mapName].mapItems[key];
      }
    },
    updateDirectMapItem(state, action: PayloadAction<{ mapName: string; key: string; value: any }>) {
      const { mapName, key, value } = action.payload;
      if (state.trackedMaps[mapName]) {
        state.trackedMaps[mapName].mapItems[key] = value;
      }
    },
    updateSyncDocument(state, action: PayloadAction<{ mapName: string; key: string; data: any }>) {
      const { mapName, key, data } = action.payload;
      if (state.trackedMaps[mapName]) {
        state.trackedMaps[mapName].syncObjects[key] = {
          type: 'doc',
          data,
        };
      }
    },
    updateSyncList(state, action: PayloadAction<{ mapName: string; key: string; items: any[] }>) {
      const { mapName, key, items } = action.payload;
      if (state.trackedMaps[mapName]) {
        state.trackedMaps[mapName].syncObjects[key] = {
          type: 'list',
          items,
        };
      }
    },
    updateSyncMap(state, action: PayloadAction<{ mapName: string; key: string; mapItems: Record<string, any> }>) {
      const { mapName, key, mapItems } = action.payload;
      if (state.trackedMaps[mapName]) {
        state.trackedMaps[mapName].syncObjects[key] = {
          type: 'map',
          mapItems,
        };
      }
    },
  },
});

export const {
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
} = syncToReduxSlice.actions;

export const reducerHook = () => ({ syncToRedux: syncToReduxSlice.reducer });
