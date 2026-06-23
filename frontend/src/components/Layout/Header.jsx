import { NotificationBubble } from '../Notifications/NotificationCenter'

function Header({ onNotificationsClick, mockMode }) {
  return (
    <header className="bg-white border-b border-[#e2e8f0] px-4 py-3 flex items-center justify-between flex-shrink-0">

      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center flex-shrink-0">
          <span className="text-white text-sm font-bold">C</span>
        </div>
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-semibold text-[#0f172a]">CPI Agent</h1>
          {mockMode && (
            <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
              Mock
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1">
        <NotificationBubble onClick={onNotificationsClick} />
      </div>

    </header>
  )
}

export default Header
