import { create } from "zustand";

interface SearchState {
  searchParams: string;
  setSearchParams: (params: string) => void;
}

export const useSearchStore = create<SearchState>((set) => ({
  searchParams: "",
  setSearchParams: (params: string) => set({ searchParams: params }),
}));
