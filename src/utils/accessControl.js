const pathModules = [
  ['/lead-management', 'lead'], ['/asset-management', 'asset'], ['/purchases', 'purchases'],
  ['/sales', 'sales'], ['/project', 'project'], ['/resources', 'resources'], ['/reports', 'reports'],
  ['/settings', 'settings'], ['/customers', 'sales'],
];
const permissionModuleAliases = {
  purchases: 'purchase',
  'lead-management': 'lead',
  'asset-management': 'asset',
};

function permissionModuleCode(module = '') {
  const normalized = String(module).trim().toLowerCase();
  return permissionModuleAliases[normalized] || normalized;
}

export function moduleForPath(pathname='') { return pathModules.find(([prefix]) => pathname.startsWith(prefix))?.[1] || 'dashboard'; }
export function canAccessModule(user, module) {
  if (!user) return false;
  if (user.role === 'admin' || user.permissions?.includes('*')) return true;
  const target = permissionModuleCode(module);
  const permissions = (user.permissions || []).map(value => String(value).toLowerCase());
  // A permission from a nested module must never unlock an unrelated top-level
  // menu (for example LEAD_DASHBOARD_VIEW must not unlock DASHBOARD).
  const permittedByRole = permissions.some(value => value === target || value.startsWith(`${target}:`) || value.startsWith(`${target}_`));
  if (permissions.length) return permittedByRole;
  // Legacy users created before role permissions were introduced retain their
  // module access list until an administrator assigns a permission-based role.
  const access = (Array.isArray(user.access) ? user.access : String(user.access || '').split(','))
    .map(value => value.trim().toLowerCase());
  return access.some(value => permissionModuleCode(value) === target || value.includes(target));
}

export function canAccessSubmodule(user, module, submodule) {
  if (!user) return false;
  if (user.role === 'admin' || user.permissions?.includes('*')) return true;
  const permissions = (user.permissions || []).map(value => String(value).trim().toLowerCase());
  if (!permissions.length) return canAccessModule(user, module);
  const prefix = `${permissionModuleCode(module)}_${String(submodule).trim().toLowerCase()}_`;
  return permissions.some(value => value.startsWith(prefix));
}

export function hasPermission(user, permission) {
  if (!user) return false;
  if (user.role === 'admin' || user.permissions?.includes('*')) return true;
  const expected = String(permission || '').trim().toUpperCase();
  return (user.permissions || []).some(value => String(value).trim().toUpperCase() === expected);
}

export function firstAccessiblePath(user) {
  const destinations = [
    ['DASHBOARD_OVERVIEW_VIEW', '/dashboard'],
    ['SALES_OVERVIEW_VIEW', '/sales/overview'],
    ['PURCHASE_OVERVIEW_VIEW', '/purchases/overview'],
    ['LEAD_DASHBOARD_VIEW', '/lead-management/dashboard'],
    ['LEAD_PIPELINE_VIEW', '/lead-management/pipeline'],
    ['LEAD_LEADS_VIEW', '/lead-management/leads'],
    ['LEAD_REPORTS_VIEW', '/lead-management/reports'],
    ['RESOURCES_RESOURCES_VIEW', '/resources/list'],
    ['ASSET_DASHBOARD_VIEW', '/asset-management/dashboard'],
    ['PROJECT_OVERVIEW_VIEW', '/project/overview'],
    ['REPORTS_INVOICE_REPORTS_VIEW', '/reports/invoice'],
    ['REPORTS_SALES_REPORTS_VIEW', '/reports/sales'],
    ['REPORTS_EXPENSE_REPORTS_VIEW', '/reports/expenses'],
  ];
  return destinations.find(([permission]) => hasPermission(user, permission))?.[1] || '/profile';
}
