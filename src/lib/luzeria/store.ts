import { create } from "zustand";
import { persist } from "zustand/middleware";
import { nanoid } from "nanoid";
import type {
  Client,
  ContentItem,
  ContentType,
  CustomFields,
  MonthData,
  Status,
} from "./types";
import { currentMonthKey, nextMonthKey, PRESET_COLORS, PRESET_ICONS } from "./utils";

function emptyCustomFields(): CustomFields {
  return {
    niche: "",
    postsPerWeek: 0,
    reelsPerWeek: 0,
    fixedResponsible: "",
    reviewDay: "",
    notes: "",
  };
}

function makeItems(type: ContentType, count = 6): ContentItem[] {
  const label = type === "post" ? "Post" : "Reels";
  return Array.from({ length: count }, (_, i) => ({
    id: nanoid(),
    type,
    index: i + 1,
    title: `${label} ${i + 1}`,
    status: "START" as Status,
    assignee: null,
    copy: "",
    driveLink: "",
    comments: [],
    updatedAt: Date.now(),
  }));
}

function blankMonth(key: string): MonthData {
  return { key, posts: makeItems("post"), reels: makeItems("reel") };
}

function pickPresets(seedIdx: number) {
  return {
    color: PRESET_COLORS[seedIdx % PRESET_COLORS.length],
    icon: PRESET_ICONS[seedIdx % PRESET_ICONS.length],
  };
}

interface State {
  clients: Client[];
  selectedClientId: string | null;
  selectedMonthKey: string;
  selectedItemId: string | null;
  recentlyUpdated: string | null;

  // selection
  selectClient: (id: string | null) => void;
  selectMonth: (key: string) => void;
  openItem: (id: string | null) => void;

  // clients
  addClient: (name: string) => string;
  renameClient: (id: string, name: string) => void;
  toggleFavorite: (id: string) => void;
  archiveClient: (id: string, archived: boolean) => void;
  deleteClient: (id: string) => void;
  setClientStyle: (id: string, color: string, icon: string) => void;
  setCustomFields: (id: string, fields: CustomFields) => void;

  // months
  duplicateMonth: (clientId: string, fromKey: string) => void;
  ensureMonth: (clientId: string, key: string) => void;

  // items
  updateItem: (
    clientId: string,
    monthKey: string,
    itemId: string,
    patch: Partial<ContentItem>
  ) => void;
  setStatus: (
    clientId: string,
    monthKey: string,
    itemId: string,
    status: Status
  ) => void;
  addComment: (
    clientId: string,
    monthKey: string,
    itemId: string,
    text: string,
    author: string
  ) => void;

  // seed
  reseed: () => void;
}

function findItem(
  state: State,
  clientId: string,
  monthKey: string,
  itemId: string
) {
  const client = state.clients.find((c) => c.id === clientId);
  if (!client) return null;
  const month = client.months[monthKey];
  if (!month) return null;
  const list = month.posts.find((i) => i.id === itemId)
    ? month.posts
    : month.reels;
  const item = list.find((i) => i.id === itemId) ?? null;
  return item ? { client, month, item } : null;
}

function mapItem(
  state: State,
  clientId: string,
  monthKey: string,
  itemId: string,
  fn: (item: ContentItem) => ContentItem
): State {
  return {
    ...state,
    clients: state.clients.map((c) => {
      if (c.id !== clientId) return c;
      const month = c.months[monthKey];
      if (!month) return c;
      const transform = (arr: ContentItem[]) =>
        arr.map((i) => (i.id === itemId ? fn(i) : i));
      return {
        ...c,
        months: {
          ...c.months,
          [monthKey]: {
            ...month,
            posts: transform(month.posts),
            reels: transform(month.reels),
          },
        },
      };
    }),
    recentlyUpdated: itemId,
  };
}

function seedClients(): Client[] {
  const key = "2026-06";
  const names = [
    "Thamara Leal",
    "Eglantine Queiroz",
    "Fonseca e Pinto",
    "MR Mix",
    "Natalia Medeiros",
  ];
  const clients: Client[] = names.map((name, i) => {
    const { color, icon } = pickPresets(i);
    return {
      id: nanoid(),
      name,
      color,
      icon,
      favorite: i === 0,
      archived: false,
      customFields: emptyCustomFields(),
      months: { [key]: blankMonth(key) },
      createdAt: Date.now() - i * 1000,
    };
  });

  // Thamara detailed data
  const thamara = clients[0];
  thamara.customFields = {
    niche: "Saúde da mulher",
    postsPerWeek: 3,
    reelsPerWeek: 2,
    fixedResponsible: "Jordania",
    reviewDay: "Toda sexta",
    notes: "Cliente preferencial. Cuidado com termos médicos.",
  };

  const t = thamara.months[key];
  const posts: Array<[string, Status, string | null]> = [
    ["Estamos na metade do ano...", "REVISAO_ARTE", "Jordania"],
    ["Ela tratou o mesmo problema...", "REVISAO_ARTE", "Jordania"],
    ["Se você usa isso no banho...", "REVISAO_ARTE", "Jordania"],
    ["POV: você finalmente falou...", "CRIACAO", "Lucas"],
    ["Você usa o mesmo anticoncep...", "REVISAO_ARTE", "Jordania"],
    ["Presidente Dutra completa...", "CRIACAO", "Lucas"],
  ];
  t.posts = posts.map(([title, status, assignee], i) => ({
    id: nanoid(),
    type: "post",
    index: i + 1,
    title,
    status,
    assignee,
    copy: "",
    driveLink: "",
    comments: [],
    updatedAt: Date.now(),
  }));

  const reels: Array<[string, Status, string | null]> = [
    ["Ação CIOMED", "FINALIZADO", "Jordania"],
    ["Endometriose", "REVISAO_CLIENTE", "Jordania"],
    ["Exame para investigar endome...", "REVISAO_CLIENTE", null],
    ["Corrimento vaginal de repetição", "REVISAO_CLIENTE", null],
    ["A endometriose não anda sozi...", "REVISAO_CLIENTE", null],
    ["Título placeholder", "START", null],
  ];
  t.reels = reels.map(([title, status, assignee], i) => ({
    id: nanoid(),
    type: "reel",
    index: i + 1,
    title,
    status,
    assignee,
    copy: "",
    driveLink: "",
    comments: [],
    updatedAt: Date.now(),
  }));

  return clients;
}

export const useLuzeria = create<State>()(
  persist(
    (set, get) => ({
      clients: seedClients(),
      selectedClientId: null,
      selectedMonthKey: "2026-06",
      selectedItemId: null,
      recentlyUpdated: null,

      selectClient: (id) =>
        set((s) => ({
          selectedClientId: id,
          selectedItemId: null,
          selectedMonthKey: (() => {
            if (!id) return s.selectedMonthKey;
            const c = s.clients.find((x) => x.id === id);
            if (!c) return s.selectedMonthKey;
            if (c.months[s.selectedMonthKey]) return s.selectedMonthKey;
            const keys = Object.keys(c.months).sort();
            return keys[keys.length - 1] ?? currentMonthKey();
          })(),
        })),
      selectMonth: (key) => set({ selectedMonthKey: key }),
      openItem: (id) => set({ selectedItemId: id }),

      addClient: (name) => {
        const id = nanoid();
        const key = currentMonthKey();
        const seedIdx = get().clients.length;
        const { color, icon } = pickPresets(seedIdx);
        const client: Client = {
          id,
          name,
          color,
          icon,
          favorite: false,
          archived: false,
          customFields: emptyCustomFields(),
          months: { [key]: blankMonth(key) },
          createdAt: Date.now(),
        };
        set((s) => ({
          clients: [...s.clients, client],
          selectedClientId: id,
          selectedMonthKey: key,
        }));
        return id;
      },

      renameClient: (id, name) =>
        set((s) => ({
          clients: s.clients.map((c) => (c.id === id ? { ...c, name } : c)),
        })),

      toggleFavorite: (id) =>
        set((s) => ({
          clients: s.clients.map((c) =>
            c.id === id ? { ...c, favorite: !c.favorite } : c
          ),
        })),

      archiveClient: (id, archived) =>
        set((s) => ({
          clients: s.clients.map((c) =>
            c.id === id ? { ...c, archived } : c
          ),
        })),

      deleteClient: (id) =>
        set((s) => ({
          clients: s.clients.filter((c) => c.id !== id),
          selectedClientId:
            s.selectedClientId === id ? null : s.selectedClientId,
        })),

      setClientStyle: (id, color, icon) =>
        set((s) => ({
          clients: s.clients.map((c) =>
            c.id === id ? { ...c, color, icon } : c
          ),
        })),

      setCustomFields: (id, fields) =>
        set((s) => ({
          clients: s.clients.map((c) =>
            c.id === id ? { ...c, customFields: fields } : c
          ),
        })),

      duplicateMonth: (clientId, fromKey) => {
        set((s) => {
          const c = s.clients.find((x) => x.id === clientId);
          if (!c) return s;
          const from = c.months[fromKey];
          if (!from) return s;
          const newKey = nextMonthKey(fromKey);
          const cloneItems = (arr: ContentItem[], type: ContentType) =>
            arr.map((it, i) => ({
              id: nanoid(),
              type,
              index: i + 1,
              title: it.title,
              status: "START" as Status,
              assignee: it.assignee,
              copy: "",
              driveLink: "",
              comments: [],
              updatedAt: Date.now(),
            }));
          const newMonth: MonthData = {
            key: newKey,
            posts: cloneItems(from.posts, "post"),
            reels: cloneItems(from.reels, "reel"),
          };
          return {
            ...s,
            clients: s.clients.map((cl) =>
              cl.id === clientId
                ? { ...cl, months: { ...cl.months, [newKey]: newMonth } }
                : cl
            ),
            selectedMonthKey: newKey,
          };
        });
      },

      ensureMonth: (clientId, key) =>
        set((s) => {
          const c = s.clients.find((x) => x.id === clientId);
          if (!c || c.months[key]) return s;
          return {
            ...s,
            clients: s.clients.map((cl) =>
              cl.id === clientId
                ? { ...cl, months: { ...cl.months, [key]: blankMonth(key) } }
                : cl
            ),
          };
        }),

      updateItem: (clientId, monthKey, itemId, patch) =>
        set((s) =>
          mapItem(s, clientId, monthKey, itemId, (it) => ({
            ...it,
            ...patch,
            updatedAt: Date.now(),
          }))
        ),

      setStatus: (clientId, monthKey, itemId, status) =>
        set((s) => {
          const found = findItem(s, clientId, monthKey, itemId);
          if (!found) return s;
          const prev = found.item.status;
          if (prev === status) return s;
          const sysComment: Comment = {
            id: nanoid(),
            text: `Status alterado de ${prev} para ${status}`,
            author: "system",
            createdAt: Date.now(),
            system: true,
          };
          return mapItem(s, clientId, monthKey, itemId, (it) => ({
            ...it,
            status,
            updatedAt: Date.now(),
            comments: [...it.comments, sysComment],
          }));
        }),

      addComment: (clientId, monthKey, itemId, text, author) =>
        set((s) =>
          mapItem(s, clientId, monthKey, itemId, (it) => ({
            ...it,
            comments: [
              ...it.comments,
              {
                id: nanoid(),
                text,
                author,
                createdAt: Date.now(),
              },
            ],
            updatedAt: Date.now(),
          }))
        ),

      reseed: () =>
        set({
          clients: seedClients(),
          selectedClientId: null,
          selectedItemId: null,
          selectedMonthKey: "2026-06",
        }),
    }),
    { name: "luzeria-v1" }
  )
);

// re-export Comment type usage above
import type { Comment } from "./types";