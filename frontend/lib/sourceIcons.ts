import { Youtube, Globe, PenLine, Camera, FileText, File, Lightbulb } from "lucide-react";
import type { SourceType } from "./api";

export function getSourceIcon(type: SourceType) {
  switch (type) {
    case "youtube": return Youtube;
    case "article": return Globe;
    case "notes": return PenLine;
    case "image": return Camera;
    case "pdf": return FileText;
    case "document": return File;
    case "topic": return Lightbulb;
    default: return Globe;
  }
}

export function getSourceColor(type: SourceType) {
  switch (type) {
    case "youtube": return "text-red-500";
    case "article": return "text-primary";
    case "notes": return "text-warning";
    case "image": return "text-success";
    case "pdf": return "text-error";
    case "document": return "text-primary";
    case "topic": return "text-violet-500";
    default: return "text-primary";
  }
}
