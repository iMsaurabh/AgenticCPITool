import { useState } from 'react'
import { useSettings } from './context/SettingsContext'
import useChat from './hooks/useChat'
import ChatWindow from './components/Chat/ChatWindow'
import ChatInput from './components/Chat/ChatInput'
import Header from './components/Layout/Header'
import ToastStack from './components/Notifications/ToastStack'
import { NotificationPanel } from './components/Notifications/NotificationCenter'
import Sidebar from './components/Layout/Sidebar'

function App() {
  const { settings } = useSettings()
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const { messages, loading, sendMessage, uploadFile, clearMessages } = useChat(settings)

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">

      {/* header */}
      <Header
        onNotificationsClick={() => setNotificationsOpen(prev => !prev)}
        provider={settings.provider}
        mockMode={settings.mockMode}
      />

      {/* main content */}
      <div className="flex-1 flex overflow-hidden">

        {/* chat area */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <ChatWindow messages={messages} loading={loading} />
          <ChatInput onSend={sendMessage} onUpload={uploadFile} loading={loading} />
        </div>

        {/* persistent sidebar */}
        <Sidebar onClearChat={clearMessages} />

        {/* notification panel — slides over sidebar */}
        {notificationsOpen && (
          <div className="absolute right-0 top-12 bottom-0 w-80 z-40">
            <NotificationPanel onClose={() => setNotificationsOpen(false)} />
          </div>
        )}

      </div>

      {/* toast stack */}
      <ToastStack />

    </div>
  )
}

export default App