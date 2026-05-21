/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { DocumentItem, LoaiVanBan, DonViBanHanh, LINH_VUC_LABELS, LinhVucType, formatYMDtoDMY } from "../types";
import { Search, FileDown, Edit, Trash2, Calendar, FileText, CheckCircle2, AlertCircle, Clock, Copy, RefreshCw } from "lucide-react";
import { exportToCSV } from "../exportUtils";

interface DocumentTableProps {
  documents: DocumentItem[];
  onEdit: (doc: DocumentItem) => void;
  onDelete: (id: string) => void;
  onClone: (doc: DocumentItem) => void;
  activeLinhVuc: LinhVucType | "all";
  currentSubFolder?: boolean; // Nếu true, chỉ hiển thị tài liệu thuộc thư mục con quy trình nội bộ
}

export default function DocumentTable({
  documents,
  onEdit,
  onDelete,
  onClone,
  activeLinhVuc,
  currentSubFolder,
}: DocumentTableProps) {
  // Bộ lọc
  const [searchTerm, setSearchTerm] = useState("");
  const [filterLoai, setFilterLoai] = useState<string>("all");
  const [filterCoQuan, setFilterCoQuan] = useState<string>("all");
  const [filterTrangThai, setFilterTrangThai] = useState<string>("all");

  // Trạng thái xác nhận xóa bằng Modal tùy chỉnh (tránh bị chặn bởi iframe sandbox)
  const [docToDelete, setDocToDelete] = useState<DocumentItem | null>(null);

  // Định nghĩa mốc thời gian hệ thống giả định để tính trạng thái hiệu lực
  const SYSTEM_CURRENT_DATE = "2026-05-21";

  // Phân trang
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Lọc danh sách theo Lĩnh vực đang chọn + Thư mục con của Lĩnh vực 1
  const filteredByLinhVuc = useMemo(() => {
    return documents.filter((doc) => {
      // Lọc theo Lĩnh vực
      if (activeLinhVuc !== "all" && doc.linhVuc !== activeLinhVuc) {
        return false;
      }
      // Lọc theo thư mục con riêng biệt (isQuyTrinhNoiBo)
      if (activeLinhVuc === "linh_vuc_1" && currentSubFolder !== undefined) {
        return doc.isQuyTrinhNoiBo === currentSubFolder;
      }
      return true;
    });
  }, [documents, activeLinhVuc, currentSubFolder]);

  // Áp dụng tìm kiếm hành chính và các dropdown lọc
  const finalFilteredDocs = useMemo(() => {
    return filteredByLinhVuc.filter((doc) => {
      // 1. Tìm kiếm chuỗi văn bản (Trích yếu, Số ban hành, Đơn vị tham mưu, Số văn bản trình)
      const matchesSearch =
        doc.trichYeu.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (doc.soBanHanh && doc.soBanHanh.toLowerCase().includes(searchTerm.toLowerCase())) ||
        doc.donViThamMuu.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.soVanBanTrinh.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (doc.ghiChu && doc.ghiChu.toLowerCase().includes(searchTerm.toLowerCase()));

      // 2. Lọc theo Loại văn bản
      const matchesLoai = filterLoai === "all" || doc.loaiVanBan === filterLoai;

      // 3. Lọc theo cơ quan ban hành
      const matchesCoQuan = filterCoQuan === "all" || doc.donViBanHanh === filterCoQuan;

      // 4. Lọc theo trạng thái hiệu lực (tính từ mốc SYSTEM_CURRENT_DATE: 2026-05-21)
      let matchesTrangThai = true;
      const effectiveDate = new Date(doc.ngayCoHieuLuc);
      const today = new Date(SYSTEM_CURRENT_DATE);

      // Quy ước trạng thái: 
      // - Chờ hiệu lực (Chưa đến ngày hiệu lực)
      // - Có hiệu lực (Từ ngày hiệu lực đến nay)
      // - Hết hiệu lực (Có chữ 'Hết hiệu lực' trong ghi chú hoặc người dùng chủ động đánh dấu)
      const checkStatus = () => {
        if (doc.ghiChu?.toLowerCase().includes("hết hiệu lực")) {
          return "expired";
        }
        if (effectiveDate > today) {
          return "pending";
        }
        return "active";
      };

      if (filterTrangThai !== "all") {
        matchesTrangThai = checkStatus() === filterTrangThai;
      }

      return matchesSearch && matchesLoai && matchesCoQuan && matchesTrangThai;
    });
  }, [filteredByLinhVuc, searchTerm, filterLoai, filterCoQuan, filterTrangThai]);

  // Trả trang về 1 khi đổi bộ lọc
  const handleFilterChange = (setter: Function, value: string) => {
    setter(value);
    setCurrentPage(1);
  };

  // Tính trạng thái hiệu lực cho hiển thị dòng
  const getDocStatus = (doc: DocumentItem) => {
    if (doc.ghiChu?.toLowerCase().includes("hết hiệu lực")) {
      return {
        label: "Hết hiệu lực",
        color: "bg-rose-50 text-rose-700 border-rose-200",
        bullet: "bg-rose-500",
        icon: <AlertCircle size={14} className="text-rose-500 shrink-0" />
      };
    }
    const effDate = new Date(doc.ngayCoHieuLuc);
    const today = new Date(SYSTEM_CURRENT_DATE);
    if (effDate > today) {
      return {
        label: "Chờ hiệu lực",
        color: "bg-sky-50 text-sky-700 border-sky-200",
        bullet: "bg-sky-500",
        icon: <Clock size={14} className="text-sky-500 shrink-0" />
      };
    }
    return {
      label: "Đang hiệu lực",
      color: "bg-emerald-50 text-emerald-700 border-emerald-200",
      bullet: "bg-emerald-500",
      icon: <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
    };
  };

  // Tính toán phân trang
  const totalPages = Math.ceil(finalFilteredDocs.length / itemsPerPage) || 1;
  const paginatedDocs = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return finalFilteredDocs.slice(startIndex, startIndex + itemsPerPage);
  }, [finalFilteredDocs, currentPage]);

  const handleExport = () => {
    let titleStr = "Tất cả lĩnh vực";
    if (activeLinhVuc !== "all") {
      titleStr = LINH_VUC_LABELS[activeLinhVuc];
      if (activeLinhVuc === "linh_vuc_1") {
        titleStr += currentSubFolder ? " - Quy trình nội bộ" : " - Công bố TTHC";
      }
    }
    exportToCSV(finalFilteredDocs, titleStr);
  };

  const handleResetFilters = () => {
    setSearchTerm("");
    setFilterLoai("all");
    setFilterCoQuan("all");
    setFilterTrangThai("all");
    setCurrentPage(1);
  };

  return (
    <div className="space-y-4">
      {/* 1. Phần tìm kiếm bộ lọc nhanh phong cách hiện đại chuyên nghiệp */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col xl:flex-row gap-3">
          {/* Ô tìm kiếm từ khóa chính */}
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
              <Search size={16} />
            </span>
            <input
              type="text"
              id="tbl-search-input"
              value={searchTerm}
              onChange={(e) => handleFilterChange(setSearchTerm, e.target.value)}
              placeholder="Tìm kiếm trích yếu, số văn bản trình, đơn vị chủ trì tham mưu..."
              className="w-full bg-slate-50 border border-slate-200 rounded-full pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all placeholder:text-slate-400"
            />
          </div>

          {/* Các bộ lọc bổ trợ */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 shrink-0">
            {/* Bộ lọc loại văn bản */}
            <div>
              <select
                id="tbl-filter-loai"
                value={filterLoai}
                onChange={(e) => handleFilterChange(setFilterLoai, e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              >
                <option value="all">Loại VB: Tất cả</option>
                <option value="Quyết định">📜 Quyết định</option>
                <option value="Nghị quyết">📝 Nghị quyết</option>
              </select>
            </div>

            {/* Bộ lọc đơn vị ban hành */}
            <div>
              <select
                id="tbl-filter-co-quan"
                value={filterCoQuan}
                onChange={(e) => handleFilterChange(setFilterCoQuan, e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              >
                <option value="all">Ban hành: Tất cả</option>
                <option value="Ủy ban nhân dân tỉnh">UBND tỉnh</option>
                <option value="Hội đồng nhân dân tỉnh">HĐND tỉnh</option>
              </select>
            </div>

            {/* Bộ lọc trạng thái hiệu lực */}
            <div className="col-span-2 sm:col-span-1">
              <select
                id="tbl-filter-trang-thai"
                value={filterTrangThai}
                onChange={(e) => handleFilterChange(setFilterTrangThai, e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              >
                <option value="all">Trạng thái: Tất cả</option>
                <option value="active">🟢 Đang hiệu lực</option>
                <option value="pending">🔵 Chờ hiệu lực</option>
                <option value="expired">🔴 Hết hiệu lực</option>
              </select>
            </div>
          </div>
        </div>

        {/* Thanh trạng thái hoạt động của bộ lọc */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="text-xs text-slate-500 font-medium">
            Phát hiện <span className="text-blue-600 font-bold">{finalFilteredDocs.length}</span> kết quả văn bản phù hợp
          </div>

          <div className="flex items-center gap-2">
            {(searchTerm || filterLoai !== "all" || filterCoQuan !== "all" || filterTrangThai !== "all") && (
              <button
                type="button"
                id="btn-clear-filters"
                onClick={handleResetFilters}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 rounded-lg transition-colors"
              >
                <RefreshCw size={12} />
                Đặt lại bộ lọc
              </button>
            )}

            {/* NÚT XUẤT EXCEL - HOÀN TOÀN TRÙNG KHỚP THEME EMERALD */}
            <button
              type="button"
              id="btn-export-excel"
              onClick={handleExport}
              disabled={finalFilteredDocs.length === 0}
              className={`flex items-center gap-2 px-4 py-1.5 text-xs font-semibold rounded-lg transition-all shadow-xs ${
                finalFilteredDocs.length > 0
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                  : "bg-slate-100 text-slate-400 cursor-not-allowed"
              }`}
            >
              <FileDown size={14} />
              Xuất file Excel
            </button>
          </div>
        </div>
      </div>

      {/* 2. Bảng Danh sách Văn bản - Professional Polish */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse" id="main-document-table">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-5 py-3.5 text-center w-12">STT</th>
                <th className="px-4 py-3.5 w-24">Loại</th>
                <th className="px-4 py-3.5 w-40">Số ban hành</th>
                <th className="px-5 py-3.5 min-w-[340px]">Nội dung trích yếu</th>
                <th className="px-4 py-3.5 w-44">Thời hiệu văn bản</th>
                <th className="px-4 py-3.5 w-44">Cơ quan ban hành</th>
                <th className="px-4 py-3.5 w-44">Đơn vị trình ký</th>
                <th className="px-5 py-3.5 text-center w-32">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {paginatedDocs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <FileText size={36} className="text-slate-300 stroke-1.5" />
                      <p className="text-sm">Không tìm thấy tài liệu nào khớp với bộ lọc!</p>
                      <button 
                        type="button" 
                        onClick={handleResetFilters}
                        className="text-xs text-blue-600 font-bold hover:underline"
                      >
                        Xóa tất cả bộ lọc
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedDocs.map((doc, idx) => {
                  const status = getDocStatus(doc);
                  const isLinhVuc_1 = doc.linhVuc === "linh_vuc_1";
                  return (
                    <tr 
                      key={doc.id}
                      className="hover:bg-slate-50/80 transition-colors duration-150 align-top"
                    >
                      {/* Cột 1: STT */}
                      <td className="px-5 py-4 text-center font-mono text-xs text-slate-400">
                        {(currentPage - 1) * itemsPerPage + idx + 1}
                      </td>

                      {/* Cột 2: Loại văn bản */}
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          doc.loaiVanBan === "Nghị quyết"
                            ? "bg-purple-100 text-purple-700"
                            : "bg-amber-100 text-amber-700"
                        }`}>
                          {doc.loaiVanBan}
                        </span>
                      </td>

                      {/* Cột 2.5: Số ban hành */}
                      <td className="px-4 py-4 font-semibold text-xs text-slate-800">
                        {doc.soBanHanh || "—"}
                      </td>

                      {/* Cột 3: Trích yếu */}
                      <td className="px-5 py-4">
                        <div className="space-y-1.5">
                          {/* Trích yếu chính */}
                          <p className="text-slate-900 font-medium leading-relaxed text-justify">
                            {doc.trichYeu}
                          </p>

                          {/* Nhãn gắn kết danh mục */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            {/* Trạng thái hiệu lực */}
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${status.color}`}>
                              {status.icon}
                              <span>{status.label}</span>
                            </span>

                            {/* Chỉ báo lĩnh vực phụ nếu hiển thị chế độ "Tất cả" */}
                            {activeLinhVuc === "all" && (
                              <span className="inline-block text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                {LINH_VUC_LABELS[doc.linhVuc].length > 40
                                  ? LINH_VUC_LABELS[doc.linhVuc].substring(0, 40) + "..."
                                  : LINH_VUC_LABELS[doc.linhVuc]}
                              </span>
                            )}

                            {/* Thư mục con "Quy trình nội bộ" */}
                            {isLinhVuc_1 && doc.isQuyTrinhNoiBo && (
                              <span className="inline-block text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded">
                                📁 Quy trình nội bộ
                              </span>
                            )}

                            {doc.ghiChu && (
                              <span className="italic text-xs text-slate-400">
                                ({doc.ghiChu})
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Cột 4: Ngày ban hành & Hiệu lực */}
                      <td className="px-4 py-4 font-mono text-xs text-slate-500 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 w-8">Ban:</span>
                          <span className="text-slate-700 font-medium">
                            {formatYMDtoDMY(doc.ngayBanHanh)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 w-8">Hiệu:</span>
                          <span className="text-slate-800 font-semibold">
                            {formatYMDtoDMY(doc.ngayCoHieuLuc)}
                          </span>
                        </div>
                      </td>

                      {/* Cột 5: Đơn vị ban hành (Professional Polish styles) */}
                      <td className="px-4 py-4">
                        <span className={`inline-block px-2.5 py-0.5 text-xs font-semibold rounded-full ${
                          doc.donViBanHanh === "Ủy ban nhân dân tỉnh"
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : "bg-slate-100 text-slate-700 border border-slate-300"
                        }`}>
                          {doc.donViBanHanh === "Ủy ban nhân dân tỉnh" ? "UBND Tỉnh" : "HĐND Tỉnh"}
                        </span>
                      </td>

                      {/* Cột 6: Đơn vị tham mưu & Trình duyệt */}
                      <td className="px-4 py-4 text-xs text-slate-600 space-y-1">
                        <div className="font-semibold text-slate-800">
                          {doc.donViThamMuu}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          Trình số: <span className="font-medium text-slate-700">{doc.soVanBanTrinh || "—"}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          Ngày: {formatYMDtoDMY(doc.ngayTrinh) || "—"}
                        </div>
                      </td>

                      {/* Cột 7: Thao tác nâng cao */}
                      <td className="px-5 py-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Nút Sửa */}
                          <button
                            type="button"
                            id={`btn-edit-${doc.id}`}
                            onClick={() => onEdit(doc)}
                            title="Sửa"
                            className="p-1.5 text-slate-550 hover:text-blue-600 hover:bg-blue-100/50 rounded-lg transition-colors"
                          >
                            <Edit size={14} />
                          </button>

                          {/* Nút Nhân bản (Tạo bản sao nhanh) */}
                          <button
                            type="button"
                            id={`btn-clone-${doc.id}`}
                            onClick={() => onClone(doc)}
                            title="Sao chép"
                            className="p-1.5 text-slate-550 hover:text-emerald-600 hover:bg-emerald-105/50 rounded-lg transition-colors"
                          >
                            <Copy size={14} />
                          </button>

                          {/* Nút Xóa */}
                          <button
                            type="button"
                            id={`btn-delete-${doc.id}`}
                            onClick={() => setDocToDelete(doc)}
                            title="Xóa"
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 3. Phần chân trang phân trang */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div>
            Hiển thị <span className="font-semibold text-slate-800">{paginatedDocs.length}</span> / <span className="font-semibold text-slate-800">{finalFilteredDocs.length}</span> văn bản
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              id="btn-page-prev"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Trước
            </button>
            <div className="px-3 text-xs font-bold text-slate-700">
              {currentPage} / {totalPages}
            </div>
            <button
              type="button"
              id="btn-page-next"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Sau
            </button>
          </div>
        </div>
      </div>

      {/* Custom Delete Confirmation Modal */}
      {docToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in duration-200">
            {/* Header */}
            <div className="bg-slate-900 px-5 py-4 text-white flex items-center gap-2.5">
              <AlertCircle className="text-rose-500 shrink-0" size={20} />
              <span className="font-bold text-sm">Xác nhận xóa văn bản</span>
            </div>
            {/* Body */}
            <div className="p-5 space-y-3.5">
              <p className="text-slate-600 text-xs leading-relaxed">
                Bạn có chắc chắn muốn xóa văn bản quyết định này không? Thao tác này không thể hoàn tác.
              </p>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 text-xs text-slate-800 leading-relaxed font-semibold">
                {docToDelete.trichYeu}
              </div>
            </div>
            {/* Footer */}
            <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2 text-xs font-bold">
              <button
                type="button"
                onClick={() => setDocToDelete(null)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => {
                  onDelete(docToDelete.id);
                  setDocToDelete(null);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors cursor-pointer shadow-xs"
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

