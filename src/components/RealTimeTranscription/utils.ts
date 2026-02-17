export function timeAgo(ts: string): string {
  try {
    const seconds = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
    if (seconds < 5) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  } catch {
    return ts;
  }
}

export function getTrackLabel(track: string): string {
  if (track === 'inbound_track') return 'Customer';
  if (track === 'outbound_track') return 'Agent';
  return track;
}

export function getTrackBadgeVariant(track: string): 'neutral' | 'success' {
  return track === 'outbound_track' ? 'success' : 'neutral';
}

export function isAgentTrack(track: string): boolean {
  return track === 'outbound_track';
}
