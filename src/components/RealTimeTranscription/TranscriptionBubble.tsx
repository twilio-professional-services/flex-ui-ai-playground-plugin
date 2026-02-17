import React from 'react';
import { Box, Text, Badge } from '@twilio-paste/core';
import { TranscriptionItem } from './types';
import { timeAgo, getTrackLabel, getTrackBadgeVariant, isAgentTrack } from './utils';

interface TranscriptionBubbleProps {
  item: TranscriptionItem;
}

const TranscriptionBubble: React.FC<TranscriptionBubbleProps> = ({ item }) => {
  const agent = isAgentTrack(item.track);

  return (
    <Box display="flex" justifyContent={agent ? 'flex-end' : 'flex-start'}>
      <Box
        padding="space30"
        borderRadius="borderRadius20"
        backgroundColor="colorBackgroundBody"
        borderWidth="borderWidth10"
        borderStyle="solid"
        borderColor="colorBorderWeaker"
        maxWidth="85%"
      >
        <Box display="flex" justifyContent="space-between" alignItems="center" marginBottom="space20">
          <Badge as="span" variant={getTrackBadgeVariant(item.track)}>
            {getTrackLabel(item.track)}
          </Badge>
          <Text as="span" fontSize="fontSize20" color="colorTextWeak" marginLeft="space30">
            {timeAgo(item.timestamp)}
          </Text>
        </Box>
        <Text as="p" fontSize="fontSize30">{item.text}</Text>
        {item.confidence != null && item.confidence < 0.7 && (
          <Text as="p" fontSize="fontSize20" color="colorTextWarningStrong" marginTop="space10">
            Low confidence
          </Text>
        )}
      </Box>
    </Box>
  );
};

export default TranscriptionBubble;
