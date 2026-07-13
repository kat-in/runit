import AppProviders from './AppProviders';
import AppRouter from './AppRouter';

export default function V2FsdApp() {
  return (
    <AppProviders>
      <AppRouter/>
    </AppProviders>
  );
}