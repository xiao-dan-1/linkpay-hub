import { ArrowRight, KeyRound } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'

export function UserLoginPage() {
  const { loginUser } = useAuth()
  const navigate = useNavigate()
  const [accessKey, setAccessKey] = useState(() => localStorage.getItem('saved_user_key') || '')
  const [remember, setRemember] = useState(() => !!localStorage.getItem('saved_user_key'))
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (remember && accessKey.trim()) localStorage.setItem('saved_user_key', accessKey.trim())
    else if (!remember) localStorage.removeItem('saved_user_key')
  }, [remember, accessKey])

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await loginUser(accessKey.trim())
      if (remember) localStorage.setItem('saved_user_key', accessKey.trim())
      navigate('/user/workbench')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '登录失败')
    } finally { setSubmitting(false) }
  }

  return (
    <main className="auth-page">
      <section className="auth-brand-panel">
        <p className="eyebrow">STUDIO TASK FLOW</p>
        <h1>LinkPay Hub</h1>
        <p>提交链接、查看排队进度，并实时获取工作室处理结果。</p>
        <div className="auth-feature-list">
          <span>按行自动识别任务</span>
          <span>任务状态实时联动</span>
          <span>专属工作室队列</span>
        </div>
      </section>
      <section className="auth-card" aria-labelledby="user-login-title">
        <div className="auth-icon"><KeyRound size={24} /></div>
        <p className="eyebrow">USER ACCESS</p>
        <h2 id="user-login-title">用户登录</h2>
        <p className="muted">输入管理员发放的访问密钥进入提交工作台。</p>
        <form onSubmit={onSubmit} className="form-stack">
          <label>
            <span>访问密钥</span>
            <div className="input-with-icon"><KeyRound size={17} /><input aria-label="访问密钥" value={accessKey} onChange={(event) => setAccessKey(event.target.value)} autoComplete="off" spellCheck={false} placeholder="输入访问密钥" required /></div>
          </label>
          <label className="remember-label"><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} /> 记住密钥</label>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <button className="button auth-submit" type="submit" disabled={submitting}>{submitting ? '正在登录…' : '进入工作台'} <ArrowRight size={17} /></button>
        </form>
        <Link className="text-link" to="/admin/login">管理员入口</Link>
      </section>
    </main>
  )
}
