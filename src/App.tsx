import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { lazy, Suspense } from "react";
import AppLayout from "@/components/AppLayout";
const LoginPage = lazy(() => import("@/pages/LoginPage"));
const NotFound = lazy(() => import("@/pages/NotFound"));

// Lazy load pages for performance
const HomePage = lazy(() => import("@/pages/HomePage"));
const SubjectPage = lazy(() => import("@/pages/SubjectPage"));
const PostsPage = lazy(() => import("@/pages/PostsPage"));
const ChatsPage = lazy(() => import("@/pages/ChatsPage"));
const ConversionPage = lazy(() => import("@/pages/ConversionPage"));
const ImgToPdfPage = lazy(() => import("@/pages/ImgToPdfPage"));
const ProfilePage = lazy(() => import("@/pages/ProfilePage"));
const AdminPage = lazy(() => import("@/pages/AdminPage"));
const GodPage = lazy(() => import("@/pages/GodPage"));
const TimetablePage = lazy(() => import("@/pages/TimetablePage"));
const AttendancePage = lazy(() => import("@/pages/AttendancePage"));
const LearningHubPage = lazy(() => import("@/pages/LearningHubPage"));
const InstallPage = lazy(() => import("@/pages/InstallPage"));
const AnalyticsPage = lazy(() => import("@/pages/AnalyticsPage"));

const queryClient = new QueryClient();

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="h-6 w-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route element={<AppLayout />}>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/cs" element={<HomePage />} />
                  <Route path="/bs" element={<HomePage />} />
                  <Route path="/it" element={<HomePage />} />
                  <Route path="/subject/:code" element={<SubjectPage />} />
                  <Route path="/posts/:code" element={<PostsPage />} />
                  <Route path="/chats" element={<ChatsPage />} />
                  <Route path="/conversion" element={<ConversionPage />} />
                  <Route path="/img-to-pdf" element={<ImgToPdfPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/admin" element={<AdminPage />} />
                  <Route path="/god" element={<GodPage />} />
                  <Route path="/timetable" element={<TimetablePage />} />
                  <Route path="/attendance" element={<AttendancePage />} />
                  <Route path="/learning" element={<LearningHubPage />} />
                  <Route path="/install" element={<InstallPage />} />
                  <Route path="/analytics" element={<AnalyticsPage />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
