/**
 * Reusable Twilio Sync Helper Functions
 *
 * Provides low-level CRUD operations for Twilio Sync resources.
 * Can be imported by any serverless function that needs Sync access.
 *
 * All functions accept a Twilio client and syncServiceSid instead of a
 * pre-configured syncService object, keeping REST API operations internal.
 */

/**
 * Ensures a Sync Map exists, creates if not found
 * Handles concurrent creation attempts (error 54301)
 * @param {Object} client - Twilio client instance
 * @param {string} syncServiceSid - Sync service SID or unique name
 * @param {string} mapName - Unique name for the map
 * @returns {Promise<Object>} The map instance
 */
async function ensureMap(client, syncServiceSid, mapName) {
  const syncService = client.sync.v1.services(syncServiceSid);

  try {
    return await syncService.syncMaps(mapName).fetch();
  } catch (error) {
    if (error.status === 404) {
      try {
        return await syncService.syncMaps.create({ uniqueName: mapName });
      } catch (createError) {
        // Error 54301 = resource already exists (concurrent create)
        if (createError.code === 54301) {
          // Another request created it, fetch again
          return await syncService.syncMaps(mapName).fetch();
        }
        throw createError;
      }
    }
    throw error;
  }
}

/**
 * Ensures a Sync Document exists, creates if not found
 * Handles concurrent creation attempts (error 54301)
 * @param {Object} client - Twilio client instance
 * @param {string} syncServiceSid - Sync service SID or unique name
 * @param {string} docName - Unique name for the document
 * @param {Object} initialData - Initial data if creating (default: {})
 * @returns {Promise<Object>} Object with { resource, created: boolean }
 */
async function ensureDocument(client, syncServiceSid, docName, initialData = {}) {
  const syncService = client.sync.v1.services(syncServiceSid);

  try {
    const doc = await syncService.documents(docName).fetch();
    return { resource: doc, created: false };
  } catch (error) {
    if (error.status === 404) {
      try {
        const doc = await syncService.documents.create({
          uniqueName: docName,
          data: initialData
        });
        return { resource: doc, created: true };
      } catch (createError) {
        // Error 54301 = resource already exists (concurrent create)
        if (createError.code === 54301) {
          // Another request created it, fetch again
          const doc = await syncService.documents(docName).fetch();
          return { resource: doc, created: false };
        }
        throw createError;
      }
    }
    throw error;
  }
}

/**
 * Ensures a Sync List exists, creates if not found
 * Handles concurrent creation attempts (error 54301)
 * @param {Object} client - Twilio client instance
 * @param {string} syncServiceSid - Sync service SID or unique name
 * @param {string} listName - Unique name for the list
 * @returns {Promise<Object>} Object with { resource, created: boolean }
 */
async function ensureList(client, syncServiceSid, listName) {
  const syncService = client.sync.v1.services(syncServiceSid);

  try {
    const list = await syncService.syncLists(listName).fetch();
    return { resource: list, created: false };
  } catch (error) {
    if (error.status === 404) {
      try {
        const list = await syncService.syncLists.create({ uniqueName: listName });
        return { resource: list, created: true };
      } catch (createError) {
        // Error 54301 = resource already exists (concurrent create)
        if (createError.code === 54301) {
          // Another request created it, fetch again
          const list = await syncService.syncLists(listName).fetch();
          return { resource: list, created: false };
        }
        throw createError;
      }
    }
    throw error;
  }
}

/**
 * Creates or updates a Sync Map item
 * @param {Object} client - Twilio client instance
 * @param {string} syncServiceSid - Sync service SID or unique name
 * @param {string} mapName - Map unique name
 * @param {string} key - Item key
 * @param {Object} data - Item data (JSON)
 * @returns {Promise<Object>} The map item
 */
async function upsertMapItem(client, syncServiceSid, mapName, key, data) {
  const syncService = client.sync.v1.services(syncServiceSid);

  try {
    // Try to update existing item
    return await syncService
      .syncMaps(mapName)
      .syncMapItems(key)
      .update({ data });
  } catch (error) {
    if (error.status === 404) {
      // Item doesn't exist, create it
      return await syncService
        .syncMaps(mapName)
        .syncMapItems
        .create({ key, data });
    }
    throw error;
  }
}

/**
 * Updates a Sync Document with optimistic concurrency control
 * Uses etag (revision) and SequenceId to prevent race conditions
 * Based on pattern from flex-realtime-transcription
 *
 * @param {Object} client - Twilio client instance
 * @param {string} syncServiceSid - Sync service SID or unique name
 * @param {string} docName - Document unique name
 * @param {string} attributeName - Key within document to update (e.g., 'inbound_track')
 * @param {number} sequenceId - Sequence ID from transcription event (for ordering)
 * @param {Object} data - New data for this attribute
 * @returns {Promise<Object>} The updated document
 */
async function updateDocumentWithSequence(
  client,
  syncServiceSid,
  docName,
  attributeName,
  sequenceId,
  data
) {
  const syncService = client.sync.v1.services(syncServiceSid);

  // Fetch current document to get revision (etag)
  const { resource: doc } = await ensureDocument(client, syncServiceSid, docName, {});
  const currentData = doc.data || {};
  const attributeData = currentData[attributeName] || {};

  // Check if we already have a newer SequenceId - skip if stale
  if (
    parseInt(sequenceId) !== 0 &&
    attributeData.sequenceId &&
    parseInt(attributeData.sequenceId) >= parseInt(sequenceId)
  ) {
    return doc;
  }

  // Build updated data with new SequenceId
  const updatedData = {
    ...currentData,
    [attributeName]: { sequenceId, ...data }
  };

  try {
    // Use ifMatch with revision for optimistic locking
    return await syncService.documents(docName).update({
      ifMatch: doc.revision, // Only update if revision matches
      data: updatedData
    });
  } catch (error) {
    // Error code 54103 = revision mismatch (document was modified)
    if (error.code === 54103) {
      // Wait and retry
      await new Promise((resolve) => setTimeout(resolve, 500));
      return await updateDocumentWithSequence(
        client,
        syncServiceSid,
        docName,
        attributeName,
        sequenceId,
        data
      );
    }
    throw error;
  }
}

/**
 * Appends an item to a Sync List
 * @param {Object} client - Twilio client instance
 * @param {string} syncServiceSid - Sync service SID or unique name
 * @param {string} listName - List unique name
 * @param {Object} data - Item data (JSON)
 * @returns {Promise<Object>} The created list item
 */
async function appendToList(client, syncServiceSid, listName, data) {
  const syncService = client.sync.v1.services(syncServiceSid);
  return await syncService.syncLists(listName).syncListItems.create({ data });
}

/**
 * Helper to add metadata map items that point to other Sync objects
 * Used for the SyncToRedux pattern
 * @param {Object} client - Twilio client instance
 * @param {string} syncServiceSid - Sync service SID or unique name
 * @param {string} mapName - Map unique name
 * @param {string} key - Item key (e.g., 'partialTranscript')
 * @param {string} syncObjectType - 'doc', 'list', or 'map'
 * @param {string} syncObjectName - Name of the target Sync object
 * @returns {Promise<Object>} The created map item
 */
async function addMetadataPointer(
  client,
  syncServiceSid,
  mapName,
  key,
  syncObjectType,
  syncObjectName
) {
  const metadata = {
    syncObjectType,
    syncObjectName
  };

  return await upsertMapItem(client, syncServiceSid, mapName, key, metadata);
}

module.exports = {
  ensureMap,
  ensureDocument,
  ensureList,
  upsertMapItem,
  updateDocumentWithSequence,
  appendToList,
  addMetadataPointer
};
