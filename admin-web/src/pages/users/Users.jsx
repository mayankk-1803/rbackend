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
  ExternalLink,
  Key,
  Mail,
  MessageSquare,
  Clipboard,
  MapPin,
  Briefcase,
  FileText,
  Clock,
  Shield,
  Settings,
  Send,
  Plus,
  Compass,
  CheckCircle,
  FileCheck
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

export const enterpriseFeatures = {
  bulkBroadcast: false,
};

export const Users = () => {
  const pendingUpdatesRef = useRef({});
  // Navigation Workspaces Selection
  const [activeWorkspace, setActiveWorkspace] = useState("directory");

  useEffect(() => {
    if (activeWorkspace === "bulk" && !enterpriseFeatures.bulkBroadcast) {
      setActiveWorkspace("directory");
    }
  }, [activeWorkspace]);

  // Global lists & stats state (Directory)
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    inactiveUsers: 0,
    totalWalletBalance: 0
  });
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);

  // Pagination & Filtering (Directory)
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [searchVal, setSearchVal] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("ALL");
  const [status, setStatus] = useState("all");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");

  // Selection & Modal states (Directory)
  const [selectedUser, setSelectedUser] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [userToToggle, setUserToToggle] = useState(null);
  const [toggleLoading, setToggleLoading] = useState(false);

  // Temporary Password states (Directory)
  const [isTempPassConfirmOpen, setIsTempPassConfirmOpen] = useState(false);
  const [userForTempPass, setUserForTempPass] = useState(null);
  const [tempPassLoading, setTempPassLoading] = useState(false);

  // ==========================================
  // Workspace-Specific States & Data Loading
  // ==========================================

  // 2. Customer Care Workspace
  const [careQueue, setCareQueue] = useState([]);
  const [careUsers, setCareUsers] = useState([]);
  const [careMetrics, setCareMetrics] = useState({});
  const [careLoading, setCareLoading] = useState(false);

  // 3. Outlet Registry Workspace
  const [outlets, setOutlets] = useState([]);
  const [outletLoading, setOutletLoading] = useState(false);
  const [outletSearch, setOutletSearch] = useState("");
  const [outletStatusFilter, setOutletStatusFilter] = useState("all");

  // 4. Partner Management Workspace
  const [partners, setPartners] = useState([]);
  const [partnerLoading, setPartnerLoading] = useState(false);
  const [manageableUsers, setManageableUsers] = useState([]);
  const [manageableUsersLoading, setManageableUsersLoading] = useState(false);
  const [isConvertPartnerOpen, setIsConvertPartnerOpen] = useState(false);
  const [selectedUserIdForPartner, setSelectedUserIdForPartner] = useState("");
  const [userPartnerSearchQuery, setUserPartnerSearchQuery] = useState("");
  const [partnerRateLimit, setPartnerRateLimit] = useState(100);
  const [partnerEnvironment, setPartnerEnvironment] = useState("PRODUCTION");
  const [convertPartnerLoading, setConvertPartnerLoading] = useState(false);
  const [generatedCredentials, setGeneratedCredentials] = useState(null);
  const [isCredentialsOpen, setIsCredentialsOpen] = useState(false);
  const [isUsageLogOpen, setIsUsageLogOpen] = useState(false);
  const [selectedPartnerForUsage, setSelectedPartnerForUsage] = useState(null);
  const [partnerUsages, setPartnerUsages] = useState([]);
  const [partnerUsagesLoading, setPartnerUsagesLoading] = useState(false);
  const [isRateLimitOpen, setIsRateLimitOpen] = useState(false);
  const [selectedPartnerForRateLimit, setSelectedPartnerForRateLimit] = useState(null);
  const [rateLimitFormVal, setRateLimitFormVal] = useState(100);
  const [rateLimitLoading, setRateLimitLoading] = useState(false);

  // 5. FOS Management Workspace
  const [fosAgents, setFosAgents] = useState([]);
  const [fosLoading, setFosLoading] = useState(false);
  const [selectedFosId, setSelectedFosId] = useState("");
  const [retailerSearch, setRetailerSearch] = useState("");

  // 6. Agreements Workspace
  const [agreements, setAgreements] = useState([]);
  const [agreementLoading, setAgreementLoading] = useState(false);
  const [activeAgreementReview, setActiveAgreementReview] = useState(null);
  const [agreementRemarks, setAgreementRemarks] = useState("");
  const [isCreateAgreementOpen, setIsCreateAgreementOpen] = useState(false);
  const [agreementForm, setAgreementForm] = useState({ userId: "", title: "", content: "" });
  const [userAgreementSearchQuery, setUserAgreementSearchQuery] = useState("");
  const [createAgreementLoading, setCreateAgreementLoading] = useState(false);
  const [isEditAgreementOpen, setIsEditAgreementOpen] = useState(false);
  const [selectedEditAgreement, setSelectedEditAgreement] = useState(null);
  const [editAgreementForm, setEditAgreementForm] = useState({ title: "", content: "" });
  const [editAgreementLoading, setEditAgreementLoading] = useState(false);

  // 7. Employee Management Workspace
  const [employees, setEmployees] = useState([]);
  const [employeeLoading, setEmployeeLoading] = useState(false);
  const [newEmployee, setNewEmployee] = useState({ name: "", email: "", phone: "", role: "STAFF" });

  // 8. Attendance Logs Workspace
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);

  // 9. Meetings Workspace
  const [meetings, setMeetings] = useState([]);
  const [meetingLoading, setMeetingLoading] = useState(false);
  const [newMeeting, setNewMeeting] = useState({ title: "", description: "", startTime: "", endTime: "", location: "", attendeeIds: [] });

  // 10. Bulk Operations Workspace
  const [bulkAction, setBulkAction] = useState({
    actionType: "activate",
    slabName: "Standard",
    amount: "",
    direction: "CREDIT",
    description: "",
    title: "",
    message: "",
    targetRole: "USER"
  });
  const [bulkSelectedUserIds, setBulkSelectedUserIds] = useState([]);
  const [bulkProgress, setBulkProgress] = useState(null);

  // 11. Audit Logs Workspace
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // 12. RBAC Permissions Workspace
  const [rbacMatrix, setRbacMatrix] = useState({});
  const [rbacLoading, setRbacLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // 13. Outlet Registration states
  const [isCreateOutletOpen, setIsCreateOutletOpen] = useState(false);
  const [usersWithoutOutlet, setUsersWithoutOutlet] = useState([]);
  const [usersWithoutOutletLoading, setUsersWithoutOutletLoading] = useState(false);
  const [selectedUserIdForOutlet, setSelectedUserIdForOutlet] = useState("");
  const [userOutletSearchQuery, setUserOutletSearchQuery] = useState("");
  const [outletForm, setOutletForm] = useState({
    name: "",
    ownerName: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    latitude: "",
    longitude: ""
  });
  const [createOutletLoading, setCreateOutletLoading] = useState(false);

  // New Outlet View and Edit States
  const [isViewOutletOpen, setIsViewOutletOpen] = useState(false);
  const [selectedViewOutlet, setSelectedViewOutlet] = useState(null);
  const [isEditOutletOpen, setIsEditOutletOpen] = useState(false);
  const [selectedEditOutlet, setSelectedEditOutlet] = useState(null);
  const [editOutletForm, setEditOutletForm] = useState({
    name: "",
    ownerName: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    latitude: "",
    longitude: ""
  });
  const [editOutletLoading, setEditOutletLoading] = useState(false);

  // Directory Search Debounce
  useEffect(() => {
    const handler = setTimeout(() => {
      setSearch(searchVal);
      setPage(1);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchVal]);

  // General Fetch Functions
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params = { page, limit, search, sortBy, sortOrder };
      if (role !== "ALL") params.role = role;
      if (status !== "all") params.status = status;

      const { data } = await api.get('/admin/users', { params });
      if (data && data.success) {
        setUsers(data.data.users || []);
        setTotalPages(data.data.pagination?.totalPages || 1);
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
    if (activeWorkspace === "directory") {
      fetchUsers();
    }
  }, [page, limit, search, role, status, sortBy, sortOrder, activeWorkspace]);

  useEffect(() => {
    fetchStats();
  }, []);

  // Workspace Dynamic Loaders
  useEffect(() => {
    if (activeWorkspace === "care") {
      loadCustomerCare();
    } else if (activeWorkspace === "outlets") {
      loadOutlets();
    } else if (activeWorkspace === "partners") {
      loadPartners();
    } else if (activeWorkspace === "fos") {
      loadFosData();
    } else if (activeWorkspace === "agreements") {
      loadAgreements();
    } else if (activeWorkspace === "employees") {
      loadEmployees();
    } else if (activeWorkspace === "attendance") {
      loadAttendance();
    } else if (activeWorkspace === "meetings") {
      loadMeetings();
    } else if (activeWorkspace === "audits") {
      loadAudits();
    } else if (activeWorkspace === "rbac") {
      loadRbac();
    }
  }, [activeWorkspace]);

  // 2. Customer Care Queue API Loader
  const loadCustomerCare = async () => {
    try {
      setCareLoading(true);
      const { data } = await api.get('/admin/enterprise/users/care');
      if (data && data.success) {
        setCareQueue(data.data.activeTickets || []);
        setCareUsers(data.data.supportUsers || []);
        setCareMetrics(data.data.departmentMetrics || {});
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load customer care queue");
    } finally {
      setCareLoading(false);
    }
  };

  // 3. Outlet Registry API Loader
  const loadOutlets = async () => {
    try {
      setOutletLoading(true);
      const params = {};
      if (outletSearch) params.search = outletSearch;
      if (outletStatusFilter !== "all") params.status = outletStatusFilter;
      const { data } = await api.get('/admin/enterprise/outlets', { params });
      if (data && data.success) {
        setOutlets(data.data || []);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load outlet registry");
    } finally {
      setOutletLoading(false);
    }
  };

  const handleUpdateOutletStatus = async (id, newStatus) => {
    try {
      const { data } = await api.patch(`/admin/enterprise/outlets/${id}/status`, { status: newStatus });
      if (data && data.success) {
        toast.success(`Outlet status updated to ${newStatus}`);
        loadOutlets();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update outlet status");
    }
  };

  const loadUsersWithoutOutlet = async () => {
    try {
      setUsersWithoutOutletLoading(true);
      const { data } = await api.get('/admin/enterprise/users-no-outlet');
      if (data && data.success) {
        setUsersWithoutOutlet(data.data || []);
      }
    } catch (err) {
      console.error("Failed to load users without outlet:", err);
      toast.error("Failed to fetch onboarding merchants list");
    } finally {
      setUsersWithoutOutletLoading(false);
    }
  };

  const handleCreateOutlet = async (e) => {
    e.preventDefault();
    if (!selectedUserIdForOutlet) {
      return toast.error("Please select a linked merchant user");
    }
    if (!outletForm.name || !outletForm.ownerName || !outletForm.address || !outletForm.city || !outletForm.state || !outletForm.pincode) {
      return toast.error("Please fill in all required fields");
    }

    try {
      setCreateOutletLoading(true);
      const { data } = await api.post('/admin/enterprise/outlets', {
        userId: Number(selectedUserIdForOutlet),
        ...outletForm
      });
      if (data && data.success) {
        toast.success("Outlet registered successfully!");
        setIsCreateOutletOpen(false);
        setOutletForm({
          name: "",
          ownerName: "",
          address: "",
          city: "",
          state: "",
          pincode: "",
          latitude: "",
          longitude: ""
        });
        setSelectedUserIdForOutlet("");
        setUserOutletSearchQuery("");
        loadOutlets();
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to register outlet");
    } finally {
      setCreateOutletLoading(false);
    }
  };

  const handleEditOutlet = async (e) => {
    e.preventDefault();
    if (!selectedEditOutlet) return;
    if (!editOutletForm.name || !editOutletForm.ownerName || !editOutletForm.address || !editOutletForm.city || !editOutletForm.state || !editOutletForm.pincode) {
      return toast.error("Please fill in all required fields");
    }

    try {
      setEditOutletLoading(true);
      const { data } = await api.put(`/admin/enterprise/outlets/${selectedEditOutlet.id}`, editOutletForm);
      if (data && data.success) {
        toast.success("Outlet details updated successfully!");
        setIsEditOutletOpen(false);
        setSelectedEditOutlet(null);
        setEditOutletForm({
          name: "",
          ownerName: "",
          address: "",
          city: "",
          state: "",
          pincode: "",
          latitude: "",
          longitude: ""
        });
        loadOutlets();
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to update outlet details");
    } finally {
      setEditOutletLoading(false);
    }
  };

  // 4. Partner Management API Loader
  const loadPartners = async () => {
    try {
      setPartnerLoading(true);
      const { data } = await api.get('/admin/enterprise/partners');
      if (data && data.success) {
        setPartners(data.data || []);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load partner accounts");
    } finally {
      setPartnerLoading(false);
    }
  };

  const loadManageableUsers = async () => {
    try {
      setManageableUsersLoading(true);
      const { data } = await api.get('/admin/enterprise/manageable-users');
      if (data && data.success) {
        setManageableUsers(data.data || []);
      }
    } catch (err) {
      console.error("Failed to load manageable users:", err);
      toast.error("Failed to fetch manageable users list");
    } finally {
      setManageableUsersLoading(false);
    }
  };

  const handleConvertPartner = async (e) => {
    e.preventDefault();
    if (!selectedUserIdForPartner) {
      return toast.error("Please select a linked user");
    }
    try {
      setConvertPartnerLoading(true);
      const { data } = await api.post('/admin/enterprise/partners/convert', {
        userId: Number(selectedUserIdForPartner),
        rateLimit: Number(partnerRateLimit),
        environment: partnerEnvironment
      });
      if (data && data.success) {
        toast.success("User promoted to API Partner successfully!");
        setGeneratedCredentials({
          apiKey: data.data.apiKey,
          apiSecret: data.data.apiSecret
        });
        setIsCredentialsOpen(true);
        setIsConvertPartnerOpen(false);
        setSelectedUserIdForPartner("");
        setUserPartnerSearchQuery("");
        setPartnerRateLimit(100);
        setPartnerEnvironment("PRODUCTION");
        loadPartners();
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to convert user to API Partner");
    } finally {
      setConvertPartnerLoading(false);
    }
  };

  const handleRotateSecret = async (partnerAccessId) => {
    if (!window.confirm("Are you sure you want to rotate this partner's API Secret? The current key will be invalidated immediately.")) {
      return;
    }
    const toastId = toast.loading("Rotating API Secret...");
    try {
      const { data } = await api.post(`/admin/enterprise/partners/${partnerAccessId}/rotate-secret`);
      if (data && data.success) {
        toast.success("API Secret rotated successfully!", { id: toastId });
        setGeneratedCredentials({
          apiKey: partnerAccessId,
          apiSecret: data.apiSecret
        });
        setIsCredentialsOpen(true);
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to rotate API Secret", { id: toastId });
    }
  };

  const handleTogglePartnerStatus = async (partnerAccessId, currentActive) => {
    const nextState = !currentActive;
    try {
      const { data } = await api.patch(`/admin/enterprise/partners/${partnerAccessId}/status`, { isActive: nextState });
      if (data && data.success) {
        toast.success(`API Partner status updated to ${nextState ? 'Active' : 'Suspended'}`);
        loadPartners();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to toggle status");
    }
  };

  const handleTogglePartnerEnvironment = async (partnerAccessId, currentEnv) => {
    const nextEnv = currentEnv === "PRODUCTION" ? "SANDBOX" : "PRODUCTION";
    try {
      const { data } = await api.patch(`/admin/enterprise/partners/${partnerAccessId}/environment`, { environment: nextEnv });
      if (data && data.success) {
        toast.success(`API Environment switched to ${nextEnv}`);
        loadPartners();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to toggle environment");
    }
  };

  const handleUpdateRateLimit = async (e) => {
    e.preventDefault();
    if (!selectedPartnerForRateLimit) return;
    try {
      setRateLimitLoading(true);
      const { data } = await api.patch(`/admin/enterprise/partners/${selectedPartnerForRateLimit.id}/rate-limit`, { rateLimit: Number(rateLimitFormVal) });
      if (data && data.success) {
        toast.success(`API Rate limit updated successfully`);
        setIsRateLimitOpen(false);
        setSelectedPartnerForRateLimit(null);
        loadPartners();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update rate limit");
    } finally {
      setRateLimitLoading(false);
    }
  };

  const loadPartnerUsage = async (partnerAccess) => {
    setSelectedPartnerForUsage(partnerAccess);
    setIsUsageLogOpen(true);
    try {
      setPartnerUsagesLoading(true);
      const { data } = await api.get(`/admin/enterprise/partners/${partnerAccess.id}/usage`);
      if (data && data.success) {
        setPartnerUsages(data.data || []);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load partner usage logs");
    } finally {
      setPartnerUsagesLoading(false);
    }
  };

  const handleRevokePartner = async (partnerAccessId) => {
    if (!window.confirm("DANGER: Are you sure you want to revoke API Partner privileges? This will demote the user back to USER and delete their credentials.")) {
      return;
    }
    const toastId = toast.loading("Revoking API Partner privileges...");
    try {
      const { data } = await api.post(`/admin/enterprise/partners/${partnerAccessId}/revoke`);
      if (data && data.success) {
        toast.success("API Partner privileges revoked successfully!", { id: toastId });
        loadPartners();
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to revoke API Partner", { id: toastId });
    }
  };

  // 5. FOS API Loader & Assigner
  const loadFosData = async () => {
    try {
      setFosLoading(true);
      const { data } = await api.get('/admin/enterprise/fos');
      if (data && data.success) {
        setFosAgents(data.data || []);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load FOS agent directory");
    } finally {
      setFosLoading(false);
    }
  };

  const handleAssignFosRetailers = async (action) => {
    if (!selectedFosId || bulkSelectedUserIds.length === 0) {
      return toast.error("Please select a FOS agent and at least one retailer");
    }
    try {
      const { data } = await api.post('/admin/enterprise/fos/assign', {
        fosAgentId: selectedFosId,
        retailerIds: bulkSelectedUserIds,
        action
      });
      if (data && data.success) {
        toast.success(`Retailers mapped successfully`);
        setBulkSelectedUserIds([]);
        loadFosData();
      }
    } catch (err) {
      toast.error("Failed to assign retailers");
    }
  };

  // 6. Agreements API Loader & Status sign-off
  const loadAgreements = async () => {
    try {
      setAgreementLoading(true);
      const { data } = await api.get('/admin/enterprise/agreements');
      if (data && data.success) {
        setAgreements(data.data || []);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load merchant agreements");
    } finally {
      setAgreementLoading(false);
    }
  };

  const handleSignAgreement = async (id, newStatus) => {
    try {
      const { data } = await api.patch(`/admin/enterprise/agreements/${id}/status`, {
        status: newStatus,
        remarks: agreementRemarks
      });
      if (data && data.success) {
        toast.success(`Agreement status updated to ${newStatus}`);
        setActiveAgreementReview(null);
        setAgreementRemarks("");
        loadAgreements();
      }
    } catch (err) {
      toast.error("Failed to update agreement review");
    }
  };

  const handleCreateAgreement = async (e) => {
    e.preventDefault();
    if (!agreementForm.userId || !agreementForm.title || !agreementForm.content) {
      return toast.error("Please fill in all required fields");
    }
    try {
      setCreateAgreementLoading(true);
      const { data } = await api.post('/admin/enterprise/agreements', {
        userId: Number(agreementForm.userId),
        title: agreementForm.title,
        content: agreementForm.content
      });
      if (data && data.success) {
        toast.success("Agreement created successfully!");
        setIsCreateAgreementOpen(false);
        setAgreementForm({ userId: "", title: "", content: "" });
        setUserAgreementSearchQuery("");
        loadAgreements();
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to create agreement");
    } finally {
      setCreateAgreementLoading(false);
    }
  };

  const handleUpdateAgreement = async (e) => {
    e.preventDefault();
    if (!selectedEditAgreement) return;
    if (!editAgreementForm.title || !editAgreementForm.content) {
      return toast.error("Please fill in all required fields");
    }
    try {
      setEditAgreementLoading(true);
      const { data } = await api.put(`/admin/enterprise/agreements/${selectedEditAgreement.id}`, editAgreementForm);
      if (data && data.success) {
        toast.success("Agreement updated successfully!");
        setIsEditAgreementOpen(false);
        setSelectedEditAgreement(null);
        setEditAgreementForm({ title: "", content: "" });
        loadAgreements();
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to update agreement");
    } finally {
      setEditAgreementLoading(false);
    }
  };

  const handleDeleteAgreement = async (id) => {
    if (!window.confirm("Are you sure you want to delete this agreement? This action is irreversible.")) {
      return;
    }
    const toastId = toast.loading("Deleting agreement...");
    try {
      const { data } = await api.delete(`/admin/enterprise/agreements/${id}`);
      if (data && data.success) {
        toast.success("Agreement deleted successfully!", { id: toastId });
        loadAgreements();
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to delete agreement", { id: toastId });
    }
  };

  // 7. Employees CRM API Loader & creation
  const loadEmployees = async () => {
    try {
      setEmployeeLoading(true);
      const { data } = await api.get('/admin/enterprise/employees');
      if (data && data.success) {
        setEmployees(data.data || []);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load workforce staff");
    } finally {
      setEmployeeLoading(false);
    }
  };

  const handleCreateEmployee = async (e) => {
    e.preventDefault();
    if (!newEmployee.name || !newEmployee.email) {
      return toast.error("Name and Email are required");
    }
    try {
      const { data } = await api.post('/admin/enterprise/employees', newEmployee);
      if (data && data.success) {
        toast.success("Workforce staff registered successfully!");
        setNewEmployee({ name: "", email: "", phone: "", role: "STAFF" });
        loadEmployees();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create employee");
    }
  };

  // 8. Attendance CRM API Loader & checkin checkouts
  const loadAttendance = async () => {
    try {
      setAttendanceLoading(true);
      const { data } = await api.get('/admin/enterprise/employees/attendance');
      if (data && data.success) {
        setAttendanceLogs(data.data || []);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load attendance logs");
    } finally {
      setAttendanceLoading(false);
    }
  };

  const handleSimulateCheckIn = async (empId) => {
    try {
      const { data } = await api.post('/admin/enterprise/employees/attendance/checkin', { employeeId: empId });
      if (data && data.success) {
        toast.success("Clock-in logged!");
        loadAttendance();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Check-in simulation failed");
    }
  };

  const handleSimulateCheckOut = async (empId) => {
    try {
      const { data } = await api.post('/admin/enterprise/employees/attendance/checkout', { employeeId: empId });
      if (data && data.success) {
        toast.success("Clock-out logged!");
        loadAttendance();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Check-out simulation failed");
    }
  };

  // 9. Meetings API Loader & creation
  const loadMeetings = async () => {
    try {
      setMeetingLoading(true);
      const { data } = await api.get('/admin/enterprise/employees/meetings');
      if (data && data.success) {
        setMeetings(data.data || []);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load meeting registry");
    } finally {
      setMeetingLoading(false);
    }
  };

  const handleCreateMeeting = async (e) => {
    e.preventDefault();
    if (!newMeeting.title || !newMeeting.startTime || !newMeeting.endTime) {
      return toast.error("Title, Start Time, and End Time are required");
    }
    try {
      const { data } = await api.post('/admin/enterprise/employees/meetings', newMeeting);
      if (data && data.success) {
        toast.success("Meeting scheduled successfully");
        setNewMeeting({ title: "", description: "", startTime: "", endTime: "", location: "", attendeeIds: [] });
        loadMeetings();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to schedule meeting");
    }
  };

  // 10. Bulk Broadcast Operations Safe Executer
  const handleTriggerBulkAction = async () => {
    if (bulkSelectedUserIds.length === 0) {
      return toast.error("Please select target users from the directory workspace first!");
    }
    try {
      setBulkProgress("executing");
      const { data } = await api.post('/admin/enterprise/users/bulk-action', {
        userIds: bulkSelectedUserIds,
        actionType: bulkAction.actionType,
        actionPayload: {
          slabName: bulkAction.slabName,
          amount: bulkAction.amount,
          direction: bulkAction.direction,
          description: bulkAction.description,
          title: bulkAction.title,
          message: bulkAction.message
        }
      });
      if (data && data.success) {
        toast.success(`Bulk command executed successfully!`);
        setBulkProgress({
          success: data.data.success,
          failed: data.data.failed
        });
        setBulkSelectedUserIds([]);
      }
    } catch (err) {
      toast.error("Bulk action failed");
      setBulkProgress(null);
    }
  };

  // 11. Security Audit Logs API Loader
  const loadAudits = async () => {
    try {
      setAuditLoading(true);
      const { data } = await api.get('/admin/enterprise/audit/logs');
      if (data && data.success) {
        setAuditLogs(data.data || []);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load administrative audit trails");
    } finally {
      setAuditLoading(false);
    }
  };

  // 12. RBAC Access permissions Loader & updater
  const loadRbac = async () => {
    try {
      setRbacLoading(true);
      const { data } = await api.get('/admin/enterprise/roles/permissions');
      if (data && data.success) {
        setRbacMatrix(data.data || {});
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load RBAC permissions list");
    } finally {
      setRbacLoading(false);
    }
  };

  const handleUpdateRbac = async (role, module, action, granted) => {
    // 1. Optimistic Update (visually update state immediately)
    const originalMatrix = JSON.parse(JSON.stringify(rbacMatrix)); // deep copy for rollback
    
    setRbacMatrix(prev => {
      const updated = { ...prev };
      if (updated[role] && updated[role][module]) {
        updated[role] = {
          ...updated[role],
          [module]: {
            ...updated[role][module],
            [action]: granted
          }
        };
      }
      return updated;
    });

    const key = `${role}-${module}-${action}`;
    
    // Clear existing timeout for this checkbox key (de-bounce rapid clicks)
    if (pendingUpdatesRef.current[key]) {
      clearTimeout(pendingUpdatesRef.current[key]);
    }

    setSaving(true);

    // Set a timeout to batch/debounce rapid click events
    pendingUpdatesRef.current[key] = setTimeout(async () => {
      const toastId = toast.loading(`Saving changes for ${role}...`);
      try {
        const { data } = await api.put('/admin/enterprise/rbac', {
          role, module, action, granted
        });
        if (data && data.success) {
          toast.success(`Access for ${role} on ${module} updated`, {
            id: toastId
          });
        } else {
          throw new Error(data.message || "Failed to update permission");
        }
      } catch (err) {
        console.error(err);
        // Rollback UI to original state if API fails
        setRbacMatrix(originalMatrix);
        toast.error("Rollback: Failed to update access matrix", {
          id: toastId
        });
      } finally {
        delete pendingUpdatesRef.current[key];
        setSaving(false);
      }
    }, 300); // 300ms debounce
  };

  // Helper Initials
  const getInitials = (name) => {
    if (!name) return "U";
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // User Directory Toggles
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
        setUsers(prev => prev.map(u => u.id === userToToggle.id ? { ...u, isActive: targetState } : u));
        if (selectedUser && selectedUser.id === userToToggle.id) {
          setSelectedUser(prev => ({ ...prev, isActive: targetState }));
        }
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

  const handleSendTempPasswordRequest = (user) => {
    setUserForTempPass(user);
    setIsTempPassConfirmOpen(true);
  };

  const handleConfirmSendTempPassword = async () => {
    if (!userForTempPass) return;
    try {
      setTempPassLoading(true);
      const { data } = await api.patch(`/admin/users/${userForTempPass.id}/send-temp-password`);
      if (data && data.success) {
        toast.success(data.message || "Temporary password sent successfully on WhatsApp.");
      }
    } catch (error) {
      console.error("Error sending temporary password:", error);
      toast.error(error.response?.data?.message || "Failed to send temporary password");
    } finally {
      setTempPassLoading(false);
      setIsTempPassConfirmOpen(false);
      setUserForTempPass(null);
    }
  };

  // Multi-Select handlers for bulk tools
  const handleToggleUserSelection = (userId) => {
    setBulkSelectedUserIds(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleSelectAllUsers = () => {
    if (bulkSelectedUserIds.length === users.length) {
      setBulkSelectedUserIds([]);
    } else {
      setBulkSelectedUserIds(users.map(u => u.id));
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 min-h-[calc(100vh-120px)]">
      {/*Collapsible Left Workspace Sub-Sidebar */}
      <div className="w-full lg:w-64 flex-shrink-0">
        <div className="sticky top-6 p-4 rounded-2xl bg-[var(--card-bg)] border border-[var(--border-soft)] shadow-soft space-y-4">
          <div className="px-2">
            <h2 className="text-xs font-black text-[var(--text-secondary)] uppercase tracking-wider">Operations Hub</h2>
            <p className="text-[10px] text-[var(--text-muted)] font-medium">Switch workspaces</p>
          </div>

          <nav className="flex flex-row lg:flex-col overflow-x-auto lg:overflow-visible gap-1.5 pb-2 lg:pb-0 scrollbar-thin">
            {[
              { id: "directory", label: "User Directory", icon: UsersIcon },
              { id: "care", label: "Customer Care", icon: MessageSquare },
              { id: "outlets", label: "Outlet Registry", icon: MapPin },
              { id: "partners", label: "Partner Manager", icon: Key },
              { id: "fos", label: "FOS Panel", icon: Compass },
              { id: "agreements", label: "Agreements Registry", icon: FileCheck },
              { id: "employees", label: "Workforce Directory", icon: Briefcase },
              { id: "attendance", label: "Attendance Logs", icon: Clock },
              { id: "meetings", label: "Meetings Scheduler", icon: Calendar },
              { id: "bulk", label: "Bulk Broadcast", icon: Send },
              { id: "audits", label: "Audit Trails", icon: Shield },
              { id: "rbac", label: "RBAC Controls", icon: Settings }
            ].filter(tab => {
              if (tab.id === "bulk") {
                return enterpriseFeatures.bulkBroadcast;
              }
              return true;
            }).map(tab => {
              const TabIcon = tab.icon;
              const isSelected = activeWorkspace === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveWorkspace(tab.id)}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap lg:whitespace-normal transition-all cursor-pointer w-full text-left ${
                    isSelected 
                      ? 'bg-[var(--color-primary-glow)] border border-[var(--border-soft)] text-[var(--color-primary)]' 
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] border border-transparent'
                  }`}
                >
                  <TabIcon className="w-4 h-4 flex-shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Right Content Panels */}
      <div className="flex-1 min-w-0">
        <AnimatePresence mode="wait">
          {activeWorkspace === "directory" && (
            <motion.div
              key="directory"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="space-y-6"
            >
              {/* Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h1 className="text-xl md:text-2xl font-black text-[var(--text-primary)] tracking-tight">
                    User <span className="text-[var(--color-primary)]">Directory Center</span>
                  </h1>
                  <p className="text-xs text-[var(--text-secondary)] font-medium">Verify balances, recovery methods, and configure active credentials</p>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => { fetchUsers(); fetchStats(); }}
                    className="p-2.5 bg-[var(--bg-secondary)] border border-[var(--border-soft)] text-[var(--text-secondary)] rounded-xl hover:text-[var(--text-primary)] flex items-center justify-center cursor-pointer"
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Statistics Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
                <StatCard title="Total Directory Users" value={stats.totalUsers.toLocaleString()} icon={UsersIcon} colorClass="text-blue-500 bg-blue-500/10" loading={statsLoading} />
                <StatCard title="Verified Users" value={stats.activeUsers.toLocaleString()} icon={CheckCircle2} colorClass="text-emerald-500 bg-emerald-500/10" loading={statsLoading} />
                <StatCard title="Suspended Users" value={stats.inactiveUsers.toLocaleString()} icon={AlertCircle} colorClass="text-rose-500 bg-rose-500/10" loading={statsLoading} />
                <StatCard title="Aggregated Deposits" value={`₹${stats.totalWalletBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} icon={Wallet} colorClass="text-purple-500 bg-purple-500/10" loading={statsLoading} />
              </div>

              {/* Filters Toolbar */}
              <div className="p-4 bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-2xl shadow-soft grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-[var(--text-secondary)] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input 
                    type="text" 
                    placeholder="Search name, email, phone..."
                    value={searchVal}
                    onChange={(e) => setSearchVal(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl text-xs text-[var(--text-primary)] outline-none"
                  />
                </div>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="px-3.5 py-2.5 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl text-xs text-[var(--text-primary)] cursor-pointer outline-none"
                >
                  <option value="ALL">All Roles</option>
                  <option value="USER">User</option>
                  <option value="API_USER">API User</option>
                  {(() => {
                    try {
                      const stored = sessionStorage.getItem("dizipay_admin_data");
                      if (stored) {
                        const parsed = JSON.parse(stored);
                        if (parsed?.role === "SUPER_ADMIN") {
                          return <option value="ADMIN">Admin</option>;
                        }
                      }
                    } catch (e) {
                      console.error(e);
                    }
                    return null;
                  })()}
                </select>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="px-3.5 py-2.5 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl text-xs text-[var(--text-primary)] cursor-pointer outline-none"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              {/* Directory User Table */}
              <div className="bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-2xl shadow-soft overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[var(--bg-secondary)]/50 border-b border-[var(--border-soft)] text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                        <th className="px-6 py-4 text-center"><input type="checkbox" onChange={handleSelectAllUsers} checked={bulkSelectedUserIds.length === users.length && users.length > 0} className="cursor-pointer" /></th>
                        <th className="px-6 py-4">User</th>
                        <th className="px-6 py-4">Phone</th>
                        <th className="px-6 py-4 text-right">Wallet Balance</th>
                        <th className="px-6 py-4">Role</th>
                        <th className="px-6 py-4 text-center">Status</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-soft)] text-xs">
                      {loading ? (
                        Array.from({ length: 5 }).map((_, idx) => (
                          <tr key={idx} className="animate-pulse">
                            <td colSpan="7" className="px-6 py-6 bg-[var(--bg-secondary)]/10"></td>
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
                          <tr key={u.id} className="hover:bg-[var(--admin-table-row-hover)] transition-colors">
                            <td className="px-6 py-4 text-center">
                              <input 
                                type="checkbox" 
                                checked={bulkSelectedUserIds.includes(u.id)} 
                                onChange={() => handleToggleUserSelection(u.id)}
                                className="cursor-pointer"
                              />
                            </td>
                            <td className="px-6 py-4 flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-[var(--color-primary-glow)] flex items-center justify-center text-[var(--color-primary)] font-bold shadow-sm">
                                {getInitials(u.name)}
                              </div>
                              <div>
                                <p className="font-bold text-[var(--text-primary)]">{u.name}</p>
                                <p className="text-[10px] text-[var(--text-secondary)]">{u.email}</p>
                              </div>
                            </td>
                            <td className="px-6 py-4 font-semibold">{u.phone || "N/A"}</td>
                            <td className="px-6 py-4 text-right font-extrabold">₹{Number(u.wallet?.balance || 0).toFixed(2)}</td>
                            <td className="px-6 py-4">
                              <span className="px-2 py-0.5 text-[9px] font-black rounded uppercase border border-blue-500/20 bg-blue-500/10 text-blue-500">
                                {u.role}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className={`px-2 py-0.5 text-[9px] font-black rounded uppercase border ${u.isActive ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border-rose-500/20'}`}>
                                {u.isActive ? "Active" : "Inactive"}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right flex justify-end gap-1.5">
                              <button onClick={() => { setSelectedUser(u); setIsDetailOpen(true); }} className="p-1.5 bg-[var(--bg-secondary)] border border-[var(--border-soft)] hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] rounded-xl cursor-pointer">
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              {u.authType === "email" && u.role !== "SUPER_ADMIN" && (
                                <button 
                                  onClick={() => handleSendTempPasswordRequest(u)} 
                                  title="Send Temp Password"
                                  className="p-1.5 bg-[var(--bg-secondary)] border border-[var(--border-soft)] hover:border-cyan-500/30 hover:bg-cyan-500/5 text-cyan-500 rounded-xl cursor-pointer"
                                >
                                  <Key className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {u.role !== "SUPER_ADMIN" && (
                                <button onClick={() => handleToggleStatusRequest(u)} className={`p-1.5 border rounded-xl cursor-pointer ${u.isActive ? 'border-rose-500/10 text-rose-500 bg-rose-500/5' : 'border-emerald-500/10 text-emerald-500 bg-emerald-500/5'}`}>
                                  {u.isActive ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Directory Pagination Footer */}
                <div className="p-4 border-t border-[var(--border-soft)] flex justify-between items-center text-xs bg-[var(--bg-secondary)]/30">
                  <span className="text-[var(--text-secondary)]">Showing {users.length} of {stats.totalUsers} users</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setPage(p => Math.max(p - 1, 1))} disabled={page === 1} className="p-1.5 border rounded-lg bg-[var(--card-bg)] cursor-pointer disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
                    <span className="text-[10px]">Page {page} of {totalPages}</span>
                    <button onClick={() => setPage(p => Math.min(p + 1, totalPages))} disabled={page === totalPages} className="p-1.5 border rounded-lg bg-[var(--card-bg)] cursor-pointer disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeWorkspace === "care" && (
            <motion.div
              key="care"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="space-y-6"
            >
              <div>
                <h1 className="text-xl md:text-2xl font-black text-[var(--text-primary)] tracking-tight">Customer Care Center</h1>
                <p className="text-xs text-[var(--text-secondary)] font-medium">Support queue tracking and live staff directory</p>
              </div>

              {/* Department metrics cards */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                {Object.entries(careMetrics).map(([dept, count]) => (
                  <div key={dept} className="p-4 rounded-2xl bg-[var(--card-bg)] border border-[var(--border-soft)] shadow-soft text-center space-y-1">
                    <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">{dept}</p>
                    <p className="text-xl font-extrabold text-[var(--text-primary)]">{count}</p>
                  </div>
                ))}
              </div>

              {/* Active Support Tickets */}
              <div className="bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-2xl shadow-soft overflow-hidden">
                <div className="px-5 py-4 border-b border-[var(--border-soft)]">
                  <h4 className="text-xs font-black text-[var(--text-primary)] uppercase tracking-wider">Active Operations Queue</h4>
                </div>
                <div className="divide-y divide-[var(--border-soft)]">
                  {careQueue.length === 0 ? (
                    <div className="p-12 text-center text-[var(--text-secondary)] font-medium flex flex-col items-center justify-center space-y-2">
                      <MessageSquare className="w-8 h-8 text-[var(--text-muted)] opacity-50" />
                      <p className="font-semibold text-sm">No support tickets in queue</p>
                      <p className="text-xs text-[var(--text-muted)]">All customer care departments are currently caught up</p>
                    </div>
                  ) : (
                    careQueue.map(ticket => (
                      <div key={ticket.id} className="p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-[var(--bg-secondary)]/10 transition-colors">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-[var(--color-primary)] bg-[var(--color-primary-glow)] px-2 py-0.5 rounded border border-[var(--border-soft)]">{ticket.id}</span>
                            <span className={`px-2 py-0.5 text-[8px] font-black rounded uppercase border ${ticket.priority === 'CRITICAL' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}>{ticket.priority}</span>
                            <span className="text-xs font-bold text-[var(--text-primary)]">{ticket.user}</span>
                          </div>
                          <p className="text-xs text-[var(--text-secondary)] font-medium">{ticket.issue}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-[var(--text-muted)]">{new Date(ticket.createdAt).toLocaleTimeString()}</span>
                          <span className="px-2.5 py-0.5 text-[9px] font-black bg-[var(--bg-secondary)] border border-[var(--border-soft)] text-[var(--text-secondary)] rounded-md uppercase">{ticket.status}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeWorkspace === "outlets" && (
            <motion.div
              key="outlets"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="space-y-6"
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h1 className="text-xl md:text-2xl font-black text-[var(--text-primary)] tracking-tight">Outlet Registry Manager</h1>
                  <p className="text-xs text-[var(--text-secondary)] font-medium">Review store details, geolocation parameters, and approve onboarding status</p>
                </div>
                <div className="flex items-center gap-2">
                  <input 
                    type="text" 
                    placeholder="Search stores..." 
                    value={outletSearch}
                    onChange={(e) => setOutletSearch(e.target.value)}
                    className="px-3.5 py-2.5 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl text-xs text-[var(--text-primary)] outline-none"
                  />
                  <button 
                    onClick={() => {
                      loadUsersWithoutOutlet();
                      setIsCreateOutletOpen(true);
                    }}
                    className="px-3.5 py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-white rounded-xl text-xs font-bold uppercase transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" /> Create Outlet
                  </button>
                  <button onClick={loadOutlets} className="p-2.5 bg-[var(--bg-secondary)] border border-[var(--border-soft)] text-[var(--text-secondary)] rounded-xl hover:text-[var(--text-primary)] flex items-center justify-center cursor-pointer">
                    <RefreshCw className={`w-4 h-4 ${outletLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Outlet List Table */}
              <div className="bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-2xl shadow-soft overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[var(--bg-secondary)]/50 border-b border-[var(--border-soft)] text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                        <th className="px-6 py-4">Outlet Name</th>
                        <th className="px-6 py-4">Owner</th>
                        <th className="px-6 py-4">Linked User</th>
                        <th className="px-6 py-4">Phone</th>
                        <th className="px-6 py-4">City</th>
                        <th className="px-6 py-4">State</th>
                        <th className="px-6 py-4 text-center">Status</th>
                        <th className="px-6 py-4 text-center">Created At</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-soft)] text-xs">
                      {outletLoading ? (
                        <tr><td colSpan="9" className="p-8 text-center">Loading registry...</td></tr>
                      ) : outlets.length === 0 ? (
                        <tr>
                          <td colSpan="9" className="p-12 text-center text-[var(--text-secondary)]">
                            <div className="flex flex-col items-center justify-center space-y-2">
                              <MapPin className="w-8 h-8 text-[var(--text-muted)] opacity-50" />
                              <p className="font-semibold text-sm">No outlets registered</p>
                              <p className="text-xs text-[var(--text-muted)]">Register store locations to track geographical merchant onboarding</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        outlets.map(o => (
                          <tr key={o.id} className="hover:bg-[var(--admin-table-row-hover)] transition-colors">
                            <td className="px-6 py-4 font-bold text-[var(--text-primary)]">{o.name}</td>
                            <td className="px-6 py-4 font-medium">{o.ownerName}</td>
                            <td className="px-6 py-4 font-semibold">{o.user?.name || o.user?.email || `User #${o.userId}`}</td>
                            <td className="px-6 py-4 font-mono font-semibold">{o.user?.phone || "N/A"}</td>
                            <td className="px-6 py-4">{o.city}</td>
                            <td className="px-6 py-4">{o.state}</td>
                            <td className="px-6 py-4 text-center">
                              <span className={`px-2.5 py-0.5 text-[9px] font-black rounded uppercase border tracking-wider ${o.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : (o.status === 'PENDING' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-rose-500/10 text-rose-500 border-rose-500/20')}`}>
                                {o.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center text-[10px] font-mono text-[var(--text-secondary)]">
                              {new Date(o.createdAt).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 text-right flex justify-end gap-1.5 items-center">
                              <button 
                                onClick={() => {
                                  setSelectedViewOutlet(o);
                                  setIsViewOutletOpen(true);
                                }}
                                title="View Details"
                                className="p-1.5 bg-[var(--bg-secondary)] border border-[var(--border-soft)] hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] rounded-xl cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button 
                                onClick={() => {
                                  setSelectedEditOutlet(o);
                                  setEditOutletForm({
                                    name: o.name,
                                    ownerName: o.ownerName,
                                    address: o.address,
                                    city: o.city,
                                    state: o.state,
                                    pincode: o.pincode,
                                    latitude: o.latitude !== null && o.latitude !== undefined ? String(o.latitude) : "",
                                    longitude: o.longitude !== null && o.longitude !== undefined ? String(o.longitude) : ""
                                  });
                                  setIsEditOutletOpen(true);
                                }}
                                title="Edit Details"
                                className="p-1.5 bg-[var(--bg-secondary)] border border-[var(--border-soft)] hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] rounded-xl cursor-pointer"
                              >
                                <Settings className="w-3.5 h-3.5" />
                              </button>
                              {o.status !== "APPROVED" && (
                                <button 
                                  onClick={() => handleUpdateOutletStatus(o.id, "APPROVED")} 
                                  title="Approve"
                                  className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold uppercase transition-all cursor-pointer"
                                >
                                  Approve
                                </button>
                              )}
                              {o.status === "PENDING" && (
                                <button 
                                  onClick={() => handleUpdateOutletStatus(o.id, "REJECTED")} 
                                  title="Reject"
                                  className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-bold uppercase transition-all cursor-pointer"
                                >
                                  Reject
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {activeWorkspace === "partners" && (
            <motion.div
              key="partners"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="space-y-6"
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h1 className="text-xl md:text-2xl font-black text-[var(--text-primary)] tracking-tight">API Partner Manager</h1>
                  <p className="text-xs text-[var(--text-secondary)] font-medium">Audit API keys status, rate limit metrics, and active sandbox configs</p>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => {
                      loadManageableUsers();
                      setIsConvertPartnerOpen(true);
                    }}
                    className="px-3.5 py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-white rounded-xl text-xs font-bold uppercase transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" /> Convert to Partner
                  </button>
                  <button onClick={loadPartners} className="p-2.5 bg-[var(--bg-secondary)] border border-[var(--border-soft)] text-[var(--text-secondary)] rounded-xl hover:text-[var(--text-primary)] flex items-center justify-center cursor-pointer">
                    <RefreshCw className={`w-4 h-4 ${partnerLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Partners Listing */}
              <div className="bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-2xl shadow-soft overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[var(--bg-secondary)]/50 border-b border-[var(--border-soft)] text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                        <th className="px-6 py-4">API Merchant</th>
                        <th className="px-6 py-4">API Key Client ID</th>
                        <th className="px-6 py-4 text-center">Rate Limit</th>
                        <th className="px-6 py-4 text-center">Sandbox State</th>
                        <th className="px-6 py-4 text-center">Status</th>
                        <th className="px-6 py-4 text-right">Account Balance</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-soft)] text-xs">
                      {partnerLoading ? (
                        <tr><td colSpan="7" className="p-8 text-center">Loading API partners...</td></tr>
                      ) : partners.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="p-12 text-center text-[var(--text-secondary)]">
                            <div className="flex flex-col items-center justify-center space-y-2">
                              <Key className="w-8 h-8 text-[var(--text-muted)] opacity-50" />
                              <p className="font-semibold text-sm">No partner integrations mapped</p>
                              <p className="text-xs text-[var(--text-muted)]">Create api credentials under the API partners module to begin</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        partners.map(p => {
                          const access = p.apiAccesses?.[0];
                          return (
                            <tr key={p.id} className="hover:bg-[var(--admin-table-row-hover)] transition-colors">
                              <td className="px-6 py-4">
                                <p className="font-bold text-[var(--text-primary)]">{p.name || "N/A"}</p>
                                <p className="text-[10px] text-[var(--text-secondary)]">{p.email || "No email"}</p>
                              </td>
                              <td className="px-6 py-4 font-mono font-bold text-[var(--text-secondary)]">
                                {access?.apiKey || "No keys configured"}
                              </td>
                              <td className="px-6 py-4 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <span className="font-bold">{access?.rateLimit || 100} r/m</span>
                                  {access && (
                                    <button 
                                      onClick={() => {
                                        setSelectedPartnerForRateLimit(access);
                                        setRateLimitFormVal(access.rateLimit);
                                        setIsRateLimitOpen(true);
                                      }}
                                      title="Update Rate Limit"
                                      className="p-1 bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] border border-[var(--border-soft)] rounded text-[9px] cursor-pointer"
                                    >
                                      Edit
                                    </button>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4 text-center">
                                {access ? (
                                  <button
                                    onClick={() => handleTogglePartnerEnvironment(access.id, access.environment)}
                                    className={`px-2 py-0.5 text-[9px] font-black rounded uppercase border transition-colors cursor-pointer ${access.environment === "PRODUCTION" ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20' : 'border-cyan-500/20 bg-cyan-500/10 text-cyan-500 hover:bg-cyan-500/20'}`}
                                  >
                                    {access.environment || "PRODUCTION"}
                                  </button>
                                ) : (
                                  "N/A"
                                )}
                              </td>
                              <td className="px-6 py-4 text-center">
                                {access ? (
                                  <button
                                    onClick={() => handleTogglePartnerStatus(access.id, access.isActive)}
                                    className={`px-2 py-0.5 text-[9px] font-black rounded uppercase border transition-colors cursor-pointer ${access.isActive ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border-rose-500/20 hover:bg-rose-500/20'}`}
                                  >
                                    {access.isActive ? "Active" : "Suspended"}
                                  </button>
                                ) : (
                                  "N/A"
                                )}
                              </td>
                              <td className="px-6 py-4 text-right font-extrabold">₹{Number(p.wallet?.balance || 0).toFixed(2)}</td>
                              <td className="px-6 py-4 text-right flex justify-end gap-1.5 items-center">
                                {access && (
                                  <>
                                    <button 
                                      onClick={() => loadPartnerUsage(access)}
                                      title="View Usage Logs"
                                      className="p-1.5 bg-[var(--bg-secondary)] border border-[var(--border-soft)] hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] rounded-xl cursor-pointer"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                    </button>
                                    <button 
                                      onClick={() => handleRotateSecret(access.id)}
                                      title="Rotate Secret Key"
                                      className="p-1.5 bg-[var(--bg-secondary)] border border-[var(--border-soft)] hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] rounded-xl cursor-pointer"
                                    >
                                      <RefreshCw className="w-3.5 h-3.5" />
                                    </button>
                                    <button 
                                      onClick={() => handleRevokePartner(access.id)}
                                      title="Revoke & Demote Partner"
                                      className="p-1.5 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-500 rounded-xl cursor-pointer"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {activeWorkspace === "fos" && (
            <motion.div
              key="fos"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="space-y-6"
            >
              <div>
                <h1 className="text-xl md:text-2xl font-black text-[var(--text-primary)] tracking-tight">FOS Management Dashboard</h1>
                <p className="text-xs text-[var(--text-secondary)] font-medium">Link field service agents to onboarded retailers and audit regional parameters</p>
              </div>

              {/* FOS Assigner Form Panel */}
              <div className="p-5 rounded-2xl bg-[var(--card-bg)] border border-[var(--border-soft)] shadow-soft grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Select FOS Field Agent</label>
                  <select
                    value={selectedFosId}
                    onChange={(e) => setSelectedFosId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl text-xs text-[var(--text-primary)] outline-none"
                  >
                    <option value="">-- Choose Field Service --</option>
                    {fosAgents.map(f => (
                      <option key={f.id} value={f.id}>{f.user?.name} ({f.region})</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Target Retailers Selected ({bulkSelectedUserIds.length})</label>
                  <input 
                    type="text" 
                    placeholder="Go to Directory to multi-select users" 
                    disabled 
                    className="w-full px-3.5 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-xl text-xs opacity-60 outline-none"
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleAssignFosRetailers("assign")} className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase transition-all cursor-pointer">
                    Link Retailers
                  </button>
                  <button onClick={() => handleAssignFosRetailers("unassign")} className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold uppercase transition-all cursor-pointer">
                    Unlink
                  </button>
                </div>
              </div>

              {/* FOS Agent List */}
              <div className="bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-2xl shadow-soft overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[var(--bg-secondary)]/50 border-b border-[var(--border-soft)] text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                        <th className="px-6 py-4">FOS Agent Name</th>
                        <th className="px-6 py-4">Region Assigned</th>
                        <th className="px-6 py-4 text-center">Onboarding Target</th>
                        <th className="px-6 py-4 text-center">Current Linked Retailers</th>
                        <th className="px-6 py-4 text-right">Progress Bar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-soft)] text-xs">
                      {fosLoading ? (
                        <tr><td colSpan="5" className="p-8 text-center">Loading FOS directory...</td></tr>
                      ) : fosAgents.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="p-12 text-center text-[var(--text-secondary)]">
                            <div className="flex flex-col items-center justify-center space-y-2">
                              <Compass className="w-8 h-8 text-[var(--text-muted)] opacity-50" />
                              <p className="font-semibold text-sm">No FOS agents registered</p>
                              <p className="text-xs text-[var(--text-muted)]">Add field representatives to track merchant onboarding performance</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        fosAgents.map(f => {
                          const percent = Math.min((f.currentOnboardings / f.targetOnboardings) * 100, 100);
                          return (
                            <tr key={f.id} className="hover:bg-[var(--admin-table-row-hover)] transition-colors">
                              <td className="px-6 py-4 font-bold text-[var(--text-primary)]">{f.user?.name}</td>
                              <td className="px-6 py-4">{f.region || "All Regions"}</td>
                              <td className="px-6 py-4 text-center font-bold">{f.targetOnboardings}</td>
                              <td className="px-6 py-4 text-center text-cyan-500 font-extrabold">{f.currentOnboardings}</td>
                              <td className="px-6 py-4 text-right max-w-[150px]">
                                <div className="w-full bg-[var(--bg-secondary)] rounded-full h-2">
                                  <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${percent}%` }} />
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {activeWorkspace === "agreements" && (
            <motion.div
              key="agreements"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="space-y-6"
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h1 className="text-xl md:text-2xl font-black text-[var(--text-primary)] tracking-tight">Merchant Onboarding Agreements</h1>
                  <p className="text-xs text-[var(--text-secondary)] font-medium">Review signed master contracts, e-signature logs, and apply manual sign-off approvals</p>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => {
                      loadManageableUsers();
                      setIsCreateAgreementOpen(true);
                    }}
                    className="px-3.5 py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-white rounded-xl text-xs font-bold uppercase transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" /> Create Agreement
                  </button>
                  <button onClick={loadAgreements} className="p-2.5 bg-[var(--bg-secondary)] border border-[var(--border-soft)] text-[var(--text-secondary)] rounded-xl hover:text-[var(--text-primary)] flex items-center justify-center cursor-pointer">
                    <RefreshCw className={`w-4 h-4 ${agreementLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Agreements Review List */}
              <div className="bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-2xl shadow-soft overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[var(--bg-secondary)]/50 border-b border-[var(--border-soft)] text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                        <th className="px-6 py-4">Agreement Document</th>
                        <th className="px-6 py-4">Signed Merchant</th>
                        <th className="px-6 py-4">E-Signed Date</th>
                        <th className="px-6 py-4 text-center">Status</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-soft)] text-xs">
                      {agreementLoading ? (
                        <tr><td colSpan="5" className="p-8 text-center">Loading agreements...</td></tr>
                      ) : agreements.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="p-12 text-center text-[var(--text-secondary)]">
                            <div className="flex flex-col items-center justify-center space-y-2">
                              <FileCheck className="w-8 h-8 text-[var(--text-muted)] opacity-50" />
                              <p className="font-semibold text-sm">No agreements available</p>
                              <p className="text-xs text-[var(--text-muted)]">No active merchant onboarding agreements currently pending audit</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        agreements.map(a => {
                          const isLocked = a.status === "APPROVED";
                          const storedData = sessionStorage.getItem("dizipay_admin_data");
                          let isSuperAdmin = false;
                          try {
                            if (storedData) {
                              isSuperAdmin = JSON.parse(storedData)?.role === "SUPER_ADMIN";
                            }
                          } catch (e) {}

                          return (
                            <tr key={a.id} className="hover:bg-[var(--admin-table-row-hover)] transition-colors">
                              <td className="px-6 py-4 font-bold text-[var(--text-primary)]">{a.title}</td>
                              <td className="px-6 py-4">
                                <p className="font-semibold">{a.user?.name || `User #${a.userId}`}</p>
                                <p className="text-[10px] text-[var(--text-secondary)]">{a.user?.email || "No email"}</p>
                              </td>
                              <td className="px-6 py-4">{a.signedAt ? new Date(a.signedAt).toLocaleString() : "Not Signed"}</td>
                              <td className="px-6 py-4 text-center">
                                <span className={`px-2.5 py-0.5 text-[9px] font-black rounded uppercase border tracking-wider ${a.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : (a.status === 'PENDING' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-rose-500/10 text-rose-500 border-rose-500/20')}`}>
                                  {a.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right flex justify-end gap-1.5 items-center">
                                <button 
                                  onClick={() => setActiveAgreementReview(a)} 
                                  title="View & Audit Contract"
                                  className="p-1.5 bg-[var(--bg-secondary)] border border-[var(--border-soft)] hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] rounded-xl cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                
                                {(!isLocked || isSuperAdmin) ? (
                                  <>
                                    <button 
                                      onClick={() => {
                                        setSelectedEditAgreement(a);
                                        setEditAgreementForm({ title: a.title, content: a.content });
                                        setIsEditAgreementOpen(true);
                                      }} 
                                      title="Edit Agreement"
                                      className="p-1.5 bg-[var(--bg-secondary)] border border-[var(--border-soft)] hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] rounded-xl cursor-pointer"
                                    >
                                      <Settings className="w-3.5 h-3.5" />
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteAgreement(a.id)} 
                                      title="Delete Agreement"
                                      className="p-1.5 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-500 rounded-xl cursor-pointer"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                ) : (
                                  <span className="text-[10px] text-[var(--text-muted)] font-bold italic px-2">LOCKED</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Agreement Reviewing Drawer Modal */}
              <AnimatePresence>
                {activeAgreementReview && (
                  <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setActiveAgreementReview(null)} className="absolute inset-0 bg-slate-900/60" />
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-xl bg-[var(--card-bg)] text-[var(--text-primary)] rounded-2xl border border-[var(--border-soft)] shadow-2xl overflow-hidden z-10 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
                      <div className="flex justify-between items-center pb-2 border-b border-[var(--border-soft)]">
                        <h3 className="text-sm font-black uppercase">{activeAgreementReview.title}</h3>
                        <button onClick={() => setActiveAgreementReview(null)} className="p-1.5 hover:bg-[var(--bg-secondary)] rounded-full cursor-pointer"><X className="w-4 h-4" /></button>
                      </div>
                      <div className="p-4 rounded-xl bg-[var(--bg-secondary)]/25 text-xs text-[var(--text-secondary)] font-medium leading-relaxed font-mono max-h-[250px] overflow-y-auto border border-[var(--border-soft)]">
                        {activeAgreementReview.content}
                      </div>
                      
                      {/* Show sign-off action details or remarks */}
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Approval Action Remarks</label>
                        <textarea
                          placeholder="Type remarks or security signs here..."
                          value={agreementRemarks}
                          onChange={(e) => setAgreementRemarks(e.target.value)}
                          className="w-full p-3 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl text-xs outline-none focus:ring-2 focus:ring-[var(--admin-focus-ring)] min-h-[60px]"
                        />
                      </div>
                      <div className="flex gap-2">
                        {/* Only allow approve/reject if not approved, or if SUPER_ADMIN */}
                        {activeAgreementReview.status !== "APPROVED" ? (
                          <>
                            <button onClick={() => handleSignAgreement(activeAgreementReview.id, "APPROVED")} className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase transition-all cursor-pointer">
                              Approve Contract
                            </button>
                            <button onClick={() => handleSignAgreement(activeAgreementReview.id, "REJECTED")} className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold uppercase transition-all cursor-pointer">
                              Reject
                            </button>
                          </>
                        ) : (() => {
                          const storedData = sessionStorage.getItem("dizipay_admin_data");
                          let isSuperAdmin = false;
                          try {
                            if (storedData) {
                              isSuperAdmin = JSON.parse(storedData)?.role === "SUPER_ADMIN";
                            }
                          } catch (e) {}
                          
                          if (isSuperAdmin) {
                            return (
                              <button 
                                onClick={() => handleSignAgreement(activeAgreementReview.id, "PENDING")} 
                                className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold uppercase transition-all cursor-pointer"
                              >
                                Force Re-open Contract (SUPER_ADMIN)
                              </button>
                            );
                          }
                          return (
                            <div className="w-full p-3 bg-[var(--bg-secondary)] border border-[var(--border-soft)] text-center text-xs font-bold text-[var(--text-muted)] rounded-xl">
                              This agreement is approved and locked.
                            </div>
                          );
                        })()}
                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {activeWorkspace === "employees" && (
            <motion.div
              key="employees"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="space-y-6"
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h1 className="text-xl md:text-2xl font-black text-[var(--text-primary)] tracking-tight">Workforce CRM</h1>
                  <p className="text-xs text-[var(--text-secondary)] font-medium">Configure corporate staff hierarchy: ASM, TSM, Circle Head, Sales Head</p>
                </div>
                <button onClick={loadEmployees} className="p-2.5 bg-[var(--bg-secondary)] border border-[var(--border-soft)] text-[var(--text-secondary)] rounded-xl hover:text-[var(--text-primary)] flex items-center justify-center cursor-pointer">
                  <RefreshCw className={`w-4 h-4 ${employeeLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {/* Workforce Creation Form */}
              <form onSubmit={handleCreateEmployee} className="p-5 rounded-2xl bg-[var(--card-bg)] border border-[var(--border-soft)] shadow-soft grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Employee Name</label>
                  <input 
                    type="text" 
                    placeholder="Amit Kumar" 
                    value={newEmployee.name}
                    onChange={(e) => setNewEmployee(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl text-xs text-[var(--text-primary)] outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Corporate Email</label>
                  <input 
                    type="email" 
                    placeholder="amit@irecharge.in" 
                    value={newEmployee.email}
                    onChange={(e) => setNewEmployee(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl text-xs text-[var(--text-primary)] outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Assign Role</label>
                  <select
                    value={newEmployee.role}
                    onChange={(e) => setNewEmployee(prev => ({ ...prev, role: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl text-xs text-[var(--text-primary)] cursor-pointer outline-none"
                  >
                    <option value="ASM">ASM (Area Sales Manager)</option>
                    <option value="TSM">TSM (Territory Sales Manager)</option>
                    <option value="Circle Head">Circle Head</option>
                    <option value="Zonal Head">Zonal Head</option>
                    <option value="Sales Head">Sales Head</option>
                    <option value="STAFF">Corporate Staff</option>
                  </select>
                </div>
                <button type="submit" className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold uppercase transition-all cursor-pointer flex items-center justify-center gap-2">
                  <Plus className="w-4 h-4" /> Add Corporate
                </button>
              </form>

              {/* Workforce Staff Table */}
              <div className="bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-2xl shadow-soft overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[var(--bg-secondary)]/50 border-b border-[var(--border-soft)] text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                        <th className="px-6 py-4">Employee ID</th>
                        <th className="px-6 py-4">Staff Name</th>
                        <th className="px-6 py-4">Contact Email</th>
                        <th className="px-6 py-4">Corporate Role</th>
                        <th className="px-6 py-4 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-soft)] text-xs">
                      {employeeLoading ? (
                        <tr><td colSpan="5" className="p-8 text-center">Loading workforce...</td></tr>
                      ) : employees.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="p-12 text-center text-[var(--text-secondary)]">
                            <div className="flex flex-col items-center justify-center space-y-2">
                              <Briefcase className="w-8 h-8 text-[var(--text-muted)] opacity-50" />
                              <p className="font-semibold text-sm">No employees added yet</p>
                              <p className="text-xs text-[var(--text-muted)]">Register your workforce team in the form below to begin tracking</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        employees.map(e => (
                          <tr key={e.id} className="hover:bg-[var(--admin-table-row-hover)] transition-colors">
                            <td className="px-6 py-4 font-mono font-bold text-[var(--text-secondary)]">EMP-00{e.id}</td>
                            <td className="px-6 py-4 font-bold text-[var(--text-primary)]">{e.name}</td>
                            <td className="px-6 py-4">{e.email}</td>
                            <td className="px-6 py-4">
                              <span className="px-2.5 py-0.5 text-[9px] font-black rounded uppercase border border-cyan-500/20 bg-cyan-500/10 text-cyan-500">
                                {e.role}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className="px-2 py-0.5 text-[9px] font-black rounded uppercase border border-emerald-500/20 bg-emerald-500/10 text-emerald-500">
                                {e.isActive ? "ACTIVE" : "INACTIVE"}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {activeWorkspace === "attendance" && (
            <motion.div
              key="attendance"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-center">
                <div>
                  <h1 className="text-xl md:text-2xl font-black text-[var(--text-primary)] tracking-tight">Attendance Logging</h1>
                  <p className="text-xs text-[var(--text-secondary)] font-medium">Verify employee daily check-in logs, coordinates, and physical grid states</p>
                </div>
                <button onClick={loadAttendance} className="p-2.5 bg-[var(--bg-secondary)] border border-[var(--border-soft)] text-[var(--text-secondary)] rounded-xl hover:text-[var(--text-primary)] flex items-center justify-center cursor-pointer">
                  <RefreshCw className={`w-4 h-4 ${attendanceLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {/* Quick checkin simulator widgets */}
              <div className="p-5 bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-2xl shadow-soft space-y-4">
                <h4 className="text-xs font-black text-[var(--text-primary)] uppercase tracking-wider">Clock-in Daily Simulator</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {employees.map(emp => (
                    <div key={emp.id} className="p-3 bg-[var(--bg-secondary)]/15 border border-[var(--border-soft)] rounded-xl flex justify-between items-center gap-2">
                      <span className="text-xs font-bold text-[var(--text-primary)] truncate">{emp.name}</span>
                      <div className="flex gap-1.5">
                        <button onClick={() => handleSimulateCheckIn(emp.id)} className="p-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[9px] font-bold uppercase transition-all cursor-pointer">In</button>
                        <button onClick={() => handleSimulateCheckOut(emp.id)} className="p-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[9px] font-bold uppercase transition-all cursor-pointer">Out</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Attendance Table */}
              <div className="bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-2xl shadow-soft overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[var(--bg-secondary)]/50 border-b border-[var(--border-soft)] text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                        <th className="px-6 py-4">Employee</th>
                        <th className="px-6 py-4">Role</th>
                        <th className="px-6 py-4">Clock-in Time</th>
                        <th className="px-6 py-4">Clock-out Time</th>
                        <th className="px-6 py-4">GPS Geolocation / Location</th>
                        <th className="px-6 py-4 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-soft)] text-xs">
                      {attendanceLoading ? (
                        <tr><td colSpan="6" className="p-8 text-center">Loading logs...</td></tr>
                      ) : attendanceLogs.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="p-12 text-center text-[var(--text-secondary)]">
                            <div className="flex flex-col items-center justify-center space-y-2">
                              <Clock className="w-8 h-8 text-[var(--text-muted)] opacity-50" />
                              <p className="font-semibold text-sm">No attendance records today</p>
                              <p className="text-xs text-[var(--text-muted)]">Daily check-in and checkout events will appear here in real-time</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        attendanceLogs.map(a => (
                          <tr key={a.id} className="hover:bg-[var(--admin-table-row-hover)] transition-colors">
                            <td className="px-6 py-4 font-bold text-[var(--text-primary)]">{a.employee?.name}</td>
                            <td className="px-6 py-4 font-semibold text-[var(--text-secondary)]">{a.employee?.role}</td>
                            <td className="px-6 py-4">{new Date(a.checkIn).toLocaleTimeString()}</td>
                            <td className="px-6 py-4">{a.checkOut ? new Date(a.checkOut).toLocaleTimeString() : "Still Active"}</td>
                            <td className="px-6 py-4">{a.location || "Remote Hub / GPS Validated"}</td>
                            <td className="px-6 py-4 text-center">
                              <span className="px-2 py-0.5 text-[9px] font-black rounded uppercase border border-emerald-500/20 bg-emerald-500/10 text-emerald-500">
                                {a.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {activeWorkspace === "meetings" && (
            <motion.div
              key="meetings"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-center">
                <div>
                  <h1 className="text-xl md:text-2xl font-black text-[var(--text-primary)] tracking-tight">Workplace Meeting Scheduler</h1>
                  <p className="text-xs text-[var(--text-secondary)] font-medium">Coordinate calendars, assign attendees, and log follow-up actions</p>
                </div>
                <button onClick={loadMeetings} className="p-2.5 bg-[var(--bg-secondary)] border border-[var(--border-soft)] text-[var(--text-secondary)] rounded-xl hover:text-[var(--text-primary)] flex items-center justify-center cursor-pointer">
                  <RefreshCw className={`w-4 h-4 ${meetingLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {/* Meeting Scheduler Form */}
              <form onSubmit={handleCreateMeeting} className="p-5 rounded-2xl bg-[var(--card-bg)] border border-[var(--border-soft)] shadow-soft grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Meeting Title</label>
                  <input 
                    type="text" 
                    placeholder="Q3 Slab Commission Review" 
                    value={newMeeting.title}
                    onChange={(e) => setNewMeeting(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl text-xs text-[var(--text-primary)] outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Start Time</label>
                  <input 
                    type="datetime-local" 
                    value={newMeeting.startTime}
                    onChange={(e) => setNewMeeting(prev => ({ ...prev, startTime: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl text-xs text-[var(--text-primary)] outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">End Time</label>
                  <input 
                    type="datetime-local" 
                    value={newMeeting.endTime}
                    onChange={(e) => setNewMeeting(prev => ({ ...prev, endTime: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl text-xs text-[var(--text-primary)] outline-none"
                  />
                </div>
                <button type="submit" className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase transition-all cursor-pointer flex items-center justify-center gap-2">
                  <Calendar className="w-4 h-4" /> Book Schedule
                </button>
              </form>

              {/* Scheduled Meetings List */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {meetings.length === 0 ? (
                  <div className="p-12 text-center text-[var(--text-secondary)] col-span-2 border border-[var(--border-soft)] rounded-2xl bg-[var(--bg-secondary)]/10">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <Calendar className="w-8 h-8 text-[var(--text-muted)] opacity-50" />
                      <p className="font-semibold text-sm">No meetings scheduled</p>
                      <p className="text-xs text-[var(--text-muted)]">Book operations schedules using the planner above</p>
                    </div>
                  </div>
                ) : (
                  meetings.map(meeting => (
                    <div key={meeting.id} className="p-5 rounded-2xl bg-[var(--card-bg)] border border-[var(--border-soft)] shadow-soft space-y-3">
                      <div className="flex justify-between items-start gap-2">
                        <h4 className="text-sm font-black text-[var(--text-primary)]">{meeting.title}</h4>
                        <span className="px-2 py-0.5 text-[8px] font-black rounded uppercase border border-indigo-500/20 bg-indigo-500/10 text-indigo-500">Scheduled</span>
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] font-medium">{meeting.description || "Agenda: General operations updates"}</p>
                      <div className="flex justify-between items-center text-[10px] text-[var(--text-muted)] font-semibold pt-2.5 border-t border-[var(--border-soft)]">
                        <span>{new Date(meeting.startTime).toLocaleString()}</span>
                        <span>{meeting.location || "Corporate Room A"}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {enterpriseFeatures.bulkBroadcast && activeWorkspace === "bulk" && (
            <motion.div
              key="bulk"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="space-y-6"
            >
              <div>
                <h1 className="text-xl md:text-2xl font-black text-[var(--text-primary)] tracking-tight">Bulk Broadcast Center</h1>
                <p className="text-xs text-[var(--text-secondary)] font-medium">Transmit push alerts, modify corporate slab assignments, or adjust multi-retailer balances safely</p>
              </div>

              {/* Bulk Form Panel */}
              <div className="p-6 rounded-2xl bg-[var(--card-bg)] border border-[var(--border-soft)] shadow-soft space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Operation Action Type</label>
                    <select
                      value={bulkAction.actionType}
                      onChange={(e) => setBulkAction(prev => ({ ...prev, actionType: e.target.value }))}
                      className="w-full px-3.5 py-2.5 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl text-xs text-[var(--text-primary)] cursor-pointer outline-none"
                    >
                      <option value="activate">Bulk Activate</option>
                      <option value="deactivate">Bulk Deactivate</option>
                      <option value="enable_otp">Bulk Enable OTP</option>
                      <option value="disable_otp">Bulk Disable OTP</option>
                      <option value="assign_slab">Bulk Assign Slab</option>
                      <option value="debit_credit">Bulk Credit / Debit Wallet</option>
                      <option value="broadcast_push">Bulk Firebase Push Notification</option>
                      <option value="broadcast_sms">Bulk SMS Broadcast</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Targets Mapped count</label>
                    <div className="w-full px-3.5 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-xl text-xs text-[var(--text-secondary)] font-bold">
                      {bulkSelectedUserIds.length} User IDs Selected
                    </div>
                  </div>
                </div>

                {/* Conditional Sub-forms */}
                {bulkAction.actionType === "assign_slab" && (
                  <div className="space-y-1.5 max-w-xs">
                    <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Select Commission Slab Name</label>
                    <select
                      value={bulkAction.slabName}
                      onChange={(e) => setBulkAction(prev => ({ ...prev, slabName: e.target.value }))}
                      className="w-full px-3.5 py-2.5 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl text-xs text-[var(--text-primary)] cursor-pointer outline-none"
                    >
                      <option value="Standard">Standard Slab</option>
                      <option value="Gold">Gold Partner Slab</option>
                      <option value="VIP">VIP Distributor Slab</option>
                    </select>
                  </div>
                )}

                {bulkAction.actionType === "debit_credit" && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Direction</label>
                      <select
                        value={bulkAction.direction}
                        onChange={(e) => setBulkAction(prev => ({ ...prev, direction: e.target.value }))}
                        className="w-full px-3.5 py-2.5 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl text-xs text-[var(--text-primary)] cursor-pointer outline-none"
                      >
                        <option value="CREDIT">CREDIT WALLET</option>
                        <option value="DEBIT">DEBIT WALLET</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Adjusting Amount (₹)</label>
                      <input
                        type="number"
                        placeholder="100.00"
                        value={bulkAction.amount}
                        onChange={(e) => setBulkAction(prev => ({ ...prev, amount: e.target.value }))}
                        className="w-full px-3.5 py-2.5 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl text-xs text-[var(--text-primary)] outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Description Remarks</label>
                      <input
                        type="text"
                        placeholder="Promotional topup credit"
                        value={bulkAction.description}
                        onChange={(e) => setBulkAction(prev => ({ ...prev, description: e.target.value }))}
                        className="w-full px-3.5 py-2.5 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl text-xs text-[var(--text-primary)] outline-none"
                      />
                    </div>
                  </div>
                )}

                {(bulkAction.actionType === "broadcast_push" || bulkAction.actionType === "broadcast_sms") && (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Broadcast Title</label>
                      <input
                        type="text"
                        placeholder="Important: System Maintenance Notice"
                        value={bulkAction.title}
                        onChange={(e) => setBulkAction(prev => ({ ...prev, title: e.target.value }))}
                        className="w-full px-3.5 py-2.5 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl text-xs text-[var(--text-primary)] outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Broadcast Message</label>
                      <textarea
                        placeholder="All recharge services will be paused on May 30th from 2:00 AM to 4:00 AM IST."
                        value={bulkAction.message}
                        onChange={(e) => setBulkAction(prev => ({ ...prev, message: e.target.value }))}
                        className="w-full p-3 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl text-xs text-[var(--text-primary)] min-h-[100px] outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* Progress updates */}
                {bulkProgress === "executing" && (
                  <div className="p-4 rounded-xl bg-[var(--bg-secondary)]/15 border border-[var(--border-soft)] text-center text-xs text-cyan-500 font-bold animate-pulse">
                    Executing high-reliability transactional pipeline...
                  </div>
                )}

                {bulkProgress && typeof bulkProgress === "object" && (
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-bold space-y-1">
                    <p>Pipeline completed successfully:</p>
                    <ul className="list-disc pl-5 font-mono text-[10px] text-[var(--text-secondary)]">
                      <li>Success count: {bulkProgress.success}</li>
                      <li>Fail count: {bulkProgress.failed}</li>
                    </ul>
                  </div>
                )}

                <button 
                  onClick={handleTriggerBulkAction}
                  className="w-full py-3 bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" /> Run Bulk Command Pipeline
                </button>
              </div>
            </motion.div>
          )}

          {activeWorkspace === "audits" && (
            <motion.div
              key="audits"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-center">
                <div>
                  <h1 className="text-xl md:text-2xl font-black text-[var(--text-primary)] tracking-tight">Security Audit Trails</h1>
                  <p className="text-xs text-[var(--text-secondary)] font-medium">Verify login timestamps, role changes, wallet adjustments, and suspicious geolocations</p>
                </div>
                <button onClick={loadAudits} className="p-2.5 bg-[var(--bg-secondary)] border border-[var(--border-soft)] text-[var(--text-secondary)] rounded-xl hover:text-[var(--text-primary)] flex items-center justify-center cursor-pointer">
                  <RefreshCw className={`w-4 h-4 ${auditLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {/* Audit Table */}
              <div className="bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-2xl shadow-soft overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[var(--bg-secondary)]/50 border-b border-[var(--border-soft)] text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                        <th className="px-6 py-4">Action Taken</th>
                        <th className="px-6 py-4">Admin Agent</th>
                        <th className="px-6 py-4">Target User</th>
                        <th className="px-6 py-4">Timestamp</th>
                        <th className="px-6 py-4 text-right">Context details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-soft)] text-xs">
                      {auditLoading ? (
                        <tr><td colSpan="5" className="p-8 text-center">Loading audit trails...</td></tr>
                      ) : auditLogs.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="p-12 text-center text-[var(--text-secondary)]">
                            <div className="flex flex-col items-center justify-center space-y-2">
                              <Shield className="w-8 h-8 text-[var(--text-muted)] opacity-50" />
                              <p className="font-semibold text-sm">No administrative logs</p>
                              <p className="text-xs text-[var(--text-muted)]">Operational actions taken by admin agents will log automatically</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        auditLogs.map(log => (
                          <tr key={log.id} className="hover:bg-[var(--admin-table-row-hover)] transition-colors">
                            <td className="px-6 py-4 font-bold text-rose-500">{log.action}</td>
                            <td className="px-6 py-4">{log.admin?.name || "System Runner"}</td>
                            <td className="px-6 py-4">{log.user?.name || "N/A"}</td>
                            <td className="px-6 py-4 font-mono">{new Date(log.createdAt).toLocaleString()}</td>
                            <td className="px-6 py-4 text-right font-mono text-[10px] text-[var(--text-secondary)] truncate max-w-[200px]">
                              {JSON.stringify(log.details)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {activeWorkspace === "rbac" && (
            <motion.div
              key="rbac"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-center">
                <div>
                  <h1 className="text-xl md:text-2xl font-black text-[var(--text-primary)] tracking-tight">RBAC Configuration Matrix</h1>
                  <p className="text-xs text-[var(--text-secondary)] font-medium">Verify and update operational access boundaries across SUPER_ADMIN, ADMIN, and corporate roles</p>
                </div>
                <button onClick={loadRbac} className="p-2.5 bg-[var(--bg-secondary)] border border-[var(--border-soft)] text-[var(--text-secondary)] rounded-xl hover:text-[var(--text-primary)] flex items-center justify-center cursor-pointer">
                  <RefreshCw className={`w-4 h-4 ${rbacLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {/* RBAC Matrix Grid */}
              <div className="bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-2xl shadow-soft overflow-hidden p-6 space-y-6">
                {rbacLoading ? (
                  <p className="text-center py-4">Loading access boundaries...</p>
                ) : (
                  Object.entries(rbacMatrix).map(([role, modules]) => (
                    <div key={role} className="space-y-3.5 pb-5 border-b border-[var(--border-soft)] last:border-b-0">
                      <h4 className="text-xs font-black text-[var(--color-primary)] uppercase tracking-wider">{role.replace('_', ' ')} Boundaries</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                        {Object.entries(modules).map(([mod, actions]) => (
                          <div key={mod} className="p-4 rounded-xl bg-[var(--bg-secondary)]/20 border border-[var(--border-soft)] space-y-2">
                            <h5 className="text-[10px] font-bold text-[var(--text-primary)] uppercase tracking-wider">{mod}</h5>
                            <div className="space-y-1 text-[11px] font-semibold text-[var(--text-secondary)]">
                              {Object.entries(actions).map(([act, val]) => (
                                <label key={act} className="flex items-center gap-2 cursor-pointer">
                                  <input 
                                    type="checkbox" 
                                    checked={val} 
                                    onChange={(e) => handleUpdateRbac(role, mod, act, e.target.checked)}
                                    className="cursor-pointer"
                                  />
                                  <span>{act}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Directory Details Drawer / Sidebar Modal */}
      <AnimatePresence>
        {isDetailOpen && selectedUser && (
          <div className="fixed inset-0 z-[100] flex items-center justify-end">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsDetailOpen(false)} className="absolute inset-0 bg-black/40 backdrop-blur-xs" />
            <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 30, stiffness: 300 }} className="relative w-full max-w-lg h-full bg-[var(--card-bg)] border-l border-[var(--border-soft)] shadow-2xl flex flex-col z-10">
              <div className="px-6 py-5 border-b border-[var(--border-soft)] flex justify-between items-center bg-[var(--bg-secondary)]/30">
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-tight">User Details Profile</h3>
                  <p className="text-[10px] text-[var(--text-secondary)] font-medium">Detailed administrative metadata</p>
                </div>
                <button onClick={() => setIsDetailOpen(false)} className="p-1.5 hover:bg-[var(--bg-secondary)] rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"><X className="w-5 h-5" /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-[var(--text-primary)]">
                <div className="flex items-center gap-4 bg-[var(--bg-secondary)]/20 p-4 rounded-2xl border border-[var(--border-soft)]">
                  <div className="w-16 h-16 rounded-full bg-[var(--color-primary-glow)] border border-[var(--border-soft)] flex items-center justify-center text-[var(--color-primary)] font-black text-lg shadow-sm">
                    {getInitials(selectedUser.name)}
                  </div>
                  <div>
                    <h4 className="text-base font-black">{selectedUser.name}</h4>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">{selectedUser.email || "No email"}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className={`px-2 py-0.5 text-[9px] font-black rounded border ${selectedUser.isActive ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border-rose-500/20'}`}>{selectedUser.isActive ? "Active" : "Inactive"}</span>
                      <span className="px-2 py-0.5 text-[9px] font-black rounded bg-[var(--bg-secondary)] border border-[var(--border-soft)]">ID: {selectedUser.id}</span>
                      <span className="px-2 py-0.5 text-[9px] font-black rounded border border-blue-500/20 bg-blue-500/10 text-blue-500 uppercase">{selectedUser.role}</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-[var(--bg-secondary)]/15 border border-[var(--border-soft)] rounded-xl space-y-2">
                  <div className="flex justify-between"><span>Phone:</span><span className="font-bold">{selectedUser.phone || "N/A"}</span></div>
                  <div className="flex justify-between"><span>Tier Slab:</span><span className="font-bold">{selectedUser.tier || "Standard"}</span></div>
                  <div className="flex justify-between"><span>Wallet Balance:</span><span className="font-bold text-cyan-500">₹{Number(selectedUser.wallet?.balance || 0).toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Cashback Balance:</span><span className="font-bold text-emerald-500">₹{Number(selectedUser.wallet?.cashbackBalance || 0).toFixed(2)}</span></div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Directory Toggling Modal */}
      <AnimatePresence>
        {isConfirmOpen && userToToggle && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsConfirmOpen(false)} className="absolute inset-0 bg-slate-900/60" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-md bg-[var(--card-bg)] text-[var(--text-primary)] rounded-2xl border border-[var(--border-soft)] shadow-2xl p-6 space-y-4 z-10">
              <h3 className="text-sm font-bold uppercase text-rose-500">Confirm Status Change</h3>
              <p className="text-xs text-[var(--text-secondary)] font-medium">Are you sure you want to change the active state for <span className="font-bold">{userToToggle.name}</span>?</p>
              <div className="flex gap-2.5">
                <button onClick={() => setIsConfirmOpen(false)} className="flex-1 py-2.5 border border-[var(--border-soft)] hover:bg-[var(--bg-secondary)] rounded-xl text-xs font-bold uppercase transition-all cursor-pointer">Cancel</button>
                <button onClick={handleConfirmToggleStatus} className="flex-1 py-2.5 bg-rose-600 text-white rounded-xl text-xs font-bold uppercase transition-all cursor-pointer">Confirm Change</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Directory Temp Password Modal */}
      <AnimatePresence>
        {isTempPassConfirmOpen && userForTempPass && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsTempPassConfirmOpen(false)} className="absolute inset-0 bg-slate-900/60" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-md bg-[var(--card-bg)] text-[var(--text-primary)] rounded-2xl border border-[var(--border-soft)] shadow-2xl p-6 space-y-4 z-10">
              <h3 className="text-sm font-bold uppercase text-cyan-500">Send Temporary Password</h3>
              <p className="text-xs text-[var(--text-secondary)] font-medium">
                Are you sure you want to generate and send a temporary login password for <span className="font-bold">{userForTempPass.name}</span> ({userForTempPass.email})?
              </p>
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-xl text-[10px] font-semibold">
                ⚠️ This will immediately overwrite their current password, force them to change it on their next login, and email the new credentials.
              </div>
              <div className="flex gap-2.5">
                <button 
                  onClick={() => setIsTempPassConfirmOpen(false)} 
                  disabled={tempPassLoading}
                  className="flex-1 py-2.5 border border-[var(--border-soft)] hover:bg-[var(--bg-secondary)] rounded-xl text-xs font-bold uppercase transition-all cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleConfirmSendTempPassword} 
                  disabled={tempPassLoading}
                  className="flex-1 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold uppercase transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {tempPassLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Send Password"
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create Outlet Modal */}
      <AnimatePresence>
        {isCreateOutletOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsCreateOutletOpen(false)} className="absolute inset-0 bg-slate-900/60" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-lg bg-[var(--card-bg)] text-[var(--text-primary)] rounded-2xl border border-[var(--border-soft)] shadow-2xl overflow-hidden z-10 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center pb-2 border-b border-[var(--border-soft)]">
                <h3 className="text-sm font-black uppercase">Register Merchant Outlet</h3>
                <button type="button" onClick={() => setIsCreateOutletOpen(false)} className="p-1.5 hover:bg-[var(--bg-secondary)] rounded-full cursor-pointer"><X className="w-4 h-4" /></button>
              </div>
              
              <form onSubmit={handleCreateOutlet} className="space-y-4">
                {/* Linked User searchable selector */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Linked Merchant User *</label>
                  <input 
                    type="text" 
                    placeholder="Search user by name, email, phone..." 
                    value={userOutletSearchQuery}
                    onChange={(e) => setUserOutletSearchQuery(e.target.value)}
                    className="w-full px-3.5 py-2 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl text-xs text-[var(--text-primary)] outline-none"
                  />
                  
                  {/* List of matching users */}
                  <div className="border border-[var(--border-soft)] rounded-xl max-h-[120px] overflow-y-auto bg-[var(--bg-secondary)]/20 divide-y divide-[var(--border-soft)]">
                    {usersWithoutOutletLoading ? (
                      <p className="p-3 text-xs text-center text-[var(--text-secondary)]">Loading users...</p>
                    ) : (() => {
                      const query = userOutletSearchQuery.toLowerCase().trim();
                      const filtered = usersWithoutOutlet.filter(u => 
                        u.name?.toLowerCase().includes(query) || 
                        u.email?.toLowerCase().includes(query) || 
                        u.phone?.includes(query)
                      );
                      if (filtered.length === 0) {
                        return <p className="p-3 text-xs text-center text-[var(--text-secondary)]">No matching merchants found</p>;
                      }
                      return filtered.map(u => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => {
                            setSelectedUserIdForOutlet(u.id);
                            setUserOutletSearchQuery(`${u.name} (${u.phone || u.email})`);
                          }}
                          className={`w-full text-left px-3.5 py-2.5 text-xs transition-colors flex justify-between items-center ${selectedUserIdForOutlet === u.id ? 'bg-[var(--color-primary-glow)] text-[var(--color-primary)] font-bold' : 'hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                        >
                          <div>
                            <p className="font-bold">{u.name}</p>
                            <p className="text-[10px] opacity-75">{u.email} • {u.phone}</p>
                          </div>
                          <span className="text-[9px] font-black uppercase bg-[var(--bg-secondary)] border border-[var(--border-soft)] px-1.5 py-0.5 rounded">{u.role}</span>
                        </button>
                      ));
                    })()}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Outlet Name *</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Super Mart" 
                      value={outletForm.name}
                      onChange={(e) => setOutletForm(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3.5 py-2 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl text-xs text-[var(--text-primary)] outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Owner Name *</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Enter name" 
                      value={outletForm.ownerName}
                      onChange={(e) => setOutletForm(prev => ({ ...prev, ownerName: e.target.value }))}
                      className="w-full px-3.5 py-2 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl text-xs text-[var(--text-primary)] outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Address *</label>
                  <input 
                    type="text" 
                    required
                    placeholder="Shop 12, Main Street" 
                    value={outletForm.address}
                    onChange={(e) => setOutletForm(prev => ({ ...prev, address: e.target.value }))}
                    className="w-full px-3.5 py-2 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl text-xs text-[var(--text-primary)] outline-none"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">City *</label>
                    <input 
                      type="text" 
                      required
                      placeholder="New Delhi" 
                      value={outletForm.city}
                      onChange={(e) => setOutletForm(prev => ({ ...prev, city: e.target.value }))}
                      className="w-full px-3.5 py-2 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl text-xs text-[var(--text-primary)] outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">State *</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Delhi" 
                      value={outletForm.state}
                      onChange={(e) => setOutletForm(prev => ({ ...prev, state: e.target.value }))}
                      className="w-full px-3.5 py-2 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl text-xs text-[var(--text-primary)] outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Pincode *</label>
                    <input 
                      type="text" 
                      required
                      placeholder="110001" 
                      value={outletForm.pincode}
                      onChange={(e) => setOutletForm(prev => ({ ...prev, pincode: e.target.value }))}
                      className="w-full px-3.5 py-2 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl text-xs text-[var(--text-primary)] outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Latitude (Optional)</label>
                    <input 
                      type="number" 
                      step="any"
                      placeholder="28.6139" 
                      value={outletForm.latitude}
                      onChange={(e) => setOutletForm(prev => ({ ...prev, latitude: e.target.value }))}
                      className="w-full px-3.5 py-2 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl text-xs text-[var(--text-primary)] outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Longitude (Optional)</label>
                    <input 
                      type="number" 
                      step="any"
                      placeholder="77.2090" 
                      value={outletForm.longitude}
                      onChange={(e) => setOutletForm(prev => ({ ...prev, longitude: e.target.value }))}
                      className="w-full px-3.5 py-2 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl text-xs text-[var(--text-primary)] outline-none"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button 
                    type="button" 
                    onClick={() => setIsCreateOutletOpen(false)} 
                    className="flex-1 py-2.5 border border-[var(--border-soft)] hover:bg-[var(--bg-secondary)] rounded-xl text-xs font-bold uppercase transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={createOutletLoading}
                    className="flex-1 py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-white rounded-xl text-xs font-bold uppercase transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {createOutletLoading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Registering...
                      </>
                    ) : (
                      "Register"
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* View Outlet Details Modal */}
      <AnimatePresence>
        {isViewOutletOpen && selectedViewOutlet && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsViewOutletOpen(false)} className="absolute inset-0 bg-slate-900/60" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-md bg-[var(--card-bg)] text-[var(--text-primary)] rounded-2xl border border-[var(--border-soft)] shadow-2xl overflow-hidden z-10 p-6 space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-[var(--border-soft)]">
                <h3 className="text-sm font-bold uppercase text-[var(--color-primary)]">Outlet Profile Details</h3>
                <button type="button" onClick={() => setIsViewOutletOpen(false)} className="p-1.5 hover:bg-[var(--bg-secondary)] rounded-full cursor-pointer"><X className="w-4 h-4" /></button>
              </div>
              
              <div className="space-y-3.5 text-xs">
                <div className="p-4 rounded-xl bg-[var(--bg-secondary)]/15 border border-[var(--border-soft)] space-y-2.5">
                  <div className="flex justify-between border-b border-[var(--border-soft)]/40 pb-1.5"><span className="text-[var(--text-secondary)]">Outlet Name:</span><span className="font-bold">{selectedViewOutlet.name}</span></div>
                  <div className="flex justify-between border-b border-[var(--border-soft)]/40 pb-1.5"><span className="text-[var(--text-secondary)]">Owner:</span><span className="font-bold">{selectedViewOutlet.ownerName}</span></div>
                  <div className="flex justify-between border-b border-[var(--border-soft)]/40 pb-1.5"><span className="text-[var(--text-secondary)]">Linked User ID:</span><span className="font-bold font-mono">#{selectedViewOutlet.userId}</span></div>
                  <div className="flex justify-between border-b border-[var(--border-soft)]/40 pb-1.5"><span className="text-[var(--text-secondary)]">User Name:</span><span className="font-bold">{selectedViewOutlet.user?.name || "N/A"}</span></div>
                  <div className="flex justify-between border-b border-[var(--border-soft)]/40 pb-1.5"><span className="text-[var(--text-secondary)]">User Email:</span><span className="font-bold font-mono">{selectedViewOutlet.user?.email || "N/A"}</span></div>
                  <div className="flex justify-between border-b border-[var(--border-soft)]/40 pb-1.5"><span className="text-[var(--text-secondary)]">User Phone:</span><span className="font-bold font-mono">{selectedViewOutlet.user?.phone || "N/A"}</span></div>
                </div>
                
                <div className="p-4 rounded-xl bg-[var(--bg-secondary)]/15 border border-[var(--border-soft)] space-y-2.5">
                  <div className="flex justify-between border-b border-[var(--border-soft)]/40 pb-1.5"><span className="text-[var(--text-secondary)]">Address:</span><span className="font-semibold text-right max-w-[200px] truncate">{selectedViewOutlet.address}</span></div>
                  <div className="flex justify-between border-b border-[var(--border-soft)]/40 pb-1.5"><span className="text-[var(--text-secondary)]">City:</span><span className="font-semibold">{selectedViewOutlet.city}</span></div>
                  <div className="flex justify-between border-b border-[var(--border-soft)]/40 pb-1.5"><span className="text-[var(--text-secondary)]">State:</span><span className="font-semibold">{selectedViewOutlet.state}</span></div>
                  <div className="flex justify-between border-b border-[var(--border-soft)]/40 pb-1.5"><span className="text-[var(--text-secondary)]">Pincode:</span><span className="font-mono font-semibold">{selectedViewOutlet.pincode}</span></div>
                  <div className="flex justify-between border-b border-[var(--border-soft)]/40 pb-1.5"><span className="text-[var(--text-secondary)]">Latitude:</span><span className="font-mono font-semibold">{selectedViewOutlet.latitude !== null && selectedViewOutlet.latitude !== undefined ? selectedViewOutlet.latitude : "N/A"}</span></div>
                  <div className="flex justify-between pb-1.5"><span className="text-[var(--text-secondary)]">Longitude:</span><span className="font-mono font-semibold">{selectedViewOutlet.longitude !== null && selectedViewOutlet.longitude !== undefined ? selectedViewOutlet.longitude : "N/A"}</span></div>
                </div>
                
                <div className="p-4 rounded-xl bg-[var(--bg-secondary)]/15 border border-[var(--border-soft)] flex justify-between items-center">
                  <span className="text-[var(--text-secondary)]">Status Flow State:</span>
                  <span className={`px-2.5 py-0.5 text-[9px] font-black rounded uppercase border tracking-wider ${selectedViewOutlet.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : (selectedViewOutlet.status === 'PENDING' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-rose-500/10 text-rose-500 border-rose-500/20')}`}>
                    {selectedViewOutlet.status}
                  </span>
                </div>
              </div>
              
              <button 
                type="button"
                onClick={() => setIsViewOutletOpen(false)} 
                className="w-full py-2.5 border border-[var(--border-soft)] hover:bg-[var(--bg-secondary)] rounded-xl text-xs font-bold uppercase transition-all cursor-pointer"
              >
                Close Details
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Outlet Details Modal */}
      <AnimatePresence>
        {isEditOutletOpen && selectedEditOutlet && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsEditOutletOpen(false)} className="absolute inset-0 bg-slate-900/60" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-lg bg-[var(--card-bg)] text-[var(--text-primary)] rounded-2xl border border-[var(--border-soft)] shadow-2xl overflow-hidden z-10 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center pb-2 border-b border-[var(--border-soft)]">
                <h3 className="text-sm font-black uppercase">Edit Store Parameters</h3>
                <button type="button" onClick={() => setIsEditOutletOpen(false)} className="p-1.5 hover:bg-[var(--bg-secondary)] rounded-full cursor-pointer"><X className="w-4 h-4" /></button>
              </div>
              
              <form onSubmit={handleEditOutlet} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Outlet Name *</label>
                    <input 
                      type="text" 
                      required
                      value={editOutletForm.name}
                      onChange={(e) => setEditOutletForm(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3.5 py-2 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl text-xs text-[var(--text-primary)] outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Owner Name *</label>
                    <input 
                      type="text" 
                      required
                      value={editOutletForm.ownerName}
                      onChange={(e) => setEditOutletForm(prev => ({ ...prev, ownerName: e.target.value }))}
                      className="w-full px-3.5 py-2 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl text-xs text-[var(--text-primary)] outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Address *</label>
                  <input 
                    type="text" 
                    required
                    value={editOutletForm.address}
                    onChange={(e) => setEditOutletForm(prev => ({ ...prev, address: e.target.value }))}
                    className="w-full px-3.5 py-2 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl text-xs text-[var(--text-primary)] outline-none"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">City *</label>
                    <input 
                      type="text" 
                      required
                      value={editOutletForm.city}
                      onChange={(e) => setEditOutletForm(prev => ({ ...prev, city: e.target.value }))}
                      className="w-full px-3.5 py-2 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl text-xs text-[var(--text-primary)] outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">State *</label>
                    <input 
                      type="text" 
                      required
                      value={editOutletForm.state}
                      onChange={(e) => setEditOutletForm(prev => ({ ...prev, state: e.target.value }))}
                      className="w-full px-3.5 py-2 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl text-xs text-[var(--text-primary)] outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Pincode *</label>
                    <input 
                      type="text" 
                      required
                      value={editOutletForm.pincode}
                      onChange={(e) => setEditOutletForm(prev => ({ ...prev, pincode: e.target.value }))}
                      className="w-full px-3.5 py-2 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl text-xs text-[var(--text-primary)] outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Latitude (Optional)</label>
                    <input 
                      type="number" 
                      step="any"
                      value={editOutletForm.latitude}
                      onChange={(e) => setEditOutletForm(prev => ({ ...prev, latitude: e.target.value }))}
                      className="w-full px-3.5 py-2 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl text-xs text-[var(--text-primary)] outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Longitude (Optional)</label>
                    <input 
                      type="number" 
                      step="any"
                      value={editOutletForm.longitude}
                      onChange={(e) => setEditOutletForm(prev => ({ ...prev, longitude: e.target.value }))}
                      className="w-full px-3.5 py-2 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl text-xs text-[var(--text-primary)] outline-none"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button 
                    type="button" 
                    onClick={() => setIsEditOutletOpen(false)} 
                    className="flex-1 py-2.5 border border-[var(--border-soft)] hover:bg-[var(--bg-secondary)] rounded-xl text-xs font-bold uppercase transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={editOutletLoading}
                    className="flex-1 py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-white rounded-xl text-xs font-bold uppercase transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {editOutletLoading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Changes"
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Convert to Partner Modal */}
      <AnimatePresence>
        {isConvertPartnerOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsConvertPartnerOpen(false)} className="absolute inset-0 bg-slate-900/60" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-lg bg-[var(--card-bg)] text-[var(--text-primary)] rounded-2xl border border-[var(--border-soft)] shadow-2xl overflow-hidden z-10 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center pb-2 border-b border-[var(--border-soft)]">
                <h3 className="text-sm font-black uppercase">Promote to API Partner</h3>
                <button type="button" onClick={() => setIsConvertPartnerOpen(false)} className="p-1.5 hover:bg-[var(--bg-secondary)] rounded-full cursor-pointer"><X className="w-4 h-4" /></button>
              </div>
              
              <form onSubmit={handleConvertPartner} className="space-y-4">
                {/* Searchable manageable user selection */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Select User *</label>
                  <input 
                    type="text" 
                    placeholder="Search manageable user by name, email, phone..." 
                    value={userPartnerSearchQuery}
                    onChange={(e) => setUserPartnerSearchQuery(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl text-xs text-[var(--text-primary)] outline-none"
                  />
                  
                  <div className="border border-[var(--border-soft)] rounded-xl max-h-[120px] overflow-y-auto bg-[var(--bg-secondary)]/20 divide-y divide-[var(--border-soft)]">
                    {manageableUsersLoading ? (
                      <p className="p-3 text-xs text-center text-[var(--text-secondary)]">Loading users...</p>
                    ) : (() => {
                      const query = userPartnerSearchQuery.toLowerCase().trim();
                      const filtered = manageableUsers.filter(u => 
                        u.role !== "API_USER" && u.role !== "ADMIN" && u.role !== "SUPER_ADMIN" &&
                        (u.name?.toLowerCase().includes(query) || 
                         u.email?.toLowerCase().includes(query) || 
                         u.phone?.includes(query))
                      );
                      if (filtered.length === 0) {
                        return <p className="p-3 text-xs text-center text-[var(--text-secondary)]">No eligible users found</p>;
                      }
                      return filtered.map(u => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => {
                            setSelectedUserIdForPartner(u.id);
                            setUserPartnerSearchQuery(`${u.name} (${u.phone || u.email})`);
                          }}
                          className={`w-full text-left px-3.5 py-2.5 text-xs transition-colors flex justify-between items-center ${selectedUserIdForPartner === u.id ? 'bg-[var(--color-primary-glow)] text-[var(--color-primary)] font-bold' : 'hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                        >
                          <div>
                            <p className="font-bold">{u.name}</p>
                            <p className="text-[10px] opacity-75">{u.email} • {u.phone}</p>
                          </div>
                          <span className="text-[9px] font-black uppercase bg-[var(--bg-secondary)] border border-[var(--border-soft)] px-1.5 py-0.5 rounded">{u.role}</span>
                        </button>
                      ));
                    })()}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Rate Limit (req/min)</label>
                    <input 
                      type="number" 
                      required
                      min="1"
                      value={partnerRateLimit}
                      onChange={(e) => setPartnerRateLimit(e.target.value)}
                      className="w-full px-3.5 py-2 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl text-xs text-[var(--text-primary)] outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Environment</label>
                    <select
                      value={partnerEnvironment}
                      onChange={(e) => setPartnerEnvironment(e.target.value)}
                      className="w-full px-3.5 py-2 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl text-xs text-[var(--text-primary)] outline-none cursor-pointer"
                    >
                      <option value="PRODUCTION">PRODUCTION</option>
                      <option value="SANDBOX">SANDBOX</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button 
                    type="button" 
                    onClick={() => setIsConvertPartnerOpen(false)} 
                    className="flex-1 py-2.5 border border-[var(--border-soft)] hover:bg-[var(--bg-secondary)] rounded-xl text-xs font-bold uppercase transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={convertPartnerLoading}
                    className="flex-1 py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-white rounded-xl text-xs font-bold uppercase transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {convertPartnerLoading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Converting...
                      </>
                    ) : (
                      "Convert"
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Display Generated Credentials Modal */}
      <AnimatePresence>
        {isCredentialsOpen && generatedCredentials && (
          <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsCredentialsOpen(false)} className="absolute inset-0 bg-slate-900/85 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-md bg-[var(--card-bg)] text-[var(--text-primary)] rounded-2xl border border-[var(--border-soft)] shadow-2xl p-6 space-y-4 z-10">
              <h3 className="text-sm font-bold uppercase text-emerald-500 flex items-center gap-2">
                <CheckCircle className="w-5 h-5" /> API Partner Credentials
              </h3>
              <p className="text-xs text-[var(--text-secondary)] font-medium">
                Here are the API credentials. Please copy them now. The secret key <span className="text-rose-500 font-extrabold">WILL NEVER BE SHOWN AGAIN</span> after you close this modal.
              </p>
              
              <div className="p-4 rounded-xl bg-[var(--bg-secondary)]/20 border border-[var(--border-soft)] space-y-3 font-mono text-xs">
                <div className="space-y-1">
                  <span className="text-[10px] text-[var(--text-muted)] font-sans uppercase font-bold tracking-wider">API KEY Client ID:</span>
                  <div className="flex justify-between items-center gap-2 p-2 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-lg">
                    <span className="break-all font-bold select-all">{generatedCredentials.apiKey}</span>
                    <button 
                      type="button" 
                      onClick={() => {
                        navigator.clipboard.writeText(generatedCredentials.apiKey);
                        toast.success("Client ID copied!");
                      }} 
                      className="p-1 hover:bg-[var(--bg-tertiary)] border border-[var(--border-soft)] rounded text-[10px] cursor-pointer"
                    >
                      Copy
                    </button>
                  </div>
                </div>
                
                <div className="space-y-1">
                  <span className="text-[10px] text-[var(--text-muted)] font-sans uppercase font-bold tracking-wider">API Secret Key:</span>
                  <div className="flex justify-between items-center gap-2 p-2 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
                    <span className="break-all font-extrabold text-emerald-500 select-all">{generatedCredentials.apiSecret}</span>
                    <button 
                      type="button" 
                      onClick={() => {
                        navigator.clipboard.writeText(generatedCredentials.apiSecret);
                        toast.success("Secret Key copied!");
                      }} 
                      className="p-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] cursor-pointer"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              </div>

              <button 
                type="button"
                onClick={() => {
                  setIsCredentialsOpen(false);
                  setGeneratedCredentials(null);
                }} 
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase transition-all cursor-pointer"
              >
                I have saved the credentials
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Rate Limit Modal */}
      <AnimatePresence>
        {isRateLimitOpen && selectedPartnerForRateLimit && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsRateLimitOpen(false)} className="absolute inset-0 bg-slate-900/60" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-md bg-[var(--card-bg)] text-[var(--text-primary)] rounded-2xl border border-[var(--border-soft)] shadow-2xl p-6 space-y-4 z-10">
              <h3 className="text-sm font-bold uppercase">Update API Rate Limit</h3>
              
              <form onSubmit={handleUpdateRateLimit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Rate Limit (requests per minute)</label>
                  <input 
                    type="number" 
                    required
                    min="1"
                    value={rateLimitFormVal}
                    onChange={(e) => setRateLimitFormVal(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl text-xs outline-none"
                  />
                </div>
                <div className="flex gap-2.5">
                  <button 
                    type="button" 
                    onClick={() => setIsRateLimitOpen(false)} 
                    disabled={rateLimitLoading}
                    className="flex-1 py-2.5 border border-[var(--border-soft)] hover:bg-[var(--bg-secondary)] rounded-xl text-xs font-bold uppercase cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={rateLimitLoading}
                    className="flex-1 py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-white rounded-xl text-xs font-bold uppercase flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    {rateLimitLoading ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Usage Logs Drawer Modal */}
      <AnimatePresence>
        {isUsageLogOpen && selectedPartnerForUsage && (
          <div className="fixed inset-0 z-[120] flex items-center justify-end">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsUsageLogOpen(false)} className="absolute inset-0 bg-black/45 backdrop-blur-xs" />
            <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 30, stiffness: 300 }} className="relative w-full max-w-lg h-full bg-[var(--card-bg)] border-l border-[var(--border-soft)] shadow-2xl flex flex-col z-10">
              <div className="px-6 py-5 border-b border-[var(--border-soft)] flex justify-between items-center bg-[var(--bg-secondary)]/30">
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-tight">API Request usage Logs</h3>
                  <p className="text-[10px] text-[var(--text-secondary)] font-medium">Last 100 calls for Client ID {selectedPartnerForUsage.apiKey}</p>
                </div>
                <button onClick={() => setIsUsageLogOpen(false)} className="p-1.5 hover:bg-[var(--bg-secondary)] rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"><X className="w-5 h-5" /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {partnerUsagesLoading ? (
                  <p className="text-center text-xs py-8 animate-pulse text-[var(--text-secondary)]">Loading API usage events...</p>
                ) : partnerUsages.length === 0 ? (
                  <p className="text-center text-xs py-12 text-[var(--text-muted)]">No API usage records found for this partner.</p>
                ) : (
                  <div className="space-y-2 max-h-full overflow-y-auto">
                    {partnerUsages.map(usage => (
                      <div key={usage.id} className="p-3 bg-[var(--bg-secondary)]/15 border border-[var(--border-soft)] rounded-xl flex justify-between items-start gap-3 text-xs">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${usage.method === 'POST' ? 'bg-indigo-500/10 text-indigo-500 border border-indigo-500/20' : 'bg-blue-500/10 text-blue-500 border border-blue-500/20'}`}>{usage.method}</span>
                            <span className="font-mono font-bold text-[var(--text-primary)]">{usage.endpoint}</span>
                          </div>
                          <p className="text-[10px] text-[var(--text-muted)]">IP: {usage.ipAddress || "N/A"} • Latency: {usage.latency}ms</p>
                        </div>
                        <div className="text-right space-y-1 flex-shrink-0">
                          <span className={`px-2 py-0.5 text-[9px] font-black rounded border ${usage.statusCode >= 200 && usage.statusCode < 300 ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border-rose-500/20'}`}>
                            {usage.statusCode}
                          </span>
                          <p className="text-[9px] text-[var(--text-muted)]">{new Date(usage.createdAt).toLocaleTimeString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create Agreement Modal */}
      <AnimatePresence>
        {isCreateAgreementOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsCreateAgreementOpen(false)} className="absolute inset-0 bg-slate-900/60" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-lg bg-[var(--card-bg)] text-[var(--text-primary)] rounded-2xl border border-[var(--border-soft)] shadow-2xl overflow-hidden z-10 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center pb-2 border-b border-[var(--border-soft)]">
                <h3 className="text-sm font-black uppercase">Create Merchant Agreement</h3>
                <button type="button" onClick={() => setIsCreateAgreementOpen(false)} className="p-1.5 hover:bg-[var(--bg-secondary)] rounded-full cursor-pointer"><X className="w-4 h-4" /></button>
              </div>
              
              <form onSubmit={handleCreateAgreement} className="space-y-4">
                {/* Searchable manageable user selection */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Select Merchant *</label>
                  <input 
                    type="text" 
                    placeholder="Search manageable merchant by name, email, phone..." 
                    value={userAgreementSearchQuery}
                    onChange={(e) => setUserAgreementSearchQuery(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl text-xs text-[var(--text-primary)] outline-none"
                  />
                  
                  <div className="border border-[var(--border-soft)] rounded-xl max-h-[120px] overflow-y-auto bg-[var(--bg-secondary)]/20 divide-y divide-[var(--border-soft)]">
                    {manageableUsersLoading ? (
                      <p className="p-3 text-xs text-center text-[var(--text-secondary)]">Loading users...</p>
                    ) : (() => {
                      const query = userAgreementSearchQuery.toLowerCase().trim();
                      const filtered = manageableUsers.filter(u => 
                        u.name?.toLowerCase().includes(query) || 
                        u.email?.toLowerCase().includes(query) || 
                        u.phone?.includes(query)
                      );
                      if (filtered.length === 0) {
                        return <p className="p-3 text-xs text-center text-[var(--text-secondary)]">No matching merchants found</p>;
                      }
                      return filtered.map(u => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => {
                            setAgreementForm(prev => ({ ...prev, userId: u.id }));
                            setUserAgreementSearchQuery(`${u.name} (${u.phone || u.email})`);
                          }}
                          className={`w-full text-left px-3.5 py-2.5 text-xs transition-colors flex justify-between items-center ${agreementForm.userId === u.id ? 'bg-[var(--color-primary-glow)] text-[var(--color-primary)] font-bold' : 'hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                        >
                          <div>
                            <p className="font-bold">{u.name}</p>
                            <p className="text-[10px] opacity-75">{u.email} • {u.phone}</p>
                          </div>
                          <span className="text-[9px] font-black uppercase bg-[var(--bg-secondary)] border border-[var(--border-soft)] px-1.5 py-0.5 rounded">{u.role}</span>
                        </button>
                      ));
                    })()}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Agreement Title *</label>
                  <input 
                    type="text" 
                    required
                    placeholder="E.g., Distributor Master Agreement v1" 
                    value={agreementForm.title}
                    onChange={(e) => setAgreementForm(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-3.5 py-2 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl text-xs outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Agreement Content *</label>
                  <textarea 
                    required
                    placeholder="Paste the master contract clauses and terms here..." 
                    value={agreementForm.content}
                    onChange={(e) => setAgreementForm(prev => ({ ...prev, content: e.target.value }))}
                    className="w-full p-3.5 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl text-xs outline-none focus:ring-2 focus:ring-[var(--admin-focus-ring)] min-h-[140px]"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button 
                    type="button" 
                    onClick={() => setIsCreateAgreementOpen(false)} 
                    className="flex-1 py-2.5 border border-[var(--border-soft)] hover:bg-[var(--bg-secondary)] rounded-xl text-xs font-bold uppercase transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={createAgreementLoading}
                    className="flex-1 py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-white rounded-xl text-xs font-bold uppercase transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {createAgreementLoading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      "Create"
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Agreement Modal */}
      <AnimatePresence>
        {isEditAgreementOpen && selectedEditAgreement && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsEditAgreementOpen(false)} className="absolute inset-0 bg-slate-900/60" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-lg bg-[var(--card-bg)] text-[var(--text-primary)] rounded-2xl border border-[var(--border-soft)] shadow-2xl overflow-hidden z-10 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center pb-2 border-b border-[var(--border-soft)]">
                <h3 className="text-sm font-black uppercase">Edit Agreement Parameters</h3>
                <button type="button" onClick={() => setIsEditAgreementOpen(false)} className="p-1.5 hover:bg-[var(--bg-secondary)] rounded-full cursor-pointer"><X className="w-4 h-4" /></button>
              </div>
              
              <form onSubmit={handleUpdateAgreement} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Agreement Title *</label>
                  <input 
                    type="text" 
                    required
                    value={editAgreementForm.title}
                    onChange={(e) => setEditAgreementForm(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-3.5 py-2 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl text-xs outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Agreement Content *</label>
                  <textarea 
                    required
                    value={editAgreementForm.content}
                    onChange={(e) => setEditAgreementForm(prev => ({ ...prev, content: e.target.value }))}
                    className="w-full p-3.5 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl text-xs outline-none focus:ring-2 focus:ring-[var(--admin-focus-ring)] min-h-[140px]"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button 
                    type="button" 
                    onClick={() => setIsEditAgreementOpen(false)} 
                    className="flex-1 py-2.5 border border-[var(--border-soft)] hover:bg-[var(--bg-secondary)] rounded-xl text-xs font-bold uppercase transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={editAgreementLoading}
                    className="flex-1 py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-white rounded-xl text-xs font-bold uppercase transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {editAgreementLoading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Changes"
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Users;
