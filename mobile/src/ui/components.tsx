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
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { Text, TextInput } from './Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { repo } from '../data';
import { isLocalPhoto } from '../data/mapping';
import { fmt, fromISO, toISO, todayISO } from '../domain/dates';
import { Icon, type IconName } from './Icon';
import { useWide } from './layout';
import { FONT, RADIUS, shadow, useColors, useScheme, type Colors } from './theme';

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
      contentContainerStyle={[{ padding: wide ? 32 : 16, paddingTop: wide ? 28 : 12, paddingBottom: wide ? 48 : 120, width: '100%', maxWidth: wide ? 1120 : 760, alignSelf: 'center' }, contentStyle]}
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
      <Text style={{ fontSize: 18, fontFamily: FONT.display, color: c.text, marginTop: 28, marginBottom: 12 }}>{children}</Text>
    </View>
  );
}

export function Muted({ children, small, center, style }: { children: ReactNode; small?: boolean; center?: boolean; style?: object }) {
  const c = useColors();
  return <Text style={[{ color: c.muted, fontSize: small ? 13.5 : 15, textAlign: center ? 'center' : 'left', lineHeight: small ? 19 : 21 }, style]}>{children}</Text>;
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return <View style={[{ backgroundColor: c.card, borderRadius: RADIUS, padding: 16 }, style]}>{children}</View>;
}

/* ---------- Düymə ---------- */
/** primary — əsas əməliyyat (dolu); tonal — ikinci dərəcəli (yüngül fon); ghost — kontur; danger — silmə (yüngül qırmızı). */
type BtnVariant = 'primary' | 'tonal' | 'ghost' | 'danger';
export function Btn({
  title, onPress, variant = 'primary', small, disabled, icon, style, loading, vertical,
}: {
  title: string; onPress?: () => void; variant?: BtnVariant; small?: boolean; disabled?: boolean; icon?: IconName;
  style?: StyleProp<ViewStyle>; loading?: boolean; vertical?: boolean;
}) {
  const c = useColors();
  const bg = { primary: c.primary, tonal: c.accentSoft, ghost: c.card, danger: c.dangerSoft }[variant];
  const fg = { primary: c.onAccent, tonal: c.accent, ghost: c.text, danger: c.danger }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          borderRadius: small ? 10 : 12,
          minHeight: small ? 36 : vertical ? undefined : 48,
          paddingVertical: small ? 7 : vertical ? 12 : 12,
          paddingHorizontal: small ? 13 : 18,
          flexDirection: vertical ? 'column' : 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: vertical ? 2 : 6,
          borderWidth: 0,
          borderColor: c.line,
          opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : null}
      {icon ? <Icon name={icon} size={vertical ? 24 : small ? 17 : 19} color={fg} /> : null}
      <Text style={{ color: fg, fontWeight: '600', fontSize: small || vertical ? 14 : 15.5 }}>{title}</Text>
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
  return <Text style={{ fontSize: 14, fontWeight: '500', color: c.body, marginTop: 14, marginBottom: 7 }}>{children}</Text>;
}

export function Field({ label, style, onFocus, onBlur, ...props }: TextInputProps & { label?: string }) {
  const c = useColors();
  const [focus, setFocus] = useState(false);
  return (
    <View>
      {label ? <Label>{label}</Label> : null}
      <TextInput
        placeholderTextColor={c.faint}
        selectionColor={c.accent}
        {...props}
        onFocus={(e) => {
          setFocus(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocus(false);
          onBlur?.(e);
        }}
        style={[
          {
            borderWidth: 1, borderColor: focus ? c.accent : c.line, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13,
            fontSize: 16, color: c.text, backgroundColor: c.input,
          },
          Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null,
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
  icon?: IconName;
}

/** Seçim — "çip" düymələri ilə (az sayda variant üçün). */
export function ChipSelect<T extends string>({ label, options, value, onChange, vertical, scroll }: { label?: string; options: Option<T>[]; value: T; onChange: (v: T) => void; vertical?: boolean; scroll?: boolean }) {
  const c = useColors();
  return (
    <View>
      {label ? <Label>{label}</Label> : null}
      {(() => {
        const chips = options.map((o) => {
              const on = o.value === value;
              return (
                <Pressable
                  key={o.value}
                  onPress={() => onChange(o.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  style={({ pressed }) => ({
                    borderWidth: vertical ? 1 : 0, borderColor: on ? c.accent : c.line,
                    backgroundColor: vertical ? (on ? c.accentSoft : c.card) : on ? c.primary : c.accentSoft,
                    borderRadius: 12, paddingHorizontal: vertical ? 14 : 16, paddingVertical: vertical ? 13 : 10,
                    flexDirection: 'row', alignItems: 'center', gap: 7, opacity: pressed ? 0.85 : 1,
                  })}
                >
                  {vertical ? (
                    <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: on ? 5.5 : 1.5, borderColor: on ? c.primary : c.faint, backgroundColor: c.card }} />
                  ) : null}
                  {o.icon ? <Icon name={o.icon} size={17} color={on ? (vertical ? c.accent : c.onAccent) : vertical ? c.muted : c.accent} /> : null}
                  <Text style={{ color: vertical ? c.text : on ? c.onAccent : c.accent, fontSize: 14.5, fontWeight: vertical ? (on ? '600' : '400') : '600' }}>{o.label}</Text>
                </Pressable>
              );
            });
        return scroll ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 16 }} style={{ marginRight: -16 }}>
            {chips}
          </ScrollView>
        ) : (
          <View style={{ flexDirection: vertical ? 'column' : 'row', flexWrap: 'wrap', gap: 8 }}>{chips}</View>
        );
      })()}
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
            <Pressable key={s} onPress={() => onChange(s)} style={{ backgroundColor: c.accentSoft, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 }}>
              <Text style={{ color: c.accent, fontSize: 13.5, fontWeight: '500' }}>{s}</Text>
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
  const dark = useScheme() === 'dark';
  const boxStyle = { borderWidth: 1, borderColor: c.line, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, backgroundColor: c.input, flexDirection: 'row' as const, alignItems: 'center' as const };

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
            style={{ border: 0, background: 'transparent', color: c.text, fontSize: 16, flex: 1, fontFamily: FONT.regular, outline: 'none', colorScheme: dark ? 'dark' : 'light' }}
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
            <Icon name="close" size={18} color={c.muted} />
          </Pressable>
        ) : (
          <Icon name="calendar" size={20} color={c.muted} />
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
          accentColor={c.accent}
          themeVariant={undefined}
        />
      )}
    </View>
  );
}

/* ---------- Modal forma ---------- */
export function Sheet({
  visible, title, icon, onClose, onSubmit, submitLabel = 'Yadda saxla', children, busy,
}: {
  visible: boolean; title: string; icon?: IconName; onClose: () => void; onSubmit?: () => void; submitLabel?: string; children: ReactNode; busy?: boolean;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  // Kompüterdə ekranın ortasında dialoq, telefonda aşağıdan çıxan panel.
  const wide = useWide();
  return (
    <Modal visible={visible} animationType={wide ? 'fade' : 'slide'} transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: wide ? 'center' : 'flex-end', backgroundColor: 'rgba(15,23,42,0.45)', padding: wide ? 24 : 0 }}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Bağla" />
        <View
          style={[
            {
              backgroundColor: c.card, maxHeight: wide ? '88%' : '92%', width: '100%', maxWidth: 580, alignSelf: 'center',
              borderTopLeftRadius: 24, borderTopRightRadius: 24, borderBottomLeftRadius: wide ? 24 : 0, borderBottomRightRadius: wide ? 24 : 0,
            },
            shadow(c, 2),
          ]}
        >
          {!wide && <View style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: c.line, marginTop: 8 }} />}
          <ScrollView contentContainerStyle={{ padding: 20, paddingTop: wide ? 22 : 14, paddingBottom: 20 + insets.bottom }} keyboardShouldPersistTaps="handled">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 }}>
              {icon ? (
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.iconBg, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={icon} size={21} color={c.icon} />
                </View>
              ) : null}
              <Text style={{ fontSize: 19, fontFamily: FONT.display, color: c.text, flex: 1 }}>{title}</Text>
              <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Bağla" style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.cardAlt, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="close" size={19} color={c.muted} />
              </Pressable>
            </View>
            {children}
            {onSubmit && (
              <Row style={{ marginTop: 22 }} gap={10}>
                <Btn title="Ləğv et" variant="ghost" onPress={onClose} style={{ flex: 1, borderColor: c.line }} />
                <Btn title={submitLabel} onPress={onSubmit} style={{ flex: 1.4 }} loading={busy} />
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
  return (
    <View style={{ backgroundColor: c.card, borderRadius: RADIUS }}>
      <View style={{ borderRadius: RADIUS, overflow: 'hidden' }}>{children}</View>
    </View>
  );
}

export function ListItem({
  icon, title, subtitle, right, meta, onPress, first, chevron = true, titleColor,
}: {
  icon?: ReactNode | IconName; title: string; subtitle?: string; right?: ReactNode; meta?: ReactNode; onPress?: () => void; first?: boolean; chevron?: boolean; titleColor?: string;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => ({ backgroundColor: pressed ? c.cardAlt : 'transparent' })}
    >
      {!first && <View style={{ height: 1, backgroundColor: c.divider, marginLeft: icon != null ? 68 : 16 }} />}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16 }}>
        {icon != null && <View style={{ width: 40, alignItems: 'center' }}>{typeof icon === 'string' ? <IconTile name={icon as IconName} /> : icon}</View>}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontWeight: '500', fontSize: 16, color: titleColor ?? c.text }} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={{ color: c.muted, fontSize: 13.5, marginTop: 3, lineHeight: 18 }} numberOfLines={2}>{subtitle}</Text> : null}
          {meta ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>{meta}</View> : null}
        </View>
        {right}
        {onPress && chevron ? <Icon name="chevron-right" size={22} color={c.muted} /> : null}
      </View>
    </Pressable>
  );
}

/** Yumşaq fonlu kvadrat içində ikon — siyahı sətirləri üçün. */
export function IconTile({ name, size = 40, color, bg }: { name: IconName; size?: number; color?: string; bg?: string }) {
  const c = useColors();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg ?? c.iconBg, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={name} size={size * 0.5} color={color ?? c.icon} />
    </View>
  );
}

export function Empty({ children, icon }: { children: ReactNode; icon?: IconName }) {
  const c = useColors();
  return (
    <View style={{ paddingVertical: 26, paddingHorizontal: 18, alignItems: 'center', gap: 10 }}>
      {icon ? (
        <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: c.cardAlt, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={26} color={c.faint} />
        </View>
      ) : null}
      <Muted center>{children}</Muted>
    </View>
  );
}

export type BadgeKind = 'warn' | 'danger' | 'ok' | 'info';
export function Badge({ kind, children }: { kind: BadgeKind; children: ReactNode }) {
  const c = useColors();
  const map = { warn: [c.warnSoft, c.warn], danger: [c.dangerSoft, c.danger], ok: [c.okSoft, c.ok], info: [c.infoSoft, c.info] } as const;
  const [bg, fg] = map[kind];
  return (
    <View style={{ backgroundColor: bg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: fg }} />
      <Text style={{ color: fg, fontSize: 12, fontWeight: '600' }}>{children}</Text>
    </View>
  );
}

/** Xəbərdarlıq sətri — rəngli ikon dairəsi, başlıq, izah. `first` — qrup kartında ilk sətir. */
export function AlertBox({ level, icon, title, subtitle, onPress, first = true, grouped }: { level: 'danger' | 'warn' | 'info'; icon: IconName; title: string; subtitle?: string; onPress?: () => void; first?: boolean; grouped?: boolean }) {
  const c = useColors();
  const accent = level === 'danger' ? c.danger : level === 'warn' ? c.warn : c.info;
  const soft = level === 'danger' ? c.dangerSoft : level === 'warn' ? c.warnSoft : c.infoSoft;
  const body = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16 }}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: soft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={21} color={accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: '500', color: c.text, fontSize: 15 }}>{title}</Text>
        {subtitle ? <Text style={{ color: c.muted, fontSize: 13.5, marginTop: 2, lineHeight: 18 }}>{subtitle}</Text> : null}
      </View>
      {onPress ? <Icon name="chevron-right" size={20} color={c.faint} /> : null}
    </View>
  );
  if (grouped) {
    return (
      <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => ({ backgroundColor: pressed ? c.cardAlt : 'transparent' })}>
        {!first && <View style={{ height: 1, backgroundColor: c.divider, marginLeft: 68 }} />}
        {body}
      </Pressable>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        { borderRadius: RADIUS, marginBottom: 8, backgroundColor: pressed ? c.cardAlt : c.card },
      ]}
    >
      {body}
    </Pressable>
  );
}

/* ---------- Bölmə başlığı ---------- */
/** Başlıq + sağda kiçik keçid (məs. "Hamısı"). */
export function SectionHead({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 28, marginBottom: 12 }}>
      <Text style={{ fontSize: 18, fontFamily: FONT.display, color: c.text }}>{title}</Text>
      {action ? (
        <Text accessibilityRole="button" onPress={onAction} style={{ color: c.accent, fontWeight: '500', fontSize: 14.5 }}>
          {action}
        </Text>
      ) : null}
    </View>
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

/* ---------- Seqmentli seçim ---------- */
/** İki-üç variantlı keçid (iOS seqment idarəsi kimi). */
export function Segmented<T extends string>({ options, value, onChange }: { options: Option<T>[]; value: T; onChange: (v: T) => void }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            style={[
              { flex: 1, paddingVertical: 11, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, backgroundColor: on ? c.primary : c.accentSoft },
            ]}
          >
            {o.icon ? <Icon name={o.icon} size={16} color={on ? c.onAccent : c.accent} /> : null}
            <Text style={{ fontSize: 14.5, fontWeight: '600', color: on ? c.onAccent : c.accent }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
