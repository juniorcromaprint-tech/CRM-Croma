import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import {
  type RoleName,
  type Module,
  type Action,
  ROLE_PERMISSIONS,
  getAccessibleModules,
} from '@/shared/constants/permissions';

export type { RoleName };

type Profile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  role: RoleName | null;
};

type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
  /** Verifica se o usuário tem permissão para uma ação em um módulo */
  can: (module: Module, action: Action) => boolean;
  /** Módulos acessíveis: null = todos (demo/admin) */
  accessibleModules: string[] | null;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async (userId: string) => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

        if (!error && data) {
          setProfile(data as Profile);
        }
      } catch (error) {
        console.error('Erro ao buscar perfil:', error);
      } finally {
        setIsLoading(false);
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setIsLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setIsLoading(false);
      }
    });

    return () => { subscription.unsubscribe(); };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  /** Role efetiva: sem role atribuída = admin (acesso total) */
  const effectiveRole = profile?.role ?? 'admin';

  /** Verifica permissão usando role efetiva */
  const can = useMemo(() => {
    return (module: Module, action: Action): boolean => {
      const rolePerms = ROLE_PERMISSIONS[effectiveRole];
      return rolePerms?.[module]?.includes(action) ?? false;
    };
  }, [effectiveRole]);

  /** Módulos acessíveis: null = todos (admin sem role), lista filtrada para demais */
  const accessibleModules = useMemo<string[] | null>(() => {
    if (!profile?.role) {
      return null; // sem role = acesso total (admin)
    }
    return getAccessibleModules(profile.role);
  }, [profile?.role]);

  return (
    <AuthContext.Provider value={{ session, user, profile, isLoading, signOut, can, accessibleModules }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};
