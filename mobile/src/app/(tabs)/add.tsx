import { Redirect } from 'expo-router';

/** "Əlavə et" tabı birbaşa formanı açır (bax: (tabs)/_layout.tsx); bu ekrana düşülərsə yönləndiririk. */
export default function Add() {
  return <Redirect href="/animal/form" />;
}
