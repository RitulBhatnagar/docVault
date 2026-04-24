import {
  File,
  FileAudio,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileType2,
  FileVideo,
} from "lucide-react"

interface FormatIconProps {
  format: string
  className?: string
}

const FORMAT_MAP: Record<string, { Icon: typeof File; color: string }> = {
  pdf:  { Icon: FileText,        color: "text-red-500" },
  doc:  { Icon: FileType2,       color: "text-blue-500" },
  docx: { Icon: FileType2,       color: "text-blue-500" },
  xls:  { Icon: FileSpreadsheet, color: "text-emerald-500" },
  xlsx: { Icon: FileSpreadsheet, color: "text-emerald-500" },
  csv:  { Icon: FileSpreadsheet, color: "text-emerald-500" },
  png:  { Icon: FileImage,       color: "text-purple-500" },
  jpg:  { Icon: FileImage,       color: "text-purple-500" },
  jpeg: { Icon: FileImage,       color: "text-purple-500" },
  gif:  { Icon: FileImage,       color: "text-purple-500" },
  svg:  { Icon: FileImage,       color: "text-purple-500" },
  webp: { Icon: FileImage,       color: "text-purple-500" },
  txt:  { Icon: FileText,        color: "text-gray-500" },
  md:   { Icon: FileText,        color: "text-gray-500" },
  // video
  mp4:  { Icon: FileVideo,       color: "text-orange-500" },
  webm: { Icon: FileVideo,       color: "text-orange-500" },
  mov:  { Icon: FileVideo,       color: "text-orange-500" },
  avi:  { Icon: FileVideo,       color: "text-orange-500" },
  mkv:  { Icon: FileVideo,       color: "text-orange-500" },
  ogv:  { Icon: FileVideo,       color: "text-orange-500" },
  // audio
  mp3:  { Icon: FileAudio,       color: "text-pink-500" },
  wav:  { Icon: FileAudio,       color: "text-pink-500" },
  ogg:  { Icon: FileAudio,       color: "text-pink-500" },
  flac: { Icon: FileAudio,       color: "text-pink-500" },
  m4a:  { Icon: FileAudio,       color: "text-pink-500" },
  aac:  { Icon: FileAudio,       color: "text-pink-500" },
}

export function FormatIcon({ format, className = "h-4 w-4" }: FormatIconProps) {
  const ext = format.toLowerCase()
  const { Icon, color } = FORMAT_MAP[ext] ?? { Icon: File, color: "text-gray-400" }
  return <Icon className={`${className} ${color}`} />
}
