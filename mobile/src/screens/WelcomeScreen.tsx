import { Image, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, Divider, styles } from '../components/ui';
import { Star } from '../components/Icon';
import { colors, space } from '../theme/tokens';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;

/**
 * Forest welcome plate: the same hero treatment as the marketing site, sized
 * for a phone. Entry point to sign in or to join with an organisation code.
 */
export function WelcomeScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.ink }}>
      <View style={{ flex: 1, padding: space[6], justifyContent: 'space-between' }}>
        <View>
          <Text style={{ ...styles.heading, color: colors.mint, fontSize: 26 }}>
            ridesync<Text style={{ fontSize: 12 }}>®</Text>
          </Text>
        </View>

        <View>
          <Text style={{ ...styles.display, color: colors.mint }}>Share the drive to work.</Text>
          <Text style={{ ...styles.body, color: colors.mint, opacity: 0.82, marginTop: space[5] }}>
            Publish the drive you were making anyway, or take a seat with a colleague. Every seat is priced
            from your organisation's own fuel and running costs.
          </Text>

          <Divider />

          <View style={{ flexDirection: 'row', gap: space[2], alignItems: 'center' }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <Star key={i} size={15} color={colors.mint} />
            ))}
            <Text style={{ ...styles.caption, color: colors.mint, opacity: 0.8, marginLeft: space[2] }}>
              Trusted at 40+ campuses
            </Text>
          </View>
        </View>

        <View style={{ gap: space[3] }}>
          <Button title="Sign in" variant="accent" onPress={() => navigation.navigate('Login')} />
          <Button
            title="I have an organisation code"
            variant="ghost"
            onPress={() => navigation.navigate('Register')}
            style={{ borderColor: colors.borderInverse, borderWidth: 1 }}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
