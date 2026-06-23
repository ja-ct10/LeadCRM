import React, { useState } from 'react';
import { useAuth } from '../../../store/AuthContext';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function AuthPage({ mode, onNavigate }: { mode: 'login' | 'register', onNavigate: (path: string) => void }) {
  const { login, registerTenant } = useAuth();
  const [email, setEmail] = useState('admin@democorp.com');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  
  // OTP State
  const [showOTP, setShowOTP] = useState(false);
  const [otp, setOtp] = useState('');
  const [showRegOTP, setShowRegOTP] = useState(false);

  // Registration state
  const [step, setStep] = useState(1);
  const [tenantData, setTenantData] = useState({ companyName: '', industry: 'IT Solutions', size: '1-10', businessEmail: '', phone: '', address: '' });
  const [businessReqs, setBusinessReqs] = useState({ requirements: '', documentName: '' });
  const [verificationDocs, setVerificationDocs] = useState({ businessPermit: '', taxId: '', validId: '' });
  const [adminData, setAdminData] = useState({ firstName: '', lastName: '', email: '', password: '', confirmPassword: '' });
  const [botCheck, setBotCheck] = useState({ answer: '', expected: '' });

  React.useEffect(() => {
    const num1 = Math.floor(Math.random() * 10) + 1;
    const num2 = Math.floor(Math.random() * 10) + 1;
    setBotCheck(prev => ({ ...prev, expected: (num1 + num2).toString(), question: `What is ${num1} + ${num2}?` }));
  }, [step]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showOTP) {
      setShowOTP(true);
      setError('');
      return;
    }
    if (otp !== '123456') {
      setError('Invalid OTP. Use 123456 for demo.');
      return;
    }
    if (login(email, password)) {
      onNavigate('dashboard');
    } else {
      setError('Invalid credentials or tenant pending approval.');
    }
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminData.password !== adminData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (botCheck.answer !== botCheck.expected) {
      setError('Bot check failed. Please try again.');
      return;
    }
    
    if (!showRegOTP) {
      setShowRegOTP(true);
      setError('');
      return;
    }
    
    if (otp !== '123456') {
      setError('Invalid OTP. Use 123456 for demo.');
      return;
    }

    registerTenant({...tenantData, businessReqs, verificationDocs: { ...verificationDocs, uploadedAt: new Date().toISOString() }}, adminData);
    toast.success('Registration successful! Setup/Onboarding info has been sent to your email. Please wait for System Admin approval.');
    onNavigate('login');
  };

  if (mode === 'login') {
    return (
      <div className="min-h-screen bg-[#07142A] flex items-center justify-center p-4 relative overflow-hidden">
        {/* Background glow effects */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[100px] pointer-events-none"></div>

        <div className="w-full max-w-md bg-blue-50 dark:bg-[#0A1931]/80 backdrop-blur-xl p-8 rounded-2xl border border-slate-800 shadow-2xl relative z-10">
          <button onClick={() => onNavigate('landing')} className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white mb-8 flex items-center gap-2 text-sm transition-colors w-fit">
            <ArrowLeft size={16} /> Back to Home
          </button>
          
          <div className="flex flex-col items-center mb-8">
            <div className="w-12 h-12 bg-gradient-to-br from-[#0A6EFF] to-blue-500 rounded-xl flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(10,110,255,0.3)]">
              <span className="text-slate-900 dark:text-white font-bold text-xl">L</span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Welcome back</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Sign in to your LeadCRM account</p>
          </div>
          
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg mb-6 text-sm flex items-start gap-2">
              <div className="mt-0.5">⚠️</div>
              <p>{error}</p>
            </div>
          )}
          
          <form onSubmit={handleLogin} className="space-y-5">
            {!showOTP ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Email Address</label>
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[#07142A] border border-gray-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-[#0A6EFF] transition-colors"
                    required
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Password</label>
                    <a href="#" className="text-xs text-[#0A6EFF] hover:underline">Forgot password?</a>
                  </div>
                  <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-[#07142A] border border-gray-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-[#0A6EFF] transition-colors"
                    required
                  />
                </div>
                <button type="submit" className="w-full bg-[#0A6EFF] text-slate-900 dark:text-white rounded-lg py-2.5 font-medium hover:bg-blue-600 transition-colors mt-4 shadow-[0_0_15px_rgba(10,110,255,0.2)]">
                  Send OTP
                </button>
              </>
            ) : (
              <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="text-sm text-slate-500 mb-4">
                  An OTP has been sent to {email}. For this demo, please use <strong>123456</strong>.
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Enter OTP</label>
                  <input 
                    type="text" 
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    className="w-full bg-[#07142A] border border-gray-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-[#0A6EFF] transition-colors text-center text-lg tracking-widest"
                    required
                    maxLength={6}
                    placeholder="------"
                  />
                </div>
                <button type="submit" className="w-full bg-[#0A6EFF] text-slate-900 dark:text-white rounded-lg py-2.5 font-medium hover:bg-blue-600 transition-colors mt-4 shadow-[0_0_15px_rgba(10,110,255,0.2)]">
                  Verify & Sign In
                </button>
                <button type="button" onClick={() => setShowOTP(false)} className="w-full mt-2 text-sm text-slate-500 hover:text-slate-300 text-center">
                  Back to Login
                </button>
              </div>
            )}
          </form>
          
          <div className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
            Don't have an account? <button onClick={() => onNavigate('register')} className="text-[#0A6EFF] font-medium hover:underline ml-1">Register</button>
          </div>
          
          <div className="mt-8 pt-6 border-t border-slate-800/50 text-xs text-slate-500 text-center space-y-1">
            <p className="font-medium text-slate-500 dark:text-slate-400 mb-2">Demo Accounts:</p>
            <p>System Admin: <span className="text-slate-700 dark:text-slate-300">super@leadcrm.com</span> / admin123</p>
            <p>Client Admin: <span className="text-slate-700 dark:text-slate-300">admin@democorp.com</span> / admin123</p>
            <p>Sales Rep: <span className="text-slate-700 dark:text-slate-300">bob@democorp.com</span> / admin123</p>
            <p>Guest (Demo): <span className="text-slate-700 dark:text-slate-300">guest@democorp.com</span> / guest123</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07142A] flex items-center justify-center p-4 py-12 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-500/5 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-2xl bg-blue-50 dark:bg-[#0A1931]/90 backdrop-blur-xl p-8 sm:p-10 rounded-2xl border border-slate-800 shadow-2xl relative z-10">
        <button onClick={() => onNavigate('landing')} className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white mb-8 flex items-center gap-2 text-sm transition-colors w-fit">
          <ArrowLeft size={16} /> Back to Home
        </button>
        
        <div className="mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-2">Create your account</h2>
          <div className="flex items-center gap-3">
            <p className="text-slate-500 dark:text-slate-400">Step {step} of 5</p>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className={`h-1.5 w-8 rounded-full ${i <= step ? 'bg-[#0A6EFF]' : 'bg-white dark:bg-slate-800'}`}></div>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg mb-6 text-sm flex items-start gap-2">
            <div className="mt-0.5">⚠️</div>
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={step === 5 ? handleRegister : (e) => { e.preventDefault(); setStep(step + 1); }}>
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex items-center gap-3 border-b border-slate-800/50 pb-4">
                <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold text-sm">1</div>
                <h3 className="text-lg font-medium text-slate-900 dark:text-white">Basic Details</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Company Name</label>
                  <input required value={tenantData.companyName} onChange={e => setTenantData({...tenantData, companyName: e.target.value})} className="w-full bg-[#07142A] border border-gray-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-[#0A6EFF] transition-colors" placeholder="e.g. Acme Corp" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Industry</label>
                  <select value={tenantData.industry} onChange={e => setTenantData({...tenantData, industry: e.target.value})} className="w-full bg-[#07142A] border border-gray-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-[#0A6EFF] transition-colors">
                    <option>IT Solutions</option>
                    <option>Software Development</option>
                    <option>Consulting</option>
                    <option>Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Company Size</label>
                  <select value={tenantData.size} onChange={e => setTenantData({...tenantData, size: e.target.value})} className="w-full bg-[#07142A] border border-gray-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-[#0A6EFF] transition-colors">
                    <option>1-10</option>
                    <option>11-50</option>
                    <option>51-200</option>
                    <option>201+</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Business Email</label>
                  <input type="email" required value={tenantData.businessEmail} onChange={e => setTenantData({...tenantData, businessEmail: e.target.value})} className="w-full bg-[#07142A] border border-gray-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-[#0A6EFF] transition-colors" placeholder="hello@democorp.com" />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex items-center gap-3 border-b border-slate-800/50 pb-4">
                <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold text-sm">2</div>
                <h3 className="text-lg font-medium text-slate-900 dark:text-white">Business Requirements</h3>
              </div>
              <div className="grid grid-cols-1 gap-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Describe your business requirements</label>
                  <textarea 
                    required 
                    rows={4}
                    value={businessReqs.requirements} 
                    onChange={e => setBusinessReqs({...businessReqs, requirements: e.target.value})} 
                    className="w-full bg-[#07142A] border border-gray-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-[#0A6EFF] transition-colors resize-none" 
                    placeholder="Tell us about the modules you need, your workflow, and any specific customizations..." 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Business Documents (Optional)</label>
                  <div className="w-full bg-[#07142A] border border-gray-200 dark:border-slate-700 border-dashed rounded-lg px-4 py-8 text-center hover:border-[#0A6EFF] transition-all group relative">
                    <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg"></div>
                    <div className="relative z-10">
                      <div className="w-12 h-12 bg-gray-50 dark:bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-200 dark:border-slate-700 group-hover:border-blue-500/30 transition-colors">
                        <CheckCircle2 className={`w-6 h-6 ${businessReqs.documentName ? 'text-green-400' : 'text-slate-500'}`} />
                      </div>
                      <p className="text-sm text-slate-700 dark:text-slate-300 font-medium mb-1">
                        {businessReqs.documentName ? 'Document Selected' : 'Upload Business Registration'}
                      </p>
                      <p className="text-xs text-slate-500 mb-4">PDF, JPG, or PNG (Max 5MB)</p>
                      <input 
                        type="file" 
                        className="hidden" 
                        id="file-upload"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            setBusinessReqs({...businessReqs, documentName: e.target.files[0].name});
                          }
                        }}
                      />
                      <label htmlFor="file-upload" className="inline-block px-6 py-2 bg-[#0A6EFF]/10 hover:bg-[#0A6EFF]/20 text-[#0A6EFF] rounded-xl text-sm font-bold cursor-pointer transition-all border border-[#0A6EFF]/20">
                        {businessReqs.documentName ? businessReqs.documentName : 'Select File'}
                      </label>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl">
                <p className="text-xs text-blue-400 leading-relaxed">
                  <strong>Note:</strong> Upon approval of your basic details, a <strong>Sandbox Environment</strong> will be automatically provisioned for your initial setup and testing.
                </p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex items-center gap-3 border-b border-slate-800/50 pb-4">
                <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold text-sm">3</div>
                <h3 className="text-lg font-medium text-slate-900 dark:text-white">Legitimacy Verification</h3>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">To secure our platform, please upload the following documents to verify your business legitimacy.</p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Business Permit / License</label>
                  <div className="flex items-center gap-3">
                    <input 
                      type="file" 
                      className="hidden" 
                      id="permit-upload"
                      onChange={(e) => e.target.files && setVerificationDocs({...verificationDocs, businessPermit: e.target.files[0].name})}
                    />
                    <label htmlFor="permit-upload" className="flex-1 bg-[#07142A] border border-gray-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-slate-500 dark:text-slate-400 cursor-pointer hover:border-[#0A6EFF] transition-colors truncate">
                      {verificationDocs.businessPermit || 'Select File...'}
                    </label>
                    {verificationDocs.businessPermit && <CheckCircle2 className="text-green-400" size={20} />}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Tax Identification Number (TIN) Document</label>
                  <div className="flex items-center gap-3">
                    <input 
                      type="file" 
                      className="hidden" 
                      id="tin-upload"
                      onChange={(e) => e.target.files && setVerificationDocs({...verificationDocs, taxId: e.target.files[0].name})}
                    />
                    <label htmlFor="tin-upload" className="flex-1 bg-[#07142A] border border-gray-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-slate-500 dark:text-slate-400 cursor-pointer hover:border-[#0A6EFF] transition-colors truncate">
                      {verificationDocs.taxId || 'Select File...'}
                    </label>
                    {verificationDocs.taxId && <CheckCircle2 className="text-green-400" size={20} />}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Owner's Valid Government ID</label>
                  <div className="flex items-center gap-3">
                    <input 
                      type="file" 
                      className="hidden" 
                      id="id-upload"
                      onChange={(e) => e.target.files && setVerificationDocs({...verificationDocs, validId: e.target.files[0].name})}
                    />
                    <label htmlFor="id-upload" className="flex-1 bg-[#07142A] border border-gray-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-slate-500 dark:text-slate-400 cursor-pointer hover:border-[#0A6EFF] transition-colors truncate">
                      {verificationDocs.validId || 'Select File...'}
                    </label>
                    {verificationDocs.validId && <CheckCircle2 className="text-green-400" size={20} />}
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex items-center gap-3 border-b border-slate-800/50 pb-4">
                <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold text-sm">4</div>
                <h3 className="text-lg font-medium text-slate-900 dark:text-white">Admin User Details</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">First Name</label>
                  <input required value={adminData.firstName} onChange={e => setAdminData({...adminData, firstName: e.target.value})} className="w-full bg-[#07142A] border border-gray-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-[#0A6EFF] transition-colors" placeholder="Jane" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Last Name</label>
                  <input required value={adminData.lastName} onChange={e => setAdminData({...adminData, lastName: e.target.value})} className="w-full bg-[#07142A] border border-gray-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-[#0A6EFF] transition-colors" placeholder="Doe" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Admin Email</label>
                  <input type="email" required value={adminData.email} onChange={e => setAdminData({...adminData, email: e.target.value})} className="w-full bg-[#07142A] border border-gray-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-[#0A6EFF] transition-colors" placeholder="jane.doe@democorp.com" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Password</label>
                  <input type="password" required value={adminData.password} onChange={e => setAdminData({...adminData, password: e.target.value})} className="w-full bg-[#07142A] border border-gray-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-[#0A6EFF] transition-colors" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Confirm Password</label>
                  <input type="password" required value={adminData.confirmPassword} onChange={e => setAdminData({...adminData, confirmPassword: e.target.value})} className="w-full bg-[#07142A] border border-gray-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-[#0A6EFF] transition-colors" />
                </div>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex items-center gap-3 border-b border-slate-800/50 pb-4">
                <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold text-sm">5</div>
                <h3 className="text-lg font-medium text-slate-900 dark:text-white">Confirmation & Security</h3>
              </div>
              
              <div className="bg-[#07142A] p-5 rounded-xl border border-slate-800/80 space-y-3">
                <div className="flex justify-between items-center pb-3 border-b border-slate-800/50">
                  <span className="text-slate-500 dark:text-slate-400 text-sm">Company</span>
                  <span className="text-slate-900 dark:text-white font-medium">{tenantData.companyName || 'Not provided'}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-slate-800/50">
                  <span className="text-slate-500 dark:text-slate-400 text-sm">Verification Status</span>
                  <span className="text-green-400 font-medium text-sm flex items-center gap-1">
                    <CheckCircle2 size={14} /> Documents Ready
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 dark:text-slate-400 text-sm">Admin Email</span>
                  <span className="text-slate-900 dark:text-white font-medium">{adminData.email || 'Not provided'}</span>
                </div>
              </div>

              <div className="p-4 bg-white dark:bg-slate-800/30 rounded-xl border border-gray-200 dark:border-slate-700/50">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Bot Check: {(botCheck as any).question}</label>
                <input 
                  type="text" 
                  required 
                  value={botCheck.answer} 
                  onChange={e => setBotCheck({...botCheck, answer: e.target.value})} 
                  className="w-full bg-[#07142A] border border-gray-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-[#0A6EFF] transition-colors" 
                  placeholder="Enter answer"
                />
              </div>

              {!showRegOTP ? (
                <>
                  <label className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300 cursor-pointer p-4 bg-[#07142A]/50 rounded-xl border border-slate-800/50 hover:border-gray-200 dark:hover:border-slate-700 transition-colors">
                    <div className="mt-0.5">
                      <input type="checkbox" required className="rounded border-gray-200 dark:border-slate-700 bg-blue-50 dark:bg-[#0A1931] text-[#0A6EFF] focus:ring-[#0A6EFF] w-4 h-4" />
                    </div>
                    <span>I agree to the <a href="#" className="text-[#0A6EFF] hover:underline">Terms of Service</a> and <a href="#" className="text-[#0A6EFF] hover:underline">Privacy Policy</a>. I understand that my account requires approval from a System Administrator. Once approved, my <strong>Sandbox Environment</strong> will be created first for secure testing, followed by a <strong>Production Environment</strong> after review.</span>
                  </label>
                </>
              ) : (
                <div className="p-4 bg-[#07142A]/50 rounded-xl border border-slate-800/50 text-center animate-in fade-in slide-in-from-right-4">
                  <h4 className="text-sm font-medium text-slate-300 mb-2">Email Verification</h4>
                  <p className="text-xs text-slate-500 mb-4">We sent a verification OTP to {adminData.email}. For this demo, use <strong>123456</strong>.</p>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 text-left">Enter OTP</label>
                  <input 
                    type="text" 
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    className="w-full bg-[#07142A] border border-gray-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-[#0A6EFF] transition-colors text-center tracking-widest text-lg"
                    required
                    maxLength={6}
                    placeholder="------"
                  />
                  <button type="button" onClick={() => setShowRegOTP(false)} className="w-full mt-4 text-xs text-slate-500 hover:text-slate-300">
                    Go Back
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-between mt-10 pt-6 border-t border-slate-800/50">
            {step > 1 && !showRegOTP ? (
              <button type="button" onClick={() => setStep(step - 1)} className="px-5 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800 rounded-lg transition-colors">Back</button>
            ) : <div></div>}
            <button type="submit" className="px-6 py-2.5 bg-[#0A6EFF] text-slate-900 dark:text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors shadow-[0_0_15px_rgba(10,110,255,0.2)]">
              {step === 5 ? (showRegOTP ? 'Verify & Complete' : 'Send OTP & Complete') : 'Next Step'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
