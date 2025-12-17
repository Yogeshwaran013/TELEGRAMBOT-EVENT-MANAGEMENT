import { useState } from 'react'
import './Login.css'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const onSubmit = (e) => {
    e.preventDefault()
    setError('')
    if (!email) return setError('Please enter your email')
    if (!password) return setError('Please enter your password')
    
    
    if(email === "testbot@gmail.com" && password === "Test@123") {
        
  }
  }
  return (
    <div className="login-root">
      <div className="login-card">
        <h1 className="login-title">Sign in</h1>
        <form onSubmit={onSubmit} className="login-form">
          <label className="label">Email</label>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />

          <label className="label">Password</label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />

          {error && <div className="error">{error}</div>}

          <button className="btn" type="submit">Sign in</button>
        </form>
        <div className="login-footer">Don't have an account? Contact admin.</div>
      </div>
    </div>
  )
}
