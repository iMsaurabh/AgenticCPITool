// NotificationContext manages all notification state globally.
// Provides:
//   - toasts: active toast notifications (auto-dismiss)
//   - notifications: persistent notification history
//   - unreadCount: badge count on notification bubble
//   - SSE connection to scheduler for real time events
//
// Toast lifecycle:
//   event received → added to toasts → auto removed after duration
//
// Notification lifecycle:
//   event received → added to notifications → persists until user reads

import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'

const NotificationContext = createContext(null)

// notification config defaults
const BATCH_WINDOW_MS = 3000   // 3 seconds
const TOAST_DURATION_MS = 6000 // 6 seconds

export function NotificationProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [sseConnected, setSseConnected] = useState(false)

  // batch buffer — collects events before firing grouped toast
  const batchBuffer = useRef([])
  const batchTimer = useRef(null)

  // addToast adds a toast and auto-removes after duration
  const addToast = useCallback((toast) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
    const newToast = { ...toast, id, createdAt: new Date() }

    setToasts(prev => {
      // max 4 toasts visible at once — remove oldest if exceeded
      const updated = [...prev, newToast]
      return updated.slice(-4)
    })

    // auto dismiss after duration
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, TOAST_DURATION_MS)

    return id
  }, [])

  // addNotification adds to persistent notification history
  const addNotification = useCallback((notification) => {
    const id = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
    setNotifications(prev => [{
      ...notification,
      id,
      read: false,
      createdAt: new Date()
    }, ...prev].slice(0, 50)) // keep last 50

    setUnreadCount(prev => prev + 1)
  }, [])

  // processBatch groups buffered events by tool and fires toasts
  const processBatch = useCallback(() => {
    const events = [...batchBuffer.current]
    batchBuffer.current = []

    if (events.length === 0) return

    // group by tool name
    const groups = {}
    for (const event of events) {
      const tool = event.job?.tool || 'unknown'
      if (!groups[tool]) groups[tool] = []
      groups[tool].push(event)
    }

    // fire one toast per tool group
    for (const [tool, groupEvents] of Object.entries(groups)) {
      const succeeded = groupEvents.filter(e => e.job?.status === 'SUCCESS').length
      const failed = groupEvents.filter(e => e.job?.status === 'FAILED').length
      const total = groupEvents.length

      let status, title, message

      if (total === 1) {
        // single job — individual toast
        const event = groupEvents[0]
        status = event.job.status === 'SUCCESS' ? 'success' : 'error'
        title = event.job.name
        message = event.job.status === 'SUCCESS'
          ? `Completed successfully${event.job.attempt > 1 ? ` (retry ${event.job.attempt})` : ''}`
          : `Failed: ${event.error || 'Unknown error'}`
      } else {
        // multiple jobs — batch toast
        if (failed === 0) status = 'success'
        else if (succeeded === 0) status = 'error'
        else status = 'warning'

        title = `${tool} batch complete`
        message = `${succeeded} succeeded · ${failed} failed`
      }

      addToast({ status, title, message, jobs: groupEvents, tool })

      // add to notification center
      addNotification({
        status,
        title,
        message,
        jobs: groupEvents,
        tool,
        isBatch: total > 1
      })
    }
  }, [addToast, addNotification])

  // handleSseEvent processes incoming SSE events from scheduler
  const handleSseEvent = useCallback((event) => {
    const data = JSON.parse(event.data)

    switch (data.type) {
      case 'connected':
        console.log('[SSE] Connected to scheduler')
        break

      case 'operation:completed':
        // blue toast — operation executed successfully
        addToast({
          status: data.status || 'info',
          title: data.title,
          message: data.message
        })
        addNotification({
          status: data.status || 'info',
          title: data.title,
          message: data.message
        })
        break

      case 'job:scheduled':
        // blue toast — job successfully scheduled
        addToast({
          status: 'info',
          title: data.job.name,
          message: `Scheduled${data.job.schedule.frequency === 'once' ? ' to run now' : ''}`
        })
        addNotification({
          status: 'info',
          title: `${data.job.name} scheduled`,
          message: `Frequency: ${data.job.schedule.frequency}`,
          jobs: [data.job]
        })
        break

      case 'job:started':
        // subtle gray toast — job is running
        addToast({
          status: 'info',
          title: data.job.name,
          message: `Running... (attempt ${data.job.attempt}/${data.job.maxAttempts})`
        })
        break

      case 'job:retry':
        // orange individual toast — always immediate, never batched
        addToast({
          status: 'warning',
          title: data.job.name,
          message: `Failed. Retrying in ${Math.round((new Date(data.nextRetryAt) - new Date()) / 60000)} min (${data.attempt}/${data.maxAttempts})`
        })
        addNotification({
          status: 'warning',
          title: `${data.job.name} — retry ${data.attempt}`,
          message: `Next retry at ${new Date(data.nextRetryAt).toLocaleTimeString()}`,
          jobs: [data.job]
        })
        break

      case 'job:complete':
        // add to batch buffer — fires after BATCH_WINDOW_MS
        batchBuffer.current.push(data)

        // reset batch timer
        if (batchTimer.current) clearTimeout(batchTimer.current)
        batchTimer.current = setTimeout(processBatch, BATCH_WINDOW_MS)
        break

      default:
        break
    }
  }, [addToast, addNotification, processBatch])

  // connect to scheduler SSE on mount
  useEffect(() => {
    const schedulerUrl = import.meta.env.VITE_SCHEDULER_MCP_URL || 'http://localhost:3002'
    const eventSource = new EventSource(`${schedulerUrl.replace('/mcp', '')}/events`)

    eventSource.onopen = () => setSseConnected(true)
    eventSource.onmessage = handleSseEvent
    eventSource.onerror = () => {
      setSseConnected(false)
      // EventSource auto-reconnects on error
    }

    return () => {
      eventSource.close()
      if (batchTimer.current) clearTimeout(batchTimer.current)
    }
  }, [handleSseEvent])

  // markAllRead resets unread count
  function markAllRead() {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setUnreadCount(0)
  }

  // dismissToast removes a specific toast
  function dismissToast(toastId) {
    setToasts(prev => prev.filter(t => t.id !== toastId))
  }

  return (
    <NotificationContext.Provider value={{
      toasts,
      notifications,
      unreadCount,
      sseConnected,
      dismissToast,
      markAllRead
    }}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (!context) throw new Error('useNotifications must be used inside NotificationProvider')
  return context
}