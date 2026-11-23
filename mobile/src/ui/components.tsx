/** Tətbiqin ümumi UI komponentləri. */
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Image } from 'expo-image';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { repo } from '../data';
import { isLocalPhoto } from '../data/mapping';
import { fmt, fromISO, toISO, todayISO } from '../domain/dates';
import { useWide } from './layout';
import { RADIUS, useColors, type Colors } from './theme';

export function useStyles<T>(factory: (c: Colors) => T): T {
  const c = useColors();
  return useMemo(() => factory(c), [c, factory]);
}

/* ---------- Ekran ---------- */
export function Screen({ children, refreshControl, contentStyle }: { children: ReactNode; refreshControl?: React.ReactElement; contentStyle?: StyleProp<ViewStyle> }) {
  const c = useColors();
  const wide = useWide();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={[{ padding: wide ? 28 : 16, paddingBottom: 40, width: '100%', maxWidth: wide ? 1100 : 760, alignSelf: 'center' }, contentStyle]}
      keyboardShouldPersistTaps="handled"
      refreshControl={refreshControl as never}
    >
      {children}
    </ScrollView>
  );
}

export function H2({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return (
    <View style={style}>
      <Text style={{ fontSize: 17, fontWeight: '700', color: c.text, marginTop: 22, marginBottom: 10 }}>{children}</Text>
    </View>
  );
}

export function Muted({ children, small, center, style }: { children: ReactNode; small?: boolean; center?: boolean; style?: object }) {
  const c = useColors();
  return <Text style={[{ color: c.muted, fontSize: small ? 13.5 : 15, textAlign: center ? 'center' : 'left', lineHeight: small ? 19 : 21 }, style]}>{children}</Text>;
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return <View style={[{ backgroundColor: c.card, borderColor: c.line, borderWidth: 1, borderRadius: RADIUS, padding: 14 }, style]}>{children}</View>;
}

/* ---------- Düymə ---------- */
type BtnVariant = 'primary' | 'ghost' | 'danger';
export function Btn({
  title, onPress, variant = 'primary', small, disabled, icon, style, loading, vertical,
}: {
  title: string; onPress?: () => void; variant?: BtnVariant; small?: boolean; disabled?: boolean; icon?: string;
  style?: StyleProp<ViewStyle>; loading?: boolean; vertical?: boolean;
}) {
  const c = useColors();
  const bg = variant === 'primary' ? c.green : variant === 'danger' ? c.danger : 'transparent';
  const fg = variant === 'ghost' ? c.green : variant === 'primary' ? c.onGreen : '#fff';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          borderRadius: 10,
          paddingVertical: small ? 7 : vertical ? 10 : 12,
          paddingHorizontal: small ? 12 : 16,
          flexDirection: vertical ? 'column' : 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: vertical ? 2 : 6,
          borderWidth: variant === 'ghost' ? 1 : 0,
          borderColor: c.line,
          opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : null}
      {icon ? <Text style={{ fontSize: vertical ? 21 : small ? 14 : 16 }}>{icon}</Text> : null}
      <Text style={{ color: fg, fontWeight: '600', fontSize: small || vertical ? 14 : 16 }}>{title}</Text>
    </Pressable>
  );
}

export function Row({ children, gap = 8, style }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', gap }, style]}>{children}</View>;
}

/** İki sütunlu forma sətri. */
export function Grid2({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: 'row', gap: 10 }}>{Array.isArray(children) ? children.map((ch, i) => <View key={i} style={{ flex: 1 }}>{ch}</View>) : children}</View>;
}

/* ---------- Forma sahələri ---------- */
export function Label({ children }: { children: ReactNode }) {
  const c = useColors();
  return <Text style={{ fontSize: 13.5, fontWeight: '600', color: c.text, marginTop: 12, marginBottom: 5 }}>{children}</Text>;
}

export function Field({ label, style, ...props }: TextInputProps & { label?: string }) {
  const c = useColors();
  return (
    <View>
      {label ? <Label>{label}</Label> : null}
      <TextInput
        placeholderTextColor={c.muted}
        {...props}
        style={[
          { borderWidth: 1, borderColor: c.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 16, color: c.text, backgroundColor: c.card },
          props.multiline ? { minHeight: 64, textAlignVertical: 'top' } : null,
          style,
        ]}
      />
    </View>
  );
}

/** Rəqəm sahəsi: dəyəri string kimi saxlayır ki, istifadəçi "1," yaza bilsin. */
export function NumField({ label, value, onChange, decimal, placeholder }: { label: string; value: string; onChange: (v: string) => void; decimal?: boolean; placeholder?: string }) {
  return (
    <Field
      label={label}
      value={value}
      onChangeText={(t) => onChange(t.replace(',', '.').replace(decimal ? /[^0-9.]/g : /[^0-9]/g, ''))}
      keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
      placeholder={placeholder}
    />
  );
}
export const toNum = (s: string) => {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
};

export interface Option<T extends string> {
  value: T;
  label: string;
}

/** Seçim — "çip" düymələri ilə (az sayda variant üçün). */
export function ChipSelect<T extends string>({ label, options, value, onChange, vertical }: { label?: string; options: Option<T>[]; value: T; onChange: (v: T) => void; vertical?: boolean }) {
  const c = useColors();
  return (
    <View>
      {label ? <Label>{label}</Label> : null}
      <View style={{ flexDirection: vertical ? 'column' : 'row', flexWrap: 'wrap', gap: 6 }}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Pressable
              key={o.value}
              onPress={() => onChange(o.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              style={{
                borderWidth: 1, borderColor: on ? c.green : c.line, backgroundColor: on ? c.green : c.card,
                borderRadius: vertical ? 10 : 99, paddingHorizontal: 12, paddingVertical: vertical ? 10 : 7,
              }}
            >
              <Text style={{ color: on ? c.onGreen : c.text, fontSize: 14.5 }}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Sərbəst mətn + təkliflər (cins, dərman adı və s.). */
export function SuggestField({ label, value, onChange, suggestions, placeholder }: { label: string; value: string; onChange: (v: string) => void; suggestions: string[]; placeholder?: string }) {
  const c = useColors();
  const [focus, setFocus] = useState(false);
  const q = value.trim().toLowerCase();
  const list = suggestions.filter((s) => s.toLowerCase() !== q && (!q || s.toLowerCase().includes(q))).slice(0, 8);
  return (
    <View>
      <Field label={label} value={value} onChangeText={onChange} placeholder={placeholder} onFocus={() => setFocus(true)} onBlur={() => setTimeout(() => setFocus(false), 150)} autoCorrect={false} />
      {focus && list.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
          {list.map((s) => (
            <Pressable key={s} onPress={() => onChange(s)} style={{ backgroundColor: c.greenSoft, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5 }}>
              <Text style={{ color: c.text, fontSize: 13.5 }}>{s}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

/** Tarix seçicisi. `optional` olduqda təmizləmək olar (null). */
export function DateField({ label, value, onChange, optional, max }: { label: string; value: string | null; onChange: (v: string | null) => void; optional?: boolean; max?: string }) {
  const c = useColors();
  const [iosOpen, setIosOpen] = useState(false);
  const boxStyle = { borderWidth: 1, borderColor: c.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, backgroundColor: c.card, flexDirection: 'row' as const, alignItems: 'center' as const };

  if (Platform.OS === 'web') {
    return (
      <View>
        <Label>{label}</Label>
        <View style={boxStyle}>
          {/* Vebdə brauzerin öz tarix sahəsi istifadə olunur */}
          {/* eslint-disable-next-line react/no-unknown-property */}
          <input
            type="date"
            value={value ?? ''}
            max={max}
            onChange={(e) => onChange(e.target.value || (optional ? null : todayISO()))}
            style={{ border: 0, background: 'transparent', color: c.text, fontSize: 16, flex: 1, fontFamily: 'inherit', outline: 'none' }}
          />
        </View>
      </View>
    );
  }

  const open = () => {
    const current = value ? fromISO(value) : new Date();
    const maximumDate = max ? fromISO(max) : undefined;
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: current,
        mode: 'date',
        maximumDate,
        onValueChange: (_e, d) => onChange(toISO(d)),
      });
    } else setIosOpen((o) => !o);
  };

  return (
    <View>
      <Label>{label}</Label>
      <Pressable onPress={open} style={boxStyle} accessibilityRole="button" accessibilityLabel={`${label}: ${fmt(value)}`}>
        <Text style={{ flex: 1, fontSize: 16, color: value ? c.text : c.muted }}>{value ? fmt(value) : 'Seçin'}</Text>
        {optional && value ? (
          <Pressable onPress={() => onChange(null)} hitSlop={10} accessibilityLabel="Tarixi təmizlə">
            <Text style={{ color: c.muted, fontSize: 16 }}>✕</Text>
          </Pressable>
        ) : (
          <Text>📅</Text>
        )}
      </Pressable>
      {Platform.OS === 'ios' && iosOpen && (
        <DateTimePicker
          value={value ? fromISO(value) : new Date()}
          mode="date"
          display="inline"
          maximumDate={max ? fromISO(max) : undefined}
          onValueChange={(_e, d) => {
            onChange(toISO(d));
            setIosOpen(false);
          }}
          accentColor={c.green}
          themeVariant={undefined}
        />
      )}
    </View>
  );
}

/* ---------- Modal forma ---------- */
export function Sheet({
  visible, title, onClose, onSubmit, submitLabel = 'Yadda saxla', children, busy,
}: {
  visible: boolean; title: string; onClose: () => void; onSubmit?: () => void; submitLabel?: string; children: ReactNode; busy?: boolean;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  // Kompüterdə ekranın ortasında dialoq, telefonda aşağıdan çıxan panel.
  const wide = useWide();
  return (
    <Modal visible={visible} animationType={wide ? 'fade' : 'slide'} transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: wide ? 'center' : 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)', padding: wide ? 24 : 0 }}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Bağla" />
        <View
          style={{
            backgroundColor: c.card, maxHeight: wide ? '88%' : '90%', width: '100%', maxWidth: 560, alignSelf: 'center',
            borderTopLeftRadius: 18, borderTopRightRadius: 18, borderBottomLeftRadius: wide ? 18 : 0, borderBottomRightRadius: wide ? 18 : 0,
          }}
        >
          <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 18 + insets.bottom }} keyboardShouldPersistTaps="handled">
            <Text style={{ fontSize: 18, fontWeight: '700', color: c.text, marginBottom: 2 }}>{title}</Text>
            {children}
            {onSubmit && (
              <Row style={{ marginTop: 18 }}>
                <Btn title="Ləğv et" variant="ghost" onPress={onClose} style={{ flex: 1 }} />
                <Btn title={submitLabel} onPress={onSubmit} style={{ flex: 1 }} loading={busy} />
              </Row>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ---------- Siyahı ---------- */
export function List({ children }: { children: ReactNode }) {
  const c = useColors();
  return <View style={{ backgroundColor: c.card, borderColor: c.line, borderWidth: 1, borderRadius: RADIUS, overflow: 'hidden' }}>{children}</View>;
}

export function ListItem({
  icon, title, subtitle, right, onPress, first, chevron = true, titleColor,
}: {
  icon?: ReactNode; title: string; subtitle?: string; right?: ReactNode; onPress?: () => void; first?: boolean; chevron?: boolean; titleColor?: string;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14,
        borderTopWidth: first ? 0 : 1, borderTopColor: c.line, backgroundColor: pressed ? c.greenSoft : 'transparent',
      })}
    >
      {icon != null && <View style={{ width: 38, alignItems: 'center' }}>{typeof icon === 'string' ? <Text style={{ fontSize: 26 }}>{icon}</Text> : icon}</View>}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontWeight: '700', fontSize: 15.5, color: titleColor ?? c.text }} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={{ color: c.muted, fontSize: 13.5, marginTop: 1 }} numberOfLines={2}>{subtitle}</Text> : null}
      </View>
      {right}
      {onPress && chevron ? <Text style={{ color: c.muted, fontSize: 20 }}>›</Text> : null}
    </Pressable>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <View style={{ paddingVertical: 22, paddingHorizontal: 14 }}>
      <Muted center>{children}</Muted>
    </View>
  );
}

export type BadgeKind = 'warn' | 'danger' | 'ok' | 'info';
export function Badge({ kind, children }: { kind: BadgeKind; children: ReactNode }) {
  const c = useColors();
  const map = { warn: [c.warnSoft, c.warn], danger: [c.dangerSoft, c.danger], ok: [c.greenSoft, c.green], info: [c.infoSoft, c.text] } as const;
  const [bg, fg] = map[kind];
  return (
    <View style={{ backgroundColor: bg, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 }}>
      <Text style={{ color: fg, fontSize: 12, fontWeight: '700' }}>{children}</Text>
    </View>
  );
}

export function AlertBox({ level, icon, title, subtitle, onPress }: { level: 'danger' | 'warn' | 'info'; icon: string; title: string; subtitle?: string; onPress?: () => void }) {
  const c = useColors();
  const bg = level === 'danger' ? c.dangerSoft : level === 'warn' ? c.warnSoft : c.infoSoft;
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => ({ flexDirection: 'row', gap: 10, padding: 12, borderRadius: RADIUS, backgroundColor: bg, marginBottom: 8, opacity: pressed ? 0.8 : 1 })}>
      <Text style={{ fontSize: 18 }}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: '700', color: c.text, fontSize: 15 }}>{title}</Text>
        {subtitle ? <Text style={{ color: c.text, fontSize: 13.5, marginTop: 1 }}>{subtitle}</Text> : null}
      </View>
    </Pressable>
  );
}

/* ---------- Şəkil ---------- */
/** Heyvan şəkli: lokal faylı birbaşa, serverdəki istinadı isə imzalı URL ilə göstərir (disk keşi ilə). */
export function Photo({ src: photoRef, style, fallback }: { src: string | null; style: StyleProp<ViewStyle>; fallback?: ReactNode }) {
  const [url, setUrl] = useState<string | null>(photoRef && isLocalPhoto(photoRef) ? photoRef : null);
  useEffect(() => {
    let alive = true;
    if (!photoRef) setUrl(null);
    else if (isLocalPhoto(photoRef)) setUrl(photoRef);
    else repo.photoUrl(photoRef).then((u) => alive && setUrl(u), () => alive && setUrl(null));
    return () => {
      alive = false;
    };
  }, [photoRef]);
  if (!photoRef) return <>{fallback ?? null}</>;
  return (
    <Image
      source={url ? { uri: url, cacheKey: photoRef } : null}
      style={style as never}
      contentFit="cover"
      cachePolicy="disk"
      transition={150}
      accessibilityIgnoresInvertColors
    />
  );
}
