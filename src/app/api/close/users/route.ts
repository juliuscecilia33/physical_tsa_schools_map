import { NextRequest, NextResponse } from 'next/server';
import { getCloseApiClient } from '@/utils/closeApi';

/**
 * GET /api/close/users
 * Get all users in the Close CRM organization
 * Query params: _limit, _skip for pagination
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const params = {
      _limit: searchParams.get('_limit') ? parseInt(searchParams.get('_limit')!) : 100,
      _skip: searchParams.get('_skip') ? parseInt(searchParams.get('_skip')!) : 0,
    };

    const closeClient = getCloseApiClient();
    const response = await closeClient.getUsers(params);

    console.log('[Close API] Fetched users:', {
      count: response.data.length,
      has_more: response.has_more,
      total_results: response.total_results,
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
    console.error('[Close API] Users fetch error:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch users from Close API',
      },
      { status: 500 }
    );
  }
}
