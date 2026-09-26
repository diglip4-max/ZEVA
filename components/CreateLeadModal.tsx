// components/CreateLeadModal.tsx
import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import {
  X,
  User,
  Phone,
  Mail,
  Cake,
  Stethoscope,
  Globe,
  Tag,
  StickyNote,
  CalendarClock,
  Users,
  Layers,
  Sparkles,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import CustomAsyncSelect, { OptionType } from "./shared/CustomAsyncSelect";
import { loadSegmentOptions } from "@/lib/helper";
import { ModalPortal } from "@/lib/modalPortal";

// ============ COUNTRY CODES ============
const COUNTRY_CODES = [
  { code: "+1", name: "United States", flag: "🇺🇸" },
  { code: "+1", name: "Canada", flag: "🇨🇦" },
  { code: "+7", name: "Russia", flag: "🇷🇺" },
  { code: "+7", name: "Kazakhstan", flag: "🇰🇿" },
  { code: "+20", name: "Egypt", flag: "🇪🇬" },
  { code: "+27", name: "South Africa", flag: "🇿🇦" },
  { code: "+30", name: "Greece", flag: "🇬🇷" },
  { code: "+31", name: "Netherlands", flag: "🇳🇱" },
  { code: "+32", name: "Belgium", flag: "🇧🇪" },
  { code: "+33", name: "France", flag: "🇫🇷" },
  { code: "+34", name: "Spain", flag: "🇪🇸" },
  { code: "+39", name: "Italy", flag: "🇮🇹" },
  { code: "+40", name: "Romania", flag: "🇷🇴" },
  { code: "+41", name: "Switzerland", flag: "🇨🇭" },
  { code: "+44", name: "United Kingdom", flag: "🇬🇧" },
  { code: "+45", name: "Denmark", flag: "🇩🇰" },
  { code: "+46", name: "Sweden", flag: "🇸🇪" },
  { code: "+47", name: "Norway", flag: "🇳🇴" },
  { code: "+48", name: "Poland", flag: "🇵🇱" },
  { code: "+49", name: "Germany", flag: "🇩🇪" },
  { code: "+52", name: "Mexico", flag: "🇲🇽" },
  { code: "+55", name: "Brazil", flag: "🇧🇷" },
  { code: "+60", name: "Malaysia", flag: "🇲🇾" },
  { code: "+61", name: "Australia", flag: "🇦🇺" },
  { code: "+62", name: "Indonesia", flag: "🇮🇩" },
  { code: "+63", name: "Philippines", flag: "🇵🇭" },
  { code: "+64", name: "New Zealand", flag: "🇳🇿" },
  { code: "+65", name: "Singapore", flag: "🇸🇬" },
  { code: "+66", name: "Thailand", flag: "🇹🇭" },
  { code: "+81", name: "Japan", flag: "🇯🇵" },
  { code: "+82", name: "South Korea", flag: "🇰🇷" },
  { code: "+84", name: "Vietnam", flag: "🇻🇳" },
  { code: "+86", name: "China", flag: "🇨🇳" },
  { code: "+90", name: "Turkey", flag: "🇹🇷" },
  { code: "+91", name: "India", flag: "🇮🇳" },
  { code: "+92", name: "Pakistan", flag: "🇵🇰" },
  { code: "+93", name: "Afghanistan", flag: "🇦🇫" },
  { code: "+94", name: "Sri Lanka", flag: "🇱🇰" },
  { code: "+95", name: "Myanmar", flag: "🇲🇲" },
  { code: "+98", name: "Iran", flag: "🇮🇷" },
  { code: "+971", name: "United Arab Emirates", flag: "🇦🇪" },
  { code: "+972", name: "Israel", flag: "🇮🇱" },
  { code: "+973", name: "Bahrain", flag: "🇧🇭" },
  { code: "+974", name: "Qatar", flag: "🇶🇦" },
  { code: "+975", name: "Bhutan", flag: "🇧🇹" },
  { code: "+976", name: "Mongolia", flag: "🇲🇳" },
  { code: "+977", name: "Nepal", flag: "🇳🇵" },
  { code: "+880", name: "Bangladesh", flag: "🇧🇩" },
  { code: "+994", name: "Azerbaijan", flag: "🇦🇿" },
  { code: "+996", name: "Kyrgyzstan", flag: "🇰🇬" },
];

// ============ SHARED CLASSES (match LeadViewModal aesthetic) ============
const CARD =
  "rounded-xl border border-slate-200/80 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900/60";

const CONTROL =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm transition-all placeholder:text-slate-400 hover:border-slate-300 focus:border-teal-500 focus:outline-none focus:ring-4 focus:ring-teal-500/10 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200 dark:placeholder:text-slate-500 dark:hover:border-slate-600 dark:focus:border-teal-400 dark:focus:ring-teal-400/10";

const LABEL =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400";

// ============ COUNTRY PHONE INPUT ============
const CountryPhoneInput = ({
  countryCode,
  phone,
  onCountryChange,
  onPhoneChange,
}: {
  countryCode: string;
  phone: string;
  onCountryChange: (code: string) => void;
  onPhoneChange: (val: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRY_CODES;
    return COUNTRY_CODES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) || c.code.replace("+", "").includes(q),
    );
  }, [query]);
  const selected = useMemo(
    () =>
      COUNTRY_CODES.find((c) => c.code === countryCode) ||
      COUNTRY_CODES.find((c) => c.code === "+91"),
    [countryCode],
  );

  const localNumber = useMemo(() => {
    if (!phone) return "";
    if (phone.startsWith(countryCode)) return phone.slice(countryCode.length);
    return phone.replace(/^\+\d+/, "");
  }, [phone, countryCode]);

  return (
    <div className="relative w-full">
      <div
        className={`flex items-stretch overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all focus-within:border-teal-500 focus-within:ring-4 focus-within:ring-teal-500/10 dark:border-slate-700 dark:bg-slate-800/60 dark:focus-within:border-teal-400 dark:focus-within:ring-teal-400/10`}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 border-r border-slate-200 bg-slate-50 px-2.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <span className="text-base leading-none">
            {selected?.flag || "🏳️"}
          </span>
          <span className="tabular-nums">{selected?.code || "+91"}</span>
          <svg
            className="h-3 w-3 text-slate-500"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.25 8.29a.75.75 0 01-.02-1.08z" />
          </svg>
        </button>
        <input
          type="tel"
          value={localNumber}
          onChange={(e) => {
            const sanitized = e.target.value.replace(/[^\d]/g, "");
            onPhoneChange(sanitized);
          }}
          inputMode="numeric"
          className="flex-1 bg-transparent px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
          placeholder="Enter phone number"
        />
      </div>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-2 max-h-64 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/40">
            <div className="border-b border-slate-100 p-2 dark:border-slate-800">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search country or code"
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
            </div>
            <ul role="listbox" className="max-h-52 overflow-y-auto py-1">
              {options.map((c, idx) => (
                <li
                  key={`${c.code}-${c.name}-${idx}`}
                  role="option"
                  onClick={() => {
                    onCountryChange(c.code);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={`flex cursor-pointer items-center gap-2.5 px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-800 ${
                    c.code === selected?.code
                      ? "bg-teal-50 font-semibold text-teal-700 dark:bg-teal-500/10 dark:text-teal-300"
                      : "text-slate-700 dark:text-slate-300"
                  }`}
                >
                  <span className="text-base leading-none">{c.flag}</span>
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="tabular-nums text-slate-500 dark:text-slate-400">
                    {c.code}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
};

// ============ SECTION TITLE ============
function SectionTitle({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-3 flex items-start gap-2">
      <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-200 dark:bg-teal-500/10 dark:text-teal-300 dark:ring-teal-500/20">
        {icon}
      </span>
      <div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
          {title}
        </h3>
        {subtitle && (
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

// ============ PROPS ============
interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  token: string;
  canCreate?: boolean;
}

// ============ MAIN COMPONENT ============
export default function CreateLeadModal({
  isOpen,
  onClose,
  onCreated,
  token,
  canCreate: propCanCreate,
}: Props) {
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    countryCode: "+91",
    email: "",
    gender: "Male",
    age: "",
    treatments: [] as Array<{ treatment: string; subTreatment: string | null }>,
    source: "Instagram",
    offerTag: "",
    status: "New",
    notes: [] as Array<{ text: string }>,
    customSource: "",
    customStatus: "",
    followUps: [] as Array<{ date: Date }>,
    assignedTo: [] as string[],
  });

  const [treatments, setTreatments] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [activeOffers, setActiveOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [noteType, setNoteType] = useState("");
  const [customNote, setCustomNote] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [internalCanCreate, setInternalCanCreate] = useState(false);
  const canCreate =
    propCanCreate !== undefined ? propCanCreate : internalCanCreate;
  const [selectedSegment, setSelectedSegment] = useState<OptionType | null>(
    null,
  );

  useEffect(() => {
    if (!isOpen) return;

    const isTrue = (value: any) => {
      if (value === true) return true;
      if (value === "true") return true;
      if (String(value).toLowerCase() === "true") return true;
      return false;
    };

    const fetchData = async () => {
      try {
        const [permissionsRes, treatmentsRes, agentsRes, offersRes] =
          await Promise.all([
            axios.get("/api/clinic/permissions", {
              headers: { Authorization: `Bearer ${token}` },
            }),
            axios.get("/api/lead-ms/get-clinic-treatment", {
              headers: { Authorization: `Bearer ${token}` },
            }),
            axios.get("/api/lead-ms/assign-lead", {
              headers: { Authorization: `Bearer ${token}` },
            }),
            axios.get("/api/lead-ms/get-create-offer", {
              headers: { Authorization: `Bearer ${token}` },
            }),
          ]);

        const permissionsData = permissionsRes.data;
        if (permissionsData.success && permissionsData.data) {
          const modulePermission = permissionsData.data.permissions?.find(
            (p: any) => {
              if (!p?.module) return false;
              const moduleKey = p.module || "";
              const normalizedModule = moduleKey.replace(
                /^(admin|clinic|doctor|agent)_/,
                "",
              );
              return (
                normalizedModule === "lead" ||
                normalizedModule === "create_lead" ||
                moduleKey === "clinic_lead" ||
                moduleKey === "clinic_create_lead" ||
                moduleKey === "create_lead" ||
                moduleKey === "lead"
              );
            },
          );
          if (modulePermission) {
            const actions = modulePermission.actions || {};
            const createLeadSubModule = modulePermission.subModules?.find(
              (sm: any) =>
                sm.name === "Create Lead" ||
                sm.name?.toLowerCase() === "create lead",
            );
            const moduleAll = isTrue(actions.all);
            const moduleCreate = isTrue(actions.create);
            const createLeadAll = isTrue(createLeadSubModule?.actions?.all);
            const createLeadCreate = isTrue(
              createLeadSubModule?.actions?.create,
            );
            setInternalCanCreate(
              moduleAll || moduleCreate || createLeadAll || createLeadCreate,
            );
          } else {
            setInternalCanCreate(false);
          }
        } else {
          setInternalCanCreate(false);
        }

        setTreatments(
          Array.isArray(treatmentsRes.data?.treatments)
            ? treatmentsRes.data.treatments
            : [],
        );
        setAgents(agentsRes.data?.users || []);
        const list = Array.isArray(offersRes.data?.offers)
          ? offersRes.data.offers
          : [];
        setActiveOffers(list.filter((o: any) => o.status === "active"));
      } catch (err) {
        console.error("Error fetching data:", err);
        setInternalCanCreate(false);
      }
    };

    fetchData();
  }, [isOpen, token]);

  useEffect(() => {
    if (!isOpen) {
      setFormData({
        name: "",
        email: "",
        phone: "",
        countryCode: "+91",
        gender: "Male",
        age: "",
        treatments: [],
        source: "Instagram",
        offerTag: "",
        status: "New",
        notes: [],
        customSource: "",
        customStatus: "",
        followUps: [],
        assignedTo: [],
      });
      setNoteType("");
      setCustomNote("");
      setFollowUpDate("");
      setSelectedSegment(null);
    }
  }, [isOpen]);

  // Escape + body lock
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    if (e.target.name === "phone") {
      const value = e.target.value.replace(/\D/g, "");
      setFormData({ ...formData, phone: value });
    } else {
      setFormData({ ...formData, [e.target.name]: e.target.value });
    }
  };

  const isValidEmail = (email: string) => {
    if (!email) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleTreatmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value.includes("::")) {
      const [mainName, subName] = value.split("::");
      setFormData((prev) => {
        const exists = prev.treatments.some(
          (t) => t.treatment === mainName && t.subTreatment === subName,
        );
        return {
          ...prev,
          treatments: exists
            ? prev.treatments.filter(
                (t) =>
                  !(t.treatment === mainName && t.subTreatment === subName),
              )
            : [
                ...prev.treatments,
                { treatment: mainName, subTreatment: subName },
              ],
        };
      });
      return;
    }
    const mainName = value;
    setFormData((prev) => {
      const exists = prev.treatments.some(
        (t) => t.treatment === mainName && !t.subTreatment,
      );
      return {
        ...prev,
        treatments: exists
          ? prev.treatments.filter(
              (t) => !(t.treatment === mainName && !t.subTreatment),
            )
          : [...prev.treatments, { treatment: mainName, subTreatment: null }],
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canCreate) {
      alert("You do not have permission to create leads");
      return;
    }

    const digitsOnly = formData.phone.replace(/\D/g, "");
    if (!digitsOnly || digitsOnly.length < 5) {
      alert("Please enter a valid phone number");
      return;
    }

    if (formData.email && !isValidEmail(formData.email.trim())) {
      alert("Please enter a valid email address");
      return;
    }

    setLoading(true);
    try {
      const selectedNote = noteType === "Custom" ? customNote.trim() : noteType;
      const notesToSend = selectedNote ? [{ text: selectedNote }] : [];
      const followUpsToSend = followUpDate
        ? [...formData.followUps, { date: followUpDate, addedBy: null }]
        : formData.followUps;

      await axios.post(
        "/api/lead-ms/create-lead",
        {
          ...formData,
          phone: `${formData.countryCode}${formData.phone.replace(/^0+/, "")}`,
          notes: notesToSend,
          followUps: followUpsToSend,
          mode: "manual",
          segmentId: selectedSegment?.value,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      alert("Lead added successfully!");
      onCreated();
      onClose();
    } catch (err) {
      console.error(err);
      const errorMessage =
        (err as any)?.response?.data?.message || "Error adding lead";
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const phoneValid = formData.phone.replace(/\D/g, "").length >= 5;
  const emailValid = !formData.email || isValidEmail(formData.email);

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-md sm:p-4"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label="Create lead"
      >
        <div
          className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-2xl shadow-slate-900/25 dark:border-slate-700 dark:bg-slate-950 dark:shadow-black/60"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top gradient bar */}
          <div className="h-1 flex-shrink-0 bg-gradient-to-r from-teal-400 via-teal-500 to-emerald-500" />

          {/* ============ HEADER ============ */}
          <div className="relative flex-shrink-0 overflow-hidden border-b border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-teal-300/25 blur-3xl dark:bg-teal-500/15" />
            <div className="relative flex items-start gap-4">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-teal-700 text-white shadow-lg shadow-teal-700/25 ring-4 ring-white dark:ring-slate-900">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
                  Create New Lead
                </h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Fill in the details below to add a new lead to your pipeline
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* ============ BODY ============ */}
          <form
            onSubmit={handleSubmit}
            className="flex min-h-0 flex-1 flex-col"
            id="create-lead-form"
          >
            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              {/* ---------- BASIC INFORMATION ---------- */}
              <div className={CARD}>
                <SectionTitle
                  icon={<User className="h-3.5 w-3.5" />}
                  title="Basic Information"
                  subtitle="Name, contact and demographics"
                />

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div>
                    <label className={LABEL}>
                      Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      className={CONTROL}
                      placeholder="Enter full name"
                      required
                    />
                  </div>
                  <div>
                    <label className={LABEL}>
                      Phone <span className="text-rose-500">*</span>
                    </label>
                    <CountryPhoneInput
                      countryCode={formData.countryCode}
                      phone={formData.phone}
                      onCountryChange={(code) => {
                        setFormData((prev) => {
                          let localNum = prev.phone;
                          if (localNum.startsWith(prev.countryCode)) {
                            localNum = localNum.slice(prev.countryCode.length);
                          } else {
                            localNum = localNum.replace(/^\+\d+/, "");
                          }
                          return {
                            ...prev,
                            countryCode: code,
                            phone: localNum,
                          };
                        });
                      }}
                      onPhoneChange={(val) => {
                        const sanitized = val.replace(/[^\d]/g, "");
                        setFormData((prev) => ({ ...prev, phone: sanitized }));
                      }}
                    />
                    {formData.phone.length > 0 && !phoneValid && (
                      <p className="mt-1 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                        Phone number seems too short
                      </p>
                    )}
                    {phoneValid && (
                      <p className="mt-1 flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-3 w-3" />
                        Valid phone number
                      </p>
                    )}
                  </div>
                  <div>
                    <label className={LABEL}>Email</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      className={CONTROL}
                      placeholder="Enter email address"
                    />
                    {formData.email.length > 0 && !emailValid && (
                      <p className="mt-1 text-[10px] font-medium text-rose-500">
                        Invalid email format
                      </p>
                    )}
                    {formData.email.length > 0 && emailValid && (
                      <p className="mt-1 flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-3 w-3" />
                        Valid email
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className={LABEL}>
                      <Cake className="mr-1 inline h-3 w-3" />
                      Gender
                    </label>
                    <select
                      name="gender"
                      value={formData.gender}
                      onChange={handleChange}
                      className={CONTROL}
                    >
                      <option>Male</option>
                      <option>Female</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <div>
                    <label className={LABEL}>Age</label>
                    <input
                      type="number"
                      name="age"
                      value={formData.age}
                      onChange={handleChange}
                      className={CONTROL}
                      placeholder="e.g. 32"
                      min={0}
                      max={150}
                    />
                  </div>
                </div>
              </div>

              {/* ---------- TREATMENTS ---------- */}
              <div className={CARD}>
                <SectionTitle
                  icon={<Stethoscope className="h-3.5 w-3.5" />}
                  title="Treatments"
                  subtitle={
                    formData.treatments.length > 0
                      ? `${formData.treatments.length} selected`
                      : "Select treatments of interest"
                  }
                />
                <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 dark:border-slate-700 dark:bg-slate-800/30">
                  {treatments.length === 0 ? (
                    <p className="py-3 text-center text-xs text-slate-400 dark:text-slate-500">
                      No treatments available
                    </p>
                  ) : (
                    treatments.map((t: any, i: number) => (
                      <div
                        key={i}
                        className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm dark:border-slate-700 dark:bg-slate-800/60"
                      >
                        <label className="flex cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            value={t.mainTreatment}
                            checked={formData.treatments.some(
                              (tr) =>
                                tr.treatment === t.mainTreatment &&
                                !tr.subTreatment,
                            )}
                            onChange={handleTreatmentChange}
                            className="h-3.5 w-3.5 cursor-pointer rounded border-slate-300 accent-teal-600 dark:border-slate-600"
                          />
                          <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                            {t.mainTreatment}
                          </span>
                        </label>
                        {t.subTreatments?.length > 0 && (
                          <div className="ml-5 mt-1.5 space-y-1">
                            {t.subTreatments.map((sub: any, j: number) => {
                              const val = `${t.mainTreatment}::${sub.name}`;
                              return (
                                <label
                                  key={j}
                                  className="flex cursor-pointer items-center gap-2"
                                >
                                  <input
                                    type="checkbox"
                                    value={val}
                                    checked={formData.treatments.some(
                                      (tr) =>
                                        tr.treatment === t.mainTreatment &&
                                        tr.subTreatment === sub.name,
                                    )}
                                    onChange={handleTreatmentChange}
                                    className="h-3 w-3 cursor-pointer rounded border-slate-300 accent-teal-600 dark:border-slate-600"
                                  />
                                  <span className="text-[11px] text-slate-600 dark:text-slate-400">
                                    {sub.name}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* ---------- LEAD DETAILS ---------- */}
              <div className={CARD}>
                <SectionTitle
                  icon={<Globe className="h-3.5 w-3.5" />}
                  title="Lead Details"
                  subtitle="Source, status and offer"
                />

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className={LABEL}>Source</label>
                    <select
                      name="source"
                      value={formData.source}
                      onChange={handleChange}
                      className={CONTROL}
                    >
                      <option value="Instagram">Instagram</option>
                      <option value="Facebook">Facebook</option>
                      <option value="Google">Google</option>
                      <option value="WhatsApp">WhatsApp</option>
                      <option value="Walk-in">Walk-in</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  {formData.source === "Other" && (
                    <div>
                      <label className={LABEL}>Custom Source</label>
                      <input
                        type="text"
                        name="customSource"
                        value={formData.customSource}
                        onChange={handleChange}
                        className={CONTROL}
                        placeholder="Enter source"
                      />
                    </div>
                  )}
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className={LABEL}>Status</label>
                    <select
                      name="status"
                      value={formData.status}
                      onChange={handleChange}
                      className={CONTROL}
                    >
                      <option value="New">New</option>
                      <option value="Contacted">Contacted</option>
                      <option value="Booked">Booked</option>
                      <option value="Visited">Visited</option>
                      <option value="Follow-up">Follow-up</option>
                      <option value="Not Interested">Not Interested</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  {formData.status === "Other" && (
                    <div>
                      <label className={LABEL}>Custom Status</label>
                      <input
                        type="text"
                        name="customStatus"
                        value={formData.customStatus}
                        onChange={handleChange}
                        className={CONTROL}
                        placeholder="Enter status"
                      />
                    </div>
                  )}
                </div>

                <div className="mt-3">
                  <label className={LABEL}>
                    <Tag className="mr-1 inline h-3 w-3" />
                    Offer Tag
                  </label>
                  <select
                    name="offerTag"
                    value={formData.offerTag}
                    onChange={handleChange}
                    className={CONTROL}
                  >
                    <option value="">No offer</option>
                    {activeOffers.map((o) => (
                      <option key={o._id} value={o.title}>
                        {o.title} —{" "}
                        {o.type === "percentage"
                          ? `${o.value}%`
                          : `₹${o.value}`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* ---------- ADDITIONAL INFO ---------- */}
              <div className={CARD}>
                <SectionTitle
                  icon={<StickyNote className="h-3.5 w-3.5" />}
                  title="Additional Information"
                  subtitle="Notes, follow-up and assignment"
                />

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className={LABEL}>Note</label>
                    <select
                      value={noteType}
                      onChange={(e) => setNoteType(e.target.value)}
                      className={CONTROL}
                    >
                      <option value="">Select Note</option>
                      <option value="Interested">Interested</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Custom">Custom</option>
                    </select>
                  </div>
                  {noteType === "Custom" && (
                    <div>
                      <label className={LABEL}>Custom Note</label>
                      <input
                        type="text"
                        value={customNote}
                        onChange={(e) => setCustomNote(e.target.value)}
                        className={CONTROL}
                        placeholder="Type a note"
                      />
                    </div>
                  )}
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className={LABEL}>
                      <CalendarClock className="mr-1 inline h-3 w-3" />
                      Follow-up Date
                    </label>
                    <input
                      type="datetime-local"
                      value={followUpDate}
                      onChange={(e) => setFollowUpDate(e.target.value)}
                      className={`${CONTROL} dark:[color-scheme:dark]`}
                    />
                  </div>
                  <div>
                    <label className={LABEL}>
                      <Users className="mr-1 inline h-3 w-3" />
                      Assign To
                    </label>
                    <select
                      value={formData.assignedTo[0] || ""}
                      onChange={(e) => {
                        const selectedId = e.target.value;
                        setFormData((prev) => ({
                          ...prev,
                          assignedTo: selectedId ? [selectedId] : [],
                        }));
                      }}
                      className={CONTROL}
                    >
                      <option value="">Select agent</option>
                      {agents.map((agent) => (
                        <option key={agent._id} value={agent._id}>
                          {agent.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-3">
                  <label className={LABEL}>
                    <Layers className="mr-1 inline h-3 w-3" />
                    Segment
                  </label>
                  <CustomAsyncSelect
                    label=""
                    name="chooseSegment"
                    loadOptions={(inputValue) =>
                      loadSegmentOptions(inputValue, token)
                    }
                    value={selectedSegment}
                    onChange={(value) => setSelectedSegment(value as any)}
                    placeholder="Select a segment..."
                  />
                </div>
              </div>
            </div>

            {/* ============ FOOTER ============ */}
            <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white px-5 py-3.5 dark:border-slate-800 dark:bg-slate-900">
              <p className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                <span className="text-rose-500">*</span>
                Required fields
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-500/15 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !canCreate}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-b from-teal-500 to-teal-700 px-5 py-2 text-xs font-semibold text-white shadow-md shadow-teal-700/25 ring-1 ring-inset ring-white/10 transition-all hover:from-teal-500 hover:to-teal-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                  title={
                    !canCreate
                      ? "You do not have permission to create leads"
                      : ""
                  }
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5" />
                      Create Lead
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}
