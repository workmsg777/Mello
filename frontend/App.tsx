import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DatingAuthScreen } from './src/screens/DatingAuthScreen';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <DatingAuthScreen />
    </SafeAreaProvider>
  );
}
