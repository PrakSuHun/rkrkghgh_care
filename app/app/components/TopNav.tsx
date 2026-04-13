"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "대시보드" },
  { href: "/seniors", label: "어르신 관리" },
  { href: "/workers", label: "요양보호사" },
  { href: "/tag-monitor", label: "태그 모니터링" },
];

export default function TopNav() {
  const pathname = usePathname();

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center h-14">
          <Link href="/" className="text-xl font-bold text-indigo-600 mr-8">
            CareLink
          </Link>
          <div className="flex space-x-1 flex-1">
            {tabs.map((tab) => {
              const active = pathname === tab.href;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                    active
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
          <button
            onClick={async () => {
              await fetch("/api/login", { method: "DELETE" });
              window.location.href = "/login";
            }}
            className="px-3 py-2 text-sm text-gray-600 hover:text-red-600"
          >
            로그아웃
          </button>
        </div>
      </div>
    </nav>
  );
}
