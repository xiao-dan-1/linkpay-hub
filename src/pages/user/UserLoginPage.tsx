import { ArrowRight, KeyRound, UserRound } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'

export function UserLoginPage() {
  const { loginUser } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('demo')
  const [password, setPassword] = useState('Demo123!')
  const [error, setError] = useState('')

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    try {
      loginUser(username.trim(), password)
      navigate('/user/workbench')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '登录失败')
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-brand-panel">
        <p className="eyebrow">STUDIO TASK FLOW</p>
        <h1>任务工作台</h1>
        <p>提交链接、查看排队进度，并实时获取工作室处理结果。</p>
        <div className="auth-feature-list">
          <span>单条与批量提交</span>
          <span>任务状态实时联动</span>
          <span>专属工作室队列</span>
        </div>
      </section>
      <section className="auth-card" aria-labelledby="user-login-title">
        <div className="auth-icon"><UserRound size={24} /></div>
        <p className="eyebrow">USER ACCESS</p>
        <h2 id="user-login-title">用户登录</h2>
        <p className="muted">使用工作室注册的账号进入提交工作台。</p>
        <form onSubmit={onSubmit} className="form-stack">
          <label>
            <span>账号</span>
            <div className="input-with-icon"><UserRound size={17} /><input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required /></div>
          </label>
          <label>
            <span>密码</span>
            <div className="input-with-icon"><KeyRound size={17} /><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></div>
          </label>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <button className="button auth-submit" type="submit">进入工作台 <ArrowRight size={17} /></button>
        </form>
        <p className="auth-footnote">演示账号：demo / Demo123!</p>
        <Link className="text-link" to="/admin/login">管理员入口</Link>
      </section>
    </main>
  )
}
