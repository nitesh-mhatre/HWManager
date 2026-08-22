import { View } from 'react-native';
import { useRouter } from 'expo-router';
import LoadingScreen from '../src/components/LoadingScreen';

export default function Index() {
  const router = useRouter();

  return (
    <View style={{ flex: 1 }}>
      <LoadingScreen
        duration={3500}
        onReady={() => {
          router.replace('/(tabs)/garage');
        }}
      />
    </View>
  );
}
