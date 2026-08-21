import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  addAssignee, addComment, addContentItem, createClient, deleteClient, deleteItem, deleteContentItems, duplicateMonth, setNotifyStoriesInTasks, setWhatsappGroupLink,
  getMe, getMonth, getProductivity, getMyActivityCounts, listClients, listMonthKeys, listMyTasks, listNotifications,
  listProfiles, markNotificationRead, removeAssignee, setItemStatus,
  setUserActive, setUserRole, setExcludeFromRanking, deleteUser, updateClient, updateItem, updateMyProfile, adminUpdateMemberAvatar,
  listMemberPay, setMemberPay,
  setItemEditor, setItemReelType, setItemPostFormat,
  getCleaning, upsertCleaningCell, setCleaningDone, updateCleaningNote, getMyToday,
  listCleaningTasks, addCleaningTask, renameCleaningTask, deleteCleaningTask,
  adminCreateUser, createAgency, updateMyOrg, updateMyDefaultLanding, updateSetorPermissions, getOrgPlanStatus, getPlans, subscribeToPlan, getSetupChecklist, adminSendPasswordReset, adminSetUserPassword, getAdminDashboard, getTopMembers, getTopMembersByGoal, getMemberFinalizations,
  listOrgsBilling, getOrgNextInvoice,
  updateMyAccount,
  getReport, getDeliveryTrend, getMemberReportDetail, getMemberVelocity, getFileUploadsReport,
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
  listGoals, setGoals, getGoalProgress, getGoalProgressForOrg,
  getClientOnboarding, updateClientOnboarding, setOnboardingDefaults,
  listRecurring, upsertRecurring, deleteRecurring, generateRecurring,
  listActivity, getReportExtras, getMemberStatusDuration,
  getAppSettings, updateAppSettings,
  getMyWeek, getWorkload, getItemTimeline, addCommentWithMentions, updateComment,
} from "./roadmap.functions";
import {
  listItemFiles, searchDriveFiles, attachDriveFile, uploadDriveFile, startDriveUploadSession, uploadDriveChunk, finalizeDriveUpload, detachItemFile, deleteItemFileAndDrive,
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
  getActiveFeedMonth, setActiveFeedMonth,
  getPublicFeed, getPublicDriveThumbnail, addPublicFeedback,
} from "./feed-share.functions";
import { listPlatformUpdates, createPlatformUpdate, deletePlatformUpdate } from "./platform-updates.functions";
import { publishToInstagram, setInstagramAutoPublish, getInstagramActivity, getTodayPublications } from "./instagram.functions";
import {
  getCalendarItems, getGoogleCalendarAuthUrl, disconnectGoogleCalendar,
  getMyCalendarConnection, getTodayCalendarEvents, createCalendarEvent,
} from "./calendar.functions";
import {
  getSalesPageBlocks, listSalesPageBlocksAdmin, createSalesPageBlock, updateSalesPageBlock,
  deleteSalesPageBlock, reorderSalesPageBlocks, publishSalesPageBlocks, discardSalesPageDraft,
} from "./sales-page.functions";
import {
  listJourneyStages, upsertJourneyStage, deleteJourneyStage,
  setClientStage, logClientStageUpdate, getClientStageHistory, getWeeklyClientReminders,
  getClientOperationsOverview,
} from "./journey-stages.functions";
import { getClientBlockedItems } from "./blocked-items.functions";
import { listCargos, upsertCargo, deleteCargo, setProfileCargos } from "./cargos.functions";
import { listLeads, upsertLead, moveLeadStatus, scheduleLeadFollowup, markLeadLost, deleteLead, markLeadWon } from "./sales-pipeline.functions";
import { listClientDocs, upsertClientDoc, deleteClientDoc, listRoteiroStatuses, upsertRoteiroStatus } from "./client-docs.functions";
import { listReferenceLibrary, upsertReferenceLibraryItem, deleteReferenceLibraryItem } from "./reference-library.functions";
import { listDemoRequests } from "./demo-request.functions";
import { getOrgCostSettings, setOrgCostSettings, getClientMargins, getClientMarginBreakdown } from "./margin.functions";
import {
  getForumCategories, getForumPosts, getForumPostDetail,
  createForumPost, createForumReply, moderateForumPost, moderateForumReply,
} from "./forum.functions";
export const meQO = () => queryOptions({ queryKey: ["me"], queryFn: () => getMe() });
export const instagramActivityQO = () =>
  queryOptions({ queryKey: ["instagram-activity"], queryFn: () => getInstagramActivity() });
export const todayPublicationsQO = (from: string, to: string, userId?: string) =>
  queryOptions({
    queryKey: ["today-publications", from, to, userId ?? null],
    queryFn: () => getTodayPublications({ data: { from, to, userId } }),
  });
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
export const memberPayQO = () => queryOptions({ queryKey: ["member-pay"], queryFn: () => listMemberPay() });
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

export const topMembersByGoalQO = (period: "month" | "3m" | "6m" | "year", monthKey: string) =>
  queryOptions({
    queryKey: ["top-members-goal", period, monthKey],
    queryFn: () => getTopMembersByGoal({ data: { period, monthKey } }),
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

export const deliveryTrendQO = () =>
  queryOptions({ queryKey: ["delivery-trend"], queryFn: () => getDeliveryTrend() });

export const fileUploadsReportQO = (days: 7 | 15 | 30, type: string) =>
  queryOptions({
    queryKey: ["file-uploads-report", days, type],
    queryFn: () => getFileUploadsReport({ data: { days, type } }),
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

export const journeyStagesQO = () =>
  queryOptions({ queryKey: ["journey-stages"], queryFn: () => listJourneyStages() });

export const cargosQO = () =>
  queryOptions({ queryKey: ["cargos"], queryFn: () => listCargos() });

export const leadsQO = (includeArchived?: boolean) =>
  queryOptions({
    queryKey: ["leads", includeArchived ?? false],
    queryFn: () => listLeads({ data: { includeArchived } }),
  });

export const clientOperationsOverviewQO = () =>
  queryOptions({ queryKey: ["client-operations-overview"], queryFn: () => getClientOperationsOverview() });

export const clientDocsQO = (clientId: string) =>
  queryOptions({
    queryKey: ["client-docs", clientId],
    queryFn: () => listClientDocs({ data: { clientId } }),
    enabled: !!clientId,
  });

export const referenceLibraryQO = (clientId?: string | null) =>
  queryOptions({
    queryKey: ["reference-library", clientId ?? "all"],
    queryFn: () => listReferenceLibrary({ data: { clientId } }),
  });

export const roteiroStatusesQO = (docId: string | null) =>
  queryOptions({
    queryKey: ["roteiro-statuses", docId],
    queryFn: () => listRoteiroStatuses({ data: { docId: docId! } }),
    enabled: !!docId,
  });

export const clientStageHistoryQO = (clientId: string | null) =>
  queryOptions({
    queryKey: ["client-stage-history", clientId],
    queryFn: () => getClientStageHistory({ data: { clientId: clientId! } }),
    enabled: !!clientId,
  });

export const weeklyClientRemindersQO = () =>
  queryOptions({ queryKey: ["weekly-client-reminders"], queryFn: () => getWeeklyClientReminders() });

export const clientBlockedItemsQO = (clientId: string | null) =>
  queryOptions({
    queryKey: ["client-blocked-items", clientId],
    queryFn: () => getClientBlockedItems({ data: { clientId: clientId! } }),
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

export const goalProgressForOrgQO = (monthKey: string) =>
  queryOptions({
    queryKey: ["goal-progress-org", monthKey],
    queryFn: () => getGoalProgressForOrg({ data: { monthKey } }),
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
export const demoRequestsQO = () =>
  queryOptions({ queryKey: ["demo-requests"], queryFn: () => listDemoRequests() });

export const orgCostSettingsQO = () =>
  queryOptions({ queryKey: ["org-cost-settings"], queryFn: () => getOrgCostSettings() });

export const clientMarginsQO = (days: 30 | 90 | 180) =>
  queryOptions({ queryKey: ["client-margins", days], queryFn: () => getClientMargins({ data: { days } }) });

export const clientMarginBreakdownQO = (clientId: string, days: 30 | 90 | 180) =>
  queryOptions({
    queryKey: ["client-margin-breakdown", clientId, days],
    queryFn: () => getClientMarginBreakdown({ data: { clientId, days } }),
  });

export const forumCategoriesQO = () =>
  queryOptions({ queryKey: ["forum-categories"], queryFn: () => getForumCategories() });

export const forumPostsQO = (categoryId: string | null) =>
  queryOptions({ queryKey: ["forum-posts", categoryId], queryFn: () => getForumPosts({ data: { categoryId } }) });

export const forumPostDetailQO = (postId: string | null) =>
  queryOptions({
    queryKey: ["forum-post-detail", postId],
    queryFn: () => getForumPostDetail({ data: { postId: postId! } }),
    enabled: !!postId,
  });

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

/** Qual mês o link fixo de preview desse cliente está mostrando agora. */
export const activeFeedMonthQO = (clientId: string | null) =>
  queryOptions({
    queryKey: ["active-feed-month", clientId],
    queryFn: () => getActiveFeedMonth({ data: { clientId: clientId! } }),
    enabled: !!clientId,
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

export const myCalendarConnectionQO = () =>
  queryOptions({
    queryKey: ["my-calendar-connection"],
    queryFn: () => getMyCalendarConnection(),
    staleTime: 60_000,
  });

export const todayCalendarEventsQO = (userId?: string) =>
  queryOptions({
    queryKey: ["today-calendar-events", userId ?? "self"],
    queryFn: () => getTodayCalendarEvents({ data: { userId } }),
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

const MONTH_ITEM_CATEGORIES = ["posts", "reels", "outros", "gravacoes", "roteiros", "sistemas"];

export function useApi() {
  const qc = useQueryClient();
  const me = useMe().data;
  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["month"] });
    qc.invalidateQueries({ queryKey: ["clients"] });
    qc.invalidateQueries({ queryKey: ["my-tasks"] });
    qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
    qc.invalidateQueries({ queryKey: ["top-members"] });
    qc.invalidateQueries({ queryKey: ["member-finalizations"] });
    qc.invalidateQueries({ queryKey: ["report"] });
  };
  // Compartilhado por toda ação rápida (atribuir, avaliar, marcar checklist)
  // que só muda um campo de um item já carregado — mesmo padrão que
  // setItemStatus já usava, generalizado. Atualiza a tela na hora e some
  // com a espera de rede; se der erro, onError devolve o snapshot de antes.
  async function optimisticPatchMonthItem(id: string, patch: (item: any) => any) {
    await qc.cancelQueries({ queryKey: ["month"] });
    const snapshots: Array<{ key: unknown[]; data: unknown }> = [];
    qc.getQueriesData<any>({ queryKey: ["month"] }).forEach(([key, data]) => {
      if (!data) return;
      snapshots.push({ key: key as unknown[], data });
      const updated = { ...data };
      MONTH_ITEM_CATEGORIES.forEach((cat) => {
        if (Array.isArray(data[cat])) {
          updated[cat] = data[cat].map((item: any) => (item.id === id ? patch(item) : item));
        }
      });
      qc.setQueryData(key as unknown[], updated);
    });
    return { snapshots };
  }
  function rollbackMonthSnapshots(ctx: any) {
    ctx?.snapshots?.forEach(({ key, data }: any) => qc.setQueryData(key, data));
  }
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
    setWhatsappGroupLink: useMutation({
      mutationFn: useServerFn(setWhatsappGroupLink),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["client-ficha"] }),
      onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar link do grupo."),
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
    setItemEditor: useMutation({
      mutationFn: useServerFn(setItemEditor),
      onMutate: async (vars: any) => {
        const { itemId, editorId } = vars?.data ?? {};
        if (!itemId) return;
        return optimisticPatchMonthItem(itemId, (item) => ({ ...item, editorId }));
      },
      onError: (e: any, _v: unknown, ctx: any) => { rollbackMonthSnapshots(ctx); toast.error(e?.message ?? "Erro ao definir o editor."); },
      onSuccess: invalidateAll,
    }),
    setItemReelType: useMutation({
      mutationFn: useServerFn(setItemReelType),
      onMutate: async (vars: any) => {
        const { itemId, reelType } = vars?.data ?? {};
        if (!itemId) return;
        return optimisticPatchMonthItem(itemId, (item) => ({ ...item, reelType }));
      },
      onError: (e: any, _v: unknown, ctx: any) => { rollbackMonthSnapshots(ctx); toast.error(e?.message ?? "Erro ao definir o formato."); },
      onSuccess: invalidateAll,
    }),
    setItemPostFormat: useMutation({
      mutationFn: useServerFn(setItemPostFormat),
      onMutate: async (vars: any) => {
        const { itemId, postFormat } = vars?.data ?? {};
        if (!itemId) return;
        return optimisticPatchMonthItem(itemId, (item) => ({ ...item, postFormat }));
      },
      onError: (e: any, _v: unknown, ctx: any) => { rollbackMonthSnapshots(ctx); toast.error(e?.message ?? "Erro ao definir o formato."); },
      onSuccess: invalidateAll,
    }),
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
    addAssignee: useMutation({
      mutationFn: useServerFn(addAssignee),
      onMutate: async (vars: any) => {
        const { itemId, userId } = vars?.data ?? {};
        if (!itemId || !userId) return;
        return optimisticPatchMonthItem(itemId, (item) =>
          (item.assigneeIds ?? []).includes(userId) ? item : { ...item, assigneeIds: [...(item.assigneeIds ?? []), userId] }
        );
      },
      onError: (e: any, _v: unknown, ctx: any) => { rollbackMonthSnapshots(ctx); toast.error(e?.message ?? "Erro ao atribuir responsável."); },
      onSuccess: invalidateAll,
    }),
    removeAssignee: useMutation({
      mutationFn: useServerFn(removeAssignee),
      onMutate: async (vars: any) => {
        const { itemId, userId } = vars?.data ?? {};
        if (!itemId || !userId) return;
        return optimisticPatchMonthItem(itemId, (item) =>
          ({ ...item, assigneeIds: (item.assigneeIds ?? []).filter((id: string) => id !== userId) })
        );
      },
      onError: (e: any, _v: unknown, ctx: any) => { rollbackMonthSnapshots(ctx); toast.error(e?.message ?? "Erro ao remover responsável."); },
      onSuccess: invalidateAll,
    }),
    addComment: useMutation({ mutationFn: useServerFn(addComment), onSuccess: invalidateAll }),
    addContentItem: useMutation({ mutationFn: useServerFn(addContentItem), onSuccess: invalidateAll }),
    deleteItem: useMutation({ mutationFn: useServerFn(deleteItem), onSuccess: invalidateAll }),
    deleteContentItems: useMutation({ mutationFn: useServerFn(deleteContentItems), onSuccess: invalidateAll }),
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
    setMemberPay: useMutation({
      mutationFn: useServerFn(setMemberPay),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["member-pay"] });
        qc.invalidateQueries({ queryKey: ["client-margins"] });
      },
    }),
    adminUpdateMemberAvatar: useMutation({ mutationFn: useServerFn(adminUpdateMemberAvatar), onSuccess: () => qc.invalidateQueries({ queryKey: ["profiles"] }) }),
    updateBugReportStatus: useMutation({ mutationFn: useServerFn(updateBugReportStatus), onSuccess: () => qc.invalidateQueries({ queryKey: ["bug-reports"] }) }),
    sendBugReportMessage: useMutation({ mutationFn: useServerFn(sendBugReportMessage) }),
    deleteUser: useMutation({ mutationFn: useServerFn(deleteUser), onSuccess: () => qc.invalidateQueries({ queryKey: ["profiles"] }) }),
    adminCreateUser: useMutation({ mutationFn: useServerFn(adminCreateUser), onSuccess: () => qc.invalidateQueries({ queryKey: ["profiles"] }) }),
    createAgency: useMutation({ mutationFn: useServerFn(createAgency) }),
    updateMyOrg: useMutation({ mutationFn: useServerFn(updateMyOrg), onSuccess: () => qc.invalidateQueries({ queryKey: ["me"] }) }),
    updateMyDefaultLanding: useMutation({ mutationFn: useServerFn(updateMyDefaultLanding), onSuccess: () => qc.invalidateQueries({ queryKey: ["me"] }) }),
    updateSetorPermissions: useMutation({ mutationFn: useServerFn(updateSetorPermissions), onSuccess: () => qc.invalidateQueries({ queryKey: ["me"] }) }),
    subscribeToPlan: useMutation({
      mutationFn: useServerFn(subscribeToPlan),
      onSuccess: () => { qc.invalidateQueries({ queryKey: ["org-plan-status"] }); qc.invalidateQueries({ queryKey: ["me"] }); },
    }),
    adminSendPasswordReset: useMutation({ mutationFn: useServerFn(adminSendPasswordReset) }),
    adminSetUserPassword: useMutation({ mutationFn: useServerFn(adminSetUserPassword) }),
    updateMyProfile: useMutation({ mutationFn: useServerFn(updateMyProfile), onSuccess: () => qc.invalidateQueries({ queryKey: ["me"] }) }),
    updateMyAccount: useMutation({ mutationFn: useServerFn(updateMyAccount), onSuccess: () => qc.invalidateQueries({ queryKey: ["me"] }) }),
    markNotificationRead: useMutation({
      mutationFn: useServerFn(markNotificationRead),
      onMutate: async (vars: any) => {
        const { id, all } = vars?.data ?? {};
        await qc.cancelQueries({ queryKey: ["notifications"] });
        const previous = qc.getQueryData<any[]>(["notifications"]);
        if (previous) {
          qc.setQueryData(["notifications"], previous.map((n) => (all || n.id === id ? { ...n, read: true } : n)));
        }
        return { previous };
      },
      onError: (_e: any, _v: unknown, ctx: any) => { if (ctx?.previous) qc.setQueryData(["notifications"], ctx.previous); },
      onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
    }),
    markMentionRead: useMutation({
      mutationFn: useServerFn(markMentionRead),
      onMutate: async (vars: any) => {
        const { mentionId, itemId, all } = vars?.data ?? {};
        await qc.cancelQueries({ queryKey: ["my-mentions"] });
        const previous = qc.getQueryData<any[]>(["my-mentions"]);
        if (previous) {
          qc.setQueryData(["my-mentions"], previous.filter((m) =>
            !(all || m.mentionId === mentionId || m.itemId === itemId)
          ));
        }
        return { previous };
      },
      onError: (_e: any, _v: unknown, ctx: any) => { if (ctx?.previous) qc.setQueryData(["my-mentions"], ctx.previous); },
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
      onMutate: async (vars: any) => {
        const { taskId, weekday, occurrenceDate, done } = vars?.data ?? {};
        if (!taskId) return;
        await qc.cancelQueries({ queryKey: ["cleaning"] });
        const previous = qc.getQueryData<any>(["cleaning"]);
        if (previous) {
          const others = (previous.weekLog ?? []).filter((r: any) =>
            !(r.taskId === taskId && r.weekday === weekday && r.occurrenceDate === occurrenceDate)
          );
          const weekLog = done
            ? [...others, { taskId, weekday, occurrenceDate, status: "done", doneAt: new Date().toISOString(), doneBy: null }]
            : others;
          qc.setQueryData(["cleaning"], { ...previous, weekLog });
        }
        return { previous };
      },
      onError: (e: any, _v: unknown, ctx: any) => {
        if (ctx?.previous) qc.setQueryData(["cleaning"], ctx.previous);
        toast.error(e?.message ?? "Erro ao marcar tarefa.");
      },
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
    upsertJourneyStage: useMutation({
      mutationFn: useServerFn(upsertJourneyStage),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["journey-stages"] });
        qc.invalidateQueries({ queryKey: ["client-operations-overview"] });
      },
      onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar etapa."),
    }),
    deleteJourneyStage: useMutation({
      mutationFn: useServerFn(deleteJourneyStage),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["journey-stages"] }),
      onError: (e: any) => toast.error(e?.message ?? "Erro ao remover etapa."),
    }),
    upsertCargo: useMutation({
      mutationFn: useServerFn(upsertCargo),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["cargos"] }),
      onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar cargo."),
    }),
    deleteCargo: useMutation({
      mutationFn: useServerFn(deleteCargo),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["cargos"] }),
      onError: (e: any) => toast.error(e?.message ?? "Erro ao remover cargo."),
    }),
    setProfileCargos: useMutation({
      mutationFn: useServerFn(setProfileCargos),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["profiles"] });
        qc.invalidateQueries({ queryKey: ["me"] });
      },
      onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar cargos."),
    }),
    upsertLead: useMutation({
      mutationFn: useServerFn(upsertLead),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
      onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar oportunidade."),
    }),
    moveLeadStatus: useMutation({
      mutationFn: useServerFn(moveLeadStatus),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
      onError: (e: any) => toast.error(e?.message ?? "Erro ao mover oportunidade."),
    }),
    scheduleLeadFollowup: useMutation({
      mutationFn: useServerFn(scheduleLeadFollowup),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
      onError: (e: any) => toast.error(e?.message ?? "Erro ao agendar follow-up."),
    }),
    markLeadLost: useMutation({
      mutationFn: useServerFn(markLeadLost),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
      onError: (e: any) => toast.error(e?.message ?? "Erro ao marcar como perdido."),
    }),
    markLeadWon: useMutation({
      mutationFn: useServerFn(markLeadWon),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["leads"] });
        qc.invalidateQueries({ queryKey: ["clients"] });
        qc.invalidateQueries({ queryKey: ["client-operations-overview"] });
      },
      onError: (e: any) => toast.error(e?.message ?? "Erro ao marcar como ganho."),
    }),
    deleteLead: useMutation({
      mutationFn: useServerFn(deleteLead),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
      onError: (e: any) => toast.error(e?.message ?? "Erro ao remover oportunidade."),
    }),
    upsertClientDoc: useMutation({
      mutationFn: useServerFn(upsertClientDoc),
      onSuccess: (_r, vars: any) => qc.invalidateQueries({ queryKey: ["client-docs", vars.data.clientId] }),
      onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar documento."),
    }),
    deleteClientDoc: useMutation({
      mutationFn: useServerFn(deleteClientDoc),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["client-docs"] }),
      onError: (e: any) => toast.error(e?.message ?? "Erro ao remover documento."),
    }),
    upsertReferenceLibraryItem: useMutation({
      mutationFn: useServerFn(upsertReferenceLibraryItem),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["reference-library"] }),
      onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar referência."),
    }),
    deleteReferenceLibraryItem: useMutation({
      mutationFn: useServerFn(deleteReferenceLibraryItem),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["reference-library"] }),
      onError: (e: any) => toast.error(e?.message ?? "Erro ao remover referência."),
    }),
    upsertRoteiroStatus: useMutation({
      mutationFn: useServerFn(upsertRoteiroStatus),
      onSuccess: (_r, vars: any) => qc.invalidateQueries({ queryKey: ["roteiro-statuses", vars.data.docId] }),
      onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar status do roteiro."),
    }),
    setClientStage: useMutation({
      mutationFn: useServerFn(setClientStage),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["client-ficha"] });
        qc.invalidateQueries({ queryKey: ["clients"] });
        qc.invalidateQueries({ queryKey: ["client-operations-overview"] });
      },
      onError: (e: any) => toast.error(e?.message ?? "Erro ao mudar etapa."),
    }),
    logClientStageUpdate: useMutation({
      mutationFn: useServerFn(logClientStageUpdate),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["client-stage-history"] });
        qc.invalidateQueries({ queryKey: ["weekly-client-reminders"] });
      },
      onError: (e: any) => toast.error(e?.message ?? "Erro ao registrar envio."),
    }),
    /* ===== ROADMAP MUTATIONS ===== */
    updateChecklist: useMutation({
      mutationFn: useServerFn(updateChecklist),
      onMutate: async (vars: any) => {
        const { itemId, checklist } = vars?.data ?? {};
        if (!itemId) return;
        return optimisticPatchMonthItem(itemId, (item) => ({ ...item, checklist }));
      },
      onError: (e: any, _v: unknown, ctx: any) => { rollbackMonthSnapshots(ctx); toast.error(e?.message ?? "Erro ao salvar checklist."); },
      onSuccess: invalidateAll,
    }),
    rateItem: useMutation({
      mutationFn: useServerFn(rateItem),
      onMutate: async (vars: any) => {
        const { itemId, rating } = vars?.data ?? {};
        if (!itemId) return;
        return optimisticPatchMonthItem(itemId, (item) => ({ ...item, qualityRating: rating }));
      },
      onError: (e: any, _v: unknown, ctx: any) => { rollbackMonthSnapshots(ctx); toast.error(e?.message ?? "Erro ao avaliar."); },
      onSuccess: invalidateAll,
    }),
    setGoals: useMutation({
      mutationFn: useServerFn(setGoals),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["goals"] });
        qc.invalidateQueries({ queryKey: ["goal-progress"] });
        qc.invalidateQueries({ queryKey: ["goal-progress-org"] });
        qc.invalidateQueries({ queryKey: ["top-members-goal"] });
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
    discardSalesPageDraft: useMutation({
      mutationFn: useServerFn(discardSalesPageDraft),
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
      onMutate: async (vars: any) => {
        const { itemId, text } = vars?.data ?? {};
        if (!itemId || !text || !me) return;
        const tempComment = {
          id: `temp-${crypto.randomUUID()}`,
          authorId: me.id, text, createdAt: new Date().toISOString(),
          editedAt: null, system: false,
        };
        return optimisticPatchMonthItem(itemId, (item) => ({ ...item, comments: [...(item.comments ?? []), tempComment] }));
      },
      onError: (e: any, _v: unknown, ctx: any) => { rollbackMonthSnapshots(ctx); toast.error(e?.message ?? "Erro ao comentar."); },
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
    startDriveUploadSession: useMutation({ mutationFn: useServerFn(startDriveUploadSession) }),
    uploadDriveChunk: useMutation({ mutationFn: useServerFn(uploadDriveChunk) }),
    finalizeDriveUpload: useMutation({
      mutationFn: useServerFn(finalizeDriveUpload),
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
    deleteItemFileAndDrive: useMutation({
      mutationFn: useServerFn(deleteItemFileAndDrive),
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
    getGoogleCalendarAuthUrl: useMutation({ mutationFn: useServerFn(getGoogleCalendarAuthUrl) }),
    disconnectGoogleCalendar: useMutation({
      mutationFn: useServerFn(disconnectGoogleCalendar),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["my-calendar-connection"] });
        qc.invalidateQueries({ queryKey: ["today-calendar-events"] });
      },
    }),
    createCalendarEvent: useMutation({
      mutationFn: useServerFn(createCalendarEvent),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["today-calendar-events"] }),
    }),
    /* ===== MARGEM / LUCRATIVIDADE ===== */
    setOrgCostSettings: useMutation({
      mutationFn: useServerFn(setOrgCostSettings),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["org-cost-settings"] });
        qc.invalidateQueries({ queryKey: ["client-margins"] });
      },
    }),
    /* ===== FEED SHARE ===== */
    getOrCreateShareToken: useMutation({ mutationFn: useServerFn(getOrCreateShareToken) }),
    rotateShareToken: useMutation({ mutationFn: useServerFn(rotateShareToken) }),
    setActiveFeedMonth: useMutation({
      mutationFn: useServerFn(setActiveFeedMonth),
      onSuccess: (_d, vars: any) => qc.invalidateQueries({ queryKey: ["active-feed-month", vars?.data?.clientId] }),
    }),
    addPublicFeedback: useMutation({
      mutationFn: useServerFn(addPublicFeedback),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["public-feed"] }),
    }),
    /* ===== FÓRUM ===== */
    createForumPost: useMutation({
      mutationFn: useServerFn(createForumPost),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["forum-posts"] }),
    }),
    createForumReply: useMutation({
      mutationFn: useServerFn(createForumReply),
      onSuccess: (_d, vars: any) => {
        qc.invalidateQueries({ queryKey: ["forum-post-detail", vars?.data?.postId] });
        qc.invalidateQueries({ queryKey: ["forum-posts"] });
      },
    }),
    moderateForumPost: useMutation({
      mutationFn: useServerFn(moderateForumPost),
      onSuccess: (_d, vars: any) => {
        qc.invalidateQueries({ queryKey: ["forum-posts"] });
        qc.invalidateQueries({ queryKey: ["forum-post-detail", vars?.data?.postId] });
      },
    }),
    moderateForumReply: useMutation({
      mutationFn: useServerFn(moderateForumReply),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["forum-post-detail"] }),
    }),
  };
}