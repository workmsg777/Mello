import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PartnerAuthScreen } from './src/screens/PartnerAuthScreen';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <PartnerAuthScreen />
    </SafeAreaProvider>
  );
}
