import { ActivityIndicator, Pressable, Text } from 'react-native';
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
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: status.online ? c.greenSoft : c.warnSoft, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 3, marginRight: 12 }}
    >
      {status.syncing ? <ActivityIndicator size="small" color={c.green} /> : <Icon name={status.online ? 'sync' : 'cloud-off'} size={15} color={status.online ? c.green : c.warn} />}
      {label ? <Text style={{ color: status.online ? c.green : c.warn, fontSize: 12.5, fontWeight: '600' }}>{label}</Text> : null}
    </Pressable>
  );
}
