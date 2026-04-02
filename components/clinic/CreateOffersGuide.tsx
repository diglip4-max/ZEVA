"use client";
import React from 'react';
import { Gift} from 'lucide-react';

const CreateOffersGuide: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto px-6">
      <div className="flex items-center gap-3 mb-8">
        <Gift className="w-10 h-10 text-teal-600" />
        <h2 className="text-3xl font-bold text-gray-900">Create Offers</h2>
      </div>
      
      <div className="prose max-w-none">
        <h3 className="text-2xl font-semibold text-gray-800 mb-4">Create Offers - Complete Guide</h3>
        <p className="text-base text-gray-600 mb-8 leading-relaxed">
          The Create Offers module enables you to design, configure, and manage promotional offers 
          to attract new patients and retain existing ones. This comprehensive guide covers all aspects 
          of offer creation and management.
        </p>
        
        {/* Offer Details Section */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-500 p-8 mb-10 rounded-r-lg">
          <h4 className="font-bold text-lg text-blue-900 mb-5 flex items-center gap-2">
            <span className="flex items-center justify-center w-10 h-10 bg-blue-600 text-white rounded-full text-base font-bold">1</span>
            Offer Details & Configuration
          </h4>
          <div className="ml-12 space-y-4">
            <p className="text-base text-blue-800 leading-relaxed">
              The basic information section defines your offer's identity and core parameters:
            </p>
            <ul className="list-disc list-inside space-y-3 text-base text-blue-700">
              <li><strong>Offer Title:</strong> Catchy, descriptive name for your promotion (e.g., "Summer Dental Checkup Special")</li>
              <li><strong>Description:</strong> Detailed explanation of the offer benefits, terms, and what patients receive</li>
              <li><strong>Offer Type:</strong> Choose between Percentage discount, Fixed amount off, or Free Consultation</li>
              <li><strong>Discount Value:</strong> Specify the discount amount (percentage 1-100% or fixed amount in currency)</li>
              <li><strong>Currency:</strong> Select currency for fixed discounts (INR, USD, AED, etc.)</li>
              <li><strong>Offer Code:</strong> Unique coupon code patients use to claim the offer (e.g., SUMMER2024)</li>
              <li><strong>Slug/URL:</strong> SEO-friendly identifier for sharing the offer online</li>
            </ul>
            
            {/* Image Upload Section */}
            <div className="mt-6 bg-white rounded-lg border-2 border-dashed border-blue-300 p-6">
              <div className="flex items-center gap-3 mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <h5 className="font-semibold text-blue-900 text-base">Screenshot Upload Area</h5>
              </div>
              <div className="bg-blue-50 rounded-lg p-8 text-center border-2 border-dashed border-blue-200">
                <p className="text-blue-700 text-sm mb-2"><strong>Upload:</strong> /create-offer-details.png</p>
                <p className="text-blue-600 text-xs">Drag & drop or click to upload screenshot of Offer Details section</p>
              </div>
            </div>
            
            <div className="mt-4 p-4 bg-white rounded-lg border border-blue-200">
              <p className="text-sm text-blue-700"><strong>💡 Pro Tip:</strong> Use compelling titles and clear descriptions. Make offer codes memorable and easy to type.</p>
            </div>
          </div>
        </div>

        {/* Validity Period Section */}
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-green-500 p-8 mb-10 rounded-r-lg">
          <h4 className="font-bold text-lg text-green-900 mb-5 flex items-center gap-2">
            <span className="flex items-center justify-center w-10 h-10 bg-green-600 text-white rounded-full text-base font-bold">2</span>
            Validity Period & Timing
          </h4>
          <div className="ml-12 space-y-4">
            <p className="text-base text-green-800 leading-relaxed">
              Define when your offer is active and available for patients to claim:
            </p>
            <ul className="list-disc list-inside space-y-3 text-base text-green-700">
              <li><strong>Start Date:</strong> When the offer becomes active and visible to patients</li>
              <li><strong>End Date:</strong> When the offer expires and is no longer available</li>
              <li><strong>Timezone:</strong> Ensure correct timing based on your clinic location (default: Asia/Kolkata)</li>
              <li><strong>Status:</strong> Set as Draft (hidden), Active (live), or Inactive (paused)</li>
            </ul>
            
            {/* Image Upload Section */}
            <div className="mt-6 bg-white rounded-lg border-2 border-dashed border-green-300 p-6">
              <div className="flex items-center gap-3 mb-4">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <h5 className="font-semibold text-green-900 text-base">Screenshot Upload Area</h5>
              </div>
              <div className="bg-green-50 rounded-lg p-8 text-center border-2 border-dashed border-green-200">
                <p className="text-green-700 text-sm mb-2"><strong>Upload:</strong> /create-offer-dates.png</p>
                <p className="text-green-600 text-xs">Drag & drop or click to upload screenshot of date selection</p>
              </div>
            </div>
            
            <div className="mt-4 p-4 bg-white rounded-lg border border-green-200">
              <p className="text-sm text-green-700"><strong>✓ Best Practice:</strong> End date must be after start date. Plan offers around holidays, seasons, or special events for maximum impact.</p>
            </div>
          </div>
        </div>

        {/* Usage Limits Section */}
        <div className="bg-gradient-to-r from-purple-50 to-violet-50 border-l-4 border-purple-500 p-8 mb-10 rounded-r-lg">
          <h4 className="font-bold text-lg text-purple-900 mb-5 flex items-center gap-2">
            <span className="flex items-center justify-center w-10 h-10 bg-purple-600 text-white rounded-full text-base font-bold">3</span>
            Usage Limits & Restrictions
          </h4>
          <div className="ml-12 space-y-4">
            <p className="text-base text-purple-800 leading-relaxed">
              Control how many times an offer can be used and prevent abuse:
            </p>
            <ul className="list-disc list-inside space-y-3 text-base text-purple-700">
              <li><strong>Maximum Uses:</strong> Total number of times the offer can be claimed across all patients</li>
              <li><strong>Uses Count:</strong> Track how many times the offer has already been used</li>
              <li><strong>Per User Limit:</strong> How many times a single patient can claim this offer (default: 1)</li>
              <li><strong>Conditions:</strong> Additional restrictions like minimum booking value, specific treatments, etc.</li>
            </ul>
            
            {/* Image Upload Section */}
            <div className="mt-6 bg-white rounded-lg border-2 border-dashed border-purple-300 p-6">
              <div className="flex items-center gap-3 mb-4">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <h5 className="font-semibold text-purple-900 text-base">Screenshot Upload Area</h5>
              </div>
              <div className="bg-purple-50 rounded-lg p-8 text-center border-2 border-dashed border-purple-200">
                <p className="text-purple-700 text-sm mb-2"><strong>Upload:</strong> /create-offer-limits.png</p>
                <p className="text-purple-600 text-xs">Drag & drop or click to upload screenshot of usage limits configuration</p>
              </div>
            </div>
            
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-lg border border-purple-200">
                <h5 className="font-semibold text-purple-900 mb-2 text-base">Example Settings:</h5>
                <ul className="text-sm text-purple-700 space-y-1">
                  <li>• Max Uses: 100 (total claims)</li>
                  <li>• Per User: 1 (one per patient)</li>
                  <li>• Min Booking: ₹500</li>
                  <li>• Valid for: First-time patients only</li>
                </ul>
              </div>
              <div className="bg-white p-4 rounded-lg border border-purple-200">
                <h5 className="font-semibold text-purple-900 mb-2 text-base">Common Conditions:</h5>
                <ul className="text-sm text-purple-700 space-y-1">
                  <li>• Minimum transaction value</li>
                  <li>• Specific treatments only</li>
                  <li>• New patients only</li>
                  <li>• Weekday appointments only</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Marketing Channels Section */}
        <div className="bg-gradient-to-r from-orange-50 to-amber-50 border-l-4 border-orange-500 p-8 mb-10 rounded-r-lg">
          <h4 className="font-bold text-lg text-orange-900 mb-5 flex items-center gap-2">
            <span className="flex items-center justify-center w-10 h-10 bg-orange-600 text-white rounded-full text-base font-bold">4</span>
            Marketing Channels & UTM Tracking
          </h4>
          <div className="ml-12 space-y-4">
            <p className="text-base text-orange-800 leading-relaxed">
              Select where the offer will be promoted and track marketing effectiveness:
            </p>
            <ul className="list-disc list-inside space-y-3 text-base text-orange-700">
              <li><strong>Channels:</strong> Select multiple platforms (Email, SMS, WhatsApp, Social Media, Website)</li>
              <li><strong>UTM Source:</strong> Traffic source (clinic, doctor, agent, etc.)</li>
              <li><strong>UTM Medium:</strong> Marketing medium (email, social, paid_ads, etc.)</li>
              <li><strong>UTM Campaign:</strong> Specific campaign name for tracking (e.g., "Summer_Sale_2024")</li>
            </ul>
            
            {/* Image Upload Section */}
            <div className="mt-6 bg-white rounded-lg border-2 border-dashed border-orange-300 p-6">
              <div className="flex items-center gap-3 mb-4">
                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <h5 className="font-semibold text-orange-900 text-base">Screenshot Upload Area</h5>
              </div>
              <div className="bg-orange-50 rounded-lg p-8 text-center border-2 border-dashed border-orange-200">
                <p className="text-orange-700 text-sm mb-2"><strong>Upload:</strong> /create-offer-channels.png</p>
                <p className="text-orange-600 text-xs">Drag & drop or click to upload screenshot of channels and UTM parameters</p>
              </div>
            </div>
            
            <div className="mt-4 p-4 bg-white rounded-lg border border-orange-200">
              <p className="text-sm text-orange-800 font-semibold">Important:</p>
              <p className="text-sm text-orange-700 mt-1">
                UTM parameters help you track which marketing channels drive the most conversions. 
                Use consistent naming conventions for accurate analytics.
              </p>
            </div>
          </div>
        </div>

        {/* Treatment Selection Section */}
        <div className="bg-gradient-to-r from-cyan-50 to-sky-50 border-l-4 border-cyan-500 p-8 mb-10 rounded-r-lg">
          <h4 className="font-bold text-lg text-cyan-900 mb-5 flex items-center gap-2">
            <span className="flex items-center justify-center w-10 h-10 bg-cyan-600 text-white rounded-full text-base font-bold">5</span>
            Treatment & Service Selection
          </h4>
          <div className="ml-12 space-y-4">
            <p className="text-base text-cyan-800 leading-relaxed">
              Link your offer to specific treatments or services offered at your clinic:
            </p>
            <ul className="list-disc list-inside space-y-3 text-base text-cyan-700">
              <li><strong>Select Treatments:</strong> Choose from your clinic's configured treatment list</li>
              <li><strong>Main Treatments:</strong> Primary categories (e.g., Dentistry, Dermatology, Orthopedics)</li>
              <li><strong>Sub-Treatments:</strong> Specific procedures within categories (e.g., Teeth Whitening, Root Canal)</li>
              <li><strong>Multiple Selections:</strong> Apply offer to multiple treatments simultaneously</li>
              <li><strong>Treatment-Specific Offers:</strong> Create targeted promotions for high-margin or seasonal services</li>
            </ul>
            
            {/* Image Upload Section */}
            <div className="mt-6 bg-white rounded-lg border-2 border-dashed border-cyan-300 p-6">
              <div className="flex items-center gap-3 mb-4">
                <svg className="w-6 h-6 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <h5 className="font-semibold text-cyan-900 text-base">Screenshot Upload Area</h5>
              </div>
              <div className="bg-cyan-50 rounded-lg p-8 text-center border-2 border-dashed border-cyan-200">
                <p className="text-cyan-700 text-sm mb-2"><strong>Upload:</strong> /create-offer-treatments.png</p>
                <p className="text-cyan-600 text-xs">Drag & drop or click to upload screenshot of treatment selection interface</p>
              </div>
            </div>
            
            <div className="mt-4 p-4 bg-white rounded-lg border border-cyan-200">
              <p className="text-sm text-cyan-700"><strong>✓ Strategy Tip:</strong> Promote underutilized services or boost demand during slow periods with targeted treatment offers.</p>
            </div>
          </div>
        </div>

        {/* Offer Management Features Section */}
        <div className="bg-gradient-to-r from-rose-50 to-pink-50 border-l-4 border-rose-500 p-8 mb-10 rounded-r-lg">
          <h4 className="font-bold text-lg text-rose-900 mb-5 flex items-center gap-2">
            <span className="flex items-center justify-center w-10 h-10 bg-rose-600 text-white rounded-full text-base font-bold">6</span>
            Offer Management & Analytics
          </h4>
          <div className="ml-12 space-y-4">
            <p className="text-base text-rose-800 leading-relaxed">
              View, edit, export, and analyze your promotional offers performance:
            </p>
            <ul className="list-disc list-inside space-y-3 text-base text-rose-700">
              <li><strong>Offers Dashboard:</strong> See all offers with status, validity, and usage statistics</li>
              <li><strong>Edit Offers:</strong> Modify active offers (changes apply immediately)</li>
              <li><strong>Delete Offers:</strong> Remove draft or expired offers permanently</li>
              <li><strong>View Performance:</strong> Track uses count, conversion rates, and revenue impact</li>
              <li><strong>Export to CSV:</strong> Download offer data for analysis and reporting</li>
              <li><strong>Status Indicators:</strong> Visual badges for Active, Draft, Expired, or Expiring Soon</li>
            </ul>
            
            {/* Stats Cards Preview */}
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white p-3 rounded-lg border border-rose-200 text-center">
                <p className="text-xs text-rose-600 font-semibold">Total Offers</p>
                <p className="text-2xl font-bold text-rose-900">Count</p>
              </div>
              <div className="bg-white p-3 rounded-lg border border-green-200 text-center">
                <p className="text-xs text-green-600 font-semibold">Active</p>
                <p className="text-2xl font-bold text-green-900">Live</p>
              </div>
              <div className="bg-white p-3 rounded-lg border border-blue-200 text-center">
                <p className="text-xs text-blue-600 font-semibold">Total Value</p>
                <p className="text-lg font-bold text-blue-900">₹ Sum</p>
              </div>
              <div className="bg-white p-3 rounded-lg border border-amber-200 text-center">
                <p className="text-xs text-amber-600 font-semibold">Expiring Soon</p>
                <p className="text-2xl font-bold text-amber-900">7 Days</p>
              </div>
            </div>
            
            {/* Image Upload Section */}
            <div className="mt-6 bg-white rounded-lg border-2 border-dashed border-rose-300 p-6">
              <div className="flex items-center gap-3 mb-4">
                <svg className="w-6 h-6 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <h5 className="font-semibold text-rose-900 text-base">Screenshot Upload Area</h5>
              </div>
              <div className="bg-rose-50 rounded-lg p-8 text-center border-2 border-dashed border-rose-200">
                <p className="text-rose-700 text-sm mb-2"><strong>Upload:</strong> /create-offers-dashboard.png</p>
                <p className="text-rose-600 text-xs">Drag & drop or click to upload screenshot of offers dashboard with stats</p>
              </div>
            </div>
            
            <div className="mt-4 p-4 bg-white rounded-lg border border-rose-200">
              <h5 className="font-semibold text-rose-900 mb-2 text-base">Key Metrics to Monitor:</h5>
              <ul className="text-sm text-rose-700 space-y-1">
                <li>✓ Redemption rate (uses / views)</li>
                <li>✓ Revenue generated from offer</li>
                <li>✓ Most popular offers by channel</li>
                <li>✓ Patient acquisition cost per offer</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Quick Reference Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-teal-500 to-blue-600 px-6 py-4">
            <h4 className="font-bold text-white text-lg">Quick Reference: Offer Types</h4>
          </div>
          <div className="p-6">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Best For</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Example</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                <tr>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900">Percentage Discount</td>
                  <td className="px-4 py-3 text-sm text-gray-700">Variable pricing tiers</td>
                  <td className="px-4 py-3 text-sm text-gray-700">20% off on first visit</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900">Fixed Amount Off</td>
                  <td className="px-4 py-3 text-sm text-gray-700">Specific discount amounts</td>
                  <td className="px-4 py-3 text-sm text-gray-700">₹500 off on consultations</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900">Free Consultation</td>
                  <td className="px-4 py-3 text-sm text-gray-700">Patient acquisition</td>
                  <td className="px-4 py-3 text-sm text-gray-700">Free dental check-up camp</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateOffersGuide;
