import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { repo, type Session } from '../data';
import { farmStore } from './farmStore';

interface AuthState {
  session: Session | null;
  ready: boolean;
}

const Ctx = createContext<AuthState>({ session: null, ready: false });

/** Sessiyanı izləyir və istifadəçi dəyişəndə ferma store-unu başladır/dayandırır. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, ready: false });

  useEffect(() => {
    let alive = true;
    const apply = (s: Session | null) => {
      if (!alive) return;
      setState({ session: s, ready: true });
      if (s) void farmStore.start(s.userId);
      else farmStore.stop();
    };
    repo.auth.getSession().then(apply, () => apply(null));
    const off = repo.auth.onChange(apply);
    return () => {
      alive = false;
      off();
    };
  }, []);

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
