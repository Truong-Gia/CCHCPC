/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import "./LoginForm.css";

interface LoginFormProps {
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (email: string, password: string, displayName: string) => Promise<void>;
  isLoading?: boolean;
}

export const LoginForm: React.FC<LoginFormProps> = ({
  onSignIn,
  onSignUp,
  isLoading = false,
}) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      // Basic validation
      if (!email || !email.includes("@")) {
        setError("Vui lòng nhập email hợp lệ");
        return;
      }

      if (!password || password.length < 6) {
        setError("Mật khẩu phải có ít nhất 6 ký tự");
        return;
      }

      if (isSignUp && !displayName.trim()) {
        setError("Vui lòng nhập tên của bạn");
        return;
      }

      if (isSignUp) {
        await onSignUp(email, password, displayName);
      } else {
        await onSignIn(email, password);
      }

      // Clear form on success
      setEmail("");
      setPassword("");
      setDisplayName("");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("[v0] Auth error:", errorMessage);
      
      // Provide user-friendly error messages
      if (errorMessage.includes("auth/user-not-found")) {
        setError("Email không tồn tại");
      } else if (errorMessage.includes("auth/wrong-password")) {
        setError("Mật khẩu không chính xác");
      } else if (errorMessage.includes("auth/email-already-in-use")) {
        setError("Email này đã được đăng ký");
      } else if (errorMessage.includes("auth/weak-password")) {
        setError("Mật khẩu quá yếu, vui lòng sử dụng mật khẩu mạnh hơn");
      } else if (errorMessage.includes("auth/invalid-email")) {
        setError("Định dạng email không hợp lệ");
      } else {
        setError(errorMessage);
      }
    }
  };

  return (
    <div className="login-form-container">
      <div className="login-form-card">
        <h2 className="login-form-title">
          {isSignUp ? "Tạo tài khoản" : "Đăng nhập"}
        </h2>

        {error && (
          <div className="login-form-error">
            <span className="error-icon">⚠️</span>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          {isSignUp && (
            <div className="form-group">
              <label htmlFor="displayName" className="form-label">
                Tên của bạn
              </label>
              <input
                id="displayName"
                type="text"
                className="form-input"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Nhập tên của bạn"
                disabled={isLoading}
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email" className="form-label">
              Email
            </label>
            <input
              id="email"
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              disabled={isLoading}
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">
              Mật khẩu
            </label>
            <input
              id="password"
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Ít nhất 6 ký tự"
              disabled={isLoading}
              autoComplete={isSignUp ? "new-password" : "current-password"}
            />
          </div>

          <button
            type="submit"
            className="login-form-button"
            disabled={isLoading}
          >
            {isLoading ? "Đang xử lý..." : isSignUp ? "Tạo tài khoản" : "Đăng nhập"}
          </button>
        </form>

        <div className="login-form-toggle">
          <p className="toggle-text">
            {isSignUp ? "Đã có tài khoản?" : "Chưa có tài khoản?"}
          </p>
          <button
            type="button"
            className="toggle-button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
              setEmail("");
              setPassword("");
              setDisplayName("");
            }}
            disabled={isLoading}
          >
            {isSignUp ? "Đăng nhập" : "Tạo tài khoản"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;
