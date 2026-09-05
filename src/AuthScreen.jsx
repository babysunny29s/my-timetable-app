import { useState } from "react"
import { supabase } from "./supabase"
import {
  isValidUsername,
  normalizeUsername,
  usernameToEmail,
} from "./authHelpers"
import "./Auth.css"

function AuthScreen() {
  const [mode, setMode] = useState("login")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const isLogin = mode === "login"

  async function handleSubmit(event) {
    event.preventDefault()
    setError("")
    setMessage("")

    const normalized = normalizeUsername(username)

    if (!normalized || !password) {
      setError("Vui lòng nhập tên đăng nhập và mật khẩu")
      return
    }

    if (!isValidUsername(normalized)) {
      setError(
        "Tên đăng nhập gồm 3–20 ký tự: chữ thường, số hoặc gạch dưới (_)"
      )
      return
    }

    if (password.length < 6) {
      setError("Mật khẩu cần ít nhất 6 ký tự")
      return
    }

    const email = usernameToEmail(normalized)
    setLoading(true)

    if (isLogin) {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      setLoading(false)

      if (signInError) {
        setError(
          signInError.message === "Invalid login credentials"
            ? "Sai tên đăng nhập hoặc mật khẩu"
            : signInError.message
        )
      }
      return
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: normalized,
        },
      },
    })

    setLoading(false)

    if (signUpError) {
      setError(
        signUpError.message.includes("already registered")
          ? "Tên đăng nhập này đã được dùng"
          : signUpError.message
      )
      return
    }

    if (data.session) {
      setMessage("Đăng ký thành công!")
    } else if (data.user && (!data.user.identities || data.user.identities.length === 0)) {
      setError("Tên đăng nhập này đã được dùng")
    } else {
      setMessage(
        "Đăng ký thành công. Nếu không vào được app, tắt Confirm email trong Supabase Auth settings."
      )
    }
  }

  return (
    <div className="auth-app">
      <div className="auth-header">
        <img
          className="auth-logo"
          src="/logo.png"
          alt="Timetable"
          width="88"
          height="88"
        />
        <div className="auth-brand">Timetable</div>
        <p className="auth-tagline">Sổ lịch học của bạn</p>
      </div>

      <div className="auth-binder" aria-hidden="true">
        {Array.from({ length: 10 }).map((_, index) => (
          <span className="auth-binder-ring" key={index} />
        ))}
      </div>

      <div className="auth-card">
        <div className="auth-tabs">
          <button
            type="button"
            className={isLogin ? "active" : ""}
            onClick={() => {
              setMode("login")
              setError("")
              setMessage("")
            }}
          >
            Đăng nhập
          </button>
          <button
            type="button"
            className={!isLogin ? "active" : ""}
            onClick={() => {
              setMode("signup")
              setError("")
              setMessage("")
            }}
          >
            Đăng ký
          </button>
        </div>

        <h1>{isLogin ? "Chào mừng trở lại" : "Tạo tài khoản mới"}</h1>
        <p className="auth-subtitle">
          {isLogin
            ? "Đăng nhập bằng tên đăng nhập để xem thời khóa biểu."
            : "Chọn tên đăng nhập để lưu lịch học trên cloud."}
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="auth-username">Tên đăng nhập</label>
          <input
            id="auth-username"
            type="text"
            autoComplete="username"
            placeholder="ví dụ: anhnam_01"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            spellCheck={false}
          />

          <label htmlFor="auth-password">Mật khẩu</label>
          <input
            id="auth-password"
            type="password"
            autoComplete={isLogin ? "current-password" : "new-password"}
            placeholder="Ít nhất 6 ký tự"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error && <div className="auth-alert error">{error}</div>}
          {message && <div className="auth-alert success">{message}</div>}

          <button className="auth-submit" type="submit" disabled={loading}>
            {loading
              ? "Đang xử lý..."
              : isLogin
                ? "Đăng nhập"
                : "Đăng ký"}
          </button>
        </form>
      </div>
    </div>
  )
}

export default AuthScreen
