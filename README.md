# AI Playground Flex Plugin

A Twilio Flex plugin that adds real-time voice transcription, AI operator results, and customer memory retrieval to the agent desktop during active calls.

## Features

- **RealTime Transcription** -- live speech-to-text displayed in a scrollable chat view on the task panel, with customer messages on the left and agent messages on the right
- **Realtime AI Operators** -- operator results (Sentiment, Summary, Next-Best-Response, etc.) streamed to a Panel 2 side panel as the conversation happens, with dynamic subtabs that appear automatically per operator
- **Post Call Operators** -- operator results that fire after the conversation ends (e.g., AgentCoaching) displayed in the same panel
- **Customer Memory** -- profile lookup via Memora, showing Memory Retrieval, Observations, Conversation Summaries, and Traits for the caller
- **Supervisor Access** -- supervisors can view real-time transcription and operator results for monitored calls via the Teams View
- **TaskRouter Integration** -- per-dialed-number routing with optional worker targeting
- **Participant Type Fix** -- automatic correction of participant types for conversations hydrated via `<Transcription>`

## Prerequisites

- **Twilio account** with one or more voice-capable phone numbers
- **Twilio Flex** instance (the plugin targets Flex UI 2.x)
- **Conversation Intelligence** with at least one configuration (`conv_configuration_xxx`)
- **Memora store** (`mem_store_xxx`) if using Customer Memory
- **TaskRouter workflow** with a Workflow SID (`WW...`)
- **Node.js** 18 or 20
- **Twilio CLI** with the Flex and Serverless plugins:
  ```bash
  twilio plugins:install @twilio-labs/plugin-serverless
  twilio plugins:install @twilio-labs/plugin-flex
  ```

## Quick Start

```bash
# 1. Clone the repo
git clone <repo-url>
cd flex-ui-ai-playground-plugin

# 2. Install plugin dependencies
npm install

# 3. Install serverless dependencies
cd serverless-ai-playground-plugin
npm install
cd ..

# 4. Configure serverless environment
cp serverless-ai-playground-plugin/.env-template serverless-ai-playground-plugin/.env
# Edit serverless-ai-playground-plugin/.env with your values (see Serverless Setup below)

# 5. Configure phone number mapping
# Edit serverless-ai-playground-plugin/assets/config.private.json (see Phone Number Config below)

# 6. Deploy serverless functions
cd serverless-ai-playground-plugin
twilio serverless:deploy
cd ..
# Note the deployed domain from the output (e.g., your-service-1234-dev.twil.io)

# 7. Configure Twilio phone numbers
# In Twilio Console > Phone Numbers, set each number's Voice webhook to:
#   https://your-service-1234-dev.twil.io/handleIncomingCall  (POST)

# 8. Set the plugin's serverless domain
export FLEX_APP_SERVERLESS_DOMAIN=your-service-1234-dev.twil.io

# 9. Start the Flex plugin locally
twilio flex:plugins:start
```

Accept a voice call in Flex to see the RealTime Transcription tab and AI Playground panel.

## Serverless Setup

### Environment Variables

Copy `.env-template` to `.env` inside `serverless-ai-playground-plugin/` and fill in the values:

| Variable | Required | Description |
|----------|----------|-------------|
| `ACCOUNT_SID` | Yes | Twilio Account SID (`AC...`) |
| `AUTH_TOKEN` | Yes | Twilio Auth Token |
| `WORKFLOW_SID` | Yes | TaskRouter Workflow SID (`WW...`) |
| `TRANSCRIPTION_DOMAIN_OVERRIDE` | No | Force a specific domain for the transcription webhook URL (useful for ngrok/tunnels). If empty, falls back to `context.DOMAIN_NAME` (auto-populated on deploy) or `TRANSCRIPTION_DOMAIN_WHEN_RUN_LOCAL`. |
| `TRANSCRIPTION_DOMAIN_WHEN_RUN_LOCAL` | No | Fallback transcription webhook domain when running locally (e.g., `your-service-1234-dev.twil.io`) |
| `REALTIME_TRANSCRIPTION` | Yes | Enable real-time transcription (`true`/`false`, case-insensitive) |
| `REALTIME_TRANSCRIPTION_PARTIAL_RESULTS` | Yes | Enable partial (interim) transcription results (`true`/`false`) |
| `SYNC_SERVICE_SID` | No | Sync Service SID (`IS...`) or `default` for the built-in Flex Sync service |
| `MEMORA_STORE_ID` | No | Memora store ID (`mem_store_...`) for Customer Memory features |

### Phone Number Configuration

Edit `serverless-ai-playground-plugin/assets/config.private.json`:

```json
{
  "defaultConversationConfigId": "conv_configuration_xxx",
  "phoneNumberMapping": {
    "+15555551234": {
      "conversationConfigId": "conv_configuration_xxx",
      "targetWorkers": ["WKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"],
      "description": "My test number"
    },
    "+15555555678": {
      "conversationConfigId": "conv_configuration_yyy",
      "description": "Another number (no worker targeting)"
    }
  }
}
```

- `defaultConversationConfigId` -- fallback Conversation Intelligence config if no mapping matches
- `phoneNumberMapping` keys are **your Twilio phone numbers** (the number being called, not the caller) in E.164 format
  - `conversationConfigId` -- Conversation Intelligence Service ID
  - `targetWorkers` -- (optional) array of Worker SIDs (`WK...`) to route to
  - `description` -- (optional) human-readable label

### TaskRouter Workflow

If using worker targeting, add a filter to your workflow:

```json
{
  "filter_friendly_name": "Targeted Workers",
  "expression": "task.targetWorkers == true",
  "targets": [
    {
      "queue": "QUxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      "expression": "task.targetWorkersArray HAS worker.sid",
      "priority": 10,
      "timeout": 120
    }
  ]
}
```

### Deployment

```bash
cd serverless-ai-playground-plugin
twilio serverless:deploy
```

After deploying:

1. Note the domain from the output (e.g., `your-service-1234-dev.twil.io`)
2. In Twilio Console, set each phone number's Voice webhook to `https://<domain>/handleIncomingCall` (POST)
3. If `TRANSCRIPTION_DOMAIN_WHEN_RUN_LOCAL` changed, update `.env` and redeploy

## Plugin Setup

The Flex plugin needs one environment variable to communicate with the serverless backend:

```bash
export FLEX_APP_SERVERLESS_DOMAIN=your-service-1234-dev.twil.io
```

Then start the plugin:

```bash
twilio flex:plugins:start
```

## Feature Guide

### RealTime Transcription Tab

Appears as a tab on the task panel during voice calls. Shows a scrollable conversation view with:

- **Customer messages** (left-aligned) from `inbound_track`
- **Agent messages** (right-aligned) from `outbound_track`
- **Partial speech** ("speaking..." bubble) when partial results are enabled
- **Low confidence indicator** when confidence is below 0.7
- **System events** (e.g., "transcription-stopped") centered

Data flows from Twilio's `<Transcription>` webhook through serverless functions into Twilio Sync, then into Redux via the SyncToRedux library, and finally into React components.

### AI Playground Panel (Panel 2)

Opens as a side panel when a voice call is selected. Contains three top-level tabs:

**Realtime Operators** -- Displays results from operators triggered during the conversation. Each operator (Sentiment, Summary, Next-Best-Response, etc.) gets its own subtab that appears automatically when data arrives. Results include back/forward navigation through history and a blue pulse animation on new arrivals.

**Post Call Operators** -- Same layout, but for operators that fire after the conversation ends (e.g., AgentCoaching).

**Customer Memory** -- Looks up the caller's profile in Memora using the task's `from` attribute, then displays four sub-tabs:
- **Memory Retrieval** -- recalled memories relevant to the caller
- **Observations** -- extracted observations from past conversations
- **Conversation Summaries** -- summaries of previous conversations
- **Traits** -- identified customer traits

### Supervisor View

Supervisors can monitor agent calls from the Teams View. When viewing a monitored call, the Supervisor TaskCanvas includes:

**RealTime Transcription Tab** -- Same real-time transcription view as agents see, showing the live conversation flow.

**Operator Results Tab** -- A dropdown selector displaying all operator results (both realtime and post-call operators combined). Supervisors can:
- Select any operator from the dropdown to view its results
- See result counts for each operator (e.g., "Sentiment (3 results)")
- Navigate through operator result history using the same back/forward/latest controls
- View results with horizontal scrolling when content is wider than the panel

The operator results automatically update as new results arrive during the monitored call. The supervisor tracking is handled by `SupervisorCallTracker`, which subscribes to the same Sync maps as the agent desktop.

### TaskRouter Workspace Webhook

The `handleTaskRouterWorkspaceWebhook` function handles conversation cleanup after tasks complete.

### Participant Type Workaround

The `handleConversationEvents` function automatically fixes participant types for conversations hydrated via `<Transcription>`, which incorrectly defaults both participants to `CUSTOMER`. It detects agent participants by matching against Twilio phone numbers on the account and updates them to `HUMAN_AGENT`.

## Project Structure

```
flex-ui-ai-playground-plugin/
  package.json                                    Flex plugin package
  src/
    index.ts                                      Plugin entry point
    AiPlaygroundPlugin.tsx                        Plugin init: Paste, Redux, sync tracking, tab + panel registration
    initPaste.tsx                                 CustomizationProvider setup
    initCallSyncTracking.ts                       afterAcceptTask / afterCompleteTask / afterCancelTask listeners
    components/
      RealTimeTranscription/                      Task panel tab
        RealTimeTranscriptionTab.tsx              Main tab: data fetching + composition
        TranscriptionBubble.tsx                   Finalized transcript bubble
        PartialBubble.tsx                         In-progress "speaking..." bubble
        EventMessage.tsx                          System event message
        types.ts, utils.ts, index.ts
      AiPlayground/                               Panel 2 components
        AiPlaygroundPanel.tsx                     Panel 2 root: tabs container
        RealtimeOperatorsTab.tsx                  OPERATOR-COMMUNICATION-* dynamic subtabs
        PostCallOperatorsTab.tsx                  OPERATOR-CONVERSATION_END-* dynamic subtabs
        OperatorResultCard.tsx                    Single operator result with navigation + animation
        CustomerMemory/                           Customer Memory tab
          CustomerMemoryTab.tsx                   Profile lookup + sub-tabs
          MemoriesPanel.tsx                       Memory Retrieval panel
          ObservationsPanel.tsx                   Observations panel
          ConversationSummariesPanel.tsx          Conversation Summaries panel
          TraitsPanel.tsx                         Traits panel
          useMemora.ts                            Memora API hook
          types.ts, index.ts
        types.ts, utils.ts, index.ts
      Supervisor/                                 Supervisor view components
        SupervisorCallTracker.tsx                 Teams View sync tracking for monitored calls
        SupervisorOperatorResultsTab.tsx          Supervisor TaskCanvas operator results tab with dropdown
    utils/
      sync-to-redux/                              Standalone Sync-to-Redux library
        SyncToReduxService.ts                     Main service (singleton)
        hooks.ts                                  React hooks (useTrackedMap, useSyncObject)
        state/syncToReduxSlice.ts                 Redux slice
        types.ts, index.ts
        INDEX.md, README.md, QUICKSTART.md, ...   Library documentation

  serverless-ai-playground-plugin/                Twilio Serverless functions
    .env-template                                 Environment variable template
    assets/
      config.private.json                         Phone number mapping config
    functions/
      handleIncomingCall.protected.js             Incoming call handler (TwiML + transcription + enqueue)
      handleRealtimeTranscription.protected.js    Transcription webhook handler
      handleConversationEvents.protected.js       Participant type workaround
      handleOperatorResult.protected.js           Operator result handler
      handleTaskRouterWorkspaceWebhook.protected.js  TaskRouter event handler
      memoraProxy.js                              Memora API proxy for Customer Memory
      realtimeTranscriptionSyncHelper.private.js  Sync integration for transcription
      syncHelper.private.js                       Reusable Sync CRUD operations

  docs/
    architecture/                                 Implementation deep-dives (for developers and LLM context)
      realtime-transcription-ui.md                RT transcription component architecture
      ai-playground-panel.md                      Panel 2 component tree + data access patterns
      realtime-transcription-serverless.md        Serverless config, deployment, testing, troubleshooting
      realtime-transcription-sync.md              Sync data structures, event flows, race conditions
      sync-helper.md                              syncHelper module API reference
      participant-type-workaround.md              Participant type fix explanation
```

## Configuration Reference

All environment variables across both the serverless backend and the Flex plugin:

### Serverless (`serverless-ai-playground-plugin/.env`)

| Variable | Description |
|----------|-------------|
| `ACCOUNT_SID` | Twilio Account SID (`AC...`) |
| `AUTH_TOKEN` | Twilio Auth Token |
| `WORKFLOW_SID` | TaskRouter Workflow SID (`WW...`) |
| `TRANSCRIPTION_DOMAIN_OVERRIDE` | Force transcription webhook domain (e.g., ngrok URL) |
| `TRANSCRIPTION_DOMAIN_WHEN_RUN_LOCAL` | Fallback domain for local development |
| `REALTIME_TRANSCRIPTION` | Enable real-time transcription (`true`/`false`) |
| `REALTIME_TRANSCRIPTION_PARTIAL_RESULTS` | Enable partial transcription results (`true`/`false`) |
| `SYNC_SERVICE_SID` | Sync Service SID or `default` |
| `MEMORA_STORE_ID` | Memora store ID for Customer Memory (`mem_store_...`) |

### Flex Plugin (shell environment)

| Variable | Description |
|----------|-------------|
| `FLEX_APP_SERVERLESS_DOMAIN` | Deployed serverless domain (e.g., `your-service-1234-dev.twil.io`) |

## Architecture

For implementation details, data structures, and component internals, see the docs in [`docs/architecture/`](docs/architecture/):

- [realtime-transcription-ui.md](docs/architecture/realtime-transcription-ui.md) -- RT transcription component architecture and data structures
- [ai-playground-panel.md](docs/architecture/ai-playground-panel.md) -- Panel 2 component tree, data access, rendering, animations
- [realtime-transcription-serverless.md](docs/architecture/realtime-transcription-serverless.md) -- Serverless configuration, deployment, testing procedures, troubleshooting
- [realtime-transcription-sync.md](docs/architecture/realtime-transcription-sync.md) -- Sync integration deep dive (data structures, event flows, race conditions)
- [sync-helper.md](docs/architecture/sync-helper.md) -- syncHelper module API reference with examples and patterns
- [participant-type-workaround.md](docs/architecture/participant-type-workaround.md) -- Participant type fix for `<Transcription>`-hydrated conversations

The SyncToRedux standalone library has its own documentation at [`src/utils/sync-to-redux/INDEX.md`](src/utils/sync-to-redux/INDEX.md).
