# SyncToRedux Provider

A generic, standalone provider for bridging Twilio Sync and Redux state management in Flex UI plugins.

## Overview

The SyncToRedux provider enables real-time synchronization of Twilio Sync objects (Documents, Lists, Maps) into Redux state, making them easily accessible to React components through standard Redux patterns.

**This is a standalone library** that can be integrated into any Flex UI plugin.

### Supported Sync Objects

- **Documents** - Single JSON objects
- **Lists** - Ordered collections of items
- **Maps** - Key-value stores (two tracking modes available)
  - Maps can reference other maps (one level only - referenced maps are always direct mode)

## Features

- **Automatic Sync Management**: Handles Sync client initialization, token refresh, and connection state
- **Dynamic Tracking**: Add/remove Sync objects at runtime
- **Hierarchical Structure**: Track a Sync Map that references other Sync objects (Documents and Lists)
- **Real-time Updates**: All changes sync automatically to Redux
- **Pagination Support**: Handles large maps and lists efficiently
- **Cleanup Management**: Proper event listener cleanup when untracking
- **Plugin Agnostic**: Can be used in any Flex plugin with configurable Redux namespace

## Architecture

The provider supports two modes for tracking Sync Maps:

### 1. Metadata Mode (Default)
The **Sync Map as metadata** pattern:
- Track a Sync Map (e.g., "CAxxxx" for a call)
- Map items describe other Sync objects to track
- Each map item has: `{ syncObjectType: "list" | "doc" | "map", syncObjectName: "actual-name" }`
- Referenced objects automatically sync to Redux

### 2. Direct Mode
Track a Sync Map's data directly:
- Map items are synced to Redux as-is
- No automatic opening of referenced objects
- Useful for maps that contain actual data rather than metadata

### Example: Metadata Mode Map

Map name: `CAxxxx`
```json
{
  "transcriptions": {
    "syncObjectType": "list",
    "syncObjectName": "transcriptions-CAxxxx"
  },
  "ai": {
    "syncObjectType": "doc",
    "syncObjectName": "ai-CAxxxx"
  },
  "settings": {
    "syncObjectType": "map",
    "syncObjectName": "call-settings-CAxxxx"
  }
}
```

Note: Referenced maps (like `call-settings-CAxxxx`) are automatically tracked in direct mode (their items become key-value data, not more metadata).

### Example: Direct Mode Map

Map name: `user-settings`
```json
{
  "theme": "dark",
  "language": "en",
  "notifications": true,
  "volume": 80
}
```

## Installation

No additional dependencies required! The service uses the `twilio-sync` library that's already bundled with `@twilio/flex-ui`.

### Integration Steps

1. **Copy the sync-to-redux folder** to your Flex plugin:
   ```
   src/utils/sync-to-redux/
   ```

2. **Register the Redux reducer** in your plugin's init method:
   ```typescript
   import { combineReducers } from 'redux';
   import SyncToReduxService from './utils/sync-to-redux/SyncToReduxService';
   import { reducerHook } from './utils/sync-to-redux/state/syncToReduxSlice';

   async init(flex: typeof Flex, manager: Flex.Manager): Promise<void> {
     // Choose your Redux namespace
     const reduxNamespace = 'your-plugin-name';
     const reducers = reducerHook();

     if (manager.store && manager.store.addReducer) {
       manager.store.addReducer(reduxNamespace, combineReducers(reducers));
     }

     // Initialize service with your namespace
     await SyncToReduxService.initialize(reduxNamespace);
   }
   ```

3. **Use in your components** (see Usage section below)

## Usage

### Basic Usage

```typescript
import SyncToReduxService from './utils/sync-to-redux/SyncToReduxService';

// Track a map (auto-detects mode)
await SyncToReduxService.trackSync('CAxxxx');

// Track in metadata mode (explicit)
await SyncToReduxService.trackSync('CAxxxx', 'metadata');

// Track in direct mode (explicit)
await SyncToReduxService.trackSync('user-settings', 'direct');

// Stop tracking
await SyncToReduxService.untrackSync('CAxxxx');
```

### React Component Integration

#### Using Metadata Mode Data
```typescript
import { useSyncState, useTrackedMap, useSyncObject } from './utils/sync-to-redux';

const CallDataComponent = () => {
  const syncState = useSyncState();
  const callData = useTrackedMap('CAxxxx');

  // Access specific sync objects (for metadata mode)
  const transcriptions = useSyncObject('CAxxxx', 'transcriptions');
  const aiData = useSyncObject('CAxxxx', 'ai');

  return (
    <div>
      <h3>Connection: {syncState?.connectionState}</h3>
      {callData?.mode === 'metadata' && (
        <div>
          <h4>Transcriptions ({transcriptions?.items?.length || 0})</h4>
          {transcriptions?.items?.map((item, i) => (
            <p key={i}>{item.text}</p>
          ))}

          <h4>AI Analysis</h4>
          <pre>{JSON.stringify(aiData?.data, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};
```

#### Using Direct Mode Data
```typescript
import { useTrackedMap } from './utils/sync-to-redux';

const SettingsComponent = () => {
  const settings = useTrackedMap('user-settings');

  return (
    <div>
      {settings?.mode === 'direct' && (
        <div>
          <p>Theme: {settings.mapItems.theme}</p>
          <p>Language: {settings.mapItems.language}</p>
          <p>Notifications: {settings.mapItems.notifications ? 'On' : 'Off'}</p>
          <p>Volume: {settings.mapItems.volume}</p>
        </div>
      )}
    </div>
  );
};
```

### Generic Selector Hook

Create a reusable selector:

```typescript
import { useSelector } from 'react-redux';
import SyncToReduxService from './utils/sync-to-redux/SyncToReduxService';

export const useSyncState = () => {
  const namespace = SyncToReduxService.getReduxNamespace();
  return useSelector((state: any) => state[namespace]?.syncToRedux);
};

// Usage
const MyComponent = () => {
  const syncState = useSyncState();
  const callData = syncState?.trackedMaps?.['CAxxxx'];
  // ...
};
```

## Redux State Structure

### Metadata Mode Map
```typescript
{
  [yourNamespace]: {
    syncToRedux: {
      connectionState: 'connected',
      error: null,
      trackedMaps: {
        'CAxxxx': {
          mapName: 'CAxxxx',
          mode: 'metadata',
          mapData: {
            'transcriptions': {
              syncObjectType: 'list',
              syncObjectName: 'transcriptions-CAxxxx'
            }
          },
          mapItems: {},  // Empty in metadata mode
          syncObjects: {
            'transcriptions': {
              type: 'list',
              items: [/* list items */]
            }
          }
        }
      }
    }
  }
}
```

### Direct Mode Map
```typescript
{
  [yourNamespace]: {
    syncToRedux: {
      connectionState: 'connected',
      error: null,
      trackedMaps: {
        'user-settings': {
          mapName: 'user-settings',
          mode: 'direct',
          mapData: {},  // Empty in direct mode
          mapItems: {
            'theme': 'dark',
            'language': 'en',
            'notifications': true
          },
          syncObjects: {}  // Empty in direct mode
        }
      }
    }
  }
}
```

## API Reference

### `initialize(reduxNamespace?: string): Promise<void>`

Initialize the service. Must be called before any other methods.

**Parameters:**
- `reduxNamespace` (optional): Redux namespace where the reducer is registered. Defaults to `'flex-sync'`

**Example:**
```typescript
await SyncToReduxService.initialize('my-plugin');
```

### `trackSync(mapName: string, mode?: 'metadata' | 'direct'): Promise<void>`

Start tracking a Sync Map.

**Parameters:**
- `mapName`: The name/SID of the Sync Map
- `mode` (optional): Tracking mode
  - `'metadata'` - Map contains references to other sync objects
  - `'direct'` - Map contains data directly
  - If not specified, auto-detects based on map items

**Behavior:**
- Creates the map if it doesn't exist
- Reads all existing map items
- In metadata mode: Opens and tracks referenced Sync objects
- In direct mode: Syncs map items directly to Redux
- Listens for map updates (new items, removed items)

**Examples:**
```typescript
// Auto-detect mode
await SyncToReduxService.trackSync('CAxxxx');

// Explicit metadata mode
await SyncToReduxService.trackSync('CAxxxx', 'metadata');

// Explicit direct mode
await SyncToReduxService.trackSync('user-settings', 'direct');
```

### `untrackSync(mapName: string): Promise<void>`

Stop tracking a Sync Map and cleanup all resources.

- Removes all event listeners
- Closes all Sync objects
- Updates Redux state

**Example:**
```typescript
await SyncToReduxService.untrackSync('CAxxxx');
```

### `getConnectionState(): string | null`

Get the current Sync client connection state.

**Returns:** `'connected' | 'connecting' | 'disconnected' | 'error' | null`

### `isTracking(mapName: string): boolean`

Check if a specific map is being tracked.

### `getTrackedMapNames(): string[]`

Get an array of all currently tracked map names.

### `getReduxNamespace(): string`

Get the configured Redux namespace.

**Returns:** The namespace string (e.g., `'my-plugin'`)

## Console Access

The service is exposed on the window object for debugging:

```javascript
// In browser console
window.SyncToReduxService.trackSync('TEST123')
window.SyncToReduxService.getTrackedMapNames()
window.SyncToReduxService.getReduxNamespace()
window.SyncToReduxService.untrackSync('TEST123')
```

## Token Management

The service automatically handles token refresh:
- Uses the Flex Manager's JWT token
- Listens for 'tokenUpdated' events
- Updates Sync client when token refreshes

## Event Flow

1. `trackSync()` called with map name
2. Service opens/creates Sync Map
3. Redux state updated with new tracked map
4. All map items read (with pagination)
5. Each referenced Sync object opened and tracked
6. Event listeners added to map and all objects
7. Real-time updates flow to Redux
8. `untrackSync()` cleans up all listeners and closes objects

## Error Handling

Errors are logged to console and stored in Redux state:

```typescript
const namespace = SyncToReduxService.getReduxNamespace();
const { error } = useSelector((state: any) =>
  state[namespace]?.syncToRedux
);

if (error) {
  console.error('Sync error:', error);
}
```

## Best Practices

1. **Initialize once**: Call `initialize()` in your plugin's init method
2. **Provide namespace**: Always pass your plugin's Redux namespace to `initialize()`
3. **Track maps for logical units**: Use map names that represent logical groupings
4. **Cleanup when done**: Always call `untrackSync()` when data is no longer needed
5. **Check connection state**: Monitor `connectionState` before attempting operations
6. **Handle errors**: Check the `error` field in Redux state
7. **Use selectors**: Create Redux selectors for commonly accessed data
8. **Use selector hooks**: Create reusable hooks that get the namespace automatically

## Configuration Example

Complete integration example:

```typescript
// YourPlugin.tsx
import * as Flex from '@twilio/flex-ui';
import { FlexPlugin } from '@twilio/flex-plugin';
import { combineReducers } from 'redux';
import SyncToReduxService from './utils/sync-to-redux/SyncToReduxService';
import { reducerHook } from './utils/sync-to-redux/state/syncToReduxSlice';

export default class YourPlugin extends FlexPlugin {
  async init(flex: typeof Flex, manager: Flex.Manager): Promise<void> {
    // 1. Register Redux reducer
    const reduxNamespace = 'your-plugin';
    const reducers = reducerHook();

    if (manager.store && manager.store.addReducer) {
      manager.store.addReducer(reduxNamespace, combineReducers(reducers));
    }

    // 2. Initialize SyncToRedux service
    await SyncToReduxService.initialize(reduxNamespace);

    // 3. Your other plugin code...
  }
}
```

## Limitations

- Streams not supported (only Documents, Lists, and Maps)
- Map items in metadata mode must follow the metadata schema: `{ syncObjectType, syncObjectName }`
- Referenced maps are always tracked in direct mode (no recursive metadata nesting)
- Large datasets may impact performance (pagination is used but initial load can be slow)

## Future Enhancements

- Support for Sync Streams
- Retry logic and exponential backoff
- Metrics and monitoring hooks
- Unit tests with mock Sync client
- TypeScript strict mode compliance
- Selective field syncing for large documents

## See Also

- [QUICKSTART.md](./QUICKSTART.md) - Quick start guide
- [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) - Architecture details
- [TEST_VERIFICATION.md](./TEST_VERIFICATION.md) - Testing guide
- [INDEX.md](./INDEX.md) - Documentation index
