import React from 'react';
import { Box, Text, Badge } from '@twilio-paste/core';
import { getTrackLabel, getTrackBadgeVariant, isAgentTrack } from './utils';

interface PartialBubbleProps {
  track: string;
  text: string;
}

const PartialBubble: React.FC<PartialBubbleProps> = ({ track, text }) => {
  const agent = isAgentTrack(track);

  return (
    <Box display="flex" justifyContent={agent ? 'flex-end' : 'flex-start'}>
      <Box
        padding="space30"
        borderRadius="borderRadius20"
        backgroundColor="colorBackgroundNew"
        borderWidth="borderWidth10"
        borderStyle="solid"
        borderColor="colorBorderPrimary"
        maxWidth="85%"
      >
        <Box display="flex" alignItems="center" marginBottom="space20">
          <Badge as="span" variant={getTrackBadgeVariant(track)}>
            {getTrackLabel(track)}
          </Badge>
          <Text as="span" fontSize="fontSize20" color="colorTextWeak" marginLeft="space20">
            speaking...
          </Text>
        </Box>
        <Text as="p" fontSize="fontSize30" fontStyle="italic" color="colorTextWeak">
          {text}
        </Text>
      </Box>
    </Box>
  );
};

export default PartialBubble;
