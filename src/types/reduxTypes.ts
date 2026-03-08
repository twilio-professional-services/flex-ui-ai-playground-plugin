import { Store } from 'redux';
import { SyncToReduxState } from '../utils/sync-to-redux/reduxTypes';

/**
 * Full application Redux state (Flex + custom)
 */
export interface AppReduxState {
  /** Flex UI state */
  flex?: {
    supervisor?: {
      workers?: unknown[];
    };
    worker?: {
      tasks?: Map<string, unknown>;
    };
    [key: string]: unknown;
  };
  /** Custom sync-to-redux state (default namespace: 'flex-sync') */
  'flex-sync'?: SyncToReduxState;
  [key: string]: unknown;
}

/**
 * Typed Redux store for the application
 */
export type AppStore = Store<AppReduxState>;
