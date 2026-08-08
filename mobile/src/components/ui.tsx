import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, shadow, space, type } from '../theme/tokens';

/** Mobile mirror of the web design system: same tokens, same vocabulary. */

export function Screen({
  children,
  scroll = true,
  padded = true,
}: {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
}) {
  const content = padded ? <View style={styles.screenPad}>{children}</View> : children;
  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

export function PageTitle({ title, lead }: { title: string; lead?: string }) {
  return (
    <View style={{ marginBottom: space[5] }}>
      <Text style={styles.heading}>{title}</Text>
      {lead ? <Text style={[styles.caption, { marginTop: space[2] }]}>{lead}</Text> : null}
    </View>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <Text style={styles.label}>{String(children).toUpperCase()}</Text>;
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Divider() {
  return <View style={styles.divider} />;
}

export function Button({
  title,
  onPress,
  variant = 'secondary',
  loading,
  disabled,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'accent' | 'ghost' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const background =
    variant === 'primary'
      ? colors.ink
      : variant === 'accent'
        ? colors.accent
        : variant === 'danger'
          ? colors.danger
          : variant === 'ghost'
            ? 'transparent'
            : colors.surface;
  const textColor =
    variant === 'primary' || variant === 'danger'
      ? colors.fgInverse
      : variant === 'accent'
        ? colors.accentInk
        : colors.fg;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: background,
          borderColor: variant === 'secondary' ? colors.borderStrong : 'transparent',
          opacity: disabled || loading ? 0.55 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={textColor} /> : null}
      <Text style={[styles.buttonText, { color: textColor }]}>{title}</Text>
    </Pressable>
  );
}

export function Field({
  label,
  error,
  hint,
  ...rest
}: TextInputProps & { label: string; error?: string | null; hint?: string }) {
  return (
    <View style={{ marginBottom: space[4] }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.fgMuted}
        style={[styles.input, error ? { borderColor: colors.danger } : null]}
        {...rest}
      />
      {error ? (
        <Text style={[styles.caption, { color: colors.danger, marginTop: space[1] }]}>{error}</Text>
      ) : hint ? (
        <Text style={[styles.caption, { marginTop: space[1] }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

const TONES = {
  neutral: { bg: colors.neutralSoft, fg: colors.fgSecondary },
  success: { bg: colors.successSoft, fg: colors.success },
  warning: { bg: colors.warningSoft, fg: colors.warning },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
  accent: { bg: colors.accentSoft, fg: colors.accentInk },
  ink: { bg: colors.ink, fg: colors.fgInverse },
} as const;

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: keyof typeof TONES }) {
  const palette = TONES[tone];
  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }]}>
      <Text style={[styles.badgeText, { color: palette.fg }]}>{children}</Text>
    </View>
  );
}

export function Alert({ children, tone = 'neutral' }: { children: ReactNode; tone?: keyof typeof TONES }) {
  const palette = TONES[tone];
  return (
    <View style={[styles.alert, { backgroundColor: palette.bg }]}>
      <Text style={[styles.small, { color: palette.fg }]}>{children}</Text>
    </View>
  );
}

/** Route line: pickup dot, dashed road, amber destination marker. */
export function RouteRow({ from, to, meta }: { from: string; to: string; meta?: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: space[3] }}>
      <View style={{ alignItems: 'center', paddingTop: 5 }}>
        <View style={styles.routeDot} />
        <View style={styles.routeLine} />
        <View style={styles.routeDotEnd} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.label}>PICKUP</Text>
        <Text style={styles.subtitle}>{from}</Text>
        {meta ? <Text style={[styles.caption, { marginVertical: space[2] }]}>{meta}</Text> : <View style={{ height: space[4] }} />}
        <Text style={styles.label}>DESTINATION</Text>
        <Text style={styles.subtitle}>{to}</Text>
      </View>
    </View>
  );
}

export function Seats({ total, taken }: { total: number; taken: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 3 }}>
      {Array.from({ length: Math.min(total, 10) }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.seatPip,
            index < taken
              ? { backgroundColor: colors.fgMuted, borderColor: colors.fgMuted }
              : { backgroundColor: colors.accent, borderColor: colors.accentStrong },
          ]}
        />
      ))}
    </View>
  );
}

export function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card style={{ flex: 1, minWidth: 140 }}>
      <Label>{label}</Label>
      <Text style={[styles.metric, { marginTop: space[2] }]}>{value}</Text>
      {hint ? <Text style={[styles.caption, { marginTop: space[1] }]}>{hint}</Text> : null}
    </Card>
  );
}

export function EmptyState({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <Card style={{ alignItems: 'center', paddingVertical: space[8] }}>
      <Text style={styles.subtitle}>{title}</Text>
      {text ? (
        <Text style={[styles.caption, { textAlign: 'center', marginTop: space[2], maxWidth: 280 }]}>{text}</Text>
      ) : null}
      {action ? <View style={{ marginTop: space[4] }}>{action}</View> : null}
    </Card>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <Card style={{ alignItems: 'center', paddingVertical: space[8] }}>
      <Text style={styles.subtitle}>Something went wrong</Text>
      <Text style={[styles.caption, { textAlign: 'center', marginTop: space[2], maxWidth: 280 }]}>
        {message ?? 'We could not load this screen. Please try again.'}
      </Text>
      {onRetry ? <Button title="Try again" onPress={onRetry} style={{ marginTop: space[4] }} /> : null}
    </Card>
  );
}

/** Skeletons preserve the final layout so nothing jumps when data arrives. */
export function SkeletonBlock({ height = 96, width = '100%' as number | string }) {
  return <View style={[styles.skeleton, { height, width: width as number }]} />;
}

export function SkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <View style={{ gap: space[3] }}>
      {Array.from({ length: rows }).map((_, index) => (
        <Card key={index}>
          <SkeletonBlock height={12} width="45%" />
          <View style={{ height: space[3] }} />
          <SkeletonBlock height={18} width="70%" />
          <View style={{ height: space[3] }} />
          <SkeletonBlock height={12} width="55%" />
        </Card>
      ))}
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { paddingBottom: space[9] },
  screenPad: { padding: space[4], gap: space[3] },

  display: { ...type.display, color: colors.fg },
  heading: { ...type.heading, color: colors.fg },
  title: { ...type.title, color: colors.fg },
  subtitle: { ...type.subtitle, color: colors.fg },
  body: { ...type.body, color: colors.fg },
  small: { ...type.small, color: colors.fg },
  caption: { ...type.caption, color: colors.fgSecondary },
  label: { ...type.label, color: colors.fgMuted },
  metric: { ...type.metric, color: colors.fg },
  medium: { fontWeight: '500' },

  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space[4],
    ...shadow.card,
  },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: space[4] },

  button: {
    minHeight: 46,
    paddingHorizontal: space[5],
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
  },
  buttonText: { ...type.body, fontWeight: '500' },

  fieldLabel: { ...type.caption, color: colors.fgSecondary, fontWeight: '500', marginBottom: space[2] },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: space[3],
    backgroundColor: colors.surface,
    color: colors.fg,
    ...type.body,
  },

  badge: { paddingHorizontal: space[2], paddingVertical: 3, borderRadius: radius.pill, alignSelf: 'flex-start' },
  badgeText: { ...type.caption, fontWeight: '500' },

  alert: { padding: space[3], borderRadius: radius.sm },

  routeDot: { width: 9, height: 9, borderRadius: 5, borderWidth: 2, borderColor: colors.fg, backgroundColor: colors.surface },
  routeLine: { width: 2, flex: 1, minHeight: 26, backgroundColor: colors.borderStrong, marginVertical: 3 },
  routeDotEnd: { width: 9, height: 9, borderRadius: 2, backgroundColor: colors.accent, borderWidth: 2, borderColor: colors.accentStrong },

  seatPip: { width: 7, height: 12, borderRadius: 2, borderWidth: 1 },

  plate: {
    ...type.caption,
    fontWeight: '500',
    letterSpacing: 1.6,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.xs,
    paddingHorizontal: 5,
    paddingVertical: 1,
    color: colors.fg,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },

  skeleton: { backgroundColor: colors.neutralSoft, borderRadius: radius.sm },

  row: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3] },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3] },
});
