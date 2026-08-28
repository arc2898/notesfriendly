import { Outlet, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { GlobalSearch } from "@/components/GlobalSearch";
import OfflineIndicator from "@/components/OfflineIndicator";
import NotificationsListener from "@/components/NotificationsListener";
import { NotificationsPopup } from "@/components/NotificationsPopup";

export default function AppLayout() {
  const { isLoggedIn, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-primary font-bold text-lg">Loading...</div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-h-screen">
          <header className="h-14 flex items-center border-b border-border/50 glass-subtle sticky top-0 z-40 px-4 gap-3">
            <SidebarTrigger className="shrink-0" />
            <h1 className="text-lg font-bold text-primary tracking-tight hidden sm:block">NotesFriendly</h1>
            <div className="flex-1" />
            <GlobalSearch />
            <div className="scale-75 origin-right -mr-2">
              <NotificationsPopup />
            </div>
          </header>
          <OfflineIndicator />
          <NotificationsListener />
          <main className="flex-1 overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
