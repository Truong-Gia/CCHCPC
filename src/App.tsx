/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import { DocumentItem, LinhVucType, LINH_VUC_LABELS, UserProfile } from "./types";
import { loadDocuments, saveDocuments, INITIAL_DOCUMENTS } from "./mockData";
import DocumentForm from "./components/DocumentForm";
import DocumentTable from "./components/DocumentTable";
import LoginForm from "./components/LoginForm";
import { canCreateDocument, canEditDocument, canDeleteDocument } from "./roles";
import { 
  Plus, 
  HelpCircle, 
  RefreshCw, 
  FileText, 
  Database, 
  Layers, 
  CheckCircle, 
  Clock, 
  BookOpen, 
  ChevronRight, 
  Check, 
  Menu, 
  X, 
  Scale, 
  ShieldAlert,
  FolderOpen,
  AppWindow,
  Briefcase,
  FileSpreadsheet,
  ExternalLink
} from "lucide-react";

// Firebase Applet Integration Configuration
import { db, auth, handleFirestoreError, OperationType } from "./firebase";
import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut, 
  onAuthStateChanged,
  User 
} from "firebase/auth";
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc, 
  serverTimestamp 
} from "firebase/firestore";

export default function App() {
  // Toàn bộ danh sách văn bản nằm trong State
  const [documents, setDocuments] = useState<DocumentItem[]>([]);

  // Lĩnh vực đang hoạt động: "all" hoặc "linh_vuc_1", "linh_vuc_2", "linh_vuc_3"
  const [activeTab, setActiveTab] = useState<LinhVucType | "all">("all");

  // Đối với Quyết định lĩnh vực 1, có thêm subcategory filter
  const [subFolderFilter, setSubFolderFilter] = useState<boolean | undefined>(undefined);

  // Trạng thái hiển thị Form Modal
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<DocumentItem | null>(null);

  // Custom Confirmation Dialog states to bypass iframe sandbox restrictions on window.confirm
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Trạng thái hiển thị hướng dẫn sử dụng nhanh
  const [showHelp, setShowHelp] = useState(true);

  // Trạng thái toggle Sidebar trên thiết bị di động
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Firebase Auth and Database synchronizations status state
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Guest session ID for anonymous users to enable data sharing
  const [guestSessionId] = useState(() => {
    const stored = localStorage.getItem("guestSessionId");
    if (stored) return stored;
    const newId = `guest-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem("guestSessionId", newId);
    return newId;
  });

  // Listen to Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setAuthUser(currentUser);
      if (currentUser) {
        // Fetch user profile with role from Firestore
        const userRef = doc(db, "users", currentUser.uid);
        const unsubscribeProfile = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            setUserProfile(docSnap.data() as UserProfile);
          } else {
            // Create default user profile for new users
            const defaultProfile: UserProfile = {
              uid: currentUser.uid,
              email: currentUser.email || "",
              displayName: currentUser.displayName || "Cán bộ",
              role: "viewer", // Default role for new users
              isActive: true,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            };
            setDoc(userRef, defaultProfile, { merge: true })
              .then(() => setUserProfile(defaultProfile))
              .catch((err) => console.error("[v0] Failed to create user profile:", err));
          }
        });
        return () => unsubscribeProfile();
      } else {
        setUserProfile(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Email/Password Sign In
  const handleEmailSignIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      setErrorMessage(null);
      await signInWithEmailAndPassword(auth, email, password);
      console.log("[v0] Email sign-in successful:", email);
    } catch (err) {
      console.error("[v0] Sign in failed:", err);
      let errorMessage = "Đăng nhập thất bại";
      
      if (err instanceof Error) {
        const errorCode = (err as any).code;
        console.log("[v0] Error code:", errorCode);
        
        if (errorCode === "auth/operation-not-allowed") {
          errorMessage = "Email/mật khẩu chưa được bật trong Firebase Console. Vui lòng bật tính năng này trong Authentication settings.";
        } else if (errorCode === "auth/user-not-found") {
          errorMessage = "Email không được tìm thấy. Vui lòng tạo tài khoản trước.";
        } else if (errorCode === "auth/wrong-password") {
          errorMessage = "Mật khẩu không chính xác.";
        } else if (errorCode === "auth/invalid-email") {
          errorMessage = "Email không hợp lệ.";
        } else {
          errorMessage = "Lỗi: " + err.message;
        }
      }
      
      setErrorMessage(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Email/Password Sign Up
  const handleEmailSignUp = async (email: string, password: string, displayName: string) => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const result = await createUserWithEmailAndPassword(auth, email, password);
      
      // Update profile with display name
      await updateProfile(result.user, { displayName });
      
      console.log("[v0] Sign up successful:", email);
    } catch (err) {
      console.error("[v0] Sign up failed:", err);
      let errorMessage = "Tạo tài khoản thất bại";
      
      if (err instanceof Error) {
        const errorCode = (err as any).code;
        console.log("[v0] Error code:", errorCode);
        
        if (errorCode === "auth/operation-not-allowed") {
          errorMessage = "Email/mật khẩu chưa được bật trong Firebase Console. Vui lòng vào Authentication → Sign-in method → bật Email/Password.";
        } else if (errorCode === "auth/email-already-in-use") {
          errorMessage = "Email này đã được đăng ký.";
        } else if (errorCode === "auth/weak-password") {
          errorMessage = "Mật khẩu quá yếu. Vui lòng sử dụng mật khẩu mạnh hơn (ít nhất 6 ký tự).";
        } else if (errorCode === "auth/invalid-email") {
          errorMessage = "Email không hợp lệ.";
        } else {
          errorMessage = "Lỗi: " + err.message;
        }
      }
      
      setErrorMessage(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Sign out handler
  const handleSignOut = async () => {
    try {
      setLoading(true);
      await signOut(auth);
    } catch (err) {
      console.error("Sign out failed: ", err);
    } finally {
      setLoading(false);
    }
  };

  // Seeding Default Documents
  const seedDefaultDocuments = async (uid: string) => {
    try {
      setLoading(true);
      for (const docItem of INITIAL_DOCUMENTS) {
        const docRef = doc(db, "documents", docItem.id);
        await setDoc(docRef, {
          ...docItem,
          ownerId: uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      console.error("Auto seeding default data failed", err);
    } finally {
      setLoading(false);
    }
  };

  // Synchronize documents data (Real-time connection listener - ALWAYS use Shared system-wide database)
  useEffect(() => {
    setLoading(true);
    
    // Luôn luôn kết nối trực tiếp đến toàn bộ tài liệu dùng chung trên hệ thống đám mây
    const q = query(collection(db, "documents"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docsList: DocumentItem[] = [];
        snapshot.forEach((docSnap) => {
          // Tự động dọn dẹp các tài liệu mẫu cũ từ Firestore nếu còn tồn tại
          if (/^doc-00\d$/.test(docSnap.id) || docSnap.id === "doc-010") {
            if (auth.currentUser) {
              deleteDoc(doc(db, "documents", docSnap.id)).catch(() => {});
            }
            return;
          }
          const data = docSnap.data();
          docsList.push({
            id: docSnap.id,
            loaiVanBan: data.loaiVanBan,
            soBanHanh: data.soBanHanh || "",
            trichYeu: data.trichYeu,
            ngayBanHanh: data.ngayBanHanh,
            ngayCoHieuLuc: data.ngayCoHieuLuc,
            donViBanHanh: data.donViBanHanh,
            donViThamMuu: data.donViThamMuu,
            soVanBanTrinh: data.soVanBanTrinh,
            ngayTrinh: data.ngayTrinh,
            linhVuc: data.linhVuc,
            isQuyTrinhNoiBo: data.isQuyTrinhNoiBo,
            ghiChu: data.ghiChu,
            fileDinhKem: data.fileDinhKem || [],
            createdAt: data.createdAt,
            ownerId: data.ownerId || "",
          } as DocumentItem);
        });

        setDocuments(docsList);
        setLoading(false);

        // Seeding standard data when collection is pristine (Chỉ seed nếu đã đăng nhập)
        if (snapshot.empty && auth.currentUser) {
          seedDefaultDocuments(auth.currentUser.uid);
        }
      },
      (error) => {
        setLoading(false);
        console.warn("Firestore listener warning (guest or offline modes):", error);
        // Fallback to local offline cache
        setDocuments(loadDocuments());
      }
    );

    return () => unsubscribe();
  }, [authUser]);

  // Offline status mutator State
  const updateDocumentsState = (newDocs: DocumentItem[]) => {
    setDocuments(newDocs);
    saveDocuments(newDocs);
  };

  // Thao tác 1: Lưu (Thêm mới hoặc Cập nhật)
  const handleSaveDocument = async (savedDoc: DocumentItem) => {
    try {
      setLoading(true);
      setErrorMessage(null);
      
      const isEditing = documents.some((doc) => doc.id === savedDoc.id);
      
      // Check create permission for new documents
      if (!isEditing && !canCreateDocument(userProfile)) {
        setErrorMessage("Bạn không có quyền tạo văn bản mới. Vui lòng liên hệ với quản trị viên.");
        setLoading(false);
        return;
      }
      
      // Check edit permission for existing documents
      if (isEditing) {
        const origDoc = documents.find((doc) => doc.id === savedDoc.id);
        if (origDoc && !canEditDocument(userProfile, origDoc)) {
          setErrorMessage("Bạn không có quyền chỉnh sửa văn bản này. Chỉ người tạo hoặc quản trị viên mới có thể chỉnh sửa.");
          setLoading(false);
          return;
        }
      }
      
      const docRef = doc(db, "documents", savedDoc.id);
      const ownerId = authUser?.uid || guestSessionId;

      if (isEditing) {
        const origDoc = documents.find((doc) => doc.id === savedDoc.id);
        const origCreatedAt = origDoc?.createdAt || serverTimestamp();
        const origOwnerId = origDoc?.ownerId || ownerId;
        
        await setDoc(docRef, {
          id: savedDoc.id,
          loaiVanBan: savedDoc.loaiVanBan,
          soBanHanh: savedDoc.soBanHanh,
          trichYeu: savedDoc.trichYeu,
          ngayBanHanh: savedDoc.ngayBanHanh,
          ngayCoHieuLuc: savedDoc.ngayCoHieuLuc,
          donViBanHanh: savedDoc.donViBanHanh,
          donViThamMuu: savedDoc.donViThamMuu,
          soVanBanTrinh: savedDoc.soVanBanTrinh,
          ngayTrinh: savedDoc.ngayTrinh,
          linhVuc: savedDoc.linhVuc,
          isQuyTrinhNoiBo: savedDoc.isQuyTrinhNoiBo ?? false,
          ghiChu: savedDoc.ghiChu ?? "",
          fileDinhKem: savedDoc.fileDinhKem || [],
          ownerId: origOwnerId,
          createdAt: origCreatedAt,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(docRef, {
          id: savedDoc.id,
          loaiVanBan: savedDoc.loaiVanBan,
          soBanHanh: savedDoc.soBanHanh,
          trichYeu: savedDoc.trichYeu,
          ngayBanHanh: savedDoc.ngayBanHanh,
          ngayCoHieuLuc: savedDoc.ngayCoHieuLuc,
          donViBanHanh: savedDoc.donViBanHanh,
          donViThamMuu: savedDoc.donViThamMuu,
          soVanBanTrinh: savedDoc.soVanBanTrinh,
          ngayTrinh: savedDoc.ngayTrinh,
          linhVuc: savedDoc.linhVuc,
          isQuyTrinhNoiBo: savedDoc.isQuyTrinhNoiBo ?? false,
          ghiChu: savedDoc.ghiChu ?? "",
          fileDinhKem: savedDoc.fileDinhKem || [],
          ownerId: ownerId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      setIsFormOpen(false);
      setEditingDoc(null);
      console.log("[v0] Document saved with ownerId:", ownerId, "Role:", userProfile?.role);
    } catch (err) {
      console.error("[v0] Error saving document:", err);
      handleFirestoreError(err, isEditing ? OperationType.UPDATE : OperationType.CREATE, `documents/${savedDoc.id}`);
    } finally {
      setLoading(false);
    }
  };

  // Thao tác 2: Chỉnh sửa (Mở Modal nạp dữ liệu cũ)
  const handleEditDocument = (doc: DocumentItem) => {
    setEditingDoc(doc);
    setIsFormOpen(true);
  };

  // Thao tác 3: Nhân bản tài liệu (Mở Modal nạp sẵn thông tin nhưng id mới)
  const handleCloneDocument = (doc: DocumentItem) => {
    const clonedDoc: DocumentItem = {
      ...doc,
      id: `doc-clone-${Date.now()}`,
      soBanHanh: doc.soBanHanh ? `${doc.soBanHanh}/BS` : "",
      trichYeu: `(Bản sao) ${doc.trichYeu}`,
      soVanBanTrinh: doc.soVanBanTrinh ? `${doc.soVanBanTrinh}/BS` : "",
      createdAt: undefined,
    };
    setEditingDoc(clonedDoc);
    setIsFormOpen(true);
  };

  // Thao tác 4: Xóa văn bản
  const handleDeleteDocument = async (id: string) => {
    try {
      setLoading(true);
      setErrorMessage(null);
      
      const docToDelete = documents.find((doc) => doc.id === id);
      
      if (!docToDelete) {
        setErrorMessage("Không tìm thấy văn bản để xóa.");
        setLoading(false);
        return;
      }
      
      // Check delete permission
      if (!canDeleteDocument(userProfile, docToDelete)) {
        setErrorMessage("Bạn không có quyền xóa văn bản này. Chỉ người tạo hoặc quản trị viên mới có thể xóa.");
        setLoading(false);
        return;
      }
      
      await deleteDoc(doc(db, "documents", id));
      console.log("[v0] Document deleted successfully");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[v0] Delete document error:", msg);
      // Giúp người dùng nhìn thấy lỗi phân quyền một cách lịch sự, dễ hiểu
      if (msg.toLowerCase().includes("permission") || msg.toLowerCase().includes("quota") || msg.toLowerCase().includes("insufficient")) {
        setErrorMessage("Bạn không có quyền thực hiện thao tác xóa văn bản này, hoặc hạn ngạch cơ sở dữ liệu đã bị vượt quá. Vui lòng kiểm tra lại tài khoản chính chủ của bạn.");
      } else {
        setErrorMessage("Lỗi khi xóa văn bản: " + msg);
      }
      try {
        handleFirestoreError(err, OperationType.DELETE, `documents/${id}`);
      } catch (logErr) {
        // Nuốt lỗi log ném ra để tránh làm crash ứng dụng React đột ngột
      }
    } finally {
      setLoading(false);
    }
  };

  // Thao tác 5: Xóa sạch dữ liệu (qua Modal thay vì confirm)
  const handleResetToDefaults = () => {
    setShowResetConfirm(true);
  };

  const executeResetToDefaults = async () => {
    setShowResetConfirm(false);
    setErrorMessage(null);

    if (!authUser) {
      updateDocumentsState(INITIAL_DOCUMENTS);
      setActiveTab("all");
      setSubFolderFilter(undefined);
      return;
    }

    try {
      setLoading(true);
      // Xóa tất cả tài liệu cũ của người dùng này
      for (const d of documents) {
        await deleteDoc(doc(db, "documents", d.id));
      }
      // Nạp lại danh sách (đã bị làm trống)
      await seedDefaultDocuments(authUser.uid);
      setActiveTab("all");
      setSubFolderFilter(undefined);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Wipe configuration error", err);
      setErrorMessage("Không thể xóa sạch dữ liệu: " + msg);
    } finally {
      setLoading(false);
    }
  };

  // Tính toán số liệu thống kê trong thời gian thực
  const stats = useMemo(() => {
    const countAll = documents.length;
    const countL1 = documents.filter((d) => d.linhVuc === "linh_vuc_1").length;
    const countL1Sub = documents.filter((d) => d.linhVuc === "linh_vuc_1" && d.isQuyTrinhNoiBo).length;
    const countL1Main = countL1 - countL1Sub;
    const countL2 = documents.filter((d) => d.linhVuc === "linh_vuc_2").length;
    const countL3 = documents.filter((d) => d.linhVuc === "linh_vuc_3").length;

    // Phân tích trạng thái hiệu lực theo mốc hệ thống 2026-05-21
    const SYSTEM_DATE = new Date("2026-05-21");
    let active = 0;
    let pending = 0;
    let expired = 0;

    documents.forEach((d) => {
      if (d.ghiChu?.toLowerCase().includes("hết hiệu lực")) {
        expired++;
      } else if (new Date(d.ngayCoHieuLuc) > SYSTEM_DATE) {
        pending++;
      } else {
        active++;
      }
    });

    return {
      countAll,
      countL1,
      countL1Main,
      countL1Sub,
      countL2,
      countL3,
      active,
      pending,
      expired,
    };
  }, [documents]);

  // Show login form if user is not authenticated
  if (!authUser) {
    return (
      <LoginForm
        onSignIn={handleEmailSignIn}
        onSignUp={handleEmailSignUp}
        isLoading={loading}
        externalError={errorMessage}
        onClearError={() => setErrorMessage(null)}
      />
    );
  }

  return (
    <div className="h-screen flex flex-col lg:flex-row overflow-hidden bg-slate-50 text-slate-900 font-sans">
      
      {/* ================= SIDEBAR TRÁI - PROFESSIONAL POLISH ARCHITECTURE ================= */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-72 bg-slate-900 border-r border-slate-800 text-slate-200 flex flex-col shrink-0 transition-transform duration-300 ease-in-out lg:static lg:translate-x-0
        ${mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"}
      `}>
        {/* LOGO & BRAND ZONE */}
        <div className="h-16 px-6 flex items-center justify-between border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 flex items-center justify-center rounded-xl bg-blue-600/10 text-blue-500 border border-blue-500/25">
              <Scale size={18} />
            </div>
            <div>
              <h1 className="text-xs font-bold tracking-widest text-slate-400 uppercase leading-none">
                Cổng dữ liệu
              </h1>
              <p className="text-sm font-extrabold text-white mt-1">
                CCHC & PHÁP CHẾ
              </p>
            </div>
          </div>
          {/* Mobile close button */}
          <button 
            type="button"
            onClick={() => setMobileSidebarOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {/* NAVIGATION ZONE */}
        <nav className="flex-1 p-4 overflow-y-auto space-y-6">
          <div className="space-y-1">
            <span className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">
              Lĩnh vực cốt lõi
            </span>

            {/* TAB: Tất cả */}
            <button
              type="button"
              id="sidebar-tab-all"
              onClick={() => {
                setActiveTab("all");
                setSubFolderFilter(undefined);
                setMobileSidebarOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-xs font-bold transition-all ${
                activeTab === "all"
                  ? "bg-slate-800 text-white shadow-xs"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-sm">★</span>
                <span>Tất cả lĩnh vực</span>
              </div>
              <span className="px-2 py-0.5 rounded-md bg-slate-950/65 text-slate-400 text-[10px] font-mono font-medium">
                {stats.countAll}
              </span>
            </button>

            {/* TAB: Lĩnh vực 1 */}
            <button
              type="button"
              id="sidebar-tab-l1"
              onClick={() => {
                setActiveTab("linh_vuc_1");
                setSubFolderFilter(undefined);
                setMobileSidebarOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-xs font-bold transition-all mt-1 ${
                activeTab === "linh_vuc_1"
                  ? "bg-slate-800 text-white shadow-xs"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <FolderOpen size={14} className="text-blue-500" />
                <span>1. Quyết định công bố TTHC & Quy trình nội bộ</span>
              </div>
              <span className="px-2 py-0.5 rounded-md bg-slate-950/65 text-slate-400 text-[10px] font-mono font-medium">
                {stats.countL1}
              </span>
            </button>

            {/* Cây thư mục con của Lĩnh vực 1 */}
            {activeTab === "linh_vuc_1" && (
              <div className="ml-6 pl-3 border-l border-slate-800 space-y-1 mt-1 mb-2">
                <button
                  type="button"
                  id="sub-all"
                  onClick={() => setSubFolderFilter(undefined)}
                  className={`w-full text-left py-1.5 px-2 rounded text-[11px] font-medium transition-colors ${
                    subFolderFilter === undefined 
                      ? "text-blue-400 font-semibold" 
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  📖 Tất cả quy trình
                </button>
                <button
                  type="button"
                  id="sub-main"
                  onClick={() => setSubFolderFilter(false)}
                  className={`w-full text-left py-1.5 px-2 rounded text-[11px] font-medium transition-colors ${
                    subFolderFilter === false 
                      ? "text-blue-400 font-semibold" 
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  ⚖️ Quyết định Công bố TTHC
                </button>
                <button
                  type="button"
                  id="sub-sub"
                  onClick={() => setSubFolderFilter(true)}
                  className={`w-full text-left py-1.5 px-2 rounded text-[11px] font-medium transition-colors ${
                    subFolderFilter === true 
                      ? "text-blue-400 font-semibold" 
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  📂 Quyết định ban hành Quy trình nội bộ
                </button>
              </div>
            )}

            {/* TAB: Lĩnh vực 2 */}
            <button
              type="button"
              id="sidebar-tab-l2"
              onClick={() => {
                setActiveTab("linh_vuc_2");
                setSubFolderFilter(undefined);
                setMobileSidebarOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-xs font-bold transition-all mt-1 ${
                activeTab === "linh_vuc_2"
                  ? "bg-slate-800 text-white shadow-xs"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Briefcase size={14} className="text-amber-500" />
                <span>2. Quyết định ủy quyền</span>
              </div>
              <span className="px-2 py-0.5 rounded-md bg-slate-950/65 text-slate-400 text-[10px] font-mono font-medium">
                {stats.countL2}
              </span>
            </button>

            {/* TAB: Lĩnh vực 3 */}
            <button
              type="button"
              id="sidebar-tab-l3"
              onClick={() => {
                setActiveTab("linh_vuc_3");
                setSubFolderFilter(undefined);
                setMobileSidebarOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-xs font-bold transition-all mt-1 ${
                activeTab === "linh_vuc_3"
                  ? "bg-slate-800 text-white shadow-xs"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <AppWindow size={14} className="text-purple-500" />
                <span>3. Văn bản Quy phạm pháp luật</span>
              </div>
              <span className="px-2 py-0.5 rounded-md bg-slate-950/65 text-slate-400 text-[10px] font-mono font-medium">
                {stats.countL3}
              </span>
            </button>
          </div>

          {/* LIÊN KẾT WEBSITE */}
          <div className="space-y-1 border-t border-slate-800/60 pt-4">
            <span className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">
              Liên kết Website
            </span>
            <div className="space-y-1">
              <a
                href="https://stvb-two.vercel.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-between px-3 py-1.5 text-slate-400 hover:text-white hover:bg-slate-800/60 text-xs font-semibold rounded-xl text-left transition-colors cursor-pointer group"
                title="Trợ lý AI soạn thảo văn bản"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-purple-400 shrink-0 select-none">✨</span>
                  <span className="truncate">1. Trợ lý AI soạn thảo văn bản</span>
                </div>
                <ExternalLink size={10} className="text-slate-600 group-hover:text-slate-400 shrink-0 transition-colors" />
              </a>

              <a
                href="https://lamdong.gov.vn/"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-between px-3 py-1.5 text-slate-400 hover:text-white hover:bg-slate-800/60 text-xs font-semibold rounded-xl text-left transition-colors cursor-pointer group"
                title="Trang Thông tin điện tử Sở Công Thương"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-emerald-400 shrink-0 select-none">🌐</span>
                  <span className="truncate">2. Trang TTĐT Sở Công Thương</span>
                </div>
                <ExternalLink size={10} className="text-slate-600 group-hover:text-slate-400 shrink-0 transition-colors" />
              </a>

              <a
                href="https://qlvb.lamdong.gov.vn/"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-between px-3 py-1.5 text-slate-400 hover:text-white hover:bg-slate-800/60 text-xs font-semibold rounded-xl text-left transition-colors cursor-pointer group"
                title="Hệ thống Quản lý văn bản và điều hành"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-blue-400 shrink-0 select-none">📂</span>
                  <span className="truncate">3. Hệ thống QLVB và điều hành</span>
                </div>
                <ExternalLink size={10} className="text-slate-600 group-hover:text-slate-400 shrink-0 transition-colors" />
              </a>
            </div>
          </div>

          {/* DỮ LIỆU LIÊN QUAN */}
          <div className="space-y-1 border-t border-slate-800/60 pt-4">
            <span className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">
              Quản lý dữ liệu
            </span>
            <button
              type="button"
              onClick={handleResetToDefaults}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 text-xs font-semibold rounded-xl text-left transition-colors cursor-pointer"
            >
              <RefreshCw size={13} className="text-red-400" />
              <span>Xóa sạch dữ liệu</span>
            </button>
          </div>

          
        </nav>

        {/* PROFILE ZONE - EMAIL/PASSWORD AUTH */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/30">
          {authUser && userProfile ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                  {userProfile.displayName?.substring(0, 2).toUpperCase() || "US"}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate">{userProfile.displayName || "Cán bộ"}</p>
                  <p className="text-[10px] text-emerald-400 truncate mt-0.5 font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    {userProfile.role === "admin" ? "Quản trị viên" : userProfile.role === "staff" ? "Nhân viên" : "Xem"}
                  </p>
                </div>
              </div>
              <button 
                onClick={handleSignOut}
                className="text-[11px] text-slate-500 hover:text-rose-450 font-bold ml-2 cursor-pointer transition-colors"
                title="Đăng xuất"
              >
                Thoát
              </button>
            </div>
          ) : (
            <div className="text-[10px] text-slate-300 leading-normal">
              <p className="mb-2">Đăng nhập để quản lý tài liệu trên Cloud</p>
            </div>
          )}
        </div>
      </aside>

      {/* BACKGROUND BACKDROP ON MOBILE */}
      {mobileSidebarOpen && (
        <div 
          onClick={() => setMobileSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-slate-950/50 backdrop-blur-xs lg:hidden"
        ></div>
      )}

      {/* ================= MAIN CONTENT AREA ================= */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        
        {/* HEADER CỐ ĐỊNH PHẨN PROFESSIONAL POLISH */}
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 select-none">
          {/* Left info or toggle */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 lg:hidden focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            >
              <Menu size={20} />
            </button>
            <div>
              <span className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">
                Hệ thống số hóa
              </span>
              <h2 className="text-sm font-bold text-slate-800 mt-0.5 uppercase tracking-tight">
                {activeTab === "all" ? "Tất cả lĩnh vực quản lý" : LINH_VUC_LABELS[activeTab]}
              </h2>
            </div>
          </div>

          {/* Right action controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowHelp(!showHelp)}
              title="Hướng dẫn nhanh"
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <HelpCircle size={18} />
            </button>

            <button
              onClick={() => {
                setEditingDoc(null);
                setIsFormOpen(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs hover:shadow-sm transition-all text-justify uppercase tracking-wide"
            >
              <Plus size={15} />
              Thêm quyết định
            </button>
          </div>
        </header>

        {/* CONTAINER CHÂN TRỰC KẾT QUẢ - DÀNH CHO BÊN TRONG CỦA CHÚNG TA */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Error Message Banner */}
          {errorMessage && (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-2xl flex items-start justify-between gap-3 animate-in fade-in duration-200">
              <div className="flex gap-2.5 items-start">
                <ShieldAlert className="text-rose-500 shrink-0 mt-0.5 animate-bounce" size={16} />
                <div>
                  <p className="font-bold text-rose-900">Lưu ý hệ thống:</p>
                  <p className="mt-0.5 leading-relaxed font-semibold">{errorMessage}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="text-rose-500 hover:text-rose-700 font-bold hover:bg-rose-100/50 px-2 py-1 rounded-lg text-[10px] uppercase cursor-pointer"
              >
                Đóng
              </button>
            </div>
          )}
          
          {/* Hộp hướng dẫn tác vụ thông minh của hệ thống */}
          {showHelp && (
            <div className="relative bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
              <button
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 font-bold text-xs"
                onClick={() => setShowHelp(false)}
              >
                Đóng [X]
              </button>
              <h4 className="text-slate-900 font-bold text-sm flex items-center gap-1.5">
                <span>💡 Hướng dẫn nghiệp vụ & Tính năng nền tảng:</span>
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-500 leading-relaxed">
                <ul className="list-disc pl-4 space-y-1 text-slate-600">
                  <li>
                    <strong className="text-slate-800">Cơ chế 3 Lĩnh vực:</strong> Truy cập các tab điều hướng bên trái để lọc nhanh tài liệu theo đúng nghiệp vụ.
                  </li>
                  <li>
                    <strong className="text-slate-800">Thư mục con (Quy trình nội bộ):</strong> Đối với <span className="underline decoration-slate-300 font-medium">Mục 1</span>, chọn lọc các quy trình nội bộ thông qua cây thư mục.
                  </li>
                  <li>
                    <strong className="text-slate-800">Trích xuất nội dung:</strong> Sử dụng phím lệnh <strong className="text-emerald-600">Xuất file Excel</strong> từ giao diện bảng để nhận ngay tệp CSV lưu trữ chuẩn UTF-8 BOM.
                  </li>
                </ul>
                <ul className="list-disc pl-4 space-y-1 text-slate-600">
                  <li>
                    <strong className="text-slate-800">Nhân bản sao chép nhanh:</strong> Nhấp vào icon Sao chép nằm giữa cột Thao tác để nhân bản nội dung văn bản đang chọn để tạo nhanh văn bản tương tự.
                  </li>
                  <li>
                    <strong className="text-slate-800">Cập nhật hạn văn bản:</strong> Hệ thống so khớp ngày hiệu lực tự động dựa trên thời gian của hệ thống (<code className="bg-slate-100 px-1 py-0.5 border border-slate-200 rounded text-[11px] font-mono">21/05/2026</code>).
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* ================= BENTO GRAPH STATS - POLISHED DESIGN ================= */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Card 1: Tổng văn bản */}
            <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-3xs flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block">Dữ liệu hồ sơ</span>
                <p className="text-2xl font-extrabold text-slate-900 font-mono tracking-tight leading-none pt-1">
                  {stats.countAll}
                </p>
                <span className="text-[10px] text-slate-500 block">Quyết định hiện hành</span>
              </div>
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shrink-0">
                <Database size={18} />
              </div>
            </div>

            {/* Card 2: Lĩnh vực 1 */}
            <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-3xs flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block">Công bố & Quy trình</span>
                <p className="text-2xl font-extrabold text-slate-900 font-mono tracking-tight leading-none pt-1">
                  {stats.countL1}
                </p>
                <div className="flex gap-1.5 text-[9px] text-slate-400 font-semibold">
                  <span>TTHC: <strong className="text-slate-750">{stats.countL1Main}</strong></span>
                  <span>• QT: <strong className="text-blue-600">{stats.countL1Sub}</strong></span>
                </div>
              </div>
              <div className="p-2.5 bg-sky-50 text-sky-600 rounded-xl border border-sky-100 shrink-0">
                <Layers size={18} />
              </div>
            </div>

            {/* Card 3: Trạng thái áp dụng */}
            <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-3xs flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block">Đang hiệu lực</span>
                <p className="text-2xl font-extrabold text-emerald-600 font-mono tracking-tight leading-none pt-1">
                  {stats.active}
                </p>
                <div className="flex gap-1.5 text-[9px] font-semibold">
                  <span className="text-indigo-600">Chờ hiệu lực: {stats.pending}</span>
                </div>
              </div>
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 shrink-0">
                <CheckCircle size={18} />
              </div>
            </div>

            {/* Card 4: Tổng Ủy quyền & QPPL */}
            <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-3xs flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block">Ủy quyền & QPPL Pháp Chế</span>
                <p className="text-2xl font-extrabold text-slate-900 font-mono tracking-tight leading-none pt-1">
                  {stats.countL2 + stats.countL3}
                </p>
                <div className="flex gap-1.5 text-[9px] text-slate-400 font-semibold">
                  <span>UQ: <strong className="text-slate-700">{stats.countL2}</strong></span>
                  <span>• QPPL: <strong className="text-slate-700">{stats.countL3}</strong></span>
                </div>
              </div>
              <div className="p-2.5 bg-slate-50 text-slate-600 rounded-xl border border-slate-200 shrink-0">
                <BookOpen size={18} className="stroke-1.5" />
              </div>
            </div>

          </section>

          {/* ================= BẢNG CHÍNH VÀ BIỂU DIỄN KẾT QUẢ CÁC VẤN ĐỀ ================= */}
          <section className="space-y-3">
            
            {/* Thanh hiển thị vị trí nghiệp vụ hiện tại */}
            <div className="flex items-center gap-2 text-xs text-slate-400 font-bold mb-1">
              <span>Nghiệp vụ hiện tại:</span>
              <ChevronRight size={12} className="text-slate-400" />
              <span className="text-blue-600 font-extrabold">
                {activeTab === "all" ? "TẤT CẢ LĨNH VỰC" : LINH_VUC_LABELS[activeTab].toUpperCase()}
              </span>
              {activeTab === "linh_vuc_1" && (
                <>
                  <ChevronRight size={12} />
                  <span className="text-slate-705 underline">
                    {subFolderFilter === undefined
                      ? "Toàn bộ tài liệu mục"
                      : subFolderFilter
                      ? "Chỉ thư mục con: Quyết định quy trình nội bộ"
                      : "Chỉ Quyết định công bố TTHC"}
                  </span>
                </>
              )}
            </div>

            {/* BẢNG SỐ LIỆU */}
            <DocumentTable
              documents={documents}
              onEdit={handleEditDocument}
              onDelete={handleDeleteDocument}
              onClone={handleCloneDocument}
              activeLinhVuc={activeTab}
              currentSubFolder={subFolderFilter}
            />

          </section>

          {/* ================= FOOTER BẢO HÀNH CHUYÊN NGHIỆP ================= */}
          <footer className="pt-10 pb-6 text-center text-slate-400 text-xs">
            <p className="font-bold tracking-wider uppercase text-slate-500 text-[10px]">
              Hệ thống điện tử cải cách hành chính & Pháp chế
            </p>
            <p className="max-w-xl mx-auto mt-2 text-slate-400 leading-relaxed text-[11px]">
              Lưu trữ hồ sơ, rà soát văn bản lập quy, quyết định thẩm quyền tham mưu của cơ quan hành chính tỉnh. Bản quyền thuộc Văn phòng Sở Công Thương tỉnh Lâm Đồng năm 2026.
            </p>
          </footer>

        </div>

      </div>

      {/* ================= MODAL THÊM MỚI VÀ CHỈNH SỬA ================= */}
      {isFormOpen && (
        <DocumentForm
          documentToEdit={editingDoc}
          onSave={handleSaveDocument}
          onClose={() => {
            setIsFormOpen(false);
            setEditingDoc(null);
          }}
          currentActiveLinhVuc={activeTab}
        />
      )}

      {/* Custom Reset Confirmation Modal overlay */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in duration-200">
            {/* Header */}
            <div className="bg-slate-900 px-5 py-4 text-white flex items-center gap-2.5">
              <RefreshCw className="text-red-500 shrink-0 animate-spin" size={18} />
              <span className="font-bold text-sm">Xác nhận xóa sạch toàn bộ dữ liệu</span>
            </div>
            {/* Body */}
            <div className="p-5 space-y-3.5">
              <p className="text-slate-600 text-xs leading-relaxed">
                Bạn thực sự muốn xóa sạch toàn bộ dữ liệu không? Thao tác này sẽ xóa tất cả văn bản, quyết định hiện có và không thể khôi phục lại.
              </p>
            </div>
            {/* Footer */}
            <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2 text-xs font-bold">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={executeResetToDefaults}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors cursor-pointer shadow-xs"
              >
                Đồng ý xóa sạch
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
