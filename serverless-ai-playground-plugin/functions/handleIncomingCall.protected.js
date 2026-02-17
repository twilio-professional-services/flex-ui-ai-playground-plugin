/**
 * Handle Incoming Call with Real-Time Transcription and TaskRouter
 *
 * This function:
 * 1. Loads phone number configuration from assets/config.json
 * 2. Maps dialed phone number (To) to conversation config
 * 3. Conditionally enables real-time transcription
 * 4. Enqueues call to TaskRouter with optional worker targeting
 */

exports.handler = (context, event, callback) => {
  // Create a new voice response using TwiML
  const twiml = new Twilio.twiml.VoiceResponse();

  try {
    // ===== Helper Function: Case-insensitive Boolean Parser =====
    const isEnabled = (value) => value?.toLowerCase() === "true";

    // ===== Load Configuration from Assets =====
    let config;

    try {
      const openFile = Runtime.getAssets()["/config.json"].open;
      const configData = openFile();
      config = JSON.parse(configData);
      console.log("Configuration loaded successfully");
    } catch (configError) {
      console.error("Error loading configuration:", configError.message);
      throw new Error(`Failed to load config.json: ${configError.message}`);
    }

    // ===== Extract Call Information =====
    const callerNumber = event.From;
    const dialedNumber = event.To;
    const callSid = event.CallSid;

    console.log(
      `Incoming call from ${callerNumber} to ${dialedNumber} (${callSid})`
    );

    // ===== Map Phone Number to Configuration =====
    const phoneConfig = config.phoneNumberMapping?.[dialedNumber] || {};
    const conversationConfigId =
      phoneConfig.conversationConfigId || config.defaultConversationConfigId;
    const targetWorkers = phoneConfig.targetWorkers || [];

    console.log(`Using conversation config: ${conversationConfigId}`);
    if (targetWorkers.length > 0) {
      console.log(`Target workers specified: ${targetWorkers.join(", ")}`);
    }

    // ===== Conditional Real-Time Transcription =====
    const transcriptionEnabled = isEnabled(context.REALTIME_TRANSCRIPTION);
    const partialResultsEnabled = isEnabled(
      context.REALTIME_TRANSCRIPTION_PARTIAL_RESULTS
    );

    if (transcriptionEnabled) {
      console.log("Real-time transcription enabled");

      // Construct webhook URL
      const webhookUrl = `https://${context.TRANSCRIPTION_DOMAIN}/handleRealtimeTranscription`;

      // Start transcription using SDK 5.12.1+
      const start = twiml.start();
      start.transcription({
        statusCallbackUrl: webhookUrl,
        partialResults: partialResultsEnabled,
        enableAutomaticPunctuation: true,
        conversationConfiguration: conversationConfigId,
      });

      console.log(`Transcription webhook: ${webhookUrl}`);
      console.log(`Partial results: ${partialResultsEnabled}`);
    } else {
      console.log("Real-time transcription disabled");
    }

    // ===== Build Task Attributes =====
    const taskAttributes = {};

    // Add worker targeting if configured
    if (targetWorkers.length > 0) {
      taskAttributes.targetWorkers = true;
      taskAttributes.targetWorkersArray = targetWorkers;
    }

    console.log("Task attributes:", JSON.stringify(taskAttributes, null, 2));

    // ===== Enqueue to TaskRouter =====
    const enqueue = twiml.enqueue({
      workflowSid: context.WORKFLOW_SID,
    });

    enqueue.task({}, JSON.stringify(taskAttributes));

    console.log(`Enqueued to workflow: ${context.WORKFLOW_SID}`);
  } catch (error) {
    // Critical error - log and fall back to simple connection
    console.error("Critical error in handleIncomingCall:", error);
    console.error("Error stack:", error.stack);

    // Clear TwiML and provide fallback
    const fallbackTwiml = new Twilio.twiml.VoiceResponse();
    fallbackTwiml.say(
      { voice: "Polly.Joanna" },
      "We are experiencing technical difficulties. Please try again later."
    );

    return callback(null, fallbackTwiml);
  }

  // Return the TwiML response
  return callback(null, twiml);
};
