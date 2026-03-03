import { NextRequest, NextResponse } from 'next/server';
import { getCloseApiClient } from '@/utils/closeApi';

/**
 * GET /api/close/emails/[id]
 * Get a single email thread by ID with full details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // In Next.js 15+, params is now a Promise and must be awaited
    const { id: emailThreadId } = await params;

    if (!emailThreadId) {
      return NextResponse.json(
        { success: false, error: 'Email thread ID is required' },
        { status: 400 }
      );
    }

    const closeClient = getCloseApiClient();
    const emailThread = await closeClient.getEmailThread(emailThreadId);

    console.log('[Close API] Fetched email thread details:', {
      id: emailThread.id,
      subject: emailThread.latest_normalized_subject,
      n_emails: emailThread.n_emails,
      lead_id: emailThread.lead_id,
    });

    return NextResponse.json({
      success: true,
      data: emailThread,
    });
  } catch (error: any) {
    console.error('[Close API] Email thread fetch error:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch email thread from Close API',
      },
      { status: 500 }
    );
  }
}
