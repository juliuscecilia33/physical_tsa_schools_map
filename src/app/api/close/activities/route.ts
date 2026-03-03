import { NextRequest, NextResponse } from 'next/server';
import { getCloseApiClient } from '@/utils/closeApi';
import type { CloseActivity } from '@/types/close';

/**
 * GET /api/close/activities
 * Get all activities for a specific lead
 * Query params: lead_id (required), _limit, _skip
 *
 * Returns a unified timeline of all activity types:
 * - Calls
 * - Emails
 * - Notes
 * - Tasks (if lead_id provided)
 * - Opportunities (if lead_id provided)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const leadId = searchParams.get('lead_id');

    if (!leadId) {
      return NextResponse.json(
        { success: false, error: 'lead_id query parameter is required' },
        { status: 400 }
      );
    }

    const limit = searchParams.get('_limit') ? parseInt(searchParams.get('_limit')!) : 100;

    const closeClient = getCloseApiClient();

    // Fetch all activity types in parallel
    const [callsRes, emailsRes, notesRes, tasksRes, opportunitiesRes] = await Promise.allSettled([
      closeClient.getCalls({ lead_id: leadId, _limit: limit }),
      closeClient.getEmailThreads({ lead_id: leadId, _limit: limit }),
      closeClient.getNotes({ lead_id: leadId, _limit: limit }),
      closeClient.getTasks({ lead_id: leadId, _limit: limit }),
      closeClient.getOpportunities({ lead_id: leadId, _limit: limit }),
    ]);

    // Extract successful responses
    const calls = callsRes.status === 'fulfilled' ? callsRes.value.data : [];
    const emails = emailsRes.status === 'fulfilled' ? emailsRes.value.data : [];
    const notes = notesRes.status === 'fulfilled' ? notesRes.value.data : [];
    const tasks = tasksRes.status === 'fulfilled' ? tasksRes.value.data : [];
    const opportunities = opportunitiesRes.status === 'fulfilled' ? opportunitiesRes.value.data : [];

    // Combine all activities into unified format
    const activities: CloseActivity[] = [
      ...calls.map((call: any) => ({
        id: call.id,
        type: 'call' as const,
        lead_id: call.lead_id,
        user_id: call.user_id,
        user_name: call.user_name,
        date_created: call.date_created,
        date_updated: call.date_updated,
        call,
        title: `${call.direction === 'inbound' ? 'Incoming' : 'Outgoing'} Call`,
        description: call.note || call.disposition || '',
      })),
      ...emails.map((email: any) => ({
        id: email.id,
        type: 'email' as const,
        lead_id: email.lead_id,
        user_id: email.user_id,
        user_name: email.user_name,
        date_created: email.date_created,
        date_updated: email.date_updated,
        email,
        title: email.latest_normalized_subject || email.subject || '(No Subject)',
        description: email.preview || email.snippet || (email.latest_emails?.[0]?.body_preview) || '',
      })),
      ...notes.map((note: any) => ({
        id: note.id,
        type: 'note' as const,
        lead_id: note.lead_id,
        user_id: note.user_id,
        user_name: note.user_name,
        date_created: note.date_created,
        date_updated: note.date_updated,
        note,
        title: 'Note',
        description: note.note || '',
      })),
      ...tasks.map((task: any) => ({
        id: task.id,
        type: 'task' as const,
        lead_id: task.lead_id,
        user_id: task.assigned_to,
        date_created: task.date_created,
        date_updated: task.date_updated,
        task,
        title: task.is_complete ? 'Completed Task' : 'Task',
        description: task.text || '',
      })),
      ...opportunities.map((opp: any) => ({
        id: opp.id,
        type: 'opportunity' as const,
        lead_id: opp.lead_id,
        date_created: opp.date_created,
        date_updated: opp.date_updated,
        opportunity: opp,
        title: `Opportunity ${opp.status_type || ''}`,
        description: opp.note || opp.value_formatted || '',
      })),
    ];

    // Sort by date_created descending (most recent first)
    activities.sort((a, b) =>
      new Date(b.date_created).getTime() - new Date(a.date_created).getTime()
    );

    console.log('[Close API] Fetched activities for lead:', {
      lead_id: leadId,
      total: activities.length,
      breakdown: {
        calls: calls.length,
        emails: emails.length,
        notes: notes.length,
        tasks: tasks.length,
        opportunities: opportunities.length,
      },
    });

    return NextResponse.json({
      success: true,
      data: activities,
      count: {
        total: activities.length,
        calls: calls.length,
        emails: emails.length,
        notes: notes.length,
        tasks: tasks.length,
        opportunities: opportunities.length,
      },
    });
  } catch (error: any) {
    console.error('[Close API] Activities fetch error:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch activities from Close API',
      },
      { status: 500 }
    );
  }
}
