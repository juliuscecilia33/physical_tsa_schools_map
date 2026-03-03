import { NextRequest, NextResponse } from 'next/server';
import { getCloseApiClient } from '@/utils/closeApi';

/**
 * GET /api/close/me
 * Get authenticated user information from Close CRM
 * Verifies API authentication is working correctly
 */
export async function GET(request: NextRequest) {
  try {
    const closeClient = getCloseApiClient();
    const user = await closeClient.getMe();

    console.log('[Close API] Authenticated user:', {
      id: user.id,
      email: user.email,
      name: `${user.first_name} ${user.last_name}`,
      organization_id: user.organization_id,
    });

    return NextResponse.json({
      success: true,
      data: user,
    });
  } catch (error: any) {
    console.error('[Close API] Authentication error:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to authenticate with Close API',
      },
      { status: 500 }
    );
  }
}
