import { NextRequest, NextResponse } from 'next/server';
import { getCloseApiClient } from '@/utils/closeApi';

/**
 * GET /api/close/contacts
 * Get contacts from Close CRM with optional filtering
 * Query params: _limit, _skip, lead_id
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const params: any = {
      _limit: searchParams.get('_limit') ? parseInt(searchParams.get('_limit')!) : 100,
      _skip: searchParams.get('_skip') ? parseInt(searchParams.get('_skip')!) : 0,
    };

    // Add optional filters
    if (searchParams.get('lead_id')) {
      params.lead_id = searchParams.get('lead_id');
    }

    const closeClient = getCloseApiClient();
    const response = await closeClient.getContacts(params);

    console.log('[Close API] Fetched contacts:', {
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
    console.error('[Close API] Contacts fetch error:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch contacts from Close API',
      },
      { status: 500 }
    );
  }
}
