import "@/components/landing/tellovo/tellovo.css";
import { geistMono, geistSans } from "@/components/landing/tellovo/fonts";
import StoryTopbar from "@/components/landing/tellovo/StoryTopbar";
import { CheckIcon } from "@/components/landing/tellovo/icons";
import type { Story } from "@/components/landing/tellovo/stories";

const MAIL = "contact@tellovo.ai";

/** Sub-page of a landing testimonial (copied from tellovo.ai/stories/*). */
export default function StoryPage({ story }: { story: Story }) {
  const mailto = `mailto:${MAIL}?subject=${story.subject}`;
  return (
    <div className={`sp ${geistSans.variable} ${geistMono.variable}`}>
      <StoryTopbar />
      <main>
        <section className="dark" data-nav-dark="true">
          <div className="wrap">
            <h2 className="h2">
              This story hasn&apos;t happened yet.{" "}
              <span className="dim">
                It&apos;s waiting for its {story.waitingFor}.
              </span>
            </h2>
            <p className="lede">
              We&apos;re just launching Tellovo. This is the result we built it
              for — and we&apos;re looking for{" "}
              <b>the first {story.firstOne} to live it</b>. If you read the
              quote above and thought “that&apos;s me”, we&apos;d genuinely love
              to hear from you.
            </p>
            <div className="dark-cta">
              <a className="btn btn-light" href={mailto}>
                {story.cta} <span className="arr">→</span>
              </a>
            </div>
            <div className="cols">
              <div className="box">
                <h3>Is this you?</h3>
                <ul className="list">
                  {story.isYou.map((t, i) => (
                    <li key={t}>
                      <span className="n">{i + 1}</span>
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="box">
                <h3>What we&apos;ll do for you</h3>
                <ul className="list">
                  {[
                    {
                      b: "Set up Tellovo together",
                      t: "A personal onboarding call with the founders.",
                    },
                    { b: story.reviewTitle, t: story.reviewBody },
                    {
                      b: "A direct line to us",
                      t: "Questions, ideas, problems — you talk to the people building Tellovo.",
                    },
                  ].map((item) => (
                    <li key={item.b}>
                      <span className="ck" aria-hidden="true">
                        <CheckIcon className="ico" />
                      </span>
                      <span className="t">
                        <b>{item.b}</b>
                        {item.t}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="ask">
              <svg viewBox="0 0 24 24" className="ico" aria-hidden="true">
                <path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6-4.5-4.2 6.1-.7z"></path>
              </svg>
              <p>
                <b>What we ask in return:</b> your honest feedback along the
                way. And if it works for you, your real story — in your own
                words — takes this spot.
              </p>
            </div>
          </div>
        </section>
        <section className="contact">
          <div className="wrap">
            <blockquote className="q">
              <p>{story.quote}</p>
            </blockquote>
            <div className="who">
              <span className="av" aria-hidden="true">
                <svg viewBox="0 0 24 24" className="ico">
                  <circle cx="12" cy="8.5" r="3.5"></circle>
                  <path d="M5 20a7 7 0 0 1 14 0"></path>
                </svg>
              </span>
              <div>
                <b>
                  <span>This could be you</span>
                </b>
                <p>{story.who}</p>
              </div>
            </div>
            <h2 className="h2">{story.headline}</h2>
            <div className="cta-row">
              <a className="btn btn-ink" href={mailto}>
                {story.cta} <span className="arr">→</span>
              </a>
              <p className="mail">
                or email us at <a href={`mailto:${MAIL}`}>{MAIL}</a>
              </p>
            </div>
          </div>
        </section>
      </main>
      <footer className="foot">
        <div className="wrap">
          <span className="wm" style={{ fontSize: 18 }}>
            tellovo<i aria-hidden="true"></i>
          </span>
          <span>© 2026 Tellovo.</span>
        </div>
      </footer>
    </div>
  );
}
