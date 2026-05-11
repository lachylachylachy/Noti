export function CodeWorkspace() {
  return (
    <main className="workspace-main workspace-mode-space code-space">
      <div className="mode-header">
        <div>
          <p className="eyebrow">Code Space</p>
          <h1>Write, run, and debug without leaving your flow.</h1>
        </div>
        <button className="new-note-button">Run</button>
      </div>

      <section className="code-layout">
        <div className="code-thread-panel">
          <h2>API Auth flow in Node.js</h2>
          <div className="code-message">Let’s implement a simple JWT authentication middleware.</div>
          <div className="code-file-chip">
            auth-middleware.js<br />
            <small>JavaScript</small>
          </div>
          <textarea placeholder="Ask about your code..." />
        </div>

        <div className="editor-panel">
          <div className="editor-tab">auth-middleware.js</div>
          <pre>{`import jwt from 'jsonwebtoken'
import { config } from 'dotenv'

config()

export function authenticate(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1]

  if (!token) {
    return res.status(401).json({ error: 'No token provided' })
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user = decoded
    next()
  } catch (err) {
    return res.status(403).json({ error: 'Invalid token' })
  }
}`}</pre>
          <div className="terminal-panel">
            ✓ Server running on http://localhost:3000<br />
            ✓ Connected to database
          </div>
        </div>
      </section>
    </main>
  );
}
