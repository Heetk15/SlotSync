'use client';

import { useState } from 'react';
import { useAuth } from './context/AuthContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function AuthPortal() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState({ type: 'idle', message: '' });
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ type: 'processing', message: 'Authenticating...' });

    const endpoint = isLogin ? '/auth/login' : '/auth/signup';

    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Authentication failed');
      }

      setStatus({ type: 'success', message: 'Success! Redirecting...' });
      login(data.access_token);
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    }
  };

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[radial-gradient(circle_at_top,_#ffffff,_#f4f7ff_38%,_#f8fafc_76%)] text-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500 mb-2">SlotSync Auth</p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
            {isLogin ? 'Welcome Back' : 'Create an Account'}
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <label className="block space-y-1 text-sm font-medium text-slate-700">
            <span>Username</span>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:bg-white"
            />
          </label>

          <label className="block space-y-1 text-sm font-medium text-slate-700">
            <span>Password</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:bg-white"
            />
          </label>

          {status.message && (
            <div
              className={`rounded-xl px-4 py-3 text-sm font-medium ${
                status.type === 'error'
                  ? 'bg-rose-50 text-rose-800 border border-rose-200'
                  : status.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-indigo-50 text-indigo-800 border border-indigo-200'
              }`}
            >
              {status.message}
            </div>
          )}

          <button
            type="submit"
            disabled={status.type === 'processing'}
            className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
          >
            {isLogin ? 'Sign In' : 'Sign Up'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-600">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setStatus({ type: 'idle', message: '' });
            }}
            className="font-medium text-indigo-600 hover:text-indigo-500 focus:outline-none focus:underline transition-colors"
          >
            {isLogin ? 'Sign up' : 'Sign in'}
          </button>
        </div>
      </div>
    </main>
  );
}
