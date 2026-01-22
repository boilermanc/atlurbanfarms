import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import AdminPageWrapper from '../components/AdminPageWrapper'
import {
  useEmailTemplates,
  useEmailTemplate,
  useUpdateEmailTemplate,
  useTemplateVersions,
  useBrandSettings,
  useUpdateBrandSettings,
  replaceVariables,
  SAMPLE_PREVIEW_DATA,
  EmailTemplate,
  VariableSchema
} from '../hooks/useEmailTemplates'
import { useEmailService } from '../../hooks/useIntegrations'

// Template icons mapping
const TEMPLATE_ICONS: Record<string, string> = {
  order_confirmation: '📧',
  shipping_notification: '📦',
  welcome: '👋',
  password_reset: '🔑',
  order_ready_pickup: '📍',
}

// Template card component
const TemplateCard: React.FC<{
  template: EmailTemplate
  selected: boolean
  onClick: () => void
}> = ({ template, selected, onClick }) => (
  <motion.button
    onClick={onClick}
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    className={`w-full p-4 rounded-xl text-left transition-all ${
      selected
        ? 'bg-emerald-600 text-white ring-2 ring-emerald-400'
        : 'bg-slate-800 hover:bg-slate-700 text-white'
    }`}
  >
    <div className="flex items-start gap-3">
      <span className="text-2xl">{TEMPLATE_ICONS[template.template_key] || '📄'}</span>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold truncate">{template.name}</h3>
        <p className={`text-sm truncate ${selected ? 'text-emerald-100' : 'text-slate-400'}`}>
          {template.description || 'No description'}
        </p>
        <div className="flex items-center gap-2 mt-2">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
            template.is_active
              ? selected ? 'bg-emerald-500 text-white' : 'bg-emerald-500/20 text-emerald-400'
              : selected ? 'bg-slate-500 text-white' : 'bg-slate-600 text-slate-400'
          }`}>
            {template.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>
    </div>
  </motion.button>
)

// Variable chip component
const VariableChip: React.FC<{
  variable: VariableSchema
  onClick: () => void
}> = ({ variable, onClick }) => (
  <button
    onClick={onClick}
    className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-mono text-emerald-400 transition-colors"
    title={`Example: ${variable.example}`}
  >
    {`{{${variable.key}}}`}
  </button>
)

// Preview device frame
const DeviceFrame: React.FC<{
  mode: 'desktop' | 'mobile'
  children: React.ReactNode
}> = ({ mode, children }) => (
  <div className={`mx-auto bg-white rounded-lg shadow-lg overflow-hidden ${
    mode === 'desktop' ? 'w-full max-w-[600px]' : 'w-[375px]'
  }`}>
    {children}
  </div>
)

const EmailTemplatesPage: React.FC = () => {
  const { templates, loading: loadingTemplates, refetch: refetchTemplates } = useEmailTemplates()
  const { updateTemplate, saving } = useUpdateEmailTemplate()
  const { settings: brandSettings } = useBrandSettings()
  const { sendEmail } = useEmailService()

  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string | null>(null)
  const { template: selectedTemplate, loading: loadingTemplate, refetch: refetchTemplate } = useEmailTemplate(selectedTemplateKey)
  const { versions } = useTemplateVersions(selectedTemplate?.id || null)

  const [editedSubject, setEditedSubject] = useState('')
  const [editedHtml, setEditedHtml] = useState('')
  const [editorMode, setEditorMode] = useState<'html' | 'preview'>('html')
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop')
  const [hasChanges, setHasChanges] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [testEmailAddress, setTestEmailAddress] = useState('')
  const [sendingTest, setSendingTest] = useState(false)
  const [showVersions, setShowVersions] = useState(false)

  // Load template content into editor when selected
  useEffect(() => {
    if (selectedTemplate) {
      setEditedSubject(selectedTemplate.subject_line)
      setEditedHtml(selectedTemplate.html_content)
      setHasChanges(false)
    }
  }, [selectedTemplate])

  // Track changes
  useEffect(() => {
    if (selectedTemplate) {
      const subjectChanged = editedSubject !== selectedTemplate.subject_line
      const htmlChanged = editedHtml !== selectedTemplate.html_content
      setHasChanges(subjectChanged || htmlChanged)
    }
  }, [editedSubject, editedHtml, selectedTemplate])

  // Select first template on load
  useEffect(() => {
    if (templates.length > 0 && !selectedTemplateKey) {
      setSelectedTemplateKey(templates[0].template_key)
    }
  }, [templates, selectedTemplateKey])

  const handleSave = async () => {
    if (!selectedTemplate) return

    const result = await updateTemplate(selectedTemplate.id, {
      subject_line: editedSubject,
      html_content: editedHtml,
    })

    if (result.success) {
      setSaveMessage('Template saved!')
      setHasChanges(false)
      refetchTemplate()
    } else {
      setSaveMessage(`Error: ${result.error}`)
    }

    setTimeout(() => setSaveMessage(null), 3000)
  }

  const handleToggleActive = async () => {
    if (!selectedTemplate) return

    const result = await updateTemplate(selectedTemplate.id, {
      is_active: !selectedTemplate.is_active,
    })

    if (result.success) {
      setSaveMessage(`Template ${selectedTemplate.is_active ? 'deactivated' : 'activated'}!`)
      refetchTemplate()
      refetchTemplates()
    } else {
      setSaveMessage(`Error: ${result.error}`)
    }

    setTimeout(() => setSaveMessage(null), 3000)
  }

  const handleSendTest = async () => {
    if (!selectedTemplate || !testEmailAddress) return

    setSendingTest(true)

    // Merge brand settings with sample data
    const previewData = {
      ...SAMPLE_PREVIEW_DATA,
      ...brandSettings,
    }

    // Replace variables in subject and content
    const processedSubject = replaceVariables(editedSubject, previewData)
    const processedHtml = replaceVariables(editedHtml, previewData)

    const result = await sendEmail({
      to: testEmailAddress,
      subject: `[TEST] ${processedSubject}`,
      html: processedHtml,
    })

    if (result.success) {
      setSaveMessage(`Test email sent to ${testEmailAddress}!`)
    } else {
      setSaveMessage(`Failed to send: ${result.error}`)
    }

    setSendingTest(false)
    setTimeout(() => setSaveMessage(null), 5000)
  }

  const insertVariable = useCallback((key: string) => {
    const textarea = document.querySelector('textarea[data-editor="html"]') as HTMLTextAreaElement
    if (textarea) {
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const variable = `{{${key}}}`
      const newValue = editedHtml.substring(0, start) + variable + editedHtml.substring(end)
      setEditedHtml(newValue)

      // Restore cursor position after the inserted variable
      setTimeout(() => {
        textarea.focus()
        textarea.setSelectionRange(start + variable.length, start + variable.length)
      }, 0)
    } else {
      // If no cursor position, append to end
      setEditedHtml(prev => prev + `{{${key}}}`)
    }
  }, [editedHtml])

  const getPreviewHtml = useCallback(() => {
    const previewData = {
      ...SAMPLE_PREVIEW_DATA,
      ...brandSettings,
    }
    return replaceVariables(editedHtml, previewData)
  }, [editedHtml, brandSettings])

  if (loadingTemplates) {
    return (
      <AdminPageWrapper>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </AdminPageWrapper>
    )
  }

  return (
    <AdminPageWrapper>
      <div className="flex flex-col h-[calc(100vh-120px)]">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Email Templates</h1>
            <p className="text-slate-400 text-sm mt-1">Customize the emails sent to your customers</p>
          </div>
          <div className="flex items-center gap-3">
            <AnimatePresence>
              {saveMessage && (
                <motion.span
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className={`text-sm font-medium ${
                    saveMessage.includes('Error') || saveMessage.includes('Failed')
                      ? 'text-red-400'
                      : 'text-emerald-400'
                  }`}
                >
                  {saveMessage}
                </motion.span>
              )}
            </AnimatePresence>
            {hasChanges && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-500 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Save Changes
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Main content */}
        <div className="flex gap-6 flex-1 min-h-0">
          {/* Template list sidebar */}
          <div className="w-64 flex-shrink-0 space-y-3 overflow-y-auto">
            {templates.map(template => (
              <TemplateCard
                key={template.id}
                template={template}
                selected={selectedTemplateKey === template.template_key}
                onClick={() => setSelectedTemplateKey(template.template_key)}
              />
            ))}
          </div>

          {/* Editor area */}
          {selectedTemplate ? (
            <div className="flex-1 flex flex-col min-w-0 bg-slate-800 rounded-xl overflow-hidden">
              {/* Editor toolbar */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
                <div className="flex items-center gap-4">
                  <h2 className="font-semibold text-white">{selectedTemplate.name}</h2>
                  <button
                    onClick={handleToggleActive}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      selectedTemplate.is_active
                        ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                        : 'bg-slate-600 text-slate-400 hover:bg-slate-500'
                    }`}
                  >
                    {selectedTemplate.is_active ? 'Active' : 'Inactive'}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  {/* Editor mode toggle */}
                  <div className="flex bg-slate-700 rounded-lg p-1">
                    <button
                      onClick={() => setEditorMode('html')}
                      className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                        editorMode === 'html' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      HTML
                    </button>
                    <button
                      onClick={() => setEditorMode('preview')}
                      className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                        editorMode === 'preview' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Preview
                    </button>
                  </div>
                  {editorMode === 'preview' && (
                    <div className="flex bg-slate-700 rounded-lg p-1">
                      <button
                        onClick={() => setPreviewMode('desktop')}
                        className={`px-2 py-1 rounded transition-colors ${
                          previewMode === 'desktop' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                        title="Desktop view"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setPreviewMode('mobile')}
                        className={`px-2 py-1 rounded transition-colors ${
                          previewMode === 'mobile' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                        title="Mobile view"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </div>
                  )}
                  <button
                    onClick={() => setShowVersions(!showVersions)}
                    className="px-3 py-1.5 text-slate-400 hover:text-white text-sm transition-colors"
                  >
                    History ({versions.length})
                  </button>
                </div>
              </div>

              {/* Subject line */}
              <div className="px-4 py-3 border-b border-slate-700">
                <label className="block text-sm text-slate-400 mb-1">Subject Line</label>
                <input
                  type="text"
                  value={editedSubject}
                  onChange={(e) => setEditedSubject(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="Email subject line..."
                />
              </div>

              {/* Editor / Preview */}
              <div className="flex-1 min-h-0 overflow-hidden">
                {editorMode === 'html' ? (
                  <div className="h-full flex">
                    {/* HTML Editor */}
                    <div className="flex-1 flex flex-col">
                      <textarea
                        data-editor="html"
                        value={editedHtml}
                        onChange={(e) => setEditedHtml(e.target.value)}
                        className="flex-1 w-full p-4 bg-slate-900 text-slate-300 font-mono text-sm resize-none focus:outline-none"
                        placeholder="Enter HTML content..."
                        spellCheck={false}
                      />
                    </div>

                    {/* Variables sidebar */}
                    <div className="w-64 border-l border-slate-700 overflow-y-auto p-4">
                      <h3 className="text-sm font-semibold text-white mb-3">Variables</h3>
                      <p className="text-xs text-slate-400 mb-4">Click to insert at cursor</p>
                      <div className="space-y-2">
                        {selectedTemplate.variables_schema?.map((v) => (
                          <VariableChip
                            key={v.key}
                            variable={v}
                            onClick={() => insertVariable(v.key)}
                          />
                        ))}
                      </div>

                      <h4 className="text-sm font-semibold text-white mt-6 mb-3">Global Variables</h4>
                      <div className="space-y-2">
                        {['business_name', 'business_email', 'business_address', 'current_year', 'footer_text'].map(key => (
                          <button
                            key={key}
                            onClick={() => insertVariable(key)}
                            className="block w-full px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-mono text-blue-400 transition-colors text-left"
                          >
                            {`{{${key}}}`}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Preview mode */
                  <div className="h-full overflow-y-auto p-6 bg-slate-700">
                    <DeviceFrame mode={previewMode}>
                      <iframe
                        srcDoc={getPreviewHtml()}
                        title="Email Preview"
                        className="w-full h-[600px] border-0"
                        sandbox="allow-same-origin"
                      />
                    </DeviceFrame>
                  </div>
                )}
              </div>

              {/* Test email bar */}
              <div className="px-4 py-3 border-t border-slate-700 bg-slate-800/50">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-400">Send test to:</span>
                  <input
                    type="email"
                    value={testEmailAddress}
                    onChange={(e) => setTestEmailAddress(e.target.value)}
                    placeholder="your@email.com"
                    className="flex-1 max-w-xs px-3 py-1.5 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                  <button
                    onClick={handleSendTest}
                    disabled={!testEmailAddress || sendingTest}
                    className="px-4 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {sendingTest ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        Send Test
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-slate-800 rounded-xl">
              <p className="text-slate-400">Select a template to edit</p>
            </div>
          )}
        </div>

        {/* Version history modal */}
        <AnimatePresence>
          {showVersions && selectedTemplate && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
              onClick={() => setShowVersions(false)}
            >
              <motion.div
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.95 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-slate-800 rounded-xl p-6 w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-white">Version History</h2>
                  <button
                    onClick={() => setShowVersions(false)}
                    className="p-2 text-slate-400 hover:text-white transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="overflow-y-auto flex-1">
                  {versions.length === 0 ? (
                    <p className="text-slate-400 text-center py-8">No previous versions</p>
                  ) : (
                    <div className="space-y-3">
                      {versions.map((version) => (
                        <div
                          key={version.id}
                          className="p-4 bg-slate-700 rounded-lg"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-white">Version {version.version_number}</span>
                            <span className="text-sm text-slate-400">
                              {new Date(version.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-sm text-slate-400 mt-1 truncate">
                            Subject: {version.subject_line}
                          </p>
                          <button
                            onClick={async () => {
                              setEditedSubject(version.subject_line)
                              setEditedHtml(version.html_content)
                              setShowVersions(false)
                              setSaveMessage('Version restored - click Save to apply')
                              setTimeout(() => setSaveMessage(null), 5000)
                            }}
                            className="mt-2 text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
                          >
                            Restore this version
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AdminPageWrapper>
  )
}

export default EmailTemplatesPage
