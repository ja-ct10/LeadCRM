import React, { useState, useEffect } from "react";
import { Contact, Organization } from "../../store/types";
import { SlidingDrawer } from "../../components/SlidingDrawer";
import { useData } from "../../store/DataContext";
import { useAuth } from "../../store/AuthContext";
import { toast } from "sonner";
import {
  Building,
  Mail,
  Phone,
  MapPin,
  Tag,
  Calendar,
  AlertCircle,
  ChevronDown,
} from "lucide-react";
import { OrganizationSelector } from "./OrganizationCombobox";
import {
  COUNTRY_CODES,
  getPlaceholderForCountryCode,
} from "../../lib/countries";

const PRODUCTS = [
  "CCTV",
  "Biometrics",
  "Door Access",
  "Door access/Biometrics",
  "Network/Structured Cabling",
  "FDAS",
  "PABX",
  "PC/Laptop/Server Assembly",
  "Software/Web Development",
  "Others",
];

interface ContactFormProps {
  initialData?: Contact;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<Contact>) => void;
}

interface AddContactFormProps {
  initialData?: Contact;
  onSave: (data: Partial<Contact>) => void;
  onCancel: () => void;
}

export function AddContactForm({
  initialData,
  onSave,
  onCancel,
}: AddContactFormProps) {
  const { organizations, addOrganization, updateOrganization, addTask, users } =
    useData();
  const { user } = useAuth();
  // Use a ref for organizations so reading it inside useEffect
  // doesn't add it as a reactive dependency (avoids infinite loop
  // caused by DataContext returning a new array reference each render).
  const organizationsRef = React.useRef(organizations);
  organizationsRef.current = organizations;
  const [scheduleFollowUp, setScheduleFollowUp] = useState(false);
  const [followUpDate, setFollowUpDate] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [customProduct, setCustomProduct] = useState<string>("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState<Partial<Contact>>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    customerType: "Individual",
    jobTitle: "",
    organizationId: "",
    status: "Cold",
    leadSource: "Organic",
    companyName: "",
    businessType: "",
    companySize: "",
    orgWebsite: "",
    taxId: "",
    priority: "Medium",
  });

  const validateField = (fieldName: string, value: string) => {
    let errorMessage = "";
    const isIndividual = formData.customerType === "Individual";
    if (fieldName === "firstName" && isIndividual && !value.trim()) {
      errorMessage = "First Name is required";
    } else if (fieldName === "lastName" && isIndividual && !value.trim()) {
      errorMessage = "Last Name is required";
    } else if (
      fieldName === "followUpDate" &&
      scheduleFollowUp &&
      !value.trim()
    ) {
      errorMessage = "Follow-up date is required";
    }

    setErrors((prev) => {
      const next = { ...prev };
      if (errorMessage) {
        next[fieldName] = errorMessage;
      } else {
        delete next[fieldName];
      }
      return next;
    });
  };

  useEffect(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setFollowUpDate(tomorrow.toISOString().split("T")[0]);
  }, []);

  useEffect(() => {
    if (initialData) {
      // Use ref to avoid organizations array reference triggering infinite re-runs
      const org = organizationsRef.current.find(
        (o) => o.id === initialData.organizationId,
      );

      const prod = initialData.productInterest || "";
      let sp = "";
      let cp = "";
      if (prod) {
        const matched = PRODUCTS.find(
          (p) => p.toLowerCase() === prod.toLowerCase(),
        );
        if (matched) {
          sp = matched;
        } else {
          sp = "Others";
          cp = prod;
        }
      }
      setSelectedProduct(sp);
      setCustomProduct(cp);      setFormData({
        ...initialData,
        customerType:
          initialData.customerType ||
          (initialData.organizationId || initialData.companyName
            ? "Organization"
            : "Individual"),
        companyName: org ? org.name : initialData.companyName || "",
        businessType: org ? org.industry : "",
        companySize: org ? org.size : "",
        orgWebsite: org ? org.website : "",
        taxId: org ? org.taxId : "",
        priority: initialData.priority || "Medium",
      });
    } else {
      setSelectedProduct("");
      setCustomProduct("");
      setFormData({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        customerType: "Individual",
        jobTitle: "",
        organizationId: "",
        status: "Cold",
        leadSource: "Organic",
        companyName: "",
        businessType: "",
        companySize: "",
        orgWebsite: "",
        taxId: "",
        priority: "Medium",
      });
    }
  }, [initialData, initialData?.organizationId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Perform full field validation
    const newErrors: Record<string, string> = {};
    const isOrg = formData.customerType === "Organization";

    if (!isOrg) {
      if (!formData.firstName?.trim()) {
        newErrors.firstName = "Full Name is required";
      }
    }

    // Server-side-like validation for Organization
    if (isOrg) {
      if (!formData.organizationId && !formData.companyName?.trim()) {
        newErrors.companyName =
          "Organization selection or name is required for Organization customers";
        toast.error("An organization must be selected or created.");
      }
    }

    if (scheduleFollowUp && !followUpDate) {
      newErrors.followUpDate =
        "Follow-up date is required when scheduling a follow-up";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error("Please resolve missing mandatory fields before submitting");
      return;
    }

    const finalProduct =
      selectedProduct === "Others" ? customProduct : selectedProduct;

    let finalOrgId = formData.organizationId;

    if (isOrg) {
      if (formData.organizationId === "NEW_TEMP") {
        const createdId = addOrganization({
          name: formData.companyName || "",
          industry: formData.businessType || "",
          size: formData.companySize || "",
          website: formData.orgWebsite || "",
          taxId: formData.taxId || "",
        });
        if (createdId) {
          finalOrgId = createdId;
          toast.success(
            `Organization "${formData.companyName}" successfully created`,
          );
        } else {
          toast.error("Failed to create organization record");
          return;
        }
      } else if (formData.organizationId) {
        // Sync any edited details of the existing organization back to store
        updateOrganization(formData.organizationId, {
          industry: formData.businessType || "",
          size: formData.companySize || "",
          website: formData.orgWebsite || "",
          taxId: formData.taxId || "",
        });
      }
    } else {
      finalOrgId = "";
    }

    const contactPerson =
      `${formData.firstName || ""} ${formData.lastName || ""}`.trim();
    const updated = {
      ...formData,
      customerType: formData.customerType || "Individual",
      organizationId: isOrg ? finalOrgId : "",
      companyName: isOrg ? formData.companyName || "" : "",
      jobTitle: isOrg ? formData.jobTitle || "" : "",
      businessType: isOrg ? formData.businessType : "",
      companySize: isOrg ? formData.companySize : "",
      orgWebsite: isOrg ? formData.orgWebsite : "",
      taxId: isOrg ? formData.taxId : "",
      contactPerson,
      productInterest: finalProduct,
    };

    if (scheduleFollowUp && followUpDate) {
      // Default priority for follow-up
      const taskPriority = "Medium";
      addTask({
        title: `Follow up with ${contactPerson}`,
        description: `Follow-up reminder set during contact form submission for ${contactPerson}.`,
        status: "pending",
        dueDate: followUpDate,
        assignedUserId: user?.id || "system",
        priority: taskPriority as "Low" | "Medium" | "High",
      });
      toast.success(`Follow-up task scheduled for ${followUpDate}`);
    }

    onSave(updated);
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-8">
      {/* Global Type Choice */}
      <div className="space-y-2 p-4 bg-slate-50 dark:bg-slate-800/20 rounded-xl border border-gray-200 dark:border-white/10 mb-8">
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
          Customer Type
        </label>
        <div className="flex bg-slate-200/60 dark:bg-slate-900/50 p-1 rounded-lg w-full max-w-sm">
          <button
            type="button"
            onClick={() =>
              setFormData({
                ...formData,
                customerType: "Individual",
                companyName: "",
              })
            }
            className={`flex-1 flex justify-center items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold tracking-wide transition-all ${
              formData.customerType !== "Organization"
                ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            🏡 Individual
          </button>
          <button
            type="button"
            onClick={() =>
              setFormData({ ...formData, customerType: "Organization" })
            }
            className={`flex-1 flex justify-center items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold tracking-wide transition-all ${
              formData.customerType === "Organization"
                ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            🏢 Organization
          </button>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
          {formData.customerType === "Organization"
            ? "Track the corporate entity. A primary contact person will be linked below."
            : "A personal account for homeowners or individual clients."}
        </p>
      </div>

      {formData.customerType === "Organization" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wider mb-2">
            1. Organization Details
          </h3>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Search or Add Organization *
            </label>
            <OrganizationSelector
              organizations={organizations}
              value={formData.organizationId || ""}
              companyName={formData.companyName}
              onChange={(orgId, orgName) => {
                const org = organizations.find((o) => o.id === orgId);
                if (org) {
                  setFormData({
                    ...formData,
                    organizationId: orgId,
                    companyName: orgName,
                    businessType: org.industry || "",
                    companySize: org.size || "",
                    orgWebsite: org.website || "",
                    taxId: org.taxId || "",
                  });
                  toast.success(
                    `Loaded details from organization "${orgName}"`,
                  );
                } else {
                  setFormData({
                    ...formData,
                    organizationId: "",
                    companyName: "",
                    businessType: "",
                    companySize: "",
                    orgWebsite: "",
                    taxId: "",
                  });
                }
              }}
              onCreateNew={(name) => {
                setFormData({
                  ...formData,
                  organizationId: "NEW_TEMP",
                  companyName: name,
                  businessType: "",
                  companySize: "",
                  orgWebsite: "",
                  taxId: "",
                });
                toast.success(
                  `Positioned "${name}" for creation. Enter details below.`,
                );
              }}
            />
          </div>
        </div>
      )}

      {/* Person Basics (or Company Contacts) */}
      <div
        className={`space-y-4 ${formData.customerType === "Organization" ? "pt-4 border-t border-gray-100 dark:border-white/5" : ""}`}
      >
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wider mb-2">
          {formData.customerType === "Organization"
            ? "2. Organization Contact Person"
            : "1. Basics"}
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1 flex items-center justify-between">
              <span>
                {formData.customerType === "Organization"
                  ? "First Name"
                  : "First Name *"}
              </span>
              {errors.firstName && (
                <span className="text-red-500 text-[10px] lowercase font-normal">
                  {errors.firstName}
                </span>
              )}
            </label>
            <input
              required={formData.customerType !== "Organization"}
              className={`w-full bg-slate-50 dark:bg-slate-800/50 border rounded-lg px-3 py-2 text-sm outline-none transition-all focus:ring-2 ${
                errors.firstName
                  ? "border-red-500 focus:ring-red-500/20"
                  : "border-gray-200 dark:border-white/10 focus:ring-blue-500"
              }`}
              value={formData.firstName || ""}
              onChange={(e) => {
                const val = e.target.value;
                setFormData({ ...formData, firstName: val });
                validateField("firstName", val);
              }}
              onBlur={(e) => validateField("firstName", e.target.value)}
            />
            {errors.firstName && (
              <p className="text-[11px] text-red-500 mt-1 flex items-center gap-1">
                <AlertCircle size={12} className="text-red-500 animate-pulse" />
                <span>First name cannot be empty.</span>
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1 flex items-center justify-between">
              <span>
                {formData.customerType === "Organization"
                  ? "Last Name"
                  : "Last Name *"}
              </span>
              {errors.lastName && (
                <span className="text-red-500 text-[10px] lowercase font-normal">
                  {errors.lastName}
                </span>
              )}
            </label>
            <input
              required={formData.customerType !== "Organization"}
              className={`w-full bg-slate-50 dark:bg-slate-800/50 border rounded-lg px-3 py-2 text-sm outline-none transition-all focus:ring-2 ${
                errors.lastName
                  ? "border-red-500 focus:ring-red-500/20"
                  : "border-gray-200 dark:border-white/10 focus:ring-blue-500"
              }`}
              value={formData.lastName || ""}
              onChange={(e) => {
                const val = e.target.value;
                setFormData({ ...formData, lastName: val });
                validateField("lastName", val);
              }}
              onBlur={(e) => validateField("lastName", e.target.value)}
            />
            {errors.lastName && (
              <p className="text-[11px] text-red-500 mt-1 flex items-center gap-1">
                <AlertCircle size={12} className="text-red-500 animate-pulse" />
                <span>Last name cannot be empty.</span>
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              {formData.customerType === "Organization"
                ? "Company Email"
                : "Email"}
            </label>
            <div className="relative">
              <Mail
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={14}
              />
              <input
                type="email"
                className="w-full pl-9 bg-slate-50 dark:bg-slate-800/50 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                value={formData.email || ""}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              {formData.customerType === "Organization"
                ? "Company Phone"
                : "Phone"}
            </label>
            <div className="flex bg-slate-50 dark:bg-slate-800/50 border border-gray-200 dark:border-white/10 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 overflow-hidden text-sm">
              <div className="relative border-r border-gray-200 dark:border-white/10 bg-slate-100 dark:bg-slate-800 flex items-center shrink-0 w-[95px]">
                <select
                  value={(function () {
                    const p = formData.phone || "";
                    const match = COUNTRY_CODES.find((c) =>
                      p.startsWith(c.code),
                    );
                    return match ? match.code : "+63";
                  })()}
                  onChange={(e) => {
                    const code = e.target.value;
                    const current = formData.phone || "";
                    let cleanPhone = current;
                    COUNTRY_CODES.forEach((c) => {
                      if (current.startsWith(c.code + " "))
                        cleanPhone = current.substring(c.code.length + 1);
                      else if (current.startsWith(c.code))
                        cleanPhone = current.substring(c.code.length);
                    });
                    setFormData({
                      ...formData,
                      phone: `${code} ${cleanPhone}`.trim(),
                    });
                  }}
                  className="w-full h-full py-2 pl-2 pr-6 bg-transparent text-slate-900 dark:text-slate-100 border-none outline-none appearance-none cursor-pointer [&>option]:text-slate-900 [&>option]:bg-white dark:[&>option]:text-white dark:[&>option]:bg-slate-800"
                >
                  <option value="" disabled>
                    Code
                  </option>
                  {COUNTRY_CODES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={14}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500"
                />
              </div>
              <input
                type="tel"
                placeholder={(function () {
                  const p = formData.phone || "";
                  const match = COUNTRY_CODES.find((c) => p.startsWith(c.code));
                  return getPlaceholderForCountryCode(
                    match ? match.code : "+63",
                  );
                })()}
                className="flex-1 px-3 py-2 bg-transparent border-none outline-none focus:ring-0 placeholder:text-slate-400 dark:placeholder:text-slate-500 min-w-0"
                value={(function () {
                  const p = formData.phone || "";
                  let cleanPhone = p;
                  COUNTRY_CODES.forEach((c) => {
                    if (p.startsWith(c.code + " "))
                      cleanPhone = p.substring(c.code.length + 1);
                    else if (p.startsWith(c.code))
                      cleanPhone = p.substring(c.code.length);
                  });
                  return cleanPhone;
                })()}
                onChange={(e) => {
                  const p = formData.phone || "";
                  let code = "+63";
                  const match = COUNTRY_CODES.find((c) => p.startsWith(c.code));
                  if (match) code = match.code;

                  setFormData({
                    ...formData,
                    phone: `${code} ${e.target.value}`.trim(),
                  });
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Section 3: Status Tracker */}
      <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-white/5">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wider mb-2">
          {formData.customerType === "Organization" ? "3." : "2."} Status
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Status
            </label>
            <div className="relative">
              <select
                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-gray-200 dark:border-white/10 rounded-lg pl-3 pr-8 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none appearance-none text-slate-900 dark:text-slate-100 cursor-pointer [&>option]:bg-white dark:[&>option]:bg-slate-900 [&>option]:text-slate-900 dark:[&>option]:text-slate-100"
                value={formData.status || "Cold"}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value as any })
                }
              >
                <option value="Hot">Hot</option>
                <option value="Warm">Warm</option>
                <option value="Cold">Cold</option>
                <option value="Closed">Closed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
              <ChevronDown
                size={14}
                className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-450 dark:text-slate-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Product Interest
            </label>
            <div className="space-y-2">
              <div className="relative">
                <select
                  className="w-full bg-slate-50 dark:bg-slate-800/50 border border-gray-200 dark:border-white/10 rounded-lg pl-3 pr-8 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none appearance-none text-slate-900 dark:text-slate-100 cursor-pointer [&>option]:bg-white dark:[&>option]:bg-slate-900 [&>option]:text-slate-900 dark:[&>option]:text-slate-100"
                  value={selectedProduct}
                  onChange={(e) => setSelectedProduct(e.target.value)}
                >
                  <option value="">Select a product...</option>
                  {PRODUCTS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={14}
                  className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-450 dark:text-slate-500"
                />
              </div>
              {selectedProduct === "Others" && (
                <input
                  type="text"
                  placeholder="Please specify other product/service"
                  className="w-full bg-slate-50 dark:bg-slate-800/50 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-slate-950 dark:text-slate-50"
                  value={customProduct}
                  onChange={(e) => setCustomProduct(e.target.value)}
                  autoFocus
                />
              )}
            </div>
          </div>
        </div>

        {/* Schedule a Follow-up Toggle Card */}
        <div className="pt-4 border-t border-gray-100 dark:border-white/5 space-y-4">
          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/20 border border-gray-200 dark:border-white/10 rounded-xl">
            <div>
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                Schedule a follow-up
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Instantly set a reminder task on your Task Board.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={scheduleFollowUp}
                onChange={() => {
                  const nextVal = !scheduleFollowUp;
                  setScheduleFollowUp(nextVal);
                  if (!nextVal) {
                    setErrors((prev) => {
                      const next = { ...prev };
                      delete next.followUpDate;
                      return next;
                    });
                  } else {
                    if (!followUpDate) {
                      setErrors((prev) => ({
                        ...prev,
                        followUpDate: "Follow-up date is required",
                      }));
                    }
                  }
                }}
              />
              <div className="w-11 h-6 bg-slate-300 dark:bg-slate-700/60 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          {scheduleFollowUp && (
            <div className="p-4 bg-slate-50/50 dark:bg-slate-800/10 border border-gray-200 dark:border-white/5 rounded-xl space-y-2 animate-in fade-in duration-200">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Calendar size={14} className="text-blue-500" />
                  Follow-up Due Date *
                </span>
                {errors.followUpDate && (
                  <span className="text-red-500 text-[10px] lowercase font-normal">
                    {errors.followUpDate}
                  </span>
                )}
              </label>
              <input
                type="date"
                className={`w-full bg-white dark:bg-slate-900 border rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 transition-all ${
                  errors.followUpDate
                    ? "border-red-500 focus:ring-red-500/20"
                    : "border-gray-200 dark:border-white/10 focus:ring-blue-500"
                }`}
                value={followUpDate}
                onChange={(e) => {
                  const val = e.target.value;
                  setFollowUpDate(val);
                  validateField("followUpDate", val);
                }}
                onBlur={(e) => validateField("followUpDate", e.target.value)}
                required={scheduleFollowUp}
              />
              {errors.followUpDate && (
                <p className="text-[11px] text-red-500 mt-1 flex items-center gap-1">
                  <AlertCircle
                    size={12}
                    className="text-red-500 animate-pulse"
                  />
                  <span>A follow-up date is required to schedule a task.</span>
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Section 4: Additional Information */}
      <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-white/5">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wider mb-2">
          {formData.customerType === "Organization" ? "4." : "3."} Additional
          Information
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Lead Source
            </label>
            <div className="relative">
              <select
                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-gray-200 dark:border-white/10 rounded-lg pl-3 pr-8 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none appearance-none cursor-pointer text-slate-900 dark:text-slate-100 [&>option]:bg-white dark:[&>option]:bg-slate-900 [&>option]:text-slate-900 dark:[&>option]:text-slate-100"
                value={formData.leadSource || ""}
                onChange={(e) =>
                  setFormData({ ...formData, leadSource: e.target.value })
                }
              >
                <option value="">Select a source...</option>
                {[
                  "Google Ads",
                  "Referral",
                  "Email Campaign",
                  "Website",
                  "LinkedIn Ads",
                  "Webinar",
                  "Social Media Advertisement",
                  "Partner Referral",
                  "Direct Mail",
                  "Cold Call",
                  "Content Marketing",
                  "YouTube Ads",
                  "SEO / Organic Search",
                  "Others",
                ].map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-450 dark:text-slate-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Assigned Agent
            </label>
            <div className="relative">
              <select
                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-gray-200 dark:border-white/10 rounded-lg pl-3 pr-8 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none appearance-none cursor-pointer text-slate-900 dark:text-slate-100 [&>option]:bg-white dark:[&>option]:bg-slate-900 [&>option]:text-slate-900 dark:[&>option]:text-slate-100"
                value={formData.assignedUserId || ""}
                onChange={(e) =>
                  setFormData({ ...formData, assignedUserId: e.target.value })
                }
              >
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.firstName} {u.lastName}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-450 dark:text-slate-500"
              />
            </div>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            Full Address
          </label>
          <div className="relative">
            <MapPin
              className="absolute left-3 top-4 -translate-y-1/2 text-slate-400"
              size={14}
            />
            <textarea
              className="w-full pl-9 bg-slate-50 dark:bg-slate-800/50 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none min-h-[80px]"
              value={formData.address || ""}
              onChange={(e) =>
                setFormData({ ...formData, address: e.target.value })
              }
              placeholder="123 Main St, Apt 4B, City, State, Zip Code"
            />
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="pt-8 flex justify-end gap-3 sticky bottom-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm pb-6">
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 active:scale-95 rounded-xl transition-all shadow-md shadow-blue-500/20"
        >
          {initialData ? "Save Changes" : "Create Profile"}
        </button>
      </div>
    </form>
  );
}

export function ContactFormSheet({
  initialData,
  isOpen,
  onClose,
  onSave,
}: ContactFormProps) {
  return (
    <SlidingDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? "Edit Profile" : "New Profile"}
      subtitle="Complete the profile details below."
    >
      <AddContactForm
        initialData={initialData}
        onSave={onSave}
        onCancel={onClose}
      />
    </SlidingDrawer>
  );
}
