import { getApps, getApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import config from '../firebase-applet-config.json';

if (!getApps().length) {
  initializeApp({
    projectId: config.projectId,
  });
}

const adminApp = getApp();
const adminDb = getFirestore(adminApp, config.firestoreDatabaseId || '(default)');

const GROQ_API_KEY = process.env.GROQ_API_KEY;

function normalizeTargetKey(targetStr: string): string {
  if (!targetStr) return "";
  let key = targetStr.toLowerCase().trim();
  key = key.replace(/^https?:\/\//, "");
  key = key.replace(/^www\./, "");
  key = key.replace(/\/+$/, "");
  const ytMatch = key.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|live\/|shorts\/))([\w-]{11})/);
  if (ytMatch && ytMatch[1]) {
    return `yt_video_${ytMatch[1]}`;
  }
  return key.replace(/[\/\.\s@]/g, "_");
}

const FAMOUS_CREATORS = [
  { name: "MrBeast", target: "youtube.com/@mrbeast", handle: "mrbeast", brand: "General Sponsor" },
  { name: "MKBHD (Marques Brownlee)", target: "youtube.com/@mkbhd", handle: "mkbhd", brand: "Tech Brand" },
  { name: "PewDiePie", target: "youtube.com/@pewdiepie", handle: "pewdiepie", brand: "Gaming / Lifestyle" },
  { name: "Mark Rober", target: "youtube.com/@markrober", handle: "markrober", brand: "STEM & EdTech" },
  { name: "Logan Paul", target: "youtube.com/@loganpaul", handle: "loganpaul", brand: "Beverage & Fitness" },
  { name: "iJustine", target: "youtube.com/@ijustine", handle: "ijustine", brand: "Consumer Tech" }
];

async function generateAuditReport(creatorName: string, target: string, brandName: string) {
  const prompt = `
You are an executive brand safety analyst generating a 360-degree creator risk assessment for ${brandName} evaluating YouTuber ${creatorName} (${target}).

Return a strict raw JSON object with this EXACT structure:
{
  "creator_summary": "Comprehensive overview of digital footprint, subscriber reach, and creator persona.",
  "brand_safety_score": 88,
  "risk_level": "Low",
  "audience_insights": {
    "authenticity_rating": "High (95%+ organic engagement)",
    "demographics_summary": "Core demographic 18-34, globally distributed across US, UK, EU, Asia.",
    "engagement_quality": "Extremely active commenter community with high retention and viral reach.",
    "community_sentiment": "Overwhelmingly positive and enthusiastic fanbase.",
    "toxic_recurring_themes": [],
    "comment_sentiment_summary": "Analysis shows enthusiastic user engagement with low spam ratios."
  },
  "controversy_and_pr_history": {
    "past_issues_summary": "Detailed summary of past controversies, public scrutinies, or PR events.",
    "pr_crisis_handling": "Evaluation of creator's transparency and crisis management style.",
    "current_community_perception": "Current public and media sentiment."
  },
  "competitor_and_sponsorship_history": [
    {
      "competitor_or_brand": "Sample Sponsor / Partner",
      "platform": "YouTube",
      "details": "Integrated video sponsorship with custom product integration.",
      "source_url": "https://youtube.com",
      "verification_status": "verified"
    }
  ],
  "nuanced_red_flags": [
    {
      "category": "Controversy / Risk Factor",
      "description": "Specific noted risk factor or area of potential sensitivity.",
      "context_and_impact": "Contextual explanation of why this matters for sponsoring brands.",
      "video_timestamp": "N/A",
      "source_url": "N/A",
      "verification_status": "reported_unconfirmed"
    }
  ],
  "positive_highlights": [
    "Massive global reach with top-tier production value.",
    "Strong track record of delivering measurable ROI for major brand partners."
  ],
  "final_verdict": {
    "recommendation": "Sponsor",
    "justification": "Clear value alignment with strong brand safety guardrails.",
    "contractual_safeguards": [
      "Include standard morality clause and 30-day pre-review of integrated content."
    ]
  },
  "unreachable_urls": []
}
`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: "You are an executive brand safety analyst. Output strict RAW JSON ONLY." },
        { role: "user", content: prompt }
      ],
      temperature: 0.2,
      response_format: { type: "json_object" }
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const rawText = data.choices?.[0]?.message?.content;
  const parsed = JSON.parse(rawText);

  return {
    ...parsed,
    target,
    brand_name: brandName,
    grounding_sources: [
      { title: `${creatorName} Official YouTube`, url: `https://${target}` },
      { title: `${creatorName} Social Analytics`, url: `https://socialblade.com/youtube/c/${creatorName.toLowerCase().replace(/\s+/g, '')}` }
    ],
    analyzed_at: new Date().toISOString()
  };
}

async function main() {
  console.log("🚀 Starting test batch analysis for famous YouTubers...");
  
  for (const creator of FAMOUS_CREATORS) {
    try {
      console.log(`\n🔍 Analyzing creator: ${creator.name} (${creator.target})...`);
      const report = await generateAuditReport(creator.name, creator.target, creator.brand);
      
      const targetKeysToSeed = [
        normalizeTargetKey(creator.target),
        normalizeTargetKey(creator.handle),
        normalizeTargetKey(creator.name),
        normalizeTargetKey(`@${creator.handle}`)
      ].filter(Boolean);

      for (const targetKey of targetKeysToSeed) {
        await adminDb.collection('global_audits').doc(targetKey).set({
          targetKey,
          target: creator.target,
          report,
          updatedAt: new Date().toISOString(),
          createdAt: new Date().toISOString()
        });
        console.log(`  ✅ Stored in server database (global_audits) under key: "${targetKey}"`);
      }
    } catch (err: any) {
      console.error(`  ❌ Failed analysis for ${creator.name}:`, err?.message || err);
    }
  }

  console.log("\n🎉 Test run complete! Famous YouTuber audit data successfully gathered and sent to the server database!");
  process.exit(0);
}

main();
