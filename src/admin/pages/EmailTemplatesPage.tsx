import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import AdminPageWrapper from '../components/AdminPageWrapper'
import {
  useEmailTemplates,
  useEmailTemplate,
  useCreateEmailTemplate,
  useUpdateEmailTemplate,
  useTemplateVersions,
  useBrandSettings,
  replaceVariables,
  SAMPLE_PREVIEW_DATA,
  EmailTemplate,
  VariableSchema
} from '../hooks/useEmailTemplates'
import { useEmailService } from '../../hooks/useIntegrations'
import { Save, Send, Monitor, Smartphone, History, X, Mail, Package, Tag, Truck, MapPin, Clock, CheckCircle, Key, UserPlus, AlertTriangle, Plus } from 'lucide-react'

// Template icons mapping
const TEMPLATE_ICONS: Record<string, React.ReactNode> = {
  order_confirmation: <Mail size={20} />,
  shipping_notification: <Package size={20} />,
  shipping_label_created: <Tag size={20} />,
  shipping_in_transit: <Truck size={20} />,
  shipping_out_for_delivery: <Truck size={20} />,
  shipping_delivered: <CheckCircle size={20} />,
  pickup_ready: <MapPin size={20} />,
  pickup_reminder: <Clock size={20} />,
  welcome: <UserPlus size={20} />,
  password_reset: <Key size={20} />,
  order_ready_pickup: <MapPin size={20} />,
}

// Category labels and order
const CATEGORY_CONFIG: Record<string, { label: string; icon: React.ReactNode; order: number }> = {
  shipping: { label: 'Shipping', icon: <Package size={16} />, order: 1 },
  orders: { label: 'Orders', icon: <Mail size={16} />, order: 2 },
  account: { label: 'Account', icon: <UserPlus size={16} />, order: 3 },
  general: { label: 'General', icon: <Mail size={16} />, order: 4 },
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
        ? 'bg-emerald-500 text-white ring-2 ring-emerald-300'
        : 'bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm text-slate-800'
    }`}
  >
    <div className="flex items-start gap-3">
      <span className={`${selected ? 'text-white' : 'text-slate-500'}`}>
        {TEMPLATE_ICONS[template.template_key] || <Mail size={20} />}
      </span>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold truncate">{template.name}</h3>
        <p className={`text-sm truncate ${selected ? 'text-emerald-100' : 'text-slate-500'}`}>
          {template.description || 'No description'}
        </p>
        <div className="flex items-center gap-2 mt-2">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
            template.is_active
              ? selected ? 'bg-emerald-400/30 text-white' : 'bg-emerald-100 text-emerald-700'
              : selected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
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
    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-mono text-emerald-600 transition-colors"
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

// Detail row for test email results
const DetailRow: React.FC<{
  label: string
  value: string
  type: 'success' | 'error'
  mono?: boolean
}> = ({ label, value, type, mono }) => (
  <div className="flex items-start gap-2">
    <span className={`w-20 flex-shrink-0 text-xs font-medium ${
      type === 'success' ? 'text-emerald-600' : 'text-red-600'
    }`}>{label}</span>
    <span className={`text-xs truncate ${mono ? 'font-mono' : ''} ${
      type === 'success' ? 'text-emerald-800' : 'text-red-800'
    }`}>{value}</span>
  </div>
)

const EmailTemplatesPage: React.FC = () => {
  const { templates, loading: loadingTemplates, refetch: refetchTemplates } = useEmailTemplates()
  const { createTemplate, saving: creating } = useCreateEmailTemplate()
  const { updateTemplate, saving } = useUpdateEmailTemplate()
  const { settings: brandSettings } = useBrandSettings()
  const { sendEmail } = useEmailService()

  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    template_key: '',
    description: '',
    category: 'general',
    subject_line: '',
  })
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
  const [testEmailResult, setTestEmailResult] = useState<{
    type: 'success' | 'error'
    to: string
    templateName: string
    templateKey: string
    subject: string
    sentAt: string
    emailId?: string
    error?: string
    errorDetails?: string
    variablesReplaced: number
    contentSize: string
  } | null>(null)
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
    setTestEmailResult(null)

    // Merge brand settings with sample data
    const previewData = {
      ...SAMPLE_PREVIEW_DATA,
      ...brandSettings,
    }

    // Replace variables in subject and content
    const processedSubject = replaceVariables(editedSubject, previewData)
    const processedHtml = replaceVariables(editedHtml, previewData)

    // Count variables that were replaced
    const variableMatches = editedHtml.match(/\{\{\w+\}\}/g) || []
    const replacedCount = variableMatches.filter(m => {
      const key = m.replace(/\{\{|\}\}/g, '')
      return previewData[key] !== undefined
    }).length

    // Content size
    const sizeBytes = new Blob([processedHtml]).size
    const contentSize = sizeBytes > 1024
      ? `${(sizeBytes / 1024).toFixed(1)} KB`
      : `${sizeBytes} bytes`

    const sentAt = new Date().toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    })

    const result = await sendEmail({
      to: testEmailAddress,
      subject: `[TEST] ${processedSubject}`,
      html: processedHtml,
    })

    const baseInfo = {
      to: testEmailAddress,
      templateName: selectedTemplate.name,
      templateKey: selectedTemplate.template_key,
      subject: `[TEST] ${processedSubject}`,
      sentAt,
      variablesReplaced: replacedCount,
      contentSize,
    }

    if (result.success) {
      setTestEmailResult({
        ...baseInfo,
        type: 'success',
        emailId: result.id,
      })
    } else {
      setTestEmailResult({
        ...baseInfo,
        type: 'error',
        error: result.error || 'Failed to send test email',
        errorDetails: result.details,
      })
    }

    setSendingTest(false)
  }

  const handleCreateTemplate = async () => {
    if (!newTemplate.name || !newTemplate.template_key || !newTemplate.subject_line) return

    const result = await createTemplate(newTemplate)

    if (result.success && result.template) {
      setShowCreateModal(false)
      setNewTemplate({ name: '', template_key: '', description: '', category: 'general', subject_line: '' })
      await refetchTemplates()
      setSelectedTemplateKey(result.template.template_key)
      setSaveMessage('Template created!')
      setTimeout(() => setSaveMessage(null), 3000)
    } else {
      setSaveMessage(`Error: ${result.error}`)
      setTimeout(() => setSaveMessage(null), 5000)
    }
  }

  // Auto-generate template_key from name
  const handleNewTemplateName = (name: string) => {
    const key = name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 50)
    setNewTemplate(prev => ({ ...prev, name, template_key: key }))
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
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
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
            <h1 className="text-2xl font-bold text-slate-800 font-admin-display">Email Templates</h1>
            <p className="text-slate-500 text-sm mt-1">Customize the emails sent to your customers</p>
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
                      ? 'text-red-600'
                      : 'text-emerald-600'
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
                className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={18} />
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
          <div className="w-64 flex-shrink-0 overflow-y-auto">
            {/* Add new template button */}
            <button
              onClick={() => setShowCreateModal(true)}
              className="w-full mb-4 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl font-medium text-sm transition-colors"
            >
              <Plus size={18} />
              New Template
            </button>

            {/* Group templates by category */}
            {Object.entries(CATEGORY_CONFIG)
              .sort(([, a], [, b]) => a.order - b.order)
              .map(([categoryKey, categoryConfig]) => {
                const categoryTemplates = templates.filter(t => (t.category || 'general') === categoryKey)
                if (categoryTemplates.length === 0) return null

                return (
                  <div key={categoryKey} className="mb-4">
                    <div className="flex items-center gap-2 px-2 py-2 text-sm font-semibold text-slate-500 uppercase tracking-wide">
                      {categoryConfig.icon}
                      <span>{categoryConfig.label}</span>
                    </div>
                    <div className="space-y-2">
                      {categoryTemplates.map(template => (
                        <TemplateCard
                          key={template.id}
                          template={template}
                          selected={selectedTemplateKey === template.template_key}
                          onClick={() => setSelectedTemplateKey(template.template_key)}
                        />
                      ))}
                    </div>
                  </div>
                )
              })}
          </div>

          {/* Editor area */}
          {selectedTemplate ? (
            <div className="flex-1 flex flex-col min-w-0 bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
              {/* Editor toolbar */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
                <div className="flex items-center gap-4">
                  <h2 className="font-semibold text-slate-800">{selectedTemplate.name}</h2>
                  <button
                    onClick={handleToggleActive}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      selectedTemplate.is_active
                        ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {selectedTemplate.is_active ? 'Active' : 'Inactive'}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  {/* Editor mode toggle */}
                  <div className="flex bg-slate-100 rounded-lg p-1">
                    <button
                      onClick={() => setEditorMode('html')}
                      className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                        editorMode === 'html' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      HTML
                    </button>
                    <button
                      onClick={() => setEditorMode('preview')}
                      className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                        editorMode === 'preview' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Preview
                    </button>
                  </div>
                  {editorMode === 'preview' && (
                    <div className="flex bg-slate-100 rounded-lg p-1">
                      <button
                        onClick={() => setPreviewMode('desktop')}
                        className={`p-1 rounded transition-colors ${
                          previewMode === 'desktop' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                        title="Desktop view"
                      >
                        <Monitor size={20} />
                      </button>
                      <button
                        onClick={() => setPreviewMode('mobile')}
                        className={`p-1 rounded transition-colors ${
                          previewMode === 'mobile' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                        title="Mobile view"
                      >
                        <Smartphone size={20} />
                      </button>
                    </div>
                  )}
                  <button
                    onClick={() => setShowVersions(!showVersions)}
                    className="flex items-center gap-1 px-3 py-1.5 text-slate-500 hover:text-slate-700 text-sm transition-colors"
                  >
                    <History size={16} />
                    History ({versions.length})
                  </button>
                </div>
              </div>

              {/* Subject line */}
              <div className="px-4 py-3 border-b border-slate-200">
                <label className="block text-sm text-slate-500 mb-1">Subject Line</label>
                <input
                  type="text"
                  value={editedSubject}
                  onChange={(e) => setEditedSubject(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
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
                        className="flex-1 w-full p-4 bg-slate-50 text-slate-700 font-mono text-sm resize-none focus:outline-none"
                        placeholder="Enter HTML content..."
                        spellCheck={false}
                      />
                    </div>

                    {/* Variables sidebar */}
                    <div className="w-64 border-l border-slate-200 overflow-y-auto p-4 bg-slate-50">
                      <h3 className="text-sm font-semibold text-slate-800 mb-3">Variables</h3>
                      <p className="text-xs text-slate-500 mb-4">Click to insert at cursor</p>
                      <div className="space-y-2">
                        {selectedTemplate.variables_schema?.map((v) => (
                          <VariableChip
                            key={v.key}
                            variable={v}
                            onClick={() => insertVariable(v.key)}
                          />
                        ))}
                      </div>

                      <h4 className="text-sm font-semibold text-slate-800 mt-6 mb-3">Global Variables</h4>
                      <div className="space-y-2">
                        {['business_name', 'business_email', 'business_address', 'current_year', 'footer_text'].map(key => (
                          <button
                            key={key}
                            onClick={() => insertVariable(key)}
                            className="block w-full px-3 py-1.5 bg-white hover:bg-slate-100 rounded-lg text-sm font-mono text-blue-600 transition-colors text-left border border-slate-200"
                          >
                            {`{{${key}}}`}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Preview mode */
                  <div className="h-full overflow-y-auto p-6 bg-slate-100">
                    <DeviceFrame mode={previewMode}>
                      <iframe
                        srcDoc={getPreviewHtml()}
                        title="Email Preview"
                        className="w-full h-[600px] border-0"
                        sandbox="allow-same-origin allow-scripts"
                      />
                    </DeviceFrame>
                  </div>
                )}
              </div>

              {/* Test email bar */}
              <div className="px-4 py-3 border-t border-slate-200 bg-slate-50">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-500">Send test to:</span>
                  <input
                    type="email"
                    value={testEmailAddress}
                    onChange={(e) => setTestEmailAddress(e.target.value)}
                    placeholder="your@email.com"
                    className="flex-1 max-w-xs px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                  <button
                    onClick={handleSendTest}
                    disabled={!testEmailAddress || sendingTest}
                    className="flex items-center gap-2 px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sendingTest ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send size={16} />
                        Send Test
                      </>
                    )}
                  </button>
                </div>
                <AnimatePresence>
                  {testEmailResult && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className={`mt-3 rounded-xl border text-sm overflow-hidden ${
                        testEmailResult.type === 'success'
                          ? 'border-emerald-200 bg-emerald-50'
                          : 'border-red-200 bg-red-50'
                      }`}>
                        {/* Header */}
                        <div className={`flex items-center justify-between px-4 py-2.5 ${
                          testEmailResult.type === 'success'
                            ? 'bg-emerald-100/70 text-emerald-800'
                            : 'bg-red-100/70 text-red-800'
                        }`}>
                          <div className="flex items-center gap-2 font-semibold">
                            {testEmailResult.type === 'success' ? (
                              <CheckCircle size={16} className="text-emerald-600" />
                            ) : (
                              <AlertTriangle size={16} className="text-red-600" />
                            )}
                            {testEmailResult.type === 'success' ? 'Test Email Sent' : 'Test Email Failed'}
                          </div>
                          <button
                            onClick={() => setTestEmailResult(null)}
                            className={`p-1 rounded transition-colors ${
                              testEmailResult.type === 'success'
                                ? 'hover:bg-emerald-200/60 text-emerald-500'
                                : 'hover:bg-red-200/60 text-red-500'
                            }`}
                          >
                            <X size={14} />
                          </button>
                        </div>

                        {/* Details grid */}
                        <div className="px-4 py-3 space-y-1.5">
                          {testEmailResult.type === 'error' && (
                            <div className="flex gap-2 pb-2 mb-2 border-b border-red-200">
                              <AlertTriangle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
                              <div>
                                <span className="font-medium text-red-800">{testEmailResult.error}</span>
                                {testEmailResult.errorDetails && (
                                  <p className="text-red-600 text-xs mt-0.5">{testEmailResult.errorDetails}</p>
                                )}
                              </div>
                            </div>
                          )}
                          <DetailRow label="To" value={testEmailResult.to} type={testEmailResult.type} />
                          <DetailRow label="Template" value={`${testEmailResult.templateName} (${testEmailResult.templateKey})`} type={testEmailResult.type} />
                          <DetailRow label="Subject" value={testEmailResult.subject} type={testEmailResult.type} />
                          {testEmailResult.emailId && (
                            <DetailRow label="Email ID" value={testEmailResult.emailId} type={testEmailResult.type} mono />
                          )}
                          <DetailRow label="Sent at" value={testEmailResult.sentAt} type={testEmailResult.type} />
                          <DetailRow label="Variables" value={`${testEmailResult.variablesReplaced} replaced`} type={testEmailResult.type} />
                          <DetailRow label="Content" value={testEmailResult.contentSize} type={testEmailResult.type} />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-white rounded-2xl shadow-sm border border-slate-200/60">
              <p className="text-slate-500">Select a template to edit</p>
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
                className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col shadow-xl"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-slate-800">Version History</h2>
                  <button
                    onClick={() => setShowVersions(false)}
                    className="p-2 text-slate-400 hover:text-slate-700 transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
                <div className="overflow-y-auto flex-1">
                  {versions.length === 0 ? (
                    <p className="text-slate-500 text-center py-8">No previous versions</p>
                  ) : (
                    <div className="space-y-3">
                      {versions.map((version) => (
                        <div
                          key={version.id}
                          className="p-4 bg-slate-50 rounded-xl border border-slate-200"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-slate-800">Version {version.version_number}</span>
                            <span className="text-sm text-slate-500">
                              {new Date(version.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-sm text-slate-500 mt-1 truncate">
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
                            className="mt-2 text-sm text-emerald-600 hover:text-emerald-700 transition-colors font-medium"
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

        {/* Create template modal */}
        <AnimatePresence>
          {showCreateModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
              onClick={() => setShowCreateModal(false)}
            >
              <motion.div
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.95 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-slate-800">New Email Template</h2>
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="p-2 text-slate-400 hover:text-slate-700 transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Template Name *</label>
                    <input
                      type="text"
                      value={newTemplate.name}
                      onChange={(e) => handleNewTemplateName(e.target.value)}
                      placeholder="e.g. Back in Stock Notification"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Template Key</label>
                    <input
                      type="text"
                      value={newTemplate.template_key}
                      onChange={(e) => setNewTemplate(prev => ({ ...prev, template_key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))}
                      placeholder="auto_generated_from_name"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    />
                    <p className="text-xs text-slate-400 mt-1">Used to reference this template in code</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                    <select
                      value={newTemplate.category}
                      onChange={(e) => setNewTemplate(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    >
                      {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                        <option key={key} value={key}>{config.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                    <input
                      type="text"
                      value={newTemplate.description}
                      onChange={(e) => setNewTemplate(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Brief description of when this email is sent"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Subject Line *</label>
                    <input
                      type="text"
                      value={newTemplate.subject_line}
                      onChange={(e) => setNewTemplate(prev => ({ ...prev, subject_line: e.target.value }))}
                      placeholder="e.g. {{customer_first_name}}, your item is back!"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 text-slate-600 hover:text-slate-800 text-sm font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateTemplate}
                    disabled={creating || !newTemplate.name || !newTemplate.template_key || !newTemplate.subject_line}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {creating ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Plus size={16} />
                        Create Template
                      </>
                    )}
                  </button>
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
