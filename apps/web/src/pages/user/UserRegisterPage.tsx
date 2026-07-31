import { ArrowRight, Building2, KeyRound, UserPlus } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'

export function UserRegisterPage() {
  const { registrationCode } = useParams()
  const navigate = useNavigate()
  const { registerUser } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    if (password !== confirmation) {
      setError('两次输入的密码不一致')
      return
    }

    if (!registrationCode) {
      setError('注册链接无效')
      return
    }
    setSubmitting(true)
    try {
      await registerUser(registrationCode, username.trim(), password)
      navigate('/user/workbench')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '注册失败')
    } finally { setSubmitting(false) }
  }

  return (
    <main className="auth-page">
      <section className="auth-brand-panel">
        <p className="eyebrow">STUDIO INVITATION</p>
        <h1>专属工作室注册</h1>
        <p>通过专属入口注册，后续提交的任务将只进入该工作室。</p>
        <div className="studio-binding"><Building2 size={20} /><span>注册后自动绑定，不支持切换工作室</span></div>
      </section>
      <section className="auth-card" aria-labelledby="register-title">
        <div className="auth-icon"><UserPlus size={24} /></div>
        <p className="eyebrow">CREATE ACCOUNT</p>
        <h2 id="register-title">创建用户账号</h2>
        <p className="muted">创建正式账号后将自动绑定此工作室。</p>
        <form onSubmit={onSubmit} className="form-stack">
          <label><span>账号</span><div className="input-with-icon"><UserPlus size={17} /><input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required /></div></label>
          <label><span>密码</span><div className="input-with-icon"><KeyRound size={17} /><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={8} required /></div></label>
          <label><span>确认密码</span><div className="input-with-icon"><KeyRound size={17} /><input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" minLength={8} required /></div></label>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <button className="button auth-submit" type="submit" disabled={submitting}>{submitting ? '正在注册…' : '注册并进入工作台'} <ArrowRight size={17} /></button>
        </form>
        <Link className="text-link" to="/login">已有账号，返回登录</Link>
      </section>
    </main>
  )
}
