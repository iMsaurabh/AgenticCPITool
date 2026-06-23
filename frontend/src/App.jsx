import { useState } from 'react'
import { useSettings } from './context/SettingsContext'
import useChat from './hooks/useChat'
import ChatWindow from './components/Chat/ChatWindow'
import ChatInput from './components/Chat/ChatInput'
import Header from './components/Layout/Header'
import NavPane from './components/Layout/NavPane'
import ToastStack from './components/Notifications/ToastStack'
import { NotificationPanel } from './components/Notifications/NotificationCenter'
import EnvironmentPanel from './components/Environment/EnvironmentPanel'
import ProviderSettings from './components/Settings/ProviderSettings'
import McpAdminPanel from './components/Settings/McpAdminPanel'
import JobsPanel from './components/Settings/JobsPanel'

function App() {
  const { settings, activeEnvironment } = useSettings()
  const [activeTab, setActiveTab] = useState('chat')
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const { messages, loading, sendMessage, uploadFile, clearMessages } = useChat(settings)

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden">

      <Header
        mockMode={settings.mockMode}
        onNotificationsClick={() => setNotificationsOpen(prev => !prev)}
      />

      <div className="flex-1 flex overflow-hidden relative">

        <NavPane activeTab={activeTab} onTabChange={setActiveTab} />

        <main className="flex-1 flex flex-col overflow-hidden bg-white">

          {activeTab === 'chat' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 border-b border-[#e2e8f0] flex-shrink-0">
                {/* active environment indicator */}
                {activeEnvironment ? (
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
                    <span className="text-xs font-medium text-slate-600">{activeEnvironment.name}</span>
                    {settings.mockMode && (
                      <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">Mock</span>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-slate-300 flex-shrink-0" />
                    <span className="text-xs text-[#94a3b8]">No environment active</span>
                  </div>
                )}
                {messages.length > 0 && (
                  <button
                    onClick={clearMessages}
                    className="text-xs text-[#94a3b8] hover:text-slate-600 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
              <ChatWindow messages={messages} loading={loading} />
              <ChatInput onSend={sendMessage} onUpload={uploadFile} loading={loading} />
            </div>
          )}

          {activeTab === 'environment' && (
            <div className="flex-1 overflow-y-auto">
              <EnvironmentPanel />
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="flex-1 overflow-y-auto">
              <div className="max-w-xl mx-auto p-6">
                <div className="mb-6">
                  <h2 className="text-base font-semibold text-[#0f172a]">Settings</h2>
                  <p className="text-sm text-[#94a3b8] mt-1">Configure AI provider and application behavior</p>
                </div>
                <div className="bg-white border border-[#e2e8f0] rounded-xl p-5">
                  <ProviderSettings />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'mcp' && (
            <div className="flex-1 overflow-y-auto">
              <div className="max-w-2xl mx-auto p-6">
                <div className="mb-6">
                  <h2 className="text-base font-semibold text-[#0f172a]">MCP Servers</h2>
                  <p className="text-sm text-[#94a3b8] mt-1">Manage connected servers and their tools</p>
                </div>
                <McpAdminPanel inline={true} />
              </div>
            </div>
          )}

          {activeTab === 'jobs' && (
            <div className="flex-1 overflow-y-auto">
              <div className="max-w-2xl mx-auto p-6">
                <div className="mb-6">
                  <h2 className="text-base font-semibold text-[#0f172a]">Scheduled Jobs</h2>
                  <p className="text-sm text-[#94a3b8] mt-1">Job history and upcoming scheduled executions</p>
                </div>
                <JobsPanel inline={true} />
              </div>
            </div>
          )}

        </main>

        {notificationsOpen && (
          <div className="absolute right-0 top-0 bottom-0 w-80 z-40 shadow-xl">
            <NotificationPanel onClose={() => setNotificationsOpen(false)} />
          </div>
        )}

      </div>

      <ToastStack />

    </div>
  )
}

export default App
