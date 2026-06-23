// useChat is a custom hook that manages all chat state and logic.
// It is the single source of truth for the conversation.
//
// Returns:
//   messages    - array of all messages in the conversation
//   loading     - true while waiting for agent response
//   error       - error message if request failed
//   sendMessage - function to send a new message

import { useState, useCallback } from 'react'
import apiService from '../services/apiService'

// message shape:
// {
//   id: unique identifier
//   role: 'user' | 'agent'
//   content: message text
//   metadata: { agent, delegatedTo, iterations } — agent responses only
//   timestamp: Date
//   error: true/false
// }

function useChat(settings) {
    const [messages, setMessages] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    // useCallback prevents sendMessage from being recreated
    // on every render — performance optimization
    const sendMessage = useCallback(async (text) => {
        if (!text.trim()) return

        // clear previous error
        setError(null)

        // add user message to conversation immediately
        // user sees their message right away before agent responds
        const userMessage = {
            id: Date.now(),
            role: 'user',
            content: text.trim(),
            timestamp: new Date()
        }

        setMessages(prev => [...prev, userMessage])
        setLoading(true)

        try {
            // send to backend — provider and apiKey come from settings
            // timezone is detected from the browser for local-time scheduling
            const result = await apiService.sendMessage(
                text.trim(),
                settings?.provider || 'groq',
                settings?.apiKey || null,
                settings?.mockMode,
                messages,
                Intl.DateTimeFormat().resolvedOptions().timeZone
            )

            // add agent response to conversation
            const agentMessage = {
                id: Date.now() + 1,
                role: 'agent',
                content: result.response,
                metadata: {
                    agent: result.agent,
                    delegatedTo: result.delegatedTo || [],
                    iterations: result.iterations
                },
                timestamp: new Date()
            }

            setMessages(prev => [...prev, agentMessage])

        } catch (err) {
            // add error message to conversation
            const errorMessage = {
                id: Date.now() + 1,
                role: 'agent',
                content: err.response?.data?.error || 'Something went wrong. Please try again.',
                timestamp: new Date(),
                error: true
            }
            setMessages(prev => [...prev, errorMessage])
            setError(err.message)

        } finally {
            setLoading(false)
        }
    }, [settings, messages])

    const uploadFile = useCallback(async (file, message) => {
        setError(null)

        const userMessage = {
            id: Date.now(),
            role: 'user',
            content: message ? `📎 ${file.name} — ${message}` : `📎 ${file.name}`,
            timestamp: new Date()
        }

        setMessages(prev => [...prev, userMessage])
        setLoading(true)

        try {
            const formData = new FormData()
            formData.append('file', file)
            if (message) formData.append('message', message)

            const result = await apiService.uploadFile(formData)

            const agentMessage = {
                id: Date.now() + 1,
                role: 'agent',
                content: result.data.message || 'Batch execution complete.',
                metadata: { agent: 'batchExecutionAgent' },
                timestamp: new Date(),
                batchResults: result.data.results,
                reportUrl: result.data.reportUrl
            }

            setMessages(prev => [...prev, agentMessage])

        } catch (err) {
            const errorMessage = {
                id: Date.now() + 1,
                role: 'agent',
                content: err.response?.data?.error || 'File processing failed. Please try again.',
                timestamp: new Date(),
                error: true
            }
            setMessages(prev => [...prev, errorMessage])
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }, [settings])

    // clearMessages resets the conversation
    const clearMessages = useCallback(() => {
        setMessages([])
        setError(null)
    }, [])

    return { messages, loading, error, sendMessage, uploadFile, clearMessages }
}

export default useChat