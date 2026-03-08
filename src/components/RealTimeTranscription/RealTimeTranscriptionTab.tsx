import React from 'react';
import * as Flex from '@twilio/flex-ui';
import { Box, Text, Stack } from '@twilio-paste/core';
import { useSyncObject } from '../../utils/sync-to-redux/hooks';
import { ListItem, PartialTranscriptData, isEventItem } from './types';
import TranscriptionBubble from './TranscriptionBubble';
import PartialBubble from './PartialBubble';
import EventMessage from './EventMessage';
import { getMapName } from '../../utils/syncMapHelpers';

interface RealTimeTranscriptionTabProps {
  task?: Flex.ITask;
}

const RealTimeTranscriptionTab: React.FC<RealTimeTranscriptionTabProps> = ({ task }) => {
  const callSid = task?.attributes?.call_sid;
  const mapName = callSid ? getMapName(callSid) : '';

  const transcriptionsObj = useSyncObject(mapName, 'transcriptions');
  const partialTranscriptObj = useSyncObject(mapName, 'partialTranscript');

  const items: ListItem[] = transcriptionsObj?.items || [];
  const reversedItems = [...items].reverse();
  const partialData: PartialTranscriptData | undefined = partialTranscriptObj?.data;

  if (!callSid) {
    return (
      <Box padding="space60">
        <Text as="p" color="colorTextWeak">No call SID available.</Text>
      </Box>
    );
  }

  const activePartials: { track: string; text: string }[] = [];
  if (partialData?.inbound_track && !partialData.inbound_track.cleared && partialData.inbound_track.text) {
    activePartials.push({ track: 'inbound_track', text: partialData.inbound_track.text });
  }
  if (partialData?.outbound_track && !partialData.outbound_track.cleared && partialData.outbound_track.text) {
    activePartials.push({ track: 'outbound_track', text: partialData.outbound_track.text });
  }

  if (items.length === 0 && activePartials.length === 0) {
    return (
      <Box padding="space60">
        <Text as="p" color="colorTextWeak">Waiting for transcription data...</Text>
      </Box>
    );
  }

  return (
    <Box overflowY="auto" padding="space40" style={{ height: '100%' }}>
      <Stack orientation="vertical" spacing="space30">
        {activePartials.map((partial) => (
          <PartialBubble key={`partial-${partial.track}`} track={partial.track} text={partial.text} />
        ))}

        {reversedItems.map((item, index) => {
          if (isEventItem(item)) {
            return <EventMessage key={`event-${item.sequenceId ?? index}`} item={item} />;
          }
          return <TranscriptionBubble key={`t-${item.sequenceId ?? index}`} item={item} />;
        })}
      </Stack>
    </Box>
  );
};

export default Flex.withTaskContext(RealTimeTranscriptionTab);
