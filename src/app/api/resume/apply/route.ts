import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

interface ApplyPayload {
  full_name?: string;
  tagline?: string;
  about?: string;
  current_city?: string;
  skills?: string[];
  work_experiences?: {
    company_name: string;
    domain: string;
    positions: {
      position: string;
      start_date: string;
      end_date: string;
      description: string;
    }[];
  }[];
  education?: {
    institution_name: string;
    degree: string;
    field_of_study: string;
    start_date: string;
    end_date: string;
    description: string;
  }[];
  portfolio_links?: {
    platform: string;
    link: string;
  }[];
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: ApplyPayload = await req.json();
    const errors: string[] = [];

    // 1. Update user profile fields
    const userUpdate: Record<string, unknown> = {};
    if (body.full_name) userUpdate.full_name = body.full_name;
    if (body.tagline) userUpdate.tagline = body.tagline;
    if (body.about) userUpdate.about = body.about;
    if (body.current_city) userUpdate.current_city = body.current_city;
    if (body.skills && body.skills.length > 0) userUpdate.skills = body.skills;

    console.log('[resume/apply] userId:', user.id);
    console.log('[resume/apply] userUpdate fields:', Object.keys(userUpdate));
    console.log('[resume/apply] body keys:', Object.keys(body));

    if (Object.keys(userUpdate).length > 0) {
      // Use update (row guaranteed by trigger in migration 011)
      const { error } = await supabase
        .from('users')
        .update(userUpdate)
        .eq('id', user.id);

      console.log('[resume/apply] user update result - error:', error);

      if (error) {
        // Row might not exist — fallback: fetch username then upsert
        console.log('[resume/apply] update failed, attempting upsert fallback. Error:', error.message);
        const { data: authUser } = await supabase.auth.admin.getUserById(user.id);
        const fallbackUsername = authUser?.user?.user_metadata?.name?.replaceAll(/\s+/g, '').toLowerCase()
          || user.email?.split('@')[0]
          || user.id.slice(0, 8);
        const { error: upsertErr } = await supabase
          .from('users')
          .upsert(
            { id: user.id, email: user.email, username: fallbackUsername, ...userUpdate },
            { onConflict: 'id' }
          );
        if (upsertErr) errors.push(`Profile upsert fallback: ${upsertErr.message}`);
      }
    }

    // 2. Insert work experiences
    if (body.work_experiences && body.work_experiences.length > 0) {
      for (let i = 0; i < body.work_experiences.length; i++) {
        const we = body.work_experiences[i];
        const { data: expData, error: expError } = await supabase
          .from('work_experiences')
          .insert({
            user_id: user.id,
            company_name: we.company_name,
            domain: we.domain || null,
            sort_order: i,
          })
          .select('id')
          .single();

        if (expError) {
          errors.push(`Work experience "${we.company_name}": ${expError.message}`);
          continue;
        }

        // Insert positions for this experience
        if (we.positions && we.positions.length > 0 && expData) {
          const positionsToInsert = we.positions
            .filter(p => p.position)
            .map((p, j) => ({
              experience_id: expData.id,
              position: p.position,
              start_date: p.start_date || '1900-01-01',
              end_date: p.end_date || null,
              description: p.description || null,
              sort_order: j,
            }));

          const { error: posError } = await supabase
            .from('positions')
            .insert(positionsToInsert);

          if (posError) {
            errors.push(`Positions for "${we.company_name}": ${posError.message}`);
          }
        }
      }
    }

    // 3. Insert education
    if (body.education && body.education.length > 0) {
      const educationToInsert = body.education.map((ed, i) => ({
        user_id: user.id,
        institution_name: ed.institution_name,
        degree: ed.degree || null,
        field_of_study: ed.field_of_study || null,
        start_date: ed.start_date || null,
        end_date: ed.end_date || null,
        description: ed.description || null,
        sort_order: i,
      }));

      const { error: edError } = await supabase
        .from('education')
        .insert(educationToInsert);

      if (edError) errors.push(`Education: ${edError.message}`);
    }

    // 4. Insert portfolio links
    if (body.portfolio_links && body.portfolio_links.length > 0) {
      // First, ensure user has a portfolio entry
      let portfolioId: string;
      const { data: existingPortfolio } = await supabase
        .from('portfolios')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingPortfolio) {
        portfolioId = existingPortfolio.id;
      } else {
        const { data: newPortfolio, error: pfError } = await supabase
          .from('portfolios')
          .insert({ user_id: user.id, title: 'My Portfolio' })
          .select('id')
          .single();

        if (pfError || !newPortfolio) {
          errors.push(`Portfolio creation: ${pfError?.message || 'Unknown error'}`);
          // Can't add links without portfolio
          return NextResponse.json({
            success: errors.length === 0,
            errors: errors.length > 0 ? errors : undefined,
          });
        }
        portfolioId = newPortfolio.id;
      }

      const validPlatforms = new Set(['github', 'figma', 'dribbble', 'behance', 'linkedin', 'youtube', 'notion', 'substack', 'custom']);
      const linksToInsert = body.portfolio_links
        .filter(pl => pl.link?.startsWith('http'))
        .map(pl => ({
          portfolio_id: portfolioId,
          platform: validPlatforms.has(pl.platform) ? pl.platform : 'custom',
          link: pl.link,
        }));

      if (linksToInsert.length > 0) {
        const { error: linkError } = await supabase
          .from('portfolio_platforms')
          .insert(linksToInsert);

        if (linkError) errors.push(`Portfolio links: ${linkError.message}`);
      }
    }

    console.log('[resume/apply] total errors:', errors.length, errors);

    return NextResponse.json({
      success: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Resume apply error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
