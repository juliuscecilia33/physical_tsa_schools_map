"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Map, Building2 } from "lucide-react";
import { motion } from "framer-motion";

export default function NavigationSidebar() {
  const pathname = usePathname();

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

  return (
    <motion.nav
      initial={{ x: -80 }}
      animate={{ x: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="fixed left-0 top-0 h-screen w-20 bg-gray-100 border-r border-gray-200 flex flex-col items-center justify-center gap-8 z-50"
    >
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
            <Icon size={32} strokeWidth={1.5} />

            {/* Tooltip on hover */}
            <span className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
              {item.label}
            </span>
          </Link>
        );
      })}
    </motion.nav>
  );
}
