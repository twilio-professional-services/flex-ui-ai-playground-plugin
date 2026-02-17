# Sync Helper Module

The `syncHelper.private.js` module provides reusable, low-level CRUD operations for Twilio Sync resources. It can be imported by any Twilio Serverless function that needs to interact with Sync.

All functions accept a Twilio client and Sync service SID instead of a pre-configured syncService object, keeping all REST API operations internal to the helper.

## Import

```javascript
// Import at global level for efficiency (module is cached across invocations)
const syncHelperPath = Runtime.getFunctions()['syncHelper'].path;
const {
  ensureMap,
  ensureDocument,
  ensureList,
  upsertMapItem,
  updateDocumentWithSequence,
  appendToList,
  addMetadataPointer
} = require(syncHelperPath);
```

**Note:** The key is `'syncHelper'` with NO leading slash (unlike Assets which require a leading slash).

**Best Practice:** Import at the global level (outside your handler function) for better performance. The module is loaded once at cold start and reused across warm invocations.

## API Reference

### ensureMap(client, syncServiceSid, mapName)

Ensures a Sync Map exists. Creates it if not found. Handles concurrent creation attempts.

**Parameters:**
- `client` (Object) - Twilio client instance (from `context.getTwilioClient()`)
- `syncServiceSid` (string) - Sync service SID or unique name (e.g., `'ISxxxx'` or `'default'`)
- `mapName` (string) - Unique name for the map

**Returns:** `Promise<Object>` - The map instance

**Example:**
```javascript
const client = context.getTwilioClient();
const map = await ensureMap(client, 'default', 'ai-playground-CA1234');
```

**Error Handling:**
- **404:** Map doesn't exist → Creates it
- **54301:** Map already exists (concurrent creation) → Fetches and returns it

---

### ensureDocument(client, syncServiceSid, docName, initialData)

Ensures a Sync Document exists. Creates it if not found. Returns creation status.

**Parameters:**
- `client` (Object) - Twilio client instance
- `syncServiceSid` (string) - Sync service SID or unique name
- `docName` (string) - Unique name for the document
- `initialData` (Object) - Initial data if creating (default: `{}`)

**Returns:** `Promise<Object>` - `{ resource, created: boolean }`
- `resource` - The document instance
- `created` - `true` if document was just created, `false` if it already existed

**Example:**
```javascript
const client = context.getTwilioClient();
const { resource: doc, created } = await ensureDocument(
  client,
  'default',
  'partialTranscript-CA1234',
  { inbound_track: {} }
);

if (created) {
  console.log('Document was just created');
}
```

**Error Handling:**
- **404:** Document doesn't exist → Creates it
- **54301:** Document already exists (concurrent creation) → Fetches and returns it

**Use Case:**
The `created` flag allows callers to perform one-time initialization without extra API calls:
```javascript
const { created: docCreated } = await ensureDocument(client, syncServiceSid, docName, {});
const { created: listCreated } = await ensureList(client, syncServiceSid, listName);

if (docCreated || listCreated) {
  // Only create map metadata on first initialization
  await setupMapMetadata();
}
```

---

### ensureList(client, syncServiceSid, listName)

Ensures a Sync List exists. Creates it if not found. Returns creation status.

**Parameters:**
- `client` (Object) - Twilio client instance
- `syncServiceSid` (string) - Sync service SID or unique name
- `listName` (string) - Unique name for the list

**Returns:** `Promise<Object>` - `{ resource, created: boolean }`
- `resource` - The list instance
- `created` - `true` if list was just created, `false` if it already existed

**Example:**
```javascript
const client = context.getTwilioClient();
const { resource: list, created } = await ensureList(
  client,
  'default',
  'transcriptions-CA1234'
);
```

**Error Handling:**
- **404:** List doesn't exist → Creates it
- **54301:** List already exists (concurrent creation) → Fetches and returns it

---

### upsertMapItem(client, syncServiceSid, mapName, key, data)

Creates or updates a Sync Map item.

**Parameters:**
- `client` (Object) - Twilio client instance
- `syncServiceSid` (string) - Sync service SID or unique name
- `mapName` (string) - Map unique name
- `key` (string) - Item key
- `data` (Object) - Item data (JSON)

**Returns:** `Promise<Object>` - The map item

**Example:**
```javascript
const client = context.getTwilioClient();
await upsertMapItem(
  client,
  'default',
  'ai-playground-CA1234',
  'callStatus',
  { status: 'in-progress', startTime: new Date().toISOString() }
);
```

**Behavior:**
- If item exists: Updates it
- If item doesn't exist (404): Creates it

---

### updateDocumentWithSequence(client, syncServiceSid, docName, attributeName, sequenceId, data)

Updates a Sync Document with optimistic concurrency control using etag (revision) and SequenceId to prevent race conditions.

**Parameters:**
- `client` (Object) - Twilio client instance
- `syncServiceSid` (string) - Sync service SID or unique name
- `docName` (string) - Document unique name
- `attributeName` (string) - Key within document to update (e.g., `'inbound_track'`)
- `sequenceId` (number) - Sequence ID from transcription event (for ordering)
- `data` (Object) - New data for this attribute

**Returns:** `Promise<Object>` - The updated document

**Example:**
```javascript
const client = context.getTwilioClient();
await updateDocumentWithSequence(
  client,
  'default',
  'partialTranscript-CA1234',
  'inbound_track',
  42,
  {
    text: 'Hello, how can I help you',
    timestamp: '2026-02-17T02:29:39Z',
    confidence: 0.95
  }
);
```

**Result:**
```json
{
  "inbound_track": {
    "sequenceId": 42,
    "text": "Hello, how can I help you",
    "timestamp": "2026-02-17T02:29:39Z",
    "confidence": 0.95
  }
}
```

**Race Condition Protection:**

1. **SequenceId Ordering:**
   - Fetches current document
   - Compares incoming `sequenceId` with stored `sequenceId`
   - If incoming ≤ current: Skips update (stale data)
   - If incoming > current: Proceeds with update

2. **Optimistic Locking (Etag):**
   - Uses `ifMatch: doc.revision` to ensure document hasn't changed since fetch
   - If document was modified by another request: Error 54103
   - On error 54103: Waits 500ms and retries entire operation

**Flow Diagram:**
```
1. Fetch document (get revision)
2. Check SequenceId (skip if stale)
3. Update with ifMatch: revision
   ├─ Success → Return updated doc
   └─ Error 54103 → Wait 500ms → Retry from step 1
```

**Use Case:**
Perfect for high-frequency updates where order matters (transcription events, sensor data, real-time status updates).

---

### appendToList(client, syncServiceSid, listName, data)

Appends an item to a Sync List.

**Parameters:**
- `client` (Object) - Twilio client instance
- `syncServiceSid` (string) - Sync service SID or unique name
- `listName` (string) - List unique name
- `data` (Object) - Item data (JSON)

**Returns:** `Promise<Object>` - The created list item

**Example:**
```javascript
const client = context.getTwilioClient();
await appendToList(
  client,
  'default',
  'transcriptions-CA1234',
  {
    text: 'Final transcript text',
    track: 'inbound_track',
    timestamp: '2026-02-17T02:29:39Z'
  }
);
```

**Note:** List items are ordered by insertion time. No deduplication is performed. Lists are append-only and don't need sequence ID ordering.

---

### addMetadataPointer(client, syncServiceSid, mapName, key, syncObjectType, syncObjectName)

Adds a metadata map item that points to another Sync object. Used for the SyncToRedux pattern.

**Parameters:**
- `client` (Object) - Twilio client instance
- `syncServiceSid` (string) - Sync service SID or unique name
- `mapName` (string) - Map unique name
- `key` (string) - Item key (e.g., `'partialTranscript'`)
- `syncObjectType` (string) - `'doc'`, `'list'`, or `'map'`
- `syncObjectName` (string) - Name of the target Sync object

**Returns:** `Promise<Object>` - The created map item

**Example:**
```javascript
const client = context.getTwilioClient();

await addMetadataPointer(
  client,
  'default',
  'ai-playground-CA1234',
  'partialTranscript',
  'doc',
  'partialTranscript-CA1234'
);

await addMetadataPointer(
  client,
  'default',
  'ai-playground-CA1234',
  'transcriptions',
  'list',
  'transcriptions-CA1234'
);
```

**Result in Map:**
```json
{
  "partialTranscript": {
    "syncObjectType": "doc",
    "syncObjectName": "partialTranscript-CA1234"
  },
  "transcriptions": {
    "syncObjectType": "list",
    "syncObjectName": "transcriptions-CA1234"
  }
}
```

**Use Case:**
The SyncToRedux pattern uses a Sync Map as an index. Map items point to other Sync objects (documents, lists). This allows the Flex UI to discover and subscribe to related Sync resources dynamically.

---

## Error Codes

### Twilio Sync Error Codes

- **404:** Resource not found
- **54301:** Duplicate resource - resource with this `uniqueName` already exists
- **54103:** Document revision mismatch - document was modified since fetch (etag conflict)

### Error Handling Patterns

**Ensure Pattern (Map/Document/List):**
```javascript
try {
  return await syncService.resource(name).fetch();
} catch (error) {
  if (error.status === 404) {
    try {
      return await syncService.resource.create({ uniqueName: name });
    } catch (createError) {
      if (createError.code === 54301) {
        // Another request created it concurrently
        return await syncService.resource(name).fetch();
      }
      throw createError;
    }
  }
  throw error;
}
```

**Optimistic Locking Pattern (Document Update):**
```javascript
try {
  return await syncService.documents(docName).update({
    ifMatch: doc.revision,
    data: updatedData
  });
} catch (error) {
  if (error.code === 54103) {
    // Revision mismatch - retry
    await new Promise(resolve => setTimeout(resolve, 500));
    return await updateDocumentWithSequence(...); // Retry
  }
  throw error;
}
```

---

## Common Usage Patterns

### Pattern 1: Global Import for Performance

```javascript
// At top of file (outside handler function)
const syncHelperPath = Runtime.getFunctions()['syncHelper'].path;
const { ensureDocument, appendToList } = require(syncHelperPath);

exports.handler = async (context, event, callback) => {
  const client = context.getTwilioClient();
  const syncServiceSid = context.SYNC_SERVICE_SID || 'default';

  // Use the imported functions
  await ensureDocument(client, syncServiceSid, 'myDoc', {});

  return callback(null, 'Success');
};
```

**Benefit:** Module is loaded once at cold start, not on every invocation.

### Pattern 2: One-Time Initialization

```javascript
// Initialize Sync resources only once per call
const client = context.getTwilioClient();
const { created: docCreated } = await ensureDocument(client, syncServiceSid, docName, {});
const { created: listCreated } = await ensureList(client, syncServiceSid, listName);

if (docCreated || listCreated) {
  // One-time setup (map metadata, initial state, etc.)
  await ensureMap(client, syncServiceSid, mapName);
  await addMetadataPointer(client, syncServiceSid, mapName, 'data', 'doc', docName);
}
```

**Benefit:** Avoids checking map metadata on every event (reduces API calls by ~50%).

### Pattern 3: High-Frequency Updates

```javascript
// Update document with race condition protection
const client = context.getTwilioClient();
await updateDocumentWithSequence(
  client,
  'default',
  'realtime-data-CA1234',
  'sensor1',
  event.sequenceId,
  { value: event.value, timestamp: event.timestamp }
);
```

**Benefit:** Handles concurrent updates and out-of-order events automatically.

### Pattern 4: Append-Only Log

```javascript
// Append events to list (chronological order)
const client = context.getTwilioClient();
await appendToList(
  client,
  'default',
  'call-events-CA1234',
  { event: 'hold', timestamp: new Date().toISOString() }
);
```

**Benefit:** Simple, no conflicts, preserves chronological order. No sequence ID needed.

---

## Best Practices

### 1. Use Lazy Initialization

Don't create Sync resources preemptively. Use `ensureDocument`/`ensureList` to create them on first use.

❌ **Bad:**
```javascript
// Create resources before any event arrives
await ensureDocument(client, syncServiceSid, docName, {});
await ensureList(client, syncServiceSid, listName);
// What if no events ever arrive?
```

✅ **Good:**
```javascript
// Create resources when first event arrives
if (event.type === 'transcription-content') {
  const { created } = await ensureDocument(client, syncServiceSid, docName, {});
  // Resources created only when needed
}
```

### 2. Check Creation Status to Avoid Redundant Operations

Use the `created` flag to perform one-time setup:

❌ **Bad:**
```javascript
// Check map item on every event
await ensureDocument(client, syncServiceSid, docName, {});
const syncService = client.sync.v1.services(syncServiceSid);
try {
  await syncService.syncMaps(mapName).syncMapItems('metadata').fetch();
} catch (error) {
  if (error.status === 404) {
    await addMetadataPointer(...);
  }
}
// Extra fetch on every event!
```

✅ **Good:**
```javascript
// Only add metadata when resources are created
const { created } = await ensureDocument(client, syncServiceSid, docName, {});
if (created) {
  await addMetadataPointer(client, syncServiceSid, ...);
}
// No extra fetches on subsequent events
```

### 3. Use updateDocumentWithSequence for Time-Series Data

When updates arrive rapidly and order matters:

❌ **Bad:**
```javascript
// Direct update without ordering
const syncService = client.sync.v1.services(syncServiceSid);
await syncService.documents(docName).update({
  data: { value: event.value }
});
// Race conditions! Late events overwrite newer data
```

✅ **Good:**
```javascript
// Update with SequenceId ordering
await updateDocumentWithSequence(
  client,
  syncServiceSid,
  docName,
  'channel1',
  event.sequenceId,
  { value: event.value }
);
// Stale updates automatically skipped
```

### 4. Store Related Data in Separate Tracks/Attributes

Separate data streams into different document attributes to avoid conflicts:

❌ **Bad:**
```javascript
// Single document for all tracks - conflicts on every update
await updateDocumentWithSequence(client, syncServiceSid, docName, 'data', seq, {
  inbound: inboundValue,
  outbound: outboundValue
});
```

✅ **Good:**
```javascript
// Separate attributes per track - independent updates
await updateDocumentWithSequence(client, syncServiceSid, docName, 'inbound_track', seq, inboundValue);
await updateDocumentWithSequence(client, syncServiceSid, docName, 'outbound_track', seq, outboundValue);
```

### 5. Import at Global Level

Import the syncHelper module at the global level for better performance:

❌ **Bad:**
```javascript
exports.handler = async (context, event, callback) => {
  // Imported on every invocation
  const syncHelperPath = Runtime.getFunctions()['syncHelper'].path;
  const { ensureDocument } = require(syncHelperPath);
  // ...
};
```

✅ **Good:**
```javascript
// Import once at cold start
const syncHelperPath = Runtime.getFunctions()['syncHelper'].path;
const { ensureDocument } = require(syncHelperPath);

exports.handler = async (context, event, callback) => {
  // Module already loaded
  // ...
};
```

---

## Performance Considerations

### API Call Costs

| Operation | API Calls | Notes |
|-----------|-----------|-------|
| `ensureDocument` (exists) | 1 | Fetch only |
| `ensureDocument` (create) | 2 | Fetch (404) + Create |
| `ensureDocument` (conflict) | 3 | Fetch (404) + Create (54301) + Fetch |
| `updateDocumentWithSequence` | 2-3 | Fetch + Update (+ retry on 54103) |
| `appendToList` | 1 | Create item |
| `addMetadataPointer` | 1-2 | Update item or Create item |

### Optimization Tips

1. **Batch related operations** - Create multiple metadata pointers in sequence after initialization
2. **Use `created` flag** - Avoid redundant checks on subsequent events
3. **Skip unnecessary updates** - Don't update documents if data hasn't changed
4. **Choose the right structure:**
   - High-frequency updates with ordering → Document with `updateDocumentWithSequence`
   - Append-only logs → List with `appendToList` (no sequence ID needed)
   - Metadata/config → Map with `upsertMapItem`
5. **Import at global level** - Load module once, not on every invocation

---

## API Design Notes

### Why client + syncServiceSid instead of syncService?

The helper accepts `client` and `syncServiceSid` parameters instead of a pre-configured `syncService` object:

```javascript
// OLD API (not used)
const syncService = client.sync.v1.services(syncServiceSid);
await ensureDocument(syncService, docName, {});

// NEW API (current)
await ensureDocument(client, syncServiceSid, docName, {});
```

**Benefits:**
1. **Better Encapsulation:** All Sync REST API calls are internal to the helper
2. **Cleaner Interfaces:** Functions accept simple, primitive parameters
3. **More Flexible:** Easy to switch between Sync services by passing different SIDs
4. **Service name support:** Can pass service unique name (e.g., `'default'`) or SID (e.g., `'ISxxxx'`)

---

## Future Enhancements

Potential additions to the helper:

- **Batch operations:** `appendManyToList(client, syncServiceSid, listName, items[])`
- **TTL management:** `setDocumentTTL(client, syncServiceSid, docName, ttlSeconds)`
- **Cleanup:** `deleteDocument(client, syncServiceSid, docName)`, `deleteList(client, syncServiceSid, listName)`
- **Pagination:** `readListItems(client, syncServiceSid, listName, { limit, pageToken })`
- **Conditional updates:** `updateMapItemIf(client, syncServiceSid, mapName, key, predicate, data)`

---

## Related Documentation

- `REALTIME_TRANSCRIPTION_SYNC.md` - How transcription handler uses this helper
- [Twilio Sync REST API](https://www.twilio.com/docs/sync/api) - Official Sync API reference
- `src/utils/sync-to-redux/INDEX.md` - SyncToRedux pattern documentation
