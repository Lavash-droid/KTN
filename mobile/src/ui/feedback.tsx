/** Qısa bildiriş (toast) və təsdiq pəncərəsi — iOS, Android və vebdə eyni davranış. */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Alert, Animated, Platform, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ToastCtx = createContext<(msg: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState('');
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();

  const show = useCallback(
    (m: string) => {
      setMsg(m);
      if (timer.current) clearTimeout(timer.current);
      Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: Platform.OS !== 'web' }).start();
      timer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: Platform.OS !== 'web' }).start();
      }, 2600);
    },
    [opacity],
  );
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  return (
    <ToastCtx.Provider value={show}>
      {children}
      <Animated.View pointerEvents="none" style={[styles.toast, { opacity, bottom: 96 + insets.bottom }]}>
        <Text style={styles.text}>{msg}</Text>
      </Animated.View>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

/** Təsdiq sualı. `destructive` — qırmızı düymə (iOS). */
export function confirm(title: string, message = '', okLabel = 'Bəli', destructive = true): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(message ? `${title}\n\n${message}` : title));
  }
  return new Promise((resolve) => {
    Alert.alert(title, message || undefined, [
      { text: 'Ləğv et', style: 'cancel', onPress: () => resolve(false) },
      { text: okLabel, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    maxWidth: '90%',
    backgroundColor: '#222',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    zIndex: 100,
  },
  text: { color: '#fff', fontSize: 14 },
});
