import { ActivityIndicator, Pressable } from 'react-native';
import { Text } from './Text';
import { farmStore, useFarm } from '../store/farmStore';
import { Icon } from './Icon';
import { useColors } from './theme';

/** Başlıqda sinxronizasiya vəziyyəti: offline / göndərilməmiş dəyişikliklər. Toxunanda yenidən cəhd edir. */
export function SyncBadge() {
  const { status } = useFarm();
  const c = useColors();
  const label = !status.online ? `Offline${status.pending ? ` · ${status.pending}` : ''}` : status.pending ? `${status.pending} gözləyir` : '';
  if (!label && !status.syncing) return null;
  return (
    <Pressable
      onPress={() => void farmStore.sync()}
      accessibilityLabel="Sinxronizasiya et"
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: status.online ? c.accentSoft : c.warnSoft, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginRight: 12 }}
    >
      {status.syncing ? <ActivityIndicator size="small" color={c.accent} /> : <Icon name={status.online ? 'sync' : 'cloud-off'} size={15} color={status.online ? c.accent : c.warn} />}
      {label ? <Text style={{ color: status.online ? c.accent : c.warn, fontSize: 12.5, fontWeight: '500' }}>{label}</Text> : null}
    </Pressable>
  );
}
