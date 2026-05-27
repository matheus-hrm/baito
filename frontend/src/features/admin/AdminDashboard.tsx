import { useMemo, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  BriefcaseBusiness,
  CheckCircle2,
  Database,
  FileText,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  RefreshCcw,
  Shield,
  Star,
  Users,
} from "lucide-react";

import { ApiError } from "../../shared/api/http";
import { clearAdminToken, getAdminToken, setAdminToken } from "../../shared/session/admin-session";
import {
  getAdminObservability,
  getAdminOverview,
  listAdminContracts,
  listAdminListings,
  listAdminProviders,
  listAdminUsers,
  loginAdmin,
  type AdminContract,
  type AdminListing,
  type AdminProvider,
  type AdminUser,
} from "./api";
import "./admin.css";

type TableKey = "users" | "providers" | "listings" | "contracts";

const tableTabs: Array<{ key: TableKey; label: string }> = [
  { key: "users", label: "Usuários" },
  { key: "providers", label: "Prestadores" },
  { key: "listings", label: "Anúncios" },
  { key: "contracts", label: "Contratos" },
];

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function formatCurrency(value: number | null, currency = "BRL") {
  if (value === null) return "A negociar";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value);
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function apiErrorMessage(error: unknown) {
  if (error instanceof ApiError && typeof error.payload === "object" && error.payload !== null && "error" in error.payload) {
    return String(error.payload.error);
  }

  return error instanceof Error ? error.message : "Não foi possível completar a operação.";
}

function LoginPanel({ onLogin }: { onLogin: (token: string) => void }) {
  const [email, setEmail] = useState("admin@baito.local");
  const [password, setPassword] = useState("");
  const queryClient = useQueryClient();

  const login = useMutation({
    mutationFn: loginAdmin,
    onSuccess: ({ data }) => {
      setAdminToken(data.accessToken);
      onLogin(data.accessToken);
      queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    login.mutate({ email, password });
  }

  return (
    <main className="admin-shell admin-shell-login">
      <section className="admin-login-card" aria-labelledby="admin-login-title">
        <Link className="admin-logo" to="/">
          <span>バ</span>
          <strong>baito</strong>
        </Link>
        <div>
          <h1 id="admin-login-title">Painel administrativo</h1>
          <p>Entre com a credencial configurada no backend para consultar operação, banco e tabelas.</p>
        </div>
        <form className="admin-form" onSubmit={onSubmit}>
          <label>
            E-mail
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="username" required />
          </label>
          <label>
            Senha
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" required />
          </label>
          {login.isError && <div className="admin-alert">{apiErrorMessage(login.error)}</div>}
          <button type="submit" disabled={login.isPending}>
            <Shield size={17} />
            {login.isPending ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </section>
    </main>
  );
}

function MetricCard({ label, value, helper, icon: Icon }: { label: string; value: string; helper: string; icon: typeof Users }) {
  return (
    <article className="metric-card">
      <div className="metric-icon"><Icon size={18} /></div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{helper}</small>
      </div>
    </article>
  );
}

function BarChart({ rows }: { rows: Array<{ key: string; total: number }> }) {
  const max = Math.max(...rows.map((row) => row.total), 1);
  if (rows.length === 0) return <div className="admin-empty">Sem dados suficientes para gráfico.</div>;

  return (
    <div className="admin-chart-bars">
      {rows.map((row) => (
        <div className="admin-chart-row" key={row.key}>
          <span>{row.key}</span>
          <div><i style={{ width: `${Math.max((row.total / max) * 100, 4)}%` }} /></div>
          <strong>{formatNumber(row.total)}</strong>
        </div>
      ))}
    </div>
  );
}

function EmptyTable({ label }: { label: string }) {
  return <div className="admin-empty">Nenhum registro em {label.toLowerCase()} ainda.</div>;
}

function UsersTable({ rows }: { rows: AdminUser[] }) {
  if (rows.length === 0) return <EmptyTable label="Usuários" />;
  return (
    <table>
      <thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Status</th></tr></thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <td>{row.name}</td>
            <td>{row.email}</td>
            <td>{row.role}</td>
            <td>{row.isActive ? "Ativo" : "Inativo"}{row.isVerified ? " / verificado" : ""}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ProvidersTable({ rows }: { rows: AdminProvider[] }) {
  if (rows.length === 0) return <EmptyTable label="Prestadores" />;
  return (
    <table>
      <thead><tr><th>Prestador</th><th>Categoria</th><th>Avaliação</th><th>Local</th></tr></thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <td>{row.displayName}<small>{row.userEmail}</small></td>
            <td>{row.categoryName ?? "Sem categoria"}</td>
            <td>{row.averageRating?.toFixed(1) ?? "0.0"} ({row.totalReviews ?? 0})</td>
            <td>{row.location ?? "Não informado"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ListingsTable({ rows }: { rows: AdminListing[] }) {
  if (rows.length === 0) return <EmptyTable label="Anúncios" />;
  return (
    <table>
      <thead><tr><th>Anúncio</th><th>Prestador</th><th>Preço</th><th>Status</th></tr></thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <td>{row.title}<small>{row.categoryName ?? "Sem categoria"}</small></td>
            <td>{row.providerName}</td>
            <td>{formatCurrency(row.price, row.priceCurrency)}<small>{row.priceType}</small></td>
            <td>{row.status} / {row.views} views</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ContractsTable({ rows }: { rows: AdminContract[] }) {
  if (rows.length === 0) return <EmptyTable label="Contratos" />;
  return (
    <table>
      <thead><tr><th>Contrato</th><th>Cliente</th><th>Prestador</th><th>Status</th></tr></thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <td>{row.title}<small>{formatCurrency(row.agreedPrice, row.currency)}</small></td>
            <td>{row.clientName}<small>{row.clientEmail}</small></td>
            <td>{row.providerName}<small>{row.providerUserEmail}</small></td>
            <td>{row.status}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function AdminDashboard() {
  const [token, setToken] = useState(() => getAdminToken());
  const [activeTable, setActiveTable] = useState<TableKey>("users");
  const queryClient = useQueryClient();

  const overviewQuery = useQuery({
    queryKey: ["admin", "overview", token],
    queryFn: () => getAdminOverview(token ?? ""),
    enabled: Boolean(token),
  });

  const observabilityQuery = useQuery({
    queryKey: ["admin", "observability", token],
    queryFn: () => getAdminObservability(token ?? ""),
    enabled: Boolean(token),
  });

  const tableQueries = useQueries({
    queries: [
      { queryKey: ["admin", "users", token], queryFn: () => listAdminUsers(token ?? ""), enabled: Boolean(token) },
      { queryKey: ["admin", "providers", token], queryFn: () => listAdminProviders(token ?? ""), enabled: Boolean(token) },
      { queryKey: ["admin", "listings", token], queryFn: () => listAdminListings(token ?? ""), enabled: Boolean(token) },
      { queryKey: ["admin", "contracts", token], queryFn: () => listAdminContracts(token ?? ""), enabled: Boolean(token) },
    ],
  });

  const [usersQuery, providersQuery, listingsQuery, contractsQuery] = tableQueries;

  const authFailed = overviewQuery.error instanceof ApiError && overviewQuery.error.status === 401;
  if (authFailed) {
    clearAdminToken();
  }

  const tableContent = useMemo(() => {
    if (activeTable === "users") return usersQuery.isLoading ? <div className="admin-empty">Carregando usuários...</div> : <UsersTable rows={usersQuery.data?.data ?? []} />;
    if (activeTable === "providers") return providersQuery.isLoading ? <div className="admin-empty">Carregando prestadores...</div> : <ProvidersTable rows={providersQuery.data?.data ?? []} />;
    if (activeTable === "listings") return listingsQuery.isLoading ? <div className="admin-empty">Carregando anúncios...</div> : <ListingsTable rows={listingsQuery.data?.data ?? []} />;
    return contractsQuery.isLoading ? <div className="admin-empty">Carregando contratos...</div> : <ContractsTable rows={contractsQuery.data?.data ?? []} />;
  }, [activeTable, contractsQuery.data?.data, contractsQuery.isLoading, listingsQuery.data?.data, listingsQuery.isLoading, providersQuery.data?.data, providersQuery.isLoading, usersQuery.data?.data, usersQuery.isLoading]);

  if (!token || authFailed) return <LoginPanel onLogin={setToken} />;

  const overview = overviewQuery.data?.data;
  const observability = observabilityQuery.data?.data;
  const isLoading = overviewQuery.isLoading || observabilityQuery.isLoading;

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="admin-logo" to="/">
          <span>バ</span>
          <strong>baito</strong>
        </Link>
        <nav>
          <a href="#overview" className="active"><LayoutDashboard size={17} />Visão geral</a>
          <a href="#tables"><Database size={17} />Tabelas</a>
          <a href="#observability"><Activity size={17} />Observabilidade</a>
        </nav>
      </aside>

      <section className="admin-main">
        <header className="admin-header">
          <div>
            <span>Admin</span>
            <h1>Operação Baito</h1>
          </div>
          <div className="admin-actions">
            <button type="button" onClick={() => queryClient.invalidateQueries({ queryKey: ["admin"] })}>
              <RefreshCcw size={16} />Atualizar
            </button>
            <button
              type="button"
              onClick={() => {
                clearAdminToken();
                setToken(null);
              }}
            >
              <LogOut size={16} />Sair
            </button>
          </div>
        </header>

        {isLoading && <div className="admin-banner">Carregando dados administrativos...</div>}
        {overviewQuery.isError && !authFailed && <div className="admin-alert">{apiErrorMessage(overviewQuery.error)}</div>}

        <section className="metrics-grid" id="overview">
          <MetricCard icon={Users} label="Usuários" value={formatNumber(overview?.users.total ?? 0)} helper={`${formatNumber(overview?.users.active ?? 0)} ativos`} />
          <MetricCard icon={BriefcaseBusiness} label="Prestadores" value={formatNumber(overview?.providers.total ?? 0)} helper={`${formatNumber(overview?.providers.verified ?? 0)} verificados`} />
          <MetricCard icon={FileText} label="Anúncios" value={formatNumber(overview?.listings.total ?? 0)} helper={`${overview?.listings.byStatus.length ?? 0} status`} />
          <MetricCard icon={CheckCircle2} label="Contratos" value={formatNumber(overview?.contracts.total ?? 0)} helper={`${overview?.contracts.byStatus.length ?? 0} status`} />
          <MetricCard icon={MessageSquare} label="Mensagens" value={formatNumber(overview?.messages.total ?? 0)} helper={`${formatNumber(overview?.messages.unread ?? 0)} não lidas`} />
          <MetricCard icon={Star} label="Avaliações" value={formatNumber(overview?.reviews.total ?? 0)} helper={`${formatNumber(overview?.reviews.public ?? 0)} públicas`} />
        </section>

        <section className="admin-panel" id="charts">
          <div className="admin-panel-head">
            <div>
              <span>Gráficos</span>
              <h2>Distribuição da operação</h2>
            </div>
          </div>
          <div className="admin-charts-grid">
            <div>
              <h3>Usuários por perfil</h3>
              <BarChart rows={overview?.users.byRole ?? []} />
            </div>
            <div>
              <h3>Anúncios por status</h3>
              <BarChart rows={overview?.listings.byStatus ?? []} />
            </div>
            <div>
              <h3>Contratos por status</h3>
              <BarChart rows={overview?.contracts.byStatus ?? []} />
            </div>
          </div>
        </section>

        <section className="admin-panel" id="tables">
          <div className="admin-panel-head">
            <div>
              <span>Dados</span>
              <h2>Tabelas principais</h2>
            </div>
            <div className="admin-tabs" role="tablist" aria-label="Tabelas administrativas">
              {tableTabs.map((tab) => (
                <button key={tab.key} type="button" className={activeTable === tab.key ? "active" : ""} onClick={() => setActiveTable(tab.key)}>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          <div className="admin-table-wrap">{tableContent}</div>
        </section>

        <section className="admin-panel" id="observability">
          <div className="admin-panel-head">
            <div>
              <span>API e SQLite</span>
              <h2>Observabilidade</h2>
            </div>
          </div>
          <div className="observability-grid">
            <div>
              <span>API</span>
              <strong>{observability?.api.status ?? "-"}</strong>
              <small>{observability?.api.node ?? "-"} em {observability?.api.environment ?? "-"}</small>
            </div>
            <div>
              <span>Uptime</span>
              <strong>{formatNumber(observability?.api.uptimeSeconds ?? 0)}s</strong>
              <small>Heap usado: {formatBytes(observability?.api.memory.heapUsed ?? 0)}</small>
            </div>
            <div>
              <span>Banco</span>
              <strong>{observability?.database.status ?? "-"}</strong>
              <small>WAL: {observability?.database.journalMode ?? "-"} / FK: {observability?.database.foreignKeys ? "on" : "off"}</small>
            </div>
            <div>
              <span>Tamanho</span>
              <strong>{formatBytes(observability?.database.approximateSizeBytes ?? 0)}</strong>
              <small>{observability?.database.migrations.length ?? 0} migrations aplicadas</small>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
