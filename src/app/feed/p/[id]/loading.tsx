import { Container } from "@/components/ui";
import { PostDetailSkeleton } from "@/components/feed/skeletons";

export default function PostLoading() {
  return (
    <Container size="narrow" aria-busy="true">
      <p role="status" className="sr-only">
        Carregando a publicação…
      </p>
      <PostDetailSkeleton />
    </Container>
  );
}
