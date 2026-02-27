"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Mail, MessageSquare, Edit, Trash2, Copy } from "lucide-react";
import TemplateEditorModal from "./TemplateEditorModal";

// Mock template data
const MOCK_TEMPLATES = [
  {
    id: "1",
    name: "Initial Introduction Email",
    channel: "Email",
    subject: "Partnership Opportunity with Texas Sports Academy",
    preview: "Hi {{facility_name}}, I hope this email finds you well. I'm reaching out from Texas Sports Academy because we're looking to partner with top-tier facilities like yours...",
  },
  {
    id: "2",
    name: "Follow-up Email",
    channel: "Email",
    subject: "Following up on TSA Partnership",
    preview: "Hi there, I wanted to follow up on my previous email about partnering with {{facility_name}}. We've successfully launched programs at similar facilities and would love to discuss...",
  },
  {
    id: "3",
    name: "Quick SMS Introduction",
    channel: "SMS",
    subject: null,
    preview: "Hi! I'm {{sender_name}} from Texas Sports Academy. We help facilities maximize revenue with youth sports programs. Quick 5 min call? Reply YES",
  },
  {
    id: "4",
    name: "SMS Follow-up",
    channel: "SMS",
    subject: null,
    preview: "Following up on TSA partnership opportunity. We've helped facilities increase revenue by 30%. Open to a quick chat? Reply YES or call {{sender_phone}}",
  },
  {
    id: "5",
    name: "Case Study Email",
    channel: "Email",
    subject: "How We Helped [Similar Facility] Grow Revenue by 35%",
    preview: "Hi {{facility_name}}, I wanted to share a success story that might interest you. We recently partnered with a facility similar to yours in {{city}}...",
  },
  {
    id: "6",
    name: "Meeting Request Email",
    channel: "Email",
    subject: "Quick Chat About TSA Partnership?",
    preview: "Hi {{facility_name}}, Thanks for your interest! I'd love to schedule a brief call to discuss how TSA can help {{facility_name}} increase revenue and serve more families...",
  },
  {
    id: "7",
    name: "Re-engagement SMS",
    channel: "SMS",
    subject: null,
    preview: "Haven't heard back - should I take {{facility_name}} off our partner list? We have 2 spots left in your area. Reply YES to stay on list.",
  },
];

const getChannelColor = (channel: string) => {
  if (channel === "Email") return "bg-blue-50 text-blue-700 border-blue-200";
  return "bg-purple-50 text-purple-700 border-purple-200";
};

const getChannelIcon = (channel: string) => {
  if (channel === "Email") return <Mail className="h-4 w-4" />;
  return <MessageSquare className="h-4 w-4" />;
};

export default function TemplatesView() {
  const [isEditorModalOpen, setIsEditorModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<typeof MOCK_TEMPLATES[0] | null>(null);

  const handleEdit = (template: typeof MOCK_TEMPLATES[0]) => {
    setSelectedTemplate(template);
    setIsEditorModalOpen(true);
  };

  const handleCreate = () => {
    setSelectedTemplate(null);
    setIsEditorModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Message Templates</h2>
          <p className="text-sm text-slate-500 mt-1">
            Create and manage templates for email and SMS campaigns
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4" />
          Create Template
        </button>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {MOCK_TEMPLATES.map((template, index) => (
          <motion.div
            key={template.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm hover:shadow-md transition-all group"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                {getChannelIcon(template.channel)}
                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${getChannelColor(
                    template.channel,
                  )}`}
                >
                  {template.channel}
                </span>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleEdit(template)}
                  className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Edit template"
                >
                  <Edit className="h-3.5 w-3.5" />
                </button>
                <button
                  className="p-1.5 text-slate-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                  title="Duplicate template"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
                <button
                  className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete template"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Template Name */}
            <h3 className="text-sm font-bold text-slate-900 mb-2">
              {template.name}
            </h3>

            {/* Subject Line (Email only) */}
            {template.subject && (
              <div className="mb-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Subject
                </p>
                <p className="text-xs text-slate-700 font-medium line-clamp-1">
                  {template.subject}
                </p>
              </div>
            )}

            {/* Preview */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                Preview
              </p>
              <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                {template.preview}
              </p>
            </div>

            {/* Actions */}
            <div className="mt-4 pt-4 border-t border-slate-100">
              <button
                onClick={() => handleEdit(template)}
                className="w-full px-4 py-2 text-xs font-semibold rounded-lg border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 hover:text-blue-600 hover:border-blue-200 transition-colors"
              >
                Use Template
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Template Editor Modal */}
      <TemplateEditorModal
        isOpen={isEditorModalOpen}
        onClose={() => {
          setIsEditorModalOpen(false);
          setSelectedTemplate(null);
        }}
        template={selectedTemplate}
      />
    </div>
  );
}
