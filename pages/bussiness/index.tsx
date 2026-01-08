import type { ReactElement, ReactNode } from "react";

import Head from "next/head";

import LandingContent from "./LandingContent";
import MarketplaceSection from "../../components/bussiness/MarketplaceSection";
import TeamSection from "../../components/bussiness/TeamSection";
import FinanceSection from "../../components/bussiness/FinanceSection";

function SparklesIcon(props: { className?: string }) {
  return (
    <svg
      className={props.className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 2l1.2 3.6L17 7l-3.8 1.4L12 12l-1.2-3.6L7 7l3.8-1.4L12 2z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11l.9 2.7L23 15l-3.1 1.3L19 19l-.9-2.7L15 15l3.1-1.3L19 11z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.5l.8 2.4L8 16l-2.7 1.1-.8 2.4-.8-2.4L1 16l2.7-1.1.8-2.4z" />
    </svg>
  );
}

function CalendarIcon(props: { className?: string }) {
  return (
    <svg className={props.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3M5 11h14" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 5h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2z" />
    </svg>
  );
}

function TrendingUpIcon(props: { className?: string }) {
  return (
    <svg className={props.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 17l6-6 4 4 7-7" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 7h6v6" />
    </svg>
  );
}

function UsersIcon(props: { className?: string }) {
  return (
    <svg className={props.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 21v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M23 21v-2a4 4 0 00-3-3.87" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

function ShieldIcon(props: { className?: string }) {
  return (
    <svg className={props.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-5" />
    </svg>
  );
}

function DollarIcon(props: { className?: string }) {
  return (
    <svg className={props.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 1v22" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17 5.5c0-1.93-2.24-3.5-5-3.5S7 3.57 7 5.5 9.24 9 12 9s5 1.57 5 3.5S14.76 16 12 16s-5-1.57-5-3.5"
      />
    </svg>
  );
}

function CogIcon(props: { className?: string }) {
  return (
    <svg className={props.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 15.5a3.5 3.5 0 110-7 3.5 3.5 0 010 7z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.4 15a7.97 7.97 0 00.1-6l2-1.2-2-3.4-2.3 1a8.2 8.2 0 00-5.2-3L11.6 1h-3.2L8 3.2a8.2 8.2 0 00-5.2 3l-2.3-1-2 3.4L.5 9a7.97 7.97 0 00.1 6l-2 1.2 2 3.4 2.3-1a8.2 8.2 0 005.2 3l.4 2.2h3.2l.4-2.2a8.2 8.2 0 005.2-3l2.3 1 2-3.4-2-1.2z"
      />
    </svg>
  );
}

function ArrowRightIcon(props: { className?: string }) {
  return (
    <svg className={props.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 6l6 6-6 6" />
    </svg>
  );
}

type ModuleCardProps = {
  icon: ReactElement;
  title: string;
  subtitle: string;
  price: string;
  items: string[];
  accent?: "teal" | "mint";
  delayMs?: number;
};

function ModuleCard({ icon, title, subtitle, price, items, accent = "teal", delayMs = 0 }: ModuleCardProps) {
  const isMint = accent === "mint";
  return (
    <div
      style={{ animationDelay: `${delayMs}ms` }}
      className={[
        "zeva-module-card w-full max-w-[380px] rounded-2xl border border-gray-200 bg-white shadow-[0_14px_40px_-26px_rgba(0,0,0,0.35)]",
        "transition-transform transition-shadow duration-200 ease-out hover:-translate-y-1 hover:shadow-[0_20px_52px_-32px_rgba(0,0,0,0.45)]",
        isMint ? "bg-gradient-to-b from-emerald-50/70 to-white" : "",
      ].join(" ")}
    >
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div className={["grid h-12 w-12 place-items-center rounded-2xl", isMint ? "bg-emerald-100/50" : "bg-emerald-50"].join(" ")}>
            {icon}
          </div>
          <div className="text-right">
            <div className="text-[11px] font-bold tracking-wide text-gray-500">FROM</div>
            <div className="text-xl font-extrabold text-blue-700">
              {price}
              <span className="text-xs font-semibold text-gray-500">/mo</span>
            </div>
          </div>
        </div>

        <div className="mt-5">
          <div className="text-base font-extrabold text-gray-900">{title}</div>
          <div className="mt-1 text-sm text-gray-500">{subtitle}</div>
        </div>

        <ul className="mt-4 space-y-2 text-sm text-gray-600">
          {items.map((it) => (
            <li key={it} className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-700" />
              <span>{it}</span>
            </li>
          ))}
        </ul>

        <button
          type="button"
          className={[
            "mt-5 flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition-colors",
            isMint
              ? "border-emerald-700 bg-emerald-50/40 text-emerald-800 hover:bg-emerald-700 hover:text-white"
              : "border-emerald-700 bg-white text-emerald-800 hover:bg-emerald-700 hover:text-white",
          ].join(" ")}
        >
          Learn More <ArrowRightIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default function BussinessLandingPage(): ReactElement {
  return (
    <>
      <Head>
        <title>ZEVA | Business Modules</title>
        <meta
          name="description"
          content="Pick and choose exactly what your business needs. All modules work together seamlessly."
        />
      </Head>

      {/* Landing page content FIRST */}
      <LandingContent includeHead={false} embedded />

      <div className="bg-white">
        <main className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:pt-8">
          <div className="flex flex-col items-center text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-extrabold text-gray-900 shadow-sm">
              <SparklesIcon className="h-4 w-4 text-emerald-700" />
              50+ POWERFUL MODULES
            </div>

            <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-blue-700 sm:text-5xl">
              Business Modules
            </h1>

            <p className="mt-5 max-w-2xl text-base leading-relaxed text-gray-600 sm:text-lg">
              Pick and choose exactly what your business needs. All modules work together seamlessly.
            </p>

            <div className="mt-10 flex items-center gap-5 text-xl font-extrabold text-blue-700">
              <span className="h-[3px] w-10 rounded-full bg-emerald-800" />
              <span>Operations &amp; Growth</span>
              <span className="h-[3px] w-10 rounded-full bg-emerald-800" />
            </div>
            <div className="mt-2 text-sm text-gray-500">
              Streamline daily operations and accelerate growth
            </div>
          </div>

          <div className="mt-12 grid justify-items-center gap-6 md:grid-cols-2 lg:grid-cols-3 lg:items-stretch">
            <ModuleCard
              delayMs={0}
              accent="teal"
              icon={<CalendarIcon className="h-7 w-7 text-emerald-700" />}
              title="Book Appointments"
              subtitle="Smart scheduling & reminders"
              price="$29"
              items={["Online booking", "24/7 scheduling", "Auto reminders", "Calendar sync"]}
            />

            <ModuleCard
              delayMs={80}
              accent="mint"
              icon={<TrendingUpIcon className="h-7 w-7 text-emerald-700" />}
              title="Lead Management"
              subtitle="Track & convert leads"
              price="$39"
              items={["Lead tracking", "Follow-up automation", "Conversion analytics", "Pipeline view"]}
            />

            {/* Add more module boxes below (you can replace content later) */}
            <ModuleCard
              delayMs={160}
              accent="teal"
              icon={<UsersIcon className="h-7 w-7 text-emerald-700" />}
              title="Staff Management"
              subtitle="Roles, schedules & performance"
              price="$—"
              items={["Placeholder feature 1", "Placeholder feature 2", "Placeholder feature 3", "Placeholder feature 4"]}
            />

            <ModuleCard
              delayMs={240}
              accent="mint"
              icon={<ShieldIcon className="h-7 w-7 text-emerald-700" />}
              title="Compliance & Security"
              subtitle="Policies, logs & access control"
              price="$—"
              items={["Placeholder feature 1", "Placeholder feature 2", "Placeholder feature 3", "Placeholder feature 4"]}
            />

            <ModuleCard
              delayMs={320}
              accent="teal"
              icon={<DollarIcon className="h-7 w-7 text-emerald-700" />}
              title="Billing & Invoicing"
              subtitle="Payments, invoices & reporting"
              price="$—"
              items={["Placeholder feature 1", "Placeholder feature 2", "Placeholder feature 3", "Placeholder feature 4"]}
            />

            <ModuleCard
              delayMs={400}
              accent="mint"
              icon={<CogIcon className="h-7 w-7 text-emerald-700" />}
              title="Automation"
              subtitle="Workflows & smart triggers"
              price="$—"
              items={["Placeholder feature 1", "Placeholder feature 2", "Placeholder feature 3", "Placeholder feature 4"]}
            />
          </div>
        </main>
      </div>

      {/* Marketplace section AFTER Business Modules */}
      <MarketplaceSection />

      {/* Merge /bussiness/team content at the bottom */}
      <TeamSection />
      <FinanceSection />

      <style jsx>{`
        .zeva-module-card {
          animation: zevaFadeUp 600ms ease-out both;
        }

        @keyframes zevaFadeUp {
          from {
            opacity: 0;
            transform: translate3d(0, 14px, 0);
          }
          to {
            opacity: 1;
            transform: translate3d(0, 0, 0);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .zeva-module-card {
            animation: none;
          }
        }
      `}</style>
    </>
  );
}

// Opt out of the global header/footer layout for a clean landing page.
BussinessLandingPage.getLayout = (page: ReactNode) => page;


