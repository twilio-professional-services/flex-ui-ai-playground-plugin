# AI Playground Panel (Panel 2)

A Flex UI Panel 2 component that displays AI operator results in real-time during active voice calls.

## Overview

When an agent is on a voice call, Panel 2 shows the AI Playground with two top-level tabs:

- **Realtime Operators** — results from operators triggered during the conversation (`OPERATOR-COMMUNICATION-*`)
- **Post Call Operators** — results from operators triggered after the conversation ends (`OPERATOR-CONVERSATION_END-*`)

Each tab discovers operator keys dynamically from the tracked Sync Map's `syncObjects` and renders a subtab per operator. Subtabs appear automatically as operator data arrives.

## Component Architecture

```
Panel 2
  AiPlaygroundPanel (receives tasks + selectedTaskSid from Flex)
    Title: "Flex UI AI Playground"
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
```

## How It Works

### Panel Registration (`src/AiPlaygroundPlugin.tsx`)

The panel is registered on `AgentDesktopView.Panel2.Content` with an `if` condition that checks for a selected call task with a `call_sid`. Panel 2 passes `tasks` and `selectedTaskSid` as props, which `AiPlaygroundPanel` uses to resolve the current task and pass it down to child components.

### Data Access Pattern

- `RealtimeOperatorsTab` / `PostCallOperatorsTab` use `useTrackedMap(mapName)` to access the full tracked map from Redux
- Filter `syncObjects` keys matching `OPERATOR-COMMUNICATION-*` or `OPERATOR-CONVERSATION_END-*`
- Each `OperatorResultCard` receives the `items` array for one operator

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
- `@twilio/flex-ui` — ITask, TaskHelper
- `SyncToReduxService` + `useTrackedMap` hook — reactive Redux access to Sync data
