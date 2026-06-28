import {
  Play, Paintbrush, Eye, MessageSquare, CheckCircle,
  Film, Image as ImageIcon, Grid3x3, Link as LinkIcon,
} from "lucide-react";
import type { Status } from "@/lib/luzeria/types";

type IconProps = { className?: string; size?: number; style?: React.CSSProperties; color?: string };
export const STATUS_ICONS: Record<Status, React.ComponentType<IconProps>> = {
  START: Play,
  CRIACAO: Paintbrush,
  REVISAO_ARTE: Eye,
  REVISAO_CLIENTE: MessageSquare,
  FINALIZADO: CheckCircle,
};

export function detectDriveType(url: string): {
  Icon: React.ComponentType<IconProps>;
  label: string;
} {
  if (!url) return { Icon: LinkIcon, label: "Arquivo" };
  if (/folders\//i.test(url)) return { Icon: Grid3x3, label: "Pasta / Carrossel" };
  if (/\.(mp4|mov|webm)/i.test(url) || /video/i.test(url)) return { Icon: Film, label: "Vídeo" };
  return { Icon: ImageIcon, label: "Imagem" };
}