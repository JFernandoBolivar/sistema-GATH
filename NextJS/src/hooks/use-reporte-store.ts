import { create } from "zustand";

interface ReporteState {
  searchParams: string;
  setSearchParams: (params: string) => void;
  resetSearchParams: () => void;
}

export const useReporteStore = create<ReporteState>((set) => ({
  searchParams: "",
  setSearchParams: (params: string) => set({ searchParams: params }),
  resetSearchParams: () => set({ searchParams: "" }),
}));
