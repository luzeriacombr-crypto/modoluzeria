import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  addAssignee, addComment, addContentItem, createClient, deleteClient, deleteItem, duplicateMonth,
  getMe, getMonth, getProductivity, listClients, listMonthKeys, listMyTasks, listNotifications,
  listProfiles, markNotificationRead, removeAssignee, setItemStatus,
  setUserActive, setUserRole, deleteUser, updateClient, updateItem, updateMyProfile,
  listStories, upsertStoryDay, getCleaning, upsertCleaningCell, updateCleaningNote, getMyToday,
} from "./api.functions";

export const meQO = () => queryOptions({ queryKey: ["me"], queryFn: () => getMe() });
export const profilesQO = () => queryOptions({ queryKey: ["profiles"], queryFn: () => listProfiles() });
export const clientsQO = () => queryOptions({ queryKey: ["clients"], queryFn: () => listClients() });
export const monthQO = (clientId: string, key: string) =>
  queryOptions({
    queryKey: ["month", clientId, key],
    queryFn: () => getMonth({ data: { clientId, key } }),
    enabled: !!clientId && !!key,
  });
export const monthKeysQO = (clientId: string) =>
  queryOptions({
    queryKey: ["monthKeys", clientId],
    queryFn: () => listMonthKeys({ data: { clientId } }),
    enabled: !!clientId,
  });
export const notificationsQO = () =>
  queryOptions({ queryKey: ["notifications"], queryFn: () => listNotifications(), refetchInterval: 60_000 });
export const myTasksQO = (userId?: string) =>
  queryOptions({ queryKey: ["my-tasks", userId ?? "self"], queryFn: () => listMyTasks({ data: { userId } }) });
export const productivityQO = (monthKey: string, userId?: string) =>
  queryOptions({
    queryKey: ["productivity", userId ?? "self", monthKey],
    queryFn: () => getProductivity({ data: { userId, monthKey } }),
    enabled: !!monthKey,
  });

export const storiesQO = (monthKey: string) =>
  queryOptions({
    queryKey: ["stories", monthKey],
    queryFn: () => listStories({ data: { monthKey } }),
    enabled: !!monthKey,
  });
export const cleaningQO = () =>
  queryOptions({ queryKey: ["cleaning"], queryFn: () => getCleaning() });
export const myTodayQO = (today: string, weekday: number, userId?: string) =>
  queryOptions({
    queryKey: ["my-today", userId ?? "self", today],
    queryFn: () => getMyToday({ data: { userId, today, weekday } }),
  });

export function useMe() { return useQuery(meQO()); }

export function useApi() {
  const qc = useQueryClient();
  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["month"] });
    qc.invalidateQueries({ queryKey: ["clients"] });
    qc.invalidateQueries({ queryKey: ["my-tasks"] });
  };
  return {
    createClient: useMutation({ mutationFn: useServerFn(createClient), onSuccess: () => qc.invalidateQueries({ queryKey: ["clients"] }) }),
    updateClient: useMutation({ mutationFn: useServerFn(updateClient), onSuccess: () => qc.invalidateQueries({ queryKey: ["clients"] }) }),
    deleteClient: useMutation({ mutationFn: useServerFn(deleteClient), onSuccess: () => qc.invalidateQueries({ queryKey: ["clients"] }) }),
    duplicateMonth: useMutation({
      mutationFn: useServerFn(duplicateMonth),
      onSuccess: (_d, vars: any) => {
        qc.invalidateQueries({ queryKey: ["monthKeys", vars?.data?.clientId] });
        qc.invalidateQueries({ queryKey: ["month"] });
      },
    }),
    updateItem: useMutation({ mutationFn: useServerFn(updateItem), onSuccess: invalidateAll }),
    setItemStatus: useMutation({ mutationFn: useServerFn(setItemStatus), onSuccess: invalidateAll }),
    addAssignee: useMutation({ mutationFn: useServerFn(addAssignee), onSuccess: invalidateAll }),
    removeAssignee: useMutation({ mutationFn: useServerFn(removeAssignee), onSuccess: invalidateAll }),
    addComment: useMutation({ mutationFn: useServerFn(addComment), onSuccess: invalidateAll }),
    addContentItem: useMutation({ mutationFn: useServerFn(addContentItem), onSuccess: invalidateAll }),
    deleteItem: useMutation({ mutationFn: useServerFn(deleteItem), onSuccess: invalidateAll }),
    setUserRole: useMutation({ mutationFn: useServerFn(setUserRole), onSuccess: () => qc.invalidateQueries({ queryKey: ["profiles"] }) }),
    setUserActive: useMutation({ mutationFn: useServerFn(setUserActive), onSuccess: () => qc.invalidateQueries({ queryKey: ["profiles"] }) }),
    deleteUser: useMutation({ mutationFn: useServerFn(deleteUser), onSuccess: () => qc.invalidateQueries({ queryKey: ["profiles"] }) }),
    updateMyProfile: useMutation({ mutationFn: useServerFn(updateMyProfile), onSuccess: () => qc.invalidateQueries({ queryKey: ["me"] }) }),
    markNotificationRead: useMutation({ mutationFn: useServerFn(markNotificationRead), onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }) }),
    upsertStoryDay: useMutation({
      mutationFn: useServerFn(upsertStoryDay),
      onSuccess: () => { qc.invalidateQueries({ queryKey: ["stories"] }); qc.invalidateQueries({ queryKey: ["my-today"] }); },
    }),
    upsertCleaningCell: useMutation({
      mutationFn: useServerFn(upsertCleaningCell),
      onSuccess: () => { qc.invalidateQueries({ queryKey: ["cleaning"] }); qc.invalidateQueries({ queryKey: ["my-today"] }); },
    }),
    updateCleaningNote: useMutation({
      mutationFn: useServerFn(updateCleaningNote),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["cleaning"] }),
    }),
  };
}