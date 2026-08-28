import { Home, MessageCircle, RefreshCw, User, Shield, Eye, ClipboardCheck, Star, ChevronDown, GraduationCap, Download, BarChart3 } from "lucide-react";
import { useState } from "react";
import { NavLink } from "@/components/NavLink";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useNotificationCounts } from "@/hooks/useNotificationCounts";
import { useBookmarks } from "@/hooks/useBookmarks";
import { NotificationBadge } from "@/components/NotificationBadge";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function AppSidebar() {
  const { user, logout } = useAuth();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();
  const { chats, attendance } = useNotificationCounts();
  const { bookmarks } = useBookmarks();
  const [favOpen, setFavOpen] = useState(true);

  const mainItems: { title: string; url: string; icon: any; badge?: number; unreadUrl?: string }[] = [
    { title: "Home", url: "/", icon: Home },
    { title: "Chats", url: "/chats", icon: MessageCircle, badge: chats, unreadUrl: "/chats?unread=true" },
    {
      title: "Attendance",
      url: "/attendance",
      icon: ClipboardCheck,
      badge: attendance,
      unreadUrl: "/attendance?alert=true",
    },
    { title: "Conversion", url: "/conversion", icon: RefreshCw },
    { title: "Profile", url: "/profile", icon: User },
  ];

  const panelItems: { title: string; url: string; icon: any }[] = [];
  if (user?.role === "admin" || user?.role === "god") {
    panelItems.push({ title: "Admin Panel", url: "/admin", icon: Shield });
    panelItems.push({ title: "Analytics", url: "/analytics", icon: BarChart3 });
  }
  if (user?.role === "god") {
    panelItems.push({ title: "God Panel", url: "/god", icon: Eye });
  }

  const handleLogout = async () => {
    await logout();
  };

  const topBookmarks = bookmarks.slice(0, 5);

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarContent className="pt-4">
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-xs font-bold tracking-widest uppercase text-primary px-4 mb-2">
              NotesFriendly
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                      activeClassName="bg-primary/10 text-primary font-semibold"
                    >
                      <item.icon className="h-5 w-5 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                      {!collapsed && item.badge ? (
                        <NotificationBadge
                          count={item.badge}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            navigate(item.unreadUrl || item.url);
                          }}
                        />
                      ) : null}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Favorites */}
        {!collapsed && topBookmarks.length > 0 && (
          <SidebarGroup>
            <button
              onClick={() => setFavOpen((o) => !o)}
              className="flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase text-muted-foreground px-4 mb-1 w-full"
            >
              <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
              <span>Favorites</span>
              <ChevronDown
                className={`h-3 w-3 ml-auto transition-transform ${favOpen ? "" : "-rotate-90"}`}
              />
            </button>
            {favOpen && (
              <SidebarGroupContent>
                <SidebarMenu>
                  {topBookmarks.map((b) => (
                    <SidebarMenuItem key={b.id}>
                      <SidebarMenuButton asChild>
                        <button
                          onClick={() => navigate(`/subject/${b.subject_code}`)}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:bg-accent/50 hover:text-foreground w-full text-left"
                        >
                          <Star className="h-3.5 w-3.5 shrink-0 text-yellow-400 fill-yellow-400" />
                          <span className="truncate flex-1">{b.file_name}</span>
                        </button>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            )}
          </SidebarGroup>
        )}

        {panelItems.length > 0 && (
          <SidebarGroup>
            {!collapsed && (
              <SidebarGroupLabel className="text-xs font-semibold tracking-wider uppercase text-muted-foreground px-4 mb-1">
                Panel
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {panelItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                        activeClassName="bg-primary/10 text-primary font-semibold"
                      >
                        <item.icon className="h-5 w-5 shrink-0" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-3">
        {!collapsed && user && (
          <div className="flex items-center gap-2 px-2 py-1 mb-2">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
              {user.id.slice(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-foreground">{user.name}</p>
              <p className="text-xs text-muted-foreground">
                {user.division} • {user.role}
              </p>
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && "Logout"}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
