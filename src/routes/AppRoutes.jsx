import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppLayout } from '../layouts/AppLayout.jsx';
import { DashboardPage } from '../pages/DashboardPage.jsx';
import { CustomersPage } from '../pages/CustomersPage.jsx';
import { ForgotPasswordPage, LoginPage, ResetPasswordPage } from '../features/auth/LoginPage.jsx';
import { SalesCreditNoteViewPage, SalesCustomerViewPage, SalesEditPage, SalesFormPage, SalesInvoiceViewPage, SalesListPage, SalesOrderViewPage, SalesOverviewPage, SalesQuoteViewPage } from '../features/sales/SalesPages.jsx';
import { PurchaseEditPage, PurchaseFormPage, PurchaseListPage, PurchaseOverviewPage } from '../features/purchases/PurchasePages.jsx';
import { PurchaseOrderFormPage, PurchaseOrderListPage, PurchaseOrderViewPage } from '../features/purchases/PurchaseOrderPages.jsx';
import { ExpenseFormPage, ExpenseListPage, ExpenseViewPage } from '../features/purchases/ExpensePages.jsx';
import { BillFormPage, BillListPage, BillViewPage } from '../features/purchases/BillPages.jsx';
import { VendorFormPage, VendorListPage } from '../features/purchases/VendorPages.jsx';
import { VendorViewPage } from '../features/purchases/VendorViewPage.jsx';
import { ProjectPage } from '../features/project/ProjectPages.jsx';
import { ReportsPage } from '../features/reports/ReportsPage.jsx';
import { AddResourcePage, ResourceDetailsPage, ResourcesListPage } from '../features/resources/ResourcesPages.jsx';
import {
  AssetCategoryFormPage,
  AssetCategoryListPage,
  AssetDashboardPage,
  AssetFormPage,
  AssetListPage,
  AssetViewPage,
} from '../features/assets/AssetCorePages.jsx';
import {
  AssetAssignmentPage,
  AssetDepreciationFormPage,
  AssetDepreciationListPage,
  AssetDepreciationRunPage,
  AssetDepreciationViewPage,
  AssetDisposalFormPage,
  AssetDisposalListPage,
  AssetDisposalViewPage,
  AssetMaintenanceFormPage,
  AssetMaintenanceListPage,
  AssetMaintenanceViewPage,
} from '../features/assets/AssetWorkflowPages.jsx';
import {
  PaymentReceivedFormPage,
  PaymentReceivedListPage,
  PaymentReceivedViewPage,
} from '../features/sales/PaymentReceivedPages.jsx';
import {
  OrganizationBrandingPage,
  OrganizationProfilePage,
  SettingsAccessDeniedPage,
  SettingsHomePage,
  UserProfilePage,
  UsersPage,
} from '../features/settings/SettingsPages.jsx';
import { RoleDetailsPage, RoleFormPage, RolesPage } from '../features/settings/RoleManagementPages.jsx';
import { ExpenseAccountMasterPage } from '../features/settings/ExpenseAccountMasterPage.jsx';
import { BankAccountMasterPage } from '../features/settings/BankAccountMasterPage.jsx';
import { DomainIndustryMasterPage } from '../features/settings/DomainIndustryMasterPage.jsx';
import { ItemCategoryMasterPage } from '../features/settings/ItemCategoryMasterPage.jsx';
import { IrpSettingsPage } from '../features/settings/IrpSettingsPage.jsx';
import { useAuthStore } from '../store/authStore.js';
import {
  CompaniesPage, ContactsPage, EntityDetailsPage, LeadDashboardPage,
  LeadFormPage, LeadsPage, PipelineBoardPage,
  PipelineFormPage, PipelinesPage,
} from '../features/leads/LeadManagementPages.jsx';
import { LeadReportsPage } from '../features/leads/LeadReportsPage.jsx';
import { LeadEntityFormPage } from '../features/leads/LeadEntityFormPage.jsx';
import { LeadDetailsPage } from '../features/leads/LeadDetailsPage.jsx';
import { canAccessModule, firstAccessiblePath, hasPermission, moduleForPath } from '../utils/accessControl.js';

function RequireAuth({ children, roles }) {
  const location = useLocation();
  const { user } = useAuthStore();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (roles?.length && !roles.includes(user.role)) {
    return <SettingsAccessDeniedPage />;
  }

  if (!roles?.length && !canAccessModule(user, moduleForPath(location.pathname))) {
    return <SettingsAccessDeniedPage />;
  }

  return children;
}

function RequirePermission({ children, permission }) {
  const { user } = useAuthStore();
  return hasPermission(user, permission) ? children : <SettingsAccessDeniedPage />;
}

function PermissionLanding() {
  const { user } = useAuthStore();
  return <Navigate to={firstAccessiblePath(user)} replace />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route index element={<PermissionLanding />} />
        <Route path="/profile" element={<UserProfilePage />} />
        <Route path="/dashboard" element={<RequirePermission permission="DASHBOARD_OVERVIEW_VIEW"><DashboardPage /></RequirePermission>} />
        <Route path="/lead-management" element={<Navigate to="/lead-management/dashboard" replace />} />
        <Route path="/lead-management/dashboard" element={<LeadDashboardPage />} />
        <Route path="/lead-management/pipeline" element={<PipelineBoardPage />} />
        <Route path="/lead-management/pipelines" element={<PipelinesPage />} />
        <Route path="/lead-management/pipelines/new" element={<PipelineFormPage />} />
        <Route path="/lead-management/pipelines/:id/edit" element={<PipelineFormPage />} />
        <Route path="/lead-management/leads" element={<LeadsPage />} />
        <Route path="/lead-management/leads/new" element={<LeadFormPage />} />
        <Route path="/lead-management/leads/:id/edit" element={<LeadFormPage />} />
        <Route path="/lead-management/leads/:id" element={<LeadDetailsPage />} />
        <Route path="/lead-management/contacts" element={<ContactsPage />} />
        <Route path="/lead-management/contacts/new" element={<LeadEntityFormPage kind="contact" />} />
        <Route path="/lead-management/contacts/:id/edit" element={<LeadEntityFormPage kind="contact" />} />
        <Route path="/lead-management/contacts/:id" element={<EntityDetailsPage kind="contact" />} />
        <Route path="/lead-management/companies" element={<CompaniesPage />} />
        <Route path="/lead-management/companies/new" element={<LeadEntityFormPage kind="company" />} />
        <Route path="/lead-management/companies/:id/edit" element={<LeadEntityFormPage kind="company" />} />
        <Route path="/lead-management/companies/:id" element={<EntityDetailsPage kind="company" />} />
        <Route path="/lead-management/companys/new" element={<Navigate to="/lead-management/companies/new" replace />} />
        <Route path="/lead-management/companys/:id/edit" element={<LeadEntityFormPage kind="company" />} />
        <Route path="/lead-management/companys/:id" element={<EntityDetailsPage kind="company" />} />
        <Route path="/lead-management/reports" element={<RequirePermission permission="LEAD_REPORTS_VIEW"><LeadReportsPage /></RequirePermission>} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/resources" element={<Navigate to="/resources/list" replace />} />
        <Route path="/resources/list" element={<ResourcesListPage mode="list" />} />
        <Route path="/resources/new" element={<AddResourcePage />} />
        <Route path="/resources/:id/edit" element={<AddResourcePage />} />
        <Route path="/resources/:id" element={<ResourceDetailsPage />} />
        <Route path="/asset-management" element={<Navigate to="/asset-management/dashboard" replace />} />
        <Route path="/asset-management/dashboard" element={<AssetDashboardPage />} />
        <Route path="/asset-management/assets" element={<AssetListPage />} />
        <Route path="/asset-management/assets/new" element={<AssetFormPage />} />
        <Route path="/asset-management/assets/:id/edit" element={<AssetFormPage />} />
        <Route path="/asset-management/assets/:id" element={<AssetViewPage />} />
        <Route path="/asset-management/categories" element={<AssetCategoryListPage />} />
        <Route path="/asset-management/categories/new" element={<AssetCategoryFormPage />} />
        <Route path="/asset-management/categories/:id/edit" element={<AssetCategoryFormPage />} />
        <Route path="/asset-management/assign" element={<AssetAssignmentPage />} />
        <Route path="/asset-management/assets/:assetId/assign" element={<AssetAssignmentPage />} />
        <Route path="/asset-management/maintenance" element={<AssetMaintenanceListPage />} />
        <Route path="/asset-management/maintenance/new" element={<AssetMaintenanceFormPage />} />
        <Route path="/asset-management/maintenance/:id/edit" element={<AssetMaintenanceFormPage />} />
        <Route path="/asset-management/maintenance/:id" element={<AssetMaintenanceViewPage />} />
        <Route path="/asset-management/depreciation" element={<AssetDepreciationListPage />} />
        <Route path="/asset-management/depreciation/schedule" element={<AssetDepreciationFormPage />} />
        <Route path="/asset-management/depreciation/run" element={<AssetDepreciationRunPage />} />
        <Route path="/asset-management/depreciation/:id/edit" element={<AssetDepreciationFormPage />} />
        <Route path="/asset-management/depreciation/:id" element={<AssetDepreciationViewPage />} />
        <Route path="/asset-management/disposals" element={<AssetDisposalListPage />} />
        <Route path="/asset-management/disposals/new" element={<AssetDisposalFormPage />} />
        <Route path="/asset-management/disposals/:id/edit" element={<AssetDisposalFormPage />} />
        <Route path="/asset-management/disposals/:id" element={<AssetDisposalViewPage />} />
        <Route path="/reports" element={<Navigate to="/reports/invoice" replace />} />
        <Route path="/reports/invoice" element={<ReportsPage type="invoice" />} />
        <Route path="/reports/sales" element={<ReportsPage type="sales" />} />
        <Route path="/reports/expenses" element={<ReportsPage type="expenses" />} />
        <Route path="/reports/sales-expenses" element={<ReportsPage type="sales-expenses" />} />
        <Route path="/reports/sales-expenses/:month" element={<ReportsPage type="sales-expenses-detail" />} />
        <Route path="/reports/gst" element={<ReportsPage type="gst" />} />
        <Route path="/reports/tds" element={<ReportsPage type="tds" />} />
        <Route path="/project" element={<Navigate to="/project/overview" replace />} />
        <Route path="/project/overview" element={<ProjectPage type="overview" />} />
        <Route path="/project/staffing" element={<ProjectPage type="staffing" />} />
        <Route path="/project/staffing/new" element={<ProjectPage type="staffingNew" />} />
        <Route path="/project/staffing/:id/edit" element={<ProjectPage type="staffingEdit" />} />
        <Route path="/project/staffing/:id" element={<ProjectPage type="staffingDetail" />} />
        <Route path="/project/fixed-cost" element={<ProjectPage type="fixedCost" />} />
        <Route path="/project/fixed-cost/new" element={<ProjectPage type="fixedCostNew" />} />
        <Route path="/project/fixed-cost/:id/edit" element={<ProjectPage type="fixedCostEdit" />} />
        <Route path="/project/fixed-cost/:id" element={<ProjectPage type="fixedCostDetail" />} />
        <Route path="/project/milestones" element={<ProjectPage type="milestones" />} />
        <Route path="/sales" element={<Navigate to="/sales/overview" replace />} />
        <Route path="/sales/overview" element={<SalesOverviewPage />} />
        <Route path="/sales/customers" element={<SalesListPage type="customers" />} />
        <Route path="/sales/customers/new" element={<SalesFormPage type="customer" />} />
        <Route path="/sales/customers/:id/edit" element={<SalesEditPage type="customer" />} />
        <Route path="/sales/customers/:id" element={<SalesCustomerViewPage />} />
        <Route path="/sales/quotes" element={<SalesListPage type="quotes" />} />
        <Route path="/sales/quotes/new" element={<SalesFormPage type="quote" />} />
        <Route path="/sales/quotes/:id/edit" element={<SalesEditPage type="quote" />} />
        <Route path="/sales/quotes/:id" element={<SalesQuoteViewPage />} />
        <Route path="/sales/orders" element={<SalesListPage type="orders" />} />
        <Route path="/sales/orders/new" element={<SalesFormPage type="order" />} />
        <Route path="/sales/orders/:id/edit" element={<SalesEditPage type="order" />} />
        <Route path="/sales/orders/:id" element={<SalesOrderViewPage />} />
        <Route path="/sales/invoices" element={<SalesListPage type="invoices" />} />
        <Route path="/sales/invoices/new" element={<SalesFormPage type="invoice" />} />
        <Route path="/sales/invoices/:id/edit" element={<SalesEditPage type="invoice" />} />
        <Route path="/sales/invoices/:id" element={<SalesInvoiceViewPage />} />
        <Route path="/sales/credit-notes" element={<SalesListPage type="creditNotes" />} />
        <Route path="/sales/credit-notes/new" element={<SalesFormPage type="creditNote" />} />
        <Route path="/sales/credit-notes/:id/edit" element={<SalesEditPage type="creditNote" />} />
        <Route path="/sales/credit-notes/:id" element={<SalesCreditNoteViewPage />} />
        <Route path="/sales/payments-received" element={<PaymentReceivedListPage />} />
        <Route path="/sales/payments-received/new" element={<PaymentReceivedFormPage />} />
        <Route path="/sales/payments-received/:id/edit" element={<PaymentReceivedFormPage />} />
        <Route path="/sales/payments-received/:id" element={<PaymentReceivedViewPage />} />
        <Route path="/sales/delivery-challans" element={<SalesListPage type="challans" />} />
        <Route path="/sales/delivery-challans/new" element={<SalesFormPage type="challan" />} />
        <Route path="/sales/delivery-challans/:id/edit" element={<SalesEditPage type="challan" />} />
        <Route path="/purchases" element={<Navigate to="/purchases/overview" replace />} />
        <Route path="/purchases/overview" element={<PurchaseOverviewPage />} />
        <Route path="/purchases/bills" element={<BillListPage />} />
        <Route path="/purchases/bills/new" element={<BillFormPage />} />
        <Route path="/purchases/bills/:id/edit" element={<BillFormPage />} />
        <Route path="/purchases/bills/:id" element={<BillViewPage />} />
        <Route path="/purchases/expenses" element={<ExpenseListPage />} />
        <Route path="/purchases/expenses/new" element={<ExpenseFormPage />} />
        <Route path="/purchases/expenses/:id/edit" element={<ExpenseFormPage />} />
        <Route path="/purchases/expenses/:id" element={<ExpenseViewPage />} />
        <Route path="/purchases/orders" element={<PurchaseOrderListPage />} />
        <Route path="/purchases/orders/new" element={<PurchaseOrderFormPage />} />
        <Route path="/purchases/orders/:id/edit" element={<PurchaseOrderFormPage />} />
        <Route path="/purchases/orders/:id" element={<PurchaseOrderViewPage />} />
        <Route path="/purchases/vendors" element={<VendorListPage />} />
        <Route path="/purchases/vendors/new" element={<VendorFormPage />} />
        <Route path="/purchases/vendors/:id/edit" element={<VendorFormPage />} />
        <Route path="/purchases/vendors/:id" element={<VendorViewPage />} />
        <Route path="/purchases/items" element={<PurchaseListPage type="items" />} />
        <Route path="/purchases/items/new" element={<PurchaseFormPage type="item" />} />
        <Route path="/purchases/items/:id/edit" element={<PurchaseEditPage type="item" />} />
        <Route path="/settings" element={<RequireAuth roles={['admin', 'accountant']}><SettingsHomePage /></RequireAuth>} />
        <Route path="/settings/organization/profile" element={<RequireAuth roles={['admin', 'accountant']}><OrganizationProfilePage /></RequireAuth>} />
        <Route path="/settings/organization/branding" element={<RequireAuth roles={['admin', 'accountant']}><OrganizationBrandingPage /></RequireAuth>} />
        <Route path="/settings/users" element={<RequireAuth roles={['admin']}><UsersPage /></RequireAuth>} />
        <Route path="/settings/roles" element={<RequireAuth roles={['admin']}><RolesPage /></RequireAuth>} />
        <Route path="/settings/roles/new" element={<RequireAuth roles={['admin']}><RoleFormPage /></RequireAuth>} />
        <Route path="/settings/roles/:id" element={<RequireAuth roles={['admin']}><RoleDetailsPage /></RequireAuth>} />
        <Route path="/settings/roles/:id/edit" element={<RequireAuth roles={['admin']}><RoleFormPage /></RequireAuth>} />
        <Route path="/settings/masters/expense-accounts" element={<RequireAuth roles={['admin']}><ExpenseAccountMasterPage /></RequireAuth>} />
        <Route path="/settings/masters/bank-accounts" element={<RequireAuth roles={['admin']}><BankAccountMasterPage /></RequireAuth>} />
        <Route path="/settings/masters/domain-industries" element={<RequireAuth roles={['admin']}><DomainIndustryMasterPage /></RequireAuth>} />
        <Route path="/settings/masters/item-categories" element={<RequireAuth roles={['admin']}><ItemCategoryMasterPage /></RequireAuth>} />
        <Route path="/settings/irp" element={<RequireAuth roles={['admin']}><IrpSettingsPage /></RequireAuth>} />
        <Route path="/settings/access-denied" element={<SettingsAccessDeniedPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
