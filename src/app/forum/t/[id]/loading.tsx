import { ForumLoadingShell, ThreadSkeleton } from "@/components/forum/skeletons";

export default function ThreadLoading() {
  return (
    <ForumLoadingShell label="Carregando o tópico…">
      <ThreadSkeleton />
    </ForumLoadingShell>
  );
}
