import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { daysBetween, fmt, inDays, todayISO } from '../../domain/dates';
import type { Task } from '../../domain/types';
import { uid } from '../../lib/id';
import { farmStore, useFarm } from '../../store/farmStore';
import { Badge, Btn, Card, DateField, Empty, Field, H2, List, Screen } from '../../ui/components';
import { useToast } from '../../ui/feedback';
import { Icon } from '../../ui/Icon';
import { useColors } from '../../ui/theme';

export default function Tasks() {
  const toast = useToast();
  const { data } = useFarm();
  const [title, setTitle] = useState('');
  const [due, setDue] = useState<string | null>(todayISO());

  const open = data.tasks.filter((x) => !x.done).sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
  const done = data.tasks.filter((x) => x.done).slice(-10).reverse();

  const add = () => {
    if (!title.trim()) return toast('Tapşırığın adını yazın');
    farmStore.saveTask({ id: uid(), title: title.trim(), due, done: false });
    setTitle('');
  };

  return (
    <Screen>
      <Card>
        <Field label="Yeni tapşırıq" value={title} onChangeText={setTitle} placeholder="Məs: Şap peyvəndi — bütün sürü" onSubmitEditing={add} returnKeyType="done" />
        <DateField label="Son tarix" value={due} onChange={setDue} optional />
        <Btn title="Əlavə et" icon="plus" onPress={add} style={{ marginTop: 14 }} />
      </Card>

      <H2>{`Gözləyən (${open.length})`}</H2>
      <List>{open.length ? open.map((k, i) => <TaskRow key={k.id} task={k} first={i === 0} />) : <Empty>Gözləyən tapşırıq yoxdur</Empty>}</List>

      {done.length > 0 && (
        <>
          <H2>Tamamlanmış</H2>
          <List>
            {done.map((k, i) => (
              <TaskRow key={k.id} task={k} first={i === 0} />
            ))}
          </List>
        </>
      )}
    </Screen>
  );
}

function TaskRow({ task: k, first }: { task: Task; first: boolean }) {
  const c = useColors();
  const n = k.due ? daysBetween(todayISO(), k.due) : null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderTopWidth: first ? 0 : 1, borderTopColor: c.line }}>
      <Pressable
        onPress={() => farmStore.saveTask({ ...k, done: !k.done })}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: k.done }}
        accessibilityLabel="Tamamlandı"
        hitSlop={8}
        style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: c.green, backgroundColor: k.done ? c.green : 'transparent', alignItems: 'center', justifyContent: 'center' }}
      >
        {k.done ? <Icon name="check" size={17} color={c.onGreen} /> : null}
      </Pressable>
      <Text style={{ flex: 1, fontWeight: '700', fontSize: 15.5, color: k.done ? c.muted : c.text, textDecorationLine: k.done ? 'line-through' : 'none' }}>{k.title}</Text>
      {!k.done && n !== null && (n < 0 ? <Badge kind="danger">{inDays(n)}</Badge> : n <= 2 ? <Badge kind="warn">{inDays(n)}</Badge> : <Badge kind="ok">{fmt(k.due)}</Badge>)}
      <Pressable onPress={() => farmStore.deleteTask(k.id)} hitSlop={10} accessibilityLabel="Sil">
        <Icon name="close" size={18} color={c.muted} />
      </Pressable>
    </View>
  );
}
