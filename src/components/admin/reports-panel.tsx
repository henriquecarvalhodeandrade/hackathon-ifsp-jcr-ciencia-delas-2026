import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { ChipLink, EmptyState, Pagination } from "@/components/ui";
import { REPORT_STATUS_SLUGS, type ReportStatus } from "@/lib/admin/params";
import type { ReportsPage } from "@/lib/admin/queries";
import { ReportCard } from "./report-card";

const FILTERS: Array<{ status: ReportStatus; label: string }> = [
  { status: "open", label: "Abertas" },
  { status: "resolved", label: "Resolvidas" },
  { status: "dismissed", label: "Arquivadas" },
];

const EMPTY: Record<ReportStatus, { title: string; description: string }> = {
  open: {
    title: "Nenhuma denúncia aberta",
    description:
      "A fila está vazia. Obrigada por cuidar da comunidade — novas denúncias aparecem aqui.",
  },
  resolved: {
    title: "Nenhuma denúncia resolvida ainda",
    description: "As denúncias resolvidas ficam guardadas aqui.",
  },
  dismissed: {
    title: "Nenhuma denúncia arquivada",
    description: "Denúncias arquivadas sem ação aparecem aqui.",
  },
};

function Guide() {
  return (
    <aside
      aria-labelledby="guia-moderacao"
      className="rounded-card border border-border bg-surface-2 p-5 text-[0.9375rem]"
    >
      <h3
        id="guia-moderacao"
        className="flex items-center gap-2 font-display text-base font-semibold text-fg"
      >
        <ShieldCheck aria-hidden="true" className="size-5 text-primary" />
        Antes de agir
      </h3>
      <ul className="mt-3 grid list-disc gap-2 pl-5 text-fg-muted marker:text-fg-subtle">
        <li>Abra o conteúdo e leia o contexto completo da conversa.</li>
        <li>Prefira a menor intervenção que resolve: trancar ou ocultar antes de excluir.</li>
        <li>
          A nota da denúncia é{" "}
          <strong className="font-semibold text-fg">visível para quem denunciou</strong>: escreva
          com cuidado, sem dados pessoais.
        </li>
        <li>
          Cada ação (ocultar, trancar, excluir, resolver) entra no registro interno da moderação.
        </li>
        <li>
          Revelar autoria anônima é exclusivo de administradoras, só em casos graves, com motivo
          registrado.
        </li>
        <li>
          Siga o{" "}
          <Link href="/conduta" className="font-semibold text-primary underline underline-offset-4">
            código de conduta
          </Link>
          .
        </li>
      </ul>
    </aside>
  );
}

export function ReportsPanel({
  data,
  status,
  page,
  isAdmin,
}: {
  data: ReportsPage;
  status: ReportStatus;
  page: number;
  isAdmin: boolean;
}) {
  const now = new Date();
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_18rem] xl:items-start">
      <div className="grid gap-5">
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="Filtrar denúncias por situação"
        >
          {FILTERS.map((f) => (
            <ChipLink
              key={f.status}
              href={
                f.status === "open" ? "/admin" : `/admin?status=${REPORT_STATUS_SLUGS[f.status]}`
              }
              active={status === f.status}
              count={data.counts[f.status]}
            >
              {f.label}
            </ChipLink>
          ))}
        </div>

        {data.error ? (
          <EmptyState
            icon={<ShieldCheck />}
            title="Não conseguimos carregar as denúncias"
            description="Recarregue a página em instantes. Se continuar, confira os logs do servidor."
          />
        ) : data.reports.length === 0 ? (
          <EmptyState
            icon={<ShieldCheck />}
            title={EMPTY[status].title}
            description={EMPTY[status].description}
          />
        ) : (
          <>
            <ol className="grid gap-4" aria-label="Denúncias">
              {data.reports.map((report) => (
                <li key={report.id}>
                  <ReportCard report={report} isAdmin={isAdmin} now={now} />
                </li>
              ))}
            </ol>
            <Pagination
              page={page}
              totalPages={data.totalPages}
              basePath="/admin"
              searchParams={{ status: status === "open" ? undefined : REPORT_STATUS_SLUGS[status] }}
            />
          </>
        )}
      </div>
      <Guide />
    </div>
  );
}
