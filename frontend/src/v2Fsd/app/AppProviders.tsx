import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';

import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';

import { v2Theme } from './theme';
import { SessionProvider } from '../entities/user/index';
import { AuthModalProvider } from '../features/auth/ui/AuthModal';

export default function AppProviders({children}) {
  return (
    <MantineProvider theme={v2Theme} withCssVariables withStaticClasses>
      <Notifications position="bottom-center" />
      <SessionProvider>
        <AuthModalProvider>
           {children}
        </AuthModalProvider>
      </SessionProvider>
    </MantineProvider>
  );
}