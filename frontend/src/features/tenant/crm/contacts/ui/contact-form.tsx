'use client';

import React, { useState, useEffect } from "react";
import { Contact, Organization } from "@/store/types";
import { SlidingDrawer } from "@/shared/components/SlidingDrawer";
import { useData } from "@/store/DataContext";
import { useAuth } from "@/store/AuthContext";
import { toast } from "sonner";
import {
  Mail,
  MapPin,
  Calendar,
  AlertCircle,
  ChevronDown,
  User,
  Building,
} from "lucide-react";
import { OrganizationSelector } from "./organization-combobox";
import {
  COUNTRY_CODES,
  getPlaceholderForCountryCode,
} from "@/lib/countries";

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

export function AddContactForm({ initialData, onSave, onCancel }: AddContactFormProps) {
  const { organizations, addOrganization, updateOrganization, addTask, users } = useData();
  const { user } = useAuth();
  const organizationsRef = React.useRef(organizations);
  organizationsRef.current = organizations;

  const [scheduleFollowUp, setScheduleFollowUp] = useState(false);
  const [followUpDate, setFollowUpDate] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [customProduct, setCustomProduct] = useState<string>("");
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState<Partial<Contact>>({
    firstName: "", lastName: "", email: "", phone: "",
    customerType: "Individual", jobTitle: "", organizationId: "",
    status: "Cold", leadSource: "Organic", companyName: "",
    businessType: "", companySize: "", orgWebsite: "", taxId: "", priority: "Medium",
  });

  const validateField = (fieldName: string, value: string) => {
    let errorMessage = "";
    const isIndividual = formData.customerType === "Individual";
    if (fieldName === "firstName" && isIndividual && !value.trim()) errorMessage = "First Name is required";
    else if (fieldName === "lastName" && isIndividual && !value.trim()) errorMessage = "Last Name is required";
    else if (fieldName === "followUpDate" && scheduleFollowUp && !value.trim()) errorMessage = "Follow-up date is required";
    setErrors((prev) => {
      const next = { ...prev };
      if (errorMessage) next[fieldName] = errorMessage;
      else delete next[fieldName];
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
      const org = organizationsRef.current.find((o) => o.id === initialData.organizationId);
      const prod = initialData.productInterest || "";
      let sp = "", cp = "";
      if (prod) {
        const matched = PRODUCTS.find((p) => p.toLowerCase() === prod.toLowerCase());
        if (matched) { sp = matched; } else { sp = "Others"; cp = prod; }
      }
      setSelectedProduct(sp);
      setCustomProduct(cp);
      setFormData({
        ...initialData,
        customerType: initialData.customerType || (initialData.organizationId || initialData.companyName ? "Organization" : "Individual"),
        companyName: org ? org.name : initialData.companyName || "",
        businessType: org ? org.industry : "",
        companySize: org ? org.size : "",
        orgWebsite: org ? org.website : "",
        taxId: org ? org.taxId : "",
        priority: initialData.priority || "Medium",
      });
    } else {
      setSelectedProduct(""); setCustomProduct("");
      setFormData({
        firstName: "", lastName: "", email: "", phone: "",
        customerType: "Individual", jobTitle: "", organizationId: "",
        status: "Cold", leadSource: "Organic", companyName: "",
        businessType: "", companySize: "", orgWebsite: "", taxId: "", priority: "Medium",
      });
    }
  }, [initialData, initialData?.organizationId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    const isOrg = formData.customerType === "Organization";
    if (!isOrg && !formData.firstName?.trim()) newErrors.firstName = "First Name is required";
    if (isOrg && !formData.organizationId && !formData.companyName?.trim()) {
      newErrors.companyName = "Organization selection or name is required";
      toast.error("An organization must be selected or created.");
    }
    if (scheduleFollowUp && !followUpDate) newErrors.followUpDate = "Follow-up date is required when scheduling a follow-up";
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error("Please resolve missing mandatory fields before submitting");
      return;
    }
    const finalProduct = selectedProduct === "Others" ? customProduct : selectedProduct;
    let finalOrgId = formData.organizationId;
    if (isOrg) {
      if (formData.organizationId === "NEW_TEMP") {
        const createdId = await addOrganization({ name: formData.companyName || "", industry: formData.businessType || "", size: formData.companySize || "", website: formData.orgWebsite || "", taxId: formData.taxId || "" });
        if (createdId) { finalOrgId = createdId; toast.success(`Organization "${formData.companyName}" successfully created`); }
        else { toast.error("Failed to create organization record"); return; }
      } else if (formData.organizationId) {
        await updateOrganization(formData.organizationId, { industry: formData.businessType || "", size: formData.companySize || "", website: formData.orgWebsite || "", taxId: formData.taxId || "" });
      }
    } else { finalOrgId = ""; }
    const contactPerson = `${formData.firstName || ""} ${formData.lastName || ""}`.trim();
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
      contactPerson, productInterest: finalProduct,
    };
    if (scheduleFollowUp && followUpDate) {
      addTask({ title: `Follow up with ${contactPerson}`, description: `Follow-up reminder set during contact form submission for ${contactPerson}.`, status: "pending", dueDate: followUpDate, assignedUserId: user?.id || "system", priority: "Medium" as "Low" | "Medium" | "High" });
      toast.success(`Follow-up task scheduled for ${followUpDate}`);
    }
    onSave(updated);
  };

  // ··· Shared field classes ···················································
  const inputCls = "w-full bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 outline-none transition-all focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500";
  const selectCls = "w-full bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-xl pl-3.5 pr-8 py-2.5 text-sm text-slate-900 dark:text-white outline-none appearance-none cursor-pointer focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all [&>option]:bg-white dark:[&>option]:bg-slate-900";
  const sectionNum = (n: number) => formData.customerType === "Organization" ? n : n - 1;

  // Phone helpers
  const getPhoneCode = () => { const p = formData.phone || ""; const m = COUNTRY_CODES.find((c) => p.startsWith(c.code)); return m ? m.code : "+63"; };
  const getPhoneNumber = () => { const p = formData.phone || ""; let clean = p; COUNTRY_CODES.forEach((c) => { if (p.startsWith(c.code + " ")) clean = p.substring(c.code.length + 1); else if (p.startsWith(c.code)) clean = p.substring(c.code.length); }); return clean; };
  const setPhone = (code: string, number: string) => setFormData({ ...formData, phone: `${code} ${number}`.trim() });

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">

      {/* ·· Scrollable Body ······················· */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

        {/* Customer Type */}
        <div className="rounded-2xl border border-gray-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.02] p-4">
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Customer Type</p>
          <div className="flex gap-2">
            {[{ val: "Individual", Icon: User }, { val: "Organization", Icon: Building }].map(({ val, Icon }) => (
              <button key={val} type="button"
                onClick={() => setFormData({ ...formData, customerType: val as any, ...(val === "Individual" ? { companyName: "" } : {}) })}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
                  formData.customerType === val
                    ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/20"
                    : "bg-white dark:bg-white/[0.03] border-gray-200 dark:border-white/[0.08] text-slate-500 dark:text-slate-400 hover:border-blue-400 hover:text-blue-500"
                }`}
              ><Icon size={16} /> {val}</button>
            ))}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 leading-relaxed">
            {formData.customerType === "Organization"
              ? "Track the corporate entity. A primary contact person will be linked below."
              : "A personal account for homeowners or individual clients."}
          </p>
        </div>

        {/* Section 1: Organization Details (org only) */}
        {formData.customerType === "Organization" && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <SectionHeader num={1} title="Organization Details" />
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">
                Search or Add Organization <span className="text-blue-500">*</span>
              </label>
              <OrganizationSelector
                organizations={organizations}
                value={formData.organizationId || ""}
                companyName={formData.companyName}
                onChange={(orgId, orgName) => {
                  const org = organizations.find((o) => o.id === orgId);
                  if (org) { setFormData({ ...formData, organizationId: orgId, companyName: orgName, businessType: org.industry || "", companySize: org.size || "", orgWebsite: org.website || "", taxId: org.taxId || "" }); toast.success(`Loaded details from "${orgName}"`); }
                  else { setFormData({ ...formData, organizationId: "", companyName: "", businessType: "", companySize: "", orgWebsite: "", taxId: "" }); }
                }}
                onCreateNew={(name) => {
                  setFormData({ ...formData, organizationId: "NEW_TEMP", companyName: name, businessType: "", companySize: "", orgWebsite: "", taxId: "" });
                  toast.success(`Positioned "${name}" for creation.`);
                }}
              />
            </div>
          </div>
        )}

        {/* Section: Basic Info / Contact Person */}
        <div className="space-y-4">
          <SectionHeader
            num={formData.customerType === "Organization" ? 2 : 1}
            title={formData.customerType === "Organization" ? "Organization Contact Person" : "Basic Information"}
          />
          <div className="grid grid-cols-2 gap-4">
            <FieldWrap label={`First Name${formData.customerType !== "Organization" ? " *" : ""}`} error={errors.firstName}>
              <input required={formData.customerType !== "Organization"} className={`${inputCls}${errors.firstName ? " !border-red-500 focus:!ring-red-500/20" : ""}`}
                placeholder="Enter first name" value={formData.firstName || ""}
                onChange={(e) => { setFormData({ ...formData, firstName: e.target.value }); validateField("firstName", e.target.value); }}
                onBlur={(e) => validateField("firstName", e.target.value)} />
            </FieldWrap>
            <FieldWrap label={`Last Name${formData.customerType !== "Organization" ? " *" : ""}`} error={errors.lastName}>
              <input required={formData.customerType !== "Organization"} className={`${inputCls}${errors.lastName ? " !border-red-500 focus:!ring-red-500/20" : ""}`}
                placeholder="Enter last name" value={formData.lastName || ""}
                onChange={(e) => { setFormData({ ...formData, lastName: e.target.value }); validateField("lastName", e.target.value); }}
                onBlur={(e) => validateField("lastName", e.target.value)} />
            </FieldWrap>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FieldWrap label={formData.customerType === "Organization" ? "Company Email" : "Email"}>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input type="email" className={`${inputCls} pl-9`} placeholder="email@example.com"
                  value={formData.email || ""} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
              </div>
            </FieldWrap>
            <FieldWrap label={formData.customerType === "Organization" ? "Company Phone" : "Phone"}>
              <div className="flex bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-xl focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 overflow-hidden text-sm transition-all">
                <div className="relative border-r border-gray-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.03] flex items-center shrink-0 w-[90px]">
                  <select value={getPhoneCode()}
                    onChange={(e) => setPhone(e.target.value, getPhoneNumber())}
                    className="w-full h-full py-2.5 pl-2.5 pr-6 bg-transparent text-slate-900 dark:text-slate-100 border-none outline-none appearance-none cursor-pointer text-xs [&>option]:text-slate-900 [&>option]:bg-white dark:[&>option]:text-white dark:[&>option]:bg-slate-800">
                    <option value="" disabled>Code</option>
                    {COUNTRY_CODES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                  </select>
                  <ChevronDown size={12} className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
                </div>
                <input type="tel"
                  placeholder={getPlaceholderForCountryCode(getPhoneCode())}
                  className="flex-1 px-3 py-2.5 bg-transparent border-none outline-none focus:ring-0 placeholder:text-slate-400 text-slate-900 dark:text-white min-w-0 text-sm"
                  value={getPhoneNumber()}
                  onChange={(e) => setPhone(getPhoneCode(), e.target.value)} />
              </div>
            </FieldWrap>
          </div>
        </div>

        {/* Section: Status & Interest */}
        <div className="space-y-4">
          <SectionHeader
            num={formData.customerType === "Organization" ? 3 : 2}
            title="Status & Interest"
          />
          <div className="grid grid-cols-2 gap-4">
            <FieldWrap label="Lead Status">
              <div className="relative">
                <select className={selectCls} value={formData.status || "Cold"}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}>
                  <option value="Hot">=··· Hot</option>
                  <option value="Warm">=··· Warm</option>
                  <option value="Cold">=··· Cold</option>
                  <option value="Closed">=··· Closed</option>
                  <option value="Cancelled">Gܽ Cancelled</option>
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
              </div>
            </FieldWrap>
            <FieldWrap label="Product Interest">
              <div className="space-y-2">
                <div className="relative">
                  <div
                    className={`${inputCls} flex items-center justify-between cursor-pointer select-none`}
                    onClick={() => setIsProductDropdownOpen(!isProductDropdownOpen)}
                  >
                    <span className={selectedProduct ? "text-slate-900 dark:text-white" : "text-slate-400"}>
                      {selectedProduct || "Select product..."}
                    </span>
                    <ChevronDown size={14} className={`text-slate-400 transition-transform ${isProductDropdownOpen ? "rotate-180" : ""}`} />
                  </div>
                  
                  {isProductDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsProductDropdownOpen(false)} />
                      <div className="absolute z-50 w-full mt-1.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-white/[0.08] rounded-xl shadow-xl shadow-blue-900/5 dark:shadow-black/40 py-1 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 max-h-60 overflow-y-auto">
                        {PRODUCTS.map((p) => (
                          <div
                            key={p}
                            className={`px-3.5 py-2.5 text-sm cursor-pointer transition-colors ${selectedProduct === p ? "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium" : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.04]"}`}
                            onClick={() => {
                              setSelectedProduct(p);
                              setIsProductDropdownOpen(false);
                            }}
                          >
                            {p}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                {selectedProduct === "Others" && (
                  <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                    <input type="text" autoFocus
                      className="w-full bg-white dark:bg-white/[0.04] border border-blue-400 dark:border-blue-500/60 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm shadow-blue-500/10"
                      placeholder="Specify product or service"
                      value={customProduct}
                      onChange={(e) => setCustomProduct(e.target.value)} />
                  </div>
                )}
              </div>
            </FieldWrap>
          </div>

          {/* Follow-up toggle card */}
          <div className="rounded-2xl border border-gray-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.02] p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Schedule a follow-up</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Instantly set a reminder task on your Task Board.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input type="checkbox" className="sr-only peer" checked={scheduleFollowUp}
                  onChange={() => {
                    const next = !scheduleFollowUp;
                    setScheduleFollowUp(next);
                    if (!next) setErrors((prev) => { const n = { ...prev }; delete n.followUpDate; return n; });
                    else if (!followUpDate) setErrors((prev) => ({ ...prev, followUpDate: "Follow-up date is required" }));
                  }} />
                <div className="w-11 h-6 bg-slate-300 dark:bg-slate-700 rounded-full peer peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:border-gray-300 after:rounded-full after:h-5 after:w-5 after:transition-all" />
              </label>
            </div>
            {scheduleFollowUp && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-white/[0.06] space-y-1.5 animate-in fade-in duration-200">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400">
                  <Calendar size={13} className="text-blue-500" />
                  Follow-up Due Date <span className="text-blue-500">*</span>
                </label>
                <input type="date" required={scheduleFollowUp}
                  className={`w-full bg-white dark:bg-white/[0.04] border rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 transition-all ${errors.followUpDate ? "border-red-500 focus:ring-red-500/20" : "border-gray-200 dark:border-white/[0.08] focus:ring-blue-500/20 focus:border-blue-500"}`}
                  value={followUpDate}
                  onChange={(e) => { setFollowUpDate(e.target.value); validateField("followUpDate", e.target.value); }} />
                {errors.followUpDate && (
                  <p className="text-[11px] text-red-500 flex items-center gap-1">
                    <AlertCircle size={11} /> {errors.followUpDate}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Section: Additional Information */}
        <div className="space-y-4">
          <SectionHeader
            num={formData.customerType === "Organization" ? 4 : 3}
            title="Additional Information"
          />
          <div className="grid grid-cols-2 gap-4">
            <FieldWrap label="Lead Source">
              <div className="relative">
                <select className={selectCls} value={formData.leadSource || ""}
                  onChange={(e) => setFormData({ ...formData, leadSource: e.target.value })}>
                  <option value="">Select source...</option>
                  {["Google Ads","Referral","Email Campaign","Website","LinkedIn Ads","Webinar","Social Media Advertisement","Partner Referral","Direct Mail","Cold Call","Content Marketing","YouTube Ads","SEO / Organic Search","Others"].map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
              </div>
            </FieldWrap>
            <FieldWrap label="Assigned Agent">
              <div className="relative">
                <select className={selectCls} value={formData.assignedUserId || ""}
                  onChange={(e) => setFormData({ ...formData, assignedUserId: e.target.value })}>
                  <option value="">Unassigned</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
              </div>
            </FieldWrap>
          </div>
          <FieldWrap label="Full Address">
            <div className="relative">
              <MapPin className="absolute left-3.5 top-3 text-slate-400" size={14} />
              <textarea rows={3}
                className="w-full pl-9 pr-4 bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-xl py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none overflow-hidden"
                placeholder="123 Main St, Apt 4B, City, State, Zip Code"
                value={formData.address || ""}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = `${target.scrollHeight + 2}px`;
                }}
              />
            </div>
          </FieldWrap>
        </div>

      </div>{/* end scrollable body */}

      {/* ·· Sticky Footer ···························· */}
      <div className="shrink-0 px-6 py-4 border-t border-gray-200 dark:border-white/[0.06] bg-white dark:bg-slate-900 flex items-center justify-end gap-3">
        <button type="button" onClick={onCancel}
          className="px-5 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-white/[0.05] hover:bg-slate-200 dark:hover:bg-white/[0.08] border border-gray-200 dark:border-white/[0.08] rounded-xl transition-colors">
          Cancel
        </button>
        <button type="submit"
          className="px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 rounded-xl transition-all shadow-lg shadow-blue-500/25">
          {initialData ? "Save Changes" : "Create Profile"}
        </button>
      </div>
    </form>
  );
}

// ··· Small reusable helpers ···················································

function SectionHeader({ num, title }: { num: number; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-[11px] font-bold shrink-0">
        {num}
      </div>
      <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-wide">{title}</h3>
      <div className="flex-1 h-px bg-gray-200 dark:bg-white/[0.06]" />
    </div>
  );
}

function FieldWrap({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400">
        <span>{label}</span>
        {error && <span className="text-red-500 font-normal text-[10px]">{error}</span>}
      </label>
      {children}
      {error && (
        <p className="text-[11px] text-red-500 flex items-center gap-1">
          <AlertCircle size={11} /> {error}
        </p>
      )}
    </div>
  );
}

// ··· Sheet wrapper ·····························································

export function ContactFormSheet({ initialData, isOpen, onClose, onSave }: ContactFormProps) {
  return (
    <SlidingDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? "Edit Profile" : "New Profile"}
      subtitle="Complete the profile details below."
    >
      <AddContactForm initialData={initialData} onSave={onSave} onCancel={onClose} />
    </SlidingDrawer>
  );
}
