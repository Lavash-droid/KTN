/**
 * Inter şrifti ilə Text və TextInput.
 * Xüsusi şriftlərdə `fontWeight` Android-də işləmir (və vebdə saxta qalınlıq verir), ona görə çəkiyə
 * uyğun Inter ailəsini (Inter_600SemiBold və s.) özümüz seçirik. İç-içə Text valideynin çəkisini irsən alır.
 */
import { createContext, useContext, type ComponentProps, type ComponentRef } from 'react';
import {
  StyleSheet,
  Text as RNText,
  TextInput as RNTextInput,
  type TextProps,
  type TextStyle,
} from 'react-native';
import { fontFamilyFor } from './theme';

const WeightCtx = createContext<TextStyle['fontWeight'] | undefined>(undefined);

function fontStyle(style: TextProps['style'], inherited?: TextStyle['fontWeight']) {
  const flat = (StyleSheet.flatten(style) ?? {}) as TextStyle;
  const weight = flat.fontWeight ?? inherited;
  // Açıq-aşkar başqa şrift verilibsə (məs. FONT.display) ona toxunmuruq.
  const family = flat.fontFamily ?? fontFamilyFor(weight);
  return { weight, extra: { fontFamily: family, fontWeight: 'normal' as const } };
}

export function Text({ style, ...props }: ComponentProps<typeof RNText>) {
  const inherited = useContext(WeightCtx);
  const { weight, extra } = fontStyle(style, inherited);
  return (
    <WeightCtx.Provider value={weight}>
      <RNText {...props} style={[style, extra]} />
    </WeightCtx.Provider>
  );
}

export function TextInput({ style, ...props }: ComponentProps<typeof RNTextInput>) {
  const { extra } = fontStyle(style as TextProps['style']);
  return <RNTextInput {...props} style={[style, extra]} />;
}

/** `ref` tipi üçün (useRef<TextInputHandle>) */
export type TextInputHandle = ComponentRef<typeof RNTextInput>;
