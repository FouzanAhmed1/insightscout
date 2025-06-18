import { create } from "zustand";
import { api } from "./api";

interface AuthState {
  user: any | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  login: async (email, password) => {
    await api.login(email, password);
    const user = await api.getMe();
    set({ user });
  },
  register: async (email, password, fullName) => {
    await api.register(email, password, fullName);
    const user = await api.getMe();
    set({ user });
  },
  logout: () => {
    api.logout();
    set({ user: null });
  },
  checkAuth: async () => {
    try {
      if (api.getToken()) {
        const user = await api.getMe();
        set({ user, loading: false });
      } else {
        set({ loading: false });
      }
    } catch {
      set({ user: null, loading: false });
    }
  },
}));
