/**
 * Handle TaskRouter Workspace Webhook
 *
 * Receives TaskRouter workspace event callbacks.
 * On task.wrapup, task.completed, or task.deleted, closes the
 * associated Maestro v2 conversation by looking it up via the
 * call SID (channelId).
 */

const CONVERSATIONS_BASE = "https://conversations.twilio.com/v2";

function basicAuth(accountSid, authToken) {
  return (
    "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64")
  );
}

// This is a workaround to close conversations when tasks are completed, wrapped up, or deleted.
// <Transcription /> hydrated conversations were not being automatically closed in Twilio Prod due to a regression.
// At the time of writing, this issue has been fixed in production, but this code is left here for reference
// in case the regression resurfaces or for deployments where the fix is not yet available.
exports.handler = async function (context, event, callback) {
  const response = new Twilio.Response();
  response.setStatusCode(200);
  response.appendHeader("Content-Type", "application/json");
  response.setBody({ success: true });

  const eventType = event.EventType;

  const handledEvents = [
    "task.wrapup",
    "task.completed",
    "task.canceled",
    "task.deleted ",
  ];
  if (!handledEvents.includes(eventType)) {
    return callback(null, response);
  }

  console.log(`[TaskRouterWebhook] Processing ${eventType}`);

  let taskAttributes;
  try {
    taskAttributes = JSON.parse(event.TaskAttributes || "{}");
  } catch (err) {
    console.error(
      `[TaskRouterWebhook] Error parsing TaskAttributes:`,
      err.message,
    );
    return callback(null, response);
  }

  const callSid = taskAttributes.call_sid;
  if (!callSid) {
    console.log(`[TaskRouterWebhook] No call_sid in task attributes, skipping`);
    return callback(null, response);
  }

  console.log(`[TaskRouterWebhook] call_sid: ${callSid}`);

  const authHeader = basicAuth(context.ACCOUNT_SID, context.AUTH_TOKEN);
  const headers = {
    Authorization: authHeader,
    "Content-Type": "application/json",
  };

  try {
    // 1. Find active conversation by call SID
    const listRes = await fetch(
      `${CONVERSATIONS_BASE}/Conversations?channelId=${encodeURIComponent(callSid)}&status=ACTIVE`,
      { method: "GET", headers },
    );

    if (!listRes.ok) {
      const body = await listRes.text().catch(() => "");
      console.error(
        `[TaskRouterWebhook] List conversations failed: ${listRes.status} ${body}`,
      );
      return callback(null, response);
    }

    const listData = await listRes.json();
    const conversations = listData.conversations || [];

    if (conversations.length === 0) {
      console.log(
        `[TaskRouterWebhook] No active conversation found for channelId=${callSid}`,
      );
      return callback(null, response);
    }

    // 2. Close each active conversation
    for (const conversation of conversations) {
      console.log(
        `[TaskRouterWebhook] Closing conversation ${conversation.id}`,
      );
      const updateRes = await fetch(
        `${CONVERSATIONS_BASE}/Conversations/${conversation.id}`,
        {
          method: "PUT",
          headers,
          body: JSON.stringify({ status: "CLOSED" }),
        },
      );

      if (!updateRes.ok) {
        const body = await updateRes.text().catch(() => "");
        console.error(
          `[TaskRouterWebhook] Close conversation ${conversation.id} failed: ${updateRes.status} ${body}`,
        );
      } else {
        console.log(
          `[TaskRouterWebhook] Conversation ${conversation.id} closed`,
        );
      }
    }
  } catch (err) {
    console.error(`[TaskRouterWebhook] Error:`, err.message);
  }

  return callback(null, response);
};
