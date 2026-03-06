import { NextRequest, NextResponse } from 'next/server';
import { getCloseApiClient } from '@/utils/closeApi';

/**
 * POST /api/close/leads/search
 * Search leads across all data using Close CRM's Advanced Filtering API
 * Body: { query: string, limit?: number }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, limit } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Query string is required' },
        { status: 400 }
      );
    }

    const closeClient = getCloseApiClient();
    const response = await closeClient.searchLeads(query, limit || 25);

    console.log('[Close API] Search leads:', {
      query,
      count: response.data.length,
      total_results: response.total_results,
    });

    return NextResponse.json({
      success: true,
      data: response.data,
      total_results: response.total_results,
    });
  } catch (error: any) {
    console.error('[Close API] Lead search error:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to search leads in Close API',
      },
      { status: 500 }
    );
  }
}
