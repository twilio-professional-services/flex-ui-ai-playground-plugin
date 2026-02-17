import React from 'react';
import * as Flex from '@twilio/flex-ui';
import { CustomizationProvider, PasteCustomCSS, CustomizationProviderProps } from '@twilio-paste/core/customization';

export function initPaste(flex: typeof Flex): void {
  flex.setProviders({
    CustomProvider: (RootComponent) => (props) => {
      const pasteProviderProps: CustomizationProviderProps & { style: PasteCustomCSS } = {
        baseTheme: props.theme?.isLight ? 'default' : 'dark',
        theme: props.theme?.tokens,
        style: { minWidth: '100%', height: '100%' },
        elements: {},
      };
      return (
        <CustomizationProvider {...pasteProviderProps}>
          <RootComponent {...props} />
        </CustomizationProvider>
      );
    },
  });
}
