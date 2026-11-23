import { ActivityIndicator, Pressable, Text } from 'react-native';
import { farmStore, useFarm } from '../store/farmStore';
import { Icon } from './Icon';

/** Başlıqda sinxronizasiya vəziyyəti: offline / göndərilməmiş dəyişikliklər. Toxunanda yenidən cəhd edir. */
export function SyncBadge() {
  const { status } = useFarm();
  const label = !status.online ? `Offline${status.pending ? ` · ${status.pending}` : ''}` : status.pending ? `${status.pending} gözləyir` : '';
  if (!label && !status.syncing) return null;
  return (
    <Pressable
      onPress={() => void farmStore.sync()}
      accessibilityLabel="Sinxronizasiya et"
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 3, marginRight: 12 }}
    >
      {status.syncing ? <ActivityIndicator size="small" color="#fff" /> : <Icon name={status.online ? 'sync' : 'cloud-off'} size={15} color="#fff" />}
      {label ? <Text style={{ color: '#fff', fontSize: 12.5 }}>{label}</Text> : null}
    </Pressable>
  );
}
