import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  addAssignee, addComment, addContentItem, createClient, deleteClient, deleteItem, duplicateMonth, setNotifyStoriesInTasks,
  getMe, getMonth, getProductivity, getMyActivityCounts, listClients, listMonthKeys, listMyTasks, listNotifications,
  listProfiles, markNotificationRead, removeAssignee, setItemStatus,
  setUserActive, setUserRole, setExcludeFromRanking, deleteUser, updateClient, updateItem, updateMyProfile, adminUpdateMemberAvatar,
  getCleaning, upsertCleaningCell, setCleaningDone, updateCleaningNote, getMyToday,
  listCleaningTasks, addCleaningTask, renameCleaningTask, deleteCleaningTask,
  adminCreateUser, createAgency, updateMyOrg, getOrgPlanStatus, getPlans, subscribeToPlan, getSetupChecklist, adminSendPasswordReset, adminSetUserPassword, getAdminDashboard, getTopMembers, getMemberFinalizations,
  listOrgsBilling, getOrgNextInvoice,
  updateMyAccount,
  getReport, getMemberReportDetail, getMemberVelocity,
  updateFeedOrder,
  setFeedOrderMode,
  setFeedOrderDirection,
  setItemCover,
  uploadItemCover,
  getClientFicha,
  upsertClientLink, deleteClientLink,
  upsertClientContact, deleteClientContact,
  upsertClientSecret, deleteClientSecret,
  listMyMentions, markMentionRead,
} from "./api.functions";
import {
  updateChecklist, rateItem,
  listGoals, setGoals, getGoalProgress,
  getClientOnboarding, updateClientOnboarding, setOnboardingDefaults,
  listRecurring, upsertRecurring, deleteRecurring, generateRecurring,
  listActivity, getReportExtras, getMemberStatusDuration,
  getAppSettings, updateAppSettings,
  getMyWeek, getWorkload, getItemTimeline, addCommentWithMentions, updateComment,
} from "./roadmap.functions";
import {
  listItemFiles, searchDriveFiles, attachDriveFile, uploadDriveFile, syncUploadToDrive, detachItemFile,
  getDriveThumbnail, getDriveFileBytes, reorderItemFiles, getGridThumbnails,
  getClientDeliveriesFolder, setClientDeliveriesFolder, clearClientDeliveriesFolder,
} from "./drive.functions";
import {
  getMyNotificationPreferences, setMyNotificationPreferences,
  runDailyDigestNow, runDeadlineRemindersNow, listCronJobs,
} from "./automations.functions";
import { listAutomationRules, createAutomationRule, deleteAutomationRule } from "./automation-rules.functions";
import { listMyBugReports, listAllBugReports, updateBugReportStatus, sendBugReportMessage } from "./bug-reports.functions";
import {
  getOrCreateShareToken, rotateShareToken, listClientFeedback, getFeedApprovalSummary,
  getPublicFeed, getPublicDriveThumbnail, addPublicFeedback,
} from "./feed-share.functions";
import { listPlatformUpdates, createPlatformUpdate, deletePlatformUpdate } from "./platform-updates.functions";
import { publishToInstagram, setInstagramAutoPublish } from "./instagram.functions";
import { getCalendarItems } from "./calendar.functions";
import {
  getSalesPageBlocks, listSalesPageBlocksAdmin, createSalesPageBlock, updateSalesPageBlock,
  deleteSalesPageBlock, reorderSalesPageBlocks, publishSalesPageBlocks,
} from "./sales-page.functions";
export const meQO = () => queryOptions({ queryKey: ["me"], queryFn: () => getMe() });
export const calendarItemsQO = (from: string, to: string) =>
  queryOptions({
    queryKey: ["calendar-items", from, to],
    queryFn: () => getCalendarItems({ data: { from, to } }),
    enabled: !!from && !!to,
  });
export const platformUpdatesQO = () => queryOptions({ queryKey: ["platform-updates"], queryFn: () => listPlatformUpdates() });
export const salesPageBlocksQO = () => queryOptions({ queryKey: ["sales-page-blocks"], queryFn: () => getSalesPageBlocks() });
export const salesPageBlocksAdminQO = () => queryOptions({ queryKey: ["sales-page-blocks-admin"], queryFn: () => listSalesPageBlocksAdmin() });
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
export const myMentionsQO = () =>
  queryOptions({ queryKey: ["my-mentions"], queryFn: () => listMyMentions(), refetchInterval: 60_000 });
export const myTasksQO = (userId?: string) =>
  queryOptions({ queryKey: ["my-tasks", userId ?? "self"], queryFn: () => listMyTasks({ data: { userId } }) });
export const productivityQO = (monthKey: string, userId?: string) =>
  queryOptions({
    queryKey: ["productivity", userId ?? "self", monthKey],
    queryFn: () => getProductivity({ data: { userId, monthKey } }),
    enabled: !!monthKey,
  });
export const myActivityCountsQO = (monthKey: string, userId?: string) =>
  queryOptions({
    queryKey: ["my-activity-counts", userId ?? "self", monthKey],
    queryFn: () => getMyActivityCounts({ data: { userId, monthKey } }),
    enabled: !!monthKey,
  });

export const cleaningQO = () =>
  queryOptions({ queryKey: ["cleaning"], queryFn: () => getCleaning() });
export const cleaningTasksQO = () =>
  queryOptions({ queryKey: ["cleaning-tasks"], queryFn: () => listCleaningTasks() });
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
  type?: "all" | "post" | "reel" | "outros" | "gravacao" | "roteiro" | "sistema" | "stories" | "cleaning";
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

export const memberVelocityQO = (from: string, to: string) =>
  queryOptions({
    queryKey: ["member-velocity", from, to],
    queryFn: () => getMemberVelocity({ data: { from, to } }),
    enabled: !!from && !!to,
  });

export const appSettingsQO = () =>
  queryOptions({ queryKey: ["app-settings"], queryFn: () => getAppSettings() });

export const orgPlanStatusQO = () =>
  queryOptions({ queryKey: ["org-plan-status"], queryFn: () => getOrgPlanStatus() });
export const orgsBillingQO = () =>
  queryOptions({ queryKey: ["orgs-billing"], queryFn: () => listOrgsBilling() });

export const setupChecklistQO = () =>
  queryOptions({ queryKey: ["setup-checklist"], queryFn: () => getSetupChecklist() });

export const plansQO = () =>
  queryOptions({ queryKey: ["plans"], queryFn: () => getPlans() });

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

export const itemFilesQO = (itemId: string | null, kind: "media" | "briefing" = "media") =>
  queryOptions({
    queryKey: ["item-files", itemId, kind],
    queryFn: () => listItemFiles({ data: { itemId: itemId!, kind } }),
    enabled: !!itemId,
  });

export const driveSearchQO = (query: string, enabled: boolean) =>
  queryOptions({
    queryKey: ["drive-search", query],
    queryFn: () => searchDriveFiles({ data: { query } }),
    enabled,
    staleTime: 30_000,
  });

export const driveThumbnailQO = (fileId: string | null | undefined, enabled = true, size?: number) =>
  queryOptions({
    queryKey: ["drive-thumb", fileId, size],
    queryFn: () => getDriveThumbnail({ data: { fileId: fileId!, size } }),
    enabled: !!fileId && enabled,
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
    retry: 2,
  });

/** Batched thumbnail lookup for grids (e.g. feed preview) — one round trip
 * for the whole grid instead of 2 round trips per cell. */
export const gridThumbnailsQO = (itemIds: string[]) =>
  queryOptions({
    queryKey: ["grid-thumbs", [...itemIds].sort()],
    queryFn: () => getGridThumbnails({ data: { itemIds } }),
    enabled: itemIds.length > 0,
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
    retry: 2,
  });

/** Client approval status for the "Preview de Feed" tab — feed-level
 * approval timestamp plus per-item approved/comment breakdown. Admin only. */
export const feedApprovalSummaryQO = (clientId: string, monthId: string, itemIds: string[]) =>
  queryOptions({
    queryKey: ["feed-approval-summary", clientId, monthId, [...itemIds].sort()],
    queryFn: () => getFeedApprovalSummary({ data: { clientId, monthId, itemIds } }),
    staleTime: 1000 * 30,
  });

export const clientDeliveriesFolderQO = (clientId: string | null) =>
  queryOptions({
    queryKey: ["client-deliveries-folder", clientId],
    queryFn: () => getClientDeliveriesFolder({ data: { clientId: clientId! } }),
    enabled: !!clientId,
    staleTime: 30_000,
  });

export const notificationPrefsQO = () =>
  queryOptions({
    queryKey: ["notification-prefs"],
    queryFn: () => getMyNotificationPreferences(),
    staleTime: 60_000,
  });

export const cronJobsQO = () =>
  queryOptions({
    queryKey: ["cron-jobs"],
    queryFn: () => listCronJobs(),
    staleTime: 30_000,
  });

export const automationRulesQO = () =>
  queryOptions({ queryKey: ["automation-rules"], queryFn: () => listAutomationRules() });

export const myBugReportsQO = () =>
  queryOptions({ queryKey: ["bug-reports", "mine"], queryFn: () => listMyBugReports() });

export const allBugReportsQO = () =>
  queryOptions({ queryKey: ["bug-reports", "all"], queryFn: () => listAllBugReports() });

export const clientFeedbackQO = (itemId: string | null) =>
  queryOptions({
    queryKey: ["client-feedback", itemId],
    queryFn: () => listClientFeedback({ data: { itemId: itemId! } }),
    enabled: !!itemId,
    staleTime: 15_000,
  });

export const publicFeedQO = (token: string | null) =>
  queryOptions({
    queryKey: ["public-feed", token],
    queryFn: () => getPublicFeed({ data: { token: token! } }),
    enabled: !!token,
    staleTime: 30_000,
  });

export const publicDriveThumbQO = (token: string, fileId: string | null) =>
  queryOptions({
    queryKey: ["public-drive-thumb", token, fileId],
    queryFn: () => getPublicDriveThumbnail({ data: { token, fileId: fileId! } }),
    enabled: !!token && !!fileId,
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
    retry: false,
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
    setNotifyStoriesInTasks: useMutation({
      mutationFn: useServerFn(setNotifyStoriesInTasks),
      onSuccess: () => { qc.invalidateQueries({ queryKey: ["clients"] }); qc.invalidateQueries({ queryKey: ["my-tasks"] }); },
    }),
    deleteClient: useMutation({ mutationFn: useServerFn(deleteClient), onSuccess: () => qc.invalidateQueries({ queryKey: ["clients"] }) }),
    duplicateMonth: useMutation({
      mutationFn: useServerFn(duplicateMonth),
      onSuccess: (_d, vars: any) => {
        qc.invalidateQueries({ queryKey: ["monthKeys", vars?.data?.clientId] });
        qc.invalidateQueries({ queryKey: ["month"] });
      },
    }),
    updateItem: useMutation({ mutationFn: useServerFn(updateItem), onSuccess: invalidateAll }),
    setItemStatus: useMutation({
      mutationFn: useServerFn(setItemStatus),
      onMutate: async (vars: any) => {
        const { id, status } = vars?.data ?? vars ?? {};
        if (!id || !status) return;
        await qc.cancelQueries({ queryKey: ["month"] });
        const snapshots: Array<{ key: unknown[]; data: unknown }> = [];
        qc.getQueriesData<any>({ queryKey: ["month"] }).forEach(([key, data]) => {
          if (!data) return;
          snapshots.push({ key: key as unknown[], data });
          const categories = ["posts", "reels", "outros", "gravacoes", "roteiros", "sistemas"];
          const updated = { ...data };
          categories.forEach((cat) => {
            if (Array.isArray(data[cat])) {
              updated[cat] = data[cat].map((item: any) =>
                item.id === id ? { ...item, status } : item
              );
            }
          });
          qc.setQueryData(key as unknown[], updated);
        });
        return { snapshots };
      },
      onError: (e: any, _v: unknown, ctx: any) => {
        ctx?.snapshots?.forEach(({ key, data }: any) => qc.setQueryData(key, data));
        toast.error(e?.message ?? "Erro ao mudar status.");
      },
      onSuccess: invalidateAll,
    }),
    addAssignee: useMutation({ mutationFn: useServerFn(addAssignee), onSuccess: invalidateAll }),
    removeAssignee: useMutation({ mutationFn: useServerFn(removeAssignee), onSuccess: invalidateAll }),
    addComment: useMutation({ mutationFn: useServerFn(addComment), onSuccess: invalidateAll }),
    addContentItem: useMutation({ mutationFn: useServerFn(addContentItem), onSuccess: invalidateAll }),
    deleteItem: useMutation({ mutationFn: useServerFn(deleteItem), onSuccess: invalidateAll }),
    updateFeedOrder: useMutation({
      mutationFn: useServerFn(updateFeedOrder),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["month"] }),
    }),
    setFeedOrderMode: useMutation({
      mutationFn: useServerFn(setFeedOrderMode),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["month"] }),
    }),
    setFeedOrderDirection: useMutation({
      mutationFn: useServerFn(setFeedOrderDirection),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["month"] }),
    }),
    setItemCover: useMutation({
      mutationFn: useServerFn(setItemCover),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["month"] }),
    }),
    uploadItemCover: useMutation({
      mutationFn: useServerFn(uploadItemCover),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["month"] }),
    }),
    publishToInstagram: useMutation({
      mutationFn: useServerFn(publishToInstagram),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["month"] }),
    }),
    setInstagramAutoPublish: useMutation({
      mutationFn: useServerFn(setInstagramAutoPublish),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["month"] }),
    }),
    setUserRole: useMutation({ mutationFn: useServerFn(setUserRole), onSuccess: () => qc.invalidateQueries({ queryKey: ["profiles"] }) }),
    setUserActive: useMutation({ mutationFn: useServerFn(setUserActive), onSuccess: () => qc.invalidateQueries({ queryKey: ["profiles"] }) }),
    setExcludeFromRanking: useMutation({ mutationFn: useServerFn(setExcludeFromRanking), onSuccess: () => qc.invalidateQueries({ queryKey: ["profiles"] }) }),
    adminUpdateMemberAvatar: useMutation({ mutationFn: useServerFn(adminUpdateMemberAvatar), onSuccess: () => qc.invalidateQueries({ queryKey: ["profiles"] }) }),
    updateBugReportStatus: useMutation({ mutationFn: useServerFn(updateBugReportStatus), onSuccess: () => qc.invalidateQueries({ queryKey: ["bug-reports"] }) }),
    sendBugReportMessage: useMutation({ mutationFn: useServerFn(sendBugReportMessage) }),
    deleteUser: useMutation({ mutationFn: useServerFn(deleteUser), onSuccess: () => qc.invalidateQueries({ queryKey: ["profiles"] }) }),
    adminCreateUser: useMutation({ mutationFn: useServerFn(adminCreateUser), onSuccess: () => qc.invalidateQueries({ queryKey: ["profiles"] }) }),
    createAgency: useMutation({ mutationFn: useServerFn(createAgency) }),
    updateMyOrg: useMutation({ mutationFn: useServerFn(updateMyOrg), onSuccess: () => qc.invalidateQueries({ queryKey: ["me"] }) }),
    subscribeToPlan: useMutation({
      mutationFn: useServerFn(subscribeToPlan),
      onSuccess: () => { qc.invalidateQueries({ queryKey: ["org-plan-status"] }); qc.invalidateQueries({ queryKey: ["me"] }); },
    }),
    adminSendPasswordReset: useMutation({ mutationFn: useServerFn(adminSendPasswordReset) }),
    adminSetUserPassword: useMutation({ mutationFn: useServerFn(adminSetUserPassword) }),
    updateMyProfile: useMutation({ mutationFn: useServerFn(updateMyProfile), onSuccess: () => qc.invalidateQueries({ queryKey: ["me"] }) }),
    updateMyAccount: useMutation({ mutationFn: useServerFn(updateMyAccount), onSuccess: () => qc.invalidateQueries({ queryKey: ["me"] }) }),
    markNotificationRead: useMutation({ mutationFn: useServerFn(markNotificationRead), onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }) }),
    markMentionRead: useMutation({
      mutationFn: useServerFn(markMentionRead),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["my-mentions"] });
        qc.invalidateQueries({ queryKey: ["notifications"] });
      },
    }),
    upsertCleaningCell: useMutation({
      mutationFn: useServerFn(upsertCleaningCell),
      onSuccess: () => { qc.invalidateQueries({ queryKey: ["cleaning"] }); qc.invalidateQueries({ queryKey: ["my-today"] }); },
    }),
    setCleaningDone: useMutation({
      mutationFn: useServerFn(setCleaningDone),
      onSuccess: () => { qc.invalidateQueries({ queryKey: ["cleaning"] }); qc.invalidateQueries({ queryKey: ["my-today"] }); },
    }),
    addCleaningTask: useMutation({
      mutationFn: useServerFn(addCleaningTask),
      onSuccess: () => { qc.invalidateQueries({ queryKey: ["cleaning-tasks"] }); qc.invalidateQueries({ queryKey: ["cleaning"] }); },
    }),
    renameCleaningTask: useMutation({
      mutationFn: useServerFn(renameCleaningTask),
      onSuccess: () => { qc.invalidateQueries({ queryKey: ["cleaning-tasks"] }); qc.invalidateQueries({ queryKey: ["cleaning"] }); },
    }),
    deleteCleaningTask: useMutation({
      mutationFn: useServerFn(deleteCleaningTask),
      onSuccess: () => { qc.invalidateQueries({ queryKey: ["cleaning-tasks"] }); qc.invalidateQueries({ queryKey: ["cleaning"] }); },
    }),
    updateCleaningNote: useMutation({
      mutationFn: useServerFn(updateCleaningNote),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["cleaning"] }),
    }),
    upsertClientLink: useMutation({
      mutationFn: useServerFn(upsertClientLink),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["client-ficha"] }),
      onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar link."),
    }),
    deleteClientLink: useMutation({
      mutationFn: useServerFn(deleteClientLink),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["client-ficha"] }),
      onError: (e: any) => toast.error(e?.message ?? "Erro ao remover link."),
    }),
    upsertClientContact: useMutation({
      mutationFn: useServerFn(upsertClientContact),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["client-ficha"] }),
      onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar contato."),
    }),
    deleteClientContact: useMutation({
      mutationFn: useServerFn(deleteClientContact),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["client-ficha"] }),
      onError: (e: any) => toast.error(e?.message ?? "Erro ao remover contato."),
    }),
    upsertClientSecret: useMutation({
      mutationFn: useServerFn(upsertClientSecret),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["client-ficha"] }),
      onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar."),
    }),
    deleteClientSecret: useMutation({
      mutationFn: useServerFn(deleteClientSecret),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["client-ficha"] }),
      onError: (e: any) => toast.error(e?.message ?? "Erro ao remover."),
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
    setOnboardingDefaults: useMutation({
      mutationFn: useServerFn(setOnboardingDefaults),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["client-onboarding"] }),
    }),
    createPlatformUpdate: useMutation({
      mutationFn: useServerFn(createPlatformUpdate),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["platform-updates"] }),
    }),
    deletePlatformUpdate: useMutation({
      mutationFn: useServerFn(deletePlatformUpdate),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["platform-updates"] }),
    }),
    createSalesPageBlock: useMutation({
      mutationFn: useServerFn(createSalesPageBlock),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["sales-page-blocks"] });
        qc.invalidateQueries({ queryKey: ["sales-page-blocks-admin"] });
      },
    }),
    updateSalesPageBlock: useMutation({
      mutationFn: useServerFn(updateSalesPageBlock),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["sales-page-blocks"] });
        qc.invalidateQueries({ queryKey: ["sales-page-blocks-admin"] });
      },
    }),
    deleteSalesPageBlock: useMutation({
      mutationFn: useServerFn(deleteSalesPageBlock),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["sales-page-blocks"] });
        qc.invalidateQueries({ queryKey: ["sales-page-blocks-admin"] });
      },
    }),
    reorderSalesPageBlocks: useMutation({
      mutationFn: useServerFn(reorderSalesPageBlocks),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["sales-page-blocks"] });
        qc.invalidateQueries({ queryKey: ["sales-page-blocks-admin"] });
      },
    }),
    publishSalesPageBlocks: useMutation({
      mutationFn: useServerFn(publishSalesPageBlocks),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["sales-page-blocks"] });
        qc.invalidateQueries({ queryKey: ["sales-page-blocks-admin"] });
      },
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
    updateComment: useMutation({
      mutationFn: useServerFn(updateComment),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["month"] }),
    }),
    /* ===== DRIVE FILES ===== */
    attachDriveFile: useMutation({
      mutationFn: useServerFn(attachDriveFile),
      onSuccess: (_d, vars: any) => {
        qc.invalidateQueries({ queryKey: ["item-files", vars?.data?.itemId] });
        qc.invalidateQueries({ queryKey: ["month"] });
      },
    }),
    uploadDriveFile: useMutation({
      mutationFn: useServerFn(uploadDriveFile),
      onSuccess: (_d, vars: any) => {
        qc.invalidateQueries({ queryKey: ["item-files", vars?.data?.itemId] });
        qc.invalidateQueries({ queryKey: ["month"] });
      },
    }),
    syncUploadToDrive: useMutation({
      mutationFn: useServerFn(syncUploadToDrive),
      onSuccess: (_d, vars: any) => {
        qc.invalidateQueries({ queryKey: ["item-files", vars?.data?.itemId] });
        qc.invalidateQueries({ queryKey: ["month"] });
      },
    }),
    detachItemFile: useMutation({
      mutationFn: useServerFn(detachItemFile),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["item-files"] });
        qc.invalidateQueries({ queryKey: ["month"] });
      },
    }),
    reorderItemFiles: useMutation({
      mutationFn: useServerFn(reorderItemFiles),
      onSuccess: (_d, vars: any) => {
        qc.invalidateQueries({ queryKey: ["item-files", vars?.data?.itemId] });
        qc.invalidateQueries({ queryKey: ["month"] });
      },
    }),
    setClientDeliveriesFolder: useMutation({
      mutationFn: useServerFn(setClientDeliveriesFolder),
      onSuccess: (_d, vars: any) => {
        qc.invalidateQueries({ queryKey: ["client-deliveries-folder", vars?.data?.clientId] });
      },
    }),
    clearClientDeliveriesFolder: useMutation({
      mutationFn: useServerFn(clearClientDeliveriesFolder),
      onSuccess: (_d, vars: any) => {
        qc.invalidateQueries({ queryKey: ["client-deliveries-folder", vars?.data?.clientId] });
      },
    }),
    setMyNotificationPreferences: useMutation({
      mutationFn: useServerFn(setMyNotificationPreferences),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["notification-prefs"] }),
    }),
    createAutomationRule: useMutation({
      mutationFn: useServerFn(createAutomationRule),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["automation-rules"] }),
    }),
    deleteAutomationRule: useMutation({
      mutationFn: useServerFn(deleteAutomationRule),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["automation-rules"] }),
    }),
    runDailyDigestNow: useMutation({
      mutationFn: useServerFn(runDailyDigestNow),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["notifications"] });
        qc.invalidateQueries({ queryKey: ["cron-jobs"] });
      },
    }),
    runDeadlineRemindersNow: useMutation({
      mutationFn: useServerFn(runDeadlineRemindersNow),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["notifications"] });
        qc.invalidateQueries({ queryKey: ["cron-jobs"] });
      },
    }),
    /* ===== GOOGLE AGENDA ===== */
    /* ===== FEED SHARE ===== */
    getOrCreateShareToken: useMutation({ mutationFn: useServerFn(getOrCreateShareToken) }),
    rotateShareToken: useMutation({ mutationFn: useServerFn(rotateShareToken) }),
    addPublicFeedback: useMutation({
      mutationFn: useServerFn(addPublicFeedback),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["public-feed"] }),
    }),
  };
}