import type { ReactElement, ReactNode } from "react";

import Head from "next/head";

import MarketplaceSection from "../../components/bussiness/MarketplaceSection";
import TeamSection from "../../components/bussiness/TeamSection";

export default function MarketplacePage(): ReactElement {
  return (
    <>
      <Head>
        <title>ZEVA | Marketplace</title>
        <meta
          name="description"
          content="Buy, sell, franchise, or invest in opportunities — powered by ZEVA Marketplace."
        />
      </Head>

      <MarketplaceSection />

      {/* Merge Team & Workforce at the bottom of Marketplace */}
      <TeamSection />
    </>
  );
}

// Opt out of the global header/footer layout for a clean landing page.
MarketplacePage.getLayout = (page: ReactNode) => page;


