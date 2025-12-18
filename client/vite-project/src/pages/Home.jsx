import { useEffect, useState } from 'react'
import './Home.css'

export default function Home() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [batchFilter, setBatchFilter] = useState('all')
  const [broadcastMessage, setBroadcastMessage] = useState('')
  const [broadcastResult, setBroadcastResult] = useState(null)
  const [view, setView] = useState('users') // 'users' or 'broadcast'

  async function fetchUsers() {
    setLoading(true)
    setError('')
    try {
      const url = new URL('http://localhost:3000/users')
      if (batchFilter !== 'all') url.searchParams.set('batch', batchFilter)
      const res = await fetch(url.toString())
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setUsers(data)
    } catch (err) {
      setError(err.message || 'Failed to fetch users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  useEffect(() => {
    // refetch when batch filter changes
    fetchUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchFilter])

  async function sendBroadcast(e) {
    e.preventDefault()
    setBroadcastResult(null)
    if (!broadcastMessage) return setBroadcastResult({ error: 'Message is required' })
    try {
      const res = await fetch('http://localhost:3000/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch: batchFilter === 'all' ? undefined : Number(batchFilter), message: broadcastMessage })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Broadcast failed')
      setBroadcastResult({ ok: true, ...data })
      alert(`Broadcast sent — Sent: ${data.sent}, Failed: ${data.failed}`)
      setBroadcastMessage('')
    } catch (err) {
      setBroadcastResult({ error: String(err.message) })
      alert(`Broadcast failed: ${String(err.message)}`)
    }
  }

  return (
    <div className="home-root">
      <div className="home-card">
        <div className="nav">
          <div className={`nav-item ${view==='users'?'active':''}`} onClick={()=>setView('users')}>
            <div className="nav-icon">👥</div>
            <div className="nav-label">Users</div>
          </div>
          <div className={`nav-item ${view==='broadcast'?'active':''}`} onClick={()=>setView('broadcast')}>
            <div className="nav-icon">📣</div>
            <div className="nav-label">Broadcast</div>
          </div>
        </div>

        <div className="home-content">
          <div className="home-header">
            <h1>{view === 'users' ? 'Registered Users' : 'Broadcast'}</h1>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <label style={{fontSize:13,color:'#8fa2b8'}}>Batch</label>
              <select value={batchFilter} onChange={(e)=>setBatchFilter(e.target.value)}>
                <option value="all">All</option>
                <option value="1">Batch 1</option>
                <option value="2">Batch 2</option>
              </select>
              <button className="refresh-btn" onClick={fetchUsers}>Refresh</button>
            </div>
          </div>

          {loading && <div className="muted" style={{padding:16}}>Loading users…</div>}
          {error && <div className="error" style={{padding:16}}>{error}</div>}

          {view === 'users' && !loading && !error && (
            <div className="table-wrap">
              <table className="users-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Mobile</th>
                    <th>Batch</th>
                    <th>Feedback</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={6} className="muted">No users found.</td>
                    </tr>
                  )}
                  {users.map((u) => (
                    <tr key={u._id}>
                      <td data-label="ID">{u._id}</td>
                      <td data-label="Name">{u.name}</td>
                      <td data-label="Mobile">{u.mobile}</td>
                      <td data-label="Batch">{u.batch}</td>
                      <td data-label="Feedback" className="feedback-cell">{u.feedback || '—'}</td>
                      <td data-label="Created">{u.createdAt ? new Date(u.createdAt).toLocaleString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {view === 'broadcast' && (
            <div className="broadcast-panel" style={{padding:16}}>
              <h2 style={{margin:'8px 0', color:'#e5edf5'}}>Send broadcast</h2>
              <form onSubmit={sendBroadcast} style={{display:'grid',gap:8}}>
                <textarea placeholder="Message to send" value={broadcastMessage} onChange={e=>setBroadcastMessage(e.target.value)} rows={6} />
                <div style={{display:'flex',gap:8}}>
                  <button className="refresh-btn" type="submit">Send broadcast</button>
                  <button type="button" onClick={()=>{setBroadcastMessage(''); setBroadcastResult(null)}}>Clear</button>
                </div>
              </form>
              {/* {broadcastResult && (
                <div style={{marginTop:8}}>
                  {broadcastResult.error ? <div className="error">{broadcastResult.error}</div> : <div className="muted">Sent: {broadcastResult.sent}, Failed: {broadcastResult.failed}</div>}
                </div>
              )} */}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


// app.use(cors());