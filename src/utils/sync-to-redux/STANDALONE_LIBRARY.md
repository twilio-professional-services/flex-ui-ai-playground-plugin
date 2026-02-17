# SyncToRedux - Standalone Library

SyncToRedux is a **plugin-agnostic**, standalone library for bridging Twilio Sync and Redux in Flex UI plugins.

## 🎯 Purpose

This library can be copied into **any** Flex UI plugin to enable real-time synchronization of Twilio Sync objects (Documents, Lists, Maps) into Redux state.

## 📦 What Makes It Standalone?

### 1. **Configurable Redux Namespace**
The library doesn't hardcode any plugin-specific namespaces. You provide your own:

```typescript
// In your plugin's init method
await SyncToReduxService.initialize('my-plugin-name');
```

### 2. **No External Dependencies**
Uses only what's already available in Flex UI:
- `twilio-sync` (bundled with `@twilio/flex-ui`)
- `redux` and `react-redux` (part of Flex)
- Standard React hooks

### 3. **Self-Contained**
Everything needed is in one folder:
```
src/utils/sync-to-redux/
├── SyncToReduxService.ts    # Core service
├── types.ts                  # TypeScript types
├── hooks.ts                  # React hooks
├── state/
│   └── syncToReduxSlice.ts  # Redux slice
├── index.ts                  # Exports
└── *.md                      # Documentation
```

### 4. **Plugin-Agnostic Components**
Example components use dynamic namespace resolution via hooks:

```typescript
// Instead of hardcoded namespace:
// state['some-plugin'].syncToRedux ❌

// Uses dynamic namespace:
const syncState = useSyncState(); ✅
```

## 🚀 How to Use in Any Plugin

### Step 1: Copy the Library

Copy the entire `sync-to-redux` folder into your plugin:
```bash
cp -r src/utils/sync-to-redux /path/to/your-plugin/src/utils/
```

### Step 2: Register in Your Plugin

```typescript
// YourPlugin.tsx
import * as Flex from '@twilio/flex-ui';
import { FlexPlugin } from '@twilio/flex-plugin';
import { combineReducers } from 'redux';
import SyncToReduxService from './utils/sync-to-redux/SyncToReduxService';
import { reducerHook } from './utils/sync-to-redux/state/syncToReduxSlice';

export default class YourPlugin extends FlexPlugin {
  constructor() {
    super('YourPlugin');
  }

  async init(flex: typeof Flex, manager: Flex.Manager): Promise<void> {
    // 1. Choose YOUR namespace
    const reduxNamespace = 'your-plugin-name';

    // 2. Register the reducer
    const reducers = reducerHook();
    if (manager.store && manager.store.addReducer) {
      manager.store.addReducer(reduxNamespace, combineReducers(reducers));
    }

    // 3. Initialize with YOUR namespace
    await SyncToReduxService.initialize(reduxNamespace);

    // 4. Your other initialization code...
  }
}
```

### Step 3: Use the Hooks

```typescript
import { useSyncState, useTrackedMap, useSyncObject } from './utils/sync-to-redux';

const MyComponent = () => {
  // Hooks automatically use the correct namespace
  const syncState = useSyncState();
  const callData = useTrackedMap('CAxxxx');
  const transcriptions = useSyncObject('CAxxxx', 'transcriptions');

  return <div>{/* Your UI */}</div>;
};
```

## 🔧 Configuration Options

### Initialize with Custom Namespace

```typescript
// Default namespace (if not specified): 'flex-sync'
await SyncToReduxService.initialize();

// Custom namespace (recommended)
await SyncToReduxService.initialize('my-cool-plugin');
```

### Get Current Namespace

```typescript
const namespace = SyncToReduxService.getReduxNamespace();
console.log(`Using namespace: ${namespace}`);
```

## 📚 Available Hooks

### `useSyncState()`
Get the entire SyncToRedux state:
```typescript
const syncState = useSyncState();
// Returns: { connectionState, error, trackedMaps }
```

### `useTrackedMap(mapName)`
Get a specific tracked map:
```typescript
const callData = useTrackedMap('CAxxxx');
// Returns: { mapName, mapData, syncObjects }
```

### `useSyncObject(mapName, objectKey)`
Get a specific sync object within a map:
```typescript
const transcriptions = useSyncObject('CAxxxx', 'transcriptions');
// Returns: { type: 'list', items: [...] }
```

## 🔑 Key Features

✅ **Plugin Agnostic** - No hardcoded namespaces
✅ **Self-Contained** - All code in one folder
✅ **Zero External Dependencies** - Uses Flex UI's bundled packages
✅ **TypeScript First** - Full type safety
✅ **Hook-Based** - Modern React patterns
✅ **Production Ready** - Proper cleanup, error handling, logging
✅ **Well Documented** - Comprehensive docs included

## 📖 Documentation

All documentation is plugin-agnostic:

- **[INDEX.md](./INDEX.md)** - Documentation navigation
- **[QUICKSTART.md](./QUICKSTART.md)** - Get started in 5 minutes
- **[README.md](./README.md)** - Complete API reference
- **[IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)** - Architecture details
- **[TEST_VERIFICATION.md](./TEST_VERIFICATION.md)** - Testing guide

## 🧪 Testing

```javascript
// In browser console (works with any plugin)
window.SyncToReduxService.getReduxNamespace()
// Returns: Your configured namespace

await window.SyncToReduxService.trackSync('TEST123')

const state = Flex.Manager.getInstance().store.getState()
console.log(state[window.SyncToReduxService.getReduxNamespace()])
```

## 🚢 Distribution

### To Share with Other Teams:

1. **Zip the folder:**
   ```bash
   cd src/utils
   zip -r sync-to-redux.zip sync-to-redux/
   ```

2. **Recipients unzip:**
   ```bash
   cd their-plugin/src/utils
   unzip sync-to-redux.zip
   ```

3. **Recipients follow "How to Use" steps above**

### To Publish as NPM Package:

The library could be published to NPM with minor modifications:
- Move to separate repo
- Add package.json
- Configure peer dependencies (react, redux, @twilio/flex-ui)
- Publish to npm or private registry

## 🔄 Version History

### v1.0.0 (2026-02-16)
- Initial standalone library release
- Configurable Redux namespace
- React hooks for dynamic namespace resolution
- Plugin-agnostic examples
- Full documentation

## 🆘 Support

- See [INDEX.md](./INDEX.md) for documentation navigation
- Check console logs (prefix: `[SyncToRedux]`)
- Use `window.SyncToReduxService` in browser console for debugging

---

**This library is completely standalone and can be used in any Twilio Flex UI plugin without modifications.**
