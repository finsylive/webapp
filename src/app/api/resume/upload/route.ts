import { NextRequest, NextResponse } from 'next/server';
import { createAuthClient } from '@/utils/supabase-server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    // Verify session using auth client
    const authClient = await createAuthClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use service role client for storage operations (bypasses RLS)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get the uploaded file
    const formData = await req.formData();
    const file = formData.get('resume') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF files are supported' }, { status: 400 });
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Max 10MB.' }, { status: 400 });
    }

    // Upload to Supabase Storage
    const timestamp = Date.now();
    const filePath = `resumes/${user.id}/${timestamp}_resume.pdf`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from('media')
      .upload(filePath, buffer, {
        contentType: 'application/pdf',
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      console.error('Resume upload error:', uploadError);
      return NextResponse.json({ error: 'Failed to upload resume' }, { status: 500 });
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('media')
      .getPublicUrl(filePath);

    // Save resume_url to user profile
    const { error: updateError } = await supabase
      .from('users')
      .update({ resume_url: publicUrl })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error saving resume URL:', updateError);
    }

    return NextResponse.json({ url: publicUrl });
  } catch (error) {
    console.error('Resume upload error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
