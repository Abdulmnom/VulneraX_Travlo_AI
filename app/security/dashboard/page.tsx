"use client";

import { useState, useEffect } from "react";
import { Shield, AlertTriangle, Ban, Activity, Users, Clock } from "lucide-react";

interface AttackStats {
  total: number;
  byType: Record<string, number>;
  blocked: number;
  topIPs: Array<{ ip: string; count: number }>;
  last24h: number;
}

interface RateLimitStats {
  totalIPs: number;
  blockedIPs: number;
  activeRequests: number;
}

interface SecurityStats {
  attacks: AttackStats;
  rateLimits: Record<string, RateLimitStats>;
  timestamp: number;
}

export default function SecurityDashboard() {
  const [stats, setStats] = useState<SecurityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTenant, setSelectedTenant] = useState<string>("all");

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, [selectedTenant]);

  async function fetchStats() {
    try {
      const url = selectedTenant === "all" 
        ? "/api/security" 
        : `/api/security?tenant=${selectedTenant}`;
      
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch stats");
      
      const data = await res.json();
      setStats(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 mx-auto mb-4 animate-pulse text-blue-500" />
          <p>Loading security dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center text-red-400">
          <AlertTriangle className="w-16 h-16 mx-auto mb-4" />
          <p>{error}</p>
          <button 
            onClick={fetchStats}
            className="mt-4 px-4 py-2 bg-blue-600 rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const attackTypes = stats?.attacks?.byType || {};
  const totalAttacks = stats?.attacks?.total || 0;
  const blockedAttacks = stats?.attacks?.blocked || 0;
  const last24h = stats?.attacks?.last24h || 0;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <header className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <Shield className="w-10 h-10 text-blue-500" />
          <div>
            <h1 className="text-3xl font-bold">Security Dashboard</h1>
            <p className="text-gray-400">Real-time attack monitoring and tenant isolation</p>
          </div>
        </div>

        <div className="flex gap-4 items-center">
          <label className="text-gray-400">Tenant:</label>
          <select 
            value={selectedTenant}
            onChange={(e) => setSelectedTenant(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded px-3 py-2"
          >
            <option value="all">All Tenants</option>
            {stats?.rateLimits && Object.keys(stats.rateLimits).map(tenant => (
              <option key={tenant} value={tenant}>{tenant}</option>
            ))}
          </select>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <AlertTriangle className="w-8 h-8 text-red-500" />
            <span className="text-sm text-gray-400">All Time</span>
          </div>
          <div className="text-3xl font-bold">{totalAttacks}</div>
          <div className="text-gray-400">Total Attacks</div>
          <div className="mt-2 text-sm text-red-400">
            {last24h} in last 24h
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <Ban className="w-8 h-8 text-green-500" />
            <span className="text-sm text-gray-400">Blocked</span>
          </div>
          <div className="text-3xl font-bold text-green-400">{blockedAttacks}</div>
          <div className="text-gray-400">Blocked Attacks</div>
          <div className="mt-2 text-sm text-gray-400">
            {totalAttacks > 0 ? Math.round((blockedAttacks / totalAttacks) * 100) : 0}% success rate
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <Users className="w-8 h-8 text-blue-500" />
            <span className="text-sm text-gray-400">Rate Limited</span>
          </div>
          <div className="text-3xl font-bold">
            {Object.values(stats?.rateLimits || {}).reduce((acc, r) => acc + r.totalIPs, 0)}
          </div>
          <div className="text-gray-400">Active IPs</div>
          <div className="mt-2 text-sm text-orange-400">
            {Object.values(stats?.rateLimits || {}).reduce((acc, r) => acc + r.blockedIPs, 0)} blocked
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <Activity className="w-8 h-8 text-emerald-500" />
            <span className="text-sm text-gray-400">System</span>
          </div>
          <div className="text-3xl font-bold text-emerald-400">Active</div>
          <div className="text-gray-400">Protection Status</div>
          <div className="mt-2 text-sm text-gray-400">
            Last updated: {new Date(stats?.timestamp || 0).toLocaleTimeString()}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Attack Types
          </h2>
          
          {Object.keys(attackTypes).length === 0 ? (
            <p className="text-gray-500">No attacks detected yet</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(attackTypes)
                .sort(([,a], [,b]) => b - a)
                .map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between">
                    <span className="capitalize">{type.replace(/_/g, " ")}</span>
                    <div className="flex items-center gap-4">
                      <div className="w-32 bg-gray-700 rounded-full h-2">
                        <div 
                          className="bg-red-500 h-2 rounded-full transition-all"
                          style={{ width: `${Math.min(100, (count / totalAttacks) * 100)}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-400 w-12 text-right">{count}</span>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Tenant Rate Limits
          </h2>
          
          <div className="space-y-4">
            {Object.entries(stats?.rateLimits || {}).map(([tenant, limits]) => (
              <div key={tenant} className="bg-gray-900 rounded p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{tenant}</span>
                  <span className={`text-sm ${limits.blockedIPs > 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {limits.blockedIPs} blocked IPs
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-gray-500">Active IPs</div>
                    <div className="font-semibold">{limits.totalIPs}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Blocked IPs</div>
                    <div className={`font-semibold ${limits.blockedIPs > 0 ? 'text-red-400' : ''}`}>
                      {limits.blockedIPs}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500">Active Requests</div>
                    <div className="font-semibold">{limits.activeRequests}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {stats?.attacks?.topIPs && stats.attacks.topIPs.length > 0 && (
        <div className="mt-6 bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h2 className="text-xl font-semibold mb-4">Top Attacker IPs</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-700">
                  <th className="pb-2">IP Address</th>
                  <th className="pb-2">Attack Count</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {stats.attacks.topIPs.map(({ ip, count }) => (
                  <tr key={ip} className="border-b border-gray-700">
                    <td className="py-3 font-mono">{ip}</td>
                    <td className="py-3">{count}</td>
                    <td className="py-3">
                      <span className="px-2 py-1 bg-red-900 text-red-300 rounded text-sm">
                        Monitored
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <footer className="mt-8 text-center text-gray-500">
        <a 
          href="/security/logs" 
          className="text-blue-400 hover:text-blue-300 underline"
        >
          View Detailed Logs
        </a>
      </footer>
    </div>
  );
}
