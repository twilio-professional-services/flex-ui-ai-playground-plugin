/**
 * Conversation Events Webhook Handler
 *
 * Receives Maestro Conversation event webhooks and handles PARTICIPANT_ADDED events.
 * When a new participant is added whose name matches one of the account's
 * Twilio phone numbers (and is not already typed as HUMAN_AGENT), updates the
 * participant type to HUMAN_AGENT via the v2 Conversations API.
 */

exports.handler = async (context, event, callback) => {
  const response = new Twilio.Response();
  response.setStatusCode(200);
  response.setBody({ success: true });

  // Only handle PARTICIPANT_ADDED events
  if (event.eventType !== "PARTICIPANT_ADDED") {
    return callback(null, response);
  }

  try {
    const data = event.data || {};
    const participantName = data.name;
    const participantType = data.type;

    // Skip if already HUMAN_AGENT
    if (participantType === "HUMAN_AGENT") {
      console.log(
        "[ConversationEvents] Participant already HUMAN_AGENT, skipping",
      );
      return callback(null, response);
    }

    if (!participantName) {
      console.log("[ConversationEvents] No participant name, skipping");
      return callback(null, response);
    }

    console.log(
      `[ConversationEvents] PARTICIPANT_ADDED: ${participantName} (type: ${participantType})`,
    );

    // Fetch account phone numbers and check for a match
    const client = context.getTwilioClient();
    const incomingNumbers = await client.incomingPhoneNumbers.list();
    const accountNumbers = incomingNumbers.map((n) => n.phoneNumber);

    if (!accountNumbers.includes(participantName)) {
      console.log(
        `[ConversationEvents] ${participantName} not found in account numbers, skipping`,
      );
      return callback(null, response);
    }

    console.log(
      `[ConversationEvents] ${participantName} matches account number, updating to HUMAN_AGENT`,
    );

    // Update participant type via v2 Conversations API (not in Twilio Node SDK, use fetch)
    const { conversationId, id: participantId, accountId } = data;
    const authHeader =
      "Basic " +
      Buffer.from(`${context.ACCOUNT_SID}:${context.AUTH_TOKEN}`).toString(
        "base64",
      );

    const updateRes = await fetch(
      `https://conversations.twilio.com/v2/Conversations/${conversationId}/Participants/${participantId}`,
      {
        method: "PUT",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ type: "HUMAN_AGENT" }),
      },
    );

    if (!updateRes.ok) {
      const errBody = await updateRes.text().catch(() => "");
      throw new Error(
        `Conversations API returned ${updateRes.status}: ${errBody}`,
      );
    }

    console.log(
      `[ConversationEvents] Updated participant ${participantId} to HUMAN_AGENT`,
    );
  } catch (error) {
    console.error("[ConversationEvents] Error:", error.message);
    console.error("[ConversationEvents] Stack:", error.stack);
  }

  return callback(null, response);
};
