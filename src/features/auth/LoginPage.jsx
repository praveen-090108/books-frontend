import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import intelliaTechLogo from '../../assets/intelliatech-logo-black-tm.png';
import { authApi } from '../../api/authApi.js';
import { useAuthStore } from '../../store/authStore.js';
import { firstAccessiblePath } from '../../utils/accessControl.js';

function AuthShell({ title, subtitle, children }) {
  return <main className="grid min-h-screen bg-[#f7f8fb] lg:grid-cols-[0.95fr_1.05fr]">
    <section className="hidden bg-[#071523] px-12 py-10 text-white lg:flex lg:flex-col">
      <div className="rounded-xl bg-white p-4"><img src={intelliaTechLogo} alt="IntelliaTech" className="h-auto w-60" /></div>
      <div className="mt-auto max-w-xl"><p className="text-sm font-bold uppercase tracking-[0.2em] text-red-300">IntelliaTech Books</p><h1 className="mt-5 text-5xl font-black leading-tight">Secure, role-based business access.</h1><p className="mt-5 text-lg leading-8 text-slate-300">Sign in with your organization account. Your assigned role controls the modules and actions available to you.</p></div>
    </section>
    <section className="flex items-center justify-center px-5 py-10"><div className="w-full max-w-[520px] rounded-2xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-200/70">
      <div className="mb-8 flex items-center gap-4"><span className="grid h-12 w-12 place-items-center rounded-xl bg-red-50 text-red-600"><ShieldCheck className="h-6 w-6" /></span><div><h2 className="text-3xl font-black text-[#06134a]">{title}</h2><p className="mt-1 text-sm font-semibold text-slate-500">{subtitle}</p></div></div>
      {children}
    </div></section>
  </main>;
}

function Input({ label, icon: Icon, ...props }) { return <label className="block"><span className="mb-2 block text-xs font-black text-[#06134a]">{label}</span><span className="flex h-12 items-center rounded-lg border border-slate-200 px-4 focus-within:border-red-300 focus-within:ring-4 focus-within:ring-red-50"><Icon className="h-5 w-5 text-slate-400" /><input {...props} className="h-full min-w-0 flex-1 px-3 text-sm font-semibold outline-none" /></span></label>; }
function Alert({ children, success=false }) { return children ? <p className={`mt-4 rounded-lg px-4 py-3 text-sm font-bold ${success?'bg-emerald-50 text-emerald-700':'bg-red-50 text-red-600'}`}>{children}</p> : null; }

export function LoginPage() {
  const navigate=useNavigate(), location=useLocation(); const {user,setSession}=useAuthStore();
  const [email,setEmail]=useState('admin@intelliatech.com'), [password,setPassword]=useState('admin123');
  const [error,setError]=useState(''), [loading,setLoading]=useState(false);
  if(user) return <Navigate to={firstAccessiblePath(user)} replace/>;
  async function submit(e){ e.preventDefault(); setLoading(true); setError(''); try { const session=await authApi.login({email:email.trim(),password}); setSession(session); navigate(location.state?.from?.pathname||firstAccessiblePath(session.user),{replace:true}); } catch(err){ setError(err.response?.data?.message||'Invalid email or password.'); } finally { setLoading(false); } }
  return <AuthShell title="Login" subtitle="Enter your email and password to continue."><form onSubmit={submit} className="space-y-4"><Input label="Email" icon={Mail} type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email"/><Input label="Password" icon={LockKeyhole} type="password" value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password"/><div className="text-right"><Link to="/forgot-password" className="text-sm font-bold text-red-600 hover:underline">Forgot password?</Link></div><Alert>{error}</Alert><button disabled={loading} className="h-12 w-full rounded-lg bg-red-600 text-sm font-black text-white disabled:opacity-60">{loading?'Signing in...':'Sign In'}</button></form></AuthShell>;
}

export function ForgotPasswordPage(){
 const [email,setEmail]=useState(''),[error,setError]=useState(''),[message,setMessage]=useState(''),[token,setToken]=useState(''),[loading,setLoading]=useState(false);
 async function submit(e){e.preventDefault();setLoading(true);setError('');try{const result=await authApi.forgotPassword(email.trim());setMessage(result.message);setToken(result.resetToken||'');}catch(err){setError(err.response?.data?.message||'Unable to start password reset.');}finally{setLoading(false);}}
 return <AuthShell title="Forgot Password" subtitle="Request a secure password reset link."><form onSubmit={submit} className="space-y-4"><Input label="Account Email" icon={Mail} type="email" value={email} onChange={e=>setEmail(e.target.value)} required/><Alert>{error}</Alert><Alert success>{message}</Alert>{token&&<Link to={`/reset-password?token=${encodeURIComponent(token)}`} className="flex h-11 items-center justify-center rounded-lg border border-emerald-300 bg-emerald-50 text-sm font-black text-emerald-700">Continue to Reset Password</Link>}<button disabled={loading} className="h-12 w-full rounded-lg bg-red-600 text-sm font-black text-white disabled:opacity-60">{loading?'Preparing...':'Reset Password'}</button><Link to="/login" className="block text-center text-sm font-bold text-slate-600">Back to Login</Link></form></AuthShell>;
}

export function ResetPasswordPage(){
 const [params]=useSearchParams(), navigate=useNavigate(); const [password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 async function submit(e){e.preventDefault();if(password!==confirm){setError('Passwords do not match.');return;}setLoading(true);setError('');try{await authApi.resetPassword(params.get('token')||'',password);navigate('/login',{replace:true,state:{passwordReset:true}});}catch(err){setError(err.response?.data?.message||'Unable to reset password.');}finally{setLoading(false);}}
 return <AuthShell title="Reset Password" subtitle="Choose a new password with at least 8 characters."><form onSubmit={submit} className="space-y-4"><Input label="New Password" icon={LockKeyhole} type="password" value={password} onChange={e=>setPassword(e.target.value)} minLength={8} required/><Input label="Confirm Password" icon={LockKeyhole} type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} minLength={8} required/><Alert>{error}</Alert><button disabled={loading} className="h-12 w-full rounded-lg bg-red-600 text-sm font-black text-white disabled:opacity-60">{loading?'Saving...':'Save New Password'}</button></form></AuthShell>;
}
