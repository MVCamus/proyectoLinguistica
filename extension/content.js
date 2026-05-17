const API_URL = 'http://localhost:8000'

let currentUrl = ''

async function send() {
  const btn = document.getElementById('mc-btn')
  if (!btn) return

  const videoUrl = window.location.href
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
    setBtnState(btn, '✔ En cola (' + data.total_candidatos + ')', '#16a34a')
  } catch (e) {
    setBtnState(btn, '❌ ' + e.message.slice(0, 25), '#dc2626')
  }
}

function setBtnState(btn, text, bg) {
  btn.textContent = text
  btn.style.background = bg
}

function inject() {
  if (document.getElementById('mc-btn')) return
  if (!window.location.pathname.includes('/video/')) return

  const btn = document.createElement('div')
  btn.id = 'mc-btn'
  btn.textContent = '📚 Enviar al corpus'
  Object.assign(btn.style, {
    position: 'fixed', bottom: '20px', right: '20px', zIndex: '999999',
    background: '#22c55e', color: 'white', padding: '10px 18px',
    borderRadius: '8px', cursor: 'pointer', font: '14px/1.4 sans-serif',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)', userSelect: 'none',
  })
  btn.onmouseenter = () => {
    if (btn.textContent.includes('Enviar') || btn.textContent.includes('Reintentar'))
      btn.style.background = '#16a34a'
  }
  btn.onmouseleave = () => {
    if (btn.textContent.includes('Enviar') || btn.textContent.includes('Reintentar'))
      btn.style.background = '#22c55e'
  }
  btn.onclick = send
  document.body.appendChild(btn)
}

function reinject() {
  const old = document.getElementById('mc-btn')
  if (old) old.remove()
  inject()
}

function watchUrlChange() {
  setInterval(() => {
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
