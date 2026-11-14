import { Link, Stack } from 'expo-router';
import { View } from 'react-native';
import { Button, Text } from '@/components/ui';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Página não encontrada' }} />
      <View className="flex-1 items-center justify-center bg-background p-6">
        <Text className="text-lg font-bold text-foreground">
          Esta tela não existe.
        </Text>
        <Link href="/" asChild>
          <Button className="mt-4">
            <Text>Voltar para o início</Text>
          </Button>
        </Link>
      </View>
    </>
  );
}
