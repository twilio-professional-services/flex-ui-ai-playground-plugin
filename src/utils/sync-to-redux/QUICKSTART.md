# SyncToRedux Quick Start Guide

## What Was Built

A complete bridge between Twilio Sync and Redux that enables real-time synchronization of Sync objects (Documents, Lists, and Maps) into your Flex UI plugin's Redux store.

### Two Tracking Modes

1. **Metadata Mode**: Map contains references to other Sync objects (docs, lists, other maps)
2. **Direct Mode**: Map contains data directly

## Quick Test (Browser Console)

Once your plugin is running in Flex UI:

```javascript
// 1. Verify service is loaded
window.SyncToReduxService

// 2. Track a test Sync Map (auto-detects mode)
await window.SyncToReduxService.trackSync('TEST123')

// Or specify mode explicitly:
await window.SyncToReduxService.trackSync('TEST123', 'metadata')  // metadata mode
await window.SyncToReduxService.trackSync('settings', 'direct')    // direct mode

// 3. Check Redux state
const namespace = window.SyncToReduxService.getReduxNamespace()
const state = Flex.Manager.getInstance().store.getState()
console.log(state[namespace].syncToRedux)

// 4. See tracked maps
window.SyncToReduxService.getTrackedMapNames()
// Returns: ['TEST123']

// 5. Check connection
window.SyncToReduxService.getConnectionState()
// Returns: 'connected'

// 6. Clean up
await window.SyncToReduxService.untrackSync('TEST123')
```

## How It Works

### Mode 1: Metadata Pattern

Create a Sync Map that acts as metadata for other Sync objects:

**Map Name:** `CAxxxx` (e.g., call SID)

**Map Items:**
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

> **Note:** Referenced maps (like `call-settings-CAxxxx`) are tracked in direct mode - their items become simple key-value data, not more metadata references.

### Mode 2: Direct Data

Track a Sync Map's data directly:

**Map Name:** `user-settings`

**Map Items:**
```json
{
  "theme": "dark",
  "language": "en",
  "notifications": true,
  "volume": 80
}
```

### 2. Track the Map

```typescript
await SyncToReduxService.trackSync('CAxxxx')
```

This automatically:
- Opens/creates the Sync Map
- Reads all map items
- Opens each referenced Sync object (doc/list)
- Adds event listeners for real-time updates
- Syncs everything to Redux

### 3. Access in React Components

```typescript
import { useTrackedMap, useSyncObject } from './utils/sync-to-redux';

const MyComponent = () => {
  const callData = useTrackedMap('CAxxxx');
  const transcriptions = useSyncObject('CAxxxx', 'transcriptions');

  return (
    <div>
      <h3>Transcriptions: {transcriptions?.items?.length || 0}</h3>
      {transcriptions?.items?.map((t, i) => (
        <p key={i}>{t.text}</p>
      ))}
    </div>
  );
};
```

### 4. Cleanup

```typescript
await SyncToReduxService.untrackSync('CAxxxx')
```

## Create Test Data via Twilio CLI

```bash
# Create a Sync Map
twilio api:sync:v1:services:sync-maps:create \
  --service-sid YOUR_SYNC_SERVICE_SID \
  --unique-name TEST123

# Add a document reference
twilio api:sync:v1:services:sync-maps:sync-map-items:create \
  --service-sid YOUR_SYNC_SERVICE_SID \
  --map-sid TEST123 \
  --key "myDoc" \
  --data '{"syncObjectType":"doc","syncObjectName":"test-document"}'

# Add a list reference
twilio api:sync:v1:services:sync-maps:sync-map-items:create \
  --service-sid YOUR_SYNC_SERVICE_SID \
  --map-sid TEST123 \
  --key "myList" \
  --data '{"syncObjectType":"list","syncObjectName":"test-list"}'
```

## Using in Your Components

### Metadata Mode Component
```typescript
import { useSyncState, useTrackedMap } from './utils/sync-to-redux';

const CallDataComponent = () => {
  const syncState = useSyncState();
  const callData = useTrackedMap('CAxxxx');

  return (
    <div>
      <h3>Connection: {syncState?.connectionState}</h3>
      {callData && callData.mode === 'metadata' && (
        <div>
          <h4>Transcriptions:</h4>
          {callData.syncObjects.transcriptions?.items?.map((item, i) => (
            <p key={i}>{item.text}</p>
          ))}
        </div>
      )}
    </div>
  );
};
```

### Direct Mode Component
```typescript
import { useTrackedMap } from './utils/sync-to-redux';

const SettingsComponent = () => {
  const settings = useTrackedMap('user-settings');

  return (
    <div>
      {settings && settings.mode === 'direct' && (
        <div>
          <p>Theme: {settings.mapItems.theme}</p>
          <p>Language: {settings.mapItems.language}</p>
          <p>Volume: {settings.mapItems.volume}</p>
        </div>
      )}
    </div>
  );
};
```

## Redux State Structure

### Metadata Mode Example
```javascript
{
  'your-plugin-namespace': {
    syncToRedux: {
      connectionState: 'connected',
      error: null,
      trackedMaps: {
        'CAxxxx': {
          mapName: 'CAxxxx',
          mode: 'metadata',
          mapData: {
            transcriptions: {
              syncObjectType: 'list',
              syncObjectName: 'transcriptions-CAxxxx'
            }
          },
          mapItems: {},  // Empty in metadata mode
          syncObjects: {
            transcriptions: {
              type: 'list',
              items: [
                { speaker: 'Agent', text: 'Hello, how can I help?', timestamp: '...' },
                { speaker: 'Customer', text: 'I need help with...', timestamp: '...' }
              ]
            }
          }
        }
      }
    }
  }
}
```

### Direct Mode Example
```javascript
{
  'your-plugin-namespace': {
    syncToRedux: {
      connectionState: 'connected',
      error: null,
      trackedMaps: {
        'user-settings': {
          mapName: 'user-settings',
          mode: 'direct',
          mapData: {},  // Empty in direct mode
          mapItems: {
            theme: 'dark',
            language: 'en',
            notifications: true,
            volume: 80
          },
          syncObjects: {}  // Empty in direct mode
        }
      }
    }
  }
}
```

## Files Included

```
src/utils/sync-to-redux/
├── types.ts                    # TypeScript types
├── SyncToReduxService.ts       # Core service (singleton)
├── hooks.ts                    # React hooks
├── state/
│   └── syncToReduxSlice.ts     # Redux slice
├── index.ts                    # Barrel exports
└── *.md                        # Documentation
```

## Key Features

✅ **Two Tracking Modes** - Metadata mode (references) and Direct mode (data)
✅ **Auto-Detection** - Automatically detects mode based on map content
✅ **Automatic Sync Map creation** - Creates maps if they don't exist
✅ **Dynamic tracking** - Add/remove at runtime
✅ **Real-time updates** - All changes sync automatically to Redux
✅ **Supports all Sync types** - Documents, Lists, and Maps
✅ **Pagination for large datasets** - Efficient handling of large maps/lists
✅ **Token refresh handling** - Automatic token updates
✅ **Connection state monitoring** - Track connection status
✅ **Proper cleanup** - No memory leaks on untrack
✅ **Browser console access** - Debug via window.SyncToReduxService
✅ **TypeScript throughout** - Full type safety

## Next Steps

1. **Review the full docs:** `src/utils/sync-to-redux/README.md`
2. **Read implementation details:** `IMPLEMENTATION_SUMMARY.md`
3. **See testing guide:** `TEST_VERIFICATION.md`
4. **Build your own components using the hooks**

## Common Patterns

### Track on Task Accept
```typescript
manager.workerClient.on('reservationAccepted', async (reservation) => {
  const callSid = reservation.task.attributes.call_sid;
  await SyncToReduxService.trackSync(callSid);
});
```

### Untrack on Task Complete
```typescript
manager.workerClient.on('reservationWrapup', async (reservation) => {
  const callSid = reservation.task.attributes.call_sid;
  await SyncToReduxService.untrackSync(callSid);
});
```

### Conditional Rendering
```typescript
import { useTrackedMap } from './utils/sync-to-redux';

const MyComponent = () => {
  const callData = useTrackedMap('CAxxxx');

  if (!callData) return <Loading />;
  return <DataDisplay data={callData} />;
};
```

## Troubleshooting

**Q: "Service not initialized" error?**
A: The service initializes on plugin load. Check console for initialization errors.

**Q: Redux state is undefined?**
A: Make sure the reducer is registered in `AiPlaygroundPlugin.tsx`.

**Q: Sync objects not appearing?**
A: Check map metadata format. Items must have `syncObjectType` and `syncObjectName`.

**Q: How to debug?**
A: Use `window.SyncToReduxService` in browser console and check logs prefixed with `[SyncToRedux]`.

## Support

For detailed information, see:
- Full docs: `src/utils/sync-to-redux/README.md`
- Implementation summary: `IMPLEMENTATION_SUMMARY.md`
- Console logs: Look for `[SyncToRedux]` prefix
