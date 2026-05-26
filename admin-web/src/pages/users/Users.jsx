import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  Filter, 
  RefreshCw, 
  Users as UsersIcon, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  ArrowUpDown, 
  UserCheck, 
  UserX, 
  Coins, 
  Wallet,
  Calendar,
  ShieldAlert,
  User,
  ExternalLink
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const StatCard = ({ title, value, icon: Icon, colorClass, loading }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2, scale: 1.01 }}
      className="relative overflow-hidden p-5 rounded-2xl bg-[var(--card-bg)] border border-[var(--border-soft)] shadow-soft transition-all duration-150"
    >
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">{title}</p>
          {loading ? (
            <div className="h-8 w-24 bg-[var(--bg-secondary)] animate-pulse rounded-lg mt-1" />
          ) : (
            <h3 className="text-2xl font-extrabold text-[var(--text-primary)] tracking-tight">{value}</h3>
          )}
        </div>
        <div className={`p-2.5 rounded-xl ${colorClass} flex items-center justify-center`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="absolute -bottom-6 -right-6 w-20 h-20 rounded-full bg-current opacity-[0.02] blur-xl pointer-events-none" />
    </motion.div>
  );
};

export const Users = () => {
  // Lists & stats state
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    inactiveUsers: 0,
    totalWalletBalance: 0
  });
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);

  // Pagination & Filtering
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [searchVal, setSearchVal] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("ALL");
  const [status, setStatus] = useState("all");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");

  // Selection & Modal states
  const [selectedUser, setSelectedUser] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [userToToggle, setUserToToggle] = useState(null);
  const [toggleLoading, setToggleLoading] = useState(false);

  // Debounced search effect
  useEffect(() => {
    const handler = setTimeout(() => {
      setSearch(searchVal);
      setPage(1);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchVal]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params = {
        page,
        limit,
        search,
        sortBy,
        sortOrder
      };
      if (role !== "ALL") params.role = role;
      if (status !== "all") params.status = status;

      const { data } = await api.get('/admin/users', { params });
      if (data && data.success) {
        setUsers(data.data.users);
        setTotalPages(data.data.pagination.totalPages);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      setStatsLoading(true);
      const { data } = await api.get('/admin/users/stats');
      if (data && data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page, limit, search, role, status, sortBy, sortOrder]);

  useEffect(() => {
    fetchStats();
  }, []);

  const handleRefreshAll = () => {
    fetchUsers();
    fetchStats();
    toast.success("Users data refreshed");
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setPage(1);
  };

  const handleOpenDetails = async (user) => {
    try {
      setSelectedUser(user);
      setIsDetailOpen(true);
      setDetailLoading(true);
      const { data } = await api.get(`/admin/users/${user.id}`);
      if (data && data.success) {
        setSelectedUser(data.data);
      }
    } catch (error) {
      console.error("Error fetching user details:", error);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleToggleStatusRequest = (user) => {
    setUserToToggle(user);
    setIsConfirmOpen(true);
  };

  const handleConfirmToggleStatus = async () => {
    if (!userToToggle) return;
    try {
      setToggleLoading(true);
      const targetState = !userToToggle.isActive;
      const { data } = await api.patch(`/admin/users/${userToToggle.id}/status`, {
        isActive: targetState
      });
      if (data && data.success) {
        toast.success(data.message || `User account updated successfully`);
        // Refresh local items
        setUsers(prev => prev.map(u => u.id === userToToggle.id ? { ...u, isActive: targetState } : u));
        if (selectedUser && selectedUser.id === userToToggle.id) {
          setSelectedUser(prev => ({ ...prev, isActive: targetState }));
        }
        // Reload global statistics
        fetchStats();
      }
    } catch (error) {
      console.error("Error toggling status:", error);
    } finally {
      setToggleLoading(false);
      setIsConfirmOpen(false);
      setUserToToggle(null);
    }
  };

  const handleClearFilters = () => {
    setSearchVal("");
    setRole("ALL");
    setStatus("all");
    setSortBy("createdAt");
    setSortOrder("desc");
    setPage(1);
    toast.success("Filters cleared");
  };

  const getInitials = (name) => {
    if (!name) return "U";
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.header 
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[var(--text-primary)] tracking-tight">
            Users <span className="text-[var(--color-primary)] font-extrabold">Management</span>
          </h1>
          <p className="text-xs text-[var(--text-secondary)] font-medium">Monitor credentials, wallet balances, and status guards</p>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={handleRefreshAll}
            className="p-2.5 bg-[var(--bg-secondary)] border border-[var(--border-soft)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-xl hover:bg-[var(--bg-tertiary)]/50 transition-all cursor-pointer flex items-center justify-center"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${(loading || statsLoading) ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </motion.header>

      {/* Analytics Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
        <StatCard 
          title="Total Users" 
          value={stats.totalUsers.toLocaleString()} 
          icon={UsersIcon}
          colorClass="text-blue-500 bg-blue-500/10 border border-blue-500/20"
          loading={statsLoading}
        />
        <StatCard 
          title="Active Users" 
          value={stats.activeUsers.toLocaleString()} 
          icon={CheckCircle2}
          colorClass="text-emerald-500 bg-emerald-500/10 border border-emerald-500/20"
          loading={statsLoading}
        />
        <StatCard 
          title="Inactive Users" 
          value={stats.inactiveUsers.toLocaleString()} 
          icon={AlertCircle}
          colorClass="text-rose-500 bg-rose-500/10 border border-rose-500/20"
          loading={statsLoading}
        />
        <StatCard 
          title="Total Wallet Balance" 
          value={`₹${stats.totalWalletBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} 
          icon={Wallet}
          colorClass="text-purple-500 bg-purple-500/10 border border-purple-500/20"
          loading={statsLoading}
        />
      </div>

      {/* Toolbar Filters */}
      <motion.div 
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-2xl shadow-soft space-y-4"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 text-[var(--text-secondary)] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="Search name, email, phone..."
                value={searchVal}
                onChange={(e) => setSearchVal(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl text-xs text-[var(--text-primary)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--admin-focus-ring)] outline-none transition-all placeholder:text-[var(--text-muted)]"
              />
              {searchVal && (
                <button 
                  onClick={() => setSearchVal("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-full transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Role dropdown */}
            <div className="relative">
              <select
                value={role}
                onChange={(e) => { setRole(e.target.value); setPage(1); }}
                className="w-full px-3.5 py-2.5 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl text-xs text-[var(--text-primary)] outline-none cursor-pointer focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--admin-focus-ring)] transition-all"
              >
                <option value="ALL">All Roles</option>
                <option value="USER">User</option>
                <option value="API_USER">API User</option>
                <option value="ADMIN">Admin</option>
                <option value="SUPER_ADMIN">Super Admin</option>
              </select>
            </div>

            {/* Status dropdown */}
            <div className="relative">
              <select
                value={status}
                onChange={(e) => { setStatus(e.target.value); setPage(1); }}
                className="w-full px-3.5 py-2.5 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl text-xs text-[var(--text-primary)] outline-none cursor-pointer focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--admin-focus-ring)] transition-all"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Accounts</option>
                <option value="inactive">Deactivated Accounts</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 lg:self-stretch">
            {(searchVal || role !== "ALL" || status !== "all" || sortBy !== "createdAt" || sortOrder !== "desc") && (
              <button
                onClick={handleClearFilters}
                className="w-full lg:w-auto px-4 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border-soft)] hover:bg-[var(--bg-tertiary)]/75 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-xl text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Users Data Table */}
      <motion.div 
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-2xl shadow-soft overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[var(--bg-secondary)]/50 border-b border-[var(--border-soft)] text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4 cursor-pointer hover:text-[var(--text-primary)] transition-colors" onClick={() => handleSort('phone')}>
                  <div className="flex items-center gap-1.5">
                    Phone
                    <ArrowUpDown className="w-3 h-3 text-[var(--text-muted)]" />
                  </div>
                </th>
                <th className="px-6 py-4 cursor-pointer hover:text-[var(--text-primary)] transition-colors text-right" onClick={() => handleSort('balance')}>
                  <div className="flex items-center justify-end gap-1.5">
                    Wallet Balance
                    <ArrowUpDown className="w-3 h-3 text-[var(--text-muted)]" />
                  </div>
                </th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 cursor-pointer hover:text-[var(--text-primary)] transition-colors text-right" onClick={() => handleSort('createdAt')}>
                  <div className="flex items-center justify-end gap-1.5">
                    Joined Date
                    <ArrowUpDown className="w-3 h-3 text-[var(--text-muted)]" />
                  </div>
                </th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-soft)] text-xs">
              {loading ? (
                Array.from({ length: limit }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[var(--bg-secondary)]" />
                        <div className="space-y-1.5">
                          <div className="h-3 w-28 bg-[var(--bg-secondary)] rounded" />
                          <div className="h-2 w-36 bg-[var(--bg-secondary)] rounded" />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4"><div className="h-3 w-20 bg-[var(--bg-secondary)] rounded" /></td>
                    <td className="px-6 py-4 text-right"><div className="h-3 w-16 bg-[var(--bg-secondary)] rounded ml-auto" /></td>
                    <td className="px-6 py-4"><div className="h-4.5 w-16 bg-[var(--bg-secondary)] rounded-md" /></td>
                    <td className="px-6 py-4 text-center"><div className="h-4.5 w-12 bg-[var(--bg-secondary)] rounded-md mx-auto" /></td>
                    <td className="px-6 py-4 text-right"><div className="h-3 w-16 bg-[var(--bg-secondary)] rounded ml-auto" /></td>
                    <td className="px-6 py-4 text-right"><div className="h-6 w-12 bg-[var(--bg-secondary)] rounded ml-auto" /></td>
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-16 text-center text-[var(--text-secondary)] font-medium">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <UsersIcon className="w-8 h-8 text-[var(--text-muted)] opacity-50" />
                      <p className="font-semibold text-sm">No users match your criteria</p>
                      <p className="text-xs text-[var(--text-muted)]">Try adjusting your keyword search or filters</p>
                    </div>
                  </td>
                </tr>
              ) : (
                users.map(u => (
                  <tr key={u.id} className="hover:bg-[var(--admin-table-row-hover)] transition-colors group">
                    {/* User profile */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {u.profileImage ? (
                          <img 
                            src={u.profileImage} 
                            alt={u.name || "User Avatar"} 
                            className="w-9 h-9 rounded-full object-cover border border-[var(--border-soft)] shadow-sm"
                            onError={(e) => { e.target.src = ""; e.target.onerror = null; }}
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-[var(--color-primary-glow)] border border-[var(--border-soft)] flex items-center justify-center text-[var(--color-primary)] font-bold text-xs shadow-sm">
                            {getInitials(u.name)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-bold text-[var(--text-primary)] truncate max-w-[180px]">{u.name || "N/A"}</p>
                          <p className="text-[10px] text-[var(--text-secondary)] truncate max-w-[180px] font-medium">{u.email || "No email linked"}</p>
                        </div>
                      </div>
                    </td>

                    {/* Phone */}
                    <td className="px-6 py-4 font-semibold text-[var(--text-primary)]">
                      {u.phone ? `+91 ${u.phone.replace(/^\+91/, '')}` : 'N/A'}
                    </td>

                    {/* Wallet Balance */}
                    <td className="px-6 py-4 text-right font-extrabold text-[var(--text-primary)]">
                      ₹{u.wallet?.balance ? Number(u.wallet.balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}
                    </td>

                    {/* Role badge */}
                    <td className="px-6 py-4">
                      {(() => {
                        const roleColors = {
                          SUPER_ADMIN: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
                          ADMIN: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
                          API_USER: 'text-purple-500 bg-purple-500/10 border-purple-500/20',
                          USER: 'text-[var(--text-secondary)] bg-[var(--bg-secondary)] border-[var(--border-soft)]'
                        };
                        return (
                          <span className={`px-2.5 py-0.5 text-[9px] font-black rounded uppercase border tracking-wider ${roleColors[u.role] || roleColors.USER}`}>
                            {u.role.replace('_', ' ')}
                          </span>
                        );
                      })()}
                    </td>

                    {/* Status badge */}
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[9px] font-black rounded uppercase border tracking-wider ${
                        u.isActive 
                          ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' 
                          : 'text-rose-500 bg-rose-500/10 border-rose-500/20'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${u.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>

                    {/* Joined date */}
                    <td className="px-6 py-4 text-right text-[var(--text-secondary)] font-medium">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button 
                          onClick={() => handleOpenDetails(u)}
                          className="p-1.5 bg-[var(--bg-secondary)] border border-[var(--border-soft)] hover:bg-[var(--bg-tertiary)]/50 text-[var(--text-secondary)] hover:text-[var(--color-primary)] rounded-xl transition-all cursor-pointer flex items-center justify-center"
                          title="View Profile Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        
                        {/* Only show activation toggle if not their own account and not a super admin */}
                        {u.role !== 'SUPER_ADMIN' ? (
                          <button
                            onClick={() => handleToggleStatusRequest(u)}
                            className={`p-1.5 border rounded-xl transition-all cursor-pointer flex items-center justify-center ${
                              u.isActive
                                ? 'bg-rose-500/5 border-rose-500/15 text-rose-500 hover:bg-rose-500/10 hover:text-rose-600'
                                : 'bg-emerald-500/5 border-emerald-500/15 text-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-600'
                            }`}
                            title={u.isActive ? "Deactivate Account" : "Activate Account"}
                          >
                            {u.isActive ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                          </button>
                        ) : (
                          <div className="w-8 h-8 flex items-center justify-center text-[var(--text-muted)] opacity-30 cursor-not-allowed">
                            <UserCheck className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Footer */}
        <div className="p-4 border-t border-[var(--border-soft)] flex flex-col sm:flex-row gap-4 justify-between items-center text-xs font-semibold text-[var(--text-secondary)] bg-[var(--bg-secondary)]/30">
          <div className="flex items-center gap-2">
            <span>Show</span>
            <select
              value={limit}
              onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
              className="px-2 py-1 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-lg text-xs text-[var(--text-primary)] cursor-pointer outline-none focus:border-[var(--color-primary)]"
            >
              <option value={10}>10 entries</option>
              <option value={20}>20 entries</option>
              <option value={50}>50 entries</option>
            </select>
            {!loading && <span>of {stats.totalUsers} users</span>}
          </div>
          
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-[var(--text-secondary)]">Page {page} of {totalPages || 1}</span>
            <div className="flex gap-1.5">
              <button 
                onClick={() => setPage(p => Math.max(p - 1, 1))}
                disabled={page === 1 || loading}
                className="p-1.5 border border-[var(--border-soft)] rounded-lg bg-[var(--card-bg)] hover:bg-[var(--accent-hover)] text-[var(--text-primary)] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setPage(p => Math.min(p + 1, totalPages))}
                disabled={page === totalPages || loading}
                className="p-1.5 border border-[var(--border-soft)] rounded-lg bg-[var(--card-bg)] hover:bg-[var(--accent-hover)] text-[var(--text-primary)] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* User Details Side Modal / Drawer */}
      <AnimatePresence>
        {isDetailOpen && selectedUser && (
          <div className="fixed inset-0 z-[100] flex items-center justify-end">
            {/* Overlay */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDetailOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-xs"
            />
            
            {/* Drawer */}
            <motion.div 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="relative w-full max-w-lg h-full bg-[var(--card-bg)] border-l border-[var(--border-soft)] shadow-2xl flex flex-col z-10"
            >
              {/* Header */}
              <div className="px-6 py-5 border-b border-[var(--border-soft)] flex justify-between items-center bg-[var(--bg-secondary)]/30">
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-tight">User Detailed Context</h3>
                  <p className="text-[10px] text-[var(--text-secondary)] font-medium">Internal administrative database profile</p>
                </div>
                <button 
                  onClick={() => setIsDetailOpen(false)}
                  className="p-1.5 hover:bg-[var(--bg-secondary)] rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {detailLoading ? (
                  <div className="space-y-6 animate-pulse">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-[var(--bg-secondary)]" />
                      <div className="space-y-2">
                        <div className="h-4 w-36 bg-[var(--bg-secondary)] rounded" />
                        <div className="h-3 w-48 bg-[var(--bg-secondary)] rounded" />
                      </div>
                    </div>
                    <div className="h-28 w-full bg-[var(--bg-secondary)] rounded-xl" />
                    <div className="h-36 w-full bg-[var(--bg-secondary)] rounded-xl" />
                  </div>
                ) : (
                  <>
                    {/* Identity Overview */}
                    <div className="flex items-center gap-4 bg-[var(--bg-secondary)]/20 p-4 rounded-2xl border border-[var(--border-soft)]">
                      {selectedUser.profileImage ? (
                        <img 
                          src={selectedUser.profileImage} 
                          alt={selectedUser.name} 
                          className="w-16 h-16 rounded-full object-cover border border-[var(--border-soft)] shadow-sm"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-[var(--color-primary-glow)] border border-[var(--border-soft)] flex items-center justify-center text-[var(--color-primary)] font-black text-lg shadow-sm">
                          {getInitials(selectedUser.name)}
                        </div>
                      )}
                      <div>
                        <h4 className="text-base font-black text-[var(--text-primary)]">{selectedUser.name || "N/A"}</h4>
                        <p className="text-xs text-[var(--text-secondary)] font-medium mt-0.5">{selectedUser.email || "No email address linked"}</p>
                        
                        <div className="flex gap-2 mt-2">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-[9px] font-black rounded uppercase border tracking-wider ${
                            selectedUser.isActive 
                              ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' 
                              : 'text-rose-500 bg-rose-500/10 border-rose-500/20'
                          }`}>
                            {selectedUser.isActive ? 'Active' : 'Inactive'}
                          </span>
                          <span className="px-2 py-0.5 text-[9px] font-black rounded bg-[var(--bg-secondary)] border border-[var(--border-soft)] text-[var(--text-secondary)] uppercase tracking-wider">
                            ID: {selectedUser.id}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Quick Metadata */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-[var(--bg-secondary)]/15 border border-[var(--border-soft)] rounded-xl">
                        <span className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block mb-1">Phone Number</span>
                        <p className="text-xs font-bold text-[var(--text-primary)]">{selectedUser.phone ? `+91 ${selectedUser.phone.replace(/^\+91/, '')}` : 'N/A'}</p>
                      </div>
                      <div className="p-4 bg-[var(--bg-secondary)]/15 border border-[var(--border-soft)] rounded-xl">
                        <span className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block mb-1">Membership Tier</span>
                        <p className="text-xs font-bold text-[var(--text-primary)]">{selectedUser.tier || 'Standard'}</p>
                      </div>
                    </div>

                    {/* Wallet Balances Card */}
                    <div className="bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-2xl overflow-hidden shadow-soft">
                      <div className="px-4 py-3 bg-[var(--bg-secondary)]/40 border-b border-[var(--border-soft)] flex items-center justify-between">
                        <h5 className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-wider">Accounts Balance</h5>
                        <Wallet className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                      </div>
                      <div className="p-4 space-y-3.5">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-[var(--text-secondary)] font-medium">Main Wallet Balance</span>
                          <span className="text-sm font-extrabold text-[var(--text-primary)]">₹{selectedUser.wallet?.balance ? Number(selectedUser.wallet.balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2.5 border-t border-[var(--border-soft)]">
                          <span className="text-xs text-[var(--text-secondary)] font-medium">Cashback Balance</span>
                          <span className="text-xs font-bold text-emerald-500">₹{selectedUser.wallet?.cashbackBalance ? Number(selectedUser.wallet.cashbackBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2.5 border-t border-[var(--border-soft)]">
                          <span className="text-xs text-[var(--text-secondary)] font-medium">Dizipay Coins Balance</span>
                          <span className="text-xs font-bold text-purple-500 flex items-center gap-1">
                            <Coins className="w-3.5 h-3.5" />
                            {selectedUser.wallet?.coinBalance ? selectedUser.wallet.coinBalance.toLocaleString() : "0"} Coins
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Activity Statistics */}
                    <div className="bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-2xl overflow-hidden shadow-soft">
                      <div className="px-4 py-3 bg-[var(--bg-secondary)]/40 border-b border-[var(--border-soft)] flex items-center justify-between">
                        <h5 className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-wider">Telemetry Telemetry</h5>
                        <Calendar className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                      </div>
                      <div className="p-4 space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-[var(--text-secondary)] font-medium">Total Transactions Count</span>
                          <span className="text-xs font-black text-[var(--text-primary)] bg-[var(--bg-secondary)] px-2 py-0.5 rounded border border-[var(--border-soft)]">{selectedUser._count?.transaction || 0}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2.5 border-t border-[var(--border-soft)]">
                          <span className="text-xs text-[var(--text-secondary)] font-medium">Total Orders Placed (iMart)</span>
                          <span className="text-xs font-black text-[var(--text-primary)] bg-[var(--bg-secondary)] px-2 py-0.5 rounded border border-[var(--border-soft)]">{selectedUser._count?.orders || 0}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2.5 border-t border-[var(--border-soft)]">
                          <span className="text-xs text-[var(--text-secondary)] font-medium">Registration Timestamp</span>
                          <span className="text-xs font-bold text-[var(--text-primary)]">{selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleString() : 'N/A'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Referral program */}
                    <div className="bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-2xl overflow-hidden shadow-soft">
                      <div className="px-4 py-3 bg-[var(--bg-secondary)]/40 border-b border-[var(--border-soft)] flex items-center justify-between">
                        <h5 className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-wider">Referral Program Context</h5>
                        <ExternalLink className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                      </div>
                      <div className="p-4 space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-[var(--text-secondary)] font-medium">Referral Code</span>
                          <span className="text-xs font-mono font-black text-[var(--color-primary)] bg-[var(--color-primary-glow)] px-2 py-0.5 rounded border border-[var(--border-soft)]">{selectedUser.referralCode || "N/A"}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2.5 border-t border-[var(--border-soft)]">
                          <span className="text-xs text-[var(--text-secondary)] font-medium">Referred By User ID</span>
                          <span className="text-xs font-bold text-[var(--text-primary)]">{selectedUser.referredBy || "Direct Join (None)"}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2.5 border-t border-[var(--border-soft)]">
                          <span className="text-xs text-[var(--text-secondary)] font-medium">Accumulated Earnings</span>
                          <span className="text-xs font-extrabold text-emerald-500">₹{selectedUser.referralEarnings ? Number(selectedUser.referralEarnings).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}</span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Action footer */}
              {selectedUser && !detailLoading && (
                <div className="p-4 border-t border-[var(--border-soft)] bg-[var(--bg-secondary)]/10 flex gap-2.5">
                  {selectedUser.role !== 'SUPER_ADMIN' ? (
                    <button 
                      onClick={() => handleToggleStatusRequest(selectedUser)}
                      className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider rounded-xl border transition-all cursor-pointer flex items-center justify-center gap-2 ${
                        selectedUser.isActive
                          ? 'bg-rose-600 text-white border-rose-700 hover:bg-rose-700'
                          : 'bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700'
                      }`}
                    >
                      {selectedUser.isActive ? (
                        <>
                          <UserX className="w-4 h-4" /> Deactivate Account
                        </>
                      ) : (
                        <>
                          <UserCheck className="w-4 h-4" /> Activate Account
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="flex-1 py-3 bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-xl text-center text-xs font-semibold text-[var(--text-muted)] flex items-center justify-center gap-2">
                      <UserCheck className="w-4 h-4 opacity-50" /> Super Admin Status Guard Enabled
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {isConfirmOpen && userToToggle && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            {/* Overlay */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsConfirmOpen(false)}
              className="absolute inset-0 bg-slate-900/60"
            />
            
            {/* Modal */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ duration: 0.15 }}
              className="relative w-full max-w-md bg-[var(--card-bg)] text-[var(--text-primary)] rounded-2xl shadow-2xl overflow-hidden border border-[var(--border-soft)] z-10"
            >
              <div className="p-6">
                <div className="flex items-center gap-3.5 text-rose-500 mb-4">
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center justify-center">
                    <ShieldAlert className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[var(--text-primary)] uppercase tracking-tight">Confirm Deactivation</h3>
                    <p className="text-[10px] text-[var(--text-secondary)] font-medium">Security Guard Warning</p>
                  </div>
                </div>

                <p className="text-xs text-[var(--text-secondary)] font-medium leading-relaxed mb-6">
                  {userToToggle.isActive ? (
                    <>Are you sure you want to deactivate <span className="font-extrabold text-[var(--text-primary)]">{userToToggle.name || "this user"}</span>? They will immediately lose access to their account and all active sessions will be terminated.</>
                  ) : (
                    <>Are you sure you want to reactivate <span className="font-extrabold text-[var(--text-primary)]">{userToToggle.name || "this user"}</span>? This will restore their access to the system immediately.</>
                  )}
                </p>

                <div className="flex gap-2.5">
                  <button 
                    onClick={() => setIsConfirmOpen(false)}
                    className="flex-1 py-2.5 border border-[var(--border-soft)] hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-xl text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center"
                    disabled={toggleLoading}
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleConfirmToggleStatus}
                    className={`flex-1 py-2.5 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      userToToggle.isActive
                        ? 'bg-rose-600 border-rose-700 hover:bg-rose-700'
                        : 'bg-emerald-600 border-emerald-700 hover:bg-emerald-700'
                    }`}
                    disabled={toggleLoading}
                  >
                    {toggleLoading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : userToToggle.isActive ? (
                      "Deactivate"
                    ) : (
                      "Reactivate"
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Users;
