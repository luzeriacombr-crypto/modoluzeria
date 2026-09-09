import {
  FileText, PenLine, Search, MessageSquare, CalendarCheck, CalendarClock, CheckCircle,
  Paintbrush, Eye, Video, Scissors, Clock, Archive, Circle,
  Film, Image as ImageIcon, Grid3x3, Link as LinkIcon, Ban,
} from "lucide-react";
import type { BuiltinStatus, Status } from "@/lib/luzeria/types";

type IconProps = { className?: string; size?: number; style?: React.CSSProperties; color?: string };
export const STATUS_ICONS: Record<BuiltinStatus, React.ComponentType<IconProps>> = {
  PLANEJAMENTO: FileText,
  COPY: PenLine,
  REVISAO_INTERNA: Search,
  REVISAO_CLIENTE: MessageSquare,
  AGENDAMENTO: CalendarCheck,
  REVISAO_AGENDAMENTO: CalendarClock,
  PRONTO_PARA_PUBLICAR: CheckCircle,
  FINALIZADO: Archive,
  TRAVADO: Ban,
  CRIACAO: Paintbrush,
  REVISAO_ARTE: Eye,
  EM_GRAVACAO: Video,
  EM_EDICAO: Scissors,
  PENDENTE: Clock,
  CONCLUIDO: CheckCircle,
};

/** Safe replacement for bare `STATUS_ICONS[status]` indexing — falls back
 * to a generic circle for org-added custom statuses (not in the map). */
export function getStatusIcon(status: Status): React.ComponentType<IconProps> {
  return STATUS_ICONS[status as BuiltinStatus] ?? Circle;
}

export function detectDriveType(url: string): {
  Icon: React.ComponentType<IconProps>;
  label: string;
} {
  if (!url) return { Icon: LinkIcon, label: "Arquivo" };
  if (/folders\//i.test(url)) return { Icon: Grid3x3, label: "Pasta / Carrossel" };
  if (/\.(mp4|mov|webm)/i.test(url) || /video/i.test(url)) return { Icon: Film, label: "Vídeo" };
  return { Icon: ImageIcon, label: "Imagem" };
}