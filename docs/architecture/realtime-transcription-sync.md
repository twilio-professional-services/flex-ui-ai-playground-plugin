# Real-Time Transcription Sync Integration

This document describes how the real-time transcription webhook handler integrates with Twilio Sync to store and expose transcription data.

## Overview

The `handleRealtimeTranscription.protected.js` function receives transcription events from Twilio and delegates Sync operations to `realtimeTranscriptionSyncHelper.private.js`, which writes transcription data to Twilio Sync for real-time access by the Flex UI and post-call analysis.

## Architecture

```
handleRealtimeTranscription.protected.js
  ├─ Receives webhook events from Twilio
  ├─ Handles logging (basic or detailed)
  └─ Delegates to syncHelper (imported at global level)
       ↓
realtimeTranscriptionSyncHelper.private.js
  ├─ Manages Sync resource creation
  ├─ Routes events to appropriate handlers
  └─ Uses syncHelper utilities
       ↓
syncHelper.private.js
  ├─ Low-level Sync CRUD operations
  └─ All REST API calls happen here
       ↓
client.sync.v1.services(syncServiceSid)
```

## Sync Structure

For each call, three Sync resources are created conditionally based on configuration:

### 1. Sync Map: `ai-playground-{CallSid}`

The map serves as a metadata index that points to the document and list.

**Map Items:**
- **Key:** `partialTranscript`
  - **Value:** `{ syncObjectType: "doc", syncObjectName: "partialTranscript-{CallSid}" }`
  - **Note:** Only created if `REALTIME_TRANSCRIPTION_PARTIAL_RESULTS=true`
- **Key:** `transcriptions`
  - **Value:** `{ syncObjectType: "list", syncObjectName: "transcriptions-{CallSid}" }`

This structure follows the SyncToRedux pattern used by Flex plugins.

### 2. Sync Document: `partialTranscript-{CallSid}`

Stores the **current** partial (interim) transcript for the **inbound track only** (customer speech).

**Note:** This document is **only created if `REALTIME_TRANSCRIPTION_PARTIAL_RESULTS=true`**. If partial results are disabled, only the list is created.

**Structure:**
```json
{
  "inbound_track": {
    "sequenceId": 42,
    "text": "Hello I need help with my order",
    "timestamp": "2026-02-17T02:29:39.026605605Z",
    "confidence": 0.83721834,
    "stability": 0.85,
    "languageCode": "en-US",
    "isFinal": false,
    "transcriptionSid": "GTa92ddf2576534cbe923ebb5c057ce814"
  }
}
```

**Behavior:**
- **Partial transcripts** (Final=false): Updates the document with the latest interim text (only if `REALTIME_TRANSCRIPTION_PARTIAL_RESULTS=true`)
- **Final transcripts** (Final=true): Clears the text (`text: ""`) for that track (only if document exists)
- **Transcription stopped**: Adds `cleared: true` and `clearedAt` timestamp (only if document exists)

**Why only inbound track?**
- Most use cases only need to display customer speech in real-time
- Reduces Sync API calls by ~50%
- Agent speech is still captured in the final transcripts list

**Why sequence ID in documents?**
- Documents are updated in place and events can arrive out of order
- SequenceId ensures older transcripts don't overwrite newer ones
- The `updateDocumentWithSequence` function checks sequence before updating

### 3. Sync List: `transcriptions-{CallSid}`

Stores **all final transcripts** from **both tracks** in chronological order.

**List Item Structure:**
```json
{
  "text": "Transcription event.",
  "timestamp": "2026-02-17T02:29:39.026605605Z",
  "confidence": 0.83721834,
  "stability": 0.92,
  "languageCode": "en-US",
  "isFinal": true,
  "transcriptionSid": "GTa92ddf2576534cbe923ebb5c057ce814",
  "track": "inbound_track"
}
```

**Special Item (transcription-stopped):**
```json
{
  "event": "transcription-stopped",
  "timestamp": "2026-02-17T02:29:39.026605605Z",
  "callSid": "CAee99c7f1ab4725cc5429ba12ac5e9a98"
}
```

**Why no sequence ID in lists?**
- Lists are append-only and naturally ordered by insertion time
- Timestamp provides chronological reference
- No risk of out-of-order overwrites

## Event Flow

### Transcription Content Events

```
Webhook Event:
  TranscriptionEvent: "transcription-content"
  TranscriptionData: {"transcript": "...", "confidence": 0.83}
  Final: false
  Stability: 0.85
  Track: "inbound_track"
  SequenceId: 7

↓

if Final === false:
  1. Check REALTIME_TRANSCRIPTION_PARTIAL_RESULTS flag
     if not enabled:
       ✗ Skip (partial results disabled)

  2. Check Stability threshold
     if Stability < PARTIAL_STABLE_THRESHOLD (default 0.7):
       ✗ Skip (too unstable, likely to change)

  3. Check Track
     if Track === "inbound_track":
       ✓ Update Sync Document with partial transcript
       ✓ Use optimistic locking (etag + SequenceId)

     if Track === "outbound_track":
       ✗ Skip (outbound partials not stored)

if Final === true:
  ✓ Append to Sync List (all tracks, timestamp only)
  ✓ Clear partial transcript in Document (inbound only, if doc exists)
```

### Transcription Stopped Event

```
Webhook Event:
  TranscriptionEvent: "transcription-stopped"
  SequenceId: 7

↓

1. Append "ended" marker to Sync List (timestamp only)
2. Clear inbound_track in Sync Document (if doc exists)
   with cleared=true flag
```

## Race Condition Protection

Transcription events arrive rapidly (1-2 per second) and can arrive out of order. The implementation uses two mechanisms to prevent conflicts in **documents only** (lists don't need this):

### 1. SequenceId Ordering (Documents Only)

Each event has a `SequenceId` that increments with each utterance. Before updating the document:

```javascript
// Check if we already have a newer SequenceId - skip if stale
if (currentSequenceId >= incomingSequenceId) {
  console.log('Skipping stale update');
  return;
}
```

This prevents older transcripts from overwriting newer ones.

### 2. Optimistic Locking with Etag/Revision (Documents Only)

When updating the document, the handler uses `ifMatch` with the document's revision:

```javascript
await syncService.documents(docName).update({
  ifMatch: doc.revision,  // Only update if revision matches
  data: updatedData
});
```

**On conflict (error 54103):**
- Wait 500ms
- Retry the entire operation (fetch + check SequenceId + update)

This ensures concurrent updates don't conflict and data integrity is maintained.

**Lists don't need race condition protection** because they're append-only - items are never updated, only added.

## Twilio Event Payload

The webhook receives events with this structure:

```
AccountSid: ACa072b2ab1dacdd0d9dc49ffa1ac0dcbc
CallSid: CAee99c7f1ab4725cc5429ba12ac5e9a98
Final: true
LanguageCode: en-US
SequenceId: 7
Stability: 0.85 (only present for partial results, range: 0.0 - 1.0)
Timestamp: 2026-02-17T02:29:39.026605605Z
Track: inbound_track | outbound_track
TranscriptionData: {"transcript":"...", "confidence":0.83721834}
TranscriptionEvent: transcription-content | transcription-stopped
TranscriptionSid: GTa92ddf2576534cbe923ebb5c057ce814
```

**Note:** `TranscriptionData` is a JSON string that must be parsed to extract `transcript` and `confidence`.

**Stability Field:**
- Only present for partial transcripts (Final=false)
- Range: 0.0 (very unstable) to 1.0 (very stable)
- Indicates how likely the transcript is to change with more audio input
- Used to filter out very unstable partials that would cause UI flicker

## Resource Initialization

Sync resources are created **lazily and conditionally** on the first transcription event:

```javascript
// Determine which resources are needed based on event type and flags
const isFinal = event.Final === "true" || event.Final === true;
const partialResultsEnabled =
  context.REALTIME_TRANSCRIPTION_PARTIAL_RESULTS?.toLowerCase() === "true";

if (isTranscriptionContent && !isFinal && partialResultsEnabled) {
  // Partial transcript: only need document (and only if partial results enabled)
  const result = await ensureDocument(client, syncServiceSid, partialDocName, {});
  docCreated = result.created;
} else if (isTranscriptionContent && isFinal) {
  // Final transcript: only need list
  const result = await ensureList(client, syncServiceSid, transcriptionsListName);
  listCreated = result.created;
} else if (isTranscriptionStopped) {
  // Transcription stopped: need list, and document only if partial results were enabled
  const listResult = await ensureList(client, syncServiceSid, transcriptionsListName);
  listCreated = listResult.created;

  if (partialResultsEnabled) {
    const docResult = await ensureDocument(client, syncServiceSid, partialDocName, {});
    docCreated = docResult.created;
  }
}

// Only create map and metadata if resources were just created
if (docCreated || listCreated) {
  await ensureMap(client, syncServiceSid, mapName);

  if (docCreated) {
    await addMetadataPointer(client, syncServiceSid, mapName, 'partialTranscript', 'doc', partialDocName);
  }

  if (listCreated) {
    await addMetadataPointer(client, syncServiceSid, mapName, 'transcriptions', 'list', transcriptionsListName);
  }
}
```

**Why lazy and conditional initialization?**
- Avoids unnecessary Sync API calls
- Only creates resources that will actually be used
- Map metadata only created once per call
- Subsequent events skip map operations entirely
- If partial results disabled, document never created

## Configuration

### Environment Variables

```bash
# .env
SYNC_SERVICE_SID=ISdc3898a58c57bea7f6a055a3feae813c
PARTIAL_STABLE_THRESHOLD=0.7
REALTIME_TRANSCRIPTION_PARTIAL_RESULTS=true
DETAILED_TRANSCRIPTION_LOGGING=false
```

**SYNC_SERVICE_SID:**
- Twilio Sync service to use for storing transcriptions
- Default: `'default'` (Flex built-in Sync service)
- For custom services, use the SID starting with `IS`
- Can also use service unique name

**PARTIAL_STABLE_THRESHOLD:**
- Stability threshold for partial transcripts (0.0 - 1.0)
- Only writes partial transcripts to Sync if `Stability >= threshold`
- Default: `0.7` (70% stability)
- Lower values = more frequent updates with less stable text
- Higher values = fewer updates with more stable text
- Recommended: `0.7` for balance between responsiveness and stability

**REALTIME_TRANSCRIPTION_PARTIAL_RESULTS:**
- Controls whether partial transcript document is created and updated
- `true`: Creates document and writes partial transcripts
- `false`: Skips document creation, only creates list for final transcripts
- Default: `false`
- **Important:** This is the primary flag that controls document usage

**DETAILED_TRANSCRIPTION_LOGGING:**
- Controls logging verbosity in handleRealtimeTranscription
- `true`: Logs complete event payload and all extracted fields
- `false`: Only logs basic event info (event type + CallSID)
- Default: `false`
- Errors always logged regardless of this setting

## Error Handling

All Sync operations are wrapped in a try-catch that logs errors but **always returns 200 OK** to Twilio:

```javascript
try {
  // Sync operations
} catch (syncError) {
  console.error('Sync error:', syncError);
  // Don't fail the webhook - return 200 OK to keep receiving events
}
```

This ensures transcription continues even if Sync operations fail.

## Performance Characteristics

**Per Call:**
- First event (partial, if enabled): 3 API calls (create doc, create map, add map item)
- First event (final): 3 API calls (create list, create map, add map item)
- Subsequent partials (inbound, stable, enabled): 2 API calls (fetch doc, update doc)
- Subsequent partials (inbound, unstable): 0 API calls (skipped via stability threshold)
- Subsequent partials (outbound): 0 API calls (skipped)
- Subsequent partials (disabled): 0 API calls (skipped)
- Final transcripts: 1 API call (append to list), optionally +2 if clearing doc

**Typical Call (5 minutes) with Partial Results Enabled:**
- ~150 inbound partial events (50% below stability threshold) → 150 API calls
- ~150 outbound partial events → 0 API calls (skipped)
- ~20 final transcripts → 20 API calls
- **Total:** ~175 API calls

**Typical Call (5 minutes) with Partial Results Disabled:**
- ~150 inbound partial events → 0 API calls (skipped)
- ~150 outbound partial events → 0 API calls (skipped)
- ~20 final transcripts → 20 API calls
- **Total:** ~20 API calls (89% reduction)

**Without optimizations:**
- No track filtering + no stability filtering + no flag check: ~600 API calls
- Track filtering only: ~345 API calls
- All optimizations + partial disabled: ~20 API calls (97% reduction)

**Stability Threshold Impact (when partials enabled):**
- Threshold 0.5: ~120 updates per minute (more responsive, more API calls)
- Threshold 0.7 (default): ~50 updates per minute (balanced)
- Threshold 0.9: ~20 updates per minute (very stable, fewer API calls)

## Accessing the Data

### From Flex UI (using SyncToRedux)

```javascript
// Subscribe to partial transcripts (only available if partial results enabled)
const partialTranscript = useSelector(state =>
  state.sync.aiPlayground[callSid]?.partialTranscript?.inbound_track
);

// Subscribe to final transcripts (always available)
const transcriptions = useSelector(state =>
  state.sync.aiPlayground[callSid]?.transcriptions
);
```

### From Twilio CLI

```bash
# Fetch document (only exists if partial results enabled)
twilio api:sync:v1:services:documents:fetch \
  --service-sid=ISdc3898a58c57bea7f6a055a3feae813c \
  --sid=partialTranscript-CAxxxx

# List final transcripts (always available)
twilio api:sync:v1:services:sync-lists:sync-list-items:list \
  --service-sid=ISdc3898a58c57bea7f6a055a3feae813c \
  --sync-list-sid=transcriptions-CAxxxx
```

## Related Files

- `functions/handleRealtimeTranscription.protected.js` - Main webhook handler (receives events, handles logging)
- `functions/realtimeTranscriptionSyncHelper.private.js` - Sync integration logic (routes events, manages resources)
- `functions/syncHelper.private.js` - Reusable Sync CRUD operations (all REST API calls)
- [sync-helper.md](sync-helper.md) - Documentation for syncHelper module
