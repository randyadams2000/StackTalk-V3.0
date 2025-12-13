import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { aboutUrl, agentId, verificationLink, twinId } = await request.json();

    const marker = agentId || twinId;
    if (!aboutUrl || !marker) {
      return NextResponse.json(
        { error: 'Missing required parameters: aboutUrl and agentId' },
        { status: 400 }
      );
    }

    console.log(`🔍 Verifying agent marker "${marker}" on ${aboutUrl}`);

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
    
    // Check if the agent ID or a provided verification link appears in the page content
    const containsAgentId = typeof marker === 'string' ? html.includes(marker) : false;
    const containsVerificationLink = typeof verificationLink === 'string' && verificationLink
      ? html.includes(verificationLink)
      : false;
    
    console.log(`🔍 Searching for agent marker: ${marker}`);
    console.log(`🔍 Searching for verification link: ${verificationLink || '(none provided)'}`);
    console.log(`✅ Agent marker found: ${containsAgentId}`);
    console.log(`✅ Verification link found: ${containsVerificationLink}`);

    if (containsAgentId || containsVerificationLink) {
      console.log('🎉 Verification successful!');
      return NextResponse.json({
        verified: true,
        message: 'Ownership verified successfully! Agent marker or link found in Substack about page.'
      });
    } else {
      console.log('❌ Verification failed - link not found');
      return NextResponse.json({
        verified: false,
        error: 'Verification marker not found in Substack about page. Please make sure you have added the link/ID to your about page and try again.'
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