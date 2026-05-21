/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DocumentItem, LINH_VUC_LABELS, formatYMDtoDMY } from "./types";

/**
 * Xuất danh sách văn bản ra file .csv tương thích Excel hỗ trợ đầy đủ tiếng Việt có dấu.
 * @param documents Danh sách văn bản cần xuất
 * @param title Tên danh mục hoặc Lĩnh vực xuất
 */
export function exportToCSV(documents: DocumentItem[], title: string) {
  // Tiêu đề của file Excel
  const headers = [
    "STT",
    "Loại văn bản",
    "Số ban hành",
    "Trích yếu",
    "Ngày ban hành",
    "Ngày có hiệu lực",
    "Đơn vị ban hành",
    "Đơn vị chủ trì tham mưu",
    "Số văn bản trình",
    "Ngày trình",
    "Lĩnh vực",
    "Mục con",
    "Ghi chú"
  ];

  // Chuyển đổi dòng dữ liệu
  const rows = documents.map((doc, index) => {
    const linhVucText = LINH_VUC_LABELS[doc.linhVuc] || "";
    const mucConText = doc.isQuyTrinhNoiBo ? "Quyết định quy trình nội bộ" : "-";
    
    const fields = [
      String(index + 1),
      doc.loaiVanBan,
      doc.soBanHanh || "",
      doc.trichYeu,
      formatYMDtoDMY(doc.ngayBanHanh),
      formatYMDtoDMY(doc.ngayCoHieuLuc),
      doc.donViBanHanh,
      doc.donViThamMuu,
      doc.soVanBanTrinh,
      formatYMDtoDMY(doc.ngayTrinh),
      linhVucText,
      mucConText,
      doc.ghiChu || ""
    ];

    // Đóng gói từng trường trong dấu ngoặc kép, thay thế tab và dấu xuống dòng bằng khoảng trắng
    return fields.map(field => `"${String(field).replace(/"/g, '""').replace(/\t/g, ' ').replace(/\r?\n/g, ' ')}"`);
  });

  // Thiết lập liên kết phân tách bằng dấu Tab (\t)
  const csvContent = 
    headers.map(h => `"${h.replace(/"/g, '""')}"`).join("\t") + "\n" + 
    rows.map(row => row.join("\t")).join("\n");
  
  // Gốc UTF-16LE bắt buộc phải có BOM \uFEFF tại vị trí đầu tiên
  const BOM = "\uFEFF";
  const fullContent = BOM + csvContent;
  
  // Chuyển đổi chuỗi thành Uint16Array để ghi file dưới chuẩn UTF-16LE mượt mà không lỗi font chữ tiếng Việt trên Microsoft Excel
  const buffer = new ArrayBuffer(fullContent.length * 2);
  const view = new Uint16Array(buffer);
  for (let i = 0; i < fullContent.length; i++) {
    view[i] = fullContent.charCodeAt(i);
  }
  
  const blob = new Blob([buffer], { type: "text/csv;charset=utf-16le;" });
  const url = URL.createObjectURL(blob);
  
  // Đóng gói download link
  const link = document.createElement("a");
  link.setAttribute("href", url);
  
  // Định dạng tên file: "danh_sach_van_ban_<tieu_de>_2026_05_21.csv"
  const cleanTitle = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // loai bo dau tieng viet
    .replace(/[^a-z0-9]/g, "_")     // loai bo ky tu dac biet
    .replace(/_+/g, "_");
    
  const todayStr = new Date().toISOString().split("T")[0];
  link.setAttribute("download", `danh_sach_van_ban_${cleanTitle || "cchc"}_${todayStr}.csv`);
  link.style.visibility = "hidden";
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
