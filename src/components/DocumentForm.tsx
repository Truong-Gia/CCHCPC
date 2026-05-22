/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { DocumentItem, LoaiVanBan, DonViBanHanh, LinhVucType, INSTANCE_PARTIES, formatYMDtoDMY, parseDMYtoYMD } from "../types";
import { X, Save, RotateCcw, AlertCircle, UploadCloud } from "lucide-react";
import { storage, auth } from "../firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

interface DocumentFormProps {
  documentToEdit: DocumentItem | null;
  onSave: (doc: DocumentItem) => void;
  onClose: () => void;
  currentActiveLinhVuc: LinhVucType | "all";
}

export default function DocumentForm({
  documentToEdit,
  onSave,
  onClose,
  currentActiveLinhVuc,
}: DocumentFormProps) {
  // Trạng thái form
  const [loaiVanBan, setLoaiVanBan] = useState<LoaiVanBan>("Quyết định");
  const [soBanHanh, setSoBanHanh] = useState("");
  const [trichYeu, setTrichYeu] = useState("");
  const [ngayBanHanh, setNgayBanHanh] = useState("");
  const [ngayCoHieuLuc, setNgayCoHieuLuc] = useState("");
  const [donViBanHanh, setDonViBanHanh] = useState<DonViBanHanh>("Ủy ban nhân dân tỉnh");
  const [donViThamMuu, setDonViThamMuu] = useState("");
  const [soVanBanTrinh, setSoVanBanTrinh] = useState("");
  const [ngayTrinh, setNgayTrinh] = useState("");
  const [linhVuc, setLinhVuc] = useState<LinhVucType>("linh_vuc_1");
  const [isQuyTrinhNoiBo, setIsQuyTrinhNoiBo] = useState(false);
  const [ghiChu, setGhiChu] = useState("");

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Trạng thái đính kèm file
  const [files, setFiles] = useState<{ name: string; url: string; size?: number; type?: string }[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<{ name: string; progress: number }[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Đổ dữ liệu nếu đang ở chế độ Sửa
  useEffect(() => {
    if (documentToEdit) {
      setLoaiVanBan(documentToEdit.loaiVanBan);
      setSoBanHanh(documentToEdit.soBanHanh || "");
      setTrichYeu(documentToEdit.trichYeu);
      setNgayBanHanh(formatYMDtoDMY(documentToEdit.ngayBanHanh));
      setNgayCoHieuLuc(formatYMDtoDMY(documentToEdit.ngayCoHieuLuc));
      setDonViBanHanh(documentToEdit.donViBanHanh);
      setDonViThamMuu(documentToEdit.donViThamMuu);
      setSoVanBanTrinh(documentToEdit.soVanBanTrinh);
      setNgayTrinh(formatYMDtoDMY(documentToEdit.ngayTrinh));
      setLinhVuc(documentToEdit.linhVuc);
      setIsQuyTrinhNoiBo(!!documentToEdit.isQuyTrinhNoiBo);
      setGhiChu(documentToEdit.ghiChu || "");
      setFiles(documentToEdit.fileDinhKem || []);
    } else {
      // Nếu thêm mới và đang đứng ở Lĩnh vực cụ thể, mặc định chọn lĩnh vực đó
      if (currentActiveLinhVuc !== "all") {
        setLinhVuc(currentActiveLinhVuc);
      }
      resetForm();
    }
  }, [documentToEdit, currentActiveLinhVuc]);

  // Tự động kiểm tra thời hạn và thiết lập thông tin trợ giúp ngày
  useEffect(() => {
    // Nếu chọn Nghị quyết, cơ quan ban hành mặc định nên là HĐND
    if (loaiVanBan === "Nghị quyết") {
      setDonViBanHanh("Hội đồng nhân dân tỉnh");
    } else {
      setDonViBanHanh("Ủy ban nhân dân tỉnh");
    }
  }, [loaiVanBan]);

  const resetForm = () => {
    setLoaiVanBan("Quyết định");
    setSoBanHanh("");
    setTrichYeu("");
    setNgayBanHanh("");
    setNgayCoHieuLuc("");
    setDonViBanHanh("Ủy ban nhân dân tỉnh");
    setDonViThamMuu("");
    setSoVanBanTrinh("");
    setNgayTrinh("");
    setIsQuyTrinhNoiBo(false);
    setGhiChu("");
    setFiles([]);
    setUploadingFiles([]);
    setIsUploading(false);
    setErrorMsg(null);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const selectedFiles = Array.from(e.target.files) as File[];
    
    // Validate file formats: pdf, doc, docx
    const allowedExtensions = ["pdf", "doc", "docx"];
    const invalidFiles = selectedFiles.filter(file => {
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      return !allowedExtensions.includes(ext);
    });
    
    if (invalidFiles.length > 0) {
      setErrorMsg(`Định dạng file không hợp lệ! Chỉ cho phép file .pdf, .doc, .docx (Phát hiện file không đúng: ${invalidFiles.map(f => f.name).join(", ")})`);
      return;
    }
    
    setIsUploading(true);
    setErrorMsg(null);
    
    const docId = documentToEdit?.id || `doc-draft-${Date.now()}`;
    const uploadedList = [...files];
    
    for (const file of selectedFiles) {
      // Add to uploading progress tracking
      setUploadingFiles((prev) => [...prev, { name: file.name, progress: 10 }]);
      
      try {
        // TIER 1: Firebase Cloud Storage with strict timeout
        const fileRef = ref(storage, `documents/${docId}/${Date.now()}_${file.name}`);
        
        const uploadToFirebase = (async () => {
          const snapshot = await uploadBytes(fileRef, file);
          return await getDownloadURL(snapshot.ref);
        })();

        const timeoutPromise = new Promise<string>((_, reject) => 
          setTimeout(() => reject(new Error("Firebase upload timeout")), 30000)
        );

        let downloadUrl = "";
        try {
          downloadUrl = await Promise.race([uploadToFirebase, timeoutPromise]);
        } catch (firebaseError: any) {
          console.warn("Firebase Storage is unreachable or timed out. Falling back to high-speed file storage proxy...", firebaseError);
          
          // TIER 2: Fast anonymous direct-cloud public API (tmpfiles.org with download url rewrite)
          const formData = new FormData();
          formData.append("file", file);
          
          const res = await fetch("https://tmpfiles.org/api/v1/upload", {
            method: "POST",
            body: formData,
          });
          if (!res.ok) throw new Error("Public cloud upload failed with HTTP status " + res.status);
          
          const result = await res.json();
          if (result && result.data && result.data.url) {
            downloadUrl = result.data.url.replace("https://tmpfiles.org/", "https://tmpfiles.org/dl/");
          } else {
            throw new Error("Invalid response format from cloud storage proxy");
          }
        }

        uploadedList.push({
          name: file.name,
          url: downloadUrl,
          size: file.size,
          type: file.type || "application/octet-stream",
        });
        
        // Update files state
        setFiles([...uploadedList]);
        
        // Clear this file from uploadingFiles list
        setUploadingFiles((prev) => prev.filter((f) => f.name !== file.name));
      } catch (error: any) {
        console.error("Lỗi khi upload file lên cloud, khôi phục bằng base64: ", error);
        
        // TIER 3: Local Offline / Permissions Fallback (instant Base64 URI)
        try {
          const reader = new FileReader();
          const base64Promise = new Promise<string>((resolve, reject) => {
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = (err) => reject(err);
            reader.readAsDataURL(file);
          });
          
          const base64Data = await base64Promise;
          
          uploadedList.push({
            name: file.name,
            url: base64Data, // local base64 fallback
            size: file.size,
            type: file.type || "application/octet-stream",
          });
          
          setFiles([...uploadedList]);
          setUploadingFiles((prev) => prev.filter((f) => f.name !== file.name));
        } catch (fbError) {
          setErrorMsg(`Không thể xử lý file ${file.name}: ${error.message || error}`);
          setUploadingFiles((prev) => prev.filter((f) => f.name !== file.name));
        }
      }
    }
    
    setIsUploading(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (isUploading) {
      setErrorMsg("Vui lòng đợi quá trình upload file hoàn tất!");
      return;
    }

    // Xác thực cơ bản
    if (!soBanHanh.trim()) {
      setErrorMsg("Vui lòng nhập số ban hành!");
      return;
    }
    if (!trichYeu.trim()) {
      setErrorMsg("Vui lòng nhập trích yếu nội dung văn bản!");
      return;
    }
    
    const ymdBanHanh = parseDMYtoYMD(ngayBanHanh);
    if (!ymdBanHanh) {
      setErrorMsg("Ngày ban hành không hợp lệ! Vui lòng nhập đúng định dạng DD/MM/YYYY (ví dụ: 21/05/2026).");
      return;
    }
    
    const ymdCoHieuLuc = parseDMYtoYMD(ngayCoHieuLuc);
    if (!ymdCoHieuLuc) {
      setErrorMsg("Ngày có hiệu lực không hợp lệ! Vui lòng nhập đúng định dạng DD/MM/YYYY (ví dụ: 01/06/2026).");
      return;
    }
    
    if (!donViThamMuu.trim()) {
      setErrorMsg("Vui lòng nhập đơn vị chủ trì tham mưu!");
      return;
    }

    let ymdTrinh = "";
    if (ngayTrinh.trim()) {
      ymdTrinh = parseDMYtoYMD(ngayTrinh);
      if (!ymdTrinh) {
        setErrorMsg("Ngày trình không hợp lệ! Vui lòng nhập đúng định dạng DD/MM/YYYY (ví dụ: 15/04/2026) hoặc để trống.");
        return;
      }

      // Kiểm tra logic ngày tháng nếu cả hai ngày đều được cung cấp
      if (new Date(ymdBanHanh) < new Date(ymdTrinh)) {
        setErrorMsg("Lưu ý logic: Ngày ban hành không thể trước ngày trình văn bản!");
        return;
      }
    }

    const payload: DocumentItem = {
      id: documentToEdit?.id || `doc-${Date.now()}`,
      loaiVanBan,
      soBanHanh: soBanHanh.trim(),
      trichYeu: trichYeu.trim(),
      ngayBanHanh: ymdBanHanh,
      ngayCoHieuLuc: ymdCoHieuLuc,
      donViBanHanh,
      donViThamMuu: donViThamMuu.trim(),
      soVanBanTrinh: soVanBanTrinh.trim(),
      ngayTrinh: ymdTrinh,
      linhVuc,
      isQuyTrinhNoiBo: linhVuc === "linh_vuc_1" ? isQuyTrinhNoiBo : false,
      ghiChu: ghiChu.trim(),
      fileDinhKem: files,
    };

    onSave(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div 
        id="document-modal"
        className="relative w-full max-w-3xl overflow-hidden bg-white shadow-2xl rounded-2xl border border-slate-200"
      >
        {/* Tiêu đề Modal mang phong cách sang trọng phẳng */}
        <div className="bg-slate-900 px-6 py-4.5 flex items-center justify-between text-white">
          <div>
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">Quản trị nội dung</span>
            <h3 className="text-base font-bold flex items-center gap-2 mt-0.5">
              <span>{documentToEdit ? "Chỉnh sửa văn bản quyết định" : "Thêm văn bản quyết định mới"}</span>
            </h3>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Thân Modal */}
        <form onSubmit={handleSubmit} className="p-6 max-h-[80vh] overflow-y-auto space-y-5">
          {errorMsg && (
            <div className="flex items-center gap-2.5 p-3.5 bg-rose-50 border-l-4 border-rose-600 text-rose-800 text-sm rounded-r-lg">
              <AlertCircle size={18} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {!auth.currentUser && (
            <div className="flex items-start gap-2.5 p-3.5 bg-amber-50 border-l-4 border-amber-500 text-amber-800 text-xs rounded-r-lg leading-relaxed font-semibold">
              <AlertCircle size={16} className="shrink-0 text-amber-500 mt-0.5" />
              <div>
                <strong className="text-amber-950 font-bold block mb-0.5">⚠️ Đang hoạt động ở chế độ ngoại tuyến (Chưa đăng nhập)</strong>
                Quyết định này hiện tại sẽ chỉ được lưu tạm thời trên trình duyệt của máy này. Để đồng bộ an toàn vĩnh viễn và chia sẻ dùng chung cho tất cả tài khoản, xin vui lòng bật Đăng nhập Google ở góc trái màn hình.
              </div>
            </div>
          )}

          {/* Dòng 1: Lĩnh vực ban hành & thư mục con */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">
                Lĩnh vực chính <span className="text-red-500">*</span>
              </label>
              <select
                id="form-linh-vuc"
                value={linhVuc}
                onChange={(e) => {
                  const val = e.target.value as LinhVucType;
                  setLinhVuc(val);
                  if (val !== "linh_vuc_1") setIsQuyTrinhNoiBo(false);
                }}
                className="w-full bg-white border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              >
                <option value="linh_vuc_1">1. Quyết định công bố thủ tục hành chính và quy trình nội bộ</option>
                <option value="linh_vuc_2">2. Quyết định ủy quyền</option>
                <option value="linh_vuc_3">3. Quyết định văn bản quy phạm pháp luật cho Sở tham mưu ban hành</option>
              </select>
            </div>

            {/* Thư mục con cho lĩnh vực 1 */}
            {linhVuc === "linh_vuc_1" && (
              <div className="flex items-center gap-2.5 pt-1.5 border-t border-slate-200">
                <input
                  type="checkbox"
                  id="form-is-quy-trinh-noi-bo"
                  checked={isQuyTrinhNoiBo}
                  onChange={(e) => setIsQuyTrinhNoiBo(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                />
                <label 
                  htmlFor="form-is-quy-trinh-noi-bo" 
                  className="text-xs font-bold text-slate-600 cursor-pointer"
                >
                  Xếp vào thư mục con: <span className="underline italic text-blue-600">Quyết định quy trình nội bộ</span>
                </label>
              </div>
            )}
          </div>

          {/* Dòng 2: Loại văn bản & Đơn vị ban hành */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">
                Loại văn bản <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  id="btn-loai-qd"
                  onClick={() => setLoaiVanBan("Quyết định")}
                  className={`flex-1 py-2 px-4 text-xs font-bold rounded-lg border-2 transition-all ${
                    loaiVanBan === "Quyết định"
                      ? "border-blue-600 bg-blue-50 text-blue-700 font-bold"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  📜 Quyết định
                </button>
                <button
                  type="button"
                  id="btn-loai-nq"
                  onClick={() => setLoaiVanBan("Nghị quyết")}
                  className={`flex-1 py-2 px-4 text-xs font-bold rounded-lg border-2 transition-all ${
                    loaiVanBan === "Nghị quyết"
                      ? "border-blue-600 bg-blue-50 text-blue-700 font-bold"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  📝 Nghị quyết
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">
                Đơn vị ban hành <span className="text-red-500">*</span>
              </label>
              <select
                id="form-don-vi-ban-hanh"
                value={donViBanHanh}
                onChange={(e) => setDonViBanHanh(e.target.value as DonViBanHanh)}
                className="w-full bg-white border border-slate-200 rounded-lg px-3.5 py-2 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              >
                <option value="Ủy ban nhân dân tỉnh">Ủy ban nhân dân tỉnh</option>
                <option value="Hội đồng nhân dân tỉnh">Hội đồng nhân dân tỉnh</option>
              </select>
            </div>
          </div>

          {/* Dòng 2.5: Số ban hành */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">
              Số ban hành <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="form-so-ban-hanh"
              value={soBanHanh}
              onChange={(e) => setSoBanHanh(e.target.value)}
              placeholder="Ví dụ: 450/QĐ-UBND hoặc 12/2026/NQ-HĐND"
              className="w-full bg-white border border-slate-200 rounded-lg px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-400"
            />
          </div>

          {/* Dòng 3: Trích yếu */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">
              Trích yếu nội dung <span className="text-red-500">*</span>
            </label>
            <textarea
              id="form-trich-yeu"
              rows={3}
              value={trichYeu}
              onChange={(e) => setTrichYeu(e.target.value)}
              placeholder="Nhập phần tóm tắt trích yếu nội dung của văn bản pháp lý..."
              className="w-full bg-white border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-400"
            />
          </div>

          {/* Dòng 4: Ngày ban hành & Ngày có hiệu lực */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">
                Ngày ban hành <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="form-ngay-ban-hanh"
                value={ngayBanHanh}
                onChange={(e) => setNgayBanHanh(e.target.value)}
                placeholder="dd/mm/yyyy"
                className="w-full bg-white border border-slate-200 rounded-lg px-3.5 py-2 text-sm text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
              <span className="text-[10px] text-slate-400 mt-1 block font-medium">Nhập dạng ngày/tháng/năm (ví dụ: 21/05/2026)</span>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">
                Ngày có hiệu lực <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="form-ngay-co-hieu-luc"
                value={ngayCoHieuLuc}
                onChange={(e) => setNgayCoHieuLuc(e.target.value)}
                placeholder="dd/mm/yyyy"
                className="w-full bg-white border border-slate-200 rounded-lg px-3.5 py-2 text-sm text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
              <span className="text-[10px] text-slate-400 mt-1 block font-medium">Nhập dạng ngày/tháng/năm (ví dụ: 01/06/2026)</span>
            </div>
          </div>

          {/* Dòng 5: Đơn vị chủ trì tham mưu & Gợi ý */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">
              Đơn vị chủ trì tham mưu <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="form-don-vi-tham-muu"
              value={donViThamMuu}
              onChange={(e) => setDonViThamMuu(e.target.value)}
              placeholder="Nhập hoặc lựa chọn đơn vị gợi ý bên dưới..."
              className="w-full bg-white border border-slate-200 rounded-lg px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-400"
            />
            {/* Thanh gợi ý nhanh cơ quan */}
            <div className="mt-2 flex flex-wrap gap-1">
              {INSTANCE_PARTIES.map((party) => (
                <button
                  type="button"
                  key={party}
                  onClick={() => setDonViThamMuu(party)}
                  className="text-[10px] px-2.5 py-1 bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-lg border border-slate-200 hover:border-blue-200 transition-colors cursor-pointer"
                >
                  {party}
                </button>
              ))}
            </div>
          </div>

          {/* Dòng 6: Số văn bản trình & Ngày trình */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">
                Số văn bản trình <span className="text-slate-400 font-normal lowercase">(không bắt buộc)</span>
              </label>
              <input
                type="text"
                id="form-so-vb-trinh"
                value={soVanBanTrinh}
                onChange={(e) => setSoVanBanTrinh(e.target.value)}
                placeholder="Ví dụ: 142/TTr-SNV hoặc 18/BC-STP"
                className="w-full bg-white border border-slate-200 rounded-lg px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">
                Ngày trình <span className="text-slate-400 font-normal lowercase">(không bắt buộc)</span>
              </label>
              <input
                type="text"
                id="form-ngay-trinh"
                value={ngayTrinh}
                onChange={(e) => setNgayTrinh(e.target.value)}
                placeholder="dd/mm/yyyy"
                className="w-full bg-white border border-slate-200 rounded-lg px-3.5 py-2 text-sm text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
              <span className="text-[10px] text-slate-400 mt-1 block font-medium">Nhập dạng ngày/tháng/năm (ví dụ: 15/04/2026)</span>
            </div>
          </div>

          {/* Ghi chú */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">
              Ghi chú thêm
            </label>
            <input
              type="text"
              id="form-ghi-chu"
              value={ghiChu}
              onChange={(e) => setGhiChu(e.target.value)}
              placeholder="Nhập thông tin đính kèm bổ sung, nơi lưu trữ, hiệu lực liên đới..."
              className="w-full bg-white border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>

          {/* File đính kèm (Dòng cuối của form nhập liệu) */}
          <div className="border-t border-slate-100 pt-4.5 space-y-3" id="form-file-dinh-kem-row">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
                  File đính kèm <span className="text-slate-400 font-normal lowercase">(Chấp nhận: .pdf, .doc, .docx)</span>
                </label>
                <div className="text-[11px] text-slate-400 mt-1 font-medium">
                  Hiện có: <span className="font-bold text-blue-600 font-mono text-xs">{files.length}</span> file đính kèm.
                </div>
              </div>
              
              <label 
                className={`relative flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer shadow-xs ${
                  isUploading 
                    ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed" 
                    : "bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
                }`}
              >
                <UploadCloud size={14} className={isUploading ? "animate-spin" : "animate-bounce"} />
                <span>Chọn file tải lên</span>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx"
                  onChange={handleFileChange}
                  className="hidden"
                  disabled={isUploading}
                />
              </label>
            </div>

            {/* Danh sách các files đã đính kèm */}
            {files.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                {files.map((file, idx) => {
                  const ext = file.name.split(".").pop()?.toLowerCase() || "";
                  const sizeKB = file.size ? Math.round(file.size / 1024) : 0;
                  return (
                    <div 
                      key={idx}
                      className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-lg group hover:border-blue-300 hover:shadow-xs transition-colors"
                    >
                      <div className="flex items-center gap-2 overflow-hidden mr-2">
                        <span className="text-base shrink-0 select-none">
                          {ext === "pdf" ? "📕" : "📘"}
                        </span>
                        <div className="truncate text-xs font-semibold text-slate-700">
                          <a 
                            href={file.url} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="hover:text-blue-600 hover:underline cursor-pointer"
                            title="Nhấp để tải hoặc xem tệp tin"
                          >
                            {file.name}
                          </a>
                          {sizeKB > 0 && (
                            <span className="text-[10px] text-slate-400 font-mono font-medium block">
                              {sizeKB} KB
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFiles(files.filter((_, i) => i !== idx))}
                        className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors opacity-100 sm:opacity-0 group-hover:opacity-100 cursor-pointer"
                        title="Xóa tệp đính kèm này"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Hàng chờ các file đang upload */}
            {uploadingFiles.length > 0 && (
              <div className="space-y-2 bg-amber-50/60 p-3 rounded-xl border border-amber-200 text-xs text-amber-800">
                <div className="font-semibold flex items-center gap-1.5">
                  <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                  Hệ thống đang tải file lên cơ sở dữ liệu đám mây (Cloud)...
                </div>
                {uploadingFiles.map((file, i) => (
                  <div key={i} className="flex justify-between font-medium font-mono text-[10px]">
                    <span className="truncate max-w-[80%]">{file.name}</span>
                    <span className="animate-pulse shrink-0">Đang khởi tạo...</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Nút hành động */}
          <div className="border-t border-slate-100 pt-5 flex justify-between items-center bg-white">
            <button
              type="button"
              id="btn-form-reset"
              onClick={resetForm}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
            >
              <RotateCcw size={14} />
              Xóa điền lại
            </button>

            <div className="flex gap-2">
              <button
                type="button"
                id="btn-form-cancel"
                onClick={onClose}
                className="px-4 py-2 border border-slate-200 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                id="btn-form-submit"
                className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all focus:ring-2 focus:ring-blue-500"
              >
                <Save size={14} />
                Lưu văn bản
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

