import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  addAssignee, addComment, addContentItem, createClient, deleteClient, deleteItem, duplicateMonth,
  getMe, getMonth, getProductivity, listClients, listMonthKeys, listMyTasks, listNotifications,
  listProfiles, markNotificationRead, removeAssignee, setItemStatus,
  setUserActive, setUserRole, deleteUser, updateClient, updateItem, updateMyProfile,
  listStories, upsertStoryDay, getCleaning, upsertCleaningCell, updateCleaningNote, getMyToday,
  adminCreateUser, getAdminDashboard, getTopMembers, getMemberFinalizations,
  getReport, getMemberReportDetail,
  getClientFicha,
  upsertClientLink, deleteClientLink,
  upsertClientContact, deleteClientContact,
  upsertClientSecret, deleteClientSecret,
} from "./api.functions";
import {
  updateChecklist, rateItem,
  listGoals, setGoals, getGoalProgress,
  getClientOnboarding, updateClientOnboarding,
  listRecurring, upsertRecurring, deleteRecurring, generateRecurring,
  listActivity, getReportExtras, getMemberStatusDuration,
  getAppSettings, updateAppSettings,
  getMyWeek, getWorkload, getItemTimeline, addCommentWithMentions,
} from "./roadmap.functions";

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

export const adminDashboardQO = (monthKey: string) =>
  queryOptions({
    queryKey: ["admin-dashboard", monthKey],
    queryFn: () => getAdminDashboard({ data: { monthKey } }),
    enabled: !!monthKey,
  });

export const topMembersQO = (period: "month" | "3m" | "6m" | "year", monthKey: string) =>
  queryOptions({
    queryKey: ["top-members", period, monthKey],
    queryFn: () => getTopMembers({ data: { period, monthKey } }),
    enabled: !!monthKey,
  });

export const memberFinalizationsQO = (
  userId: string,
  period: "month" | "3m" | "6m" | "year",
  monthKey: string,
) =>
  queryOptions({
    queryKey: ["member-finalizations", userId, period, monthKey],
    queryFn: () => getMemberFinalizations({ data: { userId, period, monthKey } }),
    enabled: !!userId && !!monthKey,
  });

export type ReportFilters = {
  userId?: string | null;
  from: string;
  to: string;
  type?: "all" | "post" | "reel" | "outros" | "stories" | "cleaning";
  clientId?: string | null;
};

export const reportQO = (filters: ReportFilters) =>
  queryOptions({
    queryKey: ["report", filters],
    queryFn: () => getReport({ data: filters as any }),
    enabled: !!filters.from && !!filters.to,
  });

export const memberReportDetailQO = (userId: string, from: string, to: string) =>
  queryOptions({
    queryKey: ["member-report-detail", userId, from, to],
    queryFn: () => getMemberReportDetail({ data: { userId, from, to } }),
    enabled: !!userId && !!from && !!to,
  });

export const clientFichaQO = (clientId: string | null) =>
  queryOptions({
    queryKey: ["client-ficha", clientId],
    queryFn: () => getClientFicha({ data: { clientId: clientId! } }),
    enabled: !!clientId,
  });

/* ====== ROADMAP QUERIES ====== */

export const goalsQO = (monthKey: string) =>
  queryOptions({
    queryKey: ["goals", monthKey],
    queryFn: () => listGoals({ data: { monthKey } }),
    enabled: !!monthKey,
  });

export const goalProgressQO = (monthKey: string, userId?: string) =>
  queryOptions({
    queryKey: ["goal-progress", userId ?? "self", monthKey],
    queryFn: () => getGoalProgress({ data: { monthKey, userId } }),
    enabled: !!monthKey,
  });

export const clientOnboardingQO = (clientId: string | null) =>
  queryOptions({
    queryKey: ["client-onboarding", clientId],
    queryFn: () => getClientOnboarding({ data: { clientId: clientId! } }),
    enabled: !!clientId,
  });

export const recurringQO = (clientId: string | null) =>
  queryOptions({
    queryKey: ["recurring", clientId],
    queryFn: () => listRecurring({ data: { clientId: clientId! } }),
    enabled: !!clientId,
  });

export const activityQO = (entityType?: string, entityId?: string, limit?: number) =>
  queryOptions({
    queryKey: ["activity", entityType ?? "*", entityId ?? "*", limit ?? 50],
    queryFn: () => listActivity({ data: { entityType, entityId, limit } }),
  });

export const reportExtrasQO = (filters: ReportFilters) =>
  queryOptions({
    queryKey: ["report-extras", filters],
    queryFn: () => getReportExtras({
      data: {
        from: filters.from, to: filters.to,
        clientId: filters.clientId ?? null,
        userId: filters.userId ?? null,
      },
    }),
    enabled: !!filters.from && !!filters.to,
  });

export const memberStatusDurationQO = (userId: string) =>
  queryOptions({
    queryKey: ["member-status-duration", userId],
    queryFn: () => getMemberStatusDuration({ data: { userId } }),
    enabled: !!userId,
  });

export const appSettingsQO = () =>
  queryOptions({ queryKey: ["app-settings"], queryFn: () => getAppSettings() });

export const myWeekQO = (from: string, to: string, userId?: string) =>
  queryOptions({
    queryKey: ["my-week", userId ?? "self", from, to],
    queryFn: () => getMyWeek({ data: { userId, from, to } }),
    enabled: !!from && !!to,
  });

export const workloadQO = (userId: string) =>
  queryOptions({
    queryKey: ["workload", userId],
    queryFn: () => getWorkload({ data: { userId } }),
    enabled: !!userId,
  });

export const itemTimelineQO = (itemId: string | null) =>
  queryOptions({
    queryKey: ["item-timeline", itemId],
    queryFn: () => getItemTimeline({ data: { itemId: itemId! } }),
    enabled: !!itemId,
  });

export function useMe() { return useQuery(meQO()); }

export function useApi() {
  const qc = useQueryClient();
  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["month"] });
    qc.invalidateQueries({ queryKey: ["clients"] });
    qc.invalidateQueries({ queryKey: ["my-tasks"] });
    qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
    qc.invalidateQueries({ queryKey: ["top-members"] });
    qc.invalidateQueries({ queryKey: ["member-finalizations"] });
  };
  return {
    createClient: useMutation({ mutationFn: useServerFn(createClient), onSuccess: () => qc.invalidateQueries({ queryKey: ["clients"] }) }),
    updateClient: useMutation({ mutationFn: useServerFn(updateClient), onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
    } }),
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
    adminCreateUser: useMutation({ mutationFn: useServerFn(adminCreateUser), onSuccess: () => qc.invalidateQueries({ queryKey: ["profiles"] }) }),
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
    upsertClientLink: useMutation({
      mutationFn: useServerFn(upsertClientLink),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["client-ficha"] }),
    }),
    deleteClientLink: useMutation({
      mutationFn: useServerFn(deleteClientLink),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["client-ficha"] }),
    }),
    upsertClientContact: useMutation({
      mutationFn: useServerFn(upsertClientContact),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["client-ficha"] }),
    }),
    deleteClientContact: useMutation({
      mutationFn: useServerFn(deleteClientContact),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["client-ficha"] }),
    }),
    upsertClientSecret: useMutation({
      mutationFn: useServerFn(upsertClientSecret),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["client-ficha"] }),
    }),
    deleteClientSecret: useMutation({
      mutationFn: useServerFn(deleteClientSecret),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["client-ficha"] }),
    }),
    /* ===== ROADMAP MUTATIONS ===== */
    updateChecklist: useMutation({
      mutationFn: useServerFn(updateChecklist),
      onSuccess: invalidateAll,
    }),
    rateItem: useMutation({
      mutationFn: useServerFn(rateItem),
      onSuccess: invalidateAll,
    }),
    setGoals: useMutation({
      mutationFn: useServerFn(setGoals),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["goals"] });
        qc.invalidateQueries({ queryKey: ["goal-progress"] });
      },
    }),
    updateClientOnboarding: useMutation({
      mutationFn: useServerFn(updateClientOnboarding),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["client-onboarding"] }),
    }),
    upsertRecurring: useMutation({
      mutationFn: useServerFn(upsertRecurring),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["recurring"] }),
    }),
    deleteRecurring: useMutation({
      mutationFn: useServerFn(deleteRecurring),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["recurring"] }),
    }),
    generateRecurring: useMutation({
      mutationFn: useServerFn(generateRecurring),
      onSuccess: invalidateAll,
    }),
    updateAppSettings: useMutation({
      mutationFn: useServerFn(updateAppSettings),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["app-settings"] }),
    }),
    addCommentWithMentions: useMutation({
      mutationFn: useServerFn(addCommentWithMentions),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["month"] });
        qc.invalidateQueries({ queryKey: ["notifications"] });
      },
    }),
  };
}