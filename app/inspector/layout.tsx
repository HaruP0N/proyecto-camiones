import type { ReactNode } from "react";
import "./inspector.css";
import InspectorShell from "@/components/inspector/InspectorShell";

export default function InspectorLayout({ children }: { children: ReactNode }) {
  return <InspectorShell>{children}</InspectorShell>;
}
