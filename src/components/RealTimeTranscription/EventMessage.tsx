import React from 'react';
import { Box, Text } from '@twilio-paste/core';
import { EventItem } from './types';
import { timeAgo } from './utils';

interface EventMessageProps {
  item: EventItem;
}

const EventMessage: React.FC<EventMessageProps> = ({ item }) => (
  <Box paddingY="space20" textAlign="center">
    <Text as="span" fontSize="fontSize20" color="colorTextWeak" fontStyle="italic">
      {item.event} — {timeAgo(item.timestamp)}
    </Text>
  </Box>
);

export default EventMessage;
