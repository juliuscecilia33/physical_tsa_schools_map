"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Save, Mail, MessageSquare, Eye, Code } from "lucide-react";

interface TemplateEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  template: {
    id: string;
    name: string;
    channel: string;
    subject: string | null;
    preview: string;
  } | null;
}

export default function TemplateEditorModal({
  isOpen,
  onClose,
  template,
}: TemplateEditorModalProps) {
  const [templateName, setTemplateName] = useState("");
  const [channel, setChannel] = useState<"Email" | "SMS">("Email");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  // Load template data when modal opens
  useEffect(() => {
    if (template) {
      setTemplateName(template.name);
      setChannel(template.channel as "Email" | "SMS");
      setSubject(template.subject || "");
      setBody(template.preview);
    } else {
      // Reset for new template
      setTemplateName("");
      setChannel("Email");
      setSubject("");
      setBody("");
    }
  }, [template, isOpen]);

  const handleSave = () => {
    console.log("Template saved:", {
      name: templateName,
      channel,
      subject: channel === "Email" ? subject : null,
      body,
    });
    onClose();
  };

  // Mock merge fields preview
  const renderPreview = () => {
    return body
      .replace(/{{facility_name}}/g, "<strong>Elite Sports Complex</strong>")
      .replace(/{{sports}}/g, "<strong>Basketball, Soccer</strong>")
      .replace(/{{city}}/g, "<strong>Austin</strong>")
      .replace(/{{sender_name}}/g, "<strong>John Smith</strong>")
      .replace(/{{sender_phone}}/g, "<strong>(512) 555-0123</strong>");
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl bg-white rounded-2xl shadow-2xl z-50 max-h-[90vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {template ? "Edit Template" : "Create New Template"}
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  {channel === "Email" ? "Email" : "SMS"} message template
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="grid grid-cols-2 divide-x divide-slate-200">
              {/* Editor Side */}
              <div className="p-6 space-y-6">
                {/* Template Name */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Template Name
                  </label>
                  <input
                    type="text"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="e.g., Initial Introduction Email"
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>

                {/* Channel Selection */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-3">
                    Channel
                  </label>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setChannel("Email")}
                      className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${
                        channel === "Email"
                          ? "border-blue-600 bg-blue-50 text-blue-700"
                          : "border-slate-200 text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      <Mail className="h-4 w-4" />
                      <span className="text-sm font-semibold">Email</span>
                    </button>
                    <button
                      onClick={() => setChannel("SMS")}
                      className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${
                        channel === "SMS"
                          ? "border-purple-600 bg-purple-50 text-purple-700"
                          : "border-slate-200 text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      <MessageSquare className="h-4 w-4" />
                      <span className="text-sm font-semibold">SMS</span>
                    </button>
                  </div>
                </div>

                {/* Subject Line (Email only) */}
                {channel === "Email" && (
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Subject Line
                    </label>
                    <input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="e.g., Partnership Opportunity with TSA"
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                  </div>
                )}

                {/* Message Body */}
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-semibold text-slate-700">
                      Message Body
                    </label>
                    {channel === "SMS" && (
                      <span className="text-xs text-slate-500">
                        {body.length}/160 characters
                      </span>
                    )}
                  </div>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder={`Type your ${channel.toLowerCase()} message here...`}
                    rows={channel === "SMS" ? 6 : 12}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none font-mono"
                  />
                  {channel === "SMS" && body.length > 160 && (
                    <p className="text-xs text-red-600 mt-1">
                      SMS messages over 160 characters will be split into multiple messages
                    </p>
                  )}
                </div>
              </div>

              {/* Preview Side */}
              <div className="p-6 bg-slate-50">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                    Preview
                  </h3>
                  <button
                    onClick={() => setShowPreview(!showPreview)}
                    className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                      showPreview
                        ? "bg-blue-600 text-white"
                        : "bg-white text-slate-600 border border-slate-200"
                    }`}
                  >
                    {showPreview ? (
                      <>
                        <Eye className="h-3 w-3" />
                        Preview
                      </>
                    ) : (
                      <>
                        <Code className="h-3 w-3" />
                        Raw
                      </>
                    )}
                  </button>
                </div>

                {/* Merge Fields Helper */}
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="text-xs font-bold text-blue-900 mb-2 uppercase tracking-wider">
                    Available Merge Fields
                  </h4>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {[
                      "{{facility_name}}",
                      "{{sports}}",
                      "{{city}}",
                      "{{sender_name}}",
                      "{{sender_phone}}",
                    ].map((field) => (
                      <button
                        key={field}
                        onClick={() => setBody(body + " " + field)}
                        className="px-2 py-1 bg-white text-blue-700 font-mono font-semibold rounded border border-blue-200 hover:bg-blue-100 transition-colors"
                      >
                        {field}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preview Display */}
                <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm">
                  {channel === "Email" ? (
                    <div className="space-y-4">
                      {/* Email Header */}
                      <div className="pb-4 border-b border-slate-200">
                        <div className="text-xs text-slate-500 mb-1">Subject:</div>
                        <div className="text-sm font-semibold text-slate-900">
                          {showPreview && subject ? (
                            <div
                              dangerouslySetInnerHTML={{
                                __html: subject
                                  .replace(/{{facility_name}}/g, "<strong>Elite Sports Complex</strong>")
                                  .replace(/{{city}}/g, "<strong>Austin</strong>"),
                              }}
                            />
                          ) : (
                            subject || <span className="text-slate-400 italic">No subject</span>
                          )}
                        </div>
                      </div>

                      {/* Email Body */}
                      <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                        {showPreview && body ? (
                          <div dangerouslySetInnerHTML={{ __html: renderPreview() }} />
                        ) : (
                          body || <span className="text-slate-400 italic">No message body</span>
                        )}
                      </div>
                    </div>
                  ) : (
                    // SMS Preview
                    <div className="max-w-xs">
                      <div className="bg-blue-600 text-white rounded-2xl rounded-bl-sm px-4 py-3 text-sm leading-relaxed">
                        {showPreview && body ? (
                          <div dangerouslySetInnerHTML={{ __html: renderPreview() }} />
                        ) : (
                          body || <span className="text-blue-200 italic">No message</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200 bg-slate-50">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-semibold text-slate-700 hover:text-slate-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!templateName || !body}
                className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="h-4 w-4" />
                Save Template
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
