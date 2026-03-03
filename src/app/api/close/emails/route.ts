import { NextRequest, NextResponse } from 'next/server';
import { getCloseApiClient } from '@/utils/closeApi';

/**
 * GET /api/close/emails
 * Get email threads from Close CRM with optional filtering
 * Query params: _limit, _skip, lead_id, user_id, date_created__gt, date_created__lt
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const params: any = {
      _limit: searchParams.get('_limit') ? parseInt(searchParams.get('_limit')!) : 25,
      _skip: searchParams.get('_skip') ? parseInt(searchParams.get('_skip')!) : 0,
    };

    // Add optional filters
    if (searchParams.get('lead_id')) {
      params.lead_id = searchParams.get('lead_id');
    }
    if (searchParams.get('user_id')) {
      params.user_id = searchParams.get('user_id');
    }
    if (searchParams.get('date_created__gt')) {
      params.date_created__gt = searchParams.get('date_created__gt');
    }
    if (searchParams.get('date_created__lt')) {
      params.date_created__lt = searchParams.get('date_created__lt');
    }

    const closeClient = getCloseApiClient();
    const response = await closeClient.getEmailThreads(params);

    console.log('[Close API] Fetched email threads:', {
      count: response.data.length,
      has_more: response.has_more,
      filters: params,
    });

    return NextResponse.json({
      success: true,
      data: response.data,
      has_more: response.has_more,
      pagination: {
        limit: params._limit,
        skip: params._skip,
      },
    });
  } catch (error: any) {
    console.error('[Close API] Email threads fetch error:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch email threads from Close API',
      },
      { status: 500 }
    );
  }
}
