# SyncToRedux Documentation Index

Welcome to the SyncToRedux provider documentation. This is a **standalone, plugin-agnostic library** for real-time synchronization between Twilio Sync and Redux in Flex UI plugins.

## 🌟 This Is a Standalone Library

SyncToRedux can be copied into **any Flex UI plugin** without modifications. See [STANDALONE_LIBRARY.md](./STANDALONE_LIBRARY.md) for details.

## 📚 Documentation Files

### Getting Started
- **[STANDALONE_LIBRARY.md](./STANDALONE_LIBRARY.md)** - 🆕 Learn why this is standalone and how to use it in any plugin
- **[QUICKSTART.md](./QUICKSTART.md)** - Start here! Quick start guide with console examples and common patterns

### Implementation Details
- **[IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)** - Complete implementation details, architecture diagrams, and feature checklist

### API Reference
- **[README.md](./README.md)** - Full API documentation, usage patterns, and best practices

### Testing
- **[TEST_VERIFICATION.md](./TEST_VERIFICATION.md)** - Step-by-step testing checklist and troubleshooting guide

## 🚀 Quick Links

### I want to...
- **Get started quickly** → [QUICKSTART.md](./QUICKSTART.md)
- **Understand the architecture** → [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)
- **See API reference** → [README.md](./README.md)
- **Test the implementation** → [TEST_VERIFICATION.md](./TEST_VERIFICATION.md)
- **See usage examples** → [README.md#usage](./README.md#usage)

## 📁 Source Files

### Core Implementation
- **[SyncToReduxService.ts](./SyncToReduxService.ts)** - Main service (singleton pattern)
- **[types.ts](./types.ts)** - TypeScript type definitions
- **[hooks.ts](./hooks.ts)** - React hooks for components
- **[state/syncToReduxSlice.ts](./state/syncToReduxSlice.ts)** - Redux slice and actions
- **[index.ts](./index.ts)** - Barrel exports

## 🎯 Common Tasks

### Track a Sync Map
```javascript
await window.SyncToReduxService.trackSync('CAxxxx')
```
See: [QUICKSTART.md - How It Works](./QUICKSTART.md#how-it-works)

### Access Data in Components
```typescript
const callData = useSelector((state: any) =>
  state['ai-playground'].syncToRedux.trackedMaps['CAxxxx']
);
```
See: [README.md - React Component Integration](./README.md#react-component-integration)

### Debug Issues
1. Check console logs (prefix: `[SyncToRedux]`)
2. Access service: `window.SyncToReduxService`
3. Check Redux state: `Flex.Manager.getInstance().store.getState()['ai-playground'].syncToRedux`

See: [TEST_VERIFICATION.md - Troubleshooting](./TEST_VERIFICATION.md#troubleshooting)

## 🏗️ Architecture Overview

```
Sync Map (CAxxxx)
    ├── Map Item: "transcriptions" → Sync List
    └── Map Item: "ai" → Sync Document
              ↓
    SyncToReduxService
              ↓
        Redux Store
              ↓
    React Components (useSelector)
```

See: [IMPLEMENTATION_SUMMARY.md - Architecture Design](./IMPLEMENTATION_SUMMARY.md#architecture-design)

## ✅ Feature Checklist

- [x] Automatic Sync Map creation
- [x] Dynamic tracking (add/remove at runtime)
- [x] Real-time updates to Redux
- [x] Pagination support
- [x] Token refresh handling
- [x] Connection state monitoring
- [x] Proper cleanup on untrack
- [x] Browser console access for debugging
- [x] TypeScript throughout

See: [IMPLEMENTATION_SUMMARY.md - Feature Verification](./IMPLEMENTATION_SUMMARY.md#feature-verification)

## 📝 Quick Reference

### Service Methods
```typescript
SyncToReduxService.initialize()
SyncToReduxService.trackSync(mapName: string)
SyncToReduxService.untrackSync(mapName: string)
SyncToReduxService.getConnectionState()
SyncToReduxService.isTracking(mapName: string)
SyncToReduxService.getTrackedMapNames()
```

### Redux State Path
```typescript
state['ai-playground'].syncToRedux.trackedMaps[mapName]
```

### Map Metadata Format
```json
{
  "key": "transcriptions",
  "value": {
    "syncObjectType": "list",
    "syncObjectName": "transcriptions-CAxxxx"
  }
}
```

## 🆘 Need Help?

1. **Getting Started**: Read [QUICKSTART.md](./QUICKSTART.md)
2. **Understanding the Code**: Check [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)
3. **API Questions**: See [README.md](./README.md)
4. **Testing Issues**: Follow [TEST_VERIFICATION.md](./TEST_VERIFICATION.md)
5. **Console Debugging**: Use `window.SyncToReduxService` in browser console

---

**Last Updated**: 2026-02-16
**Version**: 1.0.0
**Status**: Production Ready
