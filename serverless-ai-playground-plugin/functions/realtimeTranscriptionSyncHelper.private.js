/**
 * Real-Time Transcription Sync Helper (Private Function)
 *
 * This private function contains all the Twilio Sync integration logic
 * for handling real-time transcription events. It can be imported and
 * used by other Twilio Functions.
 *
 * Usage:
 * const helperPath = Runtime.getFunctions()['realtimeTranscriptionSyncHelper'].path;
 * const syncHelper = require(helperPath);
 * await syncHelper.handleSyncIntegration(context, event, detailedLogging);
 */

// Import syncHelper for Twilio Sync operations
const syncHelperPath = Runtime.getFunctions()["syncHelper"].path;
const {
  ensureMap,
  ensureDocument,
  ensureList,
  updateDocumentWithSequence,
  appendToList,
  addMetadataPointer,
} = require(syncHelperPath);

/**
 * Main export: Handles Twilio Sync integration for transcription events
 * @param {Object} context - Twilio Serverless context
 * @param {Object} event - Transcription event data
 * @param {boolean} detailedLogging - Whether to enable detailed logging
 */
exports.handleSyncIntegration = async (
  context,
  event,
  detailedLogging = false
) => {
  try {
    // Initialize Twilio client and get Sync service SID
    const client = context.getTwilioClient();
    const syncServiceSid = context.SYNC_SERVICE_SID || "default";

    // Check if partial results are enabled
    const partialResultsEnabled =
      context.REALTIME_TRANSCRIPTION_PARTIAL_RESULTS?.toLowerCase() === "true";

    // Build Sync resource names
    const callSid = event.CallSid;
    const mapName = `ai-playground-${callSid}`;
    const partialDocName = `partialTranscript-${callSid}`;
    const transcriptionsListName = `transcriptions-${callSid}`;

    // Determine which sync resources are needed based on event type
    const isFinal = event.Final === "true" || event.Final === true;
    const isTranscriptionContent =
      event.TranscriptionEvent === "transcription-content";
    const isTranscriptionStopped =
      event.TranscriptionEvent === "transcription-stopped";

    let docCreated = false;
    let listCreated = false;

    // Only create resources that will be used
    if (isTranscriptionContent && !isFinal && partialResultsEnabled) {
      // Partial transcript: only need document (and only if partial results enabled)
      const result = await ensureDocument(client, syncServiceSid, partialDocName, {});
      docCreated = result.created;
    } else if (isTranscriptionContent && isFinal) {
      // Final transcript: only need list
      const result = await ensureList(client, syncServiceSid, transcriptionsListName);
      listCreated = result.created;
    } else if (isTranscriptionStopped) {
      // Transcription stopped: need list, and document only if partial results were enabled
      const listResult = await ensureList(client, syncServiceSid, transcriptionsListName);
      listCreated = listResult.created;

      if (partialResultsEnabled) {
        const docResult = await ensureDocument(client, syncServiceSid, partialDocName, {});
        docCreated = docResult.created;
      }
    }

    // Only create map and metadata pointers if resources were just created
    if (docCreated || listCreated) {
      await ensureMap(client, syncServiceSid, mapName);

      // Add metadata pointers for resources that were created
      if (docCreated) {
        await addMetadataPointer(
          client,
          syncServiceSid,
          mapName,
          "partialTranscript",
          "doc",
          partialDocName
        );
      }

      if (listCreated) {
        await addMetadataPointer(
          client,
          syncServiceSid,
          mapName,
          "transcriptions",
          "list",
          transcriptionsListName
        );
      }

      if (detailedLogging) {
        console.log(
          `[Sync] Resources initialized for call: ${callSid} (doc: ${docCreated}, list: ${listCreated})`
        );
      }
    }

    // Process transcription events using helper
    await processTranscriptionEvent(
      client,
      syncServiceSid,
      event,
      context,
      partialDocName,
      transcriptionsListName,
      partialResultsEnabled,
      detailedLogging
    );
  } catch (syncError) {
    console.error("Sync error:", syncError);
    console.error("Error details:", {
      message: syncError.message,
      status: syncError.status,
      code: syncError.code,
    });
    // Log but don't fail the webhook - still return 200 OK
  }
};

/**
 * Processes transcription events and updates Sync resources
 * @param {Object} client - Twilio client instance
 * @param {string} syncServiceSid - Sync service SID or unique name
 * @param {Object} event - Transcription event data
 * @param {Object} context - Twilio Serverless context
 * @param {string} partialDocName - Name of the partial transcript document
 * @param {string} transcriptionsListName - Name of the transcriptions list
 * @param {boolean} partialResultsEnabled - Whether partial results are enabled
 * @param {boolean} detailedLogging - Whether to enable detailed logging
 */
async function processTranscriptionEvent(
  client,
  syncServiceSid,
  event,
  context,
  partialDocName,
  transcriptionsListName,
  partialResultsEnabled,
  detailedLogging
) {
  // Handle transcription-content events
  if (
    event.TranscriptionEvent === "transcription-content" &&
    event.TranscriptionData
  ) {
    await handleTranscriptionContent(
      client,
      syncServiceSid,
      event,
      context,
      partialDocName,
      transcriptionsListName,
      partialResultsEnabled,
      detailedLogging
    );
  }
  // Handle transcription-stopped events
  else if (event.TranscriptionEvent === "transcription-stopped") {
    await handleTranscriptionStopped(
      client,
      syncServiceSid,
      event,
      partialDocName,
      transcriptionsListName,
      partialResultsEnabled,
      detailedLogging
    );
  }
}

/**
 * Handles transcription-content events
 */
async function handleTranscriptionContent(
  client,
  syncServiceSid,
  event,
  context,
  partialDocName,
  transcriptionsListName,
  partialResultsEnabled,
  detailedLogging
) {
  const sequenceId = parseInt(event.SequenceId) || 0;

  // Parse TranscriptionData (may be string or object)
  const transcriptionData =
    typeof event.TranscriptionData === "string"
      ? JSON.parse(event.TranscriptionData)
      : event.TranscriptionData;

  const transcriptData = {
    text: transcriptionData.transcript,
    timestamp: event.Timestamp || new Date().toISOString(),
    confidence: transcriptionData.confidence,
    stability: event.Stability ? parseFloat(event.Stability) : undefined,
    languageCode: event.LanguageCode,
    isFinal: event.Final === "true" || event.Final === true,
    transcriptionSid: event.TranscriptionSid,
  };

  // Handle final transcripts
  if (event.Final === "true" || event.Final === true) {
    await handleFinalTranscript(
      client,
      syncServiceSid,
      event,
      transcriptData,
      sequenceId,
      partialDocName,
      transcriptionsListName,
      partialResultsEnabled,
      detailedLogging
    );
  }
  // Handle partial transcripts
  else {
    await handlePartialTranscript(
      client,
      syncServiceSid,
      event,
      context,
      transcriptData,
      sequenceId,
      partialDocName,
      partialResultsEnabled,
      detailedLogging
    );
  }
}

/**
 * Handles final transcript events
 */
async function handleFinalTranscript(
  client,
  syncServiceSid,
  event,
  transcriptData,
  sequenceId,
  partialDocName,
  transcriptionsListName,
  partialResultsEnabled,
  detailedLogging
) {
  // Append to list (use timestamp, not sequence ID for list items)
  const listItem = {
    ...transcriptData,
    track: event.Track,
  };
  await appendToList(client, syncServiceSid, transcriptionsListName, listItem);

  if (detailedLogging) {
    console.log(
      `[Sync] Final transcript added: track=${event.Track} timestamp=${transcriptData.timestamp}`
    );
  }

  // Clear partial transcript for inbound track only (if partial results are enabled)
  // Use sequence ID here to prevent out-of-order updates to the document
  if (event.Track === "inbound_track" && partialResultsEnabled) {
    await updateDocumentWithSequence(
      client,
      syncServiceSid,
      partialDocName,
      event.Track,
      sequenceId,
      { text: "" } // Clear the text
    );
  }
}

/**
 * Handles partial transcript events
 */
async function handlePartialTranscript(
  client,
  syncServiceSid,
  event,
  context,
  transcriptData,
  sequenceId,
  partialDocName,
  partialResultsEnabled,
  detailedLogging
) {
  // Skip if partial results are not enabled
  if (!partialResultsEnabled) {
    if (detailedLogging) {
      console.log(
        "[Sync] Skipping partial transcript: REALTIME_TRANSCRIPTION_PARTIAL_RESULTS not enabled"
      );
    }
    return;
  }

  // Check stability threshold
  const partialStableThreshold =
    parseFloat(context.PARTIAL_STABLE_THRESHOLD) || 0.7;

  if (
    event.Stability &&
    parseFloat(event.Stability) < partialStableThreshold
  ) {
    if (detailedLogging) {
      console.log(
        `[Sync] Skipping unstable partial: stability=${event.Stability} < threshold=${partialStableThreshold}`
      );
    }
    return;
  }

  // Only update document for inbound track (customer)
  if (event.Track === "inbound_track") {
    await updateDocumentWithSequence(
      client,
      syncServiceSid,
      partialDocName,
      event.Track,
      sequenceId,
      transcriptData
    );

    if (detailedLogging) {
      console.log(
        `[Sync] Partial transcript updated: seq=${sequenceId} track=${event.Track} stability=${event.Stability}`
      );
    }
  }
}

/**
 * Handles transcription-stopped events
 */
async function handleTranscriptionStopped(
  client,
  syncServiceSid,
  event,
  partialDocName,
  transcriptionsListName,
  partialResultsEnabled,
  detailedLogging
) {
  const sequenceId = parseInt(event.SequenceId) || 0;

  // Add an "ended" entry to the list (use timestamp, not sequence ID)
  await appendToList(client, syncServiceSid, transcriptionsListName, {
    event: "transcription-stopped",
    timestamp: new Date().toISOString(),
    callSid: event.CallSid,
  });

  // Clear inbound track in the partial transcript document (only if partial results were enabled)
  // Use sequence ID here to prevent out-of-order updates to the document
  if (partialResultsEnabled) {
    await updateDocumentWithSequence(
      client,
      syncServiceSid,
      partialDocName,
      "inbound_track",
      sequenceId,
      { text: "", cleared: true, clearedAt: new Date().toISOString() }
    );

    if (detailedLogging) {
      console.log(
        "[Sync] Transcription ended: list updated, inbound track cleared"
      );
    }
  } else if (detailedLogging) {
    console.log("[Sync] Transcription ended: list updated");
  }
}
