# Real-Time Transcription with TaskRouter Integration

## Overview

This implementation adds real-time transcription and intelligent routing capabilities to incoming calls in your Twilio Flex contact center. The system provides:

- **Real-time speech-to-text transcription** using Twilio Conversation Intelligence
- **Flexible agent routing** via TaskRouter with custom worker targeting
- **Per-dialed-number configuration** - Different configs based on which Twilio number was called (To), not who called (From)
- **Feature flag controls** for easy enabling/disabling of transcription
- **Comprehensive logging** for debugging and analysis

## Requirements

- **Twilio Node.js SDK**: Version 5.12.1 or higher (required for `start.transcription()` support)
- **Node.js**: Version 20 or 22
- **Twilio Account**: With phone number(s) that have voice capabilities
- **TaskRouter**: Workflow SID configured
- **Conversation Intelligence**: One or more configuration IDs (format: `conv_configuration_xxx`)

## Architecture

```
Incoming Call
    |
    v
handleIncomingCall.protected.js
    |
    +---> Load config.json
    |     (Map DIALED number [To] to config)
    |
    +---> Conditional Transcription
    |     (If REALTIME_TRANSCRIPTION=true)
    |     |
    |     +---> <Start><Transcription>
    |           - Conversation Intelligence
    |           - Webhook to handleRealtimeTranscription
    |
    +---> TaskRouter Enqueue
          |
          +---> Task Attributes
                - targetWorkers (optional)
                - targetWorkersArray (optional)
          |
          +---> Workflow evaluates filters
                |
                +---> Routes to appropriate worker(s)

Transcription Events
    |
    v
handleRealtimeTranscription.protected.js
    |
    +---> Log all events (basic or detailed based on flag)
    |     - transcription-started
    |     - transcription-content
    |     - transcription-stopped
    |     - transcription-error
    |
    +---> Delegate to Sync helper (imported at global level)
          |
          v
realtimeTranscriptionSyncHelper.private.js
          |
          +---> Manage Sync resource creation (conditional)
          +---> Route events to appropriate handlers
          +---> Use syncHelper utilities
                |
                v
syncHelper.private.js
                |
                +---> Low-level Sync CRUD operations
                +---> All REST API calls happen here
```

## Configuration Guide

### 1. Environment Variables

Copy `.env-template` to `.env` and configure:

```bash
# Twilio Account
ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AUTH_TOKEN=your_auth_token_here

# TaskRouter
WORKFLOW_SID=WWxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Transcription Configuration
# Domain priority: TRANSCRIPTION_DOMAIN_OVERRIDE > context.DOMAIN_NAME > TRANSCRIPTION_DOMAIN_WHEN_RUN_LOCAL
TRANSCRIPTION_DOMAIN_OVERRIDE=
TRANSCRIPTION_DOMAIN_WHEN_RUN_LOCAL=your-service-name-1234-dev.twil.io
REALTIME_TRANSCRIPTION=true
REALTIME_TRANSCRIPTION_PARTIAL_RESULTS=true
DETAILED_TRANSCRIPTION_LOGGING=false

# Sync Configuration
SYNC_SERVICE_SID=ISxxx
PARTIAL_STABLE_THRESHOLD=0.7

# Memora (Customer Memory) Configuration
MEMORA_STORE_ID=mem_store_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

#### Environment Variable Reference

| Variable | Required | Format | Description |
|----------|----------|--------|-------------|
| `ACCOUNT_SID` | Yes | `ACxxxx...` | Twilio Account SID |
| `AUTH_TOKEN` | Yes | String | Twilio Auth Token |
| `WORKFLOW_SID` | Yes | `WWxxxx...` | TaskRouter Workflow SID |
| `TRANSCRIPTION_DOMAIN_OVERRIDE` | No | `your-domain.twil.io` | Force a specific transcription webhook domain (useful for ngrok/tunnels). Overrides all other domain sources. |
| `TRANSCRIPTION_DOMAIN_WHEN_RUN_LOCAL` | No | `your-domain.twil.io` | Fallback transcription webhook domain for local development. Used when `TRANSCRIPTION_DOMAIN_OVERRIDE` is empty and `context.DOMAIN_NAME` is unavailable. |
| `REALTIME_TRANSCRIPTION` | Yes | `true`/`false` | Enable transcription (case-insensitive) |
| `REALTIME_TRANSCRIPTION_PARTIAL_RESULTS` | Yes | `true`/`false` | Enable partial results & Sync document (case-insensitive) |
| `DETAILED_TRANSCRIPTION_LOGGING` | No | `true`/`false` | Enable detailed logging of all webhook events (default: `false`) |
| `SYNC_SERVICE_SID` | No | `ISxxxx` or `default` | Sync service SID or name (default: `default`) |
| `PARTIAL_STABLE_THRESHOLD` | No | `0.0` - `1.0` | Stability threshold for partial transcripts (default: `0.7`) |
| `MEMORA_STORE_ID` | No | `mem_store_xxx` | Memora store ID for Customer Memory features |

**Note on domain resolution:** When deployed to Twilio, `context.DOMAIN_NAME` is auto-populated with the service domain. Locally, this is empty, so `TRANSCRIPTION_DOMAIN_WHEN_RUN_LOCAL` is used as fallback. `TRANSCRIPTION_DOMAIN_OVERRIDE` always takes priority when set.

**Note:** Boolean flags are case-insensitive. All of these work: `true`, `True`, `TRUE`, `false`, `False`, `FALSE`

### 2. Phone Number Configuration

Edit `assets/config.private.json` (accessed as `/config.json` at runtime via `Runtime.getAssets()`):

```json
{
  "defaultConversationConfigId": "conv_configuration_01khckv3dvew7bzj12wj8fcw28",
  "phoneNumberMapping": {
    "+15555551234": {
      "conversationConfigId": "conv_configuration_xxx",
      "targetWorkers": ["WKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"],
      "description": "Tester 1"
    },
    "+15555555678": {
      "conversationConfigId": "conv_configuration_xxx",
      "description": "Tester 2"
    },
    "+15555559999": {
      "conversationConfigId": "conv_configuration_xxx",
      "targetWorkers": [
        "WKaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "WKbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
      ],
      "description": "Tester 3 and 4"
    }
  }
}
```

**Configuration Fields:**

- `defaultConversationConfigId`: Fallback Conversation Intelligence config (required)
- `phoneNumberMapping`: Map of **dialed Twilio numbers (To)** to configurations
  - Key: **Your Twilio phone number** in E.164 format (e.g., `+15555551234`) - This is the number that was CALLED (To), NOT the caller's number (From)
  - Value object:
    - `conversationConfigId`: Conversation Intelligence Service ID (format: `conv_configuration_xxx`)
    - `targetWorkers`: Array of Worker SIDs (starts with `WK`) - optional
    - `description`: Human-readable description - optional

**Important:** The phone numbers in `phoneNumberMapping` are the **Twilio phone numbers you own** (the ones being called), not the customer's phone number. The system routes based on which of your numbers was dialed.

### 3. TaskRouter Workflow Setup

For worker targeting to function, configure your TaskRouter workflow with filters:

#### Example Workflow Filter

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

**Filter Logic:**

1. `task.targetWorkers == true` - Only evaluate tasks with worker targeting
2. `task.targetWorkersArray HAS worker.sid` - Route to workers in the array
3. If no match, workflow continues to next filter

## TwiML Structure

The system generates the following TwiML structure:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <!-- Conditional: Only if REALTIME_TRANSCRIPTION=true -->
  <Start>
    <Transcription
      statusCallbackUrl="https://your-domain.twil.io/handleRealtimeTranscription"
      partialResults="true"
      enableAutomaticPunctuation="true"
      conversationConfiguration="conv_configuration_xxx"
    />
  </Start>

  <!-- Always included -->
  <Enqueue workflowSid="WWxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx">
    <Task>
      {
        "targetWorkers": true,
        "targetWorkersArray": ["WKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"]
      }
    </Task>
  </Enqueue>
</Response>
```

### TwiML Elements Explained

#### `<Start><Transcription>`

Starts real-time transcription using Twilio Conversation Intelligence.

**Attributes:**

- `statusCallbackUrl`: Webhook URL for transcription events
- `partialResults`: Send interim results before final transcription (true/false)
- `enableAutomaticPunctuation`: Add punctuation to transcripts (true/false)
- `conversationConfiguration`: Conversation Intelligence Service ID (format: `conv_configuration_xxx`)

#### `<Enqueue>`

Enqueues the call to TaskRouter for agent routing.

**Attributes:**

- `workflowSid`: TaskRouter Workflow to use

#### `<Task>`

JSON object containing custom task attributes passed to TaskRouter.

**Task Attributes (Conditional):**

- `targetWorkers`: Boolean flag (only present if workers specified in config)
- `targetWorkersArray`: Array of Worker SIDs (only present if workers specified in config)

If no targetWorkers are configured for the dialed number, an empty object `{}` is passed.

## Webhook Event Examples

The `handleRealtimeTranscription.protected.js` function receives various event types from Twilio. Events are delivered as form-encoded POST bodies.

### Event Type: `transcription-started`

Sent when transcription session begins.

```
TranscriptionEvent: transcription-started
CallSid: CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AccountSid: ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Track: inbound_track
TranscriptionSid: GTxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Event Type: `transcription-content`

Sent when transcription text is available (final or partial).

```
TranscriptionEvent: transcription-content
CallSid: CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AccountSid: ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Track: inbound_track
TranscriptionSid: GTxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TranscriptionData: {"transcript":"Hello, I need help with my account","confidence":0.95}
Final: true
SequenceId: 7
LanguageCode: en-US
Timestamp: 2026-02-16T10:30:45.123Z
Stability: 0.85
```

**Content Fields:**

- `TranscriptionData`: JSON string containing `transcript` (text) and `confidence` (0.0-1.0)
- `Final`: `true` for final results, `false` for partial (if enabled)
- `SequenceId`: Monotonically increasing ID per utterance (used for document ordering)
- `Stability`: How likely the partial transcript is to change (0.0-1.0, only present for partials)
- `LanguageCode`: Detected/configured language
- `Timestamp`: When the speech occurred

### Event Type: `transcription-stopped`

Sent when transcription session ends (call ends or transcription stopped).

```
TranscriptionEvent: transcription-stopped
CallSid: CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AccountSid: ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Track: inbound_track
TranscriptionSid: GTxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SequenceId: 15
```

### Event Type: `transcription-error`

Sent when an error occurs during transcription.

```
TranscriptionEvent: transcription-error
CallSid: CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AccountSid: ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Track: inbound_track
TranscriptionSid: GTxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ErrorCode: 12345
ErrorMessage: Description of the error
```

## Testing Procedures

### 1. Configuration Loading Test

Verify the system loads `config.private.json` correctly:

1. Deploy the functions
2. Make a test call to one of your configured Twilio phone numbers
3. Check Function logs for:
   ```
   Configuration loaded successfully
   Incoming call from +15555551234 to +15555555678 (CAxxxx...)
   Using conversation config: conv_configuration_xxx
   ```

**Expected:** Configuration loads without errors, correct config ID is selected based on the To number (your Twilio number that was called).

### 2. Transcription Test (Enabled)

Test real-time transcription functionality:

1. Set `REALTIME_TRANSCRIPTION=true` in `.env`
2. Deploy the functions
3. Make a test call and speak clearly
4. Check Function logs for transcription events (basic logging):
   ```
   [Transcription] transcription-content - CallSID: CAxxxx...
   ```
   Or with `DETAILED_TRANSCRIPTION_LOGGING=true`:
   ```
   === Real-Time Transcription Event (Detailed) ===
   Complete Event Payload: { ... }
   Extracted Key Fields:
   - Event Type: transcription-content
   - Transcription Text: Hello, I need help
   - Is Final: true
   ```

**Expected:** You should see:
- `transcription-started` when call begins
- Multiple `transcription-content` events as you speak
- `transcription-stopped` when call ends

### 3. Transcription Test (Disabled)

Verify calls work without transcription:

1. Set `REALTIME_TRANSCRIPTION=false` in `.env`
2. Deploy the functions
3. Make a test call
4. Check Function logs for:
   ```
   Real-time transcription disabled
   Enqueued to workflow: WWxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```
5. Verify NO transcription webhook events in logs

**Expected:** Call enqueues successfully, no transcription events.

### 4. Partial Results Test

Test interim transcription results:

1. Set `REALTIME_TRANSCRIPTION=true` and `REALTIME_TRANSCRIPTION_PARTIAL_RESULTS=true`
2. Deploy the functions
3. Make a test call and speak a long sentence slowly
4. Check Function logs for `transcription-content` events with `Final: false`

**Expected:** Multiple events per sentence - partial results followed by final.

### 5. TaskRouter Integration Test

Verify task creation and attributes:

1. Make a test call to a number WITHOUT targetWorkers configured
2. Check TaskRouter task queue in Twilio Console
3. Check Function logs for task attributes showing empty object: `{}`
4. Make a test call to a number WITH targetWorkers configured
5. Check Function logs for task attributes with worker fields

**Expected:** Task appears in queue. Task attributes are empty `{}` unless targetWorkers configured.

### 6. Worker Targeting Test

Test routing to specific workers:

1. Configure `targetWorkers` for a phone number in `config.private.json`
2. Ensure workflow has targeting filter configured
3. Make a call to that phone number
4. Check Function logs show task attributes:
   ```json
   {
     "targetWorkers": true,
     "targetWorkersArray": ["WKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"]
   }
   ```
5. Verify task routes to specified worker(s)

**Expected:** Task routes only to workers in `targetWorkersArray`.

### 7. Fallback Behavior Test

Test error handling when config fails to load:

1. Temporarily rename `config.private.json` to `config.private.json.bak`
2. Deploy and make a test call
3. Check logs for:
   ```
   Error loading configuration: ...
   Critical error in handleIncomingCall: ...
   ```
4. Verify the call still answers (with a TwiML `<Say>` fallback message)

**Expected:** Call answers with "We are experiencing technical difficulties" rather than failing silently. Config loading is required — there is no default fallback config.

## Troubleshooting Guide

### Problem: Configuration Not Loading

**Symptoms:**
- Logs show: "Error loading configuration:" followed by "Critical error in handleIncomingCall"
- Call answers with "technical difficulties" message instead of routing

**Solutions:**
1. Verify `config.private.json` exists in `assets/` directory
2. Check JSON syntax is valid (use JSON validator)
3. Ensure file is included in deployment
4. Check file permissions

### Problem: No Transcription Events

**Symptoms:**
- Calls work but no transcription webhook events in logs
- No `transcription-started` or `transcription-content` events

**Solutions:**
1. Verify `REALTIME_TRANSCRIPTION=true` (check spelling and case)
2. Confirm domain resolution is correct: `TRANSCRIPTION_DOMAIN_OVERRIDE` or `TRANSCRIPTION_DOMAIN_WHEN_RUN_LOCAL` matches deployed domain
3. Check webhook URL is accessible (test with curl)
4. Verify Conversation Intelligence Service ID is valid
5. Ensure microphone is working (test with another app)
6. Check Function logs for webhook errors

### Problem: Transcription Events But No Text

**Symptoms:**
- `transcription-started` events arrive
- No `transcription-content` events with text
- Or transcription text is empty

**Solutions:**
1. Speak clearly and loudly during test call
2. Check audio quality (background noise, connection)
3. Verify Conversation Intelligence config is active and properly configured
4. Check that the conversation config ID in config.json is correct

### Problem: Tasks Not Routing to Target Workers

**Symptoms:**
- Task created but routes to wrong worker
- `targetWorkers` attributes present but ignored

**Solutions:**
1. Verify workflow filter expression: `task.targetWorkers == true`
2. Check target expression: `task.targetWorkersArray HAS worker.sid`
3. Confirm Worker SIDs are correct (start with `WK`)
4. Verify workers are available (check status)
5. Check workflow filter priority and ordering
6. Test workflow with TaskRouter simulator

### Problem: Call Fails or Drops

**Symptoms:**
- Call connects then immediately disconnects
- No TwiML in Function logs
- Error in Twilio debugger

**Solutions:**
1. Check `WORKFLOW_SID` is correct and valid
2. Verify callback function is always called
3. Check for JavaScript errors in Function logs
4. Ensure all required environment variables are set
5. Test with `REALTIME_TRANSCRIPTION=false` to isolate issue
6. Review error stack traces in logs

### Problem: Partial Results Not Working

**Symptoms:**
- Only final results appear in logs
- No interim transcription events

**Solutions:**
1. Verify `REALTIME_TRANSCRIPTION_PARTIAL_RESULTS=true`
2. Speak longer sentences (partials need time to generate)
3. Check if Conversation Intelligence config supports partial results
4. Verify the conversationConfiguration in your Conversation Intelligence config

### Problem: Wrong Conversation Config Used

**Symptoms:**
- Logs show unexpected `conversationConfigId`
- Wrong intelligence service applied

**Solutions:**
1. Verify phone number in `config.private.json` matches the **dialed number (To)** exactly - this is YOUR Twilio number, not the caller's number
2. Check E.164 format: `+15555551234` (not `15555551234`)
3. Confirm `defaultConversationConfigId` is set correctly
4. Check logs for phone number mapping: "Incoming call from X to Y" - the "to Y" number should match your config keys
5. Test with multiple phone numbers to isolate mapping issue
6. Remember: Configuration is based on which Twilio number was called (To), NOT who is calling (From)

## Deployment

### Standard Deployment

```bash
# 1. Install dependencies (if not already done)
npm install

# Verify Twilio SDK version is 5.12.1 or higher
npm list twilio

# 2. Configure environment variables
cp .env-template .env
# Edit .env with your values

# 3. Configure phone number mappings
# Edit assets/config.json

# 4. Deploy to Twilio
npm run deploy
# OR
twilio serverless:deploy
```

### Post-Deployment Steps

1. **Capture Domain:**
   - Note the deployed domain from output: `Deployed to: https://your-service-1234-dev.twil.io`
   - When deployed, `context.DOMAIN_NAME` is auto-populated, so no env var update is needed
   - For local development, update `TRANSCRIPTION_DOMAIN_WHEN_RUN_LOCAL` in `.env` with the deployed domain

2. **Configure Phone Numbers:**
   - In Twilio Console, go to Phone Numbers
   - For each number, set Voice webhook to:
     ```
     https://your-service-1234-dev.twil.io/handleIncomingCall
     ```
   - Set HTTP method to `POST`

3. **Verify Conversation Intelligence:**
   - Ensure Conversation Intelligence configs (format: `conv_configuration_xxx`) exist
   - Verify they're active and configured for your use case

### Verifying Deployment

```bash
# Test webhook endpoint
curl -X POST https://your-service-1234-dev.twil.io/handleIncomingCall \
  -u "ACxxxx:your_auth_token" \
  -d "From=%2B15555551234" \
  -d "To=%2B15555555678" \
  -d "CallSid=CAxxxx"

# Expected: TwiML response with <Enqueue> and possibly <Start><Transcription>
```

## Code Reference

### Main Entry Point
`functions/handleIncomingCall.protected.js` - Processes incoming calls, loads config, generates TwiML

**Key Functions:**
- `isEnabled(value)` - Case-insensitive boolean parser
- Configuration loading using `.open` property
- Phone number mapping based on To (dialed) number
- Conditional transcription
- Task attributes building
- TaskRouter enqueue

### Webhook Handler
`functions/handleRealtimeTranscription.protected.js` - Receives transcription events, handles logging, delegates to Sync helper

**Key Features:**
- Global-level import of syncHelper (imported once at cold start for efficiency)
- Basic or detailed logging based on `DETAILED_TRANSCRIPTION_LOGGING` flag
- Always logs errors regardless of logging flag
- Delegates Sync operations to private helper

### Sync Integration
`functions/realtimeTranscriptionSyncHelper.private.js` - Manages Sync resources and routes transcription events

**Key Features:**
- Conditional resource creation based on `REALTIME_TRANSCRIPTION_PARTIAL_RESULTS` flag
- Routes events to appropriate handlers (partial, final, stopped)
- Lazy initialization (only creates resources when needed)
- Uses syncHelper utilities for all Sync operations

### Sync Utilities
`functions/syncHelper.private.js` - Low-level CRUD operations for Twilio Sync

**Key Features:**
- All REST API calls are internal to this module
- Accepts `client` and `syncServiceSid` parameters (not pre-configured syncService object)
- Handles concurrent creation attempts and race conditions
- See [sync-helper.md](sync-helper.md) for complete API documentation

### Configuration Files
- `assets/config.json` - Phone number to conversation config mapping (private asset)
- `.env` - Environment variables (not committed to git)
- `.env-template` - Template with dummy values (safe to commit)
- `package.json` - Requires `twilio: "5.12.1"` for Transcription TwiML support

**Important:** The config is loaded using the `.open` property pattern:
```javascript
const openFile = Runtime.getAssets()["/config.json"].open;
const configData = openFile();
config = JSON.parse(configData);
```
This pattern is required as `.open` is a property that returns a function, not a method.

## Implemented Features (formerly "Next Steps")

The following capabilities from the original roadmap have been implemented:

- **Transcription Storage** — transcripts stored in Twilio Sync (documents for partials, lists for finals)
- **Real-Time Agent Assist** — live transcription displayed in Flex UI via the RealTime Transcription tab
- **AI Operator Results** — Conversation Intelligence operator results (Sentiment, Summary, etc.) displayed in the AI Playground panel
- **Customer Memory** — Memora profile lookup with recall, observations, traits, and conversation summaries

## Support and Resources

### Documentation
- [Twilio Conversation Intelligence](https://www.twilio.com/docs/voice/intelligence)
- [Real-Time Transcription](https://www.twilio.com/docs/voice/twiml/stream#message-transcription)
- [TaskRouter Workflows](https://www.twilio.com/docs/taskrouter/workflow-configuration)
- [Twilio Functions](https://www.twilio.com/docs/serverless/functions-assets/functions)

### Helpful Commands

```bash
# View Function logs in real-time
twilio serverless:logs --tail

# Deploy specific environment
twilio serverless:deploy --environment=dev

# List deployments
twilio serverless:list

# View TaskRouter tasks
twilio api:taskrouter:v1:workspaces:tasks:list --workspace-sid WSxxxx
```

### Getting Help

- **Issues**: Review Function logs and Twilio Debugger
- **TaskRouter**: Check workflow configuration and task attributes
- **Transcription**: Verify Conversation Intelligence config and audio quality

---

## Related Documentation

- [realtime-transcription-sync.md](realtime-transcription-sync.md) - Detailed documentation on Sync integration, data structures, and performance characteristics
- [sync-helper.md](sync-helper.md) - Complete API reference for syncHelper module with examples and best practices

---

**Implementation Version:** 2.1
**Last Updated:** 2026-02-20
**Tested with:** Twilio Serverless Runtime Node.js 22

**Version 2.1 Changes:**
- Replaced `TRANSCRIPTION_DOMAIN` with three-tier domain resolution: `TRANSCRIPTION_DOMAIN_OVERRIDE` > `context.DOMAIN_NAME` > `TRANSCRIPTION_DOMAIN_WHEN_RUN_LOCAL`
- Added `MEMORA_STORE_ID` environment variable for Customer Memory features
- Added `memoraProxy` serverless function for Memora API access
- Added `handleOperatorResult` function for Conversation Intelligence operator results
- Added `handleTaskRouterWorkspaceWebhook` function for conversation cleanup
- Config loading failure now returns error TwiML instead of using defaults

**Version 2.0 Changes:**
- Refactored Sync operations into separate private functions for better organization
- Added `DETAILED_TRANSCRIPTION_LOGGING` environment variable for verbose logging
- Updated syncHelper API to accept `client` and `syncServiceSid` parameters
- Removed sequence ID from list items (lists use timestamp ordering only)
- Added conditional document creation based on `REALTIME_TRANSCRIPTION_PARTIAL_RESULTS`
- Improved performance with global-level module imports
