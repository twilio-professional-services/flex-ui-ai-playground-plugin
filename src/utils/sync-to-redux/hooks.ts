import { useSelector } from 'react-redux';
import SyncToReduxService from './SyncToReduxService';

/**
 * Hook to access the SyncToRedux state from Redux
 * Automatically uses the configured Redux namespace
 */
export const useSyncState = () => {
  const namespace = SyncToReduxService.getReduxNamespace();
  return useSelector((state: any) => state[namespace]?.syncToRedux);
};

/**
 * Hook to access a specific tracked map
 * @param mapName - The name of the map to access
 */
export const useTrackedMap = (mapName: string) => {
  const syncState = useSyncState();
  return syncState?.trackedMaps?.[mapName];
};

/**
 * Hook to access a specific sync object within a tracked map
 * @param mapName - The name of the map
 * @param objectKey - The key of the sync object within the map
 */
export const useSyncObject = (mapName: string, objectKey: string) => {
  const mapData = useTrackedMap(mapName);
  return mapData?.syncObjects?.[objectKey];
};
