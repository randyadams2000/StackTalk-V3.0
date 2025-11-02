import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { aboutUrl, twinId } = await request.json();

    if (!aboutUrl || !twinId) {
      return NextResponse.json(
        { error: 'Missing required parameters: aboutUrl and twinId' },
        { status: 400 }
      );
    }

    console.log(`🔍 Verifying Twin ID "${twinId}" on ${aboutUrl}`);

    // Fetch the about page content
    const response = await fetch(aboutUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch Substack about page: ${response.status} ${response.statusText}` },
        { status: 400 }
      );
    }

    const html = await response.text();
    
    // Check if the Twin ID or the full app link appears in the page content
    const twinAppLink = `https://app.talk2me.ai/creator/${twinId}/anonymous`;
    const containsTwinId = html.includes(twinId);
    const containsFullLink = html.includes(twinAppLink);
    
    console.log(`🔍 Searching for twin ID: ${twinId}`);
    console.log(`🔍 Searching for full link: ${twinAppLink}`);
    console.log(`✅ Twin ID found: ${containsTwinId}`);
    console.log(`✅ Full link found: ${containsFullLink}`);

    if (containsTwinId || containsFullLink) {
      console.log('🎉 Verification successful!');
      return NextResponse.json({
        verified: true,
        message: 'Ownership verified successfully! Twin ID or link found in Substack about page.'
      });
    } else {
      console.log('❌ Verification failed - link not found');
      return NextResponse.json({
        verified: false,
        error: 'Twin link not found in Substack about page. Please make sure you have added the link to your about page and try again.'
      });
    }

  } catch (error) {
    console.error('Error verifying Substack ownership:', error);
    return NextResponse.json(
      { error: 'Failed to verify ownership. Please try again.' },
      { status: 500 }
    );
  }
}