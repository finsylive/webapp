import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Groq from 'groq-sdk';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export interface ParsedResume {
  full_name: string;
  tagline: string;
  about: string;
  current_city: string;
  skills: string[];
  work_experiences: {
    company_name: string;
    domain: string;
    positions: {
      position: string;
      start_date: string;
      end_date: string;
      description: string;
    }[];
  }[];
  education: {
    institution_name: string;
    degree: string;
    field_of_study: string;
    start_date: string;
    end_date: string;
    description: string;
  }[];
  portfolio_links: {
    platform: string;
    link: string;
  }[];
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function sanitizeResult(parsed: Record<string, unknown>): ParsedResume {
  const work_experiences = Array.isArray(parsed.work_experiences)
    ? (parsed.work_experiences as Record<string, unknown>[]).map((we) => ({
        company_name: str(we.company_name),
        domain: str(we.domain),
        positions: Array.isArray(we.positions)
          ? (we.positions as Record<string, unknown>[]).map((p) => ({
              position: str(p.position),
              start_date: str(p.start_date),
              end_date: str(p.end_date),
              description: str(p.description),
            }))
          : [],
      }))
    : [];

  const education = Array.isArray(parsed.education)
    ? (parsed.education as Record<string, unknown>[]).map((ed) => ({
        institution_name: str(ed.institution_name),
        degree: str(ed.degree),
        field_of_study: str(ed.field_of_study),
        start_date: str(ed.start_date),
        end_date: str(ed.end_date),
        description: str(ed.description),
      }))
    : [];

  const portfolio_links = Array.isArray(parsed.portfolio_links)
    ? (parsed.portfolio_links as Record<string, unknown>[])
        .filter((pl) => typeof pl.platform === 'string' && typeof pl.link === 'string')
        .map((pl) => ({ platform: pl.platform as string, link: pl.link as string }))
    : [];

  return {
    full_name: str(parsed.full_name),
    tagline: str(parsed.tagline).substring(0, 80),
    about: str(parsed.about),
    current_city: str(parsed.current_city),
    skills: Array.isArray(parsed.skills)
      ? (parsed.skills as unknown[]).filter((s): s is string => typeof s === 'string').slice(0, 20)
      : [],
    work_experiences,
    education,
    portfolio_links,
  };
}

async function extractTextFromFile(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());

  // Use pdf2json - pure Node.js PDF parser, no canvas/DOMMatrix deps
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const PDFParser = require('pdf2json');

  return new Promise((resolve, reject) => {
    const parser = new PDFParser(null, true); // true = raw text mode

    parser.on('pdfParser_dataReady', () => {
      try {
        const text = parser.getRawTextContent();
        resolve(text);
      } catch (err) {
        reject(new Error(`Failed to extract text: ${err}`));
      }
    });

    parser.on('pdfParser_dataError', (errData: { parserError: string }) => {
      reject(new Error(`PDF parse error: ${errData.parserError}`));
    });

    parser.parseBuffer(buffer);
  });
}

async function parseWithGroq(resumeText: string): Promise<ParsedResume> {
  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) {
    throw new Error('AI parsing not configured. Set GROQ_API_KEY in environment.');
  }

  const groq = new Groq({ apiKey: groqApiKey });
  const truncated = resumeText.substring(0, 6000);

  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    temperature: 0.1,
    max_tokens: 2048,
    messages: [
      {
        role: 'system',
        content: `You are a resume/CV parser. Extract structured profile data from resume text. 
Respond ONLY with valid JSON matching this exact schema:
{
  "full_name": "string",
  "tagline": "short professional headline, max 80 chars",
  "about": "professional summary/bio, 2-3 sentences in first person",
  "current_city": "city name or empty string",
  "skills": ["skill1", "skill2"],
  "work_experiences": [
    {
      "company_name": "string",
      "domain": "company website domain or empty string",
      "positions": [
        {
          "position": "job title",
          "start_date": "YYYY-MM-DD or empty string",
          "end_date": "YYYY-MM-DD or empty string for current",
          "description": "brief description of role"
        }
      ]
    }
  ],
  "education": [
    {
      "institution_name": "school/university name",
      "degree": "degree type",
      "field_of_study": "major/field",
      "start_date": "YYYY-MM-DD or empty string",
      "end_date": "YYYY-MM-DD or empty string",
      "description": "brief description or empty string"
    }
  ],
  "portfolio_links": [
    {
      "platform": "github|figma|dribbble|behance|linkedin|youtube|notion|substack|custom",
      "link": "full URL"
    }
  ]
}

Rules:
- Extract ALL work experiences and education entries.
- Dates: YYYY-MM-DD. Year only -> YYYY-01-01. Month+year -> YYYY-MM-01.
- Max 20 skills. Include both technical and soft skills.
- Tagline: concise professional headline from resume.
- About: 2-3 sentence summary in first person.
- Missing fields: use empty string or empty array.
- portfolio_links: extract GitHub, LinkedIn, portfolio site URLs.
- ONLY output valid JSON. No markdown. No code blocks.`
      },
      {
        role: 'user',
        content: `Parse this resume:\n\n${truncated}`
      }
    ],
  });

  const raw = completion.choices[0]?.message?.content?.trim();
  if (!raw) throw new Error('AI returned empty response');

  let cleaned = raw;
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  const parsed: Record<string, unknown> = JSON.parse(cleaned);
  return sanitizeResult(parsed);
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const contentType = req.headers.get('content-type') || '';
    let resumeText: string;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('resume') as File | null;
      if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
      if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'Max 10MB' }, { status: 400 });
      resumeText = await extractTextFromFile(file);
    } else {
      const body = await req.json();
      resumeText = body.resume_text;
    }

    if (!resumeText || resumeText.length < 50) {
      return NextResponse.json(
        { error: 'Could not extract enough text. Try a text-based PDF (not scanned).' },
        { status: 400 }
      );
    }

    const result = await parseWithGroq(resumeText);
    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('Resume parse error:', error);
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
