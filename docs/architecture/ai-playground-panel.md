# AI Playground Panel (Panel 2)

A Flex UI Panel 2 component that displays AI operator results in real-time during active voice calls.

## Overview

Panel 2 always displays the AI Playground component. The content changes based on whether a call task is selected:

**When no call task is selected:**
- Shows a centered message: "Operator Results will load when a call task is selected"

**When a call task is active:**
- Shows three top-level tabs:
  - **Realtime Operators** — results from operators triggered during the conversation (`OPERATOR-COMMUNICATION-*`)
  - **Post Call Operators** — results from operators triggered after the conversation ends (`OPERATOR-CONVERSATION_END-*`)
  - **Customer Memory** — profile lookup via Memora, showing recalled memories, observations, conversation summaries, and traits for the caller

The operator tabs discover keys dynamically from the tracked Sync Map's `syncObjects` and render a subtab per operator. Subtabs appear automatically as operator data arrives. The Customer Memory tab uses the task's `from` attribute to look up the caller's Memora profile via a serverless proxy.

## Component Architecture

```
Panel 2
  AiPlaygroundPanel (receives tasks + selectedTaskSid from Flex)
    Title: "Flex UI AI Playground"

    [Conditional Rendering based on isCallTask]

    IF NO CALL TASK:
      Centered Message: "Operator Results will load when a call task is selected"

    IF CALL TASK SELECTED:
      Paste Tabs (top-level)
        Tab: "Realtime Operators"
          RealtimeOperatorsTab
            Paste Tabs (dynamic, one per OPERATOR-COMMUNICATION-* key)
              Tab: "Sentiment"
                OperatorResultCard (latest result + navigation + animation)
              Tab: "Next-Best-Response"
                OperatorResultCard
              Tab: "Summary"
                OperatorResultCard
              ... (auto-discovered from syncObjects)
        Tab: "Post Call Operators"
          PostCallOperatorsTab
            Paste Tabs (dynamic, one per OPERATOR-CONVERSATION_END-* key)
              Tab: "AgentCoaching"
                OperatorResultCard
              ... (auto-discovered from syncObjects)
        Tab: "Customer Memory"
          CustomerMemoryTab (looks up caller profile via Memora)
            Paste Tabs (static, four sub-tabs)
              Tab: "Memory Retrieval"
                MemoriesPanel (semantic search via Recall API)
              Tab: "Observations"
                ObservationsPanel (paginated observations list)
              Tab: "Conversation Summaries"
                ConversationSummariesPanel (paginated summaries list)
              Tab: "Traits"
                TraitsPanel (paginated traits list)
```

## How It Works

### Panel Registration (`src/AiPlaygroundPlugin.tsx`)

The panel is registered on `AgentDesktopView.Panel2.Content` using `Content.replace()`, which replaces the default CRM container. The panel is **always visible** in Panel 2 and handles conditional rendering internally based on whether a call task is selected. Panel 2 passes `tasks` and `selectedTaskSid` as props, which `AiPlaygroundPanel` uses to resolve the current task and determine what content to display.

### Data Access Pattern

**Operator tabs:**
- `RealtimeOperatorsTab` / `PostCallOperatorsTab` use `useTrackedMap(mapName)` to access the full tracked map from Redux
- Filter `syncObjects` keys matching `OPERATOR-COMMUNICATION-*` or `OPERATOR-CONVERSATION_END-*`
- Each `OperatorResultCard` receives the `items` array for one operator

**Customer Memory tab:**
- `CustomerMemoryTab` reads `task.attributes.from` to get the caller's phone number
- `useProfileLookup` hook calls the `memoraProxy` serverless function with `action: 'lookup'` to resolve a Memora profile ID
- Sub-panels use paginated hooks (`useObservations`, `useTraits`, `useConversationSummaries`) and `useRecall` for semantic search, all proxied through the same serverless function

### Result Rendering (`OperatorResultCard`)

Generic rendering based on `outputFormat`:
- **CLASSIFICATION**: Shows `result.label` (e.g., "neutral")
- **TEXT**: Shows `result.text`
- **JSON**: Checks known fields (`response`, `summary`, `observations`) first, falls back to `JSON.stringify`

Observations with `{content: "..."}` objects are rendered by extracting the `content` field.

### Result Navigation

Each `OperatorResultCard` tracks a `selectedIndex` state:
- **`null`** (default) means "follow latest" — auto-advances when new results arrive
- Back/forward arrows navigate through result history
- A "Latest" button appears when viewing a historical result, jumping back to follow-latest mode
- "Result N of M" label shows the current position

### Arrival Animation

Uses `@twilio-paste/core/animation-library` (re-exports `@react-spring/web`):
- `useRef` tracks previous `items.length`
- When length increases, sets `isNew = true` for 1.5s
- `useSpring` interpolates border/background color: blue pulse on the card
- `animated.div` wrapper applies spring styles

### Operator Tab Display Names

Derived from the latest list item's `displayName` field (e.g., "Sentiment", "AgentCoaching"). Falls back to stripping the operator prefix from the metadata key.

### Scrollable Tab List

The operator subtab list uses Paste element customization (`OPERATOR_TAB_LIST`, `OPERATOR_TAB`) registered in `initPaste.tsx` to enable horizontal scrolling when there are many operators with long names.

## Sync Tracking Lifecycle

Managed in `src/initCallSyncTracking.ts`:

- **`afterAcceptTask`** — starts tracking the Sync Map (`ai-playground-{callSid}`) in metadata mode
- **`afterCompleteTask`** / **`afterCancelTask`** — calls `SyncToReduxService.untrackSync()` to close all Sync subscriptions and remove data from Redux
- **Plugin reload** — scans existing tasks in state and re-tracks them

## File Structure

```
src/components/AiPlayground/
  index.ts                      Barrel export
  AiPlaygroundPanel.tsx         Panel 2 root: title + top-level Paste Tabs
  RealtimeOperatorsTab.tsx      Discovers OPERATOR-COMMUNICATION-* keys, renders dynamic subtabs
  PostCallOperatorsTab.tsx      Discovers OPERATOR-CONVERSATION_END-* keys, renders dynamic subtabs
  OperatorResultCard.tsx        Renders one operator's result with navigation + arrival animation
  types.ts                      TypeScript interfaces for operator data
  utils.ts                      Key filtering, result formatting helpers
  CustomerMemory/
    index.ts                    Barrel export
    CustomerMemoryTab.tsx       Profile lookup + four sub-tabs
    MemoriesPanel.tsx           Memory Retrieval (Recall API with semantic search)
    ObservationsPanel.tsx       Paginated observations list
    ConversationSummariesPanel.tsx  Paginated conversation summaries list
    TraitsPanel.tsx             Paginated traits list
    useMemora.ts                Memora API hooks (useProfileLookup, useRecall, useObservations, etc.)
    types.ts                    Memora API response types
```

## Data Structures

### Operator Result (from Sync List item)

```json
{
  "result": {
    "label": "neutral"
  },
  "dateCreated": "2026-02-17T22:47:47.224914645Z",
  "triggerOn": "COMMUNICATION",
  "displayName": "Sentiment",
  "outputFormat": "CLASSIFICATION"
}
```

### Operator Metadata (from Sync Map)

```json
{
  "OPERATOR-COMMUNICATION-Sentiment": {
    "syncObjectType": "list",
    "syncObjectName": "OPERATOR-COMMUNICATION-Sentiment-CA..."
  },
  "OPERATOR-CONVERSATION_END-AgentCoaching": {
    "syncObjectType": "list",
    "syncObjectName": "OPERATOR-CONVERSATION_END-AgentCoaching-CA..."
  }
}
```

### Output Formats

| Format | Rendering | Example |
|--------|-----------|---------|
| `CLASSIFICATION` | `result.label` | "neutral" |
| `TEXT` | `result.text` | "The customer identified..." |
| `JSON` | Known fields or `JSON.stringify` | `{response: "Hello..."}` |

## Dependencies

- `@twilio-paste/core/tabs` — Tabs, Tab, TabList, TabPanel, TabPanels, useTabState
- `@twilio-paste/core/uid-library` — useUID for tab IDs
- `@twilio-paste/core/animation-library` — useSpring, animated for arrival animation
- `@twilio-paste/core/box`, `@twilio-paste/core/text`, `@twilio-paste/core/badge`, `@twilio-paste/core/button`, `@twilio-paste/core/tooltip` — UI primitives
- `@twilio-paste/core/spinner`, `@twilio-paste/core/alert` — Customer Memory loading/error states
- `@twilio/flex-ui` — ITask, TaskHelper, Manager (for Flex token in Memora proxy calls)
- `SyncToReduxService` + `useTrackedMap` hook — reactive Redux access to Sync data
- `memoraProxy` serverless function — proxies Memora API calls with Flex token auth
