/**
 * CIntel Operator Result Webhook Handler
 *
 * Receives Conversation Intelligence webhook callbacks when AI operator
 * results are available (e.g., extracted questionnaire answers).
 * Stores results in Twilio Sync so the frontend can display them in
 * real-time via the SyncToRedux pattern.
 *
 * Each operator gets its own Sync List (append-only history), and a
 * metadata pointer is added to the call's top-level Sync Map so the
 * frontend can discover and subscribe to it.
 */

const syncHelperPath = Runtime.getFunctions()["syncHelper"].path;
const syncHelper = require(syncHelperPath);

exports.handler = async (context, event, callback) => {
  const response = new Twilio.Response();
  response.setStatusCode(200);
  response.setBody({ success: true });

  try {
    const client = context.getTwilioClient();
    const syncServiceSid = context.SYNC_SERVICE_SID;

    const operatorResults = event.operatorResults || [];

    if (operatorResults.length === 0) {
      console.log("[OperatorResult] No operatorResults in event payload");
      return callback(null, response);
    }

    for (const operatorResult of operatorResults) {
      try {
        const referenceIds = operatorResult.referenceIds || [];
        if (referenceIds.length === 0) {
          console.error("[OperatorResult] No referenceIds found, skipping");
          continue;
        }

        const displayName = operatorResult.operator?.displayName;
        const outputFormat = operatorResult.outputFormat;
        const result = operatorResult.result;
        const dateCreated = operatorResult.dateCreated;
        const triggerOn = operatorResult.executionDetails?.trigger?.on;

        if (!displayName || !triggerOn) {
          console.error(
            "[OperatorResult] Missing displayName or trigger.on, skipping:",
            JSON.stringify({ displayName, triggerOn, referenceIds })
          );
          continue;
        }

        const metadataKey = `OPERATOR-${triggerOn}-${displayName}`;
        const itemData = {
          displayName,
          outputFormat,
          result,
          dateCreated,
          triggerOn,
        };

        console.log(
          `[OperatorResult] Processing: ${metadataKey} for ${referenceIds.length} call(s)`
        );

        // Store the operator result for each referenced call
        for (const callSid of referenceIds) {
          const metadataMapName = `ai-playground-${callSid}`;
          const listName = `OPERATOR-${triggerOn}-${displayName}-${callSid}`;

          const { created: listCreated } = await syncHelper.ensureList(client, syncServiceSid, listName);

          await syncHelper.appendToList(client, syncServiceSid, listName, itemData);

          // Only write metadata pointer when the list is first created.
          // The pointer data never changes, so subsequent writes just trigger
          // redundant itemUpdated events on the frontend.
          if (listCreated) {
            await syncHelper.ensureMap(client, syncServiceSid, metadataMapName);

            await syncHelper.addMetadataPointer(
              client,
              syncServiceSid,
              metadataMapName,
              metadataKey,
              "list",
              listName
            );
          }
        }

        console.log(
          `[OperatorResult] Stored result for ${metadataKey}`
        );
      } catch (itemError) {
        console.error(
          "[OperatorResult] Error processing operator result:",
          itemError.message
        );
        console.error("[OperatorResult] Stack:", itemError.stack);
      }
    }
  } catch (error) {
    console.error("[OperatorResult] Top-level error:", error.message);
    console.error("[OperatorResult] Stack:", error.stack);
  }

  return callback(null, response);
};
