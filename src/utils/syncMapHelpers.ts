/**
 * Shared utility functions for Sync Map naming conventions
 */

/**
 * Generate the Sync Map name for a given call SID
 * @param callSid - The Twilio call SID
 * @returns The Sync Map name used to track AI playground data for this call
 */
export function getMapName(callSid: string): string {
  return `ai-playground-${callSid}`;
}
