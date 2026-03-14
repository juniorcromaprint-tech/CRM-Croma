import { Suspense, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

const fallback = (
  <div className="flex h-[60vh] items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
  </div>
);

export default function LazyPage({ children }: { children: ReactNode }) {
  return <Suspense fallback={fallback}>{children}</Suspense>;
}
