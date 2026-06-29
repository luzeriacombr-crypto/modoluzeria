import { create } from "zustand";

const SIDEBAR_KEY = "lz.sidebarHidden";
function readSidebarHidden(): boolean {
  if (typeof window === "undefined") return false;
  try { return window.localStorage.getItem(SIDEBAR_KEY) === "1"; } catch { return false; }
}
function writeSidebarHidden(v: boolean) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(SIDEBAR_KEY, v ? "1" : "0"); } catch { /* noop */ }
}

interface UI {
  selectedClientId: string | null;
  selectedMonthKey: string;
  selectedItemId: string | null;
  recentlyUpdated: string | null;
  view: "client" | "my" | "settings" | "stories" | "cleaning" | "admin" | "profile";
  viewAsUserId: string | null;
  sidebarHidden: boolean;
  selectClient: (id: string | null) => void;
  selectMonth: (key: string) => void;
  openItem: (id: string | null) => void;
  flash: (id: string | null) => void;
  setView: (v: UI["view"]) => void;
  setViewAs: (id: string | null) => void;
  toggleSidebar: () => void;
  setSidebarHidden: (v: boolean) => void;
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
  sidebarHidden: readSidebarHidden(),
  selectClient: (id) =>
    set({ selectedClientId: id, selectedItemId: null, view: id ? "client" : "my" }),
  selectMonth: (key) => set({ selectedMonthKey: key }),
  openItem: (id) => set({ selectedItemId: id }),
  flash: (id) => set({ recentlyUpdated: id }),
  setView: (v) => set({ view: v, selectedClientId: v === "client" ? undefined as any : null, selectedItemId: null }),
  setViewAs: (id) => set({ viewAsUserId: id }),
  toggleSidebar: () => set((s) => { const next = !s.sidebarHidden; writeSidebarHidden(next); return { sidebarHidden: next }; }),
  setSidebarHidden: (v) => { writeSidebarHidden(v); set({ sidebarHidden: v }); },
}));