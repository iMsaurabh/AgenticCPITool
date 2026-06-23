import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

function MessageBubble({ message }) {
    const isUser = message.role === 'user'
    const isError = message.error

    const time = message.timestamp
        ? new Date(message.timestamp).toLocaleTimeString(undefined, {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        })
        : ''

    return (
        <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
            <div className={`max-w-[75%] ${isUser ? 'order-2' : 'order-1'}`}>

                <div className={`
                    px-4 py-3 rounded-2xl text-sm leading-relaxed
                    ${isUser
                        ? 'bg-indigo-500 text-white rounded-br-sm'
                        : isError
                            ? 'bg-red-50 text-red-700 border border-red-200 rounded-bl-sm'
                            : 'bg-white text-[#0f172a] border border-[#e2e8f0] rounded-bl-sm shadow-sm'
                    }
                `}>
                    {isUser ? (
                        <span className="whitespace-pre-wrap">{message.content}</span>
                    ) : (
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                                table: ({ node, ...props }) => (
                                    <div className="overflow-x-auto my-2">
                                        <table className="w-full border-collapse text-xs" {...props} />
                                    </div>
                                ),
                                thead: ({ node, ...props }) => (
                                    <thead className="bg-slate-50 text-slate-500 uppercase" {...props} />
                                ),
                                th: ({ node, ...props }) => (
                                    <th className="px-3 py-2 text-left border border-slate-200" {...props} />
                                ),
                                td: ({ node, ...props }) => (
                                    <td className="px-3 py-2 border border-slate-200" {...props} />
                                ),
                                tr: ({ node, ...props }) => (
                                    <tr className="even:bg-slate-50" {...props} />
                                ),
                                p: ({ node, ...props }) => (
                                    <p className="mb-2 last:mb-0 whitespace-pre-wrap" {...props} />
                                )
                            }}
                        >
                            {message.content}
                        </ReactMarkdown>
                    )}
                </div>

                {!isUser && message.batchResults && (
                    <div className="mt-2 border border-[#e2e8f0] rounded-xl overflow-hidden shadow-sm">
                        <table className="w-full text-xs">
                            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wide">
                                <tr>
                                    <th className="px-3 py-2 text-left">Artifact</th>
                                    <th className="px-3 py-2 text-left">Parameter</th>
                                    <th className="px-3 py-2 text-left">Value</th>
                                    <th className="px-3 py-2 text-left">Status</th>
                                    <th className="px-3 py-2 text-left">Deploy</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {message.batchResults.flatMap(artifact =>
                                    artifact.parameters.map((param, i) => (
                                        <tr key={`${artifact.artifactId}-${param.key}`} className="bg-white">
                                            <td className="px-3 py-2 text-slate-700 font-medium">
                                                {i === 0 ? artifact.artifactId : ''}
                                            </td>
                                            <td className="px-3 py-2 text-slate-600">{param.key}</td>
                                            <td className="px-3 py-2 text-slate-600">{param.value}</td>
                                            <td className="px-3 py-2">
                                                <span className={`px-2 py-0.5 rounded-full font-medium ${param.status === 'success'
                                                    ? 'bg-green-100 text-green-700'
                                                    : 'bg-red-100 text-red-700'
                                                    }`}>
                                                    {param.status}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2">
                                                {i === 0 && (
                                                    <span className={`px-2 py-0.5 rounded-full font-medium ${artifact.deploy?.status === 'success'
                                                        ? 'bg-green-100 text-green-700'
                                                        : artifact.deploy?.status === 'failed'
                                                            ? 'bg-red-100 text-red-700'
                                                            : 'bg-slate-100 text-slate-500'
                                                        }`}>
                                                        {artifact.deploy?.status}
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>

                        {message.reportUrl && (
                            <div className="bg-slate-50 px-3 py-2 border-t border-[#e2e8f0]">
                                <button
                                    onClick={() => window.open(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}${message.reportUrl}`)}
                                    className="text-xs text-indigo-500 hover:text-indigo-700 flex items-center gap-1 cursor-pointer"
                                >
                                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M19 9h-4V3H9v6H5l7 7 7-7zm-8 2V5h2v6h1.17L12 13.17 9.83 11H11zm-6 7h14v2H5v-2z" />
                                    </svg>
                                    Download Report
                                </button>
                            </div>
                        )}
                    </div>
                )}

                <div className={`text-xs text-[#94a3b8] mt-1 ${isUser ? 'text-right' : 'text-left'}`}>
                    {time}
                </div>

                {!isUser && !isError && message.metadata && (
                    <div className="text-xs text-[#94a3b8] mt-1 flex items-center gap-2">
                        {message.metadata.delegatedTo?.length > 0 && (
                            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                                {message.metadata.delegatedTo.join(', ')}
                            </span>
                        )}
                        {message.metadata.iterations && (
                            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                                {message.metadata.iterations} {message.metadata.iterations === 1 ? 'step' : 'steps'}
                            </span>
                        )}
                    </div>
                )}

            </div>
        </div>
    )
}

export default MessageBubble
