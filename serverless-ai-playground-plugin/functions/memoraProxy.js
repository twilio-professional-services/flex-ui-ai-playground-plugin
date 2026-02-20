/**
 * Memora (Customer Memory) API Proxy
 *
 * Public serverless function secured with twilio-flex-token-validator.
 * Proxies all Memora API calls from the Flex UI, routing based on the
 * `action` parameter: lookup, recall, observations, traits, conversationSummaries,
 * deleteObservation, deleteSummary.
 *
 * Uses native fetch with Basic auth for the memory.twilio.com API
 * (not supported by the Twilio Node helper library).
 */

const TokenValidator =
  require("twilio-flex-token-validator").functionValidator;

const MEMORA_BASE = "https://memory.twilio.com/v1";

function buildResponse(statusCode, body) {
  const response = new Twilio.Response();
  response.setStatusCode(statusCode);
  response.appendHeader("Access-Control-Allow-Origin", "*");
  response.appendHeader("Access-Control-Allow-Methods", "OPTIONS POST GET");
  response.appendHeader("Access-Control-Allow-Headers", "Content-Type");
  response.appendHeader("Content-Type", "application/json");
  response.setBody(body);
  return response;
}

function basicAuth(accountSid, authToken) {
  return "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64");
}

async function memoraFetch(url, { method, headers, body }) {
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const responseBody = await res.json().catch(() => null);

  if (!res.ok) {
    const err = new Error(
      responseBody?.message || `Memora API returned ${res.status}`,
    );
    err.status = res.status;
    err.details = responseBody;
    throw err;
  }

  return responseBody;
}

exports.handler = TokenValidator(async function (context, event, callback) {
  const { action, phone, profileId, query, pageSize, pageToken, orderBy, observationId, summaryId } =
    event;

  const storeId = context.MEMORA_STORE_ID;
  if (!storeId) {
    return callback(
      null,
      buildResponse(500, { error: "MEMORA_STORE_ID not configured" }),
    );
  }

  if (!action) {
    return callback(
      null,
      buildResponse(400, { error: "Missing required parameter: action" }),
    );
  }

  const authHeader = basicAuth(context.ACCOUNT_SID, context.AUTH_TOKEN);
  const baseHeaders = {
    Authorization: authHeader,
    "Content-Type": "application/json",
  };

  try {
    let result;

    switch (action) {
      case "lookup": {
        if (!phone) {
          return callback(
            null,
            buildResponse(400, {
              error: "Missing required parameter: phone",
            }),
          );
        }
        result = await memoraFetch(
          `${MEMORA_BASE}/Stores/${storeId}/Profiles/Lookup`,
          {
            method: "POST",
            headers: baseHeaders,
            body: { idType: "phone", value: phone },
          },
        );
        break;
      }

      case "recall": {
        if (!profileId) {
          return callback(
            null,
            buildResponse(400, {
              error: "Missing required parameter: profileId",
            }),
          );
        }
        const recallBody = {
          observationsLimit: event.observationsLimit !== undefined
            ? parseInt(event.observationsLimit, 10)
            : 20,
          summariesLimit: event.summariesLimit !== undefined
            ? parseInt(event.summariesLimit, 10)
            : 5,
        };
        if (query !== undefined) recallBody.query = query;

        result = await memoraFetch(
          `${MEMORA_BASE}/Stores/${storeId}/Profiles/${profileId}/Recall`,
          {
            method: "POST",
            headers: baseHeaders,
            body: recallBody,
          },
        );
        break;
      }

      case "observations": {
        if (!profileId) {
          return callback(
            null,
            buildResponse(400, {
              error: "Missing required parameter: profileId",
            }),
          );
        }
        const obsParams = new URLSearchParams();
        if (pageSize) obsParams.set("pageSize", pageSize);
        if (pageToken) obsParams.set("pageToken", pageToken);
        obsParams.set("orderBy", orderBy || "DESC");
        const obsQuery = obsParams.toString();

        result = await memoraFetch(
          `${MEMORA_BASE}/Stores/${storeId}/Profiles/${profileId}/Observations${obsQuery ? `?${obsQuery}` : ""}`,
          { method: "GET", headers: baseHeaders },
        );
        break;
      }

      case "traits": {
        if (!profileId) {
          return callback(
            null,
            buildResponse(400, {
              error: "Missing required parameter: profileId",
            }),
          );
        }
        const traitParams = new URLSearchParams();
        if (pageSize) traitParams.set("pageSize", pageSize);
        if (pageToken) traitParams.set("pageToken", pageToken);
        if (orderBy) traitParams.set("orderBy", orderBy);
        const traitQuery = traitParams.toString();

        result = await memoraFetch(
          `${MEMORA_BASE}/Stores/${storeId}/Profiles/${profileId}/Traits${traitQuery ? `?${traitQuery}` : ""}`,
          { method: "GET", headers: baseHeaders },
        );
        break;
      }

      case "conversationSummaries": {
        if (!profileId) {
          return callback(
            null,
            buildResponse(400, {
              error: "Missing required parameter: profileId",
            }),
          );
        }
        const sumParams = new URLSearchParams();
        if (pageSize) sumParams.set("pageSize", pageSize);
        if (pageToken) sumParams.set("pageToken", pageToken);
        sumParams.set("orderBy", orderBy || "DESC");
        const sumQuery = sumParams.toString();

        result = await memoraFetch(
          `${MEMORA_BASE}/Stores/${storeId}/Profiles/${profileId}/ConversationSummaries${sumQuery ? `?${sumQuery}` : ""}`,
          { method: "GET", headers: baseHeaders },
        );
        break;
      }

      case "deleteObservation": {
        if (!profileId || !observationId) {
          return callback(
            null,
            buildResponse(400, {
              error: "Missing required parameters: profileId, observationId",
            }),
          );
        }
        await memoraFetch(
          `${MEMORA_BASE}/Stores/${storeId}/Profiles/${profileId}/Observations/${observationId}`,
          { method: "DELETE", headers: baseHeaders },
        );
        result = { deleted: true };
        break;
      }

      case "deleteSummary": {
        if (!profileId || !summaryId) {
          return callback(
            null,
            buildResponse(400, {
              error: "Missing required parameters: profileId, summaryId",
            }),
          );
        }
        await memoraFetch(
          `${MEMORA_BASE}/Stores/${storeId}/Profiles/${profileId}/ConversationSummaries/${summaryId}`,
          { method: "DELETE", headers: baseHeaders },
        );
        result = { deleted: true };
        break;
      }

      default:
        return callback(
          null,
          buildResponse(400, { error: `Unknown action: ${action}` }),
        );
    }

    console.log(`[memoraProxy] action=${action} response meta:`, JSON.stringify(result?.meta));
    return callback(null, buildResponse(200, result));
  } catch (error) {
    console.error("[memoraProxy] Error:", error.message);
    console.error("[memoraProxy] Details:", JSON.stringify(error.details));
    const statusCode = error.status || 500;
    return callback(
      null,
      buildResponse(statusCode, {
        error: error.message,
        status: statusCode,
      }),
    );
  }
});
