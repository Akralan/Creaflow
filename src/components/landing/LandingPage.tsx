import Link from "next/link";
import "@/components/landing/tellovo/tellovo.css";
import { geistMono, geistSans } from "@/components/landing/tellovo/fonts";
import {
  FocusHeroButton,
  HeroFocusProvider,
} from "@/components/landing/tellovo/HeroFocus";
import HeroForm from "@/components/landing/tellovo/HeroForm";
import HowItWorks from "@/components/landing/tellovo/HowItWorks";
import SiteNav from "@/components/landing/tellovo/SiteNav";

/**
 * Landing copied from tellovo.ai (markup, texts, stylesheet, animations), with the accent
 * colour of CreaFlow. Static sections are plain markup; only the nav, the repository
 * field and the walkthrough are client components.
 */
export default function LandingPage() {
  return (
    <HeroFocusProvider>
      <div className={`tv ${geistSans.variable} ${geistMono.variable}`}>
        <SiteNav />
        <main>
          <section id="top" className="hero">
            <div className="wrap">
              <h1 className="h-hero">
                Just build.
                <br />
                We grow <span className="ul">your audience.</span>
              </h1>
              <p className="hero-sub">
                Turn your GitHub activity into a weekly content plan for X and
                LinkedIn — built around your SaaS, your future customers, and
                your voice.
              </p>
              <HeroForm />
              <ul className="perks">
                <li>
                  <span className="perk-ico" aria-hidden="true">
                    <svg viewBox="0 0 24 24" className="ico">
                      <path d="m16 18 6-6-6-6M8 6l-6 6 6 6"></path>
                    </svg>
                  </span>
                  <span className="perk-txt">
                    <p>Autonomous content creation from your work.</p>
                  </span>
                </li>
                <li className="perk-arrow" aria-hidden="true">
                  →
                </li>
                <li>
                  <span className="perk-ico" aria-hidden="true">
                    <svg viewBox="0 0 24 24" className="ico">
                      <circle cx="9" cy="8" r="3.5"></circle>
                      <path d="M2.5 20a6.5 6.5 0 0 1 13 0"></path>
                      <path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5"></path>
                    </svg>
                  </span>
                  <span className="perk-txt">
                    <p>Reach people who need your product.</p>
                  </span>
                </li>
                <li className="perk-arrow" aria-hidden="true">
                  →
                </li>
                <li className="key">
                  <span className="perk-ico" aria-hidden="true">
                    <svg viewBox="0 0 24 24" className="ico">
                      <path d="M3 17l6-6 4 4 8-8"></path>
                      <path d="M15 7h6v6"></path>
                    </svg>
                  </span>
                  <span className="perk-txt">
                    <p>Generate more revenue while shipping features.</p>
                  </span>
                </li>
              </ul>
              <div className="proof" aria-label="What founders say">
                <div className="proof-grid">
                  <Link className="quote feature" href="/stories/founder">
                    <blockquote>
                      <p>
                        I was shipping every week, but barely anyone knew my
                        SaaS existed. Tellovo helped me turn my updates into
                        posts that reached the right developers. Within two
                        weeks, those conversations led to my first paying
                        customer.
                      </p>
                    </blockquote>
                    <span className="cap">
                      <span className="qa" aria-hidden="true">
                        <svg viewBox="0 0 24 24" className="ico">
                          <circle cx="12" cy="8.5" r="3.5"></circle>
                          <path d="M5 20a7 7 0 0 1 14 0"></path>
                        </svg>
                      </span>
                      <span>
                        <b>[Founder Name]</b>
                        <span>Solo founder · B2B DevTool SaaS</span>
                      </span>
                      <span className="go" aria-hidden="true">
                        →
                      </span>
                    </span>
                  </Link>
                  <Link className="quote" href="/stories/indie">
                    <blockquote>
                      <p>
                        Writing one post used to take me longer than shipping
                        the feature. Now Tellovo turns my commits into a week of
                        content I can review in minutes. And it actually sounds
                        like me.
                      </p>
                    </blockquote>
                    <span className="cap">
                      <span className="qa" aria-hidden="true">
                        <svg viewBox="0 0 24 24" className="ico">
                          <circle cx="12" cy="8.5" r="3.5"></circle>
                          <path d="M5 20a7 7 0 0 1 14 0"></path>
                        </svg>
                      </span>
                      <span>
                        <b>[Founder Name]</b>
                        <span>Indie hacker · SaaS founder</span>
                      </span>
                      <span className="go" aria-hidden="true">
                        →
                      </span>
                    </span>
                  </Link>
                  <Link className="quote" href="/stories/open-source">
                    <blockquote>
                      <p>
                        I had people starring my repo, but almost no real
                        conversations around it. Sharing the stories behind my
                        releases started bringing in feedback, discussions, and
                        developers who wanted to contribute.
                      </p>
                    </blockquote>
                    <span className="cap">
                      <span className="qa" aria-hidden="true">
                        <svg viewBox="0 0 24 24" className="ico">
                          <circle cx="12" cy="8.5" r="3.5"></circle>
                          <path d="M5 20a7 7 0 0 1 14 0"></path>
                        </svg>
                      </span>
                      <span>
                        <b>[Maintainer Name]</b>
                        <span>Open-source creator · Developer tools</span>
                      </span>
                      <span className="go" aria-hidden="true">
                        →
                      </span>
                    </span>
                  </Link>
                </div>
              </div>
            </div>
          </section>
          <HowItWorks />
          <section id="power" className="sec">
            <div className="wrap">
              <div className="pw-head rv">
                <h2 className="h2 pw-h">
                  The power of{" "}
                  <span className="wm">
                    tellovo<i className="wm-dot"></i>
                  </span>
                </h2>
                <div className="pw-intro">
                  <p className="dim">
                    Most AI-powered tools turn your work into posts like a
                    changelog.
                  </p>
                  <p className="dim">
                    But your future customers don&apos;t care about what you
                    shipped.
                  </p>
                  <p>They just want to understand why it matters to them.</p>
                  <p className="strong">
                    That&apos;s what{" "}
                    <span className="wm">
                      tellovo<i className="wm-dot"></i>
                    </span>{" "}
                    was built for.
                  </p>
                </div>
              </div>
              <ol className="pillars">
                <li className="pillar rv">
                  <span className="n">01</span>
                  <h3>Built on real work.</h3>
                  <p>
                    No generic AI content. Every story starts with something
                    real: a feature shipped, a problem solved, or a lesson
                    learned. Grounded in what you actually build.
                  </p>
                </li>
                <li className="pillar rv">
                  <span className="n">02</span>
                  <h3>Written for future customers.</h3>
                  <p>
                    Tellovo understands your SaaS and who you&apos;re building
                    it for. It connects your technical progress to the problems
                    your potential customers actually face.
                  </p>
                </li>
                <li className="pillar rv">
                  <span className="n">03</span>
                  <h3>Only the stories worth sharing.</h3>
                  <p>
                    Not every commit deserves a post. Tellovo finds the moments
                    that matter and turns them into a coherent weekly content
                    plan.
                  </p>
                </li>
              </ol>
              <p className="pw-close rv">
                <span className="pw-muted">
                  The goal isn&apos;t to post more.
                </span>
                <br />
                It&apos;s to become known for the problems you solve.
              </p>
            </div>
          </section>
          {/* Copied from tellovo.ai on 2026-10-26: the three posts fanned out, and the call to action
              that used to close the section above. */}
          <section className="fc" aria-labelledby="fc-h">
            <div className="wrap fc-in">
              <div className="fc-stage" aria-hidden="true">
                <div className="fc-card fc-a">
                  <span className="fc-tag">LinkedIn · carousel</span>
                  <div className="fc-code">
                    <p>
                      <span className="ln">41</span>
                      <span className="k">async function</span> deliver(event) {"{"}
                    </p>
                    <p className="del">
                      <span className="ln">42</span>
                      {"  await send(event)"}
                    </p>
                    <p className="add">
                      <span className="ln">43</span>
                      {"  await retry(() => send(event), {"}
                    </p>
                    <p className="add">
                      <span className="ln">44</span>
                      {"    backoff: "}
                      <span className="s">&quot;exponential&quot;</span>,
                    </p>
                    <p className="add">
                      <span className="ln">45</span>
                      {"    maxDelay: "}
                      <span className="s">&quot;1h&quot;</span>,
                    </p>
                    <p className="add">
                      <span className="ln">46</span>
                      {"  })"}
                    </p>
                    <p>
                      <span className="ln">47</span>
                      {"  log.delivery(event.id)"}
                    </p>
                    <p>
                      <span className="ln">48</span>
                      {"}"}
                    </p>
                  </div>
                  <div className="fc-a-foot">
                    <p className="fc-a-t">6 months of webhooks: what I wish I&apos;d known</p>
                    <span className="fc-pg">1 / 7</span>
                  </div>
                </div>
                <div className="fc-card fc-b">
                  <span className="fc-glow"></span>
                  <span className="fc-tag dk">X · thread</span>
                  <p className="fc-b-t">
                    The bug that
                    <br />
                    cost us <em>a night.</em>
                  </p>
                  <div className="fc-b-foot">
                    <span className="fc-bar">
                      <i></i>
                    </span>
                    <span className="fc-pg">1 / 5</span>
                  </div>
                </div>
                <div className="fc-card fc-c">
                  <div className="fc-c-h">
                    <span className="fc-av">Rk</span>
                    <span>
                      <b>You · Founder</b>
                      <span>LinkedIn · text</span>
                    </span>
                  </div>
                  <p className="fc-c-t">We turned down a €40k deal last week.</p>
                  <p className="fc-c-p">
                    The client wanted a custom build: six months for one account, while 200 teams were waiting for v2. Here&apos;s why we said no ↓
                  </p>
                  <p className="fc-c-f">31 comments</p>
                </div>
              </div>
              <h2 id="fc-h" className="h2 fc-h rv">
                Your first week of stories is waiting
              </h2>
              <p className="fc-p rv">
                Connect your repo, check what Tellovo understood, and get 3 posts written for your future customers. Your first week is free, no credit card.
              </p>
              <FocusHeroButton className="btn btn-ink btn-lg fc-btn">
                Generate my first week <span className="arr">→</span>
              </FocusHeroButton>
            </div>
          </section>
        </main>
        <footer className="foot">
          <div className="wrap foot-in">
            <div className="foot-l">
              <span className="wm">
                tellovo<i className="wm-dot"></i>
              </span>
              <p>Build your SaaS. Don&apos;t build in silence.</p>
            </div>
            <nav className="foot-r" aria-label="Footer">
              <a href="#about">About</a>
              <Link href="/legal/cgu">Terms of service</Link>
              <Link href="/legal/confidentialite">Privacy policy</Link>
              <span className="c">© 2026 Tellovo.</span>
            </nav>
          </div>
        </footer>
      </div>
    </HeroFocusProvider>
  );
}
