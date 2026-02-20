# RealTime Transcription Tab

A Flex UI task panel tab that displays live voice transcription data during active calls.

## Overview

When an agent accepts a voice call, the plugin opens a Twilio Sync Map (`ai-playground-{call_sid}`) in `metadata` mode. This map references two Sync objects managed by the backend:

- **`partialTranscript`** (Sync Document) — live in-progress speech for each audio track
- **`transcriptions`** (Sync List) — finalized transcript entries appended as speech is recognized

The tab renders this data in real-time as a scrollable conversation view, with Customer messages on the left, Agent messages on the right, and system events centered.

## How It Works

### Sync Tracking (`src/initCallSyncTracking.ts`)

On plugin init, three things happen:

1. An `afterAcceptTask` action listener starts tracking the Sync Map for any newly accepted call task.
2. `afterCompleteTask` and `afterCancelTask` listeners untrack the Sync Map, closing all Sync object subscriptions and removing data from Redux.
3. Any call tasks already present in `state.flex.worker.tasks` are scanned and tracked immediately. This handles plugin reloads mid-call.

The tracking is done via `SyncToReduxService.trackSync()`, which opens the Sync Map, discovers the referenced Sync objects (document + list), subscribes to their real-time events, and mirrors all data into the Redux store under `state['ai-playground'].syncToRedux.trackedMaps`.

### Tab Visibility (`src/AiPlaygroundPlugin.tsx`)

The tab is registered on `TaskCanvasTabs` with an `if` condition that shows it for any voice call task with a `call_sid`. The component handles the "no data yet" state internally, which avoids the problem of Flex's `if` function not re-evaluating when custom Redux state changes.

The plugin also registers an AI Playground panel on `AgentDesktopView.Panel2` for operator results. See [ai-playground-panel.md](ai-playground-panel.md) for details.

### Tab Component (`src/components/RealTimeTranscription/`)

The main `RealTimeTranscriptionTab` component uses `withTaskContext` to receive the current task, then reads transcription data reactively from Redux via `useSyncObject` hooks. It composes three sub-components:

- **`TranscriptionBubble`** — a finalized transcript entry showing speaker badge, text, relative timestamp, and a "Low confidence" indicator when confidence is below 0.7
- **`PartialBubble`** — an in-progress speech bubble with "speaking..." label and italic styling
- **`EventMessage`** — a centered system message for events like `transcription-stopped`

Messages are displayed newest-first. Agent messages are right-aligned, Customer messages are left-aligned.

## File Structure

```
src/
  AiPlaygroundPlugin.tsx                        — Plugin entry: Paste, Redux, sync tracking, tab + panel registration
  initPaste.tsx                                 — CustomizationProvider setup with operator tab element customizations
  initCallSyncTracking.ts                       — afterAcceptTask / afterCompleteTask / afterCancelTask listeners
  components/
    RealTimeTranscription/
      index.ts                                  — Barrel export
      RealTimeTranscriptionTab.tsx              — Main tab: data fetching and composition
      TranscriptionBubble.tsx                   — Finalized transcript message bubble
      PartialBubble.tsx                         — In-progress "speaking..." bubble
      EventMessage.tsx                          — Centered system event message
      types.ts                                  — TranscriptionItem, EventItem, PartialTrack, etc.
      utils.ts                                  — timeAgo, getTrackLabel, getTrackBadgeVariant, isAgentTrack
```

## Data Structures

### Transcription Item (from Sync List)

```json
{
  "text": "Hello, how can I help you?",
  "track": "outbound_track",
  "confidence": 0.95,
  "timestamp": "2026-02-17T10:30:00.000Z",
  "stability": 0.92,
  "isFinal": true,
  "languageCode": "en-US",
  "transcriptionSid": "GTa92ddf2576534cbe923ebb5c057ce814"
}
```

**Note:** List items do not include `sequenceId` — lists are append-only and use insertion order. Sequence IDs are only used in the partial transcript document for ordering.

### Event Item (from Sync List)

```json
{
  "event": "transcription-stopped",
  "callSid": "CA...",
  "timestamp": "2026-02-17T10:35:00.000Z"
}
```

### Partial Transcript (from Sync Document)

Only the `inbound_track` (customer) is written to the document. The document is updated via `updateDocumentWithSequence` which adds the `sequenceId` for ordering.

```json
{
  "inbound_track": {
    "sequenceId": 5,
    "text": "I was wondering if...",
    "timestamp": "2026-02-17T10:30:00.000Z",
    "confidence": 0.83,
    "stability": 0.85,
    "languageCode": "en-US",
    "isFinal": false,
    "transcriptionSid": "GTa92ddf2576534cbe923ebb5c057ce814"
  }
}
```

When speech is finalized, the text is cleared: `{ "sequenceId": 6, "text": "" }`. When transcription stops, `cleared: true` and `clearedAt` are added.

- `track`: `inbound_track` = Customer, `outbound_track` = Agent
- `confidence`: values below 0.7 trigger a "Low confidence" indicator
- `cleared`: when `true`, the partial is not displayed (speech was finalized)

## Dependencies

- `@twilio-paste/core` — UI components (Box, Text, Badge, Stack)
- `@twilio/flex-ui` — TaskHelper, withTaskContext, Actions, TaskCanvasTabs
- `SyncToReduxService` — manages Sync client, tracks maps, mirrors data to Redux
- `useSyncObject` hook — reactive Redux selector for sync object data within a tracked map
