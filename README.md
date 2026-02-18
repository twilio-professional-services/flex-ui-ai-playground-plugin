# AI Playground Flex Plugin

A Twilio Flex plugin that surfaces real-time AI operator results and voice transcription during active calls.

## Features

### AI Playground Panel (Panel 2)

A side panel that appears during voice calls with two top-level tabs:

- **Realtime Operators** — displays results from `OPERATOR-COMMUNICATION-*` operators (Sentiment, Summary, Next-Best-Response, etc.) as dynamic subtabs that appear automatically when data arrives. Each subtab shows the latest result with back/forward navigation through result history and a blue pulse animation on new arrivals.
- **Post Call Operators** — displays results from `OPERATOR-CONVERSATION_END-*` operators (e.g., AgentCoaching) that fire after the conversation ends.

See [AIPLAYGROUNDPANEL.md](AIPLAYGROUNDPANEL.md) for details.

### RealTime Transcription (Task Tab)

A task panel tab that shows live voice transcription during active calls. See [REALTIMETRANSCRIPTION.md](REALTIMETRANSCRIPTION.md) for details.

### SyncToRedux Provider

A standalone, plugin-agnostic library that bridges Twilio Sync and Redux for real-time data synchronization. See [src/utils/sync-to-redux/INDEX.md](src/utils/sync-to-redux/INDEX.md) for documentation.

## Project Structure

```
src/
  AiPlaygroundPlugin.tsx              Plugin entry: Paste, Redux, sync tracking, tab + panel registration
  initPaste.tsx                       CustomizationProvider setup with operator tab element customizations
  initCallSyncTracking.ts             afterAcceptTask / afterCompleteTask / afterCancelTask listeners
  components/
    AiPlayground/                     Panel 2 components
      AiPlaygroundPanel.tsx           Panel 2 root: title + top-level Paste Tabs
      RealtimeOperatorsTab.tsx        Discovers OPERATOR-COMMUNICATION-* keys, renders dynamic subtabs
      PostCallOperatorsTab.tsx        Discovers OPERATOR-CONVERSATION_END-* keys, renders dynamic subtabs
      OperatorResultCard.tsx          Renders one operator's result with navigation + arrival animation
      types.ts                        TypeScript interfaces for operator data
      utils.ts                        Key filtering, result formatting helpers
      index.ts                        Barrel export
    RealTimeTranscription/            Task tab components
      RealTimeTranscriptionTab.tsx    Main tab: data fetching and composition
      TranscriptionBubble.tsx         Finalized transcript message bubble
      PartialBubble.tsx               In-progress "speaking..." bubble
      EventMessage.tsx                Centered system event message
      types.ts                        TranscriptionItem, EventItem, PartialTrack, etc.
      utils.ts                        timeAgo, getTrackLabel, getTrackBadgeVariant, isAgentTrack
      index.ts                        Barrel export
  utils/
    sync-to-redux/                    Standalone Sync-to-Redux library
```

## Getting Started

```bash
npm install
twilio flex:plugins:start
```

Accept a voice call in Flex to see the RealTime Transcription tab and AI Playground panel.
