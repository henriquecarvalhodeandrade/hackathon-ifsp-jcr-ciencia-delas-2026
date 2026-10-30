import { Skeleton } from "@/components/ui";
import {
  ForumLoadingShell,
  PageHeaderSkeleton,
  ThreadListSkeleton,
} from "@/components/forum/skeletons";

export default function ForumLoading() {
  return (
    <ForumLoadingShell label="Carregando o fórum…">
      <PageHeaderSkeleton withSearch />
      <div aria-hidden="true" className="grid gap-3 py-6 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-36 rounded-card" />
        ))}
      </div>
      <div className="py-6">
        <ThreadListSkeleton />
      </div>
    </ForumLoadingShell>
  );
}
