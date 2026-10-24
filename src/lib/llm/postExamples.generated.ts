/**
 * GÉNÉRÉ par scripts/build-post-examples.mjs — ne pas éditer à la main.
 *
 * Les modèles d'écriture de chaque forme (docs/FORMES_ET_GENRES.md) : de vrais posts LinkedIn du relevé
 * d'octobre 2026 (docs/CATALOGUE_POSTS_LINKEDIN.md), choisis par engagement relatif à la médiane de leur
 * auteur. Rendus par read_form, jamais dans le prompt système. Textes d'auteurs tiers, cités comme
 * exemples de forme : le rédacteur lit leur construction, il ne recopie jamais une ligne.
 */
import type { Form } from "./postForms";

export interface PostExample {
  author: string;
  reactions: number;
  /** Médiane de réactions de l'auteur sur le relevé : le ratio dit si le post a dépassé son habitude. */
  median: number;
  ratio: number;
  text: string;
}

export const POST_EXAMPLES: Partial<Record<Form, PostExample[]>> = {
  "backstage": [
    {
      "author": "Alex Lieberman",
      "reactions": 258,
      "median": 84,
      "ratio": 3.07,
      "text": "What I’m consuming this weekend is probably surprising:\n\n1) Jay Shetty interviewing Tony Robbins  about mindset.\n2) David Perell interviewing Morgan Housel about non-fiction writing.\n3) Dave Chappelle stand-up special\n4) David Senra interviewing Ari Emanuel about building WME/TKO\n5) The boron letters by Gary Halbert on copywriting \n\nAs technology accelerates & the pressure to study AI increases, I’m trying to spend just as much time studying how humans work, storytelling/creative thinking, and trust-building."
    },
    {
      "author": "Simon Høiberg",
      "reactions": 72,
      "median": 34,
      "ratio": 2.12,
      "text": "I moved from Denmark to Switzerland, then tried Spain for a few years, now I'm back in Switzerland - and my SaaS portfolio didn't notice.\n\nNo office to close. No team to relocate. No client meetings to reschedule. Revenue kept coming in while I was unpacking boxes.\n\nThis is what a real location-independent business looks like.\n\nIf you need to step away from the business for a bit and it requires a ton of planning, you're probably more locked in than you think."
    },
    {
      "author": "Jaspar Carmichael-Jack",
      "reactions": 114,
      "median": 79,
      "ratio": 1.44,
      "text": "9 million people wanted to nuke our office 🥲\n\nSomeone posted photos of an SF office on X, not knowing it was ours.\n\nWe had six Apple Studio Displays in one window.\n\nThey wrote: \"i think we might need to nuke SF\"\n\nThe internet did what it does:\n\n- \"this just for vibe coding\"\n- \"not a penny of ARR being created\"\n- \"we’re living in a dystopia”\n\nBut then someone commented that it was Artisan’s office.\n\n\"For f*ck sake, it's the 'stop hiring humans' kids.\"\n\nAs a response, we put a \"STOP DOXXING HUMANS\" sign with a hire Ava CTA in the window.\n\nThat's when it took off.\n\n+9M views, +92k likes, +1.2k retweets. In 48 hours.\n\nIt was the most cost-effective billboard we've ever done:\n\n- A $40,000 billboard in SF gets you 2M impressions in a month.\n- Our $40 billboard got us 9M impressions in 2 days.\n\nAnyway, we invited him to the office. Nice guy.\n\nhumans are pretty cool after all :)"
    },
    {
      "author": "Tibo Louis-Lucas",
      "reactions": 5,
      "median": 4,
      "ratio": 1.25,
      "text": "just spent $100k in ... windows 🤯\n\n(yes they are big .. but still)\n\nthe process was a nightmare \nand this is a MASSIVE opportunity \n\nthe process is extremely confusing, too many choices, too many constraints, in like every little details, and extremely expensive \n\nand 80% of people we talk to in this space don't actually use AI (or like a random thing on ChatGPT free version) \n\nif i had to start from 0, i would definitely go into a physical business, make it AI-native and prepare for the robotic revolution"
    },
    {
      "author": "Jaspar Carmichael-Jack",
      "reactions": 93,
      "median": 79,
      "ratio": 1.18,
      "text": "Last week I did a live demo in front of 100s of people on stage at SaaStr\n\nJason M. Lemkin and Amelia Lerutte have been vocal about how they've successfully been working with Ava the AI BDR to generate leads for the past year, so the SaaStr audience is always excited to see Artisan in action\n\nWe're obviously all about AI GTM but conferences are still a viral part of of acquisition strategy\n\nYou need to bridge the gap between the virtual and physical world. We generated 100s of leads at SaaStr who Ava had already emailed before\n\nReal world + AI GTM for the win"
    },
    {
      "author": "Pat Walls",
      "reactions": 52,
      "median": 98,
      "ratio": 0.53,
      "text": "This is why I play tennis EVERY day.\n\nAn actual study found that tennis adds 10 years to your life.\n\nBreakdown:\n\ntennis 9.7yrs \nbadminton 6.2yrs\nsoccer 4.7 yrs\ncycling 3.7 yrs\nswimming 3.4 yrs\njogging 3.2 yrs\ncalisthenics 3.1 yrs\ngym? 1.5 yrs\n\nhttps://lnkd.in/gpQXuB9s"
    }
  ],
  "proof": [
    {
      "author": "Alex Lieberman",
      "reactions": 225,
      "median": 84,
      "ratio": 2.68,
      "text": "This founder built an AI voice agent that qualifies & calls every new lead in his own cloned voice. \n\nIt qualifies them and books them with a lawyer, which saves his attorneys 4-to-5 hours a day...over $100,000 per year. \n\nHe built it with a $10 phone number and a voice note from his iPhone.\n\nHere's Achint Singh's actual system for an AI voice agent that follows up with every lead:   \n\nCheck out the full episode here: https://lnkd.in/gTciqn3Z  \n\n1) A lead fills out the form on his website, hosted on Netlify. If they don't book a time, it goes to his master bot on Grok Bot, then his follow-up bot, then the voice bot, which calls them. Leads are 80% more likely to respond if you reach them within 5 minutes vs. an hour later.  \n\n2) He built it by prompting Grok Bot. His first prompt: make a voice bot that learns from his email follow-up bot, which already knows his voice, and use ElevenLabs. Learning from the follow-up bot was the most important part. It's what makes it sound like him.  \n\n3) He cloned his voice with a 3.5-minute voice note on his iPhone, uploaded to ElevenLabs. Then he bought a number on Twilio for 10 bucks and hooked it up to the Netlify form.  \n\n4) The first version spoke too fast and was too robotic, so he made it more conversational. On the call it asks your passport country, how much you want to invest, and when you want to move. Someone looking to invest $5,000 never gets on an attorney's calendar.  \n\n5) Every call is logged in ElevenLabs and pushed into Attio, his CRM. Now he's A/B testing scripts and even accents, because leads from Turkey, India, and Canada respond to different ones.  It turns away 10 to 15 unqualified leads a day. Every 30-minute consult with someone who isn't a fit is $200 wasted.  \n\nHe couldn't afford an assistant to call every lead. So he built one that sounds like him.  \n\nHis best line: \"i have not gone into our CRM since we set it up. i just talk to grok and it just helps me figure out the next steps.\""
    },
    {
      "author": "Tibo Louis-Lucas",
      "reactions": 10,
      "median": 4,
      "ratio": 2.5,
      "text": "one of my users has billed $45,000 setting up my $99/month product for other businesses\n\nand I'm not even mad 😅\n\nit's something we don't even offer\n\nsome context:\n\nErika runs 2 businesses alone from Spring Hill, Tennessee\n\nshe's not a programmer. she's actually from an ops background, and she joined Squad.so in March\n\nshe has set up a chief of staff agent plus 5 specialists (research, sales, content, compliance, SEO), and she talks to them via Telegram\n\nthe first thing she did with Squad was ask the chief of staff agent to audit the CRM bill of the company she just took over\n\nand it went from $2,500/month to $1,500/month, so she saved $12k a year with a single prompt 💥\n\nthen there's her 10pm workflow:\n- she drives home from a networking event with 40 contacts\n- she pastes all of them into Telegram from her phone\n- by the time she gets home, 40 personalized follow-ups are sitting in her Gmail drafts\n\nthis used to eat her entire Saturday, and now it takes her 15 mins\n\nsmall business owners around her saw that and asked her \"can you do this for me?\"\n\nso she does 😅\n\nshe handles the setup and training, and she has done it for a couple dozen clients so far\n\nshe has billed $45,000 just for installing a $99/month tool for other people \n\nthe money in AI right now goes to whoever knows 30 business owners who want to start using AI agents but have no idea how\n\nyou can read the full story here 👇\nhttps://lnkd.in/dAyKUxYv"
    },
    {
      "author": "Jaspar Carmichael-Jack",
      "reactions": 157,
      "median": 79,
      "ratio": 1.99,
      "text": "Our top AE just hit two years at Artisan.\n\nHe celebrated by closing five deals in one day. $90k.\n\nHe has never built a lead list.\n\nHe has never written a sequence.\n\nHe has never enrolled a single lead in a campaign.\n\nAva the AI BDR does all of that autonomously for him.\n\nHere's what he does instead:\n- Keeps more hours open on his calendar than anyone, so he takes more meetings\n- Never ends a call without the next one booked, because deals go cold in the gap\n- Multi-threads in week one, so the deal doesn't die when one person goes quiet\n- Answers the hard technical question in the room instead of following up later\n\nEvery hour he isn't building lists is an hour he's in front of a customer.\n\nCongrats James Hayes :)"
    },
    {
      "author": "Pat Walls",
      "reactions": 188,
      "median": 98,
      "ratio": 1.92,
      "text": "I sat down with Nicole - a college-aged founder who has scaled FOUR apps to over $150K/month each.\n\nHer first app, Glamout, hit 1 million users in 6 months and peaked at $150K ARR. Her second, Sprout (formerly Prep.ai), grew to $250K MRR in 8 months. And in the last 3 months, she’s built two more stealth apps already pulling $200K MRR using the exact same system.\n\nThe craziest part? She doesn’t code a single line. She does design and distribution.\n\nLate last year her apps were doing 100M monthly views. Now they’re at 400–500M monthly views across TikTok, Instagram, and YouTube Shorts. One 7-day stretch hit 400M views by itself.\n\nHer secret isn’t luck - it’s a UGC system with 4 steps:\n\n1. Source creators (inbound forms + outbound VAs)\n\n2. Onboard them through a \ntailored video course (50%+ of her creators go viral after taking it)\n\n3. Manage them via Discord, top-creator leads, and feedback calls\n\n4. Systemize with referrals, dashboards, and analytics\n\nAt peak scale she was managing 200+ active creators at once.\n\nThe takeaway: virality isn’t a lottery ticket. It’s a process you can engineer."
    },
    {
      "author": "Pat Walls",
      "reactions": 187,
      "median": 98,
      "ratio": 1.91,
      "text": "I met a 22-year-old from Nigeria who moved to the US with $100 and a dream.\n\n12 months later, Kelechi has built two apps that did $1.5M in revenue.\n\nHis first app, Social Wizard, is an AI dating assistant that helps guys reply to Instagram stories. The idea came from a girl on his failed photo-sharing app Caspade he couldn't figure out what to text her, so he wrote a NestJS script using OpenAI to generate flirty lines.\n\nHe showed it to his high school friends at Homecoming. For the first time ever, they actually cared about something he built. That was the signal.\n\nFirst sale: $10 in late January.\n\nTwo weeks after cracking distribution: $3.5K MRR.\n\nOne month later: $25K MRR.\n\nSix months in: $250K cash collected.\n\nYear one: ~$500K cash collected.\n\nThe crazy part? $0 spent on traditional marketing.\n\nHis secret was what he calls the \"streamer strategy.\" He paid micro-streamers (Fortnite kids, reaction creators not even in his niche) $120 per video to demo the app on a real girl's Instagram story. One video hit 2M views and brought in tens of thousands of dollars.\n\nThen he built Clean Eats, a barcode scanner that tells women how a food affects their skin. Hit $10K in 2 weeks. Sold it to a UK company 4 months later.\n\nHis take: \"Distribution is a show-don't-tell game. If you put out 100 videos a day, that's 700 a week. If one goes viral, that's not luck.\""
    },
    {
      "author": "Pat Walls",
      "reactions": 133,
      "median": 98,
      "ratio": 1.36,
      "text": "I met this guy Nico who literally locked himself in a hotel room for 2 months, taught himself to code, and walked out building apps.\n\nIn one year he shipped 17 of them.\n\nMost flopped. But two of them makelogo.ai and Stalknot he sold for a combined $265,000.\n\nmakelogo.ai was an AI logo generator. One-time payment, packs of 5/10/15 logos. Did $26K in sales, then sold for $65K cash after a buyer told him “I don’t want to waste time bidding, finalize in 2 weeks.”\n\nStalknot turned voice notes into formatted text. ~10,000 users, started at a one-time pass, switched to $12/month. Did $77K in sales before he sold it for $200K last July.\n\nThe wild part: he grew Stalknot from $0 to $7K MRR on Facebook ads spending just $20–$100/day. His best ad? A guy he paid to record himself reading a script in his office. Didn’t even mention the app name until the end.\n\nHis advice to past-Nico in that hotel room: “don’t try to make $100K on your first project”\n\nMake your first dollar. Compound small wins.\n\nComment “CLARITYPLAN” and I’ll send you the full episode."
    }
  ],
  "lesson": [
    {
      "author": "Adam Robinson",
      "reactions": 571,
      "median": 149,
      "ratio": 3.83,
      "text": "Here's my startup hiring philosophy:\n\nHire people that would be great founders, but are too risk-averse to start their own thing.  \n\nThe key is giving them free rein to own their area of the business.  \n\nTry to control them, and they leave. \n\nFreedom leads to great culture."
    },
    {
      "author": "Simon Høiberg",
      "reactions": 102,
      "median": 34,
      "ratio": 3,
      "text": "Editing videos with AI got WILD!\n\nI've spent hundreds, maybe even thousands, of hours editing videos.\n\nAnd nothing has pushed my business forward more over the last 5 years than showing up on video, week after week.\n\nWith AI, that competitive advantage just turned even more competitive. It's almost unfair at this point.\n\nHere's my exact AI video production setup 👇"
    },
    {
      "author": "Alex Lieberman",
      "reactions": 246,
      "median": 84,
      "ratio": 2.93,
      "text": "11 audience-building principles I learned building Morning Brew into a $75m co with tens of millions of followers....\n\nHope they help: \n\n1) Content is a compounding asset when done right. You expend 80% of your effort to create something great once and then expend the remaining 20% to distribute it hundreds of times. \n\n2) The best type of distribution businesses are IP businesses. Disney is an IP business. WWE is an IP business. An IP business treats creative concepts or characters as core financial assets rather than standalone entertainment products. \n\n3) To build distribution is to be an asset manager of attention, finding dislocations in the market & allocating attention across a portfolio of rented (social), owned (email/pod/community), and monetized audience. \n\n4) AI should be used relentlessly to earn distribution & yet the end user should never feel it. If they do feel it, either you've used AI lazily or lack taste. \n\n5) Curation has never been more important. Thx to the internet, social platforms, and AI the cost of creating content is basically zero. That means content supply has gone exponential. But attention is decidedly finite. \n\n6) The internet rewards novelty. Either say original things in old ways or old things in original ways. \n\n7) Media companies are great at generating attention, but suck at harvesting it. Non-media companies suck at generating attention, but are great at harvesting it. \n\n8) Riches are in the niches. We went from 12 channels on the original TVs to near unlimited choice. And in a world of unlimited choice, consumers can find great content related to any/all interests from the most mainstream to the most obscure.\n\n9) We are late stage on most content platforms. In the early days of Instagram, Tiktok, and Twitter, attention was cheap, and you could amass a large audience simply by being an early adopter and actively creating on-platform. Those days are (mostly) gone. This means that the quality bar for what is “worthy” of a consumer’s time continues to increase.\n\n10) You are only as successful as your last post. Social platforms were built on the social graph. You see the content of the people you follow and your content is seen by people that follow you. Interest graphs (made popular by TikTok) flipped digital media on its head. The variance of performance has never been higher, and it’s never been easier for someone with a small audience to get outsized results on a single piece of content.\n\n11) Software is becoming content. As the barriers to build software approach 0, software is a new content medium which can be used to build and own audience."
    },
    {
      "author": "Simon Høiberg",
      "reactions": 80,
      "median": 34,
      "ratio": 2.35,
      "text": "How to become a sovereign founder.\n\nDon't rely on big tech.\n❌ Google Workspaces\n❌ AWS/Vercel/Supabase\n❌ Outsource every little thing\n✅ Self-hosting\n✅ Use open-source tools\n✅ Vibe-code internal tools\n\nDon't concentrate liability\n❌ One company\n❌ Personally owned\n❌ Single point of failure\n✅ Multiple companies\n✅ Holding structure\n✅ Offshore in different countries\n\nDon't bet on one place\n❌ Live in one country\n❌ Company in same country\n❌ Everything tied to that one country\n✅ Multiple permanent establishments\n✅ Multiple residencies/passports\n✅ Businesses in different regions\n\nIt takes time to set up.\nStart slow, expand one little bit at a time."
    },
    {
      "author": "Tibo Louis-Lucas",
      "reactions": 9,
      "median": 4,
      "ratio": 2.25,
      "text": "Bazzly now cited as best Reddit tool by ChatGPT 💪\n\ngetting mentioned by ChatGPT is very hard\nI just know a few ways to make it happen:\n\n1. make your product super niche\n2. be it the best in this category\n3. outreach to get into listicles \n4. get backlinks and mentions with Outrank\n5. get on Reddit thanks to Bazzly \n\n🤷♂️"
    },
    {
      "author": "Adam Robinson",
      "reactions": 329,
      "median": 149,
      "ratio": 2.21,
      "text": "this is advice I give founders, maybe it helps you:\n\n1/ The only way to experience rapid growth from a cold start is through a disruptive product AND disruptive marketing\n\n2/ Investment capital will NOT help you solve either of the problems of #1 - in most cases it will work against you\n\n3/ Hold off on taking funds from anybody as long as humanly possible. If you absolutely have to raise, do it from people who would give you money if you opened a restaurant\n\n4/ If you can’t raise money from people who would give you money if you opened a restaurant, you aren’t ready yet. Start a simpler business first (consulting, fractional), get some wins\n\n5/ Building a lean, inbound machine that will get you to $10m ARR without many hires, then building a proper company once you are super profitable, you win no matter what\n\n6/ Only hire when it hurts, but let people go the second it seems like someone isn’t the right fit. “I’ve never regretted letting someone go - only not letting them go soon enough”\n\n7/ Start working with an executive coach at $5m ARR to help you learn how to communicate and manage people. You suck at it, have horrible habits, and it will take years to change them\n\n8/ If you are stuck at 1%’s growth at $1m ARR, raising money will not fix that problem. You will likely need to pivot to something totally new and different to grow\n\n9/ If you can hold out on investment long enough, the freedom you will have as a bootstrapper will give you the life you wanted when you started on this path in the first place. VC will not\n\nJust my two cents. \n\nHope it helps."
    }
  ],
  "launch": [
    {
      "author": "Adam Robinson",
      "reactions": 842,
      "median": 149,
      "ratio": 5.65,
      "text": "Today I’m officially launching my new startup, MoltSets — the Worlds First Unlimited B2B Contact Database for $27/mo. Here’s why it’s going to WRECK ZoomInfo and Apollo over the next 36 months:\n\nFirst, we have to set the stage...\n\n——\n\nWHAT IS MOLTSETS AND HOW IS IT DIFFERENT???\n\nMoltSets will deliver on five key pillars of contact data that until now have not existed: \n\n1/ Unlimited APIs\n2/ High Quality\n3/ High coverage\n4/ High API rate limits\n5/ THROWAWAY PRICE\n\nYou used to be able to get 3 to 4 of these, but until MoltSets, you couldn’t get all five.\n\n——\n\nHOW ARE WE DELIVERING HIGH QUALITY???\n\nWe are going to refresh all 47m international LinkedIn slugs every 3 days, and re-validate all of their corresponding email addresses every 3 days. For $27/mo.\n\nIt’s like Apollo AND MillionVerifier at a fraction of the price. That solution will be live Nov 1.\n\nTo reiterate … Every record you pull will have a “profile last updated” and “email last validated” under 3 days ago.\n\nInsane.\n\n——\n\nIS IT REALLY UNLIMITED FOR EVERYTHING?\n\nWe price plans with rate limits. Our $27/mo guy is an individual rep working out of Claude. The $97 guy is a marketer at an early stage SaaS rolling an agentic GTM stack. The $397 guy is a leadgen agency working 10 accounts. The $997 guys are Taylor and 🦾Eric.\n\nOh yea - you will have to pay 15c for real-time carrier-verified mobile numbers through bolt-on plans starting at $27/mo. Should be 1/2 the price of ANYWHERE else.\n\n——\n\nWILL YOU HAVE VENDOR WATERFALLS?\n\nWe can’t figure out how to do that without horrible latency, since we are API-only and not storing any of your data once you pull it. So NO. But everybody says our coverage is great, so we decided we didn’t need to add waterfalls.\n\n——\n\nWHY MOLTSETS WRECKS ZOOMINFO AND APOLLO\n\nFor a brief history of disruption in the contact data market:\n\n- Dunn and Bradstreet, great data, horrible UX, $100k+\n- ZoomInfo - great UX, $20k+\n- Apollo - Unlimited $99/seat —> but now $149/mo for 1 seat w/ 6,000 credits 👎\n- MoltSets - $27/mo unlimited, API only, NO UI/UX\n\nThe MoltSets offer is so insane because the API-only model means that it’s unlimited contact data AND unlimited seats as well … so long as you don’t need their UI.\n\nAnd guess what … Nobody will need UI for anything, ever again, starting right now.\n\nEveryone will work out of Claude or ChatGPT within a few years, and a tool like MoltSets is all they will need to search and enrich prospect lists.\n\nOne early user said:\n\n“MoltSets is so easy to get up and running that even our 63yr old salesperson loves it.”\n\nLFG\n\n——\n\nThis is the beginning of the MoltSets story.\n\nThe end of the story will be ZoomInfo and Apollo’s seat-based pricing model completely collapsing.\n\nBut just like RB2B and the demise of 6Sense, it might accelerate something that was already in progress.\n\nThere’s only one thing I’m certain of…\n\nOnce MoltSets is out, the hourglass has been flipped over.\n\nApollo and ZoomInfo are walking the plank\n\nGive me the counter-argument"
    },
    {
      "author": "Jaspar Carmichael-Jack",
      "reactions": 292,
      "median": 79,
      "ratio": 3.7,
      "text": "We just launched a database of every local business globally\n\n1 billion+ data points. 130 million+ businesses. Live in Artisan today.\n\nIf you sell to restaurants, salons, gyms, or any local business, your workflow probably looks like this:\n\nGoogle businesses one by one. Copy details into a spreadsheet. Or worse, pay for a sketchy Google Maps scraper. Then send mass templated sequences.\n\nThose days are over.\n\nOn Artisan, you can now describe your ideal customer in plain English (or use filters), build a list from 130M+ local businesses in seconds, and add them straight to a campaign.\n\nThen Ava takes over. She enriches every lead using dozens of data sources, sends hyper-personalized outreach, handles objections, and books meetings directly into your teams' calendar.\n\nLocal business outreach, end to end, fully autonomous.\n\nGreat companies like SumUp and CookUnity are already using Artisan to reach local businesses. \n\nSelling to local businesses is one of the biggest markets in the world, and the tooling for it has always been terrible. Not anymore.\n\nTry it free: artisan.co"
    },
    {
      "author": "Jaspar Carmichael-Jack",
      "reactions": 198,
      "median": 79,
      "ratio": 2.51,
      "text": "Today we're launching the next era of Artisan: 'be more human'\n\nFor two years, our billboards said 'stop hiring humans'\n\nIt generated billions of impressions and millions in ARR.\n\nIt also got us death threats, a Bernie Sanders rant, and vandalized billboards.\n\nBut the point was never fewer humans. It was to stop wasting them on work that was never human to begin with.\n\nSo we built Ava the AI BDR to run it all autonomously:\n- Finds the right leads in your market\n- Acts on buying signals the moment they appear\n- Turns website visitors into warm outreach\n- Revives your closed-lost\n- Grows your existing accounts\n- Handles objections\n- Books qualified meetings\n\nSo your reps get their time back for the things only humans can do, like cold calling, meeting prospects in person, and building the relationships that actually close deals.\n\nAnd with Ava, your best reps don't get replaced. They become more valuable.\n\nHire Ava at artisan.co so your reps can be more human."
    },
    {
      "author": "Tibo Louis-Lucas",
      "reactions": 10,
      "median": 4,
      "ratio": 2.5,
      "text": "I'm making Outrank free to host blogs\n\nevery Outrank user needs a blog to publish on\n\nit never felt fair to make them sign up for another tool and pay another subscription just for that\n\nso now we're making it free for you to host your blogs:\n\n- live in about a minute: drop in your website, pick a design, done\n- your own domain included, even yourbrand.com/blog\n- templates, newsletter forms, analytics without cookies\n- sitemap, llms.txt and structured data set up for Google and AI search\n- 3 free AI-written posts to get started\n- free up to 10,000 visits a month, no credit card\n\nnow you have a place to publish your articles\n\nfrom here, Outrank can take over: keyword research, 30 SEO articles a month, backlinks from real sites, and help you get mentioned by ChatGPT, Claude and Gemini, all on autopilot\n\neven if you never use Outrank for the backlinks or articles, I think this is the best place to host a blog right now\n\non your own domain, built for Google and AI search, no plugins, and no hosting cost\n\nstart here: outrank.so/free-blog"
    },
    {
      "author": "Simon Høiberg",
      "reactions": 61,
      "median": 34,
      "ratio": 1.79,
      "text": "I quietly launched something 👀 \nAnd it changes EVERYTHING.\n\nThe best part?\n\n...SLOP!\n\nI can't fking take this AI slop writing anymore.\n\nSo we just open-sourced our internal list of AI slop writing patterns that we use in FeedHive, for YouTube script writing, and much more.\n\n+120 patterns (and the list is growing).\nMost comprehensive list on the internet.\n\nAvailable on GitHub (including Claude skill).\nAnd a tool you can use for free.\n\n🔗 https://lnkd.in/eeVepvMP\n🔗 https://lnkd.in/e_zQGS-c\n\n...let's face it, we're all using AI to write now. At least, let's teach it how to not write total slop."
    },
    {
      "author": "Alex Lieberman",
      "reactions": 148,
      "median": 84,
      "ratio": 1.76,
      "text": "We are launching AI Agent Bootcamps at Tenex! \n\nWhat's an agent bootcamp? \nA 5-day, free intensive to find & build high-impact agent opportunities with your real systems & data. \n\nWe've helped dozens of midmarket cos, F2000 enterprises, and PE portcos deploy agents into production. With bootcamps, we're lowering the friction of experiencing the power of an agent within your company's workflows to ~zero. \n\n3 phases of the bootcamp: \n1) Find Opportunities - We interview the people closest to the work to identify where agents could have the biggest impact.\n2) Map Workflows - We map workflows step by step, including the systems involved and expected business impact.\n3) Prototype Agents - We build prototypes on your data, demonstrate the results, and recommend what to take live first.\n\nBootcamps are led by our world-class FDEs & strategists, on the ground, working with your teams and systems. \n\nWhat do you get? \n1) A clear AI roadmap with ROI per opportunity\n2) Up to 8 mapped opportunities\n3) Up to 4 working prototypes \n\nWho are agent bootcamps for & how much do they cost?\nMidmarket & enterprise companies doing >$100m in revenue or funding. Bootcamps are free. They're an opportunity to see what AI agents can do for you before committing. \n\nWhy are we launching this now? \nMany companies are in the messy middle of AI transformation. They've rolled out LLMs companywide, perhaps done some AI enablement work, coding agents are being used widely in engineering, and that's it. \n\nThe next obvious step in the AI journey is bringing agents to the workflows of an organization, but most companies are getting stuck.\n\nTaking agents to production is complex and nuanced and we've built a repeatable process for handling the final mile of applied AI, which allows us to take agents into production in ~2 weeks. \n\nHow do I sign up? \nJoin the Agent Bootcamp waitlist here: https://lnkd.in/gmVNBq5k"
    }
  ],
  "number": [
    {
      "author": "Adam Robinson",
      "reactions": 336,
      "median": 149,
      "ratio": 2.26,
      "text": "RB2B is a $10m ARR company with 1 FTE. \n\nI'd be thrilled if it never grew another dollar.\n\nIt's the perfect SaaS for one reason: constraints.\n\nWe designed a stupid-simple PLG product that could be supported entirely by Fin. \n\nThe McDonald’s of site visitor ID. \n\nI know most founders don't agree...\n\nI can’t tell you the number of times - since BEFORE LAUNCH - people told us we needed to use AI to filter for ICP, find more contacts, draft messaging, and send emails and LinkedIn messages. And it’s what all of our competitors did (who are now all DEAD). While we kept the core product in its simplest possible form. \n\nIn fact, it’s STILL HAPPENING. Last week on the way home from our all team offsite in Toronto my buddy Jesse Ouellette was yelling at me about how I needed to roll MoltSets into RB2B because it would solve our churn problem and double revenue. \n\nBut here’s my one question to founders:\n\nWHY DO WE NEED TO SOLVE OUR CHURN PROBLEM AND DOUBLE REVENUE?\n\nIf you include our OEM $$$, it’s over $10m ARR. And it requires ALMOST NOTHING from us, while our core team goes on to build something we think has similar characteristics but is even MORE promising. \n\nYes, we have a shared data team of 5 people who support four business units that total $32m ARR. Yes, Ebru Abaz does answer escalated tickets, and continues to improve Fin. Yes, Kayley handles OEM. But I am completely baffled that human nature makes it impossible for ANYBODY - even Jesse, a close homie and fellow bootstrapper - to accept that RB2B might just orbit at $10m ARR for the next 5-10 years, its product in its simplest possible form, supported by a SEARINGLY CLEAR value proposition, at a price so low that nobody can disrupt its market position. \n\nI listened to David Heinemeier Hansson (DHH) on David Senra’s podcast on the way to the offsite. Of course I’m a sycophant, he and Jason Fried are my literal heroes. The first book I read when I decided I wanted to be a Founder was Rework. \n\nIn the podcast, DHH made a point about how the HARDEST THING in 2026 as a software founder is to NOT BUILD EVERYTHING, because it’s so easy to build. He said there is something so beautiful about physical products where you finish it, bring it to market, and that’s what it is, on the shelf, forever … And since software isn’t that way, apps often become a bloated mess of noise. \n\nSo I put it to you …\n\nWhat if RB2B’s revenue doesn’t grow anymore, EVER?\n\nWhat if the website and product are EXACT same 10 yrs from now? \n\nWhat if I launch a brand every 2-3 years that does the exact same thing?\n\nWHY DOESN’T ANYBODY ELSE THINK THAT WOULD BE AWESOME?!?!?!\n\nBecause I do. And I’m going to keep doing it.\n\nPS - If you're not using RB2B to identify your anonymous website visitors, you should be. \n\nTry it free at www.rb2b.com."
    },
    {
      "author": "Jaspar Carmichael-Jack",
      "reactions": 152,
      "median": 79,
      "ratio": 1.92,
      "text": "A week after launching self-serve, we’ve hit over 2,000 users\n\nThat’s 5x more users than we’ve had since starting 2 years ago (sales led)\n\nWe ask users where they heard about us during onboarding - the majority come from LinkedIn and Google!\n\nNow we’re working on optimizing the E2E funnel:\n- Improving website -> free trial conversion\n- Getting every user to launch a campaign with Ava the AI BDR (over 40% already have)\n- Optimizimg user conversion rates so they get leads \n- Pushing users to upsell once they’ve gotten value from Ava\n- Enrolling qualified users into sequences from AEs to push them to Enterprise plans\n\nPLG is a different kind of beast. The amount of data we’re already getting is insane \n\nNext stop: 10k users 🫡"
    },
    {
      "author": "Adam Robinson",
      "reactions": 277,
      "median": 149,
      "ratio": 1.86,
      "text": "This was my first ever LinkedIn post. Since then, I’ve gained over 150k followers, grew Retention.com from $13-$22m ARR, grew RB2B from $0-$10m ARR (ok it’s not quite there yet, but SOON), and am launching MoltSets (still in beta but at $250k). \n\nEvery CEO should post on LinkedIn.\n\nThe key is to just keep going. There were posts that got 2k views, there were posts that got 2m views, and I just kept posting, 3-4 times per week, and here we are.\n\nYou don’t start posting on LinkedIn to get views, likes, or follows. \n\nYou post on LinkedIn to be one day closer to making so much money that you NEVER HAVE TO POST ON LINKEDIN AGAIN. \n\nJust kidding. \n\nKeep posting."
    },
    {
      "author": "Simon Høiberg",
      "reactions": 48,
      "median": 34,
      "ratio": 1.41,
      "text": "My company runs 4 SaaS products, and we used to be 4 developers (me included). Now we're down to 2 human devs, and neither of us writes code anymore.\n\nAI agents now write 100% of our code.\n(No exceptions)\n\nThis is a superpower!\nBut if all you're doing with it is dropping slop granades on an already slopped up internet, you're wasting it.\n\nIf you do it right, it can be the biggest competitive advantage you'll ever have.\n\nBut it requires discipline 👇"
    },
    {
      "author": "Tibo Louis-Lucas",
      "reactions": 4,
      "median": 4,
      "ratio": 1,
      "text": "3 years ago, I acquired Typeframes for $50,000\n\nand turned it into an asset generating $500,000 per month \none of my biggest success so far \n\nRevid powered by Opus with a few real footage as input is absolutely wild, watch how this turned out 👇"
    },
    {
      "author": "Simon Høiberg",
      "reactions": 28,
      "median": 34,
      "ratio": 0.82,
      "text": "Historically low churn 🎉\nFor the first time ever, we see <5% for FeedHive.\n\nOur normal range is 6-9% so this is a HUGE improvement.\n\nHow did we do it?\n- Improved post failure rate dramatically\n- Added tons of small quality-of-life improvements\n- Made it better on mobile\n- Made the agentic/API experience oustanding (we have users coming from competitors who says their \"API\" solution is a total joke lol)\n\nSo making the product better reduces churn... Who would have guessed 😆\n\n(To be fair, I expect this to go back up, but if a new baseline becomes 5-7% instead of 6-9%, I'm still very happy!)"
    }
  ],
  "failure": [
    {
      "author": "Tibo Louis-Lucas",
      "reactions": 24,
      "median": 4,
      "ratio": 6,
      "text": "AI was supposed to make us work less\n\nI've never been this tired in my life\n\nmost days I have up to 10 agents running at the same time. one fixing a bug, one writing pages, one refactoring something I already forgot I asked for, 3 other I have no idea what they are doing but i suppose i ask it? \n\nand I jump from conversation to conversation all day\n\ncompared to 5 years ago, I probably context switch 100x more\n\nby the end of the day my brain is fried. completely toasted. nothing left, not even for the people I love\n\nI call it the fried brain effect\n\nthought it was just me but almost every founder I talk to lately says the exact same thing\n\nwe got superpowers, and somehow the pressure only went up. if you can ship 10x more, you feel like you have to ship 10x more. every single day\n\nI don't have a solution\n\nhonestly I have no idea where this goes from here\n\nanyone else feeling this?"
    },
    {
      "author": "Adam Robinson",
      "reactions": 134,
      "median": 149,
      "ratio": 0.9,
      "text": "5 QUESTIONS THAT ALWAYS MAKE FEEL LIKE SHIT ABOUT MYSELF: \n\n1. How many employees do you have? (”oh - so you’re just getting started …”)\n2. What’s your revenue? \n3. You’re in tech? How much money have you raised? None? Oh.\n4. Do you have an office? Oh okay.\n5. What’s your company called? Wait - what did you say?\n\nI will say that while this soul-crushing feeling of “smallness” happens less and less to me every year, it still definitely happens. In many worlds (the Aspen YPO chapter, for example), $30m in revenue is peanuts, a team of 30 is tiny, and sadly, in America, size matters, and bigger is better. \n\nBut MAN I remember the PAIN from back in the day, year 2, 3, 4 … \n\nWe only had a couple mm’s in revenue, we were stuck, I had ZERO confidence in myself as a founder, we grew our team to 38, shrunk it to 6, our business was called “Robly” (WHAT?), I had NO IDEA how we were going to get unstuck … and meanwhile I was living in New York in a golden age of VC-backed tech, living in a world of constant anxiety and FOMO, watching EVERYBODY around me absolutely CRUSH IT.\n\nOr so it seemed. \n\nIf you fast forward to today - now 12 years after we launched our first product - if someone actually takes time to understand the details of the operation we have going on, ALMOST NO ONE says anything other than “that’s one of the best businesses I have ever heard of.” \n\nWhat changed? \n\nI just kept building, and along the way there was an external change, and an internal change. \n\nEXTERNAL: \n\nThe first thing SORT OF worked. $3m ARR, stuck, $10m exit. The second thing worked a bit better. $20m ARR, 25 employees. The third thing REALLY worked. $10m ARR, 3 employees. Now I’m on to the 4th thing, which will probably look a LOT like the 3rd - but we’re still early. \nNone of that is mind blowing, but you add it all together, and - at least in my opinion - it actually IS one of the most beautiful businesses in the world. \n\nINTERNAL: \n\nI still get the “oh that’s cute” eyes every once in a while, but today I truly believe I have an incredibly beautiful business that gives me energy for other parts of my life, EXACTLY the life I want, and one that I hope to have the privilege of working on for decades to come.\n\nSo the eyes don’t sting, because I know I want what I have, even if others who blow me off don’t value it. \n\nTAKEAWAY\n\nI think it would take a person much more zen than me to rise above the crushing social pressure of being small and stuck at $3m in an environment like NYC in 2015-2020. If you can achieve that level of independent thinking, more power to you. \n\nFor everybody else, my advice is to just keep building. Keep throwing spaghetti at the wall.\nIf you just keep going, some day you will wake up and realize all of your dreams have come true."
    },
    {
      "author": "Jaspar Carmichael-Jack",
      "reactions": 31,
      "median": 79,
      "ratio": 0.39,
      "text": "We used to send everyone to self-serve for Ava the AI BDR. That was a mistake.\n\nWhen we launched our product-led motion, we pointed every interested person at the same door: sign up, try it, figure it out yourself. Clean, simple, scalable.\nIt also quietly lost us our best deals.\n\nBecause an enterprise buyer evaluating us for 50 seats does not want to fumble through a self-serve onboarding. They want a demo.\n\nSo we changed it. Now we qualify first, then route.\n\nHigh-fit, high-intent → straight to a sales demo. \n\nEveryone else → the self-serve path that's genuinely better for them.\n\nPLG is a filter that makes sure your salespeople only spend time where it counts.\n\nTry our self-serve (or book a demo) at artisan.co!"
    }
  ],
  "promise": [
    {
      "author": "Tibo Louis-Lucas",
      "reactions": 11,
      "median": 4,
      "ratio": 2.75,
      "text": "by Dec 31st, I'll hit 1M+ views on a new YouTube channel that my AI agent runs for me \n\ncalling it my last challenge of 2026 💪\n\na few days ago, one of my explainer videos did 600K impressions on X, so I started a YouTube channel that runs completely on its own\n\nit’s called \"How It Actually Works\"\n\nevery day, it picks a topic, writes the script, makes the video and posts it\n\nso far, it has covered interesting topics like how Shazam recognizes a song in seconds, what really happens when you delete a file, and how a contactless card works without a battery\n\nand this is my calendar - every green check is a video that went out by itself, and the blue ones are already queued up\n\nthe whole setup is Revid making the videos and Squad running the agent that picks topics, writes and schedules them via PostSyncer\n\nthis is going to be fun 🤩"
    },
    {
      "author": "Adam Robinson",
      "reactions": 193,
      "median": 149,
      "ratio": 1.3,
      "text": "Within 2 years, we will bootstrap MoltSets to $24m ARR with less than 5 full time employees. I recently sat down to sketch out the the math (see screenshot). Here's how we'll get there:\n\nThe TAM of B2B contact data is massive. Unlike RB2B, which is limited to US-only traffic and requires enough traffic to justify a $79/mo payment for de-anon, EVERYBODY does outreach.\n\nWith MoltSets, being API-only and having no UI for humans, we are excluding 95% of today’s buyers of contact data from buying our product. Our bet is that in 3-5 years, the API-only contact data use case will be +75% of the market.\n\nHere’s how we get to $24m ARR:\n\n1/ USER ACQUISITION:\n\nLinkedIn will be our primary channel, with my thought leadership as foundation. I want to create a massive UGC program that helps agencies and creators as much as it helps us. But - we need a stable product first (it’s coming). We will supplement with cold email, SEO, and YouTube.\n\n2/ PRICING - PLG:\n\nOur PLG pricing is intentionally low for the quality that we will deliver. We believe that we have a mini-moat around extremely low-priced offers with thought leadership audience because a/ our CAC is $0, and b/ our data team is being paid for by three other profitable business lines. We believe we can price below the rest of the market’s CAC.\n\n3/ PRICING - FLAT FILES:\n\nMany sales tech, martech, and GTM platforms buy flat file datasets because they have databases within their products. We believe that when the market understands the quality of MoltSets data, we will see inbound for the flat files to power their applications. We have had four inquires last week, and just launched the beta Monday. This is a sales-led and starts at $60k, and RB2B OEM can be included, along with many other adtech/ABM and consumer datasets.\n\n4/ SUPPORT/SUCCESS:\n\nSupport will be 99% AI, escalating 1% of tickets to humans. Robb Clarke will work the same magic with Intercom’s Fin that he did with RB2B. He’s brought on the highly talented Ebru to help him manage 100% of customer interaction for both products. Flat file customers will have humans to speak to.\n\n5/ CHURN\n\nI’m going to re-brand myself as Adam “Churn King” Robinson. I already know MoltSets churn will be epicly high. Why? We’re selling to a high-churn persona, and we’re selling a high-churn product. BUT - I think we’re going to experience what I believe BuiltWith experiences. Our company has purchased and cancelled BuiltWith 25 times over the past decade. MoltSets will be the same. The headline number will make you vomit. But they will come back.\n\n6/ TEAM\n\nWe’re going to try to do this with our existing team for the first 12mo.\n\nFTE MoltSets/RB2B: Me, Robb (success), Tate (CTO), Ebru (Success)\n\nShared Internal Team: Tyler (Data), Nicola (Data), David (Data), Cecilia (UI/UX), Kayley (flat file sales)\n\n———\n\nRB2B got to $9.5m ARR in 2.5yrs.\n\nEarly signs coming from MoltSets are that there is far more demand.\n\nSO…\n\nWill we hit $24m ARR in 24mo?\n\nFollow along to find out."
    },
    {
      "author": "Adam Robinson",
      "reactions": 109,
      "median": 149,
      "ratio": 0.73,
      "text": "Taylor Haren is going to send 1,000,000 emails a month to help us grow MoltSets to $24M ARR (that's the goal). He's creating a public dashboard that shows ever audience, click, signup, meeting, customer and $$ of revenue + the best performing email copy. Lmk if you want access."
    }
  ],
  "episode": [
    {
      "author": "Chukwunonso Ofili",
      "reactions": 597,
      "median": 19,
      "ratio": 31.42,
      "text": "Day 16 building Prima, an offline-first EMR for PHCs in Nigeria 🇳🇬 \n\nWhat I did today: Prima now installs on Android home screen and opens with no signal at all, straight to PIN screen.\n\nBefore it was just tab in Chrome. Now it's icon like WhatsApp. You install and tap, it opens, even on airplane mode.\n\nAlso update will not reload while nurse is doing registration. It asks first - \"update available, update now?\"\n\nAnd I added tap test inside Prima, because \"big enough for gloves\" should be a number, not feeling.\n\nTested on my low end android device.\n\n#buildinpublic #healthtech #offlinefirst #emr #pwa #primaryhealthcare #nigeria #indiehacker #nextjs #supabase #android #africatech #startup #buildinpublicafrica"
    },
    {
      "author": "Chukwunonso Ofili",
      "reactions": 62,
      "median": 19,
      "ratio": 3.26,
      "text": "Day 5 of building Prima : an offline-first patient registry for primary health centers (PHCs) in Nigeria 🇳🇬 \n\nToday I focused on visits.\n\nWhat I did:\nI added the visits feature so nurses can record patient visits. Built the form, the visit card, diagnosis picker with ICD-10 search (you can type plain English like \"malaria\" and it finds the code).\n\nI also added vitals with flags - if BP or temperature is high it shows, and for kids under 13 we don't flag BP.\n\nAnd the main win - I tested offline. I put my pc on airplane mode, saved a visit, it saved. When I turned on data, it synced to Supabase.\n\nSo Prima can now save visits even without internet.\n\n\n#buildinpublic #healthtech #webdevelopment #reactjs #supabase #javascript #indiehacker #startup\n\n\nPlease watch the demo video to the end👇🙏"
    },
    {
      "author": "Chukwunonso Ofili",
      "reactions": 36,
      "median": 19,
      "ratio": 1.89,
      "text": "Day 1: Building a Patient Registration System for PHCs\n\nWhat I did today:\n- Project setup \n- Designing the database schema.\n\nI set up Next.js with TypeScript, Tailwind, Prisma and PostgreSQL.\n\nThe real work was thinking through the patient fields.\n\nAt first I just wanted name, age, phone. But then I remembered my PHC visits:\n\nIf a mother comes from a village with no phone, how do we reach her? That's why I added Next of Kin + Village/LGA.\n\nIf a patient has NHIS, we need NHIS number.\n\nIf a patient has allergies, the nurse must see it instantly before prescribing.\n\nSo my Patient table now has: Full Name, DOB (age auto-calculates), Gender, Phone, Address/Village, LGA, State, Next of Kin, NHIS No (optional), Blood Group, Known Allergies, Registration Date, PHC Name.\n\nIt looks simple, but designing it right is 50% of the work. A bad schema = lost records tomorrow.\n\nWhat I learned today:\n\nIn health data, every field must answer \"why does a nurse in a rural PHC need this at 9pm with no light?\"\n\n\nHealth workers - what field did I miss that you actually use in your paper register? Tell me, I will add it.\n\n#BuildingInPublic #DigitalHealth #PublicHealthNigeria #Prisma #NextJS #Day1"
    },
    {
      "author": "Jaspar Carmichael-Jack",
      "reactions": 106,
      "median": 79,
      "ratio": 1.34,
      "text": "I'm doing a 30 minute product quiz with every AE and CSM at Artisan.\n\nOne on one. With me.\n\nI ask the questions a tough prospect would ask.\n\nIf something's missing, we go over it together and try again.\n\nWe ship something new every week, so knowing the product is a moving target.\n\nHalf our deals now come from someone who tried a competitor first.\n\nThose buyers ask harder questions, and the rep has to know the answer in the room.\n\nWe're small enough that I can sit down with every rep myself. So I'm doing it.\n\nFirst round starts next week. I'll post how it goes."
    },
    {
      "author": "Jaspar Carmichael-Jack",
      "reactions": 102,
      "median": 79,
      "ratio": 1.29,
      "text": "We spent $100k redesigning our website for the Ava 2.0 launch.\n\nMost SaaS websites look the exact same: feature blocks, pricing tables, hero with a dashboard screenshot If I'm being honest, ours used to look like that too\n\nThe problem is Ava 2.0 is not a SaaS tool - she's an autonomous AI employee And it just doesn't make sense to sell an employee the same way you'd sell software\n\nSo we gutted everything and built the new website centered around one question: how would you introduce a new hire?\n\nSee it for yourself: artisan.co\n\nAva 2.0 is officially launching GA next week - stay tuned..."
    },
    {
      "author": "Simon Høiberg",
      "reactions": 39,
      "median": 34,
      "ratio": 1.15,
      "text": "My AI team has 7 agents. Each one does exactly one job.\n\n- John runs the operation and hands out the work\n- Max grows my YouTube channel\n- Elias writes the scripts\n- Milo edits the videos\n- Leo builds the products\n- Claire handles support\n- Liza handles bookkeeping\n\nAnd they don't all run on the same model.\n\nCodex runs the orchestration, the code and the operations.\nOpus 5.5 does the writing, editing and creative work.\nQwen 3.8 runs on our own GPUs.\n\nMost people give one agent everything and wonder why it falls apart.\n\nOne job each. The right model for each job.\n\nI still bring the ideas and make the final call. The team does the rest.\n\nHere's who does what 👇"
    }
  ],
  "curation": [
    {
      "author": "Tibo Louis-Lucas",
      "reactions": 11,
      "median": 4,
      "ratio": 2.75,
      "text": "today, one of my favorite YT announced he is retiring\n\nbasically, he doesn't want to keep making videos, he wants to spend time with his kids, and have more fun playing Warhammer and Legos and write books\n\ni find it awesome \n\nhe basically has the courage to say, \"I have enough, and I will do what I love even if i make x10 less money\" \n\nwith AI taking over, I expect to see this x1000\n\nside note: this makes me realize there will be HUGE opportunities in building toys for adults - maybe time to move from BtoB SaaS"
    },
    {
      "author": "Simon Høiberg",
      "reactions": 81,
      "median": 34,
      "ratio": 2.38,
      "text": "Andrej Karpathy dropped this recently:\n\n\"The customer is not the human anymore. It's agents acting on behalf of humans.\"\n\nAnd honestly, I see it happening in my own business already.\n\nMy own AI agents already interact with Stripe, Notion, GitHub, n8n, and a dozen other tools on my behalf. They read APIs, process webhooks, make decisions, and take action. I never open half of these dashboards anymore.\n\nNow multiply that by every founder, every team, every company adopting AI agents in the next 2-3 years.\n\nSuddenly your beautiful UI does not matter as much. Your onboarding wizard is irrelevant. Your 14 dashboard tabs are wasted effort.\n\nWhat matters is:\n\n1. How good is your API?\nAgents do not click buttons. They call endpoints. If your API is an afterthought (or does not exist), you are invisible to the fastest-growing segment of \"users.\"\n\n2. How clean is your data model?\nAgents need structured, predictable data. The messier your backend, the harder it is for an agent to work with your product reliably.\n\n3. How fast can an agent get value?\nForget time-to-value for humans. What is the time-to-value for an agent? Can it authenticate, fetch data, and take action in under 30 seconds? Or does it need to navigate a cookie banner first?\n\nI am not saying UI is dead. Humans still need interfaces for complex decisions, creative work, and oversight.\n\nBut I am saying that in 2-3 years, a huge chunk of your \"active users\" will be agents. And most products are completely unprepared for that.\n\nThe SaaS companies that win the next wave will be the ones who treat agents as first-class users. Not an API docs page buried in the footer.\n\nI am already rebuilding parts of my own products with this in mind. If Karpathy is right (and I think he is), this shift will be just as big as the mobile shift was 15 years ago.\n\nExcept this time, the new \"user\" does not care about your brand colors."
    },
    {
      "author": "Alex Lieberman",
      "reactions": 197,
      "median": 84,
      "ratio": 2.35,
      "text": "Required content to keep up w/ what's happening in AI:\n\n1) Aaron Levie - commentary on the challenges/opportunities of ai in the enterprise \n2) ultrathink - biweekly newsletter combining top ai news, tactical use cases, and ai frameworks (link below)* \n3) How I AI - ai show & tell with Claire Vo & subject matter experts  \n4) Jaya Gupta - macro essays on AI & how to think about its diffusion through the economy 5) 3Blue1Brown - best educational AI youtube series on neural networks \n6) Gavin Baker - ai supply chain & infra savant \n7) AI Engineer - youtube channel with ted-style presentations from technical AI leaders \n8) Stratechery - one of the best ai/tech meets strategy & commentary newsletters in the world \n9) All-In Podcast - commentary on the labs, high growth ai startups, and the regulatory/political complex surrounding it.  \n10) Andrej Karpathy - other go-to youtube channel for ai education   \n\n*ultrathink newsletter: http://tenex.co/ultrathink  \n\nWhat's missing?"
    },
    {
      "author": "Alex Lieberman",
      "reactions": 158,
      "median": 84,
      "ratio": 1.88,
      "text": "Google Maps marks which train car you want to get in to position yourself for the fastest exit.\n\nEither the product person has felt the pain of being stuck in line after getting off the subway, or has deep user empathy for subway riders.\n\nI’m a sucker for small, but clever product features."
    },
    {
      "author": "Pat Walls",
      "reactions": 173,
      "median": 98,
      "ratio": 1.77,
      "text": "SEO is dead, even for the company that invented it.\n\nAccording to Kipp Bodnar, HubSpot lost 140 MILLION search visits in about a year!!\n\nInsane story, and they wrote a book about how they adapted.\n\nTLDR it's creators, YouTube, and showing up organically in LLMs. (Starter Story acquisition makes more sense now!)\n\nWorth picking up."
    },
    {
      "author": "Simon Høiberg",
      "reactions": 45,
      "median": 34,
      "ratio": 1.32,
      "text": "I built a custom agentic OS in Electron and React Native - and I thought I was the boss 😎 \n\nThen I tried Omarchy - arguably one of the most wonderful product experiences I've ever had.\n\nNow I'm hooked! THIS is what it should feel like to operate an AI-native company.\n\nSo I'm rebuilding my agentic OS.\nWith Omarchy as the base.\n\nCause life is too short to click around in a web view. Work should be productive but also enjoyable and fun.\n\nI'll be cooking 👇"
    }
  ],
  "offer": [
    {
      "author": "Tibo Louis-Lucas",
      "reactions": 19,
      "median": 4,
      "ratio": 4.75,
      "text": "the best decisions I've made for my products came from talking to other founders\n\nthat's why I built the tmaker Founders Room\n\nit's 200+ bootstrapped founders who share what's actually working for them, intro each other to the right people, and tell you when you're about to make a mistake\n\nwe've already had guest sessions with Marc Lou, Ilias Ism and Rob from SuperX, and each one shared the exact playbooks they used to grow\n\nnext up is Nevo David from Postiz 👀\nhe grew it to $220k+ MRR in one of the most crowded spaces out there, and I can't wait to hear how he did it\n\nif you're already using one of my products, you get 50% off for 12 months\n\nand if you don't find it useful in 7 days, email me and I'll give you a full refund\n\njoin here 👉 : www.tmaker.io/founders"
    },
    {
      "author": "Tibo Louis-Lucas",
      "reactions": 13,
      "median": 4,
      "ratio": 3.25,
      "text": "this was the best session we've had in the tmaker Founders Room\n\n@wickedguro took Postiz from $17k to $245k a month this year, in one of the most crowded markets out there\n\nand he held nothing back. he walked us through:\n- his entire UGC workflow, from sourcing creators to building campaigns to paying them\n- how he helps creators promote Postiz\n- how he runs marketing across every channel for his products\n\nmy biggest takeaway: you don't need to go viral yourself, you need a system that gets other people to go viral for you\n\nhonestly, it's going to be extremely hard for the next guests to beat this one 😅\n\nthank you, Nevo 🙌\nstill can't believe you did it for free\n\nmore of these are coming in the tmaker Founders Room"
    },
    {
      "author": "Tibo Louis-Lucas",
      "reactions": 7,
      "median": 4,
      "ratio": 1.75,
      "text": "if you run a blog in finance, health, education, HR, e-commerce or legal, I'll pay you double in October\n\nOutrank buyers want links from your niche and I don't have enough blogs for them\n\nnormal payout: $1 per DR point per article\n\nfor 10 blogs that join this month: $2 per DR point per article\n\nso a DR 60 blog makes $120 per article\n\nreply with your blog 👇"
    },
    {
      "author": "Alex Lieberman",
      "reactions": 133,
      "median": 84,
      "ratio": 1.58,
      "text": "AI Agent Sprints have blown up since we launched them a few weeks ago. \n\nHave received interest from hundreds of enterprises including: \n- Tesla\n- Airbus\n- SharkNinja\n- Amazon\n- Palo Alto Networks\n- Samsung\n\nWe have a few spots left, before we close the October cohort. \n\nThese 5-day, free intensive bootcamps for enterprise leaders are the perfect way to FINALLY get agents to production. \n\nAt Tenex, we've helped dozens of midmarket cos, F2000 enterprises, and PE portcos deploy agents into production. With bootcamps, we're lowering the friction of experiencing the power of an agent within your company's workflows to ~zero. \n\n3 phases of the sprint: \n1) Find Opportunities - We interview the people closest to the work to identify where agents could have the biggest impact.\n2) Map Workflows - We map workflows step by step, including the systems involved and expected business impact.\n3) Prototype Agents - We build prototypes on your data, demonstrate the results, and recommend what to take live first.\nSprints are led by our world-class FDEs & strategists, on the ground, working with your teams and systems. \n\nWhat do you get? \n1) A clear AI roadmap with ROI per opportunity\n2) Up to 8 mapped opportunities\n3) Up to 4 working prototypes \n\nWho are agent bootcamps for & how much do they cost?\nVP-level & up decision makers at midmarket & enterprise companies doing >$100m in revenue or funding. Bootcamps are free. They're an opportunity to see what AI agents can do for you before committing. \n\nWhy are we launching this now? \nMany companies are in the messy middle of AI transformation. They've rolled out LLMs companywide, perhaps done some AI enablement work, coding agents are being used widely in engineering, and that's it. \n\nThe next obvious step in the AI journey is bringing agents to the workflows of an organization, but most companies are getting stuck.\n\nTaking agents to production is complex and nuanced and we've built a repeatable process for handling the final mile of applied AI, which allows us to take agents into production in ~2 weeks. \n\nHow do I sign up? Join the Agent Sprint waitlist here: https://lnkd.in/gmVNBq5k"
    },
    {
      "author": "Adam Robinson",
      "reactions": 192,
      "median": 149,
      "ratio": 1.29,
      "text": "A 22-year-old is coming on my show tomorrow to argue that Claude Code can write my LinkedIn posts better than I can.\n\nTim Scheuer's started an AI SDR  company and then it died because nobody knew he existed. So he built a fully automated \"content engine\" in Claude Code. He's driving 100s of thousands of impressions and 100's of signups for his new company OXYGEN and is convinced he can automate my content.\n\nSo tomorrow he and his co-founder Philipp Hirte will share their screen and and walk through the exact prompt logic, workflows, and system architecture they built inside Claude Code to turn raw ideas into high-performing LinkedIn.\n\nIf it beats me I'll say so on the show (it won't).\n\nThen we're going argue about whether they should raise a round for their new company. They're leaning toward it. I'm going to try to talk him out of it!\n\nTomorrow's show will be fun and combative.\n\nDon't miss it!\n\nJoin us live for \"Claude did WHAT!?!\" at 11am ET\n\nGo here: https://lnkd.in/gs-Yyc4p"
    },
    {
      "author": "Jaspar Carmichael-Jack",
      "reactions": 90,
      "median": 79,
      "ratio": 1.14,
      "text": "We're hiring a human BDR. Here's what that means at a company that builds an AI BDR:\n\nArtisan is built to be run centrally by one person rather than relying on each BDR to create campaigns, so there's no human capacity bottleneck. We call that role the GTM Architect.\n\nThey set the signals, build the plays, and run campaigns on behalf of the AEs and BDRs. In our larger deployments that's one person running outbound for hundreds of reps.\n\nMeetings land on reps' calendars from campaigns going out autonomously under their name.\n\nThat means our BDR won't build lists, write sequences, create campaigns or handle replies.\n\nMost of the traditional BDR job is automated, and the person we hire gets a LOT of time back. Here's where it goes:\n\n1. 500+ cold dials a day on our native parallel dialer. The emails send from the AEs autonomously, the BDR executes the call steps.\n2. Handling escalations on AEs' outbound. When Ava isn't sure how to answer a question or work an objection, she hands it to a human.\n3. Selling in person at conferences, dinners and events.\n4. Social selling. Building relationships in a way an AI BDR can't.\n5. Calling inbound leads who abandon a demo booking, within minutes.\n6. Documenting the whole thing and posting it here, for all of you.\n\nThat's the job. It's more human and social than the pre-AI BDR role. And it's what I think the BDR role will evolve into at most companies in the next few years. \n\nIf you're interested, apply here: https://lnkd.in/gneS6Sid"
    }
  ],
  "origin": [
    {
      "author": "Chukwunonso Ofili",
      "reactions": 124,
      "median": 19,
      "ratio": 6.53,
      "text": "Hello everyone 👋\n\nI’m Chukwunonso- a final year Public Health student and a Full Stack Software Engineer.\n\nFor a long time I had two identities that didn't connect. In class, we talk about health systems, data quality, and PHCs. On my laptop, I'm building with Next.js, Node.js, TypeScript and PostgreSQL.\n\nI decided it's time to connect both.\n\nI noticed a gap: Most health tools we use in Nigerian PHCs are still paper-based. And most tech tools being built don't understand how PHCs actually work - no light, no network, nurses are busy.\n\nBecause I understand both sides - Public Health and Tech - I want to build simple digital tools that actually work for PHCs.\n\nSo starting this week, I will be building in public right here on LinkedIn.\n\nI'll be sharing my journey building health-focused tools - Patient Registration System, Maternal Health Tracker, Light-EMR concept, Disease Surveillance Dashboard and more.\n\nNot perfect products. But real building, real learning, real problems from our clinics.\n\nI'll share what I build, what I learn, what breaks, and what feedback I get from health workers.\n\nIf you are in Public Health, Digital Health, Health Informatics, eHealth Africa, NGOs, or you are a nurse/CHW in a PHC or HealthTech - I'd love to connect and learn from you.\n\nFollow along. Let's build.\n\n\n\n#DigitalHealth #PublicHealth #BuildInPublic #HealthInformatics #FullStackDeveloper #NigeriaHealth"
    },
    {
      "author": "Pat Walls",
      "reactions": 212,
      "median": 98,
      "ratio": 2.16,
      "text": "“But you're only successful because of your audience.\"\n\nWhen I started, I had:\n\n> Less than 100 followers\n> $50K in debt\n> 2 failed startups\n> No team\n> No rich parents\n> No mentors\n> A FT job I hated\n> A side project making $0\n> A mind full of self-doubt\n\nWe all gotta start somewhere."
    },
    {
      "author": "Jaspar Carmichael-Jack",
      "reactions": 149,
      "median": 79,
      "ratio": 1.89,
      "text": "I did cold outbound to 100s of unicorn founders asking for advice before I started Artisan and got A LOT of responses. One was from Zeb Evans (CEO of ClickUp) who hopped on a call with me a couple of weeks later\n\nThe advice I got from them shaped the inception story of Artisan and saved me from making a lot of mistakes \n\nI went in with no understanding of the startup ecosystem and how to build a SF venture-backed startup\n\nOriginally I’d planned on raising a $500k pre-seed and had mapped out the fundraising roadmap with round sizes in the deck. I was told by many of the people I reached out to that it was stupid, I needed to raise more and shouldn’t include future rounds in the deck (in much nicer words, of course) - we then went on to raise a $12M seed (and raised $35M total since)\n\nThere’s 2 stories in this:\n\n1. Ask people for advice. They’re going to be willing to help more often than you think\n\n2. Outbound email works and you should hire our AI BDR, Ava ;) https://lnkd.in/gxpBxTHg"
    },
    {
      "author": "Alex Lieberman",
      "reactions": 107,
      "median": 84,
      "ratio": 1.27,
      "text": "The evolution of “success” over the course of my life:\n\nChild: mommy & daddy \n\nTeen: being in the cool group\n\nCollege student: getting into a frat & the b-school\n\nPost-grad: Making a shit ton of $$ and successful dating life \n\nPre-company exit: Proving that I’m smart, successful, and enough \n\nPost-company exit: living my life like 3-year-old Alex. Full of play & wonder & curiosity \n\nParent: Be healthy, prioritize family, find joy and growth in work.\n\nWhat’s yours?"
    },
    {
      "author": "Tibo Louis-Lucas",
      "reactions": 4,
      "median": 4,
      "ratio": 1,
      "text": "moats are discovered, not designed\n\npeople tell me I'm successful because of my audience and it's my moat\n\nbut when I started building Tweet Hunter, I had no followers\n\nI didn't plan to build a following. I was using my own product every single day, in public, to grow on Twitter\n\nwriting threads with it, testing hooks with it, scheduling everything through it\n\nthe product needed proof it worked\nI was the proof\n\nthe audience wasn't a strategy. it was a side effect of one small decision: use the product myself, in public\n\nwhich is exactly what @robj3d3 is doing with SuperX now\n\nmost moats work like that. \nnetwork effects, brand, data, distribution, everything\n\nthey look designed when you read about them years later, but they usually start as a small product decision nobody thought was strategic\n\nCursor didn't start with its own models. it started as an editor people opened every day. the moat came later\n\nMidjourney didn't start with a community moat. it launched inside Discord because it was the fastest way to ship. the moat came later: everyone learned by watching everyone else's prompts\n\nyou can't see your moat on day 1 because it doesn't exist yet. it shows up once people actually use the thing\n\nyou have to do the work longer than everyone else. then one day you'll see something working for you which is hard to copy\n\nthat's the moat"
    },
    {
      "author": "Adam Robinson",
      "reactions": 141,
      "median": 149,
      "ratio": 0.95,
      "text": "In March of 2021, two weeks before we were supposed to be wired $10m for selling my first bootstrapped startup, one of our engineers accidentally deleted the entire code base - and WE DIDN’T HAVE A BACKUP!!! \n\nHere’s the full story and how NOT to run your IT at a tiny startup: \n\nMarch 26, 2021 was a day like any other. \n\nI woke up, went for a run, made some coffee, and plugged in for the day.\n\nAt around 10am, I got a text from Tate, our CTO.\n\nTate: “Something really bad just happened.” \n\nThis wasn’t immediately alarming. \n\nIt's a startup. Things always go wrong.\n\nMe: What happened?\n\nTate: Gustavo (name changed to protect the innocent) deleted the entire code base. \n\nMe: WHAT?!?!?! How did he do that?\n\nTate: One of our four nodes crapped out, which has been happening all the time. I taught the guys to go into Amazon and 'reset' it. The problem is there is an option to 'stop' the node directly below the 'reset' option. He chose to 'stop' that one, and just then, by chance, a second node crapped out. He stopped that one two. When you stop two nodes on a 4 node distributed database, it’s all gone.\n\nMe: Well, that sucks, but I guess he didn’t mean to. We have a backup, right?\n\nTate: No, because to save money, I wasn’t writing a brand new backup file every day because I didn’t want to store two 1TB files. Instead, I would update the old file with the new backup information. There is a two hour window every day where it was writing where if the code base was deleted we wouldn’t have a backup.\n\nI finally began to internalize the meaning of what I was hearing.\n\nMy heart started to accelerate and my palms began to perspire.\n\n_____\n\n\nTIMELINE:\n\n10am: Find this out. \n\n10:02am: Call co-founder, James, we panic.\n\n10:15am: Call Amazon, they say there is nothing they can do. Ask for someone \nhigher up, tell them millions of dollars are on the line.\n\n10:30am: Speak to the higher up person at Amazon, they tell us there is nothing they can do.\n\n10:32am: Tate attempts to reach out to the backup company.\n\n11:00am: Acquirer reaches out and says “your website has been down for a couple hours. Do you know what’s going on?”\n\n11:30am: Tate makes contact with the backup company. They tell him he is an idiot and pennywise and pound foolish for having any time exposed without a complete backup file. Say they can’t help.\n\n11:45am: Tate explains that we are about to sell this for $10m - in literally two weeks - and is able to convince them to connect him with a very senior engineer who actually built the product to see if they can dig into the file somehow. But they had never done this before, so they had no idea. They gave it us a 20% shot they would be able to get the code base back. \n\n12:00pm: I go to my friend Brad’s house - a VC - who says he has never heard anything like this ever in 30 years of tech, and that Tate had to be plotting something. I said he had 25% of the equity. No way.\n\n***Ran out of space!!\n\nPost continues in the comments 👇"
    }
  ],
  "promise_kept": [
    {
      "author": "Jaspar Carmichael-Jack",
      "reactions": 454,
      "median": 79,
      "ratio": 5.75,
      "text": "We spent $2M telling the world to stop hiring humans.\n\nToday we're taking it back.\n\nAnd in even more shocking news: Artisan is hiring a human BDR.\n\nTwo years ago we put those billboards up for a reason, and the reason still holds. Ava the AI BDR can do outreach better than most humans.\n\nBut she can't legally cold call people. She can't go to a conference to meet prospects in-person. She can't be a human.\n\nSo we built the tooling to enable humans. A dialer and a full toolkit for reps, inside Artisan. Your reps do the human work. \n\nAva does everything else autonomously. Finding leads, signals, personalizing outreach, handling objections, booking meetings, etc.\n\nThat's what the biggest teams on Artisan already do. One of them runs Ava alongside 1,000+ human reps. \n\nSee what she'd do for your team: https://lnkd.in/g4NeYt8m\n\nWe're proving out the super-BDR thesis ourselves. The BDR we hire will outperform most companies' entire BDR team, and I'll be posting the whole playbook here as it happens.\n\nApply here: https://lnkd.in/gneS6Sid\n\nWe're also giving away 100 \"I ♥ humans\" shirts. Claim one: https://lnkd.in/gdWAi-TZ\n\nStop hiring humans generated billions of impressions and millions in ARR. But it's time for the next Era of Artisan. \n\nNext Monday we're launching our manifesto and new slogan. The future is humans and AI, not humans or AI."
    },
    {
      "author": "Jaspar Carmichael-Jack",
      "reactions": 419,
      "median": 79,
      "ratio": 5.3,
      "text": "We made a cake to apologize for saying 'stop hiring humans'.\n \nLast month, we officially retired the slogan after 2 years.\n \nSo let me be clear: Artisan is a pro-human company.\n \nAva the AI BDR just handles the work that makes people miserable.\n \nHumans keep everything that actually needs a human.\n \nThat's why our new slogan is 'BE MORE HUMAN'.\n \nIf our billboards ever offended you, let me know and we'll send you a cake.\n \nYou can hire Ava today at artisan.co"
    },
    {
      "author": "Alex Lieberman",
      "reactions": 333,
      "median": 84,
      "ratio": 3.96,
      "text": "9 months ago I said we needed to hire 100 people in 12 months.\n\nIt's been an absolute slog. The hardest role to hire for? Forward Deployed Engineer.\n\n10x engineer who marries systems thinking, full-stack engineering, ai-native workflows, and obsession with staying on the frontier. \n\nAll of that + being client-facing. \n+ being comfortable in a room with a CEO.\n\nThat...is what we call a unicorn. Oh, and btw, every AI company on earth is trying to hire them.\n\nThis week we made our first FDE hire through Paraform.\n\nWhy Paraform? We didn't want the size of our recruiting team to cap how fast we build. Paraform gave us a network of recruiters + custom agents running searches in parallel. Not one funnel. Dozens.\n\nI've said it before: AI is a leveraged bet on people.\n\nWhich means the people who help you find them are a leveraged bet too.\nMore roles in motion. More hires to come.\n\nIf you're scaling fast, check them out: paraform.com"
    },
    {
      "author": "Adam Robinson",
      "reactions": 210,
      "median": 149,
      "ratio": 1.41,
      "text": "We haven’t touched RB2B code in 16 weeks. We have one CS rep who spends an hour a day on it. Yet it keeps growing. WHY?!?! There are two reasons. One is strategic, the other is philosophical.\n\nStrategic first.\n\nAt this point, RB2B has zero real competitors. Plenty of vendors offer person-level website visitor ID (we power most of them). But zero offer only that: nothing else, PLG, 60-second setup, under $100/mo. But nobody else can run this business at this price point.\n\nIf you’re VC-backed, a $79/mo high-churn PLG product plateaus. So you have to go upmarket and build more stuff.\n\nIf you’re a bootstrapper (like me) and happy with a lean $10M ARR business, you can’t acquire customers for $0 the way I can with my founder brand. And you can’t build and maintain an owned data asset like ours. It costs about $1.5M a year, and we spread that across 3 profitable business units.\n\nSo we enjoy our position as the only vendor willing and able to serve an unattractive segment with zero variable cost for our service, priced below everybody else’s CAC.\n\nNow the philosophical part. I think this is the big one.\n\nRB2B has that strategic advantage because of the types of opportunities we choose to pursue as a company. We will not enter a business unless we understand why we have an unfair advantage in one of two ways:\n\n(1) we can either DO something our competitors cannot (thought leadership, expensive data team for cheap product, etc)\n(2) we are WILLING to do things our competitors are not (our aggressive position on data privacy - if it’s legal, do it - selling into mid-market and enterprise).\n\nPeople dismiss RB2B as only possible because of my thought leadership. That might be true. But that’s not the magic of RB2B. \n\nIt’s doing what it’s doing because we looked at the universe of possibility around us when we were designing it and thought “what can only we do, or what are only we WILLING to do”, and made decisions accordingly.\n\nIf you’re a founder and you're stuck, ask yourself…\n\n“What can I do that everybody else either can’t, or won’t?” \n\nAnswer that, and you might have a unicorn on your hands.."
    }
  ],
  "teaser": [
    {
      "author": "Adam Robinson",
      "reactions": 135,
      "median": 149,
      "ratio": 0.91,
      "text": "I'm selfie posting. That's how excited I am! I can't share the details yet, but next week - the night before Clay's Sculpt event - I am doing a HUGE in-person launch in San Francisco. We're giving away all sorts of free merch and MoltSets subscriptions. \n\nBowling with Adam, food, drinks, goodies, high-quality networking.\n\nWednesday, October 7th @ 6pm pt.\n\nJoin us here: https://luma.com/hbtuh7wo"
    }
  ],
  "question": [
    {
      "author": "Pat Walls",
      "reactions": 45,
      "median": 98,
      "ratio": 0.46,
      "text": "I have a question that has been bugging me.\n\nIs DEEP WORK still important for founders?\n\nWith AI, it feels less necessary to \"focus\" the old way... writing code, writing emails, writing & reading in general.\n\nAnd with so much context switching, waiting for AI models, it's hard to get into flow state...\n\nI'm curious, what does deep work even mean to you in 2026?"
    }
  ],
  "looking_back": [
    {
      "author": "Jaspar Carmichael-Jack",
      "reactions": 454,
      "median": 79,
      "ratio": 5.75,
      "text": "We spent $2M telling the world to stop hiring humans.\n\nToday we're taking it back.\n\nAnd in even more shocking news: Artisan is hiring a human BDR.\n\nTwo years ago we put those billboards up for a reason, and the reason still holds. Ava the AI BDR can do outreach better than most humans.\n\nBut she can't legally cold call people. She can't go to a conference to meet prospects in-person. She can't be a human.\n\nSo we built the tooling to enable humans. A dialer and a full toolkit for reps, inside Artisan. Your reps do the human work. \n\nAva does everything else autonomously. Finding leads, signals, personalizing outreach, handling objections, booking meetings, etc.\n\nThat's what the biggest teams on Artisan already do. One of them runs Ava alongside 1,000+ human reps. \n\nSee what she'd do for your team: https://lnkd.in/g4NeYt8m\n\nWe're proving out the super-BDR thesis ourselves. The BDR we hire will outperform most companies' entire BDR team, and I'll be posting the whole playbook here as it happens.\n\nApply here: https://lnkd.in/gneS6Sid\n\nWe're also giving away 100 \"I ♥ humans\" shirts. Claim one: https://lnkd.in/gdWAi-TZ\n\nStop hiring humans generated billions of impressions and millions in ARR. But it's time for the next Era of Artisan. \n\nNext Monday we're launching our manifesto and new slogan. The future is humans and AI, not humans or AI."
    },
    {
      "author": "Jaspar Carmichael-Jack",
      "reactions": 419,
      "median": 79,
      "ratio": 5.3,
      "text": "We made a cake to apologize for saying 'stop hiring humans'.\n \nLast month, we officially retired the slogan after 2 years.\n \nSo let me be clear: Artisan is a pro-human company.\n \nAva the AI BDR just handles the work that makes people miserable.\n \nHumans keep everything that actually needs a human.\n \nThat's why our new slogan is 'BE MORE HUMAN'.\n \nIf our billboards ever offended you, let me know and we'll send you a cake.\n \nYou can hire Ava today at artisan.co"
    },
    {
      "author": "Alex Lieberman",
      "reactions": 333,
      "median": 84,
      "ratio": 3.96,
      "text": "9 months ago I said we needed to hire 100 people in 12 months.\n\nIt's been an absolute slog. The hardest role to hire for? Forward Deployed Engineer.\n\n10x engineer who marries systems thinking, full-stack engineering, ai-native workflows, and obsession with staying on the frontier. \n\nAll of that + being client-facing. \n+ being comfortable in a room with a CEO.\n\nThat...is what we call a unicorn. Oh, and btw, every AI company on earth is trying to hire them.\n\nThis week we made our first FDE hire through Paraform.\n\nWhy Paraform? We didn't want the size of our recruiting team to cap how fast we build. Paraform gave us a network of recruiters + custom agents running searches in parallel. Not one funnel. Dozens.\n\nI've said it before: AI is a leveraged bet on people.\n\nWhich means the people who help you find them are a leveraged bet too.\nMore roles in motion. More hires to come.\n\nIf you're scaling fast, check them out: paraform.com"
    },
    {
      "author": "Adam Robinson",
      "reactions": 210,
      "median": 149,
      "ratio": 1.41,
      "text": "We haven’t touched RB2B code in 16 weeks. We have one CS rep who spends an hour a day on it. Yet it keeps growing. WHY?!?! There are two reasons. One is strategic, the other is philosophical.\n\nStrategic first.\n\nAt this point, RB2B has zero real competitors. Plenty of vendors offer person-level website visitor ID (we power most of them). But zero offer only that: nothing else, PLG, 60-second setup, under $100/mo. But nobody else can run this business at this price point.\n\nIf you’re VC-backed, a $79/mo high-churn PLG product plateaus. So you have to go upmarket and build more stuff.\n\nIf you’re a bootstrapper (like me) and happy with a lean $10M ARR business, you can’t acquire customers for $0 the way I can with my founder brand. And you can’t build and maintain an owned data asset like ours. It costs about $1.5M a year, and we spread that across 3 profitable business units.\n\nSo we enjoy our position as the only vendor willing and able to serve an unattractive segment with zero variable cost for our service, priced below everybody else’s CAC.\n\nNow the philosophical part. I think this is the big one.\n\nRB2B has that strategic advantage because of the types of opportunities we choose to pursue as a company. We will not enter a business unless we understand why we have an unfair advantage in one of two ways:\n\n(1) we can either DO something our competitors cannot (thought leadership, expensive data team for cheap product, etc)\n(2) we are WILLING to do things our competitors are not (our aggressive position on data privacy - if it’s legal, do it - selling into mid-market and enterprise).\n\nPeople dismiss RB2B as only possible because of my thought leadership. That might be true. But that’s not the magic of RB2B. \n\nIt’s doing what it’s doing because we looked at the universe of possibility around us when we were designing it and thought “what can only we do, or what are only we WILLING to do”, and made decisions accordingly.\n\nIf you’re a founder and you're stuck, ask yourself…\n\n“What can I do that everybody else either can’t, or won’t?” \n\nAnswer that, and you might have a unicorn on your hands.."
    }
  ]
};
