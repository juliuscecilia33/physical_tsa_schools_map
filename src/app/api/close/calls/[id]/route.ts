import { NextRequest, NextResponse } from 'next/server';
import { getCloseApiClient } from '@/utils/closeApi';

/**
 * GET /api/close/calls/[id]
 * Get a single call by ID with full details including transcript
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // In Next.js 15+, params is now a Promise and must be awaited
    const { id: callId } = await params;

    if (!callId) {
      return NextResponse.json(
        { success: false, error: 'Call ID is required' },
        { status: 400 }
      );
    }

    const closeClient = getCloseApiClient();
    // Fetch call with transcript fields
    const call = await closeClient.getCall(callId, true);

    console.log('[Close API] Fetched call details:', {
      id: call.id,
      direction: call.direction,
      disposition: call.disposition,
      has_recording: !!call.recording_url,
      has_transcript: !!call.recording_transcript,
    });

    return NextResponse.json({
      success: true,
      data: call,
    });
  } catch (error: any) {
    console.error('[Close API] Call fetch error:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch call from Close API',
      },
      { status: 500 }
    );
  }
}
