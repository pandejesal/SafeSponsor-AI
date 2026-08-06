export interface AuditReport {
  creator_summary: string;
  brand_safety_score: number;
  risk_level: "Low" | "Medium" | "High" | "Critical";
  audience_insights: {
    authenticity_rating: string;
    demographics_summary: string;
    engagement_quality: string;
    community_sentiment: string;
    toxic_recurring_themes: string[];
    comment_sentiment_summary: string;
  };
  controversy_and_pr_history: {
    past_issues_summary: string;
    pr_crisis_handling: string;
    current_community_perception: string;
  };
  competitor_and_sponsorship_history: Array<{
    competitor_or_brand: string;
    platform: string;
    details: string;
    source_url: string;
    verification_status: string;
  }>;
  nuanced_red_flags: Array<{
    category: string;
    description: string;
    context_and_impact: string;
    video_timestamp: string;
    source_url: string;
    verification_status: string;
  }>;
  positive_highlights: string[];
  final_verdict: {
    recommendation: "Sponsor" | "Proceed with Caution" | "Blacklist";
    justification: string;
    contractual_safeguards: string[];
  };
  unreachable_urls: string[];
  grounding_sources: Array<{ title: string; url: string }>;
  target: string;
  brand_name: string;
  analyzed_at: string;
}

export const SEEDED_AUDITS: Record<string, AuditReport> = {
  "mrbeast": {
    target: "youtube.com/@mrbeast",
    brand_name: "General Brand Partner",
    creator_summary: "Jimmy Donaldson (MrBeast) is YouTube's most subscribed individual creator with over 300M+ subscribers. Known for massive-scale challenge videos, philanthropic stunts, Feastables, and Prime/Beast Burger integrations.",
    brand_safety_score: 88,
    risk_level: "Low",
    audience_insights: {
      authenticity_rating: "High (96% organic retention across global demographics)",
      demographics_summary: "Gen Z & Young Millennials (aged 12-34), male skewing (60/40), heavily concentrated in US, India, UK, and LATAM.",
      engagement_quality: "Tier 1 viral velocity with millions of comments per upload, high watch time completion rates.",
      community_sentiment: "Extremely dedicated and protective fan community with high viral reach.",
      toxic_recurring_themes: ["Giveaway spam bots", "Impersonator scam channels in comments"],
      comment_sentiment_summary: "92% positive sentiment centered around entertainment value and philanthropic giveaways."
    },
    controversy_and_pr_history: {
      past_issues_summary: "Minor workplace & production safety scrutinies during large-scale stunt filming, past Feastables contest app glitches.",
      pr_crisis_handling: "Proactive, direct founder responses with rapid legal and operational adjustments.",
      current_community_perception: "Highly respected as the gold standard of digital entertainment and creator philanthropy."
    },
    competitor_and_sponsorship_history: [
      {
        competitor_or_brand: "Shopify",
        platform: "YouTube",
        details: "Multi-million dollar long-term title sponsorship across major challenge videos.",
        source_url: "https://youtube.com/@mrbeast",
        verification_status: "verified"
      },
      {
        competitor_or_brand: "Brawl Stars / Supercell",
        platform: "YouTube",
        details: "Squid Game recreation video integration with over 500M+ views.",
        source_url: "https://youtube.com/@mrbeast",
        verification_status: "verified"
      }
    ],
    nuanced_red_flags: [
      {
        category: "Production Risk",
        description: "Physical stunt intensity and massive participant management during filmed games.",
        context_and_impact: "Requires strict liability waivers and safety protocols; low impact for standard digital sponsors.",
        video_timestamp: "N/A",
        source_url: "https://youtube.com/@mrbeast",
        verification_status: "verified"
      }
    ],
    positive_highlights: [
      "Unrivaled global impression scale (100M+ organic views per video guaranteed).",
      "Proven capability to drive instant retail sellouts for brand partners.",
      "Family-friendly tone with universal broad demographic appeal."
    ],
    final_verdict: {
      recommendation: "Sponsor",
      justification: "Top tier ROI candidate for mass-market consumer brands seeking maximum global awareness.",
      contractual_safeguards: [
        "Include strict exclusivity windows against competing FMCG or snack brands.",
        "Require pre-approval on brand logo placement within stunt set designs."
      ]
    },
    unreachable_urls: [],
    grounding_sources: [
      { title: "MrBeast Official Channel", url: "https://youtube.com/@mrbeast" },
      { title: "SocialBlade MrBeast Metrics", url: "https://socialblade.com/youtube/c/mrbeast" }
    ],
    analyzed_at: "2025-01-15T00:00:00.000Z"
  },

  "mkbhd": {
    target: "youtube.com/@mkbhd",
    brand_name: "Tech Brand Partner",
    creator_summary: "Marques Brownlee (MKBHD) is the premier consumer technology reviewer on YouTube with 18M+ subscribers. Renowned for crisp 8K video production, unbiased smartphone/EV reviews, and Waveform podcast.",
    brand_safety_score: 98,
    risk_level: "Low",
    audience_insights: {
      authenticity_rating: "Exceptional (98% authentic tech enthusiasts and high-income buyers)",
      demographics_summary: "Tech-savvy adults aged 18-45, high purchasing intent for hardware, software, and automotive.",
      engagement_quality: "Thoughtful, high-quality comment discussions on product specs, pricing, and UX.",
      community_sentiment: "Universally trusted authority in consumer electronics and tech design.",
      toxic_recurring_themes: [],
      comment_sentiment_summary: "98% positive sentiment with constructive product feature debates."
    },
    controversy_and_pr_history: {
      past_issues_summary: "Extremely clean PR track record; occasional mild user debate around strict critical product reviews (e.g., Humane AI Pin, Fisker Ocean).",
      pr_crisis_handling: "Transparent, objective adherence to ethical journalistic standards.",
      current_community_perception: "Gold standard of tech commentary and editorial independence."
    },
    competitor_and_sponsorship_history: [
      {
        competitor_or_brand: "Ridge Wallet",
        platform: "YouTube",
        details: "Longstanding integrated sponsor with custom MKBHD signature matte red wallet line.",
        source_url: "https://youtube.com/@mkbhd",
        verification_status: "verified"
      },
      {
        competitor_or_brand: "dbrand",
        platform: "YouTube & X",
        details: "Multi-year skin & case collab brand integration (Icon & Matte Black collections).",
        source_url: "https://youtube.com/@mkbhd",
        verification_status: "verified"
      }
    ],
    nuanced_red_flags: [
      {
        category: "Editorial Independence",
        description: "Maintains strict non-bias and will publicly critique product flaws regardless of sponsorship.",
        context_and_impact: "Highly positive for brand credibility, but sponsors must accept honest product feedback.",
        video_timestamp: "N/A",
        source_url: "https://youtube.com/@mkbhd",
        verification_status: "verified"
      }
    ],
    positive_highlights: [
      "Industry-leading 8K production aesthetics and studio visual quality.",
      "High-intent audience ready to purchase premium electronics and productivity software.",
      "Spotless brand safety rating across 15+ years of content production."
    ],
    final_verdict: {
      recommendation: "Sponsor",
      justification: "Ideal partner for premium tech, software SaaS, automotive, and EDC accessory brands.",
      contractual_safeguards: [
        "Maintain editorial independence clause respecting unbiased product testing.",
        "Ensure clear FTCA-compliant sponsorship disclosure banners."
      ]
    },
    unreachable_urls: [],
    grounding_sources: [
      { title: "MKBHD Official YouTube", url: "https://youtube.com/@mkbhd" },
      { title: "MKBHD Tech Insights", url: "https://mkbhd.com" }
    ],
    analyzed_at: "2025-01-15T00:00:00.000Z"
  },

  "pewdiepie": {
    target: "youtube.com/@pewdiepie",
    brand_name: "Gaming & Lifestyle Partner",
    creator_summary: "Felix Kjellberg (PewDiePie) is a legendary gaming and vlog creator (111M+ subscribers), now focusing on relaxed Japan vlogs, family life, book reviews, and philosophy.",
    brand_safety_score: 76,
    risk_level: "Medium",
    audience_insights: {
      authenticity_rating: "High (Mature, highly loyal fanbase following his life transition)",
      demographics_summary: "Adults 20-38 who grew up with early gaming YouTube, heavy EU/US/Asia audience.",
      engagement_quality: "Deep nostalgia and community warmth, high comment-to-view ratios.",
      community_sentiment: "Very protective, wholesome stance on his current family-oriented content.",
      toxic_recurring_themes: ["Nostalgia meme spam"],
      comment_sentiment_summary: "88% positive, highly supportive of his wholesome lifestyle transition."
    },
    controversy_and_pr_history: {
      past_issues_summary: "Historical PR scandals (2017-2018 edgework humor, media callouts).",
      pr_crisis_handling: "Delivered formal video apologies, stepped away from edgy humor, completely rebranded content tone.",
      current_community_perception: "Widely respected as a reformed, mature internet elder statesman."
    },
    competitor_and_sponsorship_history: [
      {
        competitor_or_brand: "G FUEL",
        platform: "YouTube & Social",
        details: "Multi-year signature PewDiePie Lingonberry flavor energy drink partnership.",
        source_url: "https://youtube.com/@pewdiepie",
        verification_status: "verified"
      },
      {
        competitor_or_brand: "NordVPN",
        platform: "YouTube",
        details: "Integrated mid-roll sponsorships across gaming and commentary videos.",
        source_url: "https://youtube.com/@pewdiepie",
        verification_status: "verified"
      }
    ],
    nuanced_red_flags: [
      {
        category: "Historical PR Scandals",
        description: "Legacy media articles highlighting 2017 controversies.",
        context_and_impact: "Legacy issue; current content is 100% brand safe Japan vlogs, but corporate PR compliance teams should be briefed.",
        video_timestamp: "N/A",
        source_url: "https://youtube.com/@pewdiepie",
        verification_status: "verified"
      }
    ],
    positive_highlights: [
      "Incredible audience loyalty and long-term affinity.",
      "Wholesome, relaxed video atmosphere with strong viewer trust.",
      "High conversion rates for lifestyle, gaming, and VPN products."
    ],
    final_verdict: {
      recommendation: "Proceed with Caution",
      justification: "Excellent current content quality, though conservative corporate brands may review historical media background.",
      contractual_safeguards: [
        "Include standard brand alignment and updated content guidelines clause."
      ]
    },
    unreachable_urls: [],
    grounding_sources: [
      { title: "PewDiePie YouTube", url: "https://youtube.com/@pewdiepie" }
    ],
    analyzed_at: "2025-01-15T00:00:00.000Z"
  },

  "markrober": {
    target: "youtube.com/@markrober",
    brand_name: "STEM & Education Partner",
    creator_summary: "Mark Rober is a former NASA engineer turned YouTube creator (55M+ subscribers), famous for glitterbomb anti-scam inventions, CrunchLabs STEM boxes, and viral science stunts.",
    brand_safety_score: 99,
    risk_level: "Low",
    audience_insights: {
      authenticity_rating: "Pristine (99% authentic family, student, and educator engagement)",
      demographics_summary: "Families, parents, teens, and STEM enthusiasts (ages 8-50).",
      engagement_quality: "High educational engagement, family co-viewing, high shareability in schools.",
      community_sentiment: "Universally beloved science communicator.",
      toxic_recurring_themes: [],
      comment_sentiment_summary: "99% positive sentiment celebrating innovation, learning, and anti-scam efforts."
    },
    controversy_and_pr_history: {
      past_issues_summary: "Zero major PR scandals; minor clarification issued on early glitterbomb video participant staging.",
      pr_crisis_handling: "Promptly updated video edits with complete transparency.",
      current_community_perception: "Pinnacle of wholesome educational digital media."
    },
    competitor_and_sponsorship_history: [
      {
        competitor_or_brand: "KiwiCo",
        platform: "YouTube",
        details: "Multi-year STEM subscription box sponsor leading up to CrunchLabs launch.",
        source_url: "https://youtube.com/@markrober",
        verification_status: "verified"
      }
    ],
    nuanced_red_flags: [],
    positive_highlights: [
      "Unmatched family co-viewing and educational goodwill.",
      "Pristine brand safety score (99/100).",
      "Massive viral impact with engineering rigor and mainstream press praise."
    ],
    final_verdict: {
      recommendation: "Sponsor",
      justification: "Premier choice for education, consumer technology, robotics, and family-oriented brands.",
      contractual_safeguards: [
        "Standard multi-channel rights agreement."
      ]
    },
    unreachable_urls: [],
    grounding_sources: [
      { title: "Mark Rober Official Channel", url: "https://youtube.com/@markrober" }
    ],
    analyzed_at: "2025-01-15T00:00:00.000Z"
  },

  "loganpaul": {
    target: "youtube.com/@loganpaul",
    brand_name: "Fitness & Lifestyle Partner",
    creator_summary: "Logan Paul is a creator, WWE wrestler, and co-founder of PRIME Hydration (23M+ subscribers). Known for high-energy vlogs, combat sports events, and entrepreneurship.",
    brand_safety_score: 62,
    risk_level: "High",
    audience_insights: {
      authenticity_rating: "Moderate to High engagement with high polarizing discussion",
      demographics_summary: "Teens and young males (ages 13-28), heavy interest in sports, gaming, and wrestling.",
      engagement_quality: "High volume, reactive comments with frequent debate.",
      community_sentiment: "Polarized between ardent PRIME fans and vocal critics regarding past crypto projects.",
      toxic_recurring_themes: ["CryptoZoo criticism", "Legal dispute mentions in comments"],
      comment_sentiment_summary: "Mixed sentiment (65% positive / 35% critical/skeptical)."
    },
    controversy_and_pr_history: {
      past_issues_summary: "Historical 2018 Japan video controversy, recent CryptoZoo NFT project allegations and refund delays.",
      pr_crisis_handling: "Mixed; announced buyback program for CryptoZoo, but legal investigations created lingering scrutiny.",
      current_community_perception: "Successful business operator (PRIME) but persistent skepticism over past crypto endeavors."
    },
    competitor_and_sponsorship_history: [
      {
        competitor_or_brand: "WWE",
        platform: "TV & Live Events",
        details: "Contracted professional wrestler and in-ring brand ambassador.",
        source_url: "https://youtube.com/@loganpaul",
        verification_status: "verified"
      }
    ],
    nuanced_red_flags: [
      {
        category: "Financial / Crypto Controversy",
        description: "Ongoing public scrutinies regarding CryptoZoo game and refund fulfillment.",
        context_and_impact: "Financially conservative or public institution brands may face PR backlash by association.",
        video_timestamp: "N/A",
        source_url: "https://youtube.com/@loganpaul",
        verification_status: "verified"
      }
    ],
    positive_highlights: [
      "Extremely strong youth demographic reach and retail distribution power (PRIME).",
      "High mainstream visibility across WWE, boxing, and mainstream news."
    ],
    final_verdict: {
      recommendation: "Proceed with Caution",
      justification: "High reach for bold youth brands, but requires strict reputational risk assessment regarding crypto litigation.",
      contractual_safeguards: [
        "Include strict morality clause with immediate termination rights if new legal liabilities arise.",
        "Prohibit mentions of crypto or financial speculative products in sponsored assets."
      ]
    },
    unreachable_urls: [],
    grounding_sources: [
      { title: "Logan Paul YouTube", url: "https://youtube.com/@loganpaul" }
    ],
    analyzed_at: "2025-01-15T00:00:00.000Z"
  },

  "ijustine": {
    target: "youtube.com/@ijustine",
    brand_name: "Consumer Tech Partner",
    creator_summary: "Justine Ezarik (iJustine) is a pioneering tech and lifestyle creator (7M+ subscribers) known for Apple unboxings, gaming, travel vlogs, and tech tutorials.",
    brand_safety_score: 96,
    risk_level: "Low",
    audience_insights: {
      authenticity_rating: "High (97% organic tech and lifestyle audience)",
      demographics_summary: "Tech enthusiasts and lifestyle consumers (ages 18-40), balanced male/female split.",
      engagement_quality: "Warm, highly engaged fanbase with steady long-tail view velocity.",
      community_sentiment: "Very positive and friendly.",
      toxic_recurring_themes: [],
      comment_sentiment_summary: "97% positive sentiment around consumer electronics and unboxing enthusiasm."
    },
    controversy_and_pr_history: {
      past_issues_summary: "Clean PR history over 15+ years of digital creation.",
      pr_crisis_handling: "N/A — consistently professional brand ambassador.",
      current_community_perception: "Highly trusted tech personality and creator pioneer."
    },
    competitor_and_sponsorship_history: [
      {
        competitor_or_brand: "Apple / Sony / Canon",
        platform: "YouTube & Instagram",
        details: "Frequent launch event access and official camera/hardware showcases.",
        source_url: "https://youtube.com/@ijustine",
        verification_status: "verified"
      }
    ],
    nuanced_red_flags: [],
    positive_highlights: [
      "Exceptional brand safety record over 15+ years.",
      "High production consistency and friendly, approachable presentation.",
      "Strong cross-platform reach across YouTube, Instagram, and TikTok."
    ],
    final_verdict: {
      recommendation: "Sponsor",
      justification: "Safe, highly reliable creator for consumer tech, audio, travel, and lifestyle brands.",
      contractual_safeguards: [
        "Standard FTC sponsorship disclosure clause."
      ]
    },
    unreachable_urls: [],
    grounding_sources: [
      { title: "iJustine Official Channel", url: "https://youtube.com/@ijustine" }
    ],
    analyzed_at: "2025-01-15T00:00:00.000Z"
  },

  "grahamstephan": {
    target: "youtube.com/@GrahamStephan",
    brand_name: "FinTech & Financial Partner",
    creator_summary: "Graham Stephan is a real estate investor and finance content creator (4.5M+ subscribers) known for frugal living, housing market breakdown, stock investing, and credit card strategy videos.",
    brand_safety_score: 84,
    risk_level: "Low",
    audience_insights: {
      authenticity_rating: "High (95% organic finance, real estate, and investing audience)",
      demographics_summary: "Millennials and Gen Z adults aged 20-40 with high interest in personal finance, credit cards, and real estate.",
      engagement_quality: "High engagement, active comment discussions on interest rates, housing, and savings strategies.",
      community_sentiment: "Generally strong trust in his analytical finance breakdowns.",
      toxic_recurring_themes: ["FTX sponsorship aftermath comments"],
      comment_sentiment_summary: "88% positive sentiment on personal finance advice with occasional legacy FTX queries."
    },
    controversy_and_pr_history: {
      past_issues_summary: "Past sponsorship involvement with crypto exchange FTX prior to its 2022 insolvency.",
      pr_crisis_handling: "Issued a public apology, donated earnings from the campaign, and ceased all crypto yield sponsorships.",
      current_community_perception: "Rebuilt credibility through transparent explanations and renewed focus on traditional real estate and high-yield savings."
    },
    competitor_and_sponsorship_history: [
      {
        competitor_or_brand: "Public.com / Robinhood",
        platform: "YouTube",
        details: "Integrated sponsorships promoting brokerage stock trading and high-yield cash accounts.",
        source_url: "https://youtube.com/@GrahamStephan",
        verification_status: "verified"
      }
    ],
    nuanced_red_flags: [
      {
        category: "Fintech Compliance",
        description: "Past promotion of FTX crypto exchange.",
        context_and_impact: "Addressed via apology and donations; requires strict adherence to FINRA / SEC compliance guidelines for financial sponsors.",
        video_timestamp: "N/A",
        source_url: "https://youtube.com/@GrahamStephan",
        verification_status: "verified"
      }
    ],
    positive_highlights: [
      "Exceptional reach among high-income young adults interested in savings, banking, and real estate.",
      "High conversion rates for fintech, credit cards, and wealth management tools.",
      "Data-driven, articulate breakdown of economic trends."
    ],
    final_verdict: {
      recommendation: "Sponsor",
      justification: "Strong ROI driver for established fintech, FDIC-insured banks, and credit card platforms.",
      contractual_safeguards: [
        "Mandate clear FTC and financial disclaimers ('Not financial advice').",
        "Restrict promotion to FDIC-insured or SEC-regulated products only."
      ]
    },
    unreachable_urls: [],
    grounding_sources: [
      { title: "Graham Stephan YouTube", url: "https://youtube.com/@GrahamStephan" }
    ],
    analyzed_at: "2025-01-15T00:00:00.000Z"
  },

  "dougdemuro": {
    target: "youtube.com/@DougDeMuro",
    brand_name: "Automotive & Lifestyle Partner",
    creator_summary: "Doug DeMuro is a prominent automotive journalist and entrepreneur (4.8M+ subscribers) known for detailing car 'quirks and features' and co-founding Cars & Bids auction platform.",
    brand_safety_score: 97,
    risk_level: "Low",
    audience_insights: {
      authenticity_rating: "Exceptional (98% authentic automotive enthusiasts and car buyers)",
      demographics_summary: "Car buyers, collectors, and automotive enthusiasts aged 18-50.",
      engagement_quality: "Extremely passionate, knowledgeable comments analyzing vehicle specs and auction trends.",
      community_sentiment: "Universally trusted and well-liked personality in car culture.",
      toxic_recurring_themes: [],
      comment_sentiment_summary: "98% positive sentiment celebrating detailed car reviews and quirky automotive facts."
    },
    controversy_and_pr_history: {
      past_issues_summary: "Zero PR scandals; flawless track record over a decade of automotive journalism.",
      pr_crisis_handling: "N/A — clean track record.",
      current_community_perception: "Iconic authority in car reviews and enthusiast auctions."
    },
    competitor_and_sponsorship_history: [
      {
        competitor_or_brand: "Cars & Bids",
        platform: "YouTube",
        details: "Founder and primary video promoter for Cars & Bids online automotive marketplace.",
        source_url: "https://youtube.com/@DougDeMuro",
        verification_status: "verified"
      }
    ],
    nuanced_red_flags: [],
    positive_highlights: [
      "Unrivaled influence in automotive purchasing decisions and vehicle auctions.",
      "Spotless brand safety record with family-friendly humor and enthusiasm.",
      "High engagement among affluent car enthusiasts."
    ],
    final_verdict: {
      recommendation: "Sponsor",
      justification: "Top tier partner for automotive brands, car insurance, detailing products, and travel.",
      contractual_safeguards: [
        "Include standard FTC sponsorship disclosure requirements."
      ]
    },
    unreachable_urls: [],
    grounding_sources: [
      { title: "Doug DeMuro Official Channel", url: "https://youtube.com/@DougDeMuro" }
    ],
    analyzed_at: "2025-01-15T00:00:00.000Z"
  }
};

export function getSeededAudit(targetStr: string): AuditReport | null {
  if (!targetStr) return null;
  const key = targetStr.toLowerCase().trim()
    .replace(/^@+/, "") // @mrbeast and mrbeast are the same creator
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "")
    .replace(/[\/\.\s@]/g, "_");

  for (const [seedKey, report] of Object.entries(SEEDED_AUDITS)) {
    const reportTargetKey = report.target.toLowerCase().trim()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\/+$/, "")
      .replace(/[\/\.\s@]/g, "_");

    if (key === seedKey || key === reportTargetKey) {
      return report;
    }
  }

  return null;
}
