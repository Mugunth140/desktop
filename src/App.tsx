import { useEffect, useState } from "react";
import "./App.css";
import { BackupRestore } from "./components/BackupRestore";
import { Billing } from "./components/Billing";
import { Dashboard } from "./components/Dashboard";
import { Invoices } from "./components/Invoices";
import { Layout } from "./components/Layout";
import { Login } from "./components/Login";
import { Reports } from "./components/reports/Reports";
import { SalesReturns } from "./components/SalesReturns";
import { Settings } from "./components/Settings";
import { StockManagement } from "./components/StockManagement";
import { ToastProvider } from "./components/ui";
import { backupService } from "./db/backupService";
import { invoiceService } from "./db/invoiceService";
import { productService } from "./db/productService";
import { useAuthSession } from "./hooks";
import { ReportIntent } from "./types/notifications";

function AppContent() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [reportIntent, setReportIntent] = useState<ReportIntent | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const { session, login, logout } = useAuthSession();

  useEffect(() => {
    const initApp = async () => {
      try {
        await productService.seedData();
        await invoiceService.seedData();
        await backupService.checkAndTriggerAutoBackup();
      } catch (error) {
        console.error("Initialization failed:", error);
      } finally {
        setIsInitializing(false);
      }
    };
    initApp();
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return <Dashboard onNavigate={setActiveTab} />;
      case "billing":
        return <Billing />;
      case "stock":
        return <StockManagement canEdit={session?.role === "admin"} />;
      case "returns":
        return <SalesReturns userRole={session?.role} userName={session?.name} />;
      case "invoices":
        return <Invoices />;
      case "reports":
        return <Reports intent={reportIntent} />;
      case "backups":
        return <BackupRestore />;
      case "settings":
        return <Settings />;
      default:
        return <Dashboard onNavigate={setActiveTab} />;
    }
  };

  if (isInitializing) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-100">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 font-semibold">Initializing MotorMods...</p>
          <p className="text-sm text-slate-400 mt-1">Loading database and services</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Login onLogin={login} />;
  }

  return (
    <Layout
      activeTab={activeTab}
      setActiveTab={(tab) => {
        setActiveTab(tab);
        if (tab !== "reports") setReportIntent(null);
      }}
      session={session}
      onLogout={logout}
      onReportIntent={(intent) => {
        setReportIntent(intent);
        setActiveTab("reports");
      }}
    >
      {renderContent()}
    </Layout>
  );
}

function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}

export default App;