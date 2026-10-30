import {
  ForumLoadingShell,
  PageHeaderSkeleton,
  ThreadFormSkeleton,
} from "@/components/forum/skeletons";

export default function EditThreadLoading() {
  return (
    <ForumLoadingShell label="Carregando o tópico para edição…">
      <div className="mx-auto w-full max-w-3xl pb-14">
        <PageHeaderSkeleton />
        <ThreadFormSkeleton />
      </div>
    </ForumLoadingShell>
  );
}
