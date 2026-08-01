import { ArrowRight, Eye, EyeOff, KeyRound, ShieldCheck, UserRound } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'

export function AdminLoginPage() {
  const { loginAdmin } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showPw, setShowPw] = useState(false)

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await loginAdmin(username.trim(), password)
      navigate('/admin/dashboard')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '登录失败')
    } finally { setSubmitting(false) }
  }

  return (
    <main className="auth-page admin-auth">
      <section className="auth-brand-panel">
        <p className="eyebrow">ADMIN CONSOLE</p>
        <h1>管理控制台</h1>
        <p>集中查看任务流转、用户状态和工作室专属入口。</p>
      </section>
      <section className="auth-card" aria-labelledby="admin-login-title">
        <div className="auth-icon"><ShieldCheck size={24} /></div>
        <p className="eyebrow">SECURE ACCESS</p>
        <h2 id="admin-login-title">管理员登录</h2>
        <form onSubmit={onSubmit} className="form-stack">
          <label><span>管理员账号</span><div className="input-with-icon"><UserRound size={17} /><input aria-label="管理员账号" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required /></div></label>
          <label><span>管理员密码</span><div className="input-with-icon"><KeyRound size={17} /><input aria-label="管理员密码" type={showPw ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /><button type="button" className="icon-button" style={{ width: 32, height: 32 }} aria-label={showPw ? '隐藏密码' : '显示密码'} onClick={() => setShowPw(!showPw)}>{showPw ? <EyeOff size={15} /> : <Eye size={15} />}</button></div></label>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <button className="button auth-submit" type="submit" disabled={submitting}>{submitting ? '正在登录…' : '进入管理后台'} <ArrowRight size={17} /></button>
        </form>
        <Link className="text-link" to="/login">返回用户登录</Link>
      </section>
    </main>
  )
}
