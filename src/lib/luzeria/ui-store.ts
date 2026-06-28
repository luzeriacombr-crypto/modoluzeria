import { create } from "zustand";

interface UI {
  selectedClientId: string | null;
  selectedMonthKey: string;
  selectedItemId: string | null;
  recentlyUpdated: string | null;
  view: "dashboard" | "client" | "my" | "settings" | "stories" | "cleaning" | "admin";
  viewAsUserId: string | null;
  selectClient: (id: string | null) => void;
  selectMonth: (key: string) => void;
  openItem: (id: string | null) => void;
  flash: (id: string | null) => void;
  setView: (v: UI["view"]) => void;
  setViewAs: (id: string | null) => void;
}

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export const useUI = create<UI>((set) => ({
  selectedClientId: null,
  selectedMonthKey: currentMonthKey(),
  selectedItemId: null,
  recentlyUpdated: null,
  view: "my",
  viewAsUserId: null,
  selectClient: (id) =>
    set({ selectedClientId: id, selectedItemId: null, view: id ? "client" : "dashboard" }),
  selectMonth: (key) => set({ selectedMonthKey: key }),
  openItem: (id) => set({ selectedItemId: id }),
  flash: (id) => set({ recentlyUpdated: id }),
  setView: (v) => set({ view: v, selectedClientId: v === "client" ? undefined as any : null, selectedItemId: null }),
  setViewAs: (id) => set({ viewAsUserId: id }),
}));