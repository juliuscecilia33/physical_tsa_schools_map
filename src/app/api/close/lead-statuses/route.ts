import { NextRequest, NextResponse } from 'next/server';
import { getCloseApiClient } from '@/utils/closeApi';

/**
 * GET /api/close/lead-statuses
 * Get all lead statuses (pipeline stages) from Close CRM
 */
export async function GET(request: NextRequest) {
  try {
    const closeClient = getCloseApiClient();
    const response = await closeClient.getLeadStatuses();

    console.log('[Close API] Fetched lead statuses:', {
      count: response.data.length,
      statuses: response.data.map((s) => ({ id: s.id, label: s.label })),
    });

    return NextResponse.json({
      success: true,
      data: response.data,
    });
  } catch (error: any) {
    console.error('[Close API] Lead statuses fetch error:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch lead statuses from Close API',
      },
      { status: 500 }
    );
  }
}
