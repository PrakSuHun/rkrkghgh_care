"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, UserCheck, UserPlus, FileText, LogOut } from "lucide-react";

const tabs = [
  { href: "/", label: "대시보드", icon: LayoutDashboard },
  { href: "/seniors", label: "어르신", icon: Users },
  { href: "/workers", label: "요양사", icon: UserCheck },
  { href: "/assignments", label: "배정", icon: UserPlus },
  { href: "/documents", label: "서류", icon: FileText, desktopOnly: true },
];

export default function TopNav() {
  const pathname = usePathname();
  const currentTab = tabs.find((t) => t.href === pathname || (t.href !== "/" && pathname.startsWith(t.href)));

  async function logout() {
    await fetch("/api/login", { method: "DELETE" });
    window.location.href = "/login";
  }

  return (
    <>
      {/* 상단 헤더 (모바일/데스크탑 공통, 로그인 페이지에서는 숨김) */}
      {pathname !== "/login" && (
        <header className="bg-white border-b sticky top-0 z-40">
          <div className="flex items-center justify-between px-4 h-14 max-w-3xl mx-auto">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-lg font-bold text-indigo-600 truncate">가가호호 케어</span>
              {currentTab && (
                <span className="text-sm text-gray-500 truncate">· {currentTab.label}</span>
              )}
            </div>
            <button
              onClick={logout}
              className="p-2 text-gray-500 active:text-red-600"
              aria-label="로그아웃"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>
      )}

      {/* 하단 탭바 (모든 화면 크기에서 사용) */}
      {pathname !== "/login" && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t z-40 pb-safe">
          <div className="grid grid-cols-4 md:grid-cols-5">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`${tab.desktopOnly ? "hidden md:flex" : "flex"} flex-col items-center justify-center min-h-[56px] py-1.5 gap-0.5 ${
                    active ? "text-indigo-600" : "text-gray-500"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-[11px] font-medium whitespace-nowrap">{tab.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </>
  );
}
