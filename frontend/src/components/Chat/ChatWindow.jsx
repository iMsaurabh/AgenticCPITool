import { useEffect, useRef } from 'react'
import MessageBubble from './MessageBubble'

function ChatWindow({ messages, loading }) {
    const bottomRef = useRef(null)

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages, loading])

    return (
        <div className="flex-1 overflow-y-auto px-4 py-4 bg-white">

            {messages.length === 0 && !loading && (
                <div className="h-full flex flex-col items-center justify-center text-[#94a3b8]">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
                        <svg className="w-6 h-6 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                    </div>
                    <p className="text-sm font-medium text-slate-500">Start a conversation</p>
                    <p className="text-xs mt-1 text-[#94a3b8]">Ask about message status, logs, or deployments</p>
                </div>
            )}

            {messages.map(message => (
                <MessageBubble key={message.id} message={message} />
            ))}

            {loading && (
                <div className="flex justify-start mb-4">
                    <div className="bg-white border border-[#e2e8f0] rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                        <div className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                            <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                            <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce"></div>
                        </div>
                    </div>
                </div>
            )}

            <div ref={bottomRef} />
        </div>
    )
}

export default ChatWindow
