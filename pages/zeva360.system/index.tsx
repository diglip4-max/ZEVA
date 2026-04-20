"use client";
import React from "react";
import Head from "next/head";
import Zeva360Layout from "../../components/landing/Zeva360Layout";
import Zeva360Hero from "../../components/landing/Zeva360Hero";
import Zeva360ProblemSection from "../../components/landing/Zeva360ProblemSection";
import Zeva360WorkflowSection from "../../components/landing/Zeva360WorkflowSection";
import Zeva360SolutionsSection from "../../components/landing/Zeva360SolutionsSection";
import Zeva360ComparisonTable from "../../components/landing/Zeva360ComparisonTable";
import Zeva360TestimonialsSection from "../../components/landing/Zeva360TestimonialsSection";
import Zeva360FinalCTA from "../../components/landing/Zeva360FinalCTA";

const ZEVA360Landing: React.FC = () => {
  return (
    <>
      <Head>
        <title>ZEVA 360 – Complete Clinic Management System</title>
        <meta name="description" content="ZEVA 360 helps clinics automate follow-ups, reduce no-shows by 40%, and grow revenue with intelligent automation. Get your free clinic growth audit today." />
        <meta name="robots" content="noindex, nofollow" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </Head>

      <Zeva360Layout>
        <Zeva360Hero />
        <Zeva360ProblemSection />
        <Zeva360WorkflowSection />
        <Zeva360SolutionsSection />
        <Zeva360ComparisonTable />
        <Zeva360TestimonialsSection />
        <Zeva360FinalCTA />
      </Zeva360Layout>
    </>
  );
};

export default ZEVA360Landing;