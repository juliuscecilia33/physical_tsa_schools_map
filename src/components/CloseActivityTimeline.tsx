'use client';

import { useState } from 'react';
import { CloseActivity } from '@/types/close';
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  Mail,
  FileText,
  CheckCircle2,
  DollarSign,
  Play,
  Clock,
  ArrowDownToLine,
  ArrowUpFromLine,
  Circle,
} from 'lucide-react';

interface CloseActivityTimelineProps {
  activities: CloseActivity[];
  isLoading?: boolean;
}

function getActivityIcon(activity: CloseActivity) {
  switch (activity.type) {
    case 'call':
      return activity.call?.direction === 'inbound' ? (
        <PhoneIncoming className="w-4 h-4" />
      ) : (
        <PhoneOutgoing className="w-4 h-4" />
      );
    case 'email':
      return activity.email?.direction === 'incoming' ? (
        <ArrowDownToLine className="w-4 h-4" />
      ) : (
        <ArrowUpFromLine className="w-4 h-4" />
      );
    case 'note':
      return <FileText className="w-4 h-4" />;
    case 'task':
      return activity.task?.is_complete ? (
        <CheckCircle2 className="w-4 h-4" />
      ) : (
        <Circle className="w-4 h-4" />
      );
    case 'opportunity':
      return <DollarSign className="w-4 h-4" />;
    default:
      return <Circle className="w-4 h-4" />;
  }
}

function getActivityColor(activity: CloseActivity): string {
  switch (activity.type) {
    case 'call':
      return activity.call?.direction === 'inbound'
        ? 'bg-blue-100 text-blue-600 border-blue-200'
        : 'bg-green-100 text-green-600 border-green-200';
    case 'email':
      return 'bg-purple-100 text-purple-600 border-purple-200';
    case 'note':
      return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    case 'task':
      return activity.task?.is_complete
        ? 'bg-emerald-100 text-emerald-600 border-emerald-200'
        : 'bg-gray-100 text-gray-600 border-gray-200';
    case 'opportunity':
      return 'bg-orange-100 text-orange-600 border-orange-200';
    default:
      return 'bg-gray-100 text-gray-600 border-gray-200';
  }
}

function formatDuration(seconds: number | undefined): string {
  if (!seconds) return 'N/A';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function ActivityItem({ activity }: { activity: CloseActivity }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="relative pl-8 pb-6 border-l-2 border-gray-200 last:border-l-0 last:pb-0">
      {/* Icon */}
      <div
        className={`absolute left-0 -ml-[17px] w-8 h-8 rounded-full border-2 flex items-center justify-center ${getActivityColor(
          activity
        )}`}
      >
        {getActivityIcon(activity)}
      </div>

      {/* Content */}
      <div
        className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-gray-900 text-sm">{activity.title}</h4>
            <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-500">
              <span>{new Date(activity.date_created).toLocaleString()}</span>
              {activity.user_name && (
                <>
                  <span>•</span>
                  <span>{activity.user_name}</span>
                </>
              )}
            </div>
          </div>
          <span
            className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${getActivityColor(
              activity
            )}`}
          >
            {activity.type}
          </span>
        </div>

        {/* Preview */}
        {activity.description && (
          <p className="mt-2 text-sm text-gray-700 line-clamp-2">
            {activity.description}
          </p>
        )}

        {/* Type-specific details */}
        {activity.type === 'call' && activity.call && (
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-600">
            {activity.call.duration !== undefined && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDuration(activity.call.duration)}
              </span>
            )}
            {activity.call.disposition && (
              <span className="px-2 py-0.5 bg-gray-100 rounded capitalize">
                {activity.call.disposition.replace('-', ' ')}
              </span>
            )}
            {activity.call.phone && (
              <span className="font-mono">{activity.call.phone}</span>
            )}
          </div>
        )}

        {/* Expandable details */}
        {expanded && (
          <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
            {/* Call details */}
            {activity.type === 'call' && activity.call && (
              <>
                {activity.call.note && (
                  <div>
                    <p className="text-xs font-medium text-gray-700 mb-1">Notes:</p>
                    <p className="text-sm text-gray-600">{activity.call.note}</p>
                  </div>
                )}
                {activity.call.recording_url && (
                  <a
                    href={activity.call.recording_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    <Play className="w-4 h-4" />
                    Play Recording
                  </a>
                )}
              </>
            )}

            {/* Email details */}
            {activity.type === 'email' && activity.email && (
              <div>
                {(activity.email.latest_normalized_subject || activity.email.subject) && (
                  <p className="text-xs font-medium text-gray-700 mb-1">
                    Subject: {activity.email.latest_normalized_subject || activity.email.subject}
                  </p>
                )}
                {(activity.email.preview || activity.email.snippet) && (
                  <p className="text-sm text-gray-600">
                    {activity.email.preview || activity.email.snippet}
                  </p>
                )}
              </div>
            )}

            {/* Note details */}
            {activity.type === 'note' && activity.note && (
              <div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {activity.note.note}
                </p>
              </div>
            )}

            {/* Task details */}
            {activity.type === 'task' && activity.task && (
              <div>
                <p className="text-sm text-gray-700">{activity.task.text}</p>
                {activity.task.due_date && (
                  <p className="text-xs text-gray-500 mt-2">
                    Due: {new Date(activity.task.due_date).toLocaleDateString()}
                  </p>
                )}
              </div>
            )}

            {/* Opportunity details */}
            {activity.type === 'opportunity' && activity.opportunity && (
              <div className="space-y-1 text-sm">
                {activity.opportunity.value_formatted && (
                  <p className="font-semibold text-gray-900">
                    {activity.opportunity.value_formatted}
                  </p>
                )}
                {activity.opportunity.status_label && (
                  <p className="text-gray-600">
                    Status: {activity.opportunity.status_label}
                  </p>
                )}
                {activity.opportunity.confidence !== undefined && (
                  <p className="text-gray-600">
                    Confidence: {activity.opportunity.confidence}%
                  </p>
                )}
                {activity.opportunity.note && (
                  <p className="text-gray-700 mt-2">{activity.opportunity.note}</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function CloseActivityTimeline({
  activities,
  isLoading,
}: CloseActivityTimelineProps) {
  const [filter, setFilter] = useState<string>('all');

  const filteredActivities =
    filter === 'all'
      ? activities
      : activities.filter((a) => a.type === filter);

  const activityCounts = {
    all: activities.length,
    call: activities.filter((a) => a.type === 'call').length,
    email: activities.filter((a) => a.type === 'email').length,
    note: activities.filter((a) => a.type === 'note').length,
    task: activities.filter((a) => a.type === 'task').length,
    opportunity: activities.filter((a) => a.type === 'opportunity').length,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        <FileText className="w-12 h-12 mx-auto mb-3 text-gray-400" />
        <p className="text-sm">No activity history found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter buttons */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'all', label: 'All', icon: Circle },
          { id: 'call', label: 'Calls', icon: Phone },
          { id: 'email', label: 'Emails', icon: Mail },
          { id: 'note', label: 'Notes', icon: FileText },
          { id: 'task', label: 'Tasks', icon: CheckCircle2 },
          { id: 'opportunity', label: 'Opportunities', icon: DollarSign },
        ].map((btn) => {
          const Icon = btn.icon;
          const count = activityCounts[btn.id as keyof typeof activityCounts];
          if (count === 0 && btn.id !== 'all') return null;

          return (
            <button
              key={btn.id}
              onClick={() => setFilter(btn.id)}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
                filter === btn.id
                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {btn.label}
              <span className="text-xs bg-white px-1.5 py-0.5 rounded">
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Timeline */}
      <div className="mt-6">
        {filteredActivities.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p className="text-sm">No {filter} activities found</p>
          </div>
        ) : (
          filteredActivities.map((activity) => (
            <ActivityItem key={activity.id} activity={activity} />
          ))
        )}
      </div>
    </div>
  );
}
