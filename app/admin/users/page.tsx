"use client";

import React, { useEffect, useState } from "react";
import {
  Users,
  Search,
  Loader2,
  Calendar,
} from "lucide-react";
import { getAdminUsers } from "@/lib/supabase/admin";
import type { DbProfile } from "@/lib/supabase/types";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { AdminEmptyState } from "@/components/admin/admin-empty-state";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<DbProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "buyer" | "seller" | "admin">("all");

  useEffect(() => {
    let isMounted = true;
    async function init() {
      try {
        const data = await getAdminUsers();
        if (isMounted) {
          setUsers(data);
        }
      } catch (err) {
        console.error("Failed to load users:", err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }
    init();
    return () => {
      isMounted = false;
    };
  }, []);

  const filteredUsers = users.filter((u) => {
    const matchesRole = roleFilter === "all" || u.role === roleFilter;
    const nameMatch =
      (u.full_name && u.full_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (u.username && u.username.toLowerCase().includes(searchTerm.toLowerCase())) ||
      u.id.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesRole && nameMatch;
  });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Users Management"
        subtitle="View registered platform accounts across all roles (read-only)."
      />

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#342339]/40 p-4 rounded-2xl border border-white/10">
        <div className="relative w-full sm:w-80">
          <Search className="size-4 text-[#8f7d8c] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, username, or ID..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-black/30 border border-white/10 text-xs text-[#fffafa] placeholder-[#8f7d8c] outline-hidden focus:border-[#e59bc9]"
          />
        </div>

        <div className="flex items-center gap-1.5 self-start sm:self-auto bg-black/30 p-1 rounded-xl border border-white/5">
          {(["all", "buyer", "seller", "admin"] as const).map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => setRoleFilter(role)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all cursor-pointer ${
                roleFilter === role
                  ? "bg-[#65486f] text-white shadow-xs"
                  : "text-[#b9adb6] hover:text-white"
              }`}
            >
              {role}{" "}
              <span className="text-[10px] opacity-70">
                ({role === "all" ? users.length : users.filter((u) => u.role === role).length})
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-2xl bg-[#342339]/30 border border-white/10 overflow-hidden">
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3 text-[#b9adb6]">
            <Loader2 className="size-8 text-[#e59bc9] animate-spin" />
            <p className="text-xs">Loading user directory...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12">
            <AdminEmptyState
              icon={Users}
              title="No Users Found"
              description="No user accounts match your search and filter criteria."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#1e1322] border-b border-white/10 text-[#8f7d8c] uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className="p-4">User</th>
                  <th className="p-4">Account ID</th>
                  <th className="p-4">Role</th>
                  <th className="p-4">Registered Date</th>
                  <th className="p-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-[#fffafa]">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="size-8 rounded-xl bg-[#65486f]/50 border border-white/10 flex items-center justify-center text-[#e59bc9] font-bold text-xs shrink-0">
                          {(u.full_name || u.username || "U").charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-[#fffafa] truncate">
                            {u.full_name || "Unnamed User"}
                          </p>
                          <p className="text-[11px] text-[#8f7d8c] truncate">
                            @{u.username || "no-username"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 font-mono text-[11px] text-[#b9adb6]">
                      {u.id}
                    </td>
                    <td className="p-4">
                      <AdminStatusBadge type="role" status={u.role} />
                    </td>
                    <td className="p-4 text-[#b9adb6]">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="size-3 text-[#8f7d8c]" />
                        <span>
                          {u.created_at
                            ? new Date(u.created_at).toLocaleDateString()
                            : "N/A"}
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-500/20">
                        <span className="size-1.5 rounded-full bg-emerald-400" />
                        Active
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
