/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type LoaiVanBan = "Nghị quyết" | "Quyết định";
export type DonViBanHanh = "Hội đồng nhân dân tỉnh" | "Ủy ban nhân dân tỉnh";

export type LinhVucType = "linh_vuc_1" | "linh_vuc_2" | "linh_vuc_3";

export interface DocumentItem {
  id: string;
  loaiVanBan: LoaiVanBan;
  soBanHanh: string; // Số ban hành (bổ sung mới)
  trichYeu: string;
  ngayBanHanh: string; // Định dạng YYYY-MM-DD
  ngayCoHieuLuc: string; // Định dạng YYYY-MM-DD
  donViBanHanh: DonViBanHanh;
  donViThamMuu: string; // Đơn vị chủ trì tham mưu
  soVanBanTrinh: string; // Số văn bản trình
  ngayTrinh: string; // Định dạng YYYY-MM-DD
  linhVuc: LinhVucType;
  // Đối với lĩnh vực 1 (Quyết định công bố TTHC và quy trình nội bộ),
  // có quy định thư mục con: "Quyết định quy trình nội bộ"
  isQuyTrinhNoiBo?: boolean; 
  ghiChu?: string;
  createdAt?: any;
}

/**
 * Chuyển đổi định dạng YYYY-MM-DD sang DD/MM/YYYY (luôn có số 0 đứng trước)
 */
export function formatYMDtoDMY(ymd: string): string {
  if (!ymd) return "";
  const parts = ymd.split("-");
  if (parts.length === 3) {
    const [yyyy, mm, dd] = parts;
    return `${dd.padStart(2, "0")}/${mm.padStart(2, "0")}/${yyyy}`;
  }
  // Thử parse nếu chuỗi không chuẩn YYYY-MM-DD
  try {
    const d = new Date(ymd);
    if (!isNaN(d.getTime())) {
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yyyy = d.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    }
  } catch (e) {}
  return ymd;
}

/**
 * Chuyển đổi định dạng DD/MM/YYYY hoặc D/M/YYYY sang YYYY-MM-DD
 * Trả về chuỗi rỗng nếu định dạng ngày không hợp lệ.
 */
export function parseDMYtoYMD(dmy: string): string {
  if (!dmy) return "";
  const trimmed = dmy.trim();
  const parts = trimmed.split(/[\/\.-]/);
  if (parts.length === 3) {
    let [dd, mm, yyyy] = parts;
    dd = dd.padStart(2, "0");
    mm = mm.padStart(2, "0");
    if (yyyy.length === 2) {
      yyyy = `20${yyyy}`;
    }
    if (yyyy.length === 4) {
      const dInt = parseInt(dd, 10);
      const mInt = parseInt(mm, 10);
      const yInt = parseInt(yyyy, 10);
      if (!isNaN(dInt) && !isNaN(mInt) && !isNaN(yInt)) {
        const testDate = new Date(yInt, mInt - 1, dInt);
        if (
          testDate.getFullYear() === yInt &&
          testDate.getMonth() === mInt - 1 &&
          testDate.getDate() === dInt
        ) {
          return `${yyyy}-${mm}-${dd}`;
        }
      }
    }
  }
  return "";
}

/**
 * Kiểm tra tính hợp lệ của ngày định dạng dd/mm/yyyy
 */
export function isValidDMY(dmy: string): boolean {
  return parseDMYtoYMD(dmy) !== "";
}

export const LINH_VUC_LABELS: Record<LinhVucType, string> = {
  linh_vuc_1: "Quyết định công bố thủ tục hành chính & quy trình nội bộ",
  linh_vuc_2: "Quyết định ủy quyền",
  linh_vuc_3: "Văn bản quy phạm pháp luật do Sở Công Thương tham mưu ban hành",
};

export const INSTANCE_PARTIES = [
  "Phòng Quản lý thương mại",
  "Phòng Quản lý công nghiệp",
  "Phòng Quản lý năng lượng",
  "Văn phòng Sở",
  "Trung tâm Khuyến công",
  "Chi cục Quản lý thị trường"
];
