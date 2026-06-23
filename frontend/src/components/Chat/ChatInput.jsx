import { useState, useRef } from 'react'

function ChatInput({ onSend, onUpload, loading }) {
  const [text, setText] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const textareaRef = useRef(null)
  const fileInputRef = useRef(null)

  function handleSend() {
    if (loading) return

    if (selectedFile) {
      if (!text.trim() && !selectedFile) return
      onUpload(selectedFile, text)
      setSelectedFile(null)
      setText('')
    } else {
      if (!text.trim()) return
      onSend(text)
      setText('')
    }

    setTimeout(() => textareaRef.current?.focus(), 0)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleFileChange(e) {
    const file = e.target.files[0]
    if (!file) return
    const valid = file.name.endsWith('.xlsx') || file.name.endsWith('.xls')
    if (!valid) {
      alert('Only .xlsx or .xls files are supported')
      return
    }
    setSelectedFile(file)
    e.target.value = ''
  }

  function removeFile() {
    setSelectedFile(null)
  }

  const canSend = !loading && (text.trim() || selectedFile)

  return (
    <div className="border-t border-[#e2e8f0] bg-white px-4 py-3">
      {selectedFile && (
        <div className="max-w-4xl mx-auto mb-2 flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2">
          <svg className="w-4 h-4 text-indigo-500 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM6 20V4h5v7h7v9H6z" />
          </svg>
          <span className="text-sm text-indigo-700 flex-1 truncate">{selectedFile.name}</span>
          <button onClick={removeFile} className="text-indigo-400 hover:text-indigo-600 flex-shrink-0">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>
      )}

      <div className="flex items-end gap-2 max-w-4xl mx-auto">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileChange}
          className="hidden"
        />

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
          className="
            flex items-center justify-center
            w-10 h-10 rounded-xl
            text-[#94a3b8] hover:text-indigo-500 hover:bg-indigo-50
            disabled:text-slate-200
            transition-colors duration-150
            flex-shrink-0
          "
          title="Upload Excel file"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
          </svg>
        </button>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={selectedFile ? "Add a message or just hit send..." : "Ask about message status, logs, or deployments..."}
          disabled={loading}
          rows={1}
          className="
            flex-1 resize-none rounded-xl border border-[#e2e8f0]
            px-4 py-2.5 text-sm text-[#0f172a]
            placeholder:text-[#94a3b8]
            focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
            disabled:bg-slate-50 disabled:text-slate-400
            max-h-32 overflow-y-auto bg-white
          "
          style={{ height: 'auto', minHeight: '42px' }}
          onInput={e => {
            e.target.style.height = 'auto'
            e.target.style.height = e.target.scrollHeight + 'px'
          }}
        />

        <button
          onClick={handleSend}
          disabled={!canSend}
          className="
            flex items-center justify-center
            w-10 h-10 rounded-xl
            bg-indigo-500 text-white
            hover:bg-indigo-600
            disabled:bg-slate-200 disabled:text-slate-400
            transition-colors duration-150
            flex-shrink-0
          "
        >
          {loading ? (
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          )}
        </button>
      </div>

      <p className="text-xs text-[#94a3b8] text-center mt-2">
        Enter to send · Shift+Enter for new line · Attach .xlsx for batch operations
      </p>
    </div>
  )
}

export default ChatInput
