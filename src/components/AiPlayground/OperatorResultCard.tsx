import React, { useRef, useState, useEffect } from 'react';
import { Box } from '@twilio-paste/core/box';
import { Text } from '@twilio-paste/core/text';
import { Badge } from '@twilio-paste/core/badge';
import { Button } from '@twilio-paste/core/button';
import { Tooltip } from '@twilio-paste/core/tooltip';
import { useSpring, animated } from '@twilio-paste/core/animation-library';
import { OperatorResult } from './types';
import { formatResultValue } from './utils';

interface OperatorResultCardProps {
  items: OperatorResult[];
}

const OperatorResultCard: React.FC<OperatorResultCardProps> = ({ items }) => {
  const prevLengthRef = useRef(items.length);
  const [isNew, setIsNew] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // Track whether user is pinned to latest
  const isFollowingLatest = selectedIndex === null || selectedIndex >= items.length - 1;

  // Auto-advance to latest when new items arrive and user is following latest
  useEffect(() => {
    if (items.length > prevLengthRef.current) {
      setIsNew(true);
      if (isFollowingLatest) {
        setSelectedIndex(null);
      }
      const timer = setTimeout(() => setIsNew(false), 1500);
      prevLengthRef.current = items.length;
      return () => clearTimeout(timer);
    }
    prevLengthRef.current = items.length;
  }, [items.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const springStyles = useSpring({
    borderColor: isNew ? 'rgba(2, 99, 224, 0.6)' : 'rgba(136, 145, 170, 0.2)',
    backgroundColor: isNew ? 'rgba(2, 99, 224, 0.04)' : 'rgba(0, 0, 0, 0)',
    config: { tension: 200, friction: 20 },
  });

  if (items.length === 0) {
    return (
      <Box padding="space60">
        <Text as="p" color="colorTextWeak">Waiting for operator results...</Text>
      </Box>
    );
  }

  const currentIndex = selectedIndex !== null ? Math.min(selectedIndex, items.length - 1) : items.length - 1;
  const current = items[currentIndex];
  const outputFormat = current.outputFormat;
  const formattedValue = formatResultValue(current);
  const isAtLatest = currentIndex === items.length - 1;

  const goBack = () => setSelectedIndex(Math.max(0, currentIndex - 1));
  const goForward = () => {
    const next = currentIndex + 1;
    if (next >= items.length - 1) {
      setSelectedIndex(null); // snap back to following latest
    } else {
      setSelectedIndex(next);
    }
  };
  const goToLatest = () => setSelectedIndex(null);

  return (
    <animated.div
      style={{
        ...springStyles,
        borderWidth: '2px',
        borderStyle: 'solid',
        borderRadius: '8px',
        padding: '16px',
        margin: '8px 0',
        maxWidth: '100%',
        boxSizing: 'border-box',
      } as any}
    >
      <Box display="flex" alignItems="center" justifyContent="space-between" marginBottom="space30">
        <Box display="flex" alignItems="center" columnGap="space30">
          {outputFormat && (
            <Badge as="span" variant="decorative10">{outputFormat}</Badge>
          )}
          <Text as="span" color="colorTextWeak" fontSize="fontSize20">
            Result {currentIndex + 1} of {items.length}
          </Text>
        </Box>
        <Box display="flex" alignItems="center" columnGap="space20">
          <Button
            variant="secondary_icon"
            size="reset"
            onClick={goBack}
            disabled={currentIndex === 0}
          >
            <Text as="span" fontSize="fontSize30">&larr;</Text>
          </Button>
          <Button
            variant="secondary_icon"
            size="reset"
            onClick={goForward}
            disabled={isAtLatest}
          >
            <Text as="span" fontSize="fontSize30">&rarr;</Text>
          </Button>
          {!isAtLatest && (
            <Tooltip text="Jump to latest">
              <Button
                variant="secondary"
                size="small"
                onClick={goToLatest}
              >
                Latest
              </Button>
            </Tooltip>
          )}
        </Box>
      </Box>
      <Box style={{ maxHeight: '300px', overflow: 'auto' }}>
        <Text
          as="pre"
          fontFamily={outputFormat === 'JSON' ? 'fontFamilyCode' : 'fontFamilyText'}
          fontSize="fontSize30"
          whiteSpace="pre-wrap"
          wordBreak="break-word"
        >
          {formattedValue}
        </Text>
      </Box>
    </animated.div>
  );
};

export default OperatorResultCard;
