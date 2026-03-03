import { NextRequest, NextResponse } from 'next/server';
import { getCloseApiClient } from '@/utils/closeApi';

/**
 * GET /api/close/leads/[id]
 * Get a single lead by ID with full details including contacts
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // In Next.js 15+, params is now a Promise and must be awaited
    const { id: leadId } = await params;

    if (!leadId) {
      return NextResponse.json(
        { success: false, error: 'Lead ID is required' },
        { status: 400 }
      );
    }

    const closeClient = getCloseApiClient();
    const lead = await closeClient.getLead(leadId);

    console.log('[Close API] Fetched lead details:', {
      id: lead.id,
      name: lead.name,
      contacts: lead.contacts?.length || 0,
    });

    return NextResponse.json({
      success: true,
      data: lead,
    });
  } catch (error: any) {
    console.error('[Close API] Lead fetch error:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch lead from Close API',
      },
      { status: 500 }
    );
  }
}
