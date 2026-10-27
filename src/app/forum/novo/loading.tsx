import { ForumLoadingShell, PageHeaderSkeleton, ThreadFormSkeleton } from "@/components/forum/skeletons";

export default function NewThreadLoading() {
  return (
    <ForumLoadingShell label="Carregando o formulário…">
      <PageHeaderSkeleton />
      <div className="pb-14">
        <ThreadFormSkeleton />
      </div>
    </ForumLoadingShell>
  );
}
