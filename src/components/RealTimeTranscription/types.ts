export interface TranscriptionItem {
  text: string;
  track: string;
  confidence: number;
  timestamp: string;
  sequenceId: number;
  isFinal: boolean;
  languageCode: string;
}

export interface EventItem {
  event: string;
  callSid: string;
  sequenceId: number;
  timestamp: string;
}

export interface PartialTrack {
  text: string;
  sequenceId: number;
  cleared: boolean;
  clearedAt?: string;
}

export interface PartialTranscriptData {
  inbound_track?: PartialTrack;
  outbound_track?: PartialTrack;
}

export type ListItem = TranscriptionItem | EventItem;

export function isEventItem(item: ListItem): item is EventItem {
  return 'event' in item;
}
