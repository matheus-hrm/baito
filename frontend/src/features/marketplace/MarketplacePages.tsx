import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  Check,
  MapPin,
  Plus,
  Search,
  Shield,
  Star,
  UserRound,
  X,
} from "lucide-react";

import { listCategories } from "../categories/api";
import { ApiError } from "../../shared/api/http";
import { getAdminToken } from "../../shared/session/admin-session";
import { clearUserSession, getUserToken, setUserSession } from "../../shared/session/user-session";
import {
  createContract,
  createListing,
  createProvider,
  getListing,
  getMe,
  getProvider,
  listContracts,
  listConversations,
  listListings,
  listMyListings,
  listProviders,
  loginUser,
  registerUser,
  type Listing,
} from "./api";
import "./marketplace.css";

function price(value: number | null, currency = "BRL") {
  if (value === null) return "A negociar";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

function typeLabel(value: string) {
  return ({ fixed: "Fixo", hourly: "Por hora", daily: "Por dia", negotiable: "Negociável" } as Record<string, string>)[value] ?? value;
}

function apiError(error: unknown) {
  if (error instanceof ApiError && typeof error.payload === "object" && error.payload && "error" in error.payload) {
    return String(error.payload.error);
  }
  return error instanceof Error ? error.message : "Não foi possível completar a operação.";
}

function isPasswordValidationError(error: unknown) {
  if (!(error instanceof ApiError) || typeof error.payload !== "object" || !error.payload) return false;
  if (!("details" in error.payload) || typeof error.payload.details !== "object" || !error.payload.details) return false;
  return "password" in error.payload.details;
}

function AppNav() {
  const token = getUserToken();
  const adminToken = getAdminToken();
  const me = useQuery({ queryKey: ["me", token], queryFn: () => getMe(token ?? ""), enabled: Boolean(token) });
  const role = me.data?.data.role;
  const isProvider = role === "provider";

  return (
    <nav className="app-nav">
      <div className="app-nav-inner">
        <Link className="app-logo" to="/"><span>バ</span>baito</Link>
        <div className="app-links">
          {token ? (
            <>
              <Link to={isProvider ? "/dashboard/prestador" : "/dashboard/cliente"}>Meu perfil</Link>
              {isProvider ? <Link to="/dashboard/prestador">Minhas ofertas</Link> : <Link to="/prestadores">Buscar prestadores</Link>}
              {isProvider && <Link to="/prestadores">Buscar prestadores</Link>}
            </>
          ) : (
            <>
              <Link to="/prestadores">Buscar prestadores</Link>
              {adminToken && <Link to="/admin">Painel admin</Link>}
            </>
          )}
        </div>
        <div className="app-actions">
          {token ? (
            <Link className="btn-light" to={isProvider ? "/dashboard/prestador" : "/dashboard/cliente"}>{me.data?.data.name ?? "Meu perfil"}</Link>
          ) : (
            <Link className="btn-light" to="/entrar">Entrar</Link>
          )}
          {token ? <button className="btn-dark" type="button" onClick={() => { clearUserSession(); window.location.href = "/"; }}>Sair</button> : <Link className="btn-dark" to="/cadastro">Cadastrar</Link>}
        </div>
      </div>
    </nav>
  );
}

function ListingCard({ listing }: { listing: Listing }) {
  return (
    <Link className="market-card" to="/anuncios/$listingId" params={{ listingId: listing.id }}>
      <div className="card-topline">
        <div className="icon-box"><BriefcaseBusiness size={18} /></div>
        <div className="price">{price(listing.price, listing.priceCurrency)} · {typeLabel(listing.priceType)}</div>
      </div>
      <h3>{listing.title}</h3>
      <p>{listing.description}</p>
      <div className="tags">{listing.tags.slice(0, 4).map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div>
      <div className="meta-row">
        <span><Star size={12} /> {(listing.providerRating ?? 0).toFixed(1)} ({listing.providerReviews ?? 0})</span>
        <span><MapPin size={12} /> {listing.location ?? "Remoto"}</span>
      </div>
    </Link>
  );
}

export function ProvidersPage() {
  const [category, setCategory] = useState("all");
  const [q, setQ] = useState("");
  const categories = useQuery({ queryKey: ["categories"], queryFn: listCategories });
  const providers = useQuery({ queryKey: ["providers", category, q], queryFn: () => listProviders({ category, q, perPage: 24 }) });
  const listings = useQuery({ queryKey: ["listings", category, q], queryFn: () => listListings({ category, q, perPage: 24 }) });

  return (
    <>
      <AppNav />
      <main className="page">
        <div className="page-inner">
          <header className="page-head">
            <div>
              <div className="eyebrow">Marketplace</div>
              <h1 className="page-title">Encontre prestadores e serviços reais.</h1>
              <p className="page-sub">Busque por categoria, palavra-chave ou especialidade. Todos os cards abaixo vêm do backend local.</p>
            </div>
          </header>
          <div className="filters">
            <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Buscar por React, contratos, branding..." />
            <button className={`pill${category === "all" ? " active" : ""}`} onClick={() => setCategory("all")} type="button">Todos</button>
            {categories.data?.data.map((cat) => (
              <button className={`pill${category === cat.slug ? " active" : ""}`} onClick={() => setCategory(cat.slug)} type="button" key={cat.id}>
                {cat.name}
              </button>
            ))}
          </div>
          <section className="panel">
            <div className="panel-head"><h2>Serviços disponíveis</h2><span>{listings.data?.meta.total ?? 0} resultados</span></div>
            <div className="grid-cards">
              {listings.data?.data.map((listing) => <ListingCard listing={listing} key={listing.id} />)}
              {listings.isLoading && <div className="empty">Carregando serviços...</div>}
            </div>
          </section>
          <section className="panel">
            <div className="panel-head"><h2>Prestadores verificados</h2><span>{providers.data?.meta.total ?? 0} perfis</span></div>
            <div className="grid-cards">
              {providers.data?.data.map((provider) => (
                <Link className="market-card" to="/prestadores/$providerId" params={{ providerId: provider.id }} key={provider.id}>
                  <div className="card-topline"><div className="icon-box"><UserRound size={18} /></div><div className="price">{provider.categoryName}</div></div>
                  <h3>{provider.displayName}</h3>
                  <p>{provider.description}</p>
                  <div className="meta-row"><span>{provider.location ?? "Remoto"}</span><span>{(provider.averageRating ?? 0).toFixed(1)} estrelas</span></div>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}

export function ListingDetailPage() {
  const { listingId } = useParams({ from: "/anuncios/$listingId" });
  const token = getUserToken();
  const [proposalError, setProposalError] = useState<string | null>(null);
  const listing = useQuery({ queryKey: ["listing", listingId], queryFn: () => getListing(listingId) });
  const create = useMutation({ mutationFn: (input: { title: string; description: string; agreedPrice?: number }) => createContract(token ?? "", { ...input, providerId: listing.data?.data.providerId ?? "", listingId }) });
  const data = listing.data?.data;

  return (
    <>
      <AppNav />
      <main className="page">
        <div className="page-inner">
          {!data && <div className="empty">Carregando anúncio...</div>}
          {data && (
            <div className="panel">
              <div className="page-head">
                <div>
                  <div className="eyebrow">{data.categoryName}</div>
                  <h1 className="page-title">{data.title}</h1>
                  <p className="page-sub">{data.description}</p>
                </div>
                <div className="price">{price(data.price, data.priceCurrency)} · {typeLabel(data.priceType)}</div>
              </div>
              <div className="metrics">
                <div className="metric"><span>Prestador</span><strong>{data.providerName}</strong></div>
                <div className="metric"><span>Avaliação</span><strong>{(data.providerRating ?? 0).toFixed(1)}</strong></div>
                <div className="metric"><span>Visualizações</span><strong>{data.views}</strong></div>
              </div>
              <form className="form-grid" noValidate onSubmit={(event) => {
                event.preventDefault();
                setProposalError(null);
                if (!token) return;
                const form = new FormData(event.currentTarget);
                const title = String(form.get("title") ?? "").trim();
                if (!title) {
                  setProposalError("Informe um título para a proposta.");
                  return;
                }
                const agreedPrice = Number(form.get("agreedPrice")) || undefined;
                create.mutate({
                  title,
                  description: String(form.get("description")),
                  ...(agreedPrice ? { agreedPrice } : {}),
                });
              }}>
                <label>Título da proposta<input name="title" defaultValue={`Contratação: ${data.title}`} /></label>
                <label>Mensagem<textarea name="description" defaultValue="Tenho interesse neste serviço e gostaria de alinhar escopo, prazo e próximos passos." /></label>
                <label>Valor combinado<input name="agreedPrice" type="number" defaultValue={data.price ?? undefined} /></label>
                {!token && <div className="alert">Entre na sua conta para enviar uma proposta.</div>}
                {proposalError && <div className="field-popover">{proposalError}</div>}
                {create.isSuccess && <div className="ok">Proposta criada. Acompanhe pelo dashboard do cliente.</div>}
                {create.isError && <div className="alert">{apiError(create.error)}</div>}
                <button className="btn-dark" disabled={!token || create.isPending} type="submit"><Shield size={16} />Enviar proposta</button>
              </form>
            </div>
          )}
        </div>
      </main>
    </>
  );
}

export function ProviderDetailPage() {
  const { providerId } = useParams({ from: "/prestadores/$providerId" });
  const query = useQuery({ queryKey: ["provider", providerId], queryFn: () => getProvider(providerId) });
  const data = query.data?.data;
  return (
    <>
      <AppNav />
      <main className="page"><div className="page-inner">
        {!data && <div className="empty">Carregando prestador...</div>}
        {data && <>
          <header className="page-head"><div><div className="eyebrow">{data.provider.categoryName}</div><h1 className="page-title">{data.provider.displayName}</h1><p className="page-sub">{data.provider.description}</p></div></header>
          <section className="panel"><div className="panel-head"><h2>Anúncios</h2><span>{data.listings.length} publicados</span></div><div className="grid-cards">{data.listings.map((item) => <Link className="market-card" to="/anuncios/$listingId" params={{ listingId: item.id }} key={item.id}><h3>{item.title}</h3><p>{item.description}</p><div className="tags">{item.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div></Link>)}</div></section>
          <section className="panel"><div className="panel-head"><h2>Avaliações</h2><span>{data.reviews.length} públicas</span></div><div className="grid-cards">{data.reviews.map((review) => <article className="market-card" key={review.id}><div className="price">{review.rating} estrelas</div><h3>{review.reviewerName}</h3><p>{review.comment}</p></article>)}</div></section>
        </>}
      </div></main>
    </>
  );
}

export function AuthPage({ mode }: { mode: "login" | "register" }) {
  const navigate = useNavigate();
  const [role, setRole] = useState<"client" | "provider">("client");
  const [password, setPassword] = useState(mode === "login" ? "Baito123" : "");
  const [formError, setFormError] = useState<string | null>(null);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [passwordServerInvalid, setPasswordServerInvalid] = useState(false);
  const passwordRules = [
    { key: "length", label: "Pelo menos 8 caracteres", valid: password.length >= 8 },
    { key: "upper", label: "Uma letra maiúscula", valid: /[A-Z]/.test(password) },
    { key: "number", label: "Um número", valid: /[0-9]/.test(password) },
  ];
  const showPasswordRules = mode === "register" && (passwordFocused || password.length > 0 || passwordServerInvalid);
  const mutation = useMutation({
    mutationFn: (input: { name?: string; email: string; password: string }) => (
      mode === "login"
        ? loginUser({ email: input.email, password: input.password })
        : registerUser({ name: input.name ?? "", email: input.email, password: input.password, role })
    ),
    onSuccess: ({ data }) => {
      setUserSession(data.accessToken, data.refreshToken);
      void navigate({ to: role === "provider" ? "/dashboard/prestador" : "/dashboard/cliente" });
    },
    onError: (error) => {
      if (isPasswordValidationError(error)) setPasswordServerInvalid(true);
    },
  });

  return (
    <main className="auth-wrap">
      <section className="auth-card">
        <Link className="app-logo" to="/"><span>バ</span>baito</Link>
        <h1>{mode === "login" ? "Entrar no baito" : "Criar conta"}</h1>
        <p>{mode === "login" ? "Acesse seus contratos, mensagens e anúncios." : "Comece como cliente ou prestador usando dados reais do backend."}</p>
        <form className="form-grid" noValidate onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          setFormError(null);
          setPasswordServerInvalid(false);
          const form = new FormData(event.currentTarget);
          const name = String(form.get("name") ?? "").trim();
          const email = String(form.get("email") ?? "").trim();
          if (mode === "register" && !name) {
            setFormError("Informe seu nome para criar a conta.");
            return;
          }
          if (!email) {
            setFormError("Informe seu e-mail.");
            return;
          }
          if (!/^\S+@\S+\.\S+$/.test(email)) {
            setFormError("Informe um e-mail válido.");
            return;
          }
          if (!password) {
            setFormError("Informe sua senha.");
            return;
          }
          if (mode === "register" && passwordRules.some((rule) => !rule.valid)) {
            setPasswordServerInvalid(true);
            setFormError("A senha ainda não cumpre todos os requisitos.");
            return;
          }
          mutation.mutate({ name, email, password });
        }}>
          {mode === "register" && <label>Nome<input name="name" /></label>}
          <label>E-mail<input name="email" type="email" defaultValue={mode === "login" ? "marina.cliente@baito.local" : ""} /></label>
          <label>
            Senha
            <input
              name="password"
              type="password"
              value={password}
              onFocus={() => setPasswordFocused(true)}
              onBlur={() => setPasswordFocused(false)}
              onChange={(event) => {
                setPassword(event.target.value);
                setPasswordServerInvalid(false);
              }}
            />
          </label>
          {mode === "register" && (
            <div className={`password-rules${showPasswordRules ? " open" : ""}`} aria-live="polite">
              {passwordRules.map((rule) => {
                const invalidAfterSubmit = passwordServerInvalid && !rule.valid;
                return (
                  <div className={`password-rule${rule.valid ? " valid" : ""}${invalidAfterSubmit ? " invalid" : ""}`} key={rule.key}>
                    <span className="rule-icon" key={rule.valid ? "ok" : "x"}>
                      {rule.valid ? <Check size={13} /> : <X size={13} />}
                    </span>
                    {rule.label}
                  </div>
                );
              })}
            </div>
          )}
          {mode === "register" && (
            <fieldset className="choice-field">
              <legend>Sou um:</legend>
              <div className="choice-row">
                <button type="button" className={role === "client" ? "active" : ""} onClick={() => setRole("client")}>
                  Cliente
                </button>
                <button type="button" className={role === "provider" ? "active" : ""} onClick={() => setRole("provider")}>
                  Prestador de serviço
                </button>
              </div>
            </fieldset>
          )}
          {formError && <div className="field-popover">{formError}</div>}
          {mutation.isError && <div className="alert">{apiError(mutation.error)}</div>}
          <button className="btn-dark" type="submit">{mode === "login" ? "Entrar" : "Cadastrar"} <ArrowRight size={16} /></button>
        </form>
      </section>
    </main>
  );
}

function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <>
      <AppNav />
      <main className="dash dash-single">
        <section className="dash-main">{children}</section>
      </main>
    </>
  );
}

function AccessDenied({ title, description, to, action }: { title: string; description: string; to: "/dashboard/cliente" | "/dashboard/prestador"; action: string }) {
  return (
    <DashboardShell>
      <section className="panel">
        <div className="page-head">
          <div>
            <div className="eyebrow">Acesso restrito</div>
            <h1 className="page-title">{title}</h1>
            <p className="page-sub">{description}</p>
          </div>
          <Link className="btn-dark" to={to}>{action}</Link>
        </div>
      </section>
    </DashboardShell>
  );
}

export function ClientDashboard() {
  const token = getUserToken();
  const me = useQuery({ queryKey: ["me", token], queryFn: () => getMe(token ?? ""), enabled: Boolean(token) });
  const contracts = useQuery({ queryKey: ["contracts", token], queryFn: () => listContracts(token ?? ""), enabled: Boolean(token) });
  const conversations = useQuery({ queryKey: ["conversations", token], queryFn: () => listConversations(token ?? ""), enabled: Boolean(token) });
  if (!token) return <AuthPage mode="login" />;
  if (me.data?.data.role === "provider") {
    return <AccessDenied title="Dashboard exclusivo para clientes." description="Sua conta é de prestador de serviço. Use a área de ofertas e contratos recebidos." to="/dashboard/prestador" action="Ir para prestador" />;
  }
  return (
    <DashboardShell>
      <header className="page-head"><div><div className="eyebrow">Cliente</div><h1 className="page-title">Olá, {me.data?.data.name ?? "cliente"}.</h1><p className="page-sub">Acompanhe propostas, contratos e mensagens em andamento.</p></div></header>
      <div className="metrics"><div className="metric"><span>Contratos</span><strong>{contracts.data?.meta.total ?? 0}</strong></div><div className="metric"><span>Conversas</span><strong>{conversations.data?.data.length ?? 0}</strong></div><div className="metric"><span>Perfil</span><strong>{me.data?.data.role ?? "-"}</strong></div></div>
      <section className="panel"><div className="panel-head"><h2>Contratos</h2><Link className="btn-light" to="/prestadores"><Search size={16} />Buscar serviço</Link></div><div className="grid-cards">{contracts.data?.data.map((contract) => <article className="market-card" key={contract.id}><div className="price">{contract.status}</div><h3>{contract.title}</h3><p>{contract.providerName} · {price(contract.agreedPrice, contract.currency)}</p></article>)}</div></section>
    </DashboardShell>
  );
}

export function ProviderDashboard() {
  const token = getUserToken();
  const queryClient = useQueryClient();
  const [listingFormError, setListingFormError] = useState<string | null>(null);
  const me = useQuery({ queryKey: ["me", token], queryFn: () => getMe(token ?? ""), enabled: Boolean(token) });
  const contracts = useQuery({ queryKey: ["contracts", token], queryFn: () => listContracts(token ?? ""), enabled: Boolean(token) });
  const listings = useQuery({ queryKey: ["mine", token], queryFn: () => listMyListings(token ?? ""), enabled: Boolean(token) });
  const categories = useQuery({ queryKey: ["categories"], queryFn: listCategories });
  const providerMutation = useMutation({
    mutationFn: () => {
      const categoryId = categories.data?.data[0]?.id;
      return createProvider(token ?? "", {
        displayName: "Meu perfil profissional",
        description: "Atendimento especializado com escopo claro, comunicação objetiva e entregas documentadas.",
        ...(categoryId ? { categoryId } : {}),
        location: "Remoto",
      });
    },
    onSuccess: () => queryClient.invalidateQueries(),
  });
  const listingMutation = useMutation({
    mutationFn: (input: { title: string; description: string; price?: number }) => {
      const categoryId = categories.data?.data[0]?.id;
      return createListing(token ?? "", {
        ...input,
        ...(categoryId ? { categoryId } : {}),
        priceType: "fixed",
        tags: ["Atendimento", "Projeto", "Remoto"],
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["mine", token] }),
  });
  if (!token) return <AuthPage mode="login" />;
  if (me.data?.data.role === "client") {
    return <AccessDenied title="Dashboard exclusivo para prestadores." description="Sua conta é de cliente. Use a área de busca e acompanhamento das suas contratações." to="/dashboard/cliente" action="Ir para cliente" />;
  }
  return (
    <DashboardShell>
      <header className="page-head"><div><div className="eyebrow">Prestador</div><h1 className="page-title">Gerencie sua operação.</h1><p className="page-sub">Crie perfil, publique anúncios e acompanhe contratos recebidos.</p></div></header>
      <div className="metrics"><div className="metric"><span>Anúncios</span><strong>{listings.data?.data.length ?? 0}</strong></div><div className="metric"><span>Contratos</span><strong>{contracts.data?.meta.total ?? 0}</strong></div><div className="metric"><span>Status</span><strong>Ativo</strong></div></div>
      <section className="panel"><div className="panel-head"><h2>Publicar serviço</h2><button className="btn-light" onClick={() => providerMutation.mutate()} type="button"><UserRound size={16} />Criar perfil padrão</button></div>
        <form className="form-grid" noValidate onSubmit={(event) => {
          event.preventDefault();
          setListingFormError(null);
          const form = new FormData(event.currentTarget);
          const formPrice = Number(form.get("price")) || undefined;
          const title = String(form.get("title") ?? "").trim();
          const description = String(form.get("description") ?? "").trim();
          if (!title) {
            setListingFormError("Informe um título para o anúncio.");
            return;
          }
          if (description.length < 20) {
            setListingFormError("Descreva o serviço com pelo menos 20 caracteres.");
            return;
          }
          listingMutation.mutate({
            title,
            description,
            ...(formPrice ? { price: formPrice } : {}),
          });
        }}>
          <label>Título<input name="title" defaultValue="Consultoria especializada para pequenos negócios" /></label>
          <label>Descrição<textarea name="description" defaultValue="Diagnóstico inicial, plano de ação e execução acompanhada com entregas semanais." /></label>
          <label>Preço<input name="price" type="number" defaultValue="1200" /></label>
          {providerMutation.isError && <div className="alert">{apiError(providerMutation.error)}</div>}
          {listingFormError && <div className="field-popover">{listingFormError}</div>}
          {listingMutation.isError && <div className="alert">{apiError(listingMutation.error)}</div>}
          <button className="btn-dark" type="submit"><Plus size={16} />Criar anúncio</button>
        </form>
      </section>
      <section className="panel"><div className="panel-head"><h2>Meus anúncios</h2></div><div className="grid-cards">{listings.data?.data.map((item) => <article className="market-card" key={item.id}><h3>{item.title}</h3><p>{item.description}</p><div className="tags">{item.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div></article>)}</div></section>
    </DashboardShell>
  );
}

export function NotFoundPage() {
  return <><AppNav /><main className="page"><div className="page-inner"><div className="empty">Página não encontrada.</div></div></main></>;
}
