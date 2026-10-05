export const PERMISSION_ACTIONS = ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'DOWNLOAD'];

const crud = [...PERMISSION_ACTIONS];
const view = ['VIEW'];
const report = ['VIEW', 'DOWNLOAD'];

export const permissionRegistry = [
  { code: 'DASHBOARD', name: 'Dashboard', items: [
    ['OVERVIEW', 'Dashboard', '/dashboard', view],
  ]},
  { code: 'SALES', name: 'Sales', items: [
    ['OVERVIEW', 'Overview', '/sales/overview', view],
    ['CUSTOMERS', 'Customers', '/sales/customers', crud, ['IMPORT', 'EXPORT', 'EMAIL']],
    ['QUOTES', 'Quotes', '/sales/quotes', crud, ['PRINT', 'EMAIL', 'CLONE', 'GENERATE_PDF']],
    ['SALES_ORDERS', 'Sales Orders', '/sales/orders', crud, ['PRINT', 'EMAIL', 'CLONE', 'GENERATE_PDF']],
    ['INVOICES', 'Invoices', '/sales/invoices', crud, ['APPROVE', 'PRINT', 'SHARE', 'EMAIL', 'RECORD_PAYMENT', 'GENERATE_PDF', 'SEND_REMINDER']],
    ['CREDIT_NOTES', 'Credit Notes', '/sales/credit-notes', crud, ['PRINT', 'EMAIL', 'GENERATE_PDF']],
    ['PAYMENTS_RECEIVED', 'Payments Received', '/sales/payments-received', crud, ['PRINT', 'EMAIL', 'GENERATE_PDF']],
    ['DELIVERY_CHALLANS', 'Delivery Challans', '/sales/delivery-challans', crud, ['PRINT', 'EMAIL', 'GENERATE_PDF']],
  ]},
  { code: 'PURCHASE', name: 'Purchases', items: [
    ['OVERVIEW', 'Overview', '/purchases/overview', view],
    ['BILLS', 'Bills', '/purchases/bills', crud, ['APPROVE', 'RECORD_PAYMENT', 'PRINT', 'GENERATE_PDF']],
    ['EXPENSES', 'Expenses', '/purchases/expenses', crud, ['APPROVE', 'REJECT', 'DOWNLOAD_ATTACHMENT']],
    ['PURCHASE_ORDERS', 'Purchase Orders', '/purchases/orders', crud, ['APPROVE', 'CONVERT_TO_BILL', 'PRINT', 'EMAIL', 'GENERATE_PDF']],
    ['VENDORS', 'Vendors', '/purchases/vendors', crud, ['IMPORT', 'EXPORT', 'EMAIL']],
    ['ITEMS', 'Items', '/purchases/items', crud, ['IMPORT', 'EXPORT']],
  ]},
  { code: 'ASSET', name: 'Asset', items: [
    ['DASHBOARD', 'Dashboard', '/asset-management/dashboard', view],
    ['ASSETS', 'Assets', '/asset-management/assets', crud, ['ASSIGN', 'SCHEDULE_MAINTENANCE', 'DISPOSE', 'GENERATE_DEPRECIATION', 'EXPORT']],
    ['CATEGORIES', 'Categories', '/asset-management/categories', crud],
    ['MAINTENANCE', 'Maintenance', '/asset-management/maintenance', crud],
    ['DEPRECIATION', 'Depreciation', '/asset-management/depreciation', crud, ['GENERATE_DEPRECIATION']],
    ['DISPOSALS', 'Disposals', '/asset-management/disposals', crud, ['APPROVE']],
    ['ASSIGN_ASSET', 'Assign Asset', '/asset-management/assign', ['VIEW', 'CREATE', 'EDIT'], ['ASSIGN']],
  ]},
  { code: 'LEAD', name: 'Lead', items: [
    ['DASHBOARD', 'Dashboard', '/lead-management/dashboard', view],
    ['PIPELINE', 'Pipeline', '/lead-management/pipeline', ['VIEW', 'EDIT'], ['CHANGE_STAGE']],
    ['LEADS', 'Leads', '/lead-management/leads', crud, ['ASSIGN', 'CONVERT', 'CHANGE_STAGE', 'EXPORT', 'ADD_NOTE', 'ADD_ACTIVITY']],
    ['PIPELINES', 'Lead Pipelines', '/lead-management/pipelines', crud, ['CLONE', 'ARCHIVE']],
    ['CONTACTS', 'Contacts', '/lead-management/contacts', crud, ['IMPORT', 'EXPORT', 'EMAIL']],
    ['COMPANIES', 'Companies', '/lead-management/companies', crud, ['IMPORT', 'EXPORT', 'EMAIL']],
    ['REPORTS', 'Reports', '/lead-management/reports', report, ['SCHEDULE', 'SHARE']],
  ]},
  { code: 'PROJECT', name: 'Project', items: [
    ['OVERVIEW', 'Project Overview', '/project/overview', view],
    ['FIXED_COST', 'Fixed Cost Projects', '/project/fixed-cost', crud],
    ['STAFFING', 'Staffing Projects', '/project/staffing', crud],
    ['MILESTONES', 'Milestones', '/project/milestones', crud],
  ]},
  { code: 'RESOURCES', name: 'Resources', items: [
    ['RESOURCES', 'Resources', '/resources/list', crud, ['ASSIGN', 'EXPORT']],
  ]},
  { code: 'REPORTS', name: 'Reports', items: [
    ['INVOICE_REPORTS', 'Invoice Reports', '/reports/invoice', report],
    ['SALES_REPORTS', 'Sales Reports', '/reports/sales', report],
    ['EXPENSE_REPORTS', 'Expense Reports', '/reports/expenses', report],
    ['ASSET_REPORTS', 'Asset Reports', '/asset-management/dashboard', report],
    ['LEAD_REPORTS', 'Lead Reports', '/lead-management/reports', report],
  ]},
].map((module, moduleIndex) => ({
  ...module,
  order: moduleIndex,
  items: module.items.map(([code, name, route, actions, extras = []], index) => ({
    moduleCode: module.code, code, name, route, actions, extras, order: index,
  })),
}));

export function permissionCode(moduleCode, submoduleCode, action) {
  return `${moduleCode}_${submoduleCode}_${action}`;
}

export function allPermissionCodes() {
  return permissionRegistry.flatMap((module) => module.items.flatMap((item) => [
    ...item.actions.map((action) => permissionCode(module.code, item.code, action)),
    ...item.extras.map((action) => permissionCode(module.code, item.code, action)),
  ]));
}
