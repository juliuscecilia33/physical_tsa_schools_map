'use client';

import { useState } from 'react';
import {
  Mail,
  ArrowDownToLine,
  ArrowUpFromLine,
  User,
  Calendar,
  Paperclip,
  AlertCircle,
  ExternalLink,
  Users,
  Clock,
  ChevronDown,
  ChevronUp,
  Download,
  FileText,
  Image as ImageIcon,
  File,
  Eye,
  Copy,
  Check,
} from 'lucide-react';
import { useCloseEmail } from '@/hooks/useCloseCRM';
import { CloseEmailActivity } from '@/types/close';

// Helper functions
function getRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

function getStatusColor(status: string | undefined): string {
  switch (status) {
    case 'sent':
      return 'bg-green-100 text-green-800';
    case 'inbox':
      return 'bg-blue-100 text-blue-800';
    case 'draft':
      return 'bg-gray-100 text-gray-800';
    case 'scheduled':
      return 'bg-purple-100 text-purple-800';
    case 'failed':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

function getAttachmentIcon(contentType: string) {
  if (contentType.startsWith('image/')) {
    return <ImageIcon className="w-4 h-4" />;
  } else if (contentType.includes('pdf')) {
    return <FileText className="w-4 h-4" />;
  }
  return <File className="w-4 h-4" />;
}

function getImportanceBadge(importance: { type: string; reason: string } | undefined) {
  if (!importance || importance.type === 'not_important') return null;

  if (importance.type === 'important') {
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
        Important
      </span>
    );
  }

  return null;
}

function truncateMessageId(id: string): string {
  if (id.length <= 40) return id;
  return id.substring(0, 20) + '...' + id.substring(id.length - 20);
}

// Email Card subcomponent
interface EmailCardProps {
  email: CloseEmailActivity;
  isExpanded: boolean;
  onToggle: () => void;
  index: number;
  total: number;
}

function EmailCard({ email, isExpanded, onToggle, index, total }: EmailCardProps) {
  const [showTechnical, setShowTechnical] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      {/* Email Header - Always Visible */}
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-start justify-between hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="mt-0.5">
            {email.direction === 'incoming' ? (
              <ArrowDownToLine className="w-5 h-5 text-blue-600" />
            ) : (
              <ArrowUpFromLine className="w-5 h-5 text-green-600" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-medium text-gray-900 capitalize">
                {email.direction} Email
              </span>
              {email.status && (
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(email.status)}`}>
                  {email.status}
                </span>
              )}
              {email.envelope?.is_autoreply && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                  Auto-reply
                </span>
              )}
              <span className="text-xs text-gray-500">
                #{total - index}
              </span>
            </div>

            <div className="text-sm space-y-1">
              {email.subject && (
                <p className="font-medium text-gray-900 line-clamp-1">
                  {email.subject}
                </p>
              )}

              {email.envelope?.from && email.envelope.from.length > 0 && (
                <p className="text-gray-600">
                  From: {email.envelope.from[0].name || email.envelope.from[0].email}
                </p>
              )}

              {email.to && email.to.length > 0 && (
                <p className="text-gray-600 truncate">
                  To: {email.to.join(', ')}
                </p>
              )}

              <p className="text-xs text-gray-500">
                {email.date_sent
                  ? new Date(email.date_sent).toLocaleString()
                  : new Date(email.date_created).toLocaleString()}
              </p>
            </div>

            {!isExpanded && email.body_preview && (
              <p className="mt-2 text-sm text-gray-600 line-clamp-2">
                {email.body_preview}
              </p>
            )}
          </div>
        </div>

        <div className="ml-2">
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </button>

      {/* Expanded Email Content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-100">
          {/* Full Email Headers */}
          <div className="space-y-2 text-sm">
            {email.envelope?.from && email.envelope.from.length > 0 && (
              <div className="flex items-start gap-2">
                <span className="text-gray-500 min-w-[80px]">From:</span>
                <div className="flex-1">
                  {email.envelope.from.map((from, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-gray-900">
                        {from.name && `${from.name} `}
                        <span className="text-gray-600">&lt;{from.email}&gt;</span>
                      </span>
                      <button
                        onClick={() => copyToClipboard(from.email, `from-${idx}`)}
                        className="p-1 hover:bg-gray-100 rounded transition-colors"
                        title="Copy email"
                      >
                        {copiedField === `from-${idx}` ? (
                          <Check className="w-3 h-3 text-green-600" />
                        ) : (
                          <Copy className="w-3 h-3 text-gray-400" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {email.envelope?.reply_to && email.envelope.reply_to.length > 0 && (
              <div className="flex items-start gap-2">
                <span className="text-gray-500 min-w-[80px]">Reply-To:</span>
                <div className="flex-1">
                  {email.envelope.reply_to.map((replyTo, idx) => (
                    <span key={idx} className="text-gray-900">
                      {replyTo.name && `${replyTo.name} `}
                      <span className="text-gray-600">&lt;{replyTo.email}&gt;</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {email.to && email.to.length > 0 && (
              <div className="flex items-start gap-2">
                <span className="text-gray-500 min-w-[80px]">To:</span>
                <span className="text-gray-900">{email.to.join(', ')}</span>
              </div>
            )}

            {email.cc && email.cc.length > 0 && (
              <div className="flex items-start gap-2">
                <span className="text-gray-500 min-w-[80px]">CC:</span>
                <span className="text-gray-900">{email.cc.join(', ')}</span>
              </div>
            )}

            {email.bcc && email.bcc.length > 0 && (
              <div className="flex items-start gap-2">
                <span className="text-gray-500 min-w-[80px]">BCC:</span>
                <span className="text-gray-900">{email.bcc.join(', ')}</span>
              </div>
            )}

            <div className="flex items-start gap-2">
              <span className="text-gray-500 min-w-[80px]">Date:</span>
              <div className="flex-1">
                <span className="text-gray-900">
                  {email.date_sent
                    ? new Date(email.date_sent).toLocaleString()
                    : new Date(email.date_created).toLocaleString()}
                </span>
                <span className="text-xs text-gray-500 ml-2">
                  ({getRelativeTime(email.date_sent || email.date_created)})
                </span>
              </div>
            </div>
          </div>

          {/* Email Body */}
          {email.body_preview && (
            <div className="border-t border-gray-100 pt-4">
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                {email.body_preview}
              </p>
            </div>
          )}

          {/* Attachments */}
          {email.attachments && email.attachments.length > 0 && (
            <div className="border-t border-gray-100 pt-4">
              <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <Paperclip className="w-4 h-4" />
                Attachments ({email.attachments.length})
              </h4>
              <div className="space-y-2">
                {email.attachments.map((attachment, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-200"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="text-gray-600">
                        {getAttachmentIcon(attachment.content_type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {attachment.filename}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatFileSize(attachment.size)} • {attachment.content_type}
                          {attachment.inline_only && ' • Inline'}
                        </p>
                      </div>
                    </div>
                    <a
                      href={attachment.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Opens Tracking */}
          {email.opens_summary && (
            <div className="border-t border-gray-100 pt-4">
              <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <Eye className="w-4 h-4" />
                Opens Tracking
              </h4>
              <div className="text-sm text-gray-700">
                <pre className="whitespace-pre-wrap">
                  {JSON.stringify(email.opens_summary, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* Template/Sequence Info */}
          {(email.template_name || email.sequence_name) && (
            <div className="border-t border-gray-100 pt-4">
              <h4 className="text-sm font-semibold text-gray-900 mb-2">
                Campaign Information
              </h4>
              <div className="text-sm space-y-1">
                {email.template_name && (
                  <p className="text-gray-700">
                    <span className="text-gray-500">Template:</span> {email.template_name}
                  </p>
                )}
                {email.sequence_name && (
                  <p className="text-gray-700">
                    <span className="text-gray-500">Sequence:</span> {email.sequence_name}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Technical Details (Collapsible) */}
          <div className="border-t border-gray-100 pt-4">
            <button
              onClick={() => setShowTechnical(!showTechnical)}
              className="flex items-center justify-between w-full text-sm font-semibold text-gray-900 hover:text-gray-700 transition-colors"
            >
              <span>Technical Details</span>
              {showTechnical ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>

            {showTechnical && (
              <div className="mt-2 text-xs text-gray-600 space-y-1 font-mono bg-gray-50 p-3 rounded">
                <p>Email ID: {email.id}</p>
                {email.thread_id && <p>Thread ID: {email.thread_id}</p>}
                {email.message_ids && email.message_ids.length > 0 && (
                  <p>Message ID: {truncateMessageId(email.message_ids[0])}</p>
                )}
                {email.in_reply_to_id && (
                  <p>In Reply To: {truncateMessageId(email.in_reply_to_id)}</p>
                )}
                {email.email_account_id && <p>Email Account: {email.email_account_id}</p>}
                <p>Created: {new Date(email.date_created).toISOString()}</p>
                <p>Updated: {new Date(email.date_updated).toISOString()}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface EmailDetailContentProps {
  emailThreadId: string;
  leadId?: string;
}

export function EmailDetailContent({ emailThreadId, leadId }: EmailDetailContentProps) {
  const { data: emailThread, isLoading: emailLoading, error: emailError } = useCloseEmail(emailThreadId);

  const [expandedEmailIndex, setExpandedEmailIndex] = useState(0);

  const allEmails = emailThread?.emails || emailThread?.latest_emails || [];
  const subject = emailThread?.latest_normalized_subject || emailThread?.subject || '(No Subject)';
  const totalAttachments = allEmails.reduce((sum, email) => sum + (email.attachments?.length || 0), 0);

  if (emailError) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
        <div>
          <p className="font-medium text-red-900">Failed to load email thread</p>
          <p className="text-sm text-red-700 mt-1">{emailError.message}</p>
        </div>
      </div>
    );
  }

  if (emailLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!emailThread) return null;

  return (
    <div className="space-y-6">
      {/* Subject Header */}
      <div className="flex items-center gap-3">
        <Mail className="w-5 h-5 text-gray-600" />
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-gray-900 truncate">{subject}</h3>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <p className="text-sm text-gray-600">
              {emailThread.n_emails || allEmails.length} email{(emailThread.n_emails || allEmails.length) !== 1 ? 's' : ''}
            </p>
            {totalAttachments > 0 && (
              <span className="text-sm text-gray-600 flex items-center gap-1">
                <Paperclip className="w-3 h-3" />
                {totalAttachments} attachment{totalAttachments !== 1 ? 's' : ''}
              </span>
            )}
            {getImportanceBadge(emailThread.importance)}
          </div>
        </div>
      </div>

      {/* Thread Information Section */}
      <div className="bg-gray-50 rounded-lg p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2">
          <Mail className="w-4 h-4" />
          Thread Information
        </h3>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500 mb-1">Latest Activity</p>
            <p className="font-medium text-gray-900">
              {new Date(emailThread.activity_at || emailThread.date_created).toLocaleString()}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {getRelativeTime(emailThread.activity_at || emailThread.date_created)}
            </p>
          </div>

          <div>
            <p className="text-gray-500 mb-1">User</p>
            <p className="font-medium text-gray-900">
              {emailThread.user_name || 'System'}
            </p>
          </div>

          <div>
            <p className="text-gray-500 mb-1">Created</p>
            <p className="font-medium text-gray-900">
              {new Date(emailThread.date_created).toLocaleDateString()}
            </p>
          </div>

          <div>
            <p className="text-gray-500 mb-1">Last Updated</p>
            <p className="font-medium text-gray-900">
              {new Date(emailThread.date_updated).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>

      {/* Participants Section */}
      {emailThread.participants && emailThread.participants.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 space-y-3">
          <h3 className="text-sm font-semibold text-blue-900 uppercase tracking-wider flex items-center gap-2">
            <Users className="w-4 h-4" />
            Participants
          </h3>
          <div className="space-y-2">
            {emailThread.participants.map((participant, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <User className="w-4 h-4 text-blue-600 mt-0.5" />
                <div>
                  {participant.name && (
                    <p className="font-medium text-gray-900">{participant.name}</p>
                  )}
                  <a
                    href={`mailto:${participant.email}`}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    {participant.email}
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Email Thread Timeline */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Email Timeline ({allEmails.length})
        </h3>

        {allEmails.length === 0 ? (
          <p className="text-sm text-gray-500">No emails in this thread</p>
        ) : (
          <div className="space-y-3">
            {allEmails.map((email, index) => (
              <EmailCard
                key={email.id}
                email={email}
                isExpanded={expandedEmailIndex === index}
                onToggle={() => setExpandedEmailIndex(expandedEmailIndex === index ? -1 : index)}
                index={index}
                total={allEmails.length}
              />
            ))}
          </div>
        )}
      </div>

      {/* Actions Section */}
      <div className="flex gap-3">
        <a
          href={`https://app.close.com/activity/email/${emailThread.id}/`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          View in Close
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
}
