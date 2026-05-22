/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { UserRole, UserProfile, DocumentItem } from "./types";

// Define permission types
export type Permission = "create" | "read" | "update" | "delete" | "manage_users";

// Permission matrix: which roles have which permissions
const PERMISSION_MATRIX: Record<UserRole, Permission[]> = {
  admin: ["create", "read", "update", "delete", "manage_users"],
  staff: ["create", "read", "update", "delete"],
  viewer: ["read"],
};

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return PERMISSION_MATRIX[role]?.includes(permission) ?? false;
}

/**
 * Check if user can create documents
 */
export function canCreateDocument(user: UserProfile | null): boolean {
  if (!user) return false;
  return hasPermission(user.role, "create");
}

/**
 * Check if user can read/view documents
 */
export function canReadDocument(user: UserProfile | null): boolean {
  if (!user) return false;
  return hasPermission(user.role, "read");
}

/**
 * Check if user can edit a document
 * Admin can edit any document, staff/viewer can only edit their own
 */
export function canEditDocument(user: UserProfile | null, document: DocumentItem): boolean {
  if (!user) return false;
  if (!hasPermission(user.role, "update")) return false;
  
  if (user.role === "admin") return true;
  
  // Staff and viewer can only edit their own documents
  return document.ownerId === user.uid;
}

/**
 * Check if user can delete a document
 * Admin can delete any document, staff can only delete their own
 */
export function canDeleteDocument(user: UserProfile | null, document: DocumentItem): boolean {
  if (!user) return false;
  if (!hasPermission(user.role, "delete")) return false;
  
  if (user.role === "admin") return true;
  
  // Staff can only delete their own documents
  return document.ownerId === user.uid;
}

/**
 * Check if user can manage other users (admin only)
 */
export function canManageUsers(user: UserProfile | null): boolean {
  if (!user) return false;
  return hasPermission(user.role, "manage_users");
}

/**
 * Get role display label
 */
export function getRoleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    admin: "Quản trị viên",
    staff: "Nhân viên",
    viewer: "Xem",
  };
  return labels[role] ?? role;
}

/**
 * Get role description
 */
export function getRoleDescription(role: UserRole): string {
  const descriptions: Record<UserRole, string> = {
    admin: "Quản lý toàn bộ tài liệu và người dùng",
    staff: "Tạo, chỉnh sửa và xóa tài liệu của mình",
    viewer: "Chỉ xem tài liệu",
  };
  return descriptions[role] ?? "";
}
