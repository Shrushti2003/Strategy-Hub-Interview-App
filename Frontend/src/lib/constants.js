export const APP_NAME = "Strategy Hub"
export const APP_DESCRIPTION = "AI-powered interview strategy platform"

export const ROUTES = {
  home: "/",
  login: "/login",
  register: "/register",
  dashboard: "/dashboard",
  generate: "/generate",
  report: (id) => `/report/${id}`,
  reports: "/reports",
  settings: "/settings",
}

export const NAV_ITEMS = [
  { label: "Dashboard", href: ROUTES.dashboard, icon: "LayoutDashboard" },
  { label: "Generate", href: ROUTES.generate, icon: "Sparkles" },
  { label: "Reports", href: ROUTES.reports, icon: "FileText" },
  { label: "Settings", href: ROUTES.settings, icon: "Settings" },
]
