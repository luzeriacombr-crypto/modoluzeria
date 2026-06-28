import {
  Play, Paintbrush, Eye, MessageSquare, CheckCircle,
  Film, Image as ImageIcon, Grid3x3, Link as LinkIcon,
} from "lucide-react";
import type { Status } from "@/lib/luzeria/types";

export const STATUS_ICONS: Record<Status, React.ComponentType<{ className?: string; size?: number }>> = {
  START: Play,
  CRIACAO: Paintbrush,
  REVISAO_ARTE: Eye,
  REVISAO_CLIENTE: MessageSquare,
  FINALIZADO: CheckCircle,
};

export function detectDriveType(url: string): {
  Icon: React.ComponentType<{ className?: string; size?: number }>;
  label: string;
} {
  if (!url) return { Icon: LinkIcon, label: "Arquivo" };
  if (/folders\//i.test(url)) return { Icon: Grid3x3, label: "Pasta / Carrossel" };
  if (/\.(mp4|mov|webm)/i.test(url) || /video/i.test(url)) return { Icon: Film, label: "Vídeo" };
  return { Icon: ImageIcon, label: "Imagem" };
}