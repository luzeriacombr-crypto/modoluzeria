import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { reportHandledError } from "./error-monitoring";
import {
  addAssignee, addContentItem, createClient, deleteClient, deleteItem, deleteContentItems, duplicateMonth, setNotifyStoriesInTasks, setWhatsappGroupLink,
  getMe, getMonth, getProductivity, getMyActivityCounts, listClients, listMonthKeys, listMyTasks, listNotifications,
  listProfiles, markNotificationRead, removeAssignee, setItemStatus,
  setUserActive, setUserRole, setExcludeFromRanking, setHideGoalsWidget, deleteUser, updateClient, updateItem, updateMyProfile, adminUpdateMemberAvatar,
  listMemberPay, setMemberPay,
  setItemEditor, setItemReelType, setItemPostFormat,
  getCleaning, upsertCleaningCell, setCleaningDone, updateCleaningNote, getMyToday,
  addCleaningTask, renameCleaningTask, deleteCleaningTask,
  adminCreateUser, createAgency, updateMyOrg, updateMyDefaultLanding, updateSetorPermissions, getOrgPlanStatus, getPlans, subscribeToPlan, getSetupChecklist, adminSendPasswordReset, adminSetUserPassword, getAdminDashboard, getTopMembers, getTopMembersByGoal, getMemberFinalizations,
  listOrgsBilling, getOrgNextInvoice,
  updateMyAccount,
  getReport, getDeliveryTrend, getMemberReportDetail, getMemberVelocity, getFileUploadsReport,
  updateFeedOrder,
  setFeedOrderMode,
  setFeedOrderDirection,
  reorderContentItems,
  moveItemToMonth,
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
  getReportExtras,   getAppSettings, updateAppSettings,
  getMyWeek, getItemTimeline, addCommentWithMentions, addAudioComment, updateComment,
} from "./roadmap.functions";
import {
  listItemFiles, attachDriveFile, startDriveUploadSession, uploadDriveChunk, finalizeDriveUpload, detachItemFile, deleteItemFileAndDrive,
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
import {
  listPhotoClients, getPhotoClient, createPhotoClient, deletePhotoClient,
  createPhotoSelection, listPhotoSelections, getPhotoSelectionDetail, deletePhotoSelection, setPhotoSelectionStatus,
  getPublicPhotoSelection, getPublicPhotoThumbnails,
} from "./photo-selection.functions";
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
  setClientStage, logClientStageUpdate, getWeeklyClientReminders,
  getClientOperationsOverview,
} from "./journey-stages.functions";
import { getClientBlockedItems } from "./blocked-items.functions";
import { listCargos, upsertCargo, deleteCargo, setProfileCargos } from "./cargos.functions";
import { setProfileClientAccess } from "./client-access.functions";
import { listClientPayments, setOrgPixKey, setPaymentMessageTemplate, markClientPaymentReceived, unmarkClientPaymentReceived, listClientPaymentHistory } from "./client-payments.functions";
import { listCampaigns, upsertCampaign, deleteCampaign, listCampaignItems, setItemCampaign } from "./campaigns.functions";
import { listLeads, upsertLead, moveLeadStatus, scheduleLeadFollowup, markLeadLost, deleteLead, markLeadWon, linkLeadToClient, markLeadWonNoClient, logLeadContact, listLeadContacts } from "./sales-pipeline.functions";
import { listTrash, restoreItem, purgeItem } from "./trash.functions";
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

export const trashQO = () => queryOptions({ queryKey: ["trash"], queryFn: () => listTrash() });

export const leadContactsQO = (leadId: string | null) =>
  queryOptions({
    queryKey: ["lead-contacts", leadId],
    queryFn: () => listLeadContacts({ data: { leadId: leadId! } }),
    enabled: !!leadId,
  });

export const clientOperationsOverviewQO = () =>
  queryOptions({ queryKey: ["client-operations-overview"], queryFn: () => getClientOperationsOverview() });

export const clientPaymentsQO = () =>
  queryOptions({ queryKey: ["client-payments"], queryFn: () => listClientPayments() });

export const clientPaymentHistoryQO = (clientId: string | null) =>
  queryOptions({
    queryKey: ["client-payment-history", clientId],
    queryFn: () => listClientPaymentHistory({ data: { clientId: clientId! } }),
    enabled: !!clientId,
  });

export const campaignsQO = (clientId: string) =>
  queryOptions({ queryKey: ["campaigns", clientId], queryFn: () => listCampaigns({ data: { clientId } }) });

export const campaignItemsQO = (campaignId: string | null) =>
  queryOptions({
    queryKey: ["campaign-items", campaignId],
    queryFn: () => listCampaignItems({ data: { campaignId: campaignId! } }),
    enabled: !!campaignId,
  });

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

export const photoClientsQO = () =>
  queryOptions({ queryKey: ["photo-clients"], queryFn: () => listPhotoClients() });

export const photoClientQO = (id: string | null) =>
  queryOptions({
    queryKey: ["photo-client", id],
    queryFn: () => getPhotoClient({ data: { id: id! } }),
    enabled: !!id,
  });

export const photoSelectionsQO = (photoClientId: string | null) =>
  queryOptions({
    queryKey: ["photo-selections", photoClientId],
    queryFn: () => listPhotoSelections({ data: { photoClientId: photoClientId! } }),
    enabled: !!photoClientId,
  });

export const photoSelectionDetailQO = (id: string | null) =>
  queryOptions({
    queryKey: ["photo-selection-detail", id],
    queryFn: () => getPhotoSelectionDetail({ data: { id: id! } }),
    enabled: !!id,
  });

export const publicPhotoSelectionQO = (token: string | null) =>
  queryOptions({
    queryKey: ["public-photo-selection", token],
    queryFn: () => getPublicPhotoSelection({ data: { token: token! } }),
    enabled: !!token,
    staleTime: 15_000,
  });

/** Em lote (ver o comentário em getPublicPhotoThumbnails) — cada chamada
 * gasta 1 token do Drive pra várias fotos de uma vez, não 1 por foto. */
export const publicPhotoThumbsBatchQO = (token: string, fileIds: string[]) =>
  queryOptions({
    queryKey: ["public-photo-thumbs-batch", token, fileIds.join(",")],
    queryFn: () => getPublicPhotoThumbnails({ data: { token, fileIds } }),
    enabled: !!token && fileIds.length > 0,
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
    retry: false,
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
  // Aviso padrão pra mutation que não trata o próprio erro. Antes, falhar
  // aqui era 100% silencioso — a pessoa clicava, nada acontecia, e não
  // havia como saber se tinha salvo. Só usar em mutation SEM onError no
  // ponto de chamada, senão o aviso aparece duas vezes.
  const fail = (msg: string) => (e: any) => {
    toast.error(e?.message ?? msg);
    reportHandledError(e, { origem: "mutation", aviso: msg });
  };
  // Ação rápida que muda UM campo de um item (editor, formato, checklist,
  // atribuição, nota): o patch otimista logo abaixo já deixou a tela certa,
  // então recarregar as 7 chaves do invalidateAll era desperdício puro —
  // marcar 5 itens de checklist disparava ~35 refetches, incluindo getMonth,
  // que é a query mais cara do app.
  const invalidateItemOnly = () => { qc.invalidateQueries({ queryKey: ["month"] }); };
  const invalidateItemAndTasks = () => {
    qc.invalidateQueries({ queryKey: ["month"] });
    qc.invalidateQueries({ queryKey: ["my-tasks"] });
  };
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
      qc.invalidateQueries({ queryKey: ["client-payments"] });
    }, onError: fail("Não consegui salvar o cliente.") }),
    setNotifyStoriesInTasks: useMutation({
      mutationFn: useServerFn(setNotifyStoriesInTasks),
      onSuccess: () => { qc.invalidateQueries({ queryKey: ["clients"] }); qc.invalidateQueries({ queryKey: ["my-tasks"] }); },
    }),
    setWhatsappGroupLink: useMutation({
      mutationFn: useServerFn(setWhatsappGroupLink),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["client-ficha"] }),
      onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar link do grupo."),
    }),
    deleteClient: useMutation({ mutationFn: useServerFn(deleteClient), onSuccess: () => qc.invalidateQueries({ queryKey: ["clients"] }), onError: fail("Não consegui excluir o cliente.") }),
    duplicateMonth: useMutation({
      mutationFn: useServerFn(duplicateMonth),
      onSuccess: (_d, vars: any) => {
        qc.invalidateQueries({ queryKey: ["monthKeys", vars?.data?.clientId] });
        qc.invalidateQueries({ queryKey: ["month"] });
      },
      onError: fail("Não consegui duplicar o mês."),
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
      onSuccess: invalidateItemOnly,
    }),
    setItemReelType: useMutation({
      mutationFn: useServerFn(setItemReelType),
      onMutate: async (vars: any) => {
        const { itemId, reelType } = vars?.data ?? {};
        if (!itemId) return;
        return optimisticPatchMonthItem(itemId, (item) => ({ ...item, reelType }));
      },
      onError: (e: any, _v: unknown, ctx: any) => { rollbackMonthSnapshots(ctx); toast.error(e?.message ?? "Erro ao definir o formato."); },
      onSuccess: invalidateItemOnly,
    }),
    setItemPostFormat: useMutation({
      mutationFn: useServerFn(setItemPostFormat),
      onMutate: async (vars: any) => {
        const { itemId, postFormat } = vars?.data ?? {};
        if (!itemId) return;
        return optimisticPatchMonthItem(itemId, (item) => ({ ...item, postFormat }));
      },
      onError: (e: any, _v: unknown, ctx: any) => { rollbackMonthSnapshots(ctx); toast.error(e?.message ?? "Erro ao definir o formato."); },
      onSuccess: invalidateItemOnly,
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
      onSuccess: invalidateItemAndTasks,
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
      onSuccess: invalidateItemAndTasks,
    }),
    addContentItem: useMutation({ mutationFn: useServerFn(addContentItem), onSuccess: invalidateAll, onError: fail("Não consegui criar o item.") }),
    deleteItem: useMutation({ mutationFn: useServerFn(deleteItem), onSuccess: invalidateAll, onError: fail("Não consegui excluir o item.") }),
    deleteContentItems: useMutation({ mutationFn: useServerFn(deleteContentItems), onSuccess: invalidateAll, onError: fail("Não consegui excluir os itens.") }),
    restoreItem: useMutation({
      mutationFn: useServerFn(restoreItem),
      onSuccess: () => { invalidateAll(); qc.invalidateQueries({ queryKey: ["trash"] }); },
      onError: (e: any) => toast.error(e?.message ?? "Erro ao restaurar."),
    }),
    purgeItem: useMutation({
      mutationFn: useServerFn(purgeItem),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["trash"] }),
      onError: (e: any) => toast.error(e?.message ?? "Erro ao excluir para sempre."),
    }),
    updateFeedOrder: useMutation({
      mutationFn: useServerFn(updateFeedOrder),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["month"] }),
    }),
    reorderContentItems: useMutation({
      mutationFn: useServerFn(reorderContentItems),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["month"] }),
    }),
    moveItemToMonth: useMutation({
      mutationFn: useServerFn(moveItemToMonth),
      onSuccess: () => { invalidateAll(); qc.invalidateQueries({ queryKey: ["monthKeys"] }); },
      onError: (e: any) => toast.error(e?.message ?? "Erro ao mover item."),
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
    setUserRole: useMutation({ mutationFn: useServerFn(setUserRole), onSuccess: () => qc.invalidateQueries({ queryKey: ["profiles"] }), onError: fail("Não consegui mudar a função.") }),
    setUserActive: useMutation({ mutationFn: useServerFn(setUserActive), onSuccess: () => qc.invalidateQueries({ queryKey: ["profiles"] }), onError: fail("Não consegui mudar o status do membro.") }),
    setExcludeFromRanking: useMutation({ mutationFn: useServerFn(setExcludeFromRanking), onSuccess: () => qc.invalidateQueries({ queryKey: ["profiles"] }) }),
    setHideGoalsWidget: useMutation({ mutationFn: useServerFn(setHideGoalsWidget), onSuccess: () => qc.invalidateQueries({ queryKey: ["profiles"] }) }),
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
      onError: fail("Não consegui salvar a escala."),
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
      onError: fail("Não consegui adicionar a tarefa."),
    }),
    renameCleaningTask: useMutation({
      mutationFn: useServerFn(renameCleaningTask),
      onSuccess: () => { qc.invalidateQueries({ queryKey: ["cleaning-tasks"] }); qc.invalidateQueries({ queryKey: ["cleaning"] }); },
      onError: fail("Não consegui renomear a tarefa."),
    }),
    deleteCleaningTask: useMutation({
      mutationFn: useServerFn(deleteCleaningTask),
      onSuccess: () => { qc.invalidateQueries({ queryKey: ["cleaning-tasks"] }); qc.invalidateQueries({ queryKey: ["cleaning"] }); },
      onError: fail("Não consegui excluir a tarefa."),
    }),
    updateCleaningNote: useMutation({
      mutationFn: useServerFn(updateCleaningNote),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["cleaning"] }),
      onError: fail("Não consegui salvar a observação."),
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
    setProfileClientAccess: useMutation({
      mutationFn: useServerFn(setProfileClientAccess),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["profiles"] });
        qc.invalidateQueries({ queryKey: ["clients"] });
      },
      onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar acesso a clientes."),
    }),
    setOrgPixKey: useMutation({
      mutationFn: useServerFn(setOrgPixKey),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["me"] });
        qc.invalidateQueries({ queryKey: ["client-payments"] });
      },
      onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar chave Pix."),
    }),
    setPaymentMessageTemplate: useMutation({
      mutationFn: useServerFn(setPaymentMessageTemplate),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["client-payments"] }),
      onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar mensagem."),
    }),
    markClientPaymentReceived: useMutation({
      mutationFn: useServerFn(markClientPaymentReceived),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["client-payments"] }),
      onError: (e: any) => toast.error(e?.message ?? "Erro ao marcar pagamento."),
    }),
    unmarkClientPaymentReceived: useMutation({
      mutationFn: useServerFn(unmarkClientPaymentReceived),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["client-payments"] }),
      onError: (e: any) => toast.error(e?.message ?? "Erro ao desfazer marcação."),
    }),
    upsertCampaign: useMutation({
      mutationFn: useServerFn(upsertCampaign),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["campaigns"] }),
      onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar campanha."),
    }),
    deleteCampaign: useMutation({
      mutationFn: useServerFn(deleteCampaign),
      onSuccess: () => { qc.invalidateQueries({ queryKey: ["campaigns"] }); invalidateAll(); },
      onError: (e: any) => toast.error(e?.message ?? "Erro ao remover campanha."),
    }),
    setItemCampaign: useMutation({
      mutationFn: useServerFn(setItemCampaign),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["campaigns"] });
        qc.invalidateQueries({ queryKey: ["campaign-items"] });
        invalidateAll();
      },
      onError: (e: any) => toast.error(e?.message ?? "Erro ao atualizar campanha do item."),
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
    logLeadContact: useMutation({
      mutationFn: useServerFn(logLeadContact),
      onSuccess: (_data, vars: any) => {
        qc.invalidateQueries({ queryKey: ["leads"] });
        qc.invalidateQueries({ queryKey: ["lead-contacts", vars.data.leadId] });
      },
      onError: (e: any) => toast.error(e?.message ?? "Erro ao registrar contato."),
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
    linkLeadToClient: useMutation({
      mutationFn: useServerFn(linkLeadToClient),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
      onError: (e: any) => toast.error(e?.message ?? "Erro ao vincular ao cliente."),
    }),
    markLeadWonNoClient: useMutation({
      mutationFn: useServerFn(markLeadWonNoClient),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
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
      onSuccess: invalidateItemOnly,
    }),
    rateItem: useMutation({
      mutationFn: useServerFn(rateItem),
      onMutate: async (vars: any) => {
        const { itemId, rating } = vars?.data ?? {};
        if (!itemId) return;
        return optimisticPatchMonthItem(itemId, (item) => ({ ...item, qualityRating: rating }));
      },
      onError: (e: any, _v: unknown, ctx: any) => { rollbackMonthSnapshots(ctx); toast.error(e?.message ?? "Erro ao avaliar."); },
      onSuccess: () => { qc.invalidateQueries({ queryKey: ["month"] }); qc.invalidateQueries({ queryKey: ["report"] }); },
    }),
    setGoals: useMutation({
      // Erro tratado nos dois pontos de chamada (salvar individual e
      // "Salvar tudo" em MemberGoalsTab) — não duplicar aqui.
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
      onError: fail("Não consegui salvar a recorrência."),
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
    addAudioComment: useMutation({
      mutationFn: useServerFn(addAudioComment),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["month"] });
        qc.invalidateQueries({ queryKey: ["notifications"] });
      },
      onError: (e: any) => toast.error(e?.message ?? "Erro ao enviar áudio."),
    }),
    /* ===== DRIVE FILES ===== */
    attachDriveFile: useMutation({
      mutationFn: useServerFn(attachDriveFile),
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
      onError: fail("Não consegui desvincular o arquivo."),
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
    /* ===== SELEÇÃO DE FOTOS ===== */
    createPhotoClient: useMutation({
      mutationFn: useServerFn(createPhotoClient),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["photo-clients"] }),
    }),
    deletePhotoClient: useMutation({
      mutationFn: useServerFn(deletePhotoClient),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["photo-clients"] }),
    }),
    createPhotoSelection: useMutation({
      mutationFn: useServerFn(createPhotoSelection),
      onSuccess: (_d, vars: any) => qc.invalidateQueries({ queryKey: ["photo-selections", vars?.data?.photoClientId] }),
    }),
    deletePhotoSelection: useMutation({
      mutationFn: useServerFn(deletePhotoSelection),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["photo-selections"] }),
    }),
    setPhotoSelectionStatus: useMutation({
      mutationFn: useServerFn(setPhotoSelectionStatus),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["photo-selections"] });
        qc.invalidateQueries({ queryKey: ["photo-selection-detail"] });
      },
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