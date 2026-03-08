# TypeScript Types and Code Organization

This document covers the TypeScript type system and code organization patterns used throughout the plugin.

## Type System Architecture

### Application-Level Types (`src/types/`)

Contains types specific to the Flex plugin application:

```typescript
// src/types/reduxTypes.ts
export interface AppReduxState {
  flex?: {
    supervisor?: { workers?: unknown[] };
    worker?: { tasks?: Map<string, unknown> };
  };
  'flex-sync'?: SyncToReduxState;  // Custom sync state
  [key: string]: unknown;
}

export type AppStore = Store<AppReduxState>;
```

**Purpose:** Defines the full Redux state shape including Flex's built-in state and custom plugin state.

### Library-Level Types (`src/utils/sync-to-redux/`)

The SyncToRedux library maintains its own type definitions, separate from application concerns:

#### `reduxTypes.ts` - Library State Structure
```typescript
export interface SyncToReduxState {
  connectionState: string | null;
  error: string | null;
  trackedMaps: Record<string, TrackedMapState>;
}

export interface TrackedMapState {
  mode: 'metadata' | 'direct';
  mapData: Record<string, unknown>;
  mapItems: Record<string, unknown>;
  syncObjects: Record<string, SyncObjectState>;
}
```

**Purpose:** Defines only the state managed by the SyncToRedux library, with no application-specific knowledge.

#### `syncEventTypes.ts` - Twilio Sync Event Payloads
```typescript
export interface SyncMapItemAddedEvent<T = unknown> {
  item: SyncMapItem<T>;
  isLocal: boolean;
}

export interface SyncDocumentUpdatedEvent<T = unknown> {
  data: T;
  previousData: T;
  isLocal: boolean;
}

// ... more event types
```

**Purpose:** Strongly typed event payloads for Twilio Sync event handlers, replacing `any` types with proper interfaces.

### Component-Level Types

Each component domain has its own types file:

#### `src/components/Supervisor/types.ts`
```typescript
export interface SupervisorWorkerState {
  worker: WorkerInfo;
  tasks: ITask[];
}

export interface WorkerInfo {
  workerId: string;
  workerSid: string;
  fullName: string;
  // ...
}
```

#### `src/components/AiPlayground/types.ts`
```typescript
export interface OperatorResult {
  result: any;  // Varies by operator
  dateCreated: string;
  triggerOn: string;
  displayName: string;
  outputFormat: 'CLASSIFICATION' | 'TEXT' | 'JSON';
}
```

#### `src/components/AiPlayground/CustomerMemory/types.ts`
```typescript
export interface MemoraObservation {
  id: string;
  content: string;
  createdAt: string;
  // ...
}
```

## Code Organization Patterns

### Shared Utilities (`src/utils/`)

Common utilities used across multiple components are extracted to prevent duplication:

#### `syncMapHelpers.ts` - Sync Map Naming
```typescript
/**
 * Generate the Sync Map name for a given call SID
 */
export function getMapName(callSid: string): string {
  return `ai-playground-${callSid}`;
}
```

**Used by:**
- `src/initCallSyncTracking.ts` - Track/untrack on task lifecycle
- `src/components/Supervisor/SupervisorCallTracker.tsx` - Supervisor monitoring
- `src/components/AiPlayground/RealtimeOperatorsTab.tsx` - Operator data access
- `src/components/AiPlayground/PostCallOperatorsTab.tsx` - Operator data access
- `src/components/Supervisor/SupervisorOperatorResultsTab.tsx` - Supervisor operator view
- `src/components/RealTimeTranscription/RealTimeTranscriptionTab.tsx` - Transcription data access

**Why:** Previously duplicated in 6 locations with potential for inconsistency.

### Library Encapsulation (`src/utils/sync-to-redux/`)

The SyncToRedux library is designed as a standalone, reusable module:

#### Separation of Concerns
- **No application-specific types** in library code
- **Generic `Store<any>`** instead of `Store<AppReduxState>`
- **Event types** defined separately from business logic
- **Documentation** inside library directory (INDEX.md, README.md, QUICKSTART.md)

#### Benefits
- Library could be extracted to a separate npm package
- Clear boundaries between framework and application code
- Easier to test in isolation
- Simpler to document and maintain

## Type Safety Improvements

### Before: Excessive `any` Usage

Previous implementation had 47+ instances of `any`:

```typescript
// Before: No type safety
private store: Store<any> | null = null;
private listIndexMaps: Map<string, Map<number, any>> = new Map();

syncMap.on('itemAdded', (event: any) => {
  // No type checking
});

catch (err: any) {
  console.error(err.message);
}
```

### After: Proper Type Annotations

```typescript
// After: Strong typing
private store: Store<any> | null = null;  // Generic for library
private listIndexMaps: Map<string, Map<number, unknown>> = new Map();

syncMap.on('itemAdded', (event: SyncMapItemAddedEvent) => {
  // Type-safe access to event.item.key, event.item.data, etc.
});

catch (err: unknown) {
  const error = err instanceof Error ? err : new Error(String(err));
  console.error(error.message);
}
```

### Error Handling Pattern

Standard pattern for catch blocks:

```typescript
try {
  // Operation
} catch (err: unknown) {
  const error = err instanceof Error ? err : new Error(String(err));
  // Now have typed error with .message, .stack, etc.
  setError(error.message);
}
```

**Why:** TypeScript 4.4+ best practice is to use `unknown` in catch blocks rather than `any`.

## Import Organization

### Application Imports
```typescript
import { AppReduxState } from '../../types/reduxTypes';
import { getMapName } from '../../utils/syncMapHelpers';
```

### Library Imports
```typescript
import { SyncToReduxState } from './utils/sync-to-redux/reduxTypes';
import { SyncMapItemAddedEvent } from './utils/sync-to-redux/syncEventTypes';
import SyncToReduxService from './utils/sync-to-redux/SyncToReduxService';
```

### Component Imports
```typescript
import { SupervisorWorkerState } from './types';
import { OperatorResult } from '../AiPlayground/types';
```

## File Naming Conventions

- **Component files:** PascalCase with `.tsx` extension (`AiPlaygroundPanel.tsx`)
- **Utility files:** camelCase with `.ts` extension (`syncMapHelpers.ts`)
- **Type definition files:** camelCase ending in `Types.ts` (`reduxTypes.ts`, `syncEventTypes.ts`)
- **Barrel exports:** `index.ts` for cleaner imports

## Best Practices

### Type Exports
```typescript
// ✅ Good: Export types for reuse
export interface PublicInterface { ... }

// ✅ Good: Export type alias
export type AppStore = Store<AppReduxState>;
```

### Type Guards
```typescript
// ✅ Good: Type narrowing with guards
if (error instanceof Error) {
  console.error(error.message);
}

// ✅ Good: Custom type guard
function isCallTask(task: ITask): boolean {
  return TaskHelper.isCallTask(task) && !!task.attributes?.call_sid;
}
```

### Avoid Type Assertions
```typescript
// ❌ Avoid: Type assertion bypasses checking
const data = response as MyType;

// ✅ Better: Runtime validation
function isMyType(data: unknown): data is MyType {
  return typeof data === 'object' && data !== null && 'expectedField' in data;
}
```

## Documentation References

- Main README: [Project overview and setup](../../README.md)
- SyncToRedux Library: [src/utils/sync-to-redux/INDEX.md](../../src/utils/sync-to-redux/INDEX.md)
- AI Playground Panel: [ai-playground-panel.md](./ai-playground-panel.md)
- Supervisor Components: No dedicated doc yet, see component files
