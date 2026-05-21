/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DocumentItem } from "./types";

export const INITIAL_DOCUMENTS: DocumentItem[] = [];

export const STORAGE_KEY = "cchc_phapche_docs_data";

export function loadDocuments(): DocumentItem[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      const parsed: DocumentItem[] = JSON.parse(data);
      if (Array.isArray(parsed)) {
        // Lọc bỏ các tài liệu mẫu cũ từ phiên trước nếu còn lưu trong localStorage (ID là doc-001 đến doc-010)
        return parsed.filter((doc) => !/^doc-00\d$/.test(doc.id) && doc.id !== "doc-010");
      }
    }
  } catch (error) {
    console.error("Unable to load document data from localStorage", error);
  }
  return INITIAL_DOCUMENTS;
}

export function saveDocuments(docs: DocumentItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
  } catch (error) {
    console.error("Unable to save document data to localStorage", error);
  }
}
