import {
  Calendar,
  FileText,
  Mail,
  Package,
  Phone,
  Smartphone,
  User,
  Activity,
  Tag,
  Home,
  Users,
  Percent,
  XCircle,
  RefreshCw,
  Clock,
} from "lucide-react";

interface Variable {
  label: string;
  value: string;
  category: string;
  icon: any;
}

export const patientVariables: Variable[] = [
  // Patient Information
  {
    label: "Patient ID",
    value: "{{patient.id}}",
    category: "Patient",
    icon: User,
  },
  {
    label: "Patient Name",
    value: "{{patient.fullName}}",
    category: "Patient",
    icon: User,
  },
  {
    label: "Patient First Name",
    value: "{{patient.firstName}}",
    category: "Patient",
    icon: User,
  },
  {
    label: "Patient Last Name",
    value: "{{patient.lastName}}",
    category: "Patient",
    icon: User,
  },
  {
    label: "Patient Gender",
    value: "{{patient.gender}}",
    category: "Patient",
    icon: User,
  },
  {
    label: "Patient Email",
    value: "{{patient.email}}",
    category: "Patient",
    icon: Mail,
  },
  {
    label: "Patient Country Code",
    value: "{{patient.countryCode}}",
    category: "Patient",
    icon: Phone,
  },
  {
    label: "Patient Mobile Number",
    value: "{{patient.mobileNumber}}",
    category: "Patient",
    icon: Smartphone,
  },
  {
    label: "Patient Phone",
    value: "{{patient.phone}}",
    category: "Patient",
    icon: Phone,
  },
  {
    label: "Patient City",
    value: "{{patient.city}}",
    category: "Patient",
    icon: Home,
  },
  {
    label: "Patient Type",
    value: "{{patient.patientType}}",
    category: "Patient",
    icon: User,
  },
  {
    label: "Patient EMR Number",
    value: "{{patient.emrNumber}}",
    category: "Patient",
    icon: FileText,
  },

  // Birthday Specific
  {
    label: "Date of Birth",
    value: "{{patient.dateOfBirth}}",
    category: "Patient",
    icon: Calendar,
  },
  {
    label: "Birthday Day",
    value: "{{patient.birthDay}}",
    category: "Patient",
    icon: Calendar,
  },
  {
    label: "Birthday Month",
    value: "{{patient.birthMonth}}",
    category: "Patient",
    icon: Calendar,
  },
  {
    label: "Age",
    value: "{{patient.age}}",
    category: "Patient",
    icon: Calendar,
  },
  {
    label: "Turning Age",
    value: "{{patient.turningAge}}",
    category: "Patient",
    icon: Calendar,
  },

  // Membership & Package
  {
    label: "Membership Status",
    value: "{{patient.membership}}",
    category: "Patient",
    icon: Activity,
  },
  {
    label: "Package Status",
    value: "{{patient.package}}",
    category: "Patient",
    icon: Activity,
  },
  {
    label: "Wallet Balance",
    value: "{{patient.walletBalance}}",
    category: "Patient",
    icon: FileText,
  },

  // Clinic
  {
    label: "Clinic ID",
    value: "{{patient.clinicId}}",
    category: "Patient",
    icon: Home,
  },
  {
    label: "Referred By",
    value: "{{patient.referredBy}}",
    category: "Patient",
    icon: Users,
  },
];

export const appointmentVariables: Variable[] = [
  // Patient Information
  {
    label: "Patient ID",
    value: "{{appointment.patientId}}",
    category: "Appointment",
    icon: User,
  },
  {
    label: "Patient Name",
    value: "{{appointment.patientName}}",
    category: "Appointment",
    icon: User,
  },
  {
    label: "Patient First Name",
    value: "{{appointment.patientFirstName}}",
    category: "Appointment",
    icon: User,
  },
  {
    label: "Patient Last Name",
    value: "{{appointment.patientLastName}}",
    category: "Appointment",
    icon: User,
  },
  {
    label: "Patient Gender",
    value: "{{appointment.patientGender}}",
    category: "Appointment",
    icon: User,
  },
  {
    label: "Patient Email",
    value: "{{appointment.patientEmail}}",
    category: "Appointment",
    icon: Mail,
  },
  {
    label: "Patient Phone",
    value: "{{appointment.patientPhone}}",
    category: "Appointment",
    icon: Phone,
  },
  {
    label: "Patient Mobile Number",
    value: "{{appointment.patientMobileNumber}}",
    category: "Appointment",
    icon: Smartphone,
  },
  {
    label: "Patient Type",
    value: "{{appointment.patientType}}",
    category: "Appointment",
    icon: User,
  },
  // Doctor Information
  {
    label: "Doctor ID",
    value: "{{appointment.doctorId}}",
    category: "Appointment",
    icon: User,
  },
  {
    label: "Doctor Name",
    value: "{{appointment.doctorName}}",
    category: "Appointment",
    icon: User,
  },
  {
    label: "Doctor Email",
    value: "{{appointment.doctorEmail}}",
    category: "Appointment",
    icon: Mail,
  },
  {
    label: "Doctor Phone",
    value: "{{appointment.doctorPhone}}",
    category: "Appointment",
    icon: Phone,
  },
  {
    label: "Doctor Gender",
    value: "{{appointment.doctorGender}}",
    category: "Appointment",
    icon: User,
  },
  {
    label: "Doctor Age",
    value: "{{appointment.doctorAge}}",
    category: "Appointment",
    icon: Calendar,
  },
  {
    label: "Doctor Date of Birth",
    value: "{{appointment.doctorDob}}",
    category: "Appointment",
    icon: Calendar,
  },
  // Room Information
  {
    label: "Room ID",
    value: "{{appointment.roomId}}",
    category: "Appointment",
    icon: Home,
  },
  {
    label: "Room Name",
    value: "{{appointment.roomName}}",
    category: "Appointment",
    icon: Home,
  },
  // Appointment Information
  {
    label: "Appointment ID",
    value: "{{appointment.id}}",
    category: "Appointment",
    icon: FileText,
  },
  {
    label: "Appointment Date",
    value: "{{appointment.date}}",
    category: "Appointment",
    icon: Calendar,
  },
  {
    label: "Appointment Time",
    value: "{{appointment.time}}",
    category: "Appointment",
    icon: Clock,
  },
  {
    label: "Follow Type",
    value: "{{appointment.followType}}",
    category: "Appointment",
    icon: RefreshCw,
  },
  {
    label: "Status",
    value: "{{appointment.status}}",
    category: "Appointment",
    icon: Activity,
  },
  {
    label: "Cancellation Reason",
    value: "{{appointment.cancellationReason}}",
    category: "Appointment",
    icon: XCircle,
  },
  {
    label: "Referral",
    value: "{{appointment.referral}}",
    category: "Appointment",
    icon: Users,
  },
  {
    label: "Notes",
    value: "{{appointment.notes}}",
    category: "Appointment",
    icon: FileText,
  },
  {
    label: "Treatment",
    value: "{{appointment.treatment}}",
    category: "Appointment",
    icon: Activity,
  },
];

export const packageVariables: Variable[] = [
  {
    label: "Package ID",
    value: "{{package.id}}",
    category: "Package",
    icon: FileText,
  },
  {
    label: "Package Name",
    value: "{{package.name}}",
    category: "Package",
    icon: Package,
  },
  {
    label: "Package Total Price",
    value: "{{package.totalPrice}}",
    category: "Package",
    icon: FileText,
  },
  {
    label: "Package Total Sessions",
    value: "{{package.totalSessions}}",
    category: "Package",
    icon: Activity,
  },
  {
    label: "Session Price",
    value: "{{package.sessionPrice}}",
    category: "Package",
    icon: FileText,
  },
  {
    label: "Validity (Months)",
    value: "{{package.validityInMonths}}",
    category: "Package",
    icon: Calendar,
  },
  {
    label: "Start Date",
    value: "{{package.startDate}}",
    category: "Package",
    icon: Calendar,
  },
  {
    label: "End Date",
    value: "{{package.endDate}}",
    category: "Package",
    icon: Calendar,
  },
  {
    label: "Package Sold By",
    value: "{{package.createdByName}}",
    category: "Package",
    icon: User,
  },
];

export const offerVariables: Variable[] = [
  {
    label: "Offer Title",
    value: "{{offer.title}}",
    category: "Offer",
    icon: Tag,
  },
  {
    label: "Offer Description",
    value: "{{offer.description}}",
    category: "Offer",
    icon: FileText,
  },
  {
    label: "Offer Code",
    value: "{{offer.code}}",
    category: "Offer",
    icon: Tag,
  },
  {
    label: "Offer Type",
    value: "{{offer.offerType}}",
    category: "Offer",
    icon: Tag,
  },
  {
    label: "Discount",
    value: "{{offer.discount}}",
    category: "Offer",
    icon: Percent,
  },
  {
    label: "Cashback Amount",
    value: "{{offer.cashbackAmount}}",
    category: "Offer",
    icon: FileText,
  },
  {
    label: "Cashback Expiry Days",
    value: "{{offer.cashbackExpiryDays}}",
    category: "Offer",
    icon: Calendar,
  },
  {
    label: "Buy Quantity",
    value: "{{offer.buyQty}}",
    category: "Offer",
    icon: Activity,
  },
  {
    label: "Free Quantity",
    value: "{{offer.freeQty}}",
    category: "Offer",
    icon: Activity,
  },
  {
    label: "Minimum Bill Amount",
    value: "{{offer.minimumBillAmount}}",
    category: "Offer",
    icon: FileText,
  },
  {
    label: "Max Benefit Cap",
    value: "{{offer.maxBenefitCap}}",
    category: "Offer",
    icon: FileText,
  },
  {
    label: "Valid From",
    value: "{{offer.startsAt}}",
    category: "Offer",
    icon: Calendar,
  },
  {
    label: "Valid Till",
    value: "{{offer.endsAt}}",
    category: "Offer",
    icon: Calendar,
  },
  {
    label: "Offer Status",
    value: "{{offer.status}}",
    category: "Offer",
    icon: Activity,
  },
  {
    label: "Applicable Services",
    value: "{{offer.serviceNames}}",
    category: "Offer",
    icon: Activity,
  },
  {
    label: "Applicable Departments",
    value: "{{offer.departmentNames}}",
    category: "Offer",
    icon: Home,
  },
];

export const billingVariables: Variable[] = [
  // Patient
  {
    label: "Patient Name",
    value: "{{billing.patientName}}",
    category: "Billing",
    icon: User,
  },

  // Invoice
  {
    label: "Invoice Number",
    value: "{{billing.invoiceNumber}}",
    category: "Billing",
    icon: FileText,
  },
  {
    label: "Invoice Date",
    value: "{{billing.invoicedDate}}",
    category: "Billing",
    icon: Calendar,
  },

  // Amounts (core for all payment events)
  {
    label: "Total Amount",
    value: "{{billing.amount}}",
    category: "Billing",
    icon: FileText,
  },
  {
    label: "Amount Paid",
    value: "{{billing.paid}}",
    category: "Billing",
    icon: FileText,
  },
  {
    label: "Pending Amount",
    value: "{{billing.pending}}",
    category: "Billing",
    icon: FileText,
  },
  {
    label: "Advance Amount",
    value: "{{billing.advance}}",
    category: "Billing",
    icon: FileText,
  },

  // Payment Method
  {
    label: "Payment Method",
    value: "{{billing.paymentMethod}}",
    category: "Billing",
    icon: FileText,
  },

  // Service context (kya treat hua)
  {
    label: "Service Type",
    value: "{{billing.service}}",
    category: "Billing",
    icon: Activity,
  },
  {
    label: "Treatment",
    value: "{{billing.treatment}}",
    category: "Billing",
    icon: Activity,
  },
  {
    label: "Package",
    value: "{{billing.package}}",
    category: "Billing",
    icon: Package,
  },
];
