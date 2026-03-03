import { NextRequest, NextResponse } from 'next/server';
import { getCloseApiClient } from '@/utils/closeApi';
import { CloseContact } from '@/types/close';

/**
 * GET /api/close/contacts/[id]
 * Get a single contact by ID with related activities
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // In Next.js 15+, params is now a Promise and must be awaited
    const { id: contactId } = await params;

    if (!contactId) {
      return NextResponse.json(
        { success: false, error: 'Contact ID is required' },
        { status: 400 }
      );
    }

    const closeClient = getCloseApiClient();

    // Fetch contact details
    const contact: CloseContact = await closeClient.getContact(contactId);

    // Fetch activities for this contact's lead if lead_id is available
    let activities: any[] = [];
    if (contact.lead_id) {
      try {
        // Fetch calls for the lead
        const callsResponse = await closeClient.getCalls({
          lead_id: contact.lead_id,
          _limit: 50,
        });

        // Fetch emails for the lead
        const emailsResponse = await closeClient.getEmailThreads({
          lead_id: contact.lead_id,
          _limit: 50,
        });

        // Filter activities to only those involving this contact's phone/email
        const contactPhones = new Set(
          contact.phones?.map((p) => p.phone.replace(/\D/g, '')) || []
        );
        const contactEmails = new Set(
          contact.emails?.map((e) => e.email.toLowerCase()) || []
        );

        // Filter calls by phone number match
        const contactCalls = callsResponse.data.filter((call) => {
          if (!call.phone) return false;
          const normalizedPhone = call.phone.replace(/\D/g, '');
          return contactPhones.has(normalizedPhone);
        });

        // Combine and sort activities by date
        activities = [
          ...contactCalls.map((c) => ({ ...c, activity_type: 'call' })),
          ...emailsResponse.data.map((e) => ({ ...e, activity_type: 'email' })),
        ].sort((a, b) =>
          new Date(b.date_created).getTime() - new Date(a.date_created).getTime()
        );
      } catch (activityError) {
        console.error('[Close API] Failed to fetch contact activities:', activityError);
        // Continue without activities if there's an error
      }
    }

    console.log('[Close API] Fetched contact details:', {
      id: contact.id,
      name: contact.name,
      lead_id: contact.lead_id,
      activities_count: activities.length,
    });

    return NextResponse.json({
      success: true,
      data: {
        ...contact,
        activities,
      },
    });
  } catch (error: any) {
    console.error('[Close API] Contact fetch error:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch contact from Close API',
      },
      { status: 500 }
    );
  }
}
