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
    +---> Log all events
          - transcription-started
          - transcription-content
          - transcription-stopped
          - transcription-error
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
TRANSCRIPTION_DOMAIN=your-service-name-1234.twil.io
REALTIME_TRANSCRIPTION=true
REALTIME_TRANSCRIPTION_PARTIAL_RESULTS=false
```

#### Environment Variable Reference

| Variable | Required | Format | Description |
|----------|----------|--------|-------------|
| `ACCOUNT_SID` | Yes | `ACxxxx...` | Twilio Account SID |
| `AUTH_TOKEN` | Yes | String | Twilio Auth Token |
| `WORKFLOW_SID` | Yes | `WWxxxx...` | TaskRouter Workflow SID |
| `TRANSCRIPTION_DOMAIN` | Yes | `service-1234.twil.io` | Serverless domain (no https://) |
| `REALTIME_TRANSCRIPTION` | Yes | `true`/`false` | Enable transcription (case-insensitive) |
| `REALTIME_TRANSCRIPTION_PARTIAL_RESULTS` | Yes | `true`/`false` | Enable partial results (case-insensitive) |

**Note:** Boolean flags are case-insensitive. All of these work: `true`, `True`, `TRUE`, `false`, `False`, `FALSE`

### 2. Phone Number Configuration

Edit `assets/config.json`:

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

The `handleRealtimeTranscription.protected.js` function receives various event types from Twilio.

### Event Type: `transcription-started`

Sent when transcription session begins.

```json
{
  "Event": "transcription-started",
  "CallSid": "CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "AccountSid": "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "Track": "inbound_track",
  "TranscriptionSid": "TRxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
}
```

### Event Type: `transcription-content`

Sent when transcription text is available (final or partial).

```json
{
  "Event": "transcription-content",
  "CallSid": "CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "AccountSid": "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "Track": "inbound_track",
  "TranscriptionSid": "TRxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "TranscriptionText": "Hello, I need help with my account",
  "IsFinal": "true",
  "Confidence": "0.95",
  "LanguageCode": "en-US",
  "Timestamp": "2026-02-16T10:30:45.123Z"
}
```

**Content Fields:**

- `TranscriptionText`: The transcribed text
- `IsFinal`: `true` for final results, `false` for partial (if enabled)
- `Confidence`: Confidence score (0.0 to 1.0)
- `LanguageCode`: Detected/configured language
- `Timestamp`: When the speech occurred

### Event Type: `transcription-stopped`

Sent when transcription session ends (call ends or transcription stopped).

```json
{
  "Event": "transcription-stopped",
  "CallSid": "CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "AccountSid": "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "Track": "inbound_track",
  "TranscriptionSid": "TRxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
}
```

### Event Type: `transcription-error`

Sent when an error occurs during transcription.

```json
{
  "Event": "transcription-error",
  "CallSid": "CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "AccountSid": "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "Track": "inbound_track",
  "TranscriptionSid": "TRxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "ErrorCode": "12345",
  "ErrorMessage": "Description of the error"
}
```

## Testing Procedures

### 1. Configuration Loading Test

Verify the system loads `config.json` correctly:

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
4. Check Function logs for transcription events:
   ```
   === Real-Time Transcription Event ===
   Timestamp: 2026-02-16T10:30:45.123Z
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
4. Check Function logs for `transcription-content` events with `IsFinal: false`

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

1. Configure `targetWorkers` for a phone number in `config.json`
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

Test error handling and fallbacks:

1. Temporarily rename `config.json` to `config.json.bak`
2. Deploy and make a test call
3. Check logs for:
   ```
   Error loading configuration, using defaults: ...
   Using conversation config: conv_configuration_xxx
   ```
4. Verify call still connects successfully

**Expected:** System uses default config, call doesn't fail.

## Troubleshooting Guide

### Problem: Configuration Not Loading

**Symptoms:**
- Logs show: "Error loading configuration, using defaults"
- Wrong conversation config being used

**Solutions:**
1. Verify `config.json` exists in `assets/` directory
2. Check JSON syntax is valid (use JSON validator)
3. Ensure file is included in deployment
4. Check file permissions

### Problem: No Transcription Events

**Symptoms:**
- Calls work but no transcription webhook events in logs
- No `transcription-started` or `transcription-content` events

**Solutions:**
1. Verify `REALTIME_TRANSCRIPTION=true` (check spelling and case)
2. Confirm `TRANSCRIPTION_DOMAIN` matches deployed domain
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
1. Verify phone number in `config.json` matches the **dialed number (To)** exactly - this is YOUR Twilio number, not the caller's number
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
   - Update `TRANSCRIPTION_DOMAIN` in `.env` if it changed
   - Redeploy if you updated `.env`

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
- `isEnabled(value)` - Case-insensitive boolean parser (handleIncomingCall.protected.js:17)
- Configuration loading using `.open` property (handleIncomingCall.protected.js:22-30)
- Phone number mapping based on To (dialed) number (handleIncomingCall.protected.js:42-45)
- Conditional transcription (handleIncomingCall.protected.js:53-77)
- Task attributes building (handleIncomingCall.protected.js:79-86)
- TaskRouter enqueue (handleIncomingCall.protected.js:90-97)

### Webhook Handler
`functions/handleRealtimeTranscription.protected.js` - Receives and logs transcription events

**Key Features:**
- Complete event logging (handleRealtimeTranscription.protected.js:19-49)
- Error handling (handleRealtimeTranscription.protected.js:41-45)

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

## Next Steps and Enhancements

### Potential Improvements

1. **Transcription Storage**
   - Store transcripts in Twilio Sync or external database
   - Enable post-call analysis and reporting

2. **Advanced Routing**
   - Use transcription content for intelligent routing
   - Route based on detected keywords or sentiment
   - Dynamic worker targeting based on skills

3. **Real-Time Agent Assist**
   - Display live transcription to agents in Flex UI
   - Provide real-time suggestions based on conversation
   - Highlight action items or key information

4. **Analytics Integration**
   - Send transcription events to analytics platform
   - Track conversation metrics and KPIs
   - Generate insights on call patterns

5. **Multi-Language Support**
   - Detect language automatically
   - Route to language-appropriate agents
   - Use multiple conversation configs per language

6. **Quality Monitoring**
   - Track transcription accuracy
   - Monitor confidence scores
   - Alert on low-quality transcriptions

7. **Custom Actions**
   - Trigger workflows based on transcription content
   - Automate responses to common phrases
   - Create tasks or tickets from conversation

### Integration Opportunities

- **Twilio Studio**: Use transcription in Studio flows for IVR
- **Flex Insights**: Export transcription metrics
- **Flex Plugins**: Build UI to display transcripts to agents
- **Segment**: Send conversation events to customer data platform
- **Salesforce**: Sync transcripts to case records

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

**Implementation Version:** 1.0
**Last Updated:** 2026-02-16
**Tested with:** Twilio Serverless Runtime Node.js 18
