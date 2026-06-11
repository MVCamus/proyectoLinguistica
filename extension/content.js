const API_URL = 'http://localhost:8000'

let currentUrl = ''
let sending = false
let watchInterval = null

function cleanVideoUrl(rawUrl) {
  try {
    const u = new URL(rawUrl)
    u.search = ''
    return u.href
  } catch {
    return rawUrl
  }
}

async function send() {
  if (sending) return
  sending = true

  const btn = document.getElementById('mc-btn')
  if (!btn) return

  const videoUrl = cleanVideoUrl(window.location.href)
  setBtnState(btn, '⏳ Enviando...', '#f59e0b')

  try {
    const resp = await fetch(`${API_URL}/api/ingesta`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        urls_manuales: [videoUrl],
        hashtags_incluir: [],
      }),
    })
    if (!resp.ok) {
      const errText = await resp.text()
      throw new Error(errText)
    }

    const data = await resp.json()
    const count = data?.total_candidatos ?? '?'
    setBtnState(btn, '✔ En cola (' + count + ')', '#16a34a')
  } catch (e) {
    const msg = e.message.length > 80 ? e.message.slice(0, 77) + '...' : e.message
    setBtnState(btn, '❌ ' + msg, '#dc2626')
  } finally {
    sending = false
  }
}

function setBtnState(btn, text, bg) {
  btn.textContent = text
  btn.style.background = bg
}

function inject() {
  if (document.getElementById('mc-btn')) return
  if (!window.location.pathname.includes('/video/')) return

  const btn = document.createElement('button')
  btn.id = 'mc-btn'
  btn.type = 'button'
  btn.textContent = '📚 Enviar al corpus'
  Object.assign(btn.style, {
    position: 'fixed', bottom: '20px', right: '20px', zIndex: '999999',
    background: '#22c55e', color: 'white', padding: '10px 18px',
    borderRadius: '8px', cursor: 'pointer', font: '14px/1.4 sans-serif',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)', userSelect: 'none',
    border: 'none',
  })
  btn.onmouseenter = () => { btn.style.background = '#16a34a' }
  btn.onmouseleave = () => { btn.style.background = '#22c55e' }
  btn.onclick = send
  document.body.appendChild(btn)
}

function reinject() {
  const old = document.getElementById('mc-btn')
  if (old) old.remove()
  inject()
}

function watchUrlChange() {
  if (watchInterval) clearInterval(watchInterval)
  watchInterval = setInterval(() => {
    if (window.location.href !== currentUrl) {
      currentUrl = window.location.href
      reinject()
    }
  }, 1000)
}

currentUrl = window.location.href
if (document.body) {
  inject()
  watchUrlChange()
} else {
  document.addEventListener('DOMContentLoaded', () => {
    inject()
    watchUrlChange()
  })
}
