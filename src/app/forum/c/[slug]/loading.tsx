import {
  ForumLoadingShell,
  PageHeaderSkeleton,
  ThreadListSkeleton,
} from "@/components/forum/skeletons";

export default function CategoryLoading() {
  return (
    <ForumLoadingShell label="Carregando a categoria…">
      <PageHeaderSkeleton withSearch />
      <div className="pb-14">
        <ThreadListSkeleton rows={6} />
      </div>
    </ForumLoadingShell>
  );
}
