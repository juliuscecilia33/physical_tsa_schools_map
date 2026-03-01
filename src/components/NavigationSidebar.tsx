"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Map, Building2, LogOut } from "lucide-react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import type { User } from "@supabase/supabase-js";

export default function NavigationSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    await supabase.auth.signOut();
    router.push('/login');
  };

  const navItems = [
    {
      href: "/",
      icon: Map,
      label: "Map",
    },
    {
      href: "/crm",
      icon: Building2,
      label: "CRM",
    },
  ];

  // Don't show navigation on auth pages or when not authenticated
  if (pathname.startsWith('/login') || pathname.startsWith('/auth') || !user) {
    return null;
  }

  return (
    <motion.nav
      initial={{ x: -80 }}
      animate={{ x: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="fixed left-0 top-0 h-screen w-16 bg-gray-100 border-r border-gray-200 flex flex-col items-center z-50"
    >
      {/* Logo at top */}
      <div className="w-full py-6 px-2">
        <img
          src="/assets/TSA.png"
          alt="Texas Sports Academy"
          className="w-full h-auto"
        />
      </div>

      {/* Navigation icons - centered in remaining space */}
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                group relative p-3 rounded-lg transition-all duration-200
                ${
                  isActive
                    ? "bg-[#004aad] text-white"
                    : "text-gray-600 hover:bg-gray-200 hover:text-gray-900"
                }
              `}
              title={item.label}
            >
              <Icon size={24} strokeWidth={1.5} />

              {/* Tooltip on hover */}
              <span className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-gray-900 text-white text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>

      {/* User info and sign out at bottom */}
      <div className="w-full pb-4 px-2 flex flex-col items-center gap-3">
        {user && (
          <div className="group relative">
            <div className="w-10 h-10 rounded-full bg-[#004aad] flex items-center justify-center text-white font-semibold">
              {user.email?.[0].toUpperCase()}
            </div>
            {/* Tooltip on hover */}
            <span className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-gray-900 text-white text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
              {user.email}
            </span>
          </div>
        )}
        <button
          onClick={handleSignOut}
          disabled={isSigningOut}
          className="group relative p-3 rounded-lg text-gray-600 hover:bg-red-50 hover:text-red-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Sign Out"
        >
          <LogOut size={24} strokeWidth={1.5} />
          {/* Tooltip on hover */}
          <span className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-gray-900 text-white text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
            Sign Out
          </span>
        </button>
      </div>
    </motion.nav>
  );
}
