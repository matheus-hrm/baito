import { createRootRoute, createRoute, createRouter, Outlet } from "@tanstack/react-router";

import AdminDashboard from "../features/admin/AdminDashboard";
import BaitoLandingPage from "../features/landing/BaitoLandingPage";
import {
  AuthPage,
  ClientDashboard,
  ListingDetailPage,
  NotFoundPage,
  ProviderDashboard,
  ProviderDetailPage,
  ProviderListingsPage,
  ProvidersPage,
} from "../features/marketplace/MarketplacePages";

const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: BaitoLandingPage,
});

const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin",
  component: AdminDashboard,
});

const providersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/prestadores",
  component: ProvidersPage,
});

const providerDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/prestadores/$providerId",
  component: ProviderDetailPage,
});

const listingDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/anuncios/$listingId",
  component: ListingDetailPage,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/entrar",
  component: () => <AuthPage mode="login" />,
});

const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/cadastro",
  component: () => <AuthPage mode="register" />,
});

const clientDashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dashboard/cliente",
  component: ClientDashboard,
});

const providerDashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dashboard/prestador",
  component: ProviderDashboard,
});

const providerListingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dashboard/prestador/ofertas",
  component: ProviderListingsPage,
});

const notFoundRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "*",
  component: NotFoundPage,
});

export const router = createRouter({
  routeTree: rootRoute.addChildren([
    indexRoute,
    adminRoute,
    providersRoute,
    providerDetailRoute,
    listingDetailRoute,
    loginRoute,
    registerRoute,
    clientDashboardRoute,
    providerDashboardRoute,
    providerListingsRoute,
    notFoundRoute,
  ]),
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
