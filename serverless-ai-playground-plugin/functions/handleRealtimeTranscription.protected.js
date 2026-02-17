/**
 * Real-Time Transcription Webhook Handler
 *
 * This protected function receives real-time transcription events from Twilio.
 * Events include:
 * - transcription-started: Transcription session begins
 * - transcription-content: Text segments available (final or partial)
 * - transcription-stopped: Transcription session ends
 * - transcription-error: An error occurred during transcription
 *
 * All events are logged for debugging and analysis.
 * Transcription data is stored in Twilio Sync for real-time access and post-call review.
 */

// Import sync helper at global level for efficiency
const syncHelperPath =
  Runtime.getFunctions()["realtimeTranscriptionSyncHelper"].path;
const syncHelper = require(syncHelperPath);

exports.handler = async (context, event, callback) => {
  // Create a new voice response
  const twiml = new Twilio.twiml.VoiceResponse();

  // Check if detailed logging is enabled
  const detailedLogging =
    context.DETAILED_TRANSCRIPTION_LOGGING?.toLowerCase() === "true";

  try {
    // Always log basic event info
    console.log(
      `[Transcription] ${event.TranscriptionEvent || "unknown"} - CallSID: ${event.CallSid || "N/A"}`
    );

    // Detailed logging behind flag
    if (detailedLogging) {
      console.log("=== Real-Time Transcription Event (Detailed) ===");
      console.log("Timestamp:", new Date().toISOString());

      // Log complete event payload
      console.log("Complete Event Payload:", JSON.stringify(event, null, 2));

      // Extract and log key fields for easier debugging
      console.log("\nExtracted Key Fields:");
      console.log("- Event Type:", event.TranscriptionEvent || "N/A");
      console.log("- Call SID:", event.CallSid || "N/A");
      console.log("- Account SID:", event.AccountSid || "N/A");
      console.log("- Track:", event.Track || "N/A");
      console.log("- Sequence ID:", event.SequenceId || "N/A");
      console.log("- Transcription SID:", event.TranscriptionSid || "N/A");

      // Log transcription-specific fields if present
      if (event.TranscriptionData) {
        try {
          const transcriptionData =
            typeof event.TranscriptionData === "string"
              ? JSON.parse(event.TranscriptionData)
              : event.TranscriptionData;
          console.log(
            "- Transcription Text:",
            transcriptionData.transcript || "N/A"
          );
          console.log("- Confidence:", transcriptionData.confidence || "N/A");
        } catch (parseError) {
          console.log("- Transcription Data (raw):", event.TranscriptionData);
        }
        console.log("- Is Final:", event.Final || "N/A");
        console.log("- Stability:", event.Stability || "N/A");
        console.log("- Language Code:", event.LanguageCode || "N/A");
      }

      // Log error details if present
      if (event.ErrorCode || event.ErrorMessage) {
        console.log("- Error Code:", event.ErrorCode || "N/A");
        console.log("- Error Message:", event.ErrorMessage || "N/A");
      }

      console.log("===================================\n");
    }

    // Always log errors regardless of flag
    if (event.ErrorCode || event.ErrorMessage) {
      console.error(
        `[Transcription Error] Code: ${event.ErrorCode || "N/A"}, Message: ${event.ErrorMessage || "N/A"}`
      );
    }

    // Process transcription events and store in Twilio Sync
    if (event.CallSid) {
      // Call the sync integration handler
      await syncHelper.handleSyncIntegration(context, event, detailedLogging);
    } else {
      console.error(
        "[Transcription Error] Missing CallSid, cannot process Sync integration"
      );
    }
  } catch (error) {
    // Log any errors in processing, but still return success to Twilio
    console.error("Error processing transcription webhook:", error);
    console.error("Error stack:", error.stack);
  }

  // Always return 200 OK to Twilio to continue receiving events
  // Empty TwiML response is sufficient
  return callback(null, twiml);
};
